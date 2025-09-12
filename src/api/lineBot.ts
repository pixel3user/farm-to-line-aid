// LINE Bot API Integration for Farm2Market AI
// This module handles LINE Messaging API interactions

export interface LineMessage {
  type: 'text' | 'flex' | 'image' | 'template';
  text?: string;
  altText?: string;
  contents?: any;
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
export const LINE_CONFIG = {
  CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET || '',
  MESSAGING_API_URL: 'https://api.line.me/v2/bot',
  LIFF_URL: process.env.LIFF_URL || 'https://your-app.lovable.app',
};

// LINE Bot API Functions
export class LineBotAPI {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string = LINE_CONFIG.CHANNEL_ACCESS_TOKEN) {
    this.accessToken = accessToken;
    this.baseUrl = LINE_CONFIG.MESSAGING_API_URL;
  }

  // Send reply message
  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    const url = `${this.baseUrl}/message/reply`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const body = {
      replyToken,
      messages: messages.slice(0, 5), // LINE限制最多5則訊息
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`LINE API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send reply message:', error);
      throw error;
    }
  }

  // Send push message
  async pushMessage(userId: string, messages: LineMessage[]): Promise<void> {
    const url = `${this.baseUrl}/message/push`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const body = {
      to: userId,
      messages: messages.slice(0, 5),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`LINE API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send push message:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<any> {
    const url = `${this.baseUrl}/profile/${userId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`LINE API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user profile:', error);
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
        contents: {
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
        contents: {
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

// Rich Menu Configuration
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=dashboard`
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=products`
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=stores`
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=marketing`
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
        uri: `${LINE_CONFIG.LIFF_URL}?tab=analytics`
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
        type: 'text',
        text: '幫助'
      }
    }
  ]
};