// LINE Bot API Integration for Farm2Market AI
// This module handles LINE Messaging API interactions

export interface LineMessage {
  type: 'text' | 'flex' | 'image' | 'template';
  text?: string;
  altText?: string;
  contents?: any;
  template?: any;
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
    console.log(`[LineBotAPI] ${action} skipped (mock mode)`, this.sanitisePayload(payload));
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
  // Welcome message for new users
  static welcomeMessage(): LineMessage[] {
    return [
      {
        type: 'text',
        text: '🌾 歡迎使用 Farm2Market AI！\n您的智慧農業銷售助理已啟動。\n\n點選下方選單開始使用各項功能：\n📦 產品管理\n🏪 店家管理\n📱 行銷工具\n📊 數據分析'
      },
      {
        type: 'template',
        altText: 'Farm2Market AI 功能選單',
        template: {
          type: 'buttons',
          title: 'Farm2Market AI',
          text: '選擇您需要的功能',
          actions: [
            {
              type: 'uri',
              label: '📦 管理產品',
              uri: `${LINE_CONFIG.LIFF_URL}?tab=products`
            },
            {
              type: 'uri',
              label: '🏪 尋找店家',
              uri: `${LINE_CONFIG.LIFF_URL}?tab=stores`
            },
            {
              type: 'uri',
              label: '📱 行銷工具',
              uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing`
            }
          ]
        }
      }
    ];
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=edit&product=${product.name}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '建立行銷素材',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&product=${product.name}`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics`
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=dashboard`,
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=products`,
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=stores`,
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing`,
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics`,
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
        data: 'action=help',
        label: 'Help'
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
        throw new Error(`LINE API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.richMenuId;
    } catch (error) {
      console.error('Failed to create rich menu:', error);
      throw error;
    }
  }

  // Upload rich menu image
  async uploadRichMenuImage(richMenuId: string, imageBuffer: ArrayBuffer): Promise<void> {
    const url = `${this.baseUrl}/richmenu/${richMenuId}/content`;
    const headers = {
      'Content-Type': 'image/png',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: imageBuffer,
      });

      if (!response.ok) {
        throw new Error(`LINE API Error: ${response.status}`);
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
        throw new Error(`LINE API Error: ${response.status}`);
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
        throw new Error(`LINE API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete rich menu:', error);
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=add`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🏪 尋找店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=search`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 查看數據',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=create`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '✏️ 編輯產品',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=edit`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 庫存管理',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=products&action=inventory`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=search`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📍 附近店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=nearby`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '⭐ 推薦店家',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=stores&action=recommended`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=generate`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📝 文案助手',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=copywriting`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '📊 行銷分析',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing&action=analytics`
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
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=sales`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🔮 需求預測',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=forecast`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '💡 智能建議',
                uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics&action=insights`
              }
            }
          ]
        }
      }
    };
  }
}
