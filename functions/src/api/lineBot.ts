// LINE Bot API Integration for Farm2Market AI
// This module handles LINE Messaging API interactions

export interface QuickReplyItem {
  type: 'action';
  action: any;
}

export interface QuickReply {
  items: QuickReplyItem[];
}

export interface LineMessage {
  type: 'text' | 'flex' | 'image' | 'template';
  text?: string;
  altText?: string;
  contents?: any;
  template?: any;
  quickReply?: QuickReply;
  originalContentUrl?: string;
  previewImageUrl?: string;
}

export interface WebhookEvent {
  type: string;
  replyToken?: string;
  source: {
    userId: string;
    type: 'user' | 'group' | 'room';
  };
  message?: {
    type: string;
    text?: string;
    id?: string;
  };
  postback?: {
    data: string;
  };
}

export interface ProductInfo {
  name: string;
  price: number;
  unit: string;
  stock: number;
  description?: string;
  imageUrl?: string;
}

export interface StoreInfo {
  name: string;
  type: string;
  location: string;
  contact?: string;
  email?: string;
}

// LINE Bot API Configuration
import runtimeConfig from '../lib/runtimeConfig';

export const LINE_CONFIG = {
  CHANNEL_ACCESS_TOKEN: runtimeConfig.lineAccessToken || '',
  CHANNEL_SECRET: runtimeConfig.lineChannelSecret || '',
  MESSAGING_API_URL: 'https://api.line.me/v2/bot',
  MESSAGING_DATA_API_URL: 'https://api-data.line.me/v2/bot',
  LIFF_URL: runtimeConfig.liffUrl || 'https://farm2market-99.web.app',
};

// LINE Bot API Functions
export class LineBotAPI {
  private accessToken: string;
  private baseUrl: string;
  private skipLineApi: boolean;
  private static recentReplyTokens: Map<string, number> = new Map();
  private static REPLY_TOKEN_TTL_MS = 90_000; // LINE reply tokens are valid ~1 min

  constructor(accessToken: string = LINE_CONFIG.CHANNEL_ACCESS_TOKEN) {
    this.accessToken = accessToken;
    this.baseUrl = LINE_CONFIG.MESSAGING_API_URL;
    this.skipLineApi = this.shouldSkipLineApi();

    if (this.skipLineApi) {
      console.log('[LineBotAPI] SKIP_LINE_API active; LINE requests will be logged but not forwarded.');
    } else if (!this.accessToken) {
      console.warn('[LineBotAPI] Missing LINE channel access token. Replies will fail unless SKIP_LINE_API is enabled.');
    }
  }

  private shouldSkipLineApi(): boolean {
    const normalize = (value?: string) => (value || '').toLowerCase();

    if (normalize(process.env.FORCE_LINE_API) === 'true') {
      console.log('[LineBotAPI] FORCE_LINE_API override detected; LINE requests will be sent even in emulator mode.');
      return false;
    }

    if (runtimeConfig.isEmulator) {
      return true;
    }

    if (runtimeConfig.skipLineApi) {
      return true;
    }

    if (runtimeConfig.useMockLine) {
      return true;
    }

    return false;
  }

  private maskToken(token?: string): string | undefined {
    if (!token || token.length <= 10) {
      return token;
    }

    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }

  private sanitisePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

    if (typeof clone.replyToken === 'string') {
      clone.replyToken = this.maskToken(clone.replyToken);
    }

    if (typeof clone.to === 'string') {
      clone.to = this.maskToken(clone.to);
    }

    return clone;
  }

  private logSkip(action: string, payload: Record<string, unknown>): void {
    const sanitised = this.sanitisePayload(payload);
    console.log(`[LineBotAPI] ${action} skipped (mock mode)`, sanitised);
    try {
      const pretty = JSON.stringify(sanitised, null, 2);
      console.log(`[LineBotAPI] ${action} payload (pretty)\n${pretty}`);
    } catch {
      // no-op
    }
  }

  private logRequest(action: string, payload: Record<string, unknown>): void {
    console.debug(`[LineBotAPI] Sending ${action}`, this.sanitisePayload(payload));
  }

  private async logAndThrow(
    context: string,
    response: Response,
    payload: Record<string, unknown>
  ): Promise<never> {
    let responseBody = '';

    try {
      responseBody = await response.text();
    } catch (readError) {
      responseBody = `[Failed to read response body: ${(readError as Error).message}]`;
    }

    console.error(`[LineBotAPI] ${context} rejected by LINE`, {
      status: response.status,
      statusText: response.statusText,
      responseBody,
      request: this.sanitisePayload(payload),
    });

    throw new Error(`LINE API Error: ${response.status}`);
  }

  // Send reply message
  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    // basic dedupe: avoid re-sending with the same replyToken within TTL window
    const now = Date.now();
    const last = LineBotAPI.recentReplyTokens.get(replyToken);
    // clean old entries opportunistically
    for (const [token, ts] of LineBotAPI.recentReplyTokens) {
      if (now - ts > LineBotAPI.REPLY_TOKEN_TTL_MS) {
        LineBotAPI.recentReplyTokens.delete(token);
      }
    }

    if (last && now - last < LineBotAPI.REPLY_TOKEN_TTL_MS) {
      console.warn('[LineBotAPI] Duplicate replyMessage suppressed for replyToken', this.maskToken(replyToken));
      return;
    }
    LineBotAPI.recentReplyTokens.set(replyToken, now);

    if (this.skipLineApi) {
      const body = {
        replyToken,
        messages: messages.slice(0, 5),
      };
      this.logSkip('replyMessage', body);
      return;
    }
    const url = `${this.baseUrl}/message/reply`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const body = {
      replyToken,
      messages: messages.slice(0, 5),
    };

    this.logRequest('replyMessage', body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.logAndThrow('replyMessage', response, body);
      }

      console.debug('[LineBotAPI] replyMessage sent successfully', { status: response.status });

    } catch (error) {
      console.error('[LineBotAPI] Failed to send reply message:', error);
      throw error;
    }
  }

  // Send push message
  async pushMessage(userId: string, messages: LineMessage[]): Promise<void> {
    if (this.skipLineApi) {
      const body = {
        to: userId,
        messages: messages.slice(0, 5),
      };
      this.logSkip('pushMessage', body);
      return;
    }
    const url = `${this.baseUrl}/message/push`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const body = {
      to: userId,
      messages: messages.slice(0, 5),
    };

    this.logRequest('pushMessage', body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.logAndThrow('pushMessage', response, body);
      }

      console.debug('[LineBotAPI] pushMessage sent successfully', { status: response.status });
    } catch (error) {
      console.error('[LineBotAPI] Failed to send push message:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<any> {
    if (this.skipLineApi) {
      const mock = { userId, displayName: 'Emulator User', pictureUrl: '' };
      console.log('[LineBotAPI] getUserProfile skipped (mock mode)', mock);
      return mock;
    }
    const url = `${this.baseUrl}/profile/${userId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    this.logRequest('getUserProfile', { userId });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        await this.logAndThrow('getUserProfile', response, { userId });
      }

      const profile = await response.json();
      console.debug('[LineBotAPI] getUserProfile fetched', this.sanitisePayload({ userId, status: response.status }));
      return profile;
    } catch (error) {
      console.error('[LineBotAPI] Failed to get user profile:', error);
      throw error;
    }
  }

  async getMessageContent(messageId: string): Promise<Buffer> {
    if (this.skipLineApi) {
      console.log('[LineBotAPI] getMessageContent skipped (mock mode)', { messageId });
      return Buffer.alloc(0);
    }

    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        await this.logAndThrow('getMessageContent', response, { messageId });
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('[LineBotAPI] Failed to get message content:', error);
      throw error;
    }
  }
}

// Message Templates for Farm2Market AI
export class MessageTemplates {
  private static isCJK(text: string): boolean {
    return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
  }

  // Personalized, conversational welcome for new users
  static welcomeMessagePersonalized(displayName?: string): LineMessage[] {
    let name = '';
    if (displayName && displayName.trim()) {
      name = this.isCJK(displayName) ? `${displayName.trim()}，` : `${displayName.trim()}, `;
    }
    const text: LineMessage = {
      type: 'text',
      text: `🌾 ${name}歡迎使用 Farm2Market AI！\n我是您的 LINE 助理，會盡量在這裡完成事情，不需要跳去網站。\n\n先告訴我：您是「賣家/農友」還是「市場/買家」？`
    };

    const overview: LineMessage = {
      type: 'flex',
      altText: 'Farm2Market AI 介紹與快速操作',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '🚀 功能導覽', weight: 'bold', color: '#ffffff', size: 'lg' }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '賣家/農友：', weight: 'bold' },
            { type: 'text', text: '• 建立/管理產品、庫存與價格' },
            { type: 'text', text: '• 生成行銷海報與文案' },
            { type: 'text', text: '• 設定補貨提醒與客戶追蹤' },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: '市場/買家/市場主：', weight: 'bold' },
            { type: 'text', text: '• 瀏覽供應、建立採購清單' },
            { type: 'text', text: '• 與賣家對接、管理店家名單' },
            { type: 'text', text: '• 查看即時統計與最佳行動' }
          ]
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
              action: { type: 'postback', label: '我是賣家/農友', data: 'action=set_role&role=farmer' }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: { type: 'postback', label: '我是市場/買家', data: 'action=set_role&role=market' }
            }
          ]
        }
      }
    };

    const quickReply: LineMessage = {
      type: 'text',
      text: '您也可以直接告訴我想做什麼，例如「新增雞蛋 120/斤、20 箱」。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📦 管理產品', text: '我要管理產品' } },
          { type: 'action', action: { type: 'message', label: '🏪 拓展店家', text: '協助拓展店家' } },
          { type: 'action', action: { type: 'message', label: '📱 行銷素材', text: '我要行銷建議' } },
          { type: 'action', action: { type: 'message', label: '📊 看統計', text: '查看營運分析' } }
        ]
      }
    };

    return [text, overview, quickReply];
  }

  static roleNextSteps(role: 'farmer' | 'market'): LineMessage[] {
    const header = {
      type: 'box',
      layout: 'vertical',
      contents: [ { type: 'text', text: '🧭 下一步建議', weight: 'bold', color: '#ffffff' } ],
      backgroundColor: '#1DB446'
    };

    const bodyFarmer = [
      { type: 'text', text: '適用於賣家/農友：', weight: 'bold' },
      { type: 'text', text: '• 新增/管理產品與價格' },
      { type: 'text', text: '• 盤點庫存、設定補貨提醒' },
      { type: 'text', text: '• 生成行銷海報與文案' },
      { type: 'text', text: '• 拓展店家、發送專業自我介紹' },
    ];

    const bodyMarket = [
      { type: 'text', text: '適用於市場/買家：', weight: 'bold' },
      { type: 'text', text: '• 搜尋供應與比價' },
      { type: 'text', text: '• 建立採購清單/需求' },
      { type: 'text', text: '• 管理供應商名單與聯絡' },
      { type: 'text', text: '• 查看即時統計與提醒' },
    ];

    const flex: LineMessage = {
      type: 'flex',
      altText: '下一步建議',
      contents: {
        type: 'bubble',
        header,
        body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: role === 'farmer' ? bodyFarmer : bodyMarket },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: role === 'farmer'
            ? [
                { type: 'button', style: 'primary', height: 'sm', action: { type: 'message', label: '➕ 新增產品', text: '我要新增產品' } },
                { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '🔍 尋找附近店家', uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&role=farmer` } },
                { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: '📱 行銷素材', text: '我要行銷建議' } },
              ]
            : [
                { type: 'button', style: 'primary', height: 'sm', action: { type: 'message', label: '🔍 找供應', text: '我要找供應' } },
                { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: '🧾 建立採購', text: '建立採購需求' } },
                { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: '📊 看統計', text: '查看營運分析' } },
              ]
        }
      }
    };

    const qrText: LineMessage = {
      type: 'text',
      text: role === 'farmer'
        ? '告訴我要先做哪件事：例如「新增雞蛋 120/斤 20 箱」。'
        : '告訴我您要找什麼：例如「我要找雞蛋供應，先看附近」。',
      quickReply: {
        items: role === 'farmer'
          ? [
              { type: 'action', action: { type: 'message', label: '新增產品', text: '我要新增產品' } },
              { type: 'action', action: { type: 'message', label: '管理產品', text: '我要管理產品' } },
              { type: 'action', action: { type: 'message', label: '拓展店家', text: '協助拓展店家' } },
              { type: 'action', action: { type: 'message', label: '行銷素材', text: '我要行銷建議' } },
            ]
          : [
              { type: 'action', action: { type: 'message', label: '找供應', text: '我要找供應' } },
              { type: 'action', action: { type: 'message', label: '建立採購', text: '建立採購需求' } },
              { type: 'action', action: { type: 'message', label: '管理供應商', text: '管理店家' } },
              { type: 'action', action: { type: 'message', label: '看統計', text: '查看營運分析' } },
            ]
      }
    };

    return [flex, qrText];
  }

  // Product card template
  static productCard(product: ProductInfo): LineMessage {
    return {
      type: 'flex',
      altText: `${product.name} - ${product.price}${product.unit}`,
      contents: {
        type: 'bubble',
        hero: product.imageUrl ? {
          type: 'image',
          url: product.imageUrl,
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover'
        } : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: product.name,
              weight: 'bold',
              size: 'xl'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: '價格',
                      color: '#aaaaaa',
                      size: 'sm',
                      flex: 1
                    },
                    {
                      type: 'text',
                      text: `NT$${product.price} ${product.unit}`,
                      wrap: true,
                      color: '#666666',
                      size: 'sm',
                      flex: 5
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: '庫存',
                      color: '#aaaaaa',
                      size: 'sm',
                      flex: 1
                    },
                    {
                      type: 'text',
                      text: `${product.stock} 箱`,
                      wrap: true,
                      color: '#666666',
                      size: 'sm',
                      flex: 5
                    }
                  ]
                }
              ]
            }
          ]
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
              action: {
                type: 'uri',
                label: '編輯產品',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=edit&product=${product.name}&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '建立行銷素材',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&product=${product.name}&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Store suggestion template
  static storeSuggestion(store: StoreInfo): LineMessage {
    return {
      type: 'flex',
      altText: `推薦店家: ${store.name}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🏪 發現新商機',
              weight: 'bold',
              color: '#1DB446',
              size: 'sm'
            },
            {
              type: 'text',
              text: store.name,
              weight: 'bold',
              size: 'xl',
              margin: 'md'
            },
            {
              type: 'text',
              text: store.type,
              size: 'sm',
              color: '#999999',
              margin: 'md'
            },
            {
              type: 'text',
              text: store.location,
              size: 'sm',
              color: '#666666',
              margin: 'md'
            }
          ]
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
              action: {
                type: 'postback',
                label: '發送自我介紹',
                data: `action=send_intro&store=${store.name}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '查看更多店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Reorder reminder template
  static reorderReminder(storeName: string, productName: string): LineMessage[] {
    return [
      {
        type: 'text',
        text: `🔔 補貨提醒\n\n${storeName} 通常在這個時候會訂購 ${productName}。\n\n要發送友善的補貨提醒嗎？`
      },
      {
        type: 'template',
        altText: '補貨提醒選項',
        template: {
          type: 'confirm',
          text: `發送補貨提醒給 ${storeName}？`,
          actions: [
            {
              type: 'postback',
              label: '立即發送',
              data: `action=send_reorder_reminder&store=${storeName}&product=${productName}`
            },
            {
              type: 'postback',
              label: '稍後提醒',
              data: `action=snooze_reminder&store=${storeName}`
            }
          ]
        }
      }
    ];
  }

  // Daily summary template
  static dailySummary(data: {
    orders: number;
    revenue: number;
    newLeads: number;
    pendingTasks: number;
  }): LineMessage {
    return {
      type: 'flex',
      altText: '今日業務摘要',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📊 今日業務摘要',
              weight: 'bold',
              color: '#ffffff',
              size: 'md'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📦',
                  flex: 1
                },
                {
                  type: 'text',
                  text: '新訂單',
                  flex: 3
                },
                {
                  type: 'text',
                  text: `${data.orders}`,
                  flex: 1,
                  align: 'end',
                  weight: 'bold'
                }
              ]
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: '💰',
                  flex: 1
                },
                {
                  type: 'text',
                  text: '今日營收',
                  flex: 3
                },
                {
                  type: 'text',
                  text: `NT$${data.revenue.toLocaleString()}`,
                  flex: 1,
                  align: 'end',
                  weight: 'bold'
                }
              ]
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: '🎯',
                  flex: 1
                },
                {
                  type: 'text',
                  text: '新潛在客戶',
                  flex: 3
                },
                {
                  type: 'text',
                  text: `${data.newLeads}`,
                  flex: 1,
                  align: 'end',
                  weight: 'bold'
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '查看完整報告',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&role=farmer`
              }
            }
          ]
        }
      }
    };
  }
}

// Enhanced Rich Menu Configuration
export const RICH_MENU_CONFIG = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: false,
  name: 'Farm2Market AI Menu',
  chatBarText: 'Farm2Market AI',
  areas: [
    {
      bounds: {
        x: 0,
        y: 0,
        width: 833,
        height: 843
      },
      action: {
        type: 'uri',
        uri: `${LINE_CONFIG.LIFF_URL}?tab=dashboard&role=farmer`,
        label: 'Dashboard'
      }
    },
    {
      bounds: {
        x: 833,
        y: 0,
        width: 834,
        height: 843
      },
      action: {
        type: 'uri',
        uri: `${LINE_CONFIG.LIFF_URL}?tab=products&role=farmer`,
        label: 'Products'
      }
    },
    {
      bounds: {
        x: 1667,
        y: 0,
        width: 833,
        height: 843
      },
      action: {
        type: 'uri',
        uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&role=farmer`,
        label: 'Stores'
      }
    },
    {
      bounds: {
        x: 0,
        y: 843,
        width: 833,
        height: 843
      },
      action: {
        type: 'uri',
        uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&role=farmer`,
        label: 'Marketing'
      }
    },
    {
      bounds: {
        x: 833,
        y: 843,
        width: 834,
        height: 843
      },
      action: {
        type: 'uri',
        uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&role=farmer`,
        label: 'Analytics'
      }
    },
    {
      bounds: {
        x: 1667,
        y: 843,
        width: 833,
        height: 843
      },
      action: {
        type: 'postback',
        data: 'source=richmenu&action=help',
        label: 'Help',
        displayText: '🆘 Help'
      }
    }
  ]
};

// Rich Menu Management Functions
export class RichMenuManager {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string = LINE_CONFIG.CHANNEL_ACCESS_TOKEN) {
    this.accessToken = accessToken;
    this.baseUrl = LINE_CONFIG.MESSAGING_API_URL;
  }

  // Create rich menu
  async createRichMenu(richMenuConfig: any): Promise<string> {
    const url = `${this.baseUrl}/richmenu`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(richMenuConfig),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }

      const result = await response.json();
      return result.richMenuId;
    } catch (error) {
      console.error('Failed to create rich menu:', error);
      throw error;
    }
  }

  // Upload rich menu image
  async uploadRichMenuImage(
    richMenuId: string,
    imageBuffer: ArrayBuffer | Buffer,
    contentType: string = 'image/png'
  ): Promise<void> {
    // Image uploads must go to api-data.line.me per LINE docs
    const url = `${LINE_CONFIG.MESSAGING_DATA_API_URL}/richmenu/${richMenuId}/content`;
    const headers = {
      'Content-Type': contentType,
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const uploadBody =
        imageBuffer instanceof Buffer
          ? imageBuffer
          : Buffer.from(new Uint8Array(imageBuffer as ArrayBuffer));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        // Node's fetch requires a Buffer or TypedArray; normalize here
        body: uploadBody as any,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }
    } catch (error) {
      console.error('Failed to upload rich menu image:', error);
      throw error;
    }
  }

  // Set default rich menu
  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    const url = `${this.baseUrl}/user/all/richmenu/${richMenuId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }
    } catch (error) {
      console.error('Failed to set default rich menu:', error);
      throw error;
    }
  }

  // Delete rich menu
  async deleteRichMenu(richMenuId: string): Promise<void> {
    const url = `${this.baseUrl}/richmenu/${richMenuId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }
    } catch (error) {
      console.error('Failed to delete rich menu:', error);
      throw error;
    }
  }

  // Link a rich menu to a specific user
  async linkUserRichMenu(userId: string, richMenuId: string): Promise<void> {
    const url = `${this.baseUrl}/user/${userId}/richmenu/${richMenuId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }
    } catch (error) {
      console.error('Failed to link user to rich menu:', error);
      throw error;
    }
  }

  // Unlink rich menu from a user (back to default)
  async unlinkUserRichMenu(userId: string): Promise<void> {
    const url = `${this.baseUrl}/user/${userId}/richmenu`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LINE API Error: ${response.status} ${response.statusText} ${body || ''}`.trim());
      }
    } catch (error) {
      console.error('Failed to unlink user rich menu:', error);
      throw error;
    }
  }
}

// Enhanced Message Templates with LIFF Integration
export class EnhancedMessageTemplates {
  // Quick action template for farmers
  static quickActions(): LineMessage {
    return {
      type: 'flex',
      altText: '快速操作選單',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🚀 快速操作',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📦 新增產品',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=add&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🏪 尋找店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=search&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 查看數據',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Product form template with LIFF integration
  static productFormTemplate(): LineMessage {
    return {
      type: 'flex',
      altText: '產品管理表單',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📦 產品管理',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '選擇您要進行的操作：',
              size: 'md',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '➕ 新增產品',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=create&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '✏️ 編輯產品',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=edit&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 庫存管理',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=inventory&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Store discovery template
  static storeDiscoveryTemplate(): LineMessage {
    return {
      type: 'flex',
      altText: '店家探索',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🏪 店家探索',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '發現新的合作機會：',
              size: 'md',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🔍 搜尋店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=search&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📍 附近店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=nearby&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '⭐ 推薦店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=recommended&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Marketing tools template
  static marketingToolsTemplate(): LineMessage {
    return {
      type: 'flex',
      altText: '行銷工具',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📱 行銷工具',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'AI 驅動的行銷解決方案：',
              size: 'md',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🎨 生成海報',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=generate&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📝 文案助手',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=copywriting&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 行銷分析',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=analytics&role=farmer`
              }
            }
          ]
        }
      }
    };
  }

  // Analytics dashboard template
  static analyticsTemplate(): LineMessage {
    return {
      type: 'flex',
      altText: '數據分析',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📊 數據分析',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            }
          ],
          backgroundColor: '#1DB446'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '深入了解您的業務表現：',
              size: 'md',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📈 銷售報告',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=sales&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🔮 需求預測',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=forecast&role=farmer`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '💡 智能建議',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=insights&role=farmer`
              }
            }
          ]
        }
      }
    };
  }
}
