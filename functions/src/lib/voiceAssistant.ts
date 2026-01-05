import runtimeConfig from './runtimeConfig';
import { ConversationStore } from './conversationStore';
import { DatabaseService } from './database-server';
import { generateConversationPlan } from './gemini-client';
import type { LineMessage } from '../api/lineBot';
import { GoogleGenAI } from '@google/genai';

type Language = 'zh-TW' | 'en';

export type VoiceAssistantMessage = { role: 'assistant' | 'system'; text: string };

export type VoiceAssistantResponse = {
  messages: VoiceAssistantMessage[];
  functionCalls?: Array<{ name: string; args?: Record<string, unknown> }>;
};

const COPY = {
  'zh-TW': {
    fallback: '我可以協助管理產品、店家、行銷素材或查看營運分析。請告訴我想做的事。',
    productListEmpty: '目前沒有產品。你可以說：「新增產品 雞蛋 價格 120 單位 斤 庫存 10」。',
    storeListEmpty: '目前沒有店家。你可以說：「新增店家 大樹超市」。',
    marketingListEmpty: '目前沒有行銷素材。你可以說：「幫我生成雞蛋的行銷文案」。',
    searchEmpty: '沒有找到符合的項目。可以換個關鍵字或條件。',
    missingProductFields: (fields: string[]) => `無法建立產品，缺少：${fields.join('、')}。`,
    missingStoreName: '無法建立店家，請提供店名。',
    productCreated: (name: string, price: number, unit: string, stock: number) =>
      `已建立產品 ${name}，價格 ${price}${unit ? `/${unit}` : ''}，庫存 ${stock}。`,
    storeCreated: (name: string, type?: string, location?: string) =>
      `已建立店家 ${name}${type ? `，類型 ${type}` : ''}${location ? `，地點 ${location}` : ''}。`,
    roleSetFarmer: '已將您的角色設定為賣家/農友。',
    roleSetMarket: '已將您的角色設定為市場/買家。',
    statsSummary: (stats: Record<string, number>) =>
      `目前共有產品 ${stats.products} 項、店家 ${stats.stores} 間、對話 ${stats.conversations} 則。`,
    marketplaceStats: (stats: { sellers: number; buyers: number; products: number; stores: number }) =>
      `市集統計：賣家 ${stats.sellers} 位、買家 ${stats.buyers} 位、產品 ${stats.products} 項、店家 ${stats.stores} 間。`,
    productTools: '產品管理：列出產品、新增產品、更新庫存。',
    storeTools: '店家管理：列出店家、新增店家、搜尋店家。',
    marketingTools: '行銷工具：查看或生成行銷素材。',
    analyticsTools: '分析工具：查看產品、店家與對話統計。',
    helpOptions: '你可以說「列出產品」、「新增產品」、「列出店家」或「查看統計」。',
    dashboardMissing: '目前無法開啟控制台，請稍後再試。',
    dashboardLink: (url: string) => `請開啟控制台：${url}`,
    listHeader: (label: string) => `${label}：`,
  },
  en: {
    fallback: 'I can help manage products, stores, marketing materials, or analytics. Tell me what you want to do.',
    productListEmpty: 'You have no products yet. Say: "Add product eggs price 120 unit jin stock 10".',
    storeListEmpty: 'You have no stores yet. Say: "Add store Green Tree Market".',
    marketingListEmpty: 'No marketing materials yet. Say: "Generate marketing copy for eggs".',
    searchEmpty: 'No results found. Try a different keyword or filter.',
    missingProductFields: (fields: string[]) => `Missing required product fields: ${fields.join(', ')}.`,
    missingStoreName: 'Store name is required to create a store.',
    productCreated: (name: string, price: number, unit: string, stock: number) =>
      `Created product ${name}. Price ${price}${unit ? `/${unit}` : ''}. Stock ${stock}.`,
    storeCreated: (name: string, type?: string, location?: string) =>
      `Created store ${name}${type ? `, type ${type}` : ''}${location ? `, location ${location}` : ''}.`,
    roleSetFarmer: 'Your role is set to farmer/seller.',
    roleSetMarket: 'Your role is set to market/buyer.',
    statsSummary: (stats: Record<string, number>) =>
      `You have ${stats.products} products, ${stats.stores} stores, and ${stats.conversations} conversations.`,
    marketplaceStats: (stats: { sellers: number; buyers: number; products: number; stores: number }) =>
      `Marketplace stats: ${stats.sellers} sellers, ${stats.buyers} buyers, ${stats.products} products, ${stats.stores} stores.`,
    productTools: 'Product tools: list products, add products, update stock.',
    storeTools: 'Store tools: list stores, add stores, search stores.',
    marketingTools: 'Marketing tools: review or generate marketing materials.',
    analyticsTools: 'Analytics tools: view products, stores, and conversation stats.',
    helpOptions: 'Try "list products", "add product", "list stores", or "show stats".',
    dashboardMissing: 'Unable to open the dashboard right now.',
    dashboardLink: (url: string) => `Open your dashboard: ${url}`,
    listHeader: (label: string) => `${label}:`,
  },
} as const;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GENERATIVE_LANGUAGE_API_KEY ||
  '';
const VOICE_SUMMARY_MODEL =
  process.env.GEMINI_VOICE_MODEL || process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash-lite';

const detectLanguage = (message: string, locale?: string): Language => {
  if (locale === 'zh-TW') return 'zh-TW';
  if (locale && locale.toLowerCase().startsWith('zh')) return 'zh-TW';
  const hasCJK = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(message);
  return hasCJK ? 'zh-TW' : 'en';
};

const normaliseLimit = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && value > 0) {
    return Math.min(Math.max(Math.floor(value), 1), 10);
  }
  return fallback;
};

const formatProductLine = (product: { name?: string; price?: number; unit?: string; stock?: number }, index: number) => {
  const pricePart = product.price != null ? `${product.price}${product.unit ? `/${product.unit}` : ''}` : '-';
  const stockPart = product.stock != null ? `${product.stock}` : '-';
  return `${index + 1}. ${product.name || 'N/A'} (${pricePart}, stock ${stockPart})`;
};

const formatStoreLine = (store: { name?: string; type?: string; location?: string }, index: number) => {
  const typePart = store.type ? `, ${store.type}` : '';
  const locPart = store.location ? `, ${store.location}` : '';
  return `${index + 1}. ${store.name || 'N/A'}${typePart}${locPart}`;
};

const lineMessagesToVoice = (messages: LineMessage[]): VoiceAssistantMessage[] => {
  return messages.map((message) => {
    if (message.type === 'text') {
      const text = typeof message.text === 'string' && message.text.trim()
        ? message.text.trim()
        : 'Here is the update.';
      return { role: 'assistant', text };
    }
    if (message.type === 'flex') {
      const text = typeof message.altText === 'string' && message.altText.trim()
        ? message.altText.trim()
        : 'Here is the information.';
      return { role: 'assistant', text };
    }
    return { role: 'assistant', text: 'Here is the update.' };
  });
};

const summarizeToolMessages = (messages: VoiceAssistantMessage[]): string => {
  return messages
    .map((message) => message.text)
    .filter(Boolean)
    .join('\n')
    .slice(0, 1600);
};

const generateVoiceSummary = async ({
  userMessage,
  toolSummary,
  lang,
}: {
  userMessage: string;
  toolSummary: string;
  lang: Language;
}): Promise<string | null> => {
  if (!GEMINI_API_KEY) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const languageInstruction =
      lang === 'zh-TW' ? '使用繁體中文回覆。' : 'Respond in English.';
    const prompt = [
      `User asked: ${userMessage}`,
      `Tool result: ${toolSummary}`,
      'Provide a short spoken response that explains the result and the next step.',
      'Keep it under 2 sentences. Avoid bullet points and JSON.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: VOICE_SUMMARY_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: {
          role: 'system',
          parts: [{ text: `You are a concise voice assistant. ${languageInstruction}` }],
        },
      },
    });

    const text = response.text?.trim();
    return text || null;
  } catch {
    return null;
  }
};

const buildFallbackVoiceSummary = (toolSummary: string, lang: Language): string | null => {
  const firstLine = toolSummary.split('\n').find((line) => line.trim());
  if (!firstLine) return null;
  return lang === 'zh-TW'
    ? `已完成，結果是：${firstLine}。接下來要做什麼？`
    : `Done. Here is the result: ${firstLine}. What would you like next?`;
};

const buildDashboardUrl = (userId: string, role?: 'farmer' | 'market', displayName?: string, pictureUrl?: string) => {
  const base = runtimeConfig.liffUrl || runtimeConfig.frontendBaseUrl || process.env.FRONTEND_BASE_URL || '';
  if (!base) return '';
  const trimmed = base.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('tab', 'dashboard');
  params.set('role', role || 'farmer');
  params.set('userId', userId);
  if (displayName) params.set('displayName', displayName);
  if (pictureUrl) params.set('pictureUrl', pictureUrl);
  return `${trimmed}?${params.toString()}`;
};

export async function executeVoiceFunction(
  call: { name: string; args?: Record<string, unknown> },
  userId: string,
  lang: Language,
  userProfile?: { displayName?: string; role?: 'farmer' | 'market'; pictureUrl?: string }
): Promise<VoiceAssistantMessage[]> {
  const copy = COPY[lang];

  switch (call.name) {
    case 'show_product_tools':
      return [{ role: 'assistant', text: copy.productTools }];
    case 'show_store_tools':
      return [{ role: 'assistant', text: copy.storeTools }];
    case 'show_marketing_tools':
      return [{ role: 'assistant', text: copy.marketingTools }];
    case 'show_analytics_tools':
      return [{ role: 'assistant', text: copy.analyticsTools }];
    case 'show_help_options':
      return [{ role: 'assistant', text: copy.helpOptions }];
    case 'open_dashboard': {
      const url = buildDashboardUrl(userId, userProfile?.role, userProfile?.displayName, userProfile?.pictureUrl);
      return [{ role: 'assistant', text: url ? copy.dashboardLink(url) : copy.dashboardMissing }];
    }
    case 'product_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const products = await DatabaseService.getProductsByUser(userId);
      const slice = products.slice(0, limit);
      if (!slice.length) {
        return [{ role: 'assistant', text: copy.productListEmpty }];
      }
      const lines = slice.map(formatProductLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '產品清單' : 'Products')}\n${lines}` }];
    }
    case 'store_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const stores = await DatabaseService.getStoresByUser(userId);
      const slice = stores.slice(0, limit);
      if (!slice.length) {
        return [{ role: 'assistant', text: copy.storeListEmpty }];
      }
      const lines = slice.map(formatStoreLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '店家清單' : 'Stores')}\n${lines}` }];
    }
    case 'marketing_material_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const materials = await DatabaseService.getMarketingMaterialsByUser(userId);
      const slice = materials.slice(0, limit);
      if (!slice.length) {
        return [{ role: 'assistant', text: copy.marketingListEmpty }];
      }
      const lines = slice.map((item, index) => `${index + 1}. ${item.title || item.type}`).join('\n');
      return [
        {
          role: 'assistant',
          text: `${copy.listHeader(lang === 'zh-TW' ? '行銷素材' : 'Marketing materials')}\n${lines}`,
        },
      ];
    }
    case 'analytics_get_user_stats': {
      const stats = await DatabaseService.getUserStats(userId);
      return [{ role: 'assistant', text: copy.statsSummary(stats) }];
    }
    case 'user_set_role': {
      const role = String(call.args?.role || '').trim();
      if (role === 'farmer' || role === 'market') {
        await DatabaseService.updateLineUserRole(userId, role);
        return [{ role: 'assistant', text: role === 'farmer' ? copy.roleSetFarmer : copy.roleSetMarket }];
      }
      return [{ role: 'assistant', text: copy.helpOptions }];
    }
    case 'product_create': {
      const name = typeof call.args?.name === 'string' ? call.args?.name.trim() : '';
      const price = typeof call.args?.price === 'number' ? call.args.price : undefined;
      const unit = typeof call.args?.unit === 'string' ? call.args.unit.trim() : '';
      const stock = typeof call.args?.stock === 'number' ? call.args.stock : undefined;
      const missing: string[] = [];
      if (!name) missing.push(lang === 'zh-TW' ? '名稱' : 'name');
      if (!(typeof price === 'number' && price > 0)) missing.push(lang === 'zh-TW' ? '價格' : 'price');
      if (!unit) missing.push(lang === 'zh-TW' ? '單位' : 'unit');
      if (!(typeof stock === 'number' && stock >= 0)) missing.push(lang === 'zh-TW' ? '庫存' : 'stock');
    if (missing.length) {
      return [{ role: 'assistant', text: copy.missingProductFields(missing) }];
    }
    const ensuredPrice = price as number;
    const ensuredStock = stock as number;
    const description = typeof call.args?.description === 'string' ? call.args.description : '';
    const category = typeof call.args?.category === 'string' ? call.args.category : 'general';
    const tags = Array.isArray(call.args?.tags) ? (call.args?.tags as unknown[]).filter((t) => typeof t === 'string') as string[] : [];
    const imageUrl = typeof call.args?.imageUrl === 'string' ? call.args.imageUrl : undefined;
    const fallbackUrl = imageUrl || `https://dummyimage.com/1200x800/1DB446/ffffff.jpg&text=${encodeURIComponent((name || category || 'Farm2Market Product').slice(0, 40))}`;
    await DatabaseService.createProduct(userId, {
      name,
      price: ensuredPrice,
      unit,
      stock: ensuredStock,
      description,
      category,
      tags,
      images: fallbackUrl ? [fallbackUrl] : [],
    });
    return [{ role: 'assistant', text: copy.productCreated(name, ensuredPrice, unit, ensuredStock) }];
    }
    case 'store_create': {
      const name = typeof call.args?.name === 'string' ? call.args.name.trim() : '';
      if (!name) {
        return [{ role: 'assistant', text: copy.missingStoreName }];
      }
      const type = typeof call.args?.type === 'string' ? call.args.type : 'other';
      const location = typeof call.args?.location === 'string' ? call.args.location : '';
      await DatabaseService.createStore(userId, { name, type, location });
      return [{ role: 'assistant', text: copy.storeCreated(name, type, location) }];
    }
    case 'product_browse_public': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const list = await DatabaseService.getAllProducts(limit);
      if (!list.length) return [{ role: 'assistant', text: copy.searchEmpty }];
      const lines = list.map(formatProductLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '公開產品' : 'Public products')}\n${lines}` }];
    }
    case 'product_search_public': {
      const args = call.args || {};
      const list = await DatabaseService.searchProductsPublic({
        nameContains: typeof args.nameContains === 'string' ? args.nameContains : undefined,
        categoryEquals: typeof args.categoryEquals === 'string' ? args.categoryEquals : undefined,
        tagsAny: Array.isArray(args.tagsAny) ? (args.tagsAny as string[]).filter((t) => typeof t === 'string') : undefined,
        minPrice: typeof args.minPrice === 'number' ? args.minPrice : undefined,
        maxPrice: typeof args.maxPrice === 'number' ? args.maxPrice : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });
      if (!list.length) return [{ role: 'assistant', text: copy.searchEmpty }];
      const lines = list.map(formatProductLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '搜尋結果' : 'Search results')}\n${lines}` }];
    }
    case 'store_browse_public': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const list = await DatabaseService.getAllStores(limit);
      if (!list.length) return [{ role: 'assistant', text: copy.searchEmpty }];
      const lines = list.map(formatStoreLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '公開店家' : 'Public stores')}\n${lines}` }];
    }
    case 'store_search_public': {
      const args = call.args || {};
      const list = await DatabaseService.searchStoresPublic({
        nameContains: typeof args.nameContains === 'string' ? args.nameContains : undefined,
        typeEquals: typeof args.typeEquals === 'string' ? args.typeEquals : undefined,
        locationContains: typeof args.locationContains === 'string' ? args.locationContains : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });
      if (!list.length) return [{ role: 'assistant', text: copy.searchEmpty }];
      const lines = list.map(formatStoreLine).join('\n');
      return [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '搜尋結果' : 'Search results')}\n${lines}` }];
    }
    case 'marketplace_get_stats': {
      const stats = await DatabaseService.getMarketplaceStats();
      return [{ role: 'assistant', text: copy.marketplaceStats(stats) }];
    }
    default:
      return [{ role: 'assistant', text: copy.fallback }];
  }
}

export async function executeVoiceAssistantToolCall({
  call,
  userId,
  locale,
}: {
  call: { name: string; args?: Record<string, unknown> };
  userId: string;
  locale?: string;
}): Promise<VoiceAssistantMessage[]> {
  const lang = detectLanguage('', locale);
  let userProfile: { displayName?: string; role?: 'farmer' | 'market'; pictureUrl?: string } | undefined;
  try {
    const profile = await DatabaseService.getLineUser(userId);
    if (profile) {
      userProfile = { displayName: profile.displayName, role: profile.role, pictureUrl: profile.pictureUrl };
    }
  } catch {
    userProfile = undefined;
  }
  return executeVoiceFunction(call, userId, lang, userProfile);
}

export async function handleVoiceAssistantMessage({
  message,
  userId,
  locale,
  pageContext,
  pageRoute,
}: {
  message: string;
  userId: string;
  locale?: string;
  pageContext?: string;
  pageRoute?: string;
}): Promise<VoiceAssistantResponse> {
  const trimmed = message.trim();
  const lang = detectLanguage(trimmed, locale);
  const copy = COPY[lang];

  if (!trimmed) {
    return { messages: [{ role: 'assistant', text: copy.fallback }] };
  }

  let history;
  try {
    history = await ConversationStore.getRecentTurns(userId);
  } catch {
    history = undefined;
  }

  let userProfile: { displayName?: string; role?: 'farmer' | 'market'; pictureUrl?: string } | undefined;
  try {
    const profile = await DatabaseService.getLineUser(userId);
    if (profile) {
      userProfile = { displayName: profile.displayName, role: profile.role, pictureUrl: profile.pictureUrl };
    }
  } catch {
    userProfile = undefined;
  }

  const plan = await generateConversationPlan({
    message: trimmed,
    history,
    user: { displayName: userProfile?.displayName, role: userProfile?.role, locale: lang },
    sessionUserId: userId,
    context: pageContext || pageRoute ? { pageContext, pageRoute } : undefined,
  });

  const messages: VoiceAssistantMessage[] = [];

  if (plan.text) {
    messages.push({ role: 'assistant', text: plan.text });
  }

  const limitedFunctionCalls = plan.functionCalls?.length ? plan.functionCalls.slice(0, 1) : undefined;

  if (limitedFunctionCalls && limitedFunctionCalls.length) {
    const toolMessages: VoiceAssistantMessage[] = [];
    for (const call of limitedFunctionCalls) {
      const results = await executeVoiceFunction(call, userId, lang, userProfile);
      toolMessages.push(...results);
    }
    messages.push(...toolMessages);

    const toolSummary = summarizeToolMessages(toolMessages);
    if (toolSummary) {
      const voiceSummary = await generateVoiceSummary({
        userMessage: trimmed,
        toolSummary,
        lang,
      });
      const finalSummary = voiceSummary || buildFallbackVoiceSummary(toolSummary, lang);
      if (finalSummary) {
        messages.push({ role: 'assistant', text: finalSummary });
      }
    }
  } else if (!plan.text && plan.lineMessages && plan.lineMessages.length) {
    messages.push(...lineMessagesToVoice(plan.lineMessages));
  }

  if (!messages.length) {
    messages.push({ role: 'assistant', text: copy.fallback });
  }

  try {
    const assistantTurns = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => ({ role: 'assistant' as const, text: m.text }));
    await ConversationStore.appendTurns(userId, [
      { role: 'user', text: trimmed },
      ...assistantTurns,
    ]);
  } catch {
    // ignore persistence failures for voice
  }

  return { messages };
}
