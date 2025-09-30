// Gemini API Integration Service
import { GoogleGenerativeAI, type GenerateContentResponse } from '@google/generative-ai';

// Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GENAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Model configurations
const MODELS = {
  TEXT: 'gemini-2.5-flash',
  IMAGE: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro'
};

// Response types
export interface GeminiTextResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GeminiImageAnalysis {
  description: string;
  healthStatus: string;
  marketSuggestions: string[];
  pricingEstimate: string;
  marketingCopy: string;
  improvements: string;
}

export interface ProductAnalysis {
  name: string;
  category: string;
  description: string;
  marketingCopy: string;
  suggestedPrice: number;
  nutritionalInfo?: string;
  sellingPoints: string[];
}

export interface StoreAnalysis {
  prospects: string[];
  outreachTemplate: string;
  relationshipStage: string;
  nextActions: string[];
}

// Main Gemini Service Class
export class Geminiservice {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(modelType: 'flash' | 'pro' = 'flash') {
    this.client = GENAI;
    this.model = modelType === 'pro' ? MODELS.PRO : MODELS.TEXT;
  }

  // Text generation with Gemini
  async generateText(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
    safetySettings?: any;
  }): Promise<GeminiTextResponse> {
    try {
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 1024,
        },
        safetySettings: options?.safetySettings || [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No response generated from Gemini');
      }

      return {
        text,
        usage: result.usageMetadata ? {
          promptTokens: result.usageMetadata.promptTokenCount || 0,
          completionTokens: result.usageMetadata.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata.totalTokenCount || 0
        } : undefined
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini API failed: ${error}`);
    }
  }

  // Image analysis for farm products
  async analyzeProductImage(imageData: string, context?: string): Promise<GeminiImageAnalysis> {
    const prompt = `
    請分析這張農業產品照片，並提供以下資訊：

    1. 產品描述：詳細描述照片中的產品（顏色、形狀、大小、品質等）
    2. 健康狀況：評估產品的新鮮度和品質
    3. 市場建議：建議適合的銷售管道（超市、農民市場、餐廳等）
    4. 價格估計：根據品相建議合適的價格範圍
    5. 行銷文案：生成吸引人的產品描述，適合網路銷售
    6. 改進建議：如何提升產品價值或包裝

    圖片資訊：${imageData}
    額外資訊：${context || '無'}

    請以 JSON 格式回傳，包含以上所有欄位。
    `;

    const response = await this.generateText(prompt, { temperature: 0.3 });
    
    try {
      const analysis = JSON.parse(response.text);
      return {
        description: analysis.產品描述 || '',
        healthStatus: analysis.健康狀況 || '',
        marketSuggestions: analysis.市場建議 || [],
        pricingEstimate: analysis.價格估計 || '',
        marketingCopy: analysis.行銷文案 || '',
        improvements: analysis.改進建議 || ''
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        description: response.text.substring(0, 200) + '...',
        healthStatus: '需要人工評估',
        marketSuggestions: ['一般零售'],
        pricingEstimate: '請參考市場行情',
        marketingCopy: response.text,
        improvements: '建議諮詢專業人員'
      };
    }
  }

  // Generate product information
  async generateProductInfo(productName: string, category: string, image?: string): Promise<ProductAnalysis> {
    let prompt = `
    為以下農業產品生成詳細資訊：

    產品名稱：${productName}
    產品類別：${category}
    ${image ? `產品圖片描述：${image}` : ''}

    請提供：
    1. 產品名稱（優化後）
    2. 產品類別
    3. 產品描述（100-150字）
    4. 行銷文案（適合社群媒體）
    5. 建議售價（台幣）
    6. 營養資訊（如適用）
    7. 賣點（3-5個）

    請以繁體中文回傳，並以 JSON 格式提供結構化資料。
    `;

    const response = await this.generateText(prompt, { temperature: 0.5 });
    
    try {
      const analysis = JSON.parse(response.text);
      return {
        name: analysis.產品名稱 || productName,
        category: analysis.產品類別 || category,
        description: analysis.產品描述 || '',
        marketingCopy: analysis.行銷文案 || '',
        suggestedPrice: analysis.建議售價 || 0,
        nutritionalInfo: analysis.營養資訊,
        sellingPoints: analysis.賣點 || []
      };
    } catch {
      return {
        name: productName,
        category,
        description: response.text.substring(0, 150),
        marketingCopy: response.text,
        suggestedPrice: 0,
        sellingPoints: []
      };
    }
  }

  // Generate marketing materials
  async generateMarketingMaterial(type: 'flyer' | 'shelf_card' | 'recipe_card' | 'social_media', 
    productInfo: ProductAnalysis, tone: 'professional' | 'friendly' | 'casual' = 'professional'): Promise<string> {
    
    const prompts = {
      flyer: `
        請為「${productInfo.name}」製作產品傳單內容：

        產品描述：${productInfo.description}
        賣點：${productInfo.sellingPoints.join(', ')}
        售價：NT$${productInfo.suggestedPrice}

        要求：
        - 吸引人注意力的標題
        - 簡潔的產品特色說明
        - 清楚的價格資訊
        - 呼籲行動
        - 語調：${tone}

        請以繁體中文回傳完整傳單文案。
      `,
      
      shelf_card: `
        請為「${productInfo.name}」製作貨架標籤：

        產品資訊：${productInfo.description}
        營養資訊：${productInfo.nutritionalInfo || ''}
        特色：${productInfo.sellingPoints.join(', ')}

        要求：
        - 簡潔有力的標題
        - 關鍵賣點
        - 適合零售環境
        - 易於閱讀的格式

        請提供貨架標籤文字內容。
      `,
      
      recipe_card: `
        請以「${productInfo.name}」設計創意食譜卡片：

        產品：${productInfo.name}
        特色：${productInfo.sellingPoints.join(', ')}

        要求：
        - 有創意的料理概念
        - 簡單易做的步驟
        - 突顯產品特色
        - 營養價值說明
        - 視覺吸引力

        請提供食譜內容（2-3道簡易料理）。
      `,
      
      social_media: `
        請為「${productInfo.name}」創作社群媒體貼文：

        產品：${productInfo.name}
        描述：${productInfo.description}
        賣點：${productInfo.sellingPoints.join(', ')}

        要求：
        - 適合 Facebook/Instagram
        - 包含相關 hashtags
        - 吸引人互動
        - 語調：${tone}
        - 長度適中

        請提供社群媒體貼文內容。
      `
    };

    const prompt = prompts[type];
    const response = await this.generateText(prompt, { temperature: 0.7 });
    
    return response.text;
  }

  // Store research and outreach
  async analyzeStoreOpportunities(productCategories: string[], region: string): Promise<StoreAnalysis> {
    const prompt = `
    請為以下農業產品類別分析潛在客戶和行銷機會：

    產品類別：${productCategories.join(', ')}
    地區：${region}

    請提供：
    1. 潛在客戶名單（餐廳、超市、農民市場等）
    2. 開發信範本
    3. 客戶關係階段建議
    4. 下一步行動計劃

    專注於台灣市場，請以繁體中文回傳，並以 JSON 格式提供結構化資料。
    `;

    const response = await this.generateText(prompt, { temperature: 0.6 });
    
    try {
      const analysis = JSON.parse(response.text);
      return {
        prospects: analysis.潛在客戶名單 || [],
        outreachTemplate: analysis.開發信範本 || '',
        relationshipStage: analysis.客戶關係階段建議 || '',
        nextActions: analysis.下一步行動計劃 || []
      };
    } catch {
      return {
        prospects: [],
        outreachTemplate: response.text,
        relationshipStage: '初次接觸',
        nextActions: ['發送介紹信']
      };
    }
  }

  // Chat conversation with context
  async handleConversation(message: string, context: {
    userProducts?: ProductAnalysis[];
    userStores?: any[];
    conversationHistory?: string[];
  }): Promise<string> {
    const contextInfo = this.buildConversationContext(context);
    
    const prompt = `
    你是一個農產品銷售AI助理，專門幫助農場主管理產品、開發客戶、製作行銷素材。

    用戶背景：
    ${contextInfo}

    用戶訊息：${message}

    請提供有用且個人化的建議。回答應該：
    1. 親切友善
    2. 實用具體
    3. 鼓勵用戶採取行動
    4. 提供專業建議

    請以繁體中文回應。
    `;

    const response = await this.generateText(prompt, { 
      temperature: 0.7,
      maxTokens: 512 
    });
    
    return response.text;
  }

  // Generate structured output for forms
  async generateStructuredOutput<T>(prompt: string, schema: any): Promise<T> {
    const structuredPrompt = `
    ${prompt}

    請按照以下JSON結構回傳資料：
    ${JSON.stringify(schema, null, 2)}

    只回傳JSON格式，不要包含其他文字。
    `;

    try {
      const response = await this.generateText(structuredPrompt, { 
        temperature: 0.3,
        maxTokens: 512 
      });
      
      return JSON.parse(response.text);
    } catch (error) {
      console.error('Structured output generation failed:', error);
      throw error;
    }
  }

  // Batch processing for multiple requests
  async batchGenerate(requests: Array<{
    prompt: string;
    options?: any;
  }>): Promise<GeminiTextResponse[]> {
    const promises = requests.map(req => 
      this.generateText(req.prompt, req.options)
    );

    try {
      return await Promise.all(promises);
    } catch (error) {
      console.error('Batch generation failed:', error);
      throw error;
    }
  }

  // Image generation (using Gemini Flash Image model)
  async generateImage(prompt: string, options?: {
    aspectRatio?: '1:flutter 1:1' | '16:flutter 9:16';
    style?: 'creative' | 'minimal' | 'flat_art' | 'oil_painting';
  }): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: {
          temperature: 0.8,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ],
          imageConfig: {
            aspectRatio: options?.aspectRatio || '1:1',
            style: options?.style || 'creative'
          }
        }
      });

      return response.text || '';
    } catch (error) {
      console.error('Image generation failed:', error);
      throw new Error(`Image generation failed: ${error}`);
    }
  }

  // Helper methods
  private buildConversationContext(context: any): string {
    let contextInfo = '';
    
    if (context.userProducts?.length > 0) {
      contextInfo += `用戶的產品：${context.userProducts.map((p: ProductAnalysis) => p.name).join(', ')}\n`;
    }
    
    if (context.userStores?.length > 0) {
      contextInfo += `合作的店家：${context.userStores.length}家\n`;
    }
    
    if (context.conversationHistory?.length > 0) {
      contextInfo += `最近的對話主題：${context.conversationHistory.slice(-3).join('、')}\n`;
    }
    
    return contextInfo;
  }
}

// Singleton instance
export const geminiService = new Geminiservice('flash');
export const geminiProService = new Geminiservice('pro');

export default Geminiservice;
