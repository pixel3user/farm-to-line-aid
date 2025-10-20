import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';

const MODEL_IDS = {
  flash: 'gemini-1.5-flash',
  pro: 'gemini-1.5-pro'
} as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-TW': 'Traditional Chinese'
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUAL_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
] as const;

export interface ProductMarketingSummary {
  name: string;
  category?: string;
  summary: string;
  uniqueSellingPoints: string[];
  idealCustomers: string[];
  flavorNotes?: string;
  seasonality: string[];
  storyAngle: string;
  priceGuidance?: string;
  language: string;
}

export type MarketingObjective = 'social_post' | 'farm_flyer' | 'newsletter' | 'recipe_card';
export type MarketingTone = 'friendly' | 'professional' | 'playful' | 'premium';

export interface MarketingAssetRequest {
  product: ProductMarketingSummary;
  objective: MarketingObjective;
  audience: string;
  tone: MarketingTone;
  locale: string;
  specialOffer?: string;
  preferredChannel?: string;
  additionalNotes?: string;
}

export interface MarketingAssetContent {
  title: string;
  hook: string;
  primaryMessage: string;
  supportingPoints: string[];
  callToAction: string;
  hashtags: string[];
  channelRecommendations: Array<{
    channel: string;
    idea: string;
  }>;
  scheduleIdeas: string[];
  designNotes: string[];
  language: string;
}

export interface MarketingCampaignIdea {
  title: string;
  summary: string;
  keyMessage: string;
  recommendedChannels: string[];
  timing: string;
  successMetric: string;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

class GeminiService {
  private client: GoogleGenerativeAI | null;
  private readonly modelId: string;

  constructor(modelType: 'flash' | 'pro' = 'flash') {
    this.client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
    this.modelId = MODEL_IDS[modelType];
  }

  private ensureModel() {
    if (!this.client) {
      throw new Error('Gemini API key (VITE_GEMINI_API_KEY) is not configured.');
    }

    return this.client.getGenerativeModel({
      model: this.modelId
    });
  }

  private async generateRaw(prompt: string, options?: GenerateOptions): Promise<string> {
    const model = this.ensureModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 1024
      },
      safetySettings: SAFETY_SETTINGS
    });

    const text = result.response.text();
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return text.trim();
  }

  private stripJsonFences(text: string): string {
    return text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/\u200b/g, '')
      .trim();
  }

  private parseJson<T>(raw: string): T {
    const cleaned = this.stripJsonFences(raw);

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');

      if (start !== -1 && end !== -1) {
        const candidate = cleaned.slice(start, end + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          // fall through
        }
      }

      throw new Error(`Unable to parse Gemini JSON response: ${cleaned}`);
    }
  }

  private async generateStructuredOutput<T>(prompt: string, options?: GenerateOptions): Promise<T> {
    const response = await this.generateRaw(prompt, {
      temperature: options?.temperature ?? 0.6,
      maxOutputTokens: options?.maxOutputTokens ?? 1400
    });

    return this.parseJson<T>(response);
  }

  private localeToLanguage(locale: string | undefined): string {
    return LANGUAGE_NAMES[locale ?? 'en'] ?? 'English';
  }

  async generateProductInfo(input: {
    name: string;
    category?: string;
    description?: string;
    unit?: string;
    price?: number | string;
    locale?: string;
    existingStory?: string;
  }): Promise<ProductMarketingSummary> {
    const languageName = this.localeToLanguage(input.locale);

    const prompt = `
You are an experienced agricultural marketer helping a farmer describe their product.
Summarise the product in clear marketing language and return JSON that matches this shape:
{
  "name": string,
  "category": string,
  "summary": string,
  "uniqueSellingPoints": string[],
  "idealCustomers": string[],
  "flavorNotes": string,
  "seasonality": string[],
  "storyAngle": string,
  "priceGuidance": string,
  "language": string
}

The copy must be written in ${languageName}. Keep arrays to at most four bullet points each.
Focus on practical benefits for buyers (e.g. freshness, sustainability, taste, farm story).

Product data:
${JSON.stringify({
      name: input.name,
      category: input.category ?? '',
      description: input.description ?? '',
      unit: input.unit ?? '',
      price: input.price ?? '',
      existingStory: input.existingStory ?? ''
    }, null, 2)}
`;

    return this.generateStructuredOutput<ProductMarketingSummary>(prompt, { maxOutputTokens: 900 });
  }

  async generateMarketingMaterial(request: MarketingAssetRequest): Promise<MarketingAssetContent> {
    const languageName = this.localeToLanguage(request.locale);
    const objectiveDescriptions: Record<MarketingObjective, string> = {
      social_post: 'Create a high-performing social media post (LINE, Facebook or Instagram) with a compelling hook, concise body copy, and a clear call-to-action. Keep it under 120 words.',
      farm_flyer: 'Write copy for a single-page flyer or poster that can be printed and shared locally. Use persuasive storytelling and highlight what makes the farm special. Keep paragraphs short.',
      newsletter: 'Draft a friendly email newsletter announcing the product, including a short story, reasons to buy, and a closing call-to-action.',
      recipe_card: 'Create a recipe card that uses the product as a hero ingredient. Include recipe name, short story, directions, and serving suggestion.'
    };

    const toneHints: Record<MarketingTone, string> = {
      friendly: 'warm, conversational, community-focused',
      professional: 'confident, trustworthy, quality-focused',
      playful: 'energetic, lively, engaging',
      premium: 'luxurious, refined, detail-oriented'
    };

    const prompt = `
You are crafting marketing content for a farmer in Taiwan.
Objective: ${objectiveDescriptions[request.objective]}
Target audience: ${request.audience}
Desired tone: ${toneHints[request.tone]}
Primary language: ${languageName}

Product summary:
${JSON.stringify(request.product, null, 2)}

Special offer or notes: ${request.specialOffer ?? 'None'}
Preferred channel focus: ${request.preferredChannel ?? 'No specific channel'}
Additional creative direction: ${request.additionalNotes ?? 'None'}

Return JSON matching this schema:
{
  "title": string,
  "hook": string,
  "primaryMessage": string,
  "supportingPoints": string[],
  "callToAction": string,
  "hashtags": string[],
  "channelRecommendations": [
    { "channel": string, "idea": string }
  ],
  "scheduleIdeas": string[],
  "designNotes": string[],
  "language": string
}

Limit hashtags to five relevant tags (omit if not appropriate for the channel). 
Provide practical schedule suggestions and concise design/art-direction notes.
`;

    return this.generateStructuredOutput<MarketingAssetContent>(prompt, { maxOutputTokens: 1200 });
  }

  async generateCampaignIdeas(request: {
    product: ProductMarketingSummary;
    locale: string;
    season?: string;
    objective?: MarketingObjective;
  }): Promise<MarketingCampaignIdea[]> {
    const languageName = this.localeToLanguage(request.locale);

    const prompt = `
Provide three campaign ideas for promoting this farm product. Tailor them for buyers in Taiwan.
Each idea should focus on a different channel or format.

Return a JSON array with this structure:
[
  {
    "title": string,
    "summary": string,
    "keyMessage": string,
    "recommendedChannels": string[],
    "timing": string,
    "successMetric": string
  }
]

Ideas must be written in ${languageName}. Include practical metrics to track success.
Campaign season focus: ${request.season ?? 'current season'}
Primary objective: ${request.objective ?? 'awareness and sales'}

Product summary:
${JSON.stringify(request.product, null, 2)}
`;

    return this.generateStructuredOutput<MarketingCampaignIdea[]>(prompt, { maxOutputTokens: 1100, temperature: 0.7 });
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.generateRaw(prompt, options);
  }
}

export const geminiService = new GeminiService('flash');
export const geminiProService = new GeminiService('pro');

export default GeminiService;
