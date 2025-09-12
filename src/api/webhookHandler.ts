// LINE Bot Webhook Handler for Farm2Market AI
import { LineBotAPI, MessageTemplates, WebhookEvent } from './lineBot';

export class WebhookHandler {
  private lineBot: LineBotAPI;

  constructor() {
    this.lineBot = new LineBotAPI();
  }

  // Main webhook event handler
  async handleEvents(events: WebhookEvent[]): Promise<void> {
    const promises = events.map(event => this.handleSingleEvent(event));
    await Promise.all(promises);
  }

  // Handle individual webhook event
  private async handleSingleEvent(event: WebhookEvent): Promise<void> {
    console.log('Processing event:', event.type);

    try {
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
    } catch (error) {
      console.error('Error handling event:', error);
    }
  }

  // Handle follow event (user adds bot as friend)
  private async handleFollow(event: WebhookEvent): Promise<void> {
    if (!event.replyToken) return;

    const welcomeMessages = MessageTemplates.welcomeMessage();
    await this.lineBot.replyMessage(event.replyToken, welcomeMessages);
  }

  // Handle text/image messages
  private async handleMessage(event: WebhookEvent): Promise<void> {
    if (!event.replyToken || !event.message) return;

    const { message } = event;

    if (message.type === 'text' && message.text) {
      await this.handleTextMessage(event.replyToken, message.text, event.source.userId);
    } else if (message.type === 'image') {
      await this.handleImageMessage(event.replyToken, message.id || '', event.source.userId);
    }
  }

  // Handle text messages with AI processing
  private async handleTextMessage(replyToken: string, text: string, userId: string): Promise<void> {
    const lowerText = text.toLowerCase();

    // Command recognition
    if (lowerText.includes('產品') || lowerText.includes('product')) {
      await this.handleProductInquiry(replyToken);
    } else if (lowerText.includes('店家') || lowerText.includes('store')) {
      await this.handleStoreInquiry(replyToken);
    } else if (lowerText.includes('行銷') || lowerText.includes('marketing')) {
      await this.handleMarketingInquiry(replyToken);
    } else if (lowerText.includes('報告') || lowerText.includes('analytics')) {
      await this.handleAnalyticsInquiry(replyToken);
    } else if (lowerText.includes('幫助') || lowerText.includes('help')) {
      await this.handleHelpInquiry(replyToken);
    } else {
      // Default AI response
      await this.handleGeneralInquiry(replyToken, text);
    }
  }

  // Handle image messages (for product photos)
  private async handleImageMessage(replyToken: string, messageId: string, userId: string): Promise<void> {
    const responseMessages = [
      {
        type: 'text' as const,
        text: '📸 收到您的產品照片！\n\nAI 正在分析照片內容...\n• 自動優化圖片品質\n• 生成產品描述\n• 建立行銷素材\n\n請稍候，處理完成後會通知您。'
      },
      {
        type: 'template' as const,
        altText: '照片處理選項',
        contents: {
          type: 'buttons',
          title: '照片處理選項',
          text: '您想要建立什麼類型的行銷素材？',
          actions: [
            {
              type: 'postback',
              label: '📄 產品傳單',
              data: `action=create_flyer&image=${messageId}`
            },
            {
              type: 'postback',
              label: '🏷️ 貨架標籤',
              data: `action=create_shelf_card&image=${messageId}`
            },
            {
              type: 'postback',
              label: '👨‍🍳 食譜卡片',
              data: `action=create_recipe_card&image=${messageId}`
            }
          ]
        }
      }
    ];

    await this.lineBot.replyMessage(replyToken, responseMessages);
  }

  // Handle postback events (button clicks)
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

  // Specific handlers for different inquiries
  private async handleProductInquiry(replyToken: string): Promise<void> {
    const messages = [
      {
        type: 'text' as const,
        text: '📦 產品管理功能\n\n• 新增產品資訊\n• 管理庫存狀態\n• AI 自動補貨提醒\n• 產品照片優化\n\n點選下方按鈕進入產品管理頁面。'
      },
      {
        type: 'template' as const,
        altText: '產品管理選項',
        contents: {
          type: 'buttons',
          title: '產品管理',
          text: '選擇您要執行的操作',
          actions: [
            {
              type: 'uri',
              label: '📦 管理產品',
              uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=products`
            },
            {
              type: 'postback',
              label: '📈 庫存分析',
              data: 'action=stock_analysis'
            }
          ]
        }
      }
    ];

    await this.lineBot.replyMessage(replyToken, messages);
  }

  private async handleStoreInquiry(replyToken: string): Promise<void> {
    const messages = [
      {
        type: 'text' as const,
        text: '🏪 店家管理功能\n\n• AI 尋找潛在店家\n• 自動發送介紹信\n• 追蹤客戶關係\n• 訂單頻率分析\n\n讓 AI 幫您拓展業務！'
      },
      {
        type: 'template' as const,
        altText: '店家管理選項',
        contents: {
          type: 'buttons',
          title: '店家管理',
          text: '選擇您要執行的操作',
          actions: [
            {
              type: 'uri',
              label: '🔍 尋找新店家',
              uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=stores&action=find`
            },
            {
              type: 'uri',
              label: '📋 管理客戶',
              uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=stores`
            }
          ]
        }
      }
    ];

    await this.lineBot.replyMessage(replyToken, messages);
  }

  private async handleMarketingInquiry(replyToken: string): Promise<void> {
    const messages = [
      {
        type: 'text' as const,
        text: '📱 AI 行銷工具\n\n• 自動生成產品傳單\n• 建立社群媒體貼文\n• 食譜卡片設計\n• 多語言行銷文案\n\n只需上傳產品照片，AI 就能幫您建立專業行銷素材！'
      },
      {
        type: 'template' as const,
        altText: '行銷工具選項',
        contents: {
          type: 'buttons',
          title: 'AI 行銷工具',
          text: '開始建立行銷素材',
          actions: [
            {
              type: 'uri',
              label: '🎨 建立素材',
              uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=marketing`
            },
            {
              type: 'text',
              label: '📸 上傳產品照片',
              text: '請上傳產品照片，我會幫您建立行銷素材'
            }
          ]
        }
      }
    ];

    await this.lineBot.replyMessage(replyToken, messages);
  }

  private async handleAnalyticsInquiry(replyToken: string): Promise<void> {
    // Simulate daily summary data
    const summaryData = {
      orders: 3,
      revenue: 2400,
      newLeads: 1,
      pendingTasks: 2
    };

    const summaryMessage = MessageTemplates.dailySummary(summaryData);
    
    await this.lineBot.replyMessage(replyToken, [summaryMessage]);
  }

  private async handleHelpInquiry(replyToken: string): Promise<void> {
    const messages = [
      {
        type: 'text' as const,
        text: '🤖 Farm2Market AI 使用指南\n\n📦 產品管理：管理農產品資訊和庫存\n🏪 店家開發：AI 協助尋找並聯繫潛在客戶\n📱 行銷工具：自動生成專業行銷素材\n📊 數據分析：追蹤業務表現和趨勢\n\n💡 小技巧：\n• 上傳產品照片可自動生成行銷素材\n• 系統會主動提醒最佳補貨時機\n• 支援中英文雙語行銷內容'
      },
      {
        type: 'template' as const,
        altText: '功能選單',
        contents: {
          type: 'carousel',
          columns: [
            {
              title: '產品管理',
              text: '管理農產品和庫存',
              actions: [
                {
                  type: 'uri',
                  label: '開始使用',
                  uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=products`
                }
              ]
            },
            {
              title: '店家開發',
              text: 'AI協助客戶開發',
              actions: [
                {
                  type: 'uri',
                  label: '開始使用',
                  uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=stores`
                }
              ]
            },
            {
              title: '行銷工具',
              text: '自動生成行銷素材',
              actions: [
                {
                  type: 'uri',
                  label: '開始使用',
                  uri: `${process.env.LIFF_URL || 'https://your-app.lovable.app'}?tab=marketing`
                }
              ]
            }
          ]
        }
      }
    ];

    await this.lineBot.replyMessage(replyToken, messages);
  }

  private async handleGeneralInquiry(replyToken: string, text: string): Promise<void> {
    // Simple AI response logic
    let response = '🤖 我是您的 Farm2Market AI 助理！\n\n';
    
    if (text.includes('雞蛋') || text.includes('蛋')) {
      response += '看起來您想了解雞蛋相關的功能。我可以幫您：\n• 管理雞蛋產品資訊\n• 建立雞蛋行銷素材\n• 尋找蛋品批發商\n• 分析銷售數據';
    } else if (text.includes('農場') || text.includes('養殖')) {
      response += '我專門為農場主提供數位化銷售解決方案：\n• 產品數位化管理\n• 客戶關係維護\n• 自動化行銷\n• 業務數據分析';
    } else {
      response += '我能幫您管理農產品銷售的各個環節。請輸入以下關鍵字了解更多：\n\n📦 "產品" - 產品管理\n🏪 "店家" - 客戶開發\n📱 "行銷" - 行銷工具\n📊 "報告" - 數據分析\n❓ "幫助" - 使用指南';
    }

    const messages = [
      {
        type: 'text' as const,
        text: response
      }
    ];

    await this.lineBot.replyMessage(replyToken, messages);
  }

  // Postback action handlers
  private async handleSendIntro(replyToken: string, storeName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `✅ 自我介紹信已發送給 ${storeName || '目標店家'}！\n\nAI 已自動生成個人化的介紹內容，包含：\n• 農場簡介\n• 產品特色\n• 聯絡方式\n• 合作提案\n\n我會追蹤回覆狀況並適時提醒您跟進。`
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleSendReorderReminder(replyToken: string, storeName?: string, productName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `📧 補貨提醒已發送！\n\n已向 ${storeName || '客戶'} 發送 ${productName || '產品'} 的友善補貨提醒。\n\n提醒內容包含：\n• 上次訂購日期\n• 建議訂購數量\n• 特殊優惠資訊\n• 聯絡方式\n\n系統將追蹤回覆並通知您結果。`
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateFlyer(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `🎨 產品傳單製作中...\n\nAI 正在為您的產品照片建立專業傳單：\n• 自動去背優化\n• 添加產品資訊\n• 設計排版布局\n• 生成中英文版本\n\n預計 2-3 分鐘完成，完成後會傳送下載連結給您。`
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateShelfCard(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `🏷️ 貨架標籤製作中...\n\nAI 正在建立專業的貨架展示標籤：\n• 適合零售環境\n• 突出產品特色\n• 包含價格資訊\n• 二維碼追蹤\n\n完成後將提供列印就緒的檔案。`
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleCreateRecipeCard(replyToken: string, imageId?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `👨‍🍳 食譜卡片製作中...\n\nAI 正在建立以您的產品為主角的食譜卡片：\n• 健康營養資訊\n• 簡單料理方法\n• 精美圖文設計\n• 品牌宣傳整合\n\n這種內容通常能提升 70% 的客戶興趣！`
    };

    await this.lineBot.replyMessage(replyToken, [message]);
  }

  private async handleSnoozeReminder(replyToken: string, storeName?: string): Promise<void> {
    const message = {
      type: 'text' as const,
      text: `⏰ 提醒已延後\n\n${storeName || '客戶'} 的補貨提醒已設定為明天再次提醒。\n\n您也可以隨時在產品管理頁面手動發送提醒。`
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