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
  user?: { displayName?: string; role?: 'farmer' | 'market'; locale?: 'zh-TW' | 'en' };
  sessionUserId?: string; // ensure per-user session separation
}

interface ConversationPlan {
  text?: string;
  lineMessages?: LineMessage[];
  functionCalls: Array<{ name: string; args?: Record<string, unknown> }>;
}

type UnknownRecord = Record<string, unknown>;

const GEMINI_MODEL = process.env.GEMINI_MODEL_ID ?? 'gemini-2.5-flash-lite';
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GENERATIVE_LANGUAGE_API_KEY ||
  '';

const ALLOWED_FUNCTION_CALLS = new Set([
  // Menus / helpers
  'show_product_tools',
  'show_store_tools',
  'show_marketing_tools',
  'show_analytics_tools',
  'open_dashboard',
  'show_help_options',
  // App feature actions
  'product_list',
  'product_create',
  'store_list',
  'store_create',
  'marketing_material_list',
  'analytics_get_user_stats',
  // Profile actions
  'user_set_role',
  // Public marketplace actions
  'product_browse_public',
  'store_browse_public',
  'marketplace_get_stats',
  'product_search_public',
  'store_search_public',
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

// Minimal format instruction to ensure LINE-supported JSON structure without templates
const SYSTEM_FORMAT_PROMPT = `
Return ONLY strict JSON (no markdown fences) using this schema:
{
  "text": string | null,
  "lineMessages": [LineMessage],
  "functionCalls": [ { "name": FunctionName } ]
}

Rules for LINE output:
- Allowed LineMessage types: "text" or "flex" only. Do NOT use "template".
- You MUST include at least one primary Flex message per response. Prefer a horizontal carousel of product cards for any product list/browse/search results. It must have a clear visual element:
  * Prefer a hero image WHEN a safe, explicit image URL is provided by the user/context.
  * Otherwise, use a visual header (e.g., colored header bar and an emoji/icon in the text) and well-structured sections.
- Flex messages MUST include both "altText" and a valid "contents" per LINE Flex spec.
- Keep it concise and scannable. Prefer max 2 messages (primary Flex + optional short text). When onboarding, up to 3 is ok.
- Quick replies are encouraged for next steps; provide 2–4 actionable items.

Privacy and data sharing:
- Share only business information (e.g., product names, prices, stock, store name/type/location, public business contact).
- Never expose personal data (private phone numbers, emails, exact home addresses) unless explicitly labeled as business contact.
- When in doubt, show a summary and offer to broker contact via a safe message template.

 Reference Flex layout (use as a style guide and customize content):
 - Bubble
   - Header: brand color #1DB446, bold title with a leading emoji summarizing the action (e.g., 📦 Product created, 🏪 Store created, 📊 Stats)
   - Hero (optional): include when an explicit image URL is available (e.g., product image)
   - Body: vertical box with concise, relevant key-value lines from the user request and/or function result (e.g., Name, Price+Unit, Stock, Location)
   - Footer (optional): one or two buttons linking to LIFF tabs when clearly relevant: products, stores, marketing, analytics

Tool use:
- functionCalls are optional. Allowed: show_product_tools, show_store_tools, show_marketing_tools, show_analytics_tools, open_dashboard, show_help_options.
- Minimize website redirections. Prefer a short back-and-forth in chat to collect missing info and confirm intent. Only suggest dashboard links when necessary for a complex workflow or when the user asks.
- Include a function call when executing an app feature is clearly intended.
- After setting user role, proactively propose role-specific next steps and quick replies.
- For dataset queries, prefer calling search/browse tools (product_browse_public, product_search_public, store_browse_public, store_search_public, marketplace_get_stats) instead of answering from memory.
- Never create placeholder/unnamed records. If required info is missing, ask the user succinct follow-up questions and wait.
- When you call a function, include useful arguments parsed from the request:
  * product_create: REQUIRED fields = name, price, unit, stock. Do NOT call this function until you have all four. If any are missing or ambiguous, ask 1–2 concise follow-up questions to collect them (e.g., "What price and unit?", "How many in stock?"). Price must be > 0; stock must be >= 0.
  * store_create: REQUIRED field = name. Do NOT call without a clear non-empty name. Type/location optional; ask if the user mentions them.
  * product_list/store_list/marketing_material_list: include limit when the user specifies a number.

User feedback:
- When you include any functionCalls, also set "text" to a brief, user-visible status message describing what you are doing (e.g., "Adding eggs to your products..."). Keep it under 20 words.

Follow-up questions:
- If required arguments are missing or the request is ambiguous, DO NOT answer directly. Ask ONE concise clarifying question and include 2–4 relevant quick replies. After you have enough info, then call the appropriate function.
- For product listing/browse/search requests, first check if the user has specified a category, keyword, or a price range. If not, ask one clarifying question (e.g., "要找哪一類或價格範圍？") with 2–4 quick replies (e.g., 顯示全部, 價格 ≤ 200, 雞蛋, 蔬果)。 After that, call product_browse_public or product_search_public with parsed filters.
- For searches, infer reasonable filters from user text (keywords, categories, tags, price ranges, locations) and include them in the tool args. If ambiguous, ask one clarifying question.

After execution:
- After the function completes, return a Flex summary showing the result (e.g., created product/store or refreshed list).

Onboarding and persona:
- First-time or early interactions should welcome the user with a rich overview of features tailored to their role (farmer/seller vs market buyer/owner) and language.
- Personalize with the user's display name when available (e.g., "Hi Alex"), and be proactive but concise.
- Ask 1–2 short onboarding questions to understand role and immediate goal (e.g., role and what they want to do first). Keep the flow inside LINE.
- Provide next-step quick actions. Offer LIFF links only if clearly beneficial.

Output nothing except the JSON object.
`;

function getTools() {
  return [
    {
      functionDeclarations: [
        { name: 'show_product_tools', description: 'Show product management shortcuts and guidance.' },
        { name: 'show_store_tools', description: 'Show store/CRM shortcuts and guidance.' },
        { name: 'show_marketing_tools', description: 'Show marketing content creation shortcuts.' },
        { name: 'show_analytics_tools', description: 'Show analytics shortcuts.' },
        { name: 'open_dashboard', description: 'Open the Farm2Market LIFF dashboard for the user.' },
        { name: 'show_help_options', description: 'Show help options and tips.' },
        // Features
        { name: 'product_list', description: 'List the user\'s products. If a limit is mentioned, include it in args.' },
        { name: 'product_create', description: 'Create a new product. Required: name, price (>0), unit, stock (>=0). Do not call until all provided; otherwise ask for the missing fields first.' },
        { name: 'store_list', description: 'List the user\'s stores. If a limit is mentioned, include it in args.' },
        { name: 'store_create', description: 'Create a new store. Ask for missing: name (required). type/location optional. Include parsed args.' },
        { name: 'marketing_material_list', description: 'List recent marketing materials. If a limit is mentioned, include it in args.' },
        { name: 'analytics_get_user_stats', description: 'Get counts for products, stores, conversations for this user.' },
        { name: 'user_set_role', description: 'Set the user role. Args: { role: "farmer" | "market" }.' },
        { name: 'product_browse_public', description: 'Browse public products. Optional args: { limit?: number }' },
        { name: 'store_browse_public', description: 'Browse public stores/buyers. Optional args: { limit?: number }' },
        { name: 'marketplace_get_stats', description: 'Get public marketplace stats (counts of sellers/buyers/products/stores).' },
        { name: 'product_search_public', description: 'Search products by name/category/tags/price. Args: { nameContains?: string, categoryEquals?: string, tagsAny?: string[], minPrice?: number, maxPrice?: number, limit?: number }' },
        { name: 'store_search_public', description: 'Search stores by name/type/location. Args: { nameContains?: string, typeEquals?: string, locationContains?: string, limit?: number }' },
      ],
    },
  ];
}

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

function detectLanguageFromMessage(text: string): 'zh-TW' | 'en' {
  const hasCJK = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
  return hasCJK ? 'zh-TW' : 'en';
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
  // Disallow template messages as requested; only permit text and flex.
  if (type !== 'text' && type !== 'flex') {
    throw new Error(`Unsupported LINE message type at index ${index}: ${String(type)}`);
  }

  const quickReply = normaliseQuickReply(payload.quickReply);

  if (type === 'text') {
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new Error(`Text message at index ${index} must include non-empty text.`);
    }
    return { type, text: payload.text.trim(), quickReply };
  }

  if (!isRecord(payload.contents)) {
    throw new Error(`Flex message at index ${index} must include contents.`);
  }
  const altText = typeof payload.altText === 'string' && payload.altText.trim() ? payload.altText.trim() : 'Flex message';
  return { type, altText, contents: payload.contents, quickReply };
}

function normaliseFunctionCalls(value: unknown): Array<{ name: string; args?: Record<string, unknown> }> {
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
    const args = isRecord((entry as any).args) ? ((entry as any).args as Record<string, unknown>) : undefined;
    return { name: trimmed, args };
  });
}

function parseGeminiPlan(raw: string): ConversationPlan {
  const cleaned = stripJsonFences(raw);

  let parsed: UnknownRecord;
  try {
    parsed = JSON.parse(cleaned) as UnknownRecord;
  } catch {
    // Fallback: treat model output as plain text answer
    return { text: cleaned, functionCalls: [] } as unknown as ConversationPlan;
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

function getUserContextPrompt(user?: { displayName?: string; role?: 'farmer' | 'market'; locale?: 'zh-TW' | 'en' }): string {
  if (!user) return 'Keep most interactions inside LINE chat; minimize external links.';
  const parts: string[] = ['Keep most interactions inside LINE chat; minimize external links.'];
  if (user.displayName) parts.push(`User displayName: ${user.displayName}`);
  if (user.role) parts.push(`User role: ${user.role === 'farmer' ? 'farmer/seller' : 'market buyer/owner'}`);
  if (user.locale) parts.push(`User locale preference: ${user.locale}`);
  return parts.join('\n');
}

async function requestConversationPlan(message: string, history?: ConversationHistoryItem[], user?: { displayName?: string; role?: 'farmer' | 'market'; locale?: 'zh-TW' | 'en' }, sessionUserId?: string): Promise<ConversationPlan> {
  const client = getGeminiClient();
  const lang = detectLanguageFromMessage(message);
  const langPrompt = lang === 'zh-TW'
    ? '回覆使用繁體中文。'
    : 'Respond in English.';
  const userContext = getUserContextPrompt(user);
  const sessionNote = sessionUserId ? `\nSession: line_user_id=${sessionUserId}` : '';
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildConversationContents(history, message),
    config: {
      tools: getTools(),
      systemInstruction: { role: 'system', parts: [{ text: `${SYSTEM_FORMAT_PROMPT}\n\n${userContext}${sessionNote}\n\nLanguage: ${langPrompt}` }] },
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

  // Prefer native tool/function calls before reading concatenated text to avoid SDK warnings
  try {
    const candidate: any = (response as any).candidates?.[0];
    const parts: any[] = candidate?.content?.parts ?? [];
    const toolCalls = parts
      .map(p => (p?.functionCall?.name ? { name: String(p.functionCall.name), args: (p.functionCall as any).args } : null))
      .filter(Boolean) as Array<{ name: string; args?: Record<string, unknown> }>;

    const validCalls = toolCalls.filter(c => ALLOWED_FUNCTION_CALLS.has(c.name));
    if (validCalls.length) {
      try { console.debug('[gemini-client] Tool calls detected', { calls: validCalls.map(c => c.name) }); } catch {}
      return { functionCalls: validCalls };
    }
  } catch {
    // ignore
  }

  const text = response.text;
  if (text && text.trim()) {
    try { console.debug('[gemini-client] Falling back to text parse path'); } catch {}
    return parseGeminiPlan(text);
  }

  throw new Error('Gemini returned no actionable content.');
}

export async function generateConversationPlan({ message, history, user, sessionUserId }: ConversationPlanInput): Promise<ConversationPlan> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      text: '我可以如何協助您？您可以描述需求或直接點擊下方按鈕。',
      functionCalls: [],
    };
  }

  if (!GEMINI_API_KEY) {
    // No API key: ask a clarifying question instead of fallback
    return {
      text: '我想更了解您的需求：需要我幫您管理產品、拓展店家、建立行銷素材，或查看營運分析？',
      functionCalls: [],
    };
  }

  try {
    return await requestConversationPlan(trimmed, history, user, sessionUserId);
  } catch (error) {
    console.error('[gemini-client] Gemini conversation plan failed:', error);
    // Retry with explicit instruction to ask a clarifying question
    try {
      return await requestConversationPlan(
        trimmed + '\n\n(如果目前資訊不足，請先提出一個簡短澄清問題，並附上 2–4 個 quick replies。)',
        history
      );
    } catch {
      return {
        text: '想更精準協助您，請用一句話說明要做的事（例如：新增雞蛋 120/斤 20 箱）。',
        functionCalls: [],
      };
    }
  }
}

// Removed generic out-of-scope fallback; all flows should go through generateConversationPlan

export async function analyzeImageWithGemini({
  prompt,
}: {
  base64Image: string;
  history?: ConversationHistoryItem[];
  prompt: string;
}): Promise<string> {
  return `${prompt} 我已收到您的影像，建議您可以透過行銷素材工具產生宣傳文案，或使用產品管理功能更新相關商品資訊。`;
}
