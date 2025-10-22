import type { Timestamp } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import type { LineMessage } from '../api/lineBot';

export interface ConversationHistoryItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string | number | Date | Timestamp;
}

interface ConversationPlanInput {
  message: string;
  history?: ConversationHistoryItem[];
}

interface ConversationPlan {
  text?: string;
  lineMessages?: LineMessage[];
  functionCalls: Array<{ name: string }>;
}

type UnknownRecord = Record<string, unknown>;

const GEMINI_MODEL = process.env.GEMINI_MODEL_ID ?? 'gemini-2.0-flash';
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GENERATIVE_LANGUAGE_API_KEY ||
  '';

const ALLOWED_FUNCTION_CALLS = new Set([
  'show_product_tools',
  'show_store_tools',
  'show_marketing_tools',
  'show_analytics_tools',
  'open_dashboard',
  'show_help_options',
]);

const FUNCTION_SUGGESTIONS: Record<string, { label: string; text: string }> = {
  show_product_tools: { label: '📦 產品管理', text: '我要管理產品' },
  show_store_tools: { label: '🏪 拓展店家', text: '協助拓展店家' },
  show_marketing_tools: { label: '📣 行銷素材', text: '我要行銷建議' },
  show_analytics_tools: { label: '📊 營運分析', text: '查看營運分析' },
  open_dashboard: { label: '🖥️ 打開控制台', text: '開啟控制台' },
  show_help_options: { label: '❓ 需要幫助', text: '顯示幫助選項' },
};

const GENERAL_SUGGESTIONS = [
  FUNCTION_SUGGESTIONS.show_product_tools,
  FUNCTION_SUGGESTIONS.show_store_tools,
  FUNCTION_SUGGESTIONS.show_marketing_tools,
  FUNCTION_SUGGESTIONS.show_analytics_tools,
  FUNCTION_SUGGESTIONS.show_help_options,
];

const SYSTEM_PROMPT = `
You are the response composer for the NexStore LINE Messaging API bot. Every reply you produce must be immediately renderable by the LINE bot without additional reasoning.

Return ONLY strict JSON (no markdown fences) using this schema:
{
  "text": string | null,
  "lineMessages": [LineMessage],
  "functionCalls": [ { "name": FunctionName } ]
}

Rules:
- Prefer including rich UI elements such as Flex carousels, quick replies, and templates to guide the farmer's next step.
- A LineMessage object must follow LINE's structure:
  * Text bubble: { "type": "text", "text": string, "quickReply"?: { "items": [ { "type": "action", "action": { ... } } ] } }
  * Flex bubble: { "type": "flex", "altText": string, "contents": { ...valid Flex message JSON... } }
  * Template bubble: { "type": "template", "altText": string, "template": { ...valid template JSON... } }
- Provide at most three messages per response and ensure every required field (like altText) is present so LINE will not reject it.
- If you include quick replies, provide 1-4 actionable suggestions related to the conversation context.
- Function calls are optional and MUST use one of these exact names when relevant: show_product_tools, show_store_tools, show_marketing_tools, show_analytics_tools, open_dashboard, show_help_options.
- When you cannot determine a specific tool, return a supportive text message plus quick replies guiding the user to the main menu.
- Never output placeholders or TODO text. Ensure the JSON is complete and can be rendered safely.
- Keep responses concise (under 120 words of visible text).
`;

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  return geminiClient;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').replace(/\u200b/g, '').trim();
}

function normaliseQuickReply(value: unknown): LineMessage['quickReply'] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error('Quick reply payload must be an object.');
  }

  if (!Array.isArray(value.items)) {
    throw new Error('Quick reply payload must include an items array.');
  }

  const items = value.items.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Quick reply item at index ${index} must be an object.`);
    }
    if (item.type !== 'action') {
      throw new Error(`Quick reply item at index ${index} must have type "action".`);
    }
    if (!isRecord(item.action)) {
      throw new Error(`Quick reply item at index ${index} must include an action object.`);
    }
    return { type: 'action' as const, action: item.action };
  });

  if (!items.length) {
    throw new Error('Quick reply payload must include at least one item.');
  }

  return { items };
}

function normaliseLineMessage(payload: unknown, index: number): LineMessage {
  if (!isRecord(payload)) {
    throw new Error(`Line message at index ${index} must be an object.`);
  }

  const type = payload.type;
  if (type !== 'text' && type !== 'flex' && type !== 'template') {
    throw new Error(`Unsupported LINE message type at index ${index}: ${String(type)}`);
  }

  const quickReply = normaliseQuickReply(payload.quickReply);

  if (type === 'text') {
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new Error(`Text message at index ${index} must include non-empty text.`);
    }
    return { type, text: payload.text.trim(), quickReply };
  }

  if (typeof payload.altText !== 'string' || !payload.altText.trim()) {
    throw new Error(`Non-text message at index ${index} must include altText.`);
  }

  if (type === 'flex') {
    if (!isRecord(payload.contents)) {
      throw new Error(`Flex message at index ${index} must include contents.`);
    }
    return { type, altText: payload.altText.trim(), contents: payload.contents, quickReply };
  }

  if (!isRecord(payload.template)) {
    throw new Error(`Template message at index ${index} must include template data.`);
  }

  return { type, altText: payload.altText.trim(), template: payload.template, quickReply };
}

function normaliseFunctionCalls(value: unknown): Array<{ name: string }> {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('functionCalls must be an array.');
  }

  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      throw new Error(`Function call at index ${index} must include a valid name.`);
    }
    const trimmed = entry.name.trim();
    if (!ALLOWED_FUNCTION_CALLS.has(trimmed)) {
      throw new Error(`Function call name "${trimmed}" is not permitted.`);
    }
    return { name: trimmed };
  });
}

function parseGeminiPlan(raw: string): ConversationPlan {
  const cleaned = stripJsonFences(raw);

  let parsed: UnknownRecord;
  try {
    parsed = JSON.parse(cleaned) as UnknownRecord;
  } catch (error) {
    throw new Error(`Unable to parse Gemini response as JSON: ${(error as Error).message}`);
  }

  const functionCalls = normaliseFunctionCalls(parsed.functionCalls);
  let lineMessages: LineMessage[] | undefined;
  if (parsed.lineMessages !== undefined) {
    if (!Array.isArray(parsed.lineMessages)) {
      throw new Error('lineMessages must be an array when present.');
    }
    lineMessages = parsed.lineMessages.map((message, index) => normaliseLineMessage(message, index));
    if (lineMessages.length > 3) {
      throw new Error('Gemini returned too many lineMessages. Limit to 3.');
    }
  }

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : undefined;

  if (!text && (!lineMessages || lineMessages.length === 0) && functionCalls.length === 0) {
    throw new Error('Gemini response did not include any actionable content.');
  }

  return { text, lineMessages, functionCalls };
}

function buildConversationContents(history: ConversationHistoryItem[] | undefined, message: string) {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(history)) {
    const recent = history.slice(-10);
    for (const turn of recent) {
      if (!turn.text) {
        continue;
      }
      const role = turn.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: turn.text }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  return contents;
}

async function requestConversationPlan(message: string, history?: ConversationHistoryItem[]): Promise<ConversationPlan> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildConversationContents(history, message),
    config: {
      temperature: 0.45,
      topP: 0.8,
      maxOutputTokens: 1024,
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    },
  });

  if (
    response.promptFeedback?.blockReason &&
    response.promptFeedback.blockReason !== 'BLOCKED_REASON_UNSPECIFIED'
  ) {
    const reason =
      response.promptFeedback.blockReasonMessage ?? response.promptFeedback.blockReason;
    throw new Error(`Gemini blocked the prompt: ${reason}`);
  }

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return parseGeminiPlan(text);
}

function detectIntent(message: string): ConversationPlan {
  const lowered = message.trim().toLowerCase();
  const calls: Array<{ name: string }> = [];

  if (!lowered) {
    return { text: '我可以如何協助您管理農產業務？', functionCalls: calls };
  }

  if (/(產品|product|inventory|stock)/.test(lowered)) {
    calls.push({ name: 'show_product_tools' });
  }
  if (/(店|store|buyer|客戶|market)/.test(lowered)) {
    calls.push({ name: 'show_store_tools' });
  }
  if (/(行銷|marketing|promote|宣傳)/.test(lowered)) {
    calls.push({ name: 'show_marketing_tools' });
  }
  if (/(分析|analytics|report|數據)/.test(lowered)) {
    calls.push({ name: 'show_analytics_tools' });
  }
  if (/(dashboard|控制台|open liff|web app|打開|開啟).*/.test(lowered)) {
    calls.push({ name: 'open_dashboard' });
  }
  if (/(help|幫助|說明|指引)/.test(lowered)) {
    calls.push({ name: 'show_help_options' });
  }

  if (!calls.length) {
    const fallbackText =
      '我已經記錄下您的問題，以下是一些可以嘗試的選項：產品管理、店家拓展、行銷素材或營運分析。告訴我您想先處理哪一項。';
    const quickReplyItems = GENERAL_SUGGESTIONS.slice(0, 4).map(suggestion => ({
      type: 'action' as const,
      action: { type: 'message', label: suggestion.label, text: suggestion.text },
    }));

    const lineMessages: LineMessage[] = [
      {
        type: 'text',
        text: fallbackText,
        quickReply: { items: quickReplyItems },
      },
    ];

    return {
      text: fallbackText,
      functionCalls: [],
      lineMessages,
    };
  }

  const summaryIntro =
    '為您整理了一些相關的工具與建議，請選擇下方建議或提出更多需求。';

    const quickReplyItems = calls
    .map(call => FUNCTION_SUGGESTIONS[call.name])
    .filter((entry): entry is { label: string; text: string } => Boolean(entry))
    .slice(0, 4)
    .map(suggestion => ({
      type: 'action' as const,
      action: { type: 'message', label: suggestion.label, text: suggestion.text },
    }));

  const lineMessages = quickReplyItems.length
    ? ([
        {
          type: 'text' as const,
          text: summaryIntro,
          quickReply: { items: quickReplyItems },
        },
      ] as LineMessage[])
    : undefined;

  return { text: summaryIntro, functionCalls: calls, lineMessages };
}

export async function generateConversationPlan({ message, history }: ConversationPlanInput): Promise<ConversationPlan> {
  const trimmed = message.trim();
  if (!trimmed) {
    return detectIntent(message);
  }

  if (!GEMINI_API_KEY) {
    return detectIntent(message);
  }

  try {
    return await requestConversationPlan(trimmed, history);
  } catch (error) {
    console.error('[gemini-client] Falling back to heuristic intent detection:', error);
    return detectIntent(message);
  }
}

export async function generateOutOfScopeAnswer({
  message,
}: {
  message: string;
  history?: ConversationHistoryItem[];
}): Promise<string> {
  return `我目前無法直接處理「${message.trim() || '這個問題'}」，但您可以從功能選單中選擇產品管理、店家關係或行銷工具，我可以協助您更進一步。`;
}

export async function analyzeImageWithGemini({
  prompt,
}: {
  base64Image: string;
  history?: ConversationHistoryItem[];
  prompt: string;
}): Promise<string> {
  return `${prompt} 我已收到您的影像，建議您可以透過行銷素材工具產生宣傳文案，或使用產品管理功能更新相關商品資訊。`;
}
