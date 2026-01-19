// LINE Bot Webhook Handler for Farm2Market AI
import { LineBotAPI, MessageTemplates, WebhookEvent, LineMessage, RichMenuManager } from './lineBot';
import { EventDeduper } from '../lib/idempotency';
import { generateConversationPlan, analyzeImageWithGemini } from '../lib/gemini-client';
import type { ConversationHistoryItem } from '../lib/gemini-client';
import { ConversationStore } from '../lib/conversationStore';
import DatabaseService from '../lib/database-server';
import admin from '../lib/firebaseAdmin';
import sharp from 'sharp';
import runtimeConfig from '../lib/runtimeConfig';
import { GoogleGenAI } from '@google/genai';

interface TextContext {
  replyToken: string;
  text: string;
  userId: string;
  rawEvent: WebhookEvent;
  history?: ConversationHistoryItem[];
}

const HISTORY_TEXT_LIMIT = 2000;
const IMAGE_COLLECTION = 'images';
const PRODUCT_DRAFTS_COLLECTION = 'product_drafts';
const SESSION_IDLE_MS = 10 * 60 * 1000; // 10 minutes

export class WebhookHandler {
  private lineBot: LineBotAPI;
  private richMenuManager: RichMenuManager;
  private geminiClient: GoogleGenAI | null;
  private readonly geminiImageModelId = 'gemini-2.5-flash-image';

  constructor() {
    this.lineBot = new LineBotAPI();
    this.richMenuManager = new RichMenuManager();
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GENERATIVE_LANGUAGE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      '';
    this.geminiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  private buildProductCarousel(
    products: Array<{ id?: string; name: string; price?: number; unit?: string; stock?: number; images?: string[] }>,
    title: string,
    role: 'farmer' | 'market'
  ): LineMessage {
    const heroColor = '#1DB446';
    const bubbles = products.map(p => {
      const imageUrl = (p.images && p.images.length ? p.images[0] : undefined) || this.getGenericProductImageUrl(p.name, 'general');
      const priceText = typeof p.price === 'number' ? `NT$${p.price} ${p.unit || ''}`.trim() : '—';
      const stockText = typeof p.stock === 'number' ? String(p.stock) : '—';
      const liffUrlBase = process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app';
      const paramProduct = p.id ? `&product=${encodeURIComponent(p.id)}` : '';
      const manageUrl = `${liffUrlBase}?tab=products&role=${role}${paramProduct}`;
      return {
        type: 'bubble' as const,
        hero: imageUrl ? { type: 'image' as const, url: imageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } : undefined,
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            { type: 'text' as const, text: p.name, weight: 'bold', size: 'md' },
            { type: 'box' as const, layout: 'vertical' as const, margin: 'md', spacing: 'sm', contents: [
              { type: 'box' as const, layout: 'baseline' as const, spacing: 'sm', contents: [
                { type: 'text' as const, text: '價格', color: '#aaaaaa', size: 'sm', flex: 1 },
                { type: 'text' as const, text: priceText, color: '#666666', size: 'sm', flex: 5, wrap: true },
              ] },
              { type: 'box' as const, layout: 'baseline' as const, spacing: 'sm', contents: [
                { type: 'text' as const, text: '庫存', color: '#aaaaaa', size: 'sm', flex: 1 },
                { type: 'text' as const, text: stockText, color: '#666666', size: 'sm', flex: 5, wrap: true },
              ] },
            ]},
          ],
        },
        footer: {
          type: 'box' as const,
          layout: 'vertical' as const,
          spacing: 'sm',
          contents: [
            { type: 'button' as const, style: 'primary' as const, height: 'sm' as const, action: { type: 'uri' as const, label: role === 'market' ? '查看產品' : '管理產品', uri: manageUrl } },
          ],
        },
      };
    });

    return {
      type: 'flex',
      altText: title,
      contents: {
        type: 'carousel',
        contents: bubbles.slice(0, 10),
        header: undefined,
      } as any,
    };
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

    let displayName: string | undefined;
    try {
      if (event.source?.userId) {
        const profile = await this.lineBot.getUserProfile(event.source.userId);
        displayName = profile?.displayName;
      }
    } catch {}

    const welcomeMessages = MessageTemplates.welcomeMessagePersonalized(displayName);
    await this.lineBot.replyMessage(event.replyToken, welcomeMessages);

    // Attach onboarding rich menu (role picker) if configured
    if (runtimeConfig.richMenuOnboardingId && event.source?.userId) {
      await this.linkRichMenuSafe(event.source.userId, runtimeConfig.richMenuOnboardingId, 'onboarding');
    }

    console.debug('[WebhookHandler] handleFollow welcome message queue complete');
  }

  // Handle web app access request
  private async handleWebAppAccess(event: WebhookEvent, introMessage?: string): Promise<LineMessage[]> {
    if (!event.replyToken || !event.source?.userId) return [];

    try {
      const userProfile = await this.lineBot.getUserProfile(event.source.userId);
      const roleParam = (await DatabaseService.getLineUser(event.source.userId))?.role || 'farmer';
      const webAppUrl = `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=dashboard&role=${roleParam}&userId=${userProfile.userId}&displayName=${encodeURIComponent(userProfile.displayName)}&pictureUrl=${encodeURIComponent(userProfile.pictureUrl || '')}`;

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

    // Reset session after idle window to prevent stale context from influencing intent
    const lastTs = this.getLastTurnTimestamp(context.history);
    const nowMs = Date.now();
    const sessionExpired = !lastTs || nowMs - lastTs > SESSION_IDLE_MS;
    if (sessionExpired) {
      context.history = [];
      try {
        await this.expireOldDrafts(context.userId);
      } catch (e) {
        console.warn('[WebhookHandler] Failed to expire old drafts:', e);
      }
      try {
        await this.clearSearchContext(context.userId);
      } catch (e) {
        console.warn('[WebhookHandler] Failed to clear search context on session reset:', e);
      }
    }

    // If there is a pending product draft awaiting an image, allow free-text commands
    try {
      const draft = await this.getLatestProductDraft(context.userId);
      if (draft) {
        const lower = context.text.trim().toLowerCase();
        const zh = context.text.trim();
        const isSkip = /\bskip\b|no\s*image|不要.*(圖|照片)|跳過/.test(lower) || /跳過/.test(zh);
        const isGeneric = /\bgeneric\b|use\s*a?\s*generic(\s*image)?|通用(圖|圖片)/.test(lower) || /通用圖|通用圖片/.test(zh);
        const isCancel = /\bcancel\b|取消/.test(lower) || /取消/.test(zh);

        if (isCancel) {
          await admin.firestore()
            .collection('line_users').doc(context.userId)
            .collection(PRODUCT_DRAFTS_COLLECTION).doc(draft.id)
            .update({ status: 'cancelled', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          const msg: LineMessage[] = [ { type: 'text', text: '已取消建立此產品。' } ];
          await this.lineBot.replyMessage(context.replyToken, msg);
          await this.persistConversation(context, msg);
          return;
        }

        if (isSkip || isGeneric) {
          const imageUrl = isGeneric
            ? this.getGenericProductImageUrl(String(draft.data?.name || ''), String(draft.data?.category || ''))
            : undefined;
          const messages = await this.finalizeProductDraft(context.replyToken, context.userId, draft.id, draft.data, imageUrl, undefined);
          await this.persistConversation(context, messages);
          return;
        }
      }
    } catch (e) {
      console.warn('[WebhookHandler] Draft action detection failed:', e);
    }

    const textPreview = context.text.length > 160 ? `${context.text.slice(0, 157)}...` : context.text;
    console.debug('[WebhookHandler] handleTextMessage received', {
      userId: context.userId,
      replyToken: `${context.replyToken.slice(0, 6)}...${context.replyToken.slice(-4)}`,
      text: textPreview,
    });

    // Quick parser: detect simple product search like "eggs less than 180" or "< 180"
    const quickHandled = await this.tryHandleQuickProductQuery(context);
    if (quickHandled) {
      return;
    }

    const handled = await this.handleTextWithGemini(context);

    if (!handled) {
      console.debug('[WebhookHandler] No actionable plan; requesting clarifying question from Gemini');
      try {
        const clarify = await generateConversationPlan({
          message: `${context.text}\n\n(若資訊不足，請以一個簡短澄清問題回覆，並提供 2–4 個 quick replies。)`,
          history: context.history,
          sessionUserId: context.userId,
        });
        if (clarify.lineMessages && clarify.lineMessages.length) {
          await this.lineBot.replyMessage(context.replyToken, clarify.lineMessages);
          await this.persistConversation(context, clarify.lineMessages);
          return;
        }
        if (clarify.text && clarify.text.trim()) {
          const msg: LineMessage[] = [{ type: 'text', text: clarify.text.trim() }];
          await this.lineBot.replyMessage(context.replyToken, msg);
          await this.persistConversation(context, msg);
          return;
        }
      } catch (e) {
        console.warn('[WebhookHandler] Clarifying plan failed; sending minimal prompt');
      }
      const minimal: LineMessage[] = [
        { type: 'text', text: '想更精準協助您，請用一句話說明要做的事（例如：新增雞蛋 120/斤 20 箱）。' },
      ];
      await this.lineBot.replyMessage(context.replyToken, minimal);
      await this.persistConversation(context, minimal);
    }
  }

  private async tryHandleQuickProductQuery(context: TextContext): Promise<boolean> {
    const text = context.text.toLowerCase();
    // Do not hijack explicit create intents
    const isCreateIntent = /(\badd\b|\bcreate\b|\bnew\b|新增|建立|添加|加上)/i.test(context.text);
    if (isCreateIntent) {
      return false;
    }

    // Only trigger this quick path when user clearly asks to search/list or uses a comparison
    const hasSearchVerb = /(\bsearch\b|\bfind\b|\bshow\b|\blist\b|\bbrowse\b|搜尋|查找|查詢|找|顯示|列出)/i.test(context.text);
    const hasCompare = /(?:<|less than|<=|低於|小於|不超過|不超於)/i.test(context.text);
    if (!hasSearchVerb && !hasCompare) {
      return false;
    }
    const priceLessMatch = text.match(/(?:<|less than|under|below|低於|小於)\s*(\d+)/i);
    const priceLeMatch = text.match(/(?:<=|≤|不超過|不超於)\s*(\d+)/i);
    const priceMax = priceLessMatch ? Number(priceLessMatch[1]) : priceLeMatch ? Number(priceLeMatch[1]) : undefined;

    // extract a simple keyword (e.g., eggs)
    // improved heuristic: take tokens (letters/CJK) excluding common stopwords; prefer length>=3 for Latin
    const words = text
      .replace(/\d+/g, ' ')
      .split(/[^\p{L}\p{N}\u3400-\u9FFF]+/u)
      .filter(Boolean);
    const stop = new Set([
      'i','im','i\'m','me','my','mine','you','your','yours',
      'want','wanna','would','like','to','buy','need','looking','for','show','list','browse','find','search','price','should','be','under','below','less','than',
      'the','a','an','of','on','at','in','with','and','or',
      '箱','斤','低於','小於','不超過','不超於','買','我要','我想','想要','搜尋','查找','查詢','找','顯示','列出'
    ]);
    const candidates = words.filter(w => !stop.has(w));
    let keyword: string | undefined = undefined;
    // prefer CJK tokens or Latin tokens with length>=3
    for (const w of candidates) {
      if (/^[\u3400-\u9FFF]+$/u.test(w)) { keyword = w; break; }
      if (/^[a-z]+$/i.test(w) && w.length >= 3) { keyword = w; break; }
    }

    if (!priceMax && !keyword) {
      return false;
    }

    try {
      const list = await DatabaseService.searchProductsPublic({
        nameContains: keyword,
        maxPrice: typeof priceMax === 'number' && !Number.isNaN(priceMax) ? priceMax : undefined,
        limit: 5,
      });
      if (!list.length) {
        return false;
      }
      const flex: LineMessage = this.buildProductCarousel(list, '🔎 快速搜尋結果', 'market');
      const messages: LineMessage[] = [flex];
      await this.lineBot.replyMessage(context.replyToken, messages);
      // persist sticky filters for follow-up turns
      await this.setSearchContext(context.userId, {
        nameContains: keyword,
        maxPrice: typeof priceMax === 'number' && !Number.isNaN(priceMax) ? priceMax : undefined,
      });
      await this.persistConversation(context, messages);
      return true;
    } catch {
      return false;
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

      // Load user profile to personalize Gemini plan
      let userProfile: { displayName?: string; role?: 'farmer' | 'market' } | undefined;
      try {
        const profile = await DatabaseService.getLineUser(userId);
        if (profile) {
          userProfile = { displayName: profile.displayName, role: profile.role };
        }
      } catch {}

      const plan = await generateConversationPlan({ message: trimmedText, history, user: userProfile, sessionUserId: userId });
      let introMessage = plan.text;

      if (plan.functionCalls.length) {
        for (const call of plan.functionCalls) {
          const callIntro = introMessage;
          introMessage = undefined;

          let responseMessages: LineMessage[] | undefined;

          switch (call.name) {
            case 'product_browse_public': {
              const limit = typeof (call.args as any)?.limit === 'number' ? Math.min(Math.max((call.args as any).limit, 1), 10) : 5;
              const list = await DatabaseService.getAllProducts(limit);
              const flex = this.buildProductCarousel(list, '📦 公開產品清單', 'market');
              const messages: LineMessage[] = [flex, { type: 'text', text: '僅顯示商業資訊，個資不會顯示。需要聯絡時我可以幫您草擬訊息。' }];
              await this.lineBot.replyMessage(replyToken, messages);
              responseMessages = messages;
              break;
            }
            case 'product_search_public': {
              console.debug('[WebhookHandler] Executing product_search_public');
              const args = (call.args as any) || {};
              try { console.debug('[WebhookHandler] product_search_public args', { args }); } catch {}
              // Merge with sticky search context to avoid losing the user's keyword across follow-ups
              const persisted = await this.getSearchContext(userId).catch(() => undefined as any);
              const mergedFilters = {
                nameContains: typeof args.nameContains === 'string' && args.nameContains.trim() ? args.nameContains : (persisted?.nameContains ?? undefined),
                categoryEquals: typeof args.categoryEquals === 'string' && args.categoryEquals.trim() ? args.categoryEquals : (persisted?.categoryEquals ?? undefined),
                tagsAny: Array.isArray(args.tagsAny) && args.tagsAny.length ? (args.tagsAny as any[]).filter(v => typeof v === 'string').slice(0, 10) : (Array.isArray(persisted?.tagsAny) ? persisted.tagsAny.slice(0, 10) : undefined),
                minPrice: typeof args.minPrice === 'number' ? args.minPrice : (typeof persisted?.minPrice === 'number' ? persisted.minPrice : undefined),
                maxPrice: typeof args.maxPrice === 'number' ? args.maxPrice : (typeof persisted?.maxPrice === 'number' ? persisted.maxPrice : undefined),
                limit: typeof args.limit === 'number' ? args.limit : undefined,
              } as any;
              const list = await DatabaseService.searchProductsPublic(mergedFilters);
              try { console.debug('[WebhookHandler] product_search_public results', { count: list.length }); } catch {}
              if (!list.length) {
                const question: LineMessage = {
                  type: 'text',
                  text: '沒有找到符合的產品。要不要換個關鍵字或調整價格範圍？',
                  quickReply: {
                    items: [
                      { type: 'action', action: { type: 'message', label: '顯示全部', text: '列出所有產品' } },
                      { type: 'action', action: { type: 'message', label: '價格 ≤ 200', text: '找 200 以下 的產品' } },
                      { type: 'action', action: { type: 'message', label: '水果', text: '找 水果 類 產品' } },
                      { type: 'action', action: { type: 'message', label: '雞蛋', text: '找 雞蛋' } },
                    ]
                  }
                };
                await this.lineBot.replyMessage(replyToken, [question]);
                responseMessages = [question];
                break;
              }
              const flex = this.buildProductCarousel(list, '🔎 產品搜尋結果', 'market');
              const messages: LineMessage[] = [flex];
              await this.lineBot.replyMessage(replyToken, messages);
              // Update sticky search context based on merged filters
              try {
                await this.setSearchContext(userId, {
                  nameContains: mergedFilters.nameContains,
                  categoryEquals: mergedFilters.categoryEquals,
                  tagsAny: mergedFilters.tagsAny,
                  minPrice: mergedFilters.minPrice,
                  maxPrice: mergedFilters.maxPrice,
                });
              } catch {}
              responseMessages = messages;
              break;
            }
            case 'store_browse_public': {
              const limit = typeof (call.args as any)?.limit === 'number' ? Math.min(Math.max((call.args as any).limit, 1), 10) : 5;
              const list = await DatabaseService.getAllStores(limit);
              const items = list.map(s => ({
                type: 'box', layout: 'vertical', margin: 'md', contents: [
                  { type: 'text', text: s.name, weight: 'bold', size: 'md' },
                  { type: 'text', text: s.type ?? 'other', size: 'sm', color: '#666666' },
                  { type: 'text', text: s.location ?? '', size: 'sm', color: '#666666' },
                ]
              }));
              const flex: LineMessage = { type: 'flex', altText: '公開店家/買家清單', contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '🏪 公開店家/買家', weight: 'bold', color: '#ffffff' } ], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: items } } };
              const messages: LineMessage[] = [flex, { type: 'text', text: '僅顯示商業資訊（名稱/地點/類型）。聯絡方式會以商業管道提供。' }];
              await this.lineBot.replyMessage(replyToken, messages);
              responseMessages = messages;
              break;
            }
            case 'store_search_public': {
              const args = (call.args as any) || {};
              const list = await DatabaseService.searchStoresPublic({
                nameContains: typeof args.nameContains === 'string' ? args.nameContains : undefined,
                typeEquals: typeof args.typeEquals === 'string' ? args.typeEquals : undefined,
                locationContains: typeof args.locationContains === 'string' ? args.locationContains : undefined,
                limit: typeof args.limit === 'number' ? args.limit : undefined,
              });
              if (!list.length) {
                const msg: LineMessage[] = [ { type: 'text', text: '沒有找到符合的店家/買家。您可以更換關鍵字或調整條件。' } ];
                await this.lineBot.replyMessage(replyToken, msg);
                responseMessages = msg;
                break;
              }
              const items = list.map(s => ({ type: 'box', layout: 'vertical', margin: 'md', contents: [ { type: 'text', text: s.name, weight: 'bold' }, { type: 'text', text: s.type ?? 'other', size: 'sm', color: '#666666' }, { type: 'text', text: s.location ?? '', size: 'sm', color: '#666666' } ] }));
              const flex: LineMessage = { type: 'flex', altText: '店家/買家搜尋結果', contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '🔎 店家/買家搜尋結果', weight: 'bold', color: '#ffffff' } ], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: items } } };
              const messages: LineMessage[] = [flex];
              await this.lineBot.replyMessage(replyToken, messages);
              responseMessages = messages;
              break;
            }
            case 'marketplace_get_stats': {
              const stats = await DatabaseService.getMarketplaceStats();
              const flex: LineMessage = { type: 'flex', altText: '市集統計', contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '📊 市集統計', weight: 'bold', color: '#ffffff' } ], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: `賣家/農友: ${stats.sellers}` }, { type: 'text', text: `市場/買家: ${stats.buyers}` }, { type: 'text', text: `產品: ${stats.products}` }, { type: 'text', text: `店家: ${stats.stores}` } ] } } };
              const messages: LineMessage[] = [flex];
              await this.lineBot.replyMessage(replyToken, messages);
              responseMessages = messages;
              break;
            }
            case 'user_set_role': {
              if (!context.rawEvent.source?.userId) break;
              const role = String((call.args as any)?.role || '').trim();
              if (role === 'farmer' || role === 'market') {
                try {
                  await DatabaseService.updateLineUserRole(context.rawEvent.source.userId, role);
                  const nextSteps = MessageTemplates.roleNextSteps(role);
                  const messages: LineMessage[] = [
                    { type: 'text', text: role === 'farmer' ? '已為您設定角色為賣家/農友。' : '已為您設定角色為市場/買家。' },
                    ...nextSteps,
                  ];
                  await this.lineBot.replyMessage(replyToken, messages);
                  responseMessages = messages;
                  await this.applyRoleRichMenu(context.rawEvent.source.userId, role);
                } catch (e) {
                  const fail: LineMessage[] = [ { type: 'text', text: '設定角色時發生問題，請稍後再試。' } ];
                  await this.lineBot.replyMessage(replyToken, fail);
                  responseMessages = fail;
                }
              }
              break;
            }
            // New feature tools
            case 'product_list':
              responseMessages = await this.execProductList(replyToken, userId, call.args);
              break;
            case 'product_create':
              responseMessages = await this.execProductCreate(replyToken, userId, call.args);
              break;
            case 'store_list':
              responseMessages = await this.execStoreList(replyToken, userId, call.args);
              break;
            case 'store_create':
              responseMessages = await this.execStoreCreate(replyToken, userId, call.args);
              break;
            case 'marketing_material_list':
              responseMessages = await this.execMarketingMaterialList(replyToken, userId, call.args);
              break;
            case 'analytics_get_user_stats':
              responseMessages = await this.execAnalyticsUserStats(replyToken, userId);
              break;
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

      if (plan.functionCalls && plan.functionCalls.length) {
        try { console.debug('[WebhookHandler] Gemini functionCalls received', { calls: plan.functionCalls.map(c => c.name) }); } catch {}
      } else {
        try { console.debug('[WebhookHandler] No functionCalls from Gemini'); } catch {}
      }

      if (plan.lineMessages && plan.lineMessages.length) {
        console.debug('[WebhookHandler] Gemini returned structured LINE messages');
        await this.lineBot.replyMessage(replyToken, plan.lineMessages);
        replied = true;
        try {
          await this.persistConversation(context, plan.lineMessages);
        } catch (persistError) {
          console.warn('[WebhookHandler] Failed to persist conversation after structured reply:', persistError);
        }
        return true;
      }

      if (plan.text) {
        try { console.debug('[WebhookHandler] Gemini returned plain text (no tool call)'); } catch {}
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

      let signedUrl: string | undefined;
      try {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        signedUrl = url;
      } catch (signErr: any) {
        // Fallback when service account lacks iam.serviceAccounts.signBlob
        const message = String(signErr?.message || '');
        if (message.includes('iam.serviceAccounts.signBlob') || message.includes('SigningError')) {
          console.warn('[WebhookHandler] getSignedUrl failed; falling back to public URL for', filePath);
          try {
            await file.makePublic();
            signedUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`;
          } catch (pubErr) {
            throw signErr;
          }
        } else {
          throw signErr;
        }
      }

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

      // If user has a product draft awaiting image, finalize it now using this image
      const draft = await this.getLatestProductDraft(userId);
      if (draft) {
        const messages = await this.finalizeProductDraft(event.replyToken, userId, draft.id, draft.data, signedUrl, optimizedImage);
        await this.persistConversation({ ...context, text: `[Image stored and product created from draft: ${draft.id}]` }, messages);
        return;
      }

      // If user previously bound next image to a product, attach it
      const binding = await this.getPendingImageBinding(userId);
      if (binding?.productId) {
        const target = binding.productId === 'latest'
          ? await DatabaseService.getLatestProductByUser(userId)
          : await DatabaseService.getProductById(binding.productId);
        if (target?.id) {
          let workingImages = [signedUrl!, ...((target.images as string[] | undefined) || [])].slice(0, 5);
          const marketing = await this.runMarketingEnhancement({
            userId,
            productId: target.id,
            productName: target.name,
            category: target.category,
            description: target.description,
            imageBuffer: optimizedImage,
          });

          if (marketing?.enhancedImageUrl) {
            workingImages = [marketing.enhancedImageUrl, ...workingImages.filter((url) => url !== marketing.enhancedImageUrl)];
          }

          const updatePayload: Partial<{ images: string[]; description: string }> = { images: workingImages };
          if (marketing?.text) {
            updatePayload.description = marketing.text;
          }
          await DatabaseService.updateProduct(userId, target.id, updatePayload);
          await this.clearPendingImageBinding(userId);

          const ok: LineMessage[] = [
            this.buildProductListingFlexCard({
              title: '✅ 已更新產品照片',
              role: 'farmer',
              product: {
                name: target.name,
                price: target.price,
                unit: target.unit,
                stock: target.stock,
                category: target.category,
                tags: (target.tags as string[] | undefined) || [],
              },
              imageUrl: workingImages[0],
            }),
          ];
          await this.lineBot.replyMessage(event.replyToken, ok);
          await this.persistConversation(context, ok);
          return;
        }
      }

      // Otherwise, proceed with general image analysis and actions
      const history = await ConversationStore.getRecentTurns(userId);
      context.history = history;

      const analysis = await analyzeImageWithGemini({
        base64Image: optimizedImage.toString('base64'),
        history,
        prompt: 'Describe this farm-related image and suggest how Farm2Market AI can help the user act on it.',
      });

      const responseMessages: LineMessage[] = [
        { type: 'text', text: analysis, quickReply: { items: [ { type: 'action', action: { type: 'postback', label: '用於最新建立的產品', data: 'action=product_image_use_latest' } } ] } },
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
              uri: `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=products`
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
              uri: `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=stores&action=find`
            },
            {
              type: 'uri',
              label: 'Manage CRM',
              uri: `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=stores`
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
              uri: `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=marketing&action=generate`
            },
            {
              type: 'uri',
              label: 'Copywriting help',
              uri: `${process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app'}?tab=marketing&action=copywriting`
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

  // Tool-executing helpers
  private async execProductList(replyToken: string, userId: string, args?: Record<string, unknown>): Promise<LineMessage[]> {
    const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 10) : 5;
    const products = await DatabaseService.getProductsByUser(userId);
    const slice = products.slice(0, limit);
    if (!slice.length) {
      const messages: LineMessage[] = [{ type: 'text', text: '目前沒有產品。您可以告訴我要建立的新產品名稱。' }];
      await this.lineBot.replyMessage(replyToken, messages);
      return messages;
    }
    const flex: LineMessage = this.buildProductCarousel(slice.map(p => ({ id: p.id!, name: p.name, price: p.price, unit: p.unit, stock: p.stock, images: p.images })), '📦 產品清單', 'farmer');
    const messages = [flex];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async execProductCreate(replyToken: string, userId: string, args?: Record<string, unknown>): Promise<LineMessage[]> {
    const name = typeof args?.name === 'string' ? args.name.trim() : '';
    const price = typeof args?.price === 'number' ? args.price : undefined;
    const stock = typeof args?.stock === 'number' ? args.stock : undefined;
    const unit = typeof args?.unit === 'string' ? args.unit.trim() : '';

    // Validate required fields: name, price (>0), unit (non-empty), stock (>=0)
    const missing: string[] = [];
    if (!name) missing.push('名稱');
    if (!(typeof price === 'number' && price > 0)) missing.push('價格');
    if (!unit) missing.push('單位');
    if (!(typeof stock === 'number' && stock >= 0)) missing.push('庫存');

    if (missing.length) {
      const msg: LineMessage[] = [
        { type: 'text', text: `無法建立產品。請提供完整資訊：${missing.join('、')}。` },
        { type: 'text', text: '例如：「新增產品 雞蛋 價格 120 單位 斤 庫存 10」' },
      ];
      await this.lineBot.replyMessage(replyToken, msg);
      return msg;
    }

    const description = typeof args?.description === 'string' ? args.description : '';
    const category = typeof args?.category === 'string' ? args.category : 'general';
    const tags = Array.isArray(args?.tags) ? (args?.tags as unknown[]).filter(t => typeof t === 'string') as string[] : [];
    const imageUrl = typeof args?.imageUrl === 'string' ? args.imageUrl : undefined;

    // Create immediately; if no imageUrl, use a generic placeholder or leave empty
    const fallbackUrl = imageUrl || this.getGenericProductImageUrl(name, category);
    const { id } = await DatabaseService.createProduct(userId, { name, price, stock, unit, description, category, tags, images: fallbackUrl ? [fallbackUrl] : [] });

    const flex: LineMessage = {
      type: 'flex',
      altText: '已建立產品',
      contents: {
        type: 'bubble',
        hero: fallbackUrl ? { type: 'image', url: fallbackUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '✅ 已建立產品', weight: 'bold', size: 'lg' },
            { type: 'text', text: `名稱: ${name}`, margin: 'md' },
            { type: 'text', text: `價格: ${price} ${unit}` },
            { type: 'text', text: `庫存: ${stock}` },
            { type: 'text', text: `ID: ${id}`, size: 'xs', color: '#999999' },
          ],
        },
      },
    };

    const nextMsg: LineMessage = {
      type: 'text',
      text: '若要更新產品照片，您可以隨時再傳一張圖片給我。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'postback', label: '將下一張照片用於此產品', data: `action=product_image_bind&productId=${encodeURIComponent(id)}` } },
        ],
      },
    };

    const messages = [flex, nextMsg];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async execStoreList(replyToken: string, userId: string, args?: Record<string, unknown>): Promise<LineMessage[]> {
    const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 10) : 5;
    const stores = await DatabaseService.getStoresByUser(userId);
    const slice = stores.slice(0, limit);
    if (!slice.length) {
      const messages: LineMessage[] = [{ type: 'text', text: '目前沒有店家紀錄。您可以提供店名，我會為您建立。' }];
      await this.lineBot.replyMessage(replyToken, messages);
      return messages;
    }
    const items = slice.map(s => ({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      contents: [
        { type: 'text', text: s.name, weight: 'bold', size: 'md' },
        { type: 'text', text: s.type ?? 'other', size: 'sm', color: '#666666' },
        { type: 'text', text: s.location ?? '', size: 'sm', color: '#666666' },
      ],
    }));
    const flex: LineMessage = {
      type: 'flex',
      altText: '店家清單',
      contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '🏪 店家清單', weight: 'bold', color: '#ffffff' }], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: items } },
    };
    const messages = [flex];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async execStoreCreate(replyToken: string, userId: string, args?: Record<string, unknown>): Promise<LineMessage[]> {
    const name = typeof args?.name === 'string' ? args.name.trim() : '';
    if (!name) {
      const msg: LineMessage[] = [
        { type: 'text', text: '無法建立店家。請提供店名。' },
        { type: 'text', text: '例如：「新增店家 大樹超市」' },
      ];
      await this.lineBot.replyMessage(replyToken, msg);
      return msg;
    }

    const type = typeof args?.type === 'string' ? args.type : 'other';
    const location = typeof args?.location === 'string' ? args.location : '';
    const { id } = await DatabaseService.createStore(userId, { name, type, location });
    const flex: LineMessage = {
      type: 'flex',
      altText: '已建立店家',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '✅ 已建立店家', weight: 'bold', size: 'lg' }, { type: 'text', text: `名稱: ${name}`, margin: 'md' }, { type: 'text', text: `類型: ${type}` }, { type: 'text', text: `位置: ${location}` }, { type: 'text', text: `ID: ${id}`, size: 'xs', color: '#999999' } ] } },
    };
    const messages = [flex];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async execMarketingMaterialList(replyToken: string, userId: string, args?: Record<string, unknown>): Promise<LineMessage[]> {
    const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 10) : 5;
    const materials = await DatabaseService.getMarketingMaterialsByUser(userId);
    const slice = materials.slice(0, limit);
    if (!slice.length) {
      const messages: LineMessage[] = [{ type: 'text', text: '目前沒有行銷素材。您可以上傳圖片或描述要生成的內容。' }];
      await this.lineBot.replyMessage(replyToken, messages);
      return messages;
    }
    const items = slice.map(m => ({ type: 'box', layout: 'vertical', margin: 'md', contents: [ { type: 'text', text: m.title || m.type, weight: 'bold' }, { type: 'text', text: m.type, size: 'sm', color: '#666666' }, { type: 'text', text: (m.content || '').slice(0, 80), size: 'sm', color: '#666666' } ] }));
    const flex: LineMessage = { type: 'flex', altText: '行銷素材清單', contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '📱 行銷素材', weight: 'bold', color: '#ffffff' } ], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: items } } };
    const messages = [flex];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }

  private async execAnalyticsUserStats(replyToken: string, userId: string): Promise<LineMessage[]> {
    const stats = await DatabaseService.getUserStats(userId);
    const flex: LineMessage = { type: 'flex', altText: '使用者統計', contents: { type: 'bubble', header: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: '📊 使用者統計', weight: 'bold', color: '#ffffff' } ], backgroundColor: '#1DB446' }, body: { type: 'box', layout: 'vertical', contents: [ { type: 'text', text: `產品: ${stats.products}` }, { type: 'text', text: `店家: ${stats.stores}` }, { type: 'text', text: `對話: ${stats.conversations}` } ] } } };
    const messages = [flex];
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

  private async handleGeneralInquiry(replyToken: string): Promise<LineMessage[]> {
    console.debug('[WebhookHandler] handleGeneralInquiry -> clarifying question');
    const messages: LineMessage[] = [
      {
        type: 'text' as const,
        text: '為了更快幫您完成事情，請告訴我要做哪一類：管理產品、拓展店家、行銷素材、或營運分析？',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '管理產品', text: '我要管理產品' } },
            { type: 'action', action: { type: 'message', label: '拓展店家', text: '協助拓展店家' } },
            { type: 'action', action: { type: 'message', label: '行銷素材', text: '我要行銷建議' } },
            { type: 'action', action: { type: 'message', label: '看統計', text: '查看營運分析' } },
          ],
        },
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

    // Handle quick price-range postbacks tied to previous search context
    if (postbackData.action === 'search_set_price' && event.source?.userId) {
      const maxPrice = Number(postbackData.maxPrice);
      const minPrice = Number.isNaN(Number(postbackData.minPrice)) ? undefined : Number(postbackData.minPrice);
      const userId = event.source.userId;
      const prev = await this.getSearchContext(userId).catch(() => undefined as any);
      const merged = {
        nameContains: prev?.nameContains,
        categoryEquals: prev?.categoryEquals,
        tagsAny: prev?.tagsAny,
        minPrice: typeof minPrice === 'number' && !Number.isNaN(minPrice) ? minPrice : prev?.minPrice,
        maxPrice: typeof maxPrice === 'number' && !Number.isNaN(maxPrice) ? maxPrice : prev?.maxPrice,
      } as any;
      const list = await DatabaseService.searchProductsPublic(merged);
      const flex: LineMessage = this.buildProductCarousel(list, '🔎 產品搜尋結果', 'market');
      await this.lineBot.replyMessage(event.replyToken, [flex]);
      await this.setSearchContext(userId, merged).catch(() => {});
      return;
    }

    switch (postbackData.action) {
      case 'product_draft_skip':
      case 'product_draft_generic':
      case 'product_draft_cancel': {
        if (!event.source?.userId) return;
        const userId = event.source.userId;
        const draft = await this.getLatestProductDraft(userId);
        if (!draft) {
          await this.lineBot.replyMessage(event.replyToken!, [ { type: 'text', text: '目前沒有待確認的產品草稿。' } ]);
          break;
        }

        if (postbackData.action === 'product_draft_cancel') {
          await admin.firestore()
            .collection('line_users').doc(userId)
            .collection(PRODUCT_DRAFTS_COLLECTION).doc(draft.id)
            .update({ status: 'cancelled', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          await this.lineBot.replyMessage(event.replyToken!, [ { type: 'text', text: '已取消建立此產品。' } ]);
          break;
        }

        let imageUrl: string | undefined;
        if (postbackData.action === 'product_draft_generic') {
          imageUrl = this.getGenericProductImageUrl(draft.data?.name as string | undefined, draft.data?.category as string | undefined);
        }

        const messages = await this.finalizeProductDraft(event.replyToken!, userId, draft.id, draft.data, imageUrl, undefined);
        await this.persistConversation({ replyToken: event.replyToken!, text: `[Product draft finalized: ${draft.id}]`, userId, rawEvent: event }, messages);
        break;
      }
      case 'set_role':
        try {
          if (event.source?.userId && (postbackData.role === 'farmer' || postbackData.role === 'market')) {
            const role = postbackData.role as 'farmer' | 'market';
            await DatabaseService.updateLineUserRole(event.source.userId, role);
            const roleName = role === 'farmer' ? '賣家/農友' : '市場/買家';
            const messages: LineMessage[] = [
              { type: 'text' as const, text: `已設定角色為：${roleName}。` },
              ...MessageTemplates.roleNextSteps(role),
            ];
            await this.lineBot.replyMessage(event.replyToken, messages);
            await this.applyRoleRichMenu(event.source.userId, role);
          }
        } catch (e) {
          await this.lineBot.replyMessage(event.replyToken, [
            { type: 'text' as const, text: '設定角色時發生問題，請稍後再試。' },
          ]);
        }
        break;
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
      case 'product_image_bind': {
        if (!event.source?.userId) break;
        const productId = postbackData.productId || 'latest';
        await admin.firestore()
          .collection('line_users').doc(event.source.userId)
          .collection('settings')
          .doc('image_binding')
          .set({ productId, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await this.lineBot.replyMessage(event.replyToken!, [ { type: 'text', text: '好的，下一張您傳的照片會套用到該產品。' } ]);
        break;
      }
      case 'product_image_use_latest': {
        if (!event.source?.userId) break;
        await admin.firestore()
          .collection('line_users').doc(event.source.userId)
          .collection('settings')
          .doc('image_binding')
          .set({ productId: 'latest', createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await this.lineBot.replyMessage(event.replyToken!, [ { type: 'text', text: '收到！下一張照片會用於您最新的產品。' } ]);
        break;
      }
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

  // Image binding helpers
  private async getPendingImageBinding(userId: string): Promise<{ productId?: string } | null> {
    const doc = await admin
      .firestore()
      .collection('line_users').doc(userId)
      .collection('settings')
      .doc('image_binding')
      .get();
    if (!doc.exists) return null;
    return (doc.data() as any) || null;
  }

  private async clearPendingImageBinding(userId: string): Promise<void> {
    await admin
      .firestore()
      .collection('line_users').doc(userId)
      .collection('settings')
      .doc('image_binding')
      .delete({ exists: true } as any);
  }

  // Sticky search context helpers (persist filters across follow-ups)
  private async getSearchContext(userId: string): Promise<{ nameContains?: string; categoryEquals?: string; tagsAny?: string[]; minPrice?: number; maxPrice?: number } | null> {
    const ref = admin.firestore().collection('line_users').doc(userId).collection('settings').doc('search_context');
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      nameContains: typeof data?.nameContains === 'string' ? data.nameContains : undefined,
      categoryEquals: typeof data?.categoryEquals === 'string' ? data.categoryEquals : undefined,
      tagsAny: Array.isArray(data?.tagsAny) ? data.tagsAny.filter((t: any) => typeof t === 'string').slice(0, 10) : undefined,
      minPrice: typeof data?.minPrice === 'number' ? data.minPrice : undefined,
      maxPrice: typeof data?.maxPrice === 'number' ? data.maxPrice : undefined,
    };
  }

  private async setSearchContext(userId: string, filters: { nameContains?: string; categoryEquals?: string; tagsAny?: string[]; minPrice?: number; maxPrice?: number }): Promise<void> {
    const ref = admin.firestore().collection('line_users').doc(userId).collection('settings').doc('search_context');
    const payload: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (typeof filters.nameContains === 'string') payload.nameContains = filters.nameContains;
    if (typeof filters.categoryEquals === 'string') payload.categoryEquals = filters.categoryEquals;
    if (Array.isArray(filters.tagsAny)) payload.tagsAny = filters.tagsAny.filter(t => typeof t === 'string').slice(0, 10);
    if (typeof filters.minPrice === 'number') payload.minPrice = filters.minPrice;
    if (typeof filters.maxPrice === 'number') payload.maxPrice = filters.maxPrice;
    await ref.set(payload, { merge: true });
  }

  private async clearSearchContext(userId: string): Promise<void> {
    const ref = admin.firestore().collection('line_users').doc(userId).collection('settings').doc('search_context');
    try {
      await ref.delete();
    } catch {
      // ignore
    }
  }

  private getLastTurnTimestamp(history: ConversationHistoryItem[] | undefined): number | undefined {
    if (!history || !history.length) return undefined;
    const last = history[history.length - 1];
    const ts = (last.timestamp as any);
    try {
      if (!ts) return undefined;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      if (typeof ts?.toMillis === 'function') {
        return ts.toMillis();
      }
      if (ts instanceof Date) {
        return ts.getTime();
      }
    } catch {}
    return undefined;
  }

  private async expireOldDrafts(userId: string): Promise<void> {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    const snapshot = await admin
      .firestore()
      .collection('line_users')
      .doc(userId)
      .collection(PRODUCT_DRAFTS_COLLECTION)
      .where('status', '==', 'awaiting_image')
      .get();

    if (snapshot.empty) return;

    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      const createdAt: any = doc.data().createdAt;
      let createdMs = 0;
      try {
        if (createdAt?.toMillis) createdMs = createdAt.toMillis();
        else if (typeof createdAt === 'number') createdMs = createdAt;
        else if (typeof createdAt === 'string') createdMs = Date.parse(createdAt);
      } catch {}
      if (!createdMs || cutoff - createdMs >= 0) {
        batch.update(doc.ref, { status: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });

    await batch.commit();
  }

  private async getLatestProductDraft(userId: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
    const snapshot = await admin
      .firestore()
      .collection('line_users')
      .doc(userId)
      .collection(PRODUCT_DRAFTS_COLLECTION)
      .where('status', '==', 'awaiting_image')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  private async linkRichMenuSafe(userId: string, richMenuId: string, label: string): Promise<void> {
    if (!richMenuId || runtimeConfig.skipLineApi || runtimeConfig.useMockLine || runtimeConfig.isEmulator) {
      console.debug('[WebhookHandler] Skipping rich menu link (mock/emulator/skip):', { userId, richMenuId, label });
      return;
    }
    try {
      await this.richMenuManager.linkUserRichMenu(userId, richMenuId);
      console.debug('[WebhookHandler] Linked rich menu', { userId, richMenuId, label });
    } catch (error) {
      console.warn('[WebhookHandler] Failed to link rich menu', { userId, richMenuId, label, error });
    }
  }

  private async applyRoleRichMenu(userId: string, role: 'farmer' | 'market'): Promise<void> {
    const richMenuId = role === 'farmer' ? runtimeConfig.richMenuFarmerId : runtimeConfig.richMenuMarketId;
    if (!richMenuId) {
      console.debug('[WebhookHandler] No role-specific rich menu configured', { role });
      return;
    }
    await this.linkRichMenuSafe(userId, richMenuId, `${role}-menu`);
  }

  private getGenericProductImageUrl(name?: string, category?: string): string | undefined {
    const base = 'https://dummyimage.com/1200x800/1DB446/ffffff.jpg&text=';
    const label = (name || category || 'Farm2Market Product').slice(0, 40);
    return `${base}${encodeURIComponent(label)}`;
  }

  private getProductCategoryLabel(category?: string): string {
    switch (category) {
      case 'eggs':
        return '雞蛋';
      case 'poultry':
        return '家禽';
      case 'vegetables':
        return '蔬菜';
      case 'fruits':
        return '水果';
      case 'dairy':
        return '乳製品';
      case 'other':
        return '其他';
      case 'general':
      default:
        return '一般';
    }
  }

  private buildProductListingFlexCard(params: {
    title: string;
    role: 'farmer' | 'market';
    product: {
      name: string;
      price?: number;
      unit?: string;
      stock?: number;
      category?: string;
      tags?: string[];
    };
    imageUrl?: string;
  }): LineMessage {
    const liffUrlBase = process.env.LINE_LIFF_URL || process.env.LIFF_URL || 'https://farm2market-99.web.app';
    const listingUrl = `${liffUrlBase}?tab=products&role=${params.role}`;

    const name = params.product.name || '產品';
    const priceOk = typeof params.product.price === 'number' && Number.isFinite(params.product.price);
    const stockOk = typeof params.product.stock === 'number' && Number.isFinite(params.product.stock);
    const unit = (params.product.unit || '').trim();
    const priceText = priceOk ? `NT$${params.product.price}${unit ? `/${unit}` : ''}` : '—';
    const stockText = stockOk ? String(params.product.stock) : '—';
    const categoryText = this.getProductCategoryLabel(params.product.category);
    const tags = Array.isArray(params.product.tags) ? params.product.tags.filter(t => typeof t === 'string' && t.trim()).slice(0, 3) : [];
    const tagsText = tags.length ? tags.join('、') : '—';

    const heroUrl = params.imageUrl || this.getGenericProductImageUrl(name, params.product.category) || undefined;

    return {
      type: 'flex',
      altText: `${params.title}：${name}`,
      contents: {
        type: 'bubble',
        action: { type: 'uri', uri: listingUrl },
        hero: heroUrl
          ? {
              type: 'image',
              url: heroUrl,
              size: 'full',
              aspectRatio: '20:13',
              aspectMode: 'cover',
              action: { type: 'uri', uri: listingUrl },
            }
          : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: params.title, weight: 'bold', size: 'lg' },
            { type: 'text', text: name, margin: 'md', weight: 'bold', size: 'md', wrap: true },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '價格', color: '#6b7280', size: 'sm', flex: 2 },
                    { type: 'text', text: priceText, color: '#111827', size: 'sm', flex: 8, wrap: true },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '庫存', color: '#6b7280', size: 'sm', flex: 2 },
                    { type: 'text', text: stockText, color: '#111827', size: 'sm', flex: 8, wrap: true },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '類別', color: '#6b7280', size: 'sm', flex: 2 },
                    { type: 'text', text: categoryText, color: '#111827', size: 'sm', flex: 8, wrap: true },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '標籤', color: '#6b7280', size: 'sm', flex: 2 },
                    { type: 'text', text: tagsText, color: '#111827', size: 'sm', flex: 8, wrap: true },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: { type: 'uri', label: '前往產品列表', uri: listingUrl },
            },
          ],
        },
      },
    };
  }

  private buildMarketingMessages(productName: string, text?: string, imageUrl?: string): LineMessage[] {
    const messages: LineMessage[] = [];
    if (imageUrl) {
      messages.push({
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      } as LineMessage);
    }
    if (text) {
      messages.push({
        type: 'text',
        text: `✨ ${productName} 行銷文案\n${text}`,
      });
    }
    return messages;
  }

  private async runMarketingEnhancement(params: {
    userId: string;
    productId: string;
    productName: string;
    category?: string;
    description?: string;
    imageBuffer?: Buffer;
  }): Promise<{ text?: string; enhancedImageUrl?: string } | null> {
    if (!this.geminiClient) {
      console.warn('[WebhookHandler] Gemini client not configured; skipping marketing enhancement.');
      return null;
    }
    if (!params.imageBuffer?.length) {
      return null;
    }

    try {
      const prompt = [
        '請根據以下產品資訊，產出適合台灣市場、可直接貼到產品頁的促銷文案（繁體中文，包含吸睛標題、賣點與 CTA）。',
        `產品名稱: ${params.productName}`,
        params.category ? `品類: ${params.category}` : null,
        params.description ? `現有描述: ${params.description}` : null,
        '輸出時僅提供最終促銷文案文字，不要加入額外說明或 JSON。'
      ]
        .filter(Boolean)
        .join('\n');

      const result = await this.geminiClient.models.generateContent({
        model: this.geminiImageModelId,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: params.imageBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          systemInstruction: [
            {
              text:
                '請優化上傳的產品照片，使其符合台灣或華人市場的行銷美感，並輸出可直接貼在產品頁的繁體中文促銷文案。僅回傳文案與影像，不要附加額外說明。',
            },
          ],
        } as any,
      });

      const candidate = (result as any)?.response?.candidates?.[0] ?? (result as any)?.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      let marketingText = '';
      let inlineImage: { data: string; mimeType?: string } | null = null;

      for (const part of parts) {
        if (part?.text) {
          marketingText += part.text;
        }
        if (part?.inlineData?.data) {
          inlineImage = { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
        }
      }

      let enhancedImageUrl: string | undefined;
      if (inlineImage?.data) {
        enhancedImageUrl = await this.saveMarketingImageBuffer({
          userId: params.userId,
          productId: params.productId,
          base64Data: inlineImage.data,
          mimeType: inlineImage.mimeType,
        });
      }

      return {
        text: marketingText.trim() || undefined,
        enhancedImageUrl,
      };
    } catch (error) {
      console.error('[WebhookHandler] Gemini enhancement failed', error);
      return null;
    }
  }

  private async saveMarketingImageBuffer(params: {
    userId: string;
    productId: string;
    base64Data: string;
    mimeType?: string;
  }): Promise<string> {
    const buffer = Buffer.from(params.base64Data, 'base64');
    const mimeType = params.mimeType || 'image/png';
    const extension = (mimeType.split('/')[1] || 'png').split(';')[0];
    const filePath = `product_marketing/${params.userId}/${params.productId}/enhanced-${Date.now()}.${extension}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: { cacheControl: 'public,max-age=31536000' },
    });

    try {
      await file.makePublic();
      return file.publicUrl();
    } catch (error) {
      console.warn('[WebhookHandler] Failed to make marketing image public, using signed URL fallback', error);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '9999-12-31',
      });
      return url;
    }
  }

  private async finalizeProductDraft(
    replyToken: string,
    userId: string,
    draftId: string,
    data: Record<string, unknown>,
    imageUrl?: string,
    imageBuffer?: Buffer
  ): Promise<LineMessage[]> {
    const name = String(data?.name || '').trim();
    const price = Number(data?.price);
    const unit = String(data?.unit || '').trim();
    const stock = Number(data?.stock);
    const description = typeof data?.description === 'string' ? data.description : '';
    const category = typeof data?.category === 'string' ? data.category : 'general';
    const tags = Array.isArray(data?.tags) ? (data.tags as unknown[]).filter(t => typeof t === 'string') as string[] : [];

    const images = imageUrl ? [imageUrl] : [];
    const { id } = await DatabaseService.createProduct(userId, { name, price, stock, unit, description, category, tags, images });

    let updatedDescription = description;
    let updatedImages = [...images];

    if (imageUrl && imageBuffer) {
      const marketing = await this.runMarketingEnhancement({
        userId,
        productId: id,
        productName: name,
        category,
        description,
        imageBuffer,
      });

      if (marketing?.enhancedImageUrl) {
        updatedImages = [marketing.enhancedImageUrl, ...updatedImages.filter((url) => url !== marketing.enhancedImageUrl)];
      }
      if (marketing?.text) {
        updatedDescription = marketing.text;
      }
    }

    if (updatedDescription !== description || updatedImages.length !== images.length) {
      await DatabaseService.updateProduct(userId, id, {
        description: updatedDescription,
        images: updatedImages,
      });
    }

    await admin.firestore()
      .collection('line_users').doc(userId)
      .collection(PRODUCT_DRAFTS_COLLECTION).doc(draftId)
      .update({ status: 'completed', productId: id, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    const flex = this.buildProductListingFlexCard({
      title: '✅ 已建立產品',
      role: 'farmer',
      product: { name, price, unit, stock, category, tags },
      imageUrl: updatedImages[0] || imageUrl,
    });

    const messages = [flex];
    await this.lineBot.replyMessage(replyToken, messages);
    return messages;
  }
}

// Export for use in serverless functions or express routes
export default WebhookHandler;
