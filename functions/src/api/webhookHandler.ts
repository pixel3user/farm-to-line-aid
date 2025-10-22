// LINE Bot Webhook Handler for Farm2Market AI
import { LineBotAPI, MessageTemplates, WebhookEvent, LineMessage } from './lineBot';
import { EventDeduper } from '../lib/idempotency';
import { generateOutOfScopeAnswer, generateConversationPlan, analyzeImageWithGemini } from '../lib/gemini-client';
import type { ConversationHistoryItem } from '../lib/gemini-client';
import { ConversationStore } from '../lib/conversationStore';
import DatabaseService from '../lib/database-server';
import admin from '../lib/firebaseAdmin';
import sharp from 'sharp';

interface TextContext {
  replyToken: string;
  text: string;
  userId: string;
  rawEvent: WebhookEvent;
  history?: ConversationHistoryItem[];
}

const HISTORY_TEXT_LIMIT = 2000;
const IMAGE_COLLECTION = 'images';

export class WebhookHandler {
  private lineBot: LineBotAPI;

  constructor() {
    this.lineBot = new LineBotAPI();
  }

  private debugEvent(event: WebhookEvent): void {
    try {
      const summary = {
        type: event.type,
        replyToken: event.replyToken ? `${event.replyToken.slice(0, 6)}...${event.replyToken.slice(-4)}` : undefined,
        sourceType: event.source?.type,
        userId: event.source?.userId,
        messageType: event.message?.type,
        textPreview:
          event.message?.type === 'text' && event.message?.text
            ? event.message.text.slice(0, 160)
            : undefined,
        postbackData: event.postback?.data,
      };

      console.debug('[WebhookHandler] Event payload summary', summary);
    } catch (loggingError) {
      console.warn('[WebhookHandler] Failed to log event summary', loggingError);
    }
  }

  // Main webhook event handler
  async handleEvents(events: WebhookEvent[]): Promise<void> {
    const promises = events.map(event => this.handleSingleEvent(event));
    await Promise.all(promises);
  }

  // Handle individual webhook event
  private async handleSingleEvent(event: WebhookEvent): Promise<void> {
    console.log('Processing event:', event.type);
    this.debugEvent(event);

    try {
      // Idempotency: ensure we only process each event once globally
      const acquired = await EventDeduper.acquire({
        type: event.type,
        replyToken: event.replyToken,
        source: event.source,
        message: event.message,
        timestamp: (event as any).timestamp,
      });
      if (!acquired) {
        console.warn('[WebhookHandler] Duplicate event suppressed');
        return;
      }

      switch (event.type) {
        case 'follow':
          await this.handleFollow(event);
          break;
        case 'message':
          await this.handleMessage(event);
          break;
        case 'postback':
          await this.handlePostback(event);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }
      await EventDeduper.markCompleted({
        type: event.type,
        replyToken: event.replyToken,
        source: event.source,
        message: event.message,
        timestamp: (event as any).timestamp,
      });
    } catch (error) {
      console.error('Error handling event:', error);
    }
  }

  // Handle follow event (user adds bot as friend)
  private async handleFollow(event: WebhookEvent): Promise<void> {
    if (!event.replyToken) return;

    console.debug('[WebhookHandler] handleFollow triggered', {
      userId: event.source?.userId,
      replyToken: `${event.replyToken.slice(0, 6)}...${event.replyToken.slice(-4)}`,
    });

    // Upsert Firestore user profile using server-side admin SDK
    try {
      const userId = event.source?.userId;
      if (userId) {
        let displayName: string | undefined;
        let pictureUrl: string | undefined;
        try {
          const profile = await this.lineBot.getUserProfile(userId);
          displayName = profile?.displayName;
          pictureUrl = profile?.pictureUrl;
        } catch (profileErr) {
          console.warn('[WebhookHandler] Failed to fetch LINE profile on follow', profileErr);
        }

        await DatabaseService.upsertLineUser({
          lineUserId: userId,
          displayName,
          pictureUrl,
        });
      }
    } catch (err) {
      console.error('[WebhookHandler] Failed to upsert user on follow', err);
    }

    const welcomeMessages = MessageTemplates.welcomeMessage();
    await this.lineBot.replyMessage(event.replyToken, welcomeMessages);
    console.debug('[WebhookHandler] handleFollow welcome message queue complete');
  }

  // Handle web app access request
  private async handleWebAppAccess(event: WebhookEvent, introMessage?: string): Promise<LineMessage[]> {
    if (!event.replyToken || !event.source?.userId) return [];

    try {
      const userProfile = await this.lineBot.getUserProfile(event.source.userId);
      const webAppUrl = `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?userId=${userProfile.userId}&displayName=${encodeURIComponent(userProfile.displayName)}&pictureUrl=${encodeURIComponent(userProfile.pictureUrl || '')}`;

      const messages: LineMessage[] = [
        ...(introMessage ? [{ type: 'text' as const, text: introMessage }] : []),
        {
          type: 'text' as const,
          text: 'Launching your Farm2Market dashboard...',
        },
        {
          type: 'text' as const,
          text: `Tap the link below to open your Farm2Market control panel:\n\n${webAppUrl}`,
        },
      ];

      await this.lineBot.replyMessage(event.replyToken, messages);
      return messages;
    } catch (error) {
      console.error('Error handling web app access:', error);
      const errorMessage: LineMessage[] = [
        {
          type: 'text' as const,
          text: 'Unable to open the dashboard right now. Please try again shortly.',
        },
      ];
      await this.lineBot.replyMessage(event.replyToken, errorMessage);
      return errorMessage;
    }
  }
  // Handle text/image messages
  private async handleMessage(event: WebhookEvent): Promise<void> {
    if (!event.replyToken || !event.message) return;

    const { message } = event;
    const replyTokenPreview = `${event.replyToken.slice(0, 6)}...${event.replyToken.slice(-4)}`;
    const messageSummary = {
      type: message.type,
      textPreview: message.type === 'text' ? message.text?.slice(0, 160) : undefined,
      messageId: message.id,
    };
    console.debug('[WebhookHandler] handleMessage dispatched', {
      replyToken: replyTokenPreview,
      ...messageSummary,
    });

    if (message.type === 'text') {
      await this.handleTextMessage(event);
    } else if (message.type === 'image') {
      await this.handleImageMessage(event);
    }
  }

  private async handleTextMessage(event: WebhookEvent): Promise<void> {
    if (!event.replyToken || event.message?.type !== 'text' || !event.message.text || !event.source?.userId) {
      return;
    }

    const context: TextContext = {
      replyToken: event.replyToken,
      text: event.message.text,
      userId: event.source.userId,
      rawEvent: event,
    };
    context.history = await ConversationStore.getRecentTurns(context.userId);

    const textPreview = context.text.length > 160 ? `${context.text.slice(0, 157)}...` : context.text;
    console.debug('[WebhookHandler] handleTextMessage received', {
      userId: context.userId,
      replyToken: `${context.replyToken.slice(0, 6)}...${context.replyToken.slice(-4)}`,
      text: textPreview,
    });

    const handled = await this.handleTextWithGemini(context);

    if (!handled) {
      console.debug('[WebhookHandler] Gemini returned no actionable plan, falling back to general inquiry handler');
      const messages = await this.handleGeneralInquiry(context.replyToken, context.text.trim() || context.text, context.history);
      await this.persistConversation(context, messages);
    }
  }

  private async handleTextWithGemini(context: TextContext): Promise<boolean> {
    const { replyToken, text, userId, rawEvent } = context;
    const trimmedText = text.trim();
    if (!trimmedText) {
      return false;
    }

    let replied = false;

    try {
      const history = context.history ?? (await ConversationStore.getRecentTurns(userId));
      context.history = history;

      const plan = await generateConversationPlan({ message: trimmedText, history });
      let introMessage = plan.text;

      if (plan.functionCalls.length) {
        for (const call of plan.functionCalls) {
          const callIntro = introMessage;
          introMessage = undefined;

          let responseMessages: LineMessage[] | undefined;

          switch (call.name) {
            case 'show_product_tools':
              console.debug('[WebhookHandler] Gemini selected product tools');
              responseMessages = await this.handleProductInquiry(replyToken, callIntro);
              break;
            case 'show_store_tools':
              console.debug('[WebhookHandler] Gemini selected store tools');
              responseMessages = await this.handleStoreInquiry(replyToken, callIntro);
              break;
            case 'show_marketing_tools':
              console.debug('[WebhookHandler] Gemini selected marketing tools');
              responseMessages = await this.handleMarketingInquiry(replyToken, callIntro);
              break;
            case 'show_analytics_tools':
              console.debug('[WebhookHandler] Gemini selected analytics tools');
              responseMessages = await this.handleAnalyticsInquiry(replyToken, callIntro);
              break;
            case 'open_dashboard':
              console.debug('[WebhookHandler] Gemini selected dashboard access');
              responseMessages = await this.handleWebAppAccess({ ...rawEvent, replyToken, source: { ...rawEvent.source, userId } } as WebhookEvent, callIntro);
              break;
            case 'show_help_options':
              console.debug('[WebhookHandler] Gemini selected help options');
              responseMessages = await this.handleHelpInquiry(replyToken, callIntro);
              break;
            default:
              console.warn('[WebhookHandler] Gemini returned unknown function call', call.name);
              break;
          }

          if (responseMessages && responseMessages.length) {
            await this.persistConversation(context, responseMessages);
            return true;
          }
        }
      }

      if (plan.text) {
        console.debug('[WebhookHandler] Gemini returned direct answer text');
        const messages: LineMessage[] = [
          {
            type: 'text',
            text: plan.text,
          },
        ];
        await this.lineBot.replyMessage(replyToken, messages);
        replied = true;
        try {
          await this.persistConversation(context, messages);
        } catch (persistError) {
          console.warn('[WebhookHandler] Failed to persist conversation after reply:', persistError);
        }
        return true;
      }
    } catch (error) {
      console.error('[WebhookHandler] Gemini conversation plan failed:', error);
      if (replied) {
        return true;
      }
    }

    return false;
  }

  private async handleImageMessage(event: WebhookEvent): Promise<void> {
    if (!event.replyToken || event.message?.type !== 'image' || !event.message.id || !event.source?.userId) {
      return;
    }

    const userId = event.source.userId;
    const context: TextContext = {
      replyToken: event.replyToken,
      text: `[Image uploaded: ${event.message.id}]`,
      userId,
      rawEvent: event,
    };

    try {
      const rawImage = await this.lineBot.getMessageContent(event.message.id);
      if (!rawImage.length) {
        throw new Error('Received empty image buffer from LINE API');
      }

      const optimizedImage = await sharp(rawImage).rotate().jpeg({ quality: 70 }).toBuffer();
      const bucket = admin.storage().bucket();
      const filePath = `line_user_images/${userId}/${Date.now()}-${event.message.id}.jpg`;
      const file = bucket.file(filePath);

      await file.save(optimizedImage, {
        contentType: 'image/jpeg',
        resumable: false,
        metadata: { cacheControl: 'public,max-age=31536000' },
      });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      await admin
        .firestore()
        .collection('line_users')
        .doc(userId)
        .collection(IMAGE_COLLECTION)
        .add({
          messageId: event.message.id,
          storagePath: filePath,
          downloadUrl: signedUrl,
          size: optimizedImage.length,
          contentType: 'image/jpeg',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      const history = await ConversationStore.getRecentTurns(userId);
      context.history = history;

      const analysis = await analyzeImageWithGemini({
        base64Image: optimizedImage.toString('base64'),
        history,
        prompt: 'Describe this farm-related image and suggest how Farm2Market AI can help the user act on it.',
      });

      const responseMessages: LineMessage[] = [
        { type: 'text', text: analysis },
        {
          type: 'template',
          altText: 'Image actions',
          template: {
            type: 'buttons',
            title: 'Use this image',
            text: 'Choose what to do next with your image.',
            actions: [
              {
                type: 'postback',
                label: 'Create flyer',
                data: `action=create_flyer&image=${encodeURIComponent(filePath)}`,
              },
              {
                type: 'postback',
                label: 'Shelf card',
                data: `action=create_shelf_card&image=${encodeURIComponent(filePath)}`,
              },
              {
                type: 'postback',
                label: 'Recipe card',
                data: `action=create_recipe_card&image=${encodeURIComponent(filePath)}`,
              },
            ],
          },
        },
      ];

      await this.lineBot.replyMessage(event.replyToken, responseMessages);
      await this.persistConversation({ ...context, text: `[Image stored: ${filePath}]` }, responseMessages);
    } catch (error) {
      console.error('Failed to handle image message:', error);
      const fallback: LineMessage[] = [
        {
          type: 'text' as const,
          text: 'Sorry, I could not process that image. Please try again or send a different photo.',
        },
      ];
      await this.lineBot.replyMessage(event.replyToken, fallback);
      await this.persistConversation(context, fallback);
    }
  }

  private getProductInquiryMessages(): LineMessage[] {
    return [
      {
        type: 'text' as const,
        text: `📦 Product tools overview

• Add or edit products in seconds
• Track live inventory and restock risk
• Let AI schedule replenishment reminders
• Improve product photos and descriptions

Choose an option below to continue.`,
      },
      {
        type: 'template' as const,
        altText: 'Product tools quick menu',
        contents: {
          type: 'buttons',
          title: 'Product tools',
          text: 'What can I help you with?',
          actions: [
            {
              type: 'uri',
              label: 'Manage products',
              uri: `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=products`
            },
            {
              type: 'postback',
              label: 'Inventory insights',
              data: 'action=stock_analysis'
            }
          ]
        }
      }
    ];
  }

  private async handleProductInquiry(replyToken: string, introMessage?: string): Promise<LineMessage[]> {
    const messages = introMessage
      ? [{ type: 'text' as const, text: introMessage }, ...this.getProductInquiryMessages()]
      : this.getProductInquiryMessages();

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private getStoreInquiryMessages(): LineMessage[] {
    return [
      {
        type: 'text' as const,
        text: `🏪 Store outreach tools

• Discover nearby retailers
• Send polished introductions in one tap
• Track relationship status and next steps
• Review order frequency and follow-ups

Select what you need help with below.`,
      },
      {
        type: 'template' as const,
        altText: 'Store outreach quick menu',
        contents: {
          type: 'buttons',
          title: 'Store outreach',
          text: 'Pick a shortcut',
          actions: [
            {
              type: 'uri',
              label: 'Find new buyers',
              uri: `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=stores&action=find`
            },
            {
              type: 'uri',
              label: 'Manage CRM',
              uri: `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=stores`
            }
          ]
        }
      }
    ];
  }

  private async handleStoreInquiry(replyToken: string, introMessage?: string): Promise<LineMessage[]> {
    const messages = introMessage
      ? [{ type: 'text' as const, text: introMessage }, ...this.getStoreInquiryMessages()]
      : this.getStoreInquiryMessages();

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private getMarketingInquiryMessages(): LineMessage[] {
    return [
      {
        type: 'text' as const,
        text: `📱 Marketing studio

• Auto-generate product flyers
• Draft social captions in seconds
• Build recipe or shelf cards
• Collect campaign ideas and schedules

Let me know what you want to create.`,
      },
      {
        type: 'template' as const,
        altText: 'Marketing tools quick menu',
        contents: {
          type: 'buttons',
          title: 'Marketing tools',
          text: 'Choose a creative task',
          actions: [
            {
              type: 'uri',
              label: 'Generate campaign',
              uri: `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=marketing&action=generate`
            },
            {
              type: 'uri',
              label: 'Copywriting help',
              uri: `${process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=marketing&action=copywriting`
            }
          ]
        }
      }
    ];
  }

  private async handleMarketingInquiry(replyToken: string, introMessage?: string): Promise<LineMessage[]> {
    const messages = introMessage
      ? [{ type: 'text' as const, text: introMessage }, ...this.getMarketingInquiryMessages()]
      : this.getMarketingInquiryMessages();

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private getAnalyticsInquiryMessages(): LineMessage[] {
    const summaryData = {
      orders: 3,
      revenue: 2400,
      newLeads: 1,
      pendingTasks: 2,
    };

    return [MessageTemplates.dailySummary(summaryData)];
  }

  private async handleAnalyticsInquiry(replyToken: string, introMessage?: string): Promise<LineMessage[]> {
    const baseMessages = this.getAnalyticsInquiryMessages();
    const messages = introMessage
      ? [{ type: 'text' as const, text: introMessage }, ...baseMessages]
      : baseMessages;

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private getHelpInquiryMessages(): LineMessage[] {
    return [
      {
        type: 'text' as const,
        text: `🤖 Farm2Market AI quick guide

📦 Product management: keep listings and inventory synced
🏪 Store outreach: find and nurture buyers
📱 Marketing tools: auto-generate content and flyers
📈 Analytics: track performance and reminders

Tips:
• Upload product photos to get instant marketing assets
• AI reminders highlight the next best action
• Supports Traditional Chinese and English responses`,
      }
    ];
  }

  private async handleHelpInquiry(replyToken: string, introMessage?: string): Promise<LineMessage[]> {
    const messages = introMessage
      ? [{ type: 'text' as const, text: introMessage }, ...this.getHelpInquiryMessages()]
      : this.getHelpInquiryMessages();

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async handleGeneralInquiry(replyToken: string, text: string, history?: ConversationHistoryItem[]): Promise<LineMessage[]> {
    console.debug('[WebhookHandler] handleGeneralInquiry using Gemini fallback');

    let aiReply = '';

    try {
      aiReply = await generateOutOfScopeAnswer({ message: text, history });
    } catch (error) {
      console.error('[WebhookHandler] Gemini response failed:', error);
      aiReply = 'Thanks for your question! I do not have that information right now, but you can reach our Farm2Market support team for more help.';
    }

    const messages: LineMessage[] = [
      {
        type: 'text' as const,
        text: aiReply,
      },
    ];

    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async persistConversation(context: TextContext, assistantMessages: LineMessage[]): Promise<void> {
    const userEntry = context.text.trim().slice(0, HISTORY_TEXT_LIMIT);
    const assistantEntry = this.convertMessagesToHistoryText(assistantMessages).trim();

    if (!userEntry && !assistantEntry) {
      return;
    }

    const turns: { role: 'user' | 'assistant'; text: string }[] = [];

    if (userEntry) {
      turns.push({ role: 'user', text: userEntry });
    }

    if (assistantEntry) {
      turns.push({ role: 'assistant', text: assistantEntry });
    }

    if (!turns.length) {
      return;
    }

    await ConversationStore.appendTurns(context.userId, turns);
  }

  private convertMessagesToHistoryText(messages: LineMessage[]): string {
    const parts: string[] = [];

    for (const message of messages) {
      switch (message.type) {
        case 'text':
          if (message.text) {
            parts.push(message.text);
          }
          break;
        case 'template':
        case 'flex':
          if (message.altText) {
            parts.push(message.altText);
          } else {
            parts.push(`[${message.type} message]`);
          }
          break;
        default:
          parts.push(`[${message.type} message]`);
          break;
      }
    }

    return parts.join('\n\n').slice(0, HISTORY_TEXT_LIMIT);
  }


  // Postback action handlers
  private async handlePostback(event: WebhookEvent): Promise<void> {
    if (!event.replyToken || !event.postback) return;

    const postbackData = this.parsePostbackData(event.postback.data);

    switch (postbackData.action) {
      case 'send_intro':
        await this.handleSendIntro(event.replyToken, postbackData.store);
        break;
      case 'send_reorder_reminder':
        await this.handleSendReorderReminder(event.replyToken, postbackData.store, postbackData.product);
        break;
      case 'create_flyer':
        await this.handleCreateFlyer(event.replyToken, postbackData.image);
        break;
      case 'create_shelf_card':
        await this.handleCreateShelfCard(event.replyToken, postbackData.image);
        break;
      case 'create_recipe_card':
        await this.handleCreateRecipeCard(event.replyToken, postbackData.image);
        break;
      case 'snooze_reminder':
        await this.handleSnoozeReminder(event.replyToken, postbackData.store);
        break;
      default:
        console.log('Unhandled postback action:', postbackData.action);
    }
  }

  private async handleSendIntro(replyToken: string, storeName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `Here is an introduction you can share with ${storeName || 'your buyer'}:

Hello! We are Farm2Market AI — ready to help streamline orders, keep products fresh, and deliver consistent quality. Let me know what you need and I’ll prepare everything for you.`,
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleSendReorderReminder(replyToken: string, storeName?: string, productName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `Reorder reminder drafted for ${storeName || 'your customer'}:

Hi there! Just a friendly reminder that it's a great time to restock ${productName || 'your preferred items'}. Let me know the quantities you need and I’ll take care of it right away.`,
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateFlyer(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: 'I will create a marketing flyer with this image and send you a preview shortly.',
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateShelfCard(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: 'A shelf card is on the way! I will format the pricing and highlights and share the final card soon.',
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateRecipeCard(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: 'Great idea! I’ll prepare a recipe card featuring this product and send a draft once it is ready.',
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleSnoozeReminder(replyToken: string, storeName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `Understood. I’ll snooze reminders for ${storeName || 'this store'} and let you know when it is time to follow up again.`,
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  // Utility functions
  private parsePostbackData(data: string): Record<string, string> {
    const params = new URLSearchParams(data);
    const result: Record<string, string> = {};
    
    for (const [key, value] of params) {
      result[key] = value;
    }
    
    return result;
  }
}

// Export for use in serverless functions or express routes
export default WebhookHandler;
