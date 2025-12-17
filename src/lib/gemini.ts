import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_DEBUG = import.meta.env.VITE_GEMINI_DEBUG === 'true';

const MODEL_IDS = {
  flash: 'gemini-2.5-flash',
  pro: 'gemini-2.0-pro-exp-02-05'
} as const;
const IMAGE_MODEL_ID = 'gemini-2.5-flash-image-preview';
const IMAGE_EDIT_MODEL_ID = 'gemini-2.5-flash-image';
const IMAGE_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_EDIT_SYSTEM_INSTRUCTION =
  'Improve the uploaded image and make the product looks like a marketing ready pictures of the product.';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-TW': 'Traditional Chinese'
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
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
  responseMimeType?: string;
}

export interface MarketingImageRequest {
  prompt: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  sampleCount?: number;
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  negativePrompt?: string;
}

export interface GeneratedMarketingImage {
  base64: string;
  mimeType: string;
  prompt: string;
  aspectRatio: string;
  safetyAttributes?: Array<Record<string, unknown>>;
}

export interface GeminiInlineImageInput {
  base64: string;
  mimeType: string;
}

export interface MarketingVisualWithCopyRequest extends MarketingImageRequest {
  inputImage?: GeminiInlineImageInput;
  locale?: string;
  objective?: string;
  tone?: string;
  audience?: string;
}

export interface MarketingVisualWithCopyResult {
  images: GeneratedMarketingImage[];
  marketingText: string;
  modelId: string;
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
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
        ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
      },
      safetySettings: SAFETY_SETTINGS
    } as any);

    if (GEMINI_DEBUG) {
      const candidates = (result.response as any)?.candidates ?? [];
      const finishReason = candidates?.[0]?.finishReason;
      const usage = (result.response as any)?.usageMetadata;
      console.debug('[Gemini generateRaw]', {
        model: this.modelId,
        finishReason,
        usage
      });
    }

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

  private normalizeLikelyJson(text: string): string {
    const withoutFences = this.stripJsonFences(text);
    const trimmed = withoutFences.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    const candidate = start !== -1 && end !== -1 ? trimmed.slice(start, end + 1) : trimmed;

    return (
      candidate
        // Remove common invalid trailing commas: `,}` and `,]`
        .replace(/,\s*([}\]])/g, '$1')
        // Remove BOM and other invisible chars that break JSON parsing.
        .replace(/\uFEFF/g, '')
        .trim()
    );
  }

  private parseJson<T>(raw: string): T {
    const cleaned = this.normalizeLikelyJson(raw);

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const snippet = cleaned.length > 1500 ? `${cleaned.slice(0, 1500)}\n…` : cleaned;
      throw new Error(`Unable to parse Gemini JSON response: ${snippet}`);
    }
  }

  private async generateStructuredOutput<T>(prompt: string, options?: GenerateOptions): Promise<T> {
    const temperature = options?.temperature ?? 0.6;
    const maxOutputTokens = options?.maxOutputTokens ?? 2048;

    const attempt = async (attemptPrompt: string, attemptTemperature: number) => {
      const response = await this.generateRaw(attemptPrompt, {
        temperature: attemptTemperature,
        maxOutputTokens,
        responseMimeType: 'application/json'
      });
      try {
        return this.parseJson<T>(response);
      } catch (error) {
        const parseError = new Error((error as Error).message) as Error & { raw?: string };
        parseError.raw = response;
        if (GEMINI_DEBUG) {
          const head = response.slice(0, 600);
          const tail = response.length > 600 ? response.slice(-600) : '';
          console.debug('[Gemini structured JSON parse failed]', {
            model: this.modelId,
            rawLength: response.length,
            rawHead: head,
            rawTail: tail,
            promptHead: attemptPrompt.slice(0, 600)
          });
        }
        throw parseError;
      }
    };

    try {
      return await attempt(prompt, temperature);
    } catch (error) {
      // 1) Try to repair the previous (possibly truncated) output by asking Gemini to rewrite it as valid JSON.
      try {
        const raw = typeof (error as any)?.raw === 'string' ? ((error as any).raw as string) : '';
        const repairInstruction = [
          'You will be given an invalid or truncated JSON response.',
          'Rewrite it into a COMPLETE, VALID JSON object that matches the requested schema.',
          'Return ONLY valid JSON (no markdown, no commentary).'
        ].join(' ');
        const repairPrompt = `${repairInstruction}\n\nOriginal instructions:\n${prompt}\n\nInvalid response:\n${raw || String((error as Error)?.message ?? '')}`;
        return await attempt(repairPrompt, 0.2);
      } catch {
        // fall through to regeneration
      }

      // 2) Regenerate from scratch with stricter instructions.
      const retryInstruction = [
        'Your previous response was not valid JSON.',
        'Return ONLY valid JSON for the requested schema.',
        'Do not include markdown, comments, trailing commas, or any extra text.'
      ].join(' ');
      return attempt(`${retryInstruction}\n\n${prompt}`, Math.min(0.3, temperature));
    }
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

Return ONLY valid JSON (no markdown, no commentary, no trailing commas).
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

Return ONLY valid JSON (no markdown, no commentary, no trailing commas).
Constraints:
- supportingPoints: max 4
- channelRecommendations: exactly 3
- scheduleIdeas: max 3
- designNotes: max 4
Limit hashtags to five relevant tags (omit if not appropriate for the channel). 
Provide practical schedule suggestions and concise design/art-direction notes.
`;

    return this.generateStructuredOutput<MarketingAssetContent>(prompt, { maxOutputTokens: 1600 });
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

Return ONLY valid JSON (no markdown, no commentary, no trailing commas).
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

class GeminiImageService {
  private readonly apiKey = GEMINI_API_KEY;
  private readonly modelId = IMAGE_MODEL_ID;
  private client: GoogleGenerativeAI | null;

  constructor() {
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  private localeToLanguageName(locale?: string) {
    return LANGUAGE_NAMES[locale ?? 'en'] ?? 'English';
  }

  private ensureModel() {
    if (!this.client) {
      throw new Error('Gemini API key (VITE_GEMINI_API_KEY) is not configured.');
    }

    return this.client.getGenerativeModel({
      model: this.modelId
    });
  }

  async generateMarketingImages(request: MarketingImageRequest): Promise<GeneratedMarketingImage[]> {
    const sampleCount = Math.min(Math.max(request.sampleCount ?? 2, 1), 4);
    const aspectRatio = request.aspectRatio ?? '1:1';
    const personGeneration = request.personGeneration ?? 'dont_allow';
    const aspectRatioHint =
      aspectRatio === '1:1'
        ? 'Frame as a balanced square composition.'
        : `Frame the scene using a ${aspectRatio} aspect ratio.`;
    const peopleHint =
      personGeneration === 'dont_allow'
        ? 'Do not include people in the scene.'
        : 'You may include people in the scene when it supports the story.';
    const promptSegments = [
      request.prompt,
      aspectRatioHint,
      peopleHint
    ];

    if (request.negativePrompt && request.negativePrompt.trim().length > 0) {
      promptSegments.push(`Avoid: ${request.negativePrompt.trim()}`);
    }

    const finalPrompt = promptSegments.join('\n\n');

    const results: GeneratedMarketingImage[] = [];

    for (let index = 0; index < sampleCount; index += 1) {
      const response = await fetch(`${IMAGE_ENDPOINT_BASE}/models/${this.modelId}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: finalPrompt }]
            }
          ],
          safetySettings: SAFETY_SETTINGS,
          generationConfig: {
            candidateCount: sampleCount
          }
        })
      });

      if (!response.ok) {
        let message = `Gemini image generation failed with status ${response.status}`;
        try {
          const errorPayload = await response.json();
          const details = errorPayload?.error?.message ?? JSON.stringify(errorPayload);
          message = `${message}: ${details}`;
        } catch {
          const text = await response.text();
          if (text) {
            message = `${message}: ${text}`;
          }
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const candidates: Array<{
        content?: {
          parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
        };
        safetyRatings?: Array<Record<string, unknown>>;
      }> = payload?.candidates ?? [];

      for (const candidate of candidates) {
        const inlinePart = candidate.content?.parts?.find((part) => part?.inlineData?.data);
        const inlineData = inlinePart?.inlineData;

        if (!inlineData?.data) {
          continue;
        }

        results.push({
          base64: inlineData.data,
          mimeType: inlineData.mimeType ?? 'image/png',
          prompt: request.prompt,
          aspectRatio,
          safetyAttributes: candidate.safetyRatings ?? []
        });

        if (results.length >= sampleCount) {
          break;
        }
      }

      if (results.length >= sampleCount) {
        break;
      }
    }

    if (!results.length) {
      throw new Error('Gemini returned no image candidates.');
    }

    return results;
  }

  async generateMarketingVisualWithCopy(request: MarketingVisualWithCopyRequest): Promise<MarketingVisualWithCopyResult> {
    if (!this.apiKey) {
      throw new Error('Gemini API key (VITE_GEMINI_API_KEY) is not configured.');
    }

    const sampleCount = Math.min(Math.max(request.sampleCount ?? 1, 1), 4);
    const aspectRatio = request.aspectRatio ?? '1:1';
    const personGeneration = request.personGeneration ?? 'dont_allow';
    const aspectRatioHint =
      aspectRatio === '1:1' ? 'Frame as a balanced square composition.' : `Frame the scene using a ${aspectRatio} aspect ratio.`;
    const peopleHint =
      personGeneration === 'dont_allow'
        ? 'Do not include people in the scene.'
        : 'You may include people in the scene when it supports the story.';

    const promptSegments = [
      request.prompt,
      aspectRatioHint,
      peopleHint,
      request.negativePrompt && request.negativePrompt.trim().length > 0 ? `Avoid: ${request.negativePrompt.trim()}` : null,
      request.inputImage ? 'Edit the uploaded image to match the direction above.' : 'Generate a brand-new image that matches the direction above.'
    ].filter(Boolean);

    const languageName = this.localeToLanguageName(request.locale);
    const marketingCopySegments = [
      `Write marketing-ready copy (in ${languageName}) for this visual.`,
      request.objective ? `Objective: ${request.objective}.` : null,
      request.tone ? `Tone: ${request.tone}.` : null,
      request.audience ? `Audience: ${request.audience}.` : null,
      'Return plain text with these headings:',
      'Headline:',
      'Caption:',
      'Call-to-action:',
      'Hashtags (max 5):'
    ].filter(Boolean);

    const finalPrompt = `${promptSegments.join('\n\n')}\n\n${marketingCopySegments.join('\n')}`;

    const parts: Array<Record<string, unknown>> = [];
    if (request.inputImage?.base64) {
      parts.push({
        inlineData: {
          mimeType: request.inputImage.mimeType || 'image/png',
          data: request.inputImage.base64
        }
      });
    }
    parts.push({ text: finalPrompt });

    const requestOnce = async () => {
      const response = await fetch(`${IMAGE_ENDPOINT_BASE}/models/${IMAGE_EDIT_MODEL_ID}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts
            }
          ],
          systemInstruction: {
            parts: [{ text: IMAGE_EDIT_SYSTEM_INSTRUCTION }]
          },
          safetySettings: SAFETY_SETTINGS,
          generationConfig: {
            // NOTE: `gemini-2.5-flash-image` rejects multiple candidates; generate one per request.
            candidateCount: 1,
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      });

      if (!response.ok) {
        let message = `Gemini image+copy generation failed with status ${response.status}`;
        try {
          const errorPayload = await response.json();
          const details = errorPayload?.error?.message ?? JSON.stringify(errorPayload);
          message = `${message}: ${details}`;
        } catch {
          const text = await response.text();
          if (text) {
            message = `${message}: ${text}`;
          }
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const candidates: Array<{
        content?: {
          parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }>;
        };
        safetyRatings?: Array<Record<string, unknown>>;
      }> = payload?.candidates ?? [];

      if (GEMINI_DEBUG) {
        const candidateSummaries = candidates.slice(0, 4).map((candidate) => {
          const parts = candidate.content?.parts ?? [];
          const textChars = parts
            .map((part) => (typeof part?.text === 'string' ? part.text.length : 0))
            .reduce((a, b) => a + b, 0);
          const imageParts = parts.filter((part) => Boolean(part?.inlineData?.data)).length;
          return { parts: parts.length, textChars, imageParts };
        });
        console.debug('[Gemini image+copy response]', {
          model: IMAGE_EDIT_MODEL_ID,
          candidates: candidates.length,
          candidateSummaries
        });
      }

      let text = '';
      const images: GeneratedMarketingImage[] = [];

      for (const candidate of candidates) {
        const candidateText = candidate.content?.parts
          ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('\n')
          .trim();
        if (!text && candidateText) {
          text = candidateText;
        }

        const inlineParts = candidate.content?.parts?.filter((part) => part?.inlineData?.data) ?? [];
        for (const part of inlineParts) {
          const inlineData = part.inlineData;
          if (!inlineData?.data) continue;
          images.push({
            base64: inlineData.data,
            mimeType: inlineData.mimeType ?? 'image/png',
            prompt: request.prompt,
            aspectRatio,
            safetyAttributes: candidate.safetyRatings ?? []
          });
          break;
        }

        if (images.length > 0 && text) {
          break;
        }
      }

      return { text, images };
    };

    const images: GeneratedMarketingImage[] = [];
    let marketingText = '';

    for (let index = 0; index < sampleCount; index += 1) {
      const one = await requestOnce();
      if (!marketingText && one.text) {
        marketingText = one.text;
      }
      if (one.images[0]) {
        images.push(one.images[0]);
      }
    }

    if (!images.length) {
      throw new Error('Gemini returned no image candidates.');
    }

    return {
      images,
      marketingText,
      modelId: IMAGE_EDIT_MODEL_ID
    };
  }
}

export const geminiImageService = new GeminiImageService();
