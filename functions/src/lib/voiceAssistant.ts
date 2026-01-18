import runtimeConfig from './runtimeConfig';
import { ConversationStore } from './conversationStore';
import { DatabaseService, type ProductRecord, type StoreRecord } from './database-server';
import { generateConversationPlan } from './gemini-client';
import type { LineMessage } from '../api/lineBot';
import { GoogleGenAI } from '@google/genai';

type Language = 'zh-TW' | 'en';

export type VoiceAssistantMessage = { role: 'assistant' | 'system'; text: string };

export type VoiceAssistantResponse = {
  messages: VoiceAssistantMessage[];
  functionCalls?: Array<{ name: string; args?: Record<string, unknown> }>;
  ui?: VoiceToolUi;
};

export type VoiceToolUiIcon = 'list' | 'add' | 'edit' | 'stock' | 'search' | 'spark' | 'stats';

export type VoiceToolUiItem = {
  title: string;
  description: string;
  prompt: string;
  icon: VoiceToolUiIcon;
};

export type VoiceToolUiAction = {
  label: string;
  prompt?: string;
  href?: string;
};

export type VoiceToolUiProduct = {
  id?: string;
  name: string;
  price?: number;
  unit?: string;
  stock?: number;
  category?: string;
  imageUrl?: string;
  imageCount?: number;
  description?: string;
  pickup?: {
    address?: string;
    contactName?: string;
    contactTel?: string;
    contactMobile?: string;
    postNumber?: string;
    yamatoZipCode?: string;
  };
  href?: string;
};

export type VoiceToolUiStore = {
  id?: string;
  name: string;
  type?: string;
  location?: string;
  status?: string;
  href?: string;
};

export type VoiceToolUiMarketingItem = {
  id?: string;
  title: string;
  type?: string;
  imageUrl?: string;
  href?: string;
  date?: string;
};

export type VoiceToolUiStat = {
  label: string;
  value: string | number;
  hint?: string;
};

export type VoiceToolUiEmptyState = {
  title: string;
  description: string;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiToolkit = {
  kind: 'product_tools' | 'store_tools' | 'marketing_tools' | 'analytics_tools' | 'help_options';
  title: string;
  description: string;
  items: ReadonlyArray<VoiceToolUiItem>;
  actions: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiProductList = {
  kind: 'product_list';
  title: string;
  description?: string;
  context: 'mine' | 'market';
  items: ReadonlyArray<VoiceToolUiProduct>;
  actions?: ReadonlyArray<VoiceToolUiAction>;
  emptyState?: VoiceToolUiEmptyState;
};

export type VoiceToolUiProductCreated = {
  kind: 'product_created';
  title: string;
  description?: string;
  product: VoiceToolUiProduct;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiProductUpdated = {
  kind: 'product_updated';
  title: string;
  description?: string;
  product: VoiceToolUiProduct;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiStoreList = {
  kind: 'store_list';
  title: string;
  description?: string;
  context: 'mine' | 'market';
  items: ReadonlyArray<VoiceToolUiStore>;
  actions?: ReadonlyArray<VoiceToolUiAction>;
  emptyState?: VoiceToolUiEmptyState;
};

export type VoiceToolUiStoreCreated = {
  kind: 'store_created';
  title: string;
  description?: string;
  store: VoiceToolUiStore;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiMarketingList = {
  kind: 'marketing_list';
  title: string;
  description?: string;
  items: ReadonlyArray<VoiceToolUiMarketingItem>;
  actions?: ReadonlyArray<VoiceToolUiAction>;
  emptyState?: VoiceToolUiEmptyState;
};

export type VoiceToolUiStats = {
  kind: 'stats';
  title: string;
  description?: string;
  items: ReadonlyArray<VoiceToolUiStat>;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiMarketplaceStats = {
  kind: 'marketplace_stats';
  title: string;
  description?: string;
  items: ReadonlyArray<VoiceToolUiStat>;
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUiDashboard = {
  kind: 'dashboard_link';
  title: string;
  description?: string;
  url: string;
  actionLabel: string;
};

export type VoiceToolUiRole = {
  kind: 'role_set';
  title: string;
  description?: string;
  role: 'farmer' | 'market';
  actions?: ReadonlyArray<VoiceToolUiAction>;
};

export type VoiceToolUi =
  | VoiceToolUiToolkit
  | VoiceToolUiProductList
  | VoiceToolUiProductCreated
  | VoiceToolUiProductUpdated
  | VoiceToolUiStoreList
  | VoiceToolUiStoreCreated
  | VoiceToolUiMarketingList
  | VoiceToolUiStats
  | VoiceToolUiMarketplaceStats
  | VoiceToolUiDashboard
  | VoiceToolUiRole;

export type VoiceToolResult = {
  messages: VoiceAssistantMessage[];
  ui?: VoiceToolUi;
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
    productUpdated: (name: string) => `已更新產品 ${name}。`,
    productUpdateNotFound: '找不到符合的產品，請告訴我完整名稱。',
    productUpdateMultiple: (names: string) => `找到多個符合的產品：${names}。請告訴我完整名稱。`,
    productDetailsPrompt: '要補上圖片或取貨地址嗎？你可以說「新增產品圖片 ...」、「新增取貨地址 ...」或「用店家名稱作為取貨地址」。',
    productUpdateMissing: '請告訴我想更新的內容，例如圖片網址或取貨地址，也可以直接點擊下方上傳照片/開啟相機。',
    pickupStoreNotFound: '找不到符合的店家，請告訴我完整店家名稱。',
    pickupStoreMultiple: (names: string) => `找到多個店家：${names}。請告訴我完整名稱。`,
    pickupStoreMissing: '該店家沒有可用的取貨地址。',
    storeCreated: (name: string, type?: string, location?: string) =>
      `已建立店家 ${name}${type ? `，類型 ${type}` : ''}${location ? `，地點 ${location}` : ''}。`,
    roleSetFarmer: '已將您的角色設定為賣家/農友。',
    roleSetMarket: '已將您的角色設定為市場/買家。',
    statsSummary: (stats: Record<string, number>) =>
      `目前共有產品 ${stats.products} 項、店家 ${stats.stores} 間、對話 ${stats.conversations} 則。`,
    marketplaceStats: (stats: { sellers: number; buyers: number; products: number; stores: number }) =>
      `市集統計：賣家 ${stats.sellers} 位、買家 ${stats.buyers} 位、產品 ${stats.products} 項、店家 ${stats.stores} 間。`,
    productTools: '產品管理：列出產品、新增產品、修改產品或更新庫存。',
    storeTools: '店家管理：列出店家、新增店家、搜尋店家。',
    marketingTools: '行銷工具：查看或生成行銷素材。',
    analyticsTools: '分析工具：查看統計或前往分析頁面。',
    helpOptions: '你可以說「列出產品」、「新增店家」或「查看統計」。',
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
    productUpdated: (name: string) => `Updated product ${name}.`,
    productUpdateNotFound: 'I could not find that product. Please tell me the exact name.',
    productUpdateMultiple: (names: string) => `I found multiple products: ${names}. Which one should I update?`,
    productDetailsPrompt: 'Want to add an image or pickup address? Say “add product image …”, “add pickup address …”, or “use store NAME as pickup.”',
    productUpdateMissing: 'Tell me what to update, like an image URL or pickup address, or use the buttons to upload or open the camera.',
    pickupStoreNotFound: 'I could not find that store. Please tell me the exact store name.',
    pickupStoreMultiple: (names: string) => `I found multiple stores: ${names}. Which one should I use?`,
    pickupStoreMissing: 'That store does not have a pickup address yet.',
    storeCreated: (name: string, type?: string, location?: string) =>
      `Created store ${name}${type ? `, type ${type}` : ''}${location ? `, location ${location}` : ''}.`,
    roleSetFarmer: 'Your role is set to farmer/seller.',
    roleSetMarket: 'Your role is set to market/buyer.',
    statsSummary: (stats: Record<string, number>) =>
      `You have ${stats.products} products, ${stats.stores} stores, and ${stats.conversations} conversations.`,
    marketplaceStats: (stats: { sellers: number; buyers: number; products: number; stores: number }) =>
      `Marketplace stats: ${stats.sellers} sellers, ${stats.buyers} buyers, ${stats.products} products, ${stats.stores} stores.`,
    productTools: 'Product tools: list products, add products, modify products, update stock.',
    storeTools: 'Store tools: list stores, add stores, search stores.',
    marketingTools: 'Marketing tools: review or generate marketing materials.',
    analyticsTools: 'Analytics tools: view stats or open analytics.',
    helpOptions: 'Try "list products", "add store", or "show stats".',
    dashboardMissing: 'Unable to open the dashboard right now.',
    dashboardLink: (url: string) => `Open your dashboard: ${url}`,
    listHeader: (label: string) => `${label}:`,
  },
} as const;

const TOOL_UI_COPY = {
  'zh-TW': {
    product: {
      title: '產品工具',
      description: '快速管理你的產品與庫存。',
      items: [
        {
          icon: 'list',
          title: '列出產品',
          description: '查看最近產品與庫存',
          prompt: '列出產品',
        },
        {
          icon: 'add',
          title: '新增產品',
          description: '建立新產品，包含價格與庫存',
          prompt: '新增產品',
        },
        {
          icon: 'edit',
          title: '修改產品',
          description: '更新價格、庫存或其他細節',
          prompt: '修改產品',
        },
        {
          icon: 'stock',
          title: '更新庫存',
          description: '告訴我產品名稱與最新庫存',
          prompt: '更新庫存',
        },
      ],
      actions: [
        { label: '列出產品', prompt: '列出產品' },
        { label: '新增產品', prompt: '新增產品' },
        { label: '修改產品', prompt: '修改產品' },
        { label: '更新庫存', prompt: '更新庫存' },
      ],
    },
    store: {
      title: '店家工具',
      description: '掌握合作店家與聯絡進度。',
      items: [
        {
          icon: 'list',
          title: '列出店家',
          description: '查看近期店家清單',
          prompt: '列出店家',
        },
        {
          icon: 'add',
          title: '新增店家',
          description: '快速建立新的店家資料',
          prompt: '新增店家',
        },
        {
          icon: 'search',
          title: '搜尋店家',
          description: '用名稱或地點搜尋',
          prompt: '搜尋店家',
        },
      ],
      actions: [
        { label: '列出店家', prompt: '列出店家' },
        { label: '新增店家', prompt: '新增店家' },
        { label: '搜尋店家', prompt: '搜尋店家' },
      ],
    },
    marketing: {
      title: '行銷工具',
      description: '整理素材或產出新的文案。',
      items: [
        {
          icon: 'list',
          title: '查看素材',
          description: '快速瀏覽行銷素材',
          prompt: '列出行銷素材',
        },
        {
          icon: 'spark',
          title: '生成文案',
          description: '用產品資訊生成貼文',
          prompt: '幫我生成行銷文案',
        },
        {
          icon: 'spark',
          title: '生成圖片',
          description: '為產品產出行銷圖片',
          prompt: '幫我生成行銷圖片',
        },
      ],
      actions: [
        { label: '查看素材', prompt: '列出行銷素材' },
        { label: '生成文案', prompt: '幫我生成行銷文案' },
        { label: '生成圖片', prompt: '幫我生成行銷圖片' },
      ],
    },
    analytics: {
      title: '營運分析',
      description: '掌握營運數據與分析報表。',
      items: [
        {
          icon: 'stats',
          title: '查看統計',
          description: '產品、店家與對話總覽',
          prompt: '查看統計',
        },
        {
          icon: 'stats',
          title: '開啟分析',
          description: '打開分析頁面',
          prompt: '開啟分析',
        },
      ],
      actions: [
        { label: '查看統計', prompt: '查看統計' },
        { label: '開啟分析', prompt: '開啟分析' },
      ],
    },
    help: {
      title: '快速指令',
      description: '你可以用這些語句快速開始。',
      items: [
        {
          icon: 'list',
          title: '列出產品',
          description: '查看商品與庫存',
          prompt: '列出產品',
        },
        {
          icon: 'add',
          title: '新增店家',
          description: '建立新的店家資料',
          prompt: '新增店家',
        },
        {
          icon: 'stats',
          title: '查看統計',
          description: '掌握營運數據',
          prompt: '查看統計',
        },
      ],
      actions: [
        { label: '列出產品', prompt: '列出產品' },
        { label: '新增店家', prompt: '新增店家' },
        { label: '查看統計', prompt: '查看統計' },
      ],
    },
  },
  en: {
    product: {
      title: 'Product tools',
      description: 'Quick actions to manage your inventory.',
      items: [
        {
          icon: 'list',
          title: 'List products',
          description: 'See your latest items and stock',
          prompt: 'List products',
        },
        {
          icon: 'add',
          title: 'Add product',
          description: 'Create a new product with price and stock',
          prompt: 'Add product',
        },
        {
          icon: 'edit',
          title: 'Modify product',
          description: 'Change price, stock, or details',
          prompt: 'Modify product',
        },
        {
          icon: 'stock',
          title: 'Update stock',
          description: 'Tell me the product name and new stock',
          prompt: 'Update stock',
        },
      ],
      actions: [
        { label: 'List products', prompt: 'List products' },
        { label: 'Add product', prompt: 'Add product' },
        { label: 'Modify product', prompt: 'Modify product' },
        { label: 'Update stock', prompt: 'Update stock' },
      ],
    },
    store: {
      title: 'Store tools',
      description: 'Track your store relationships.',
      items: [
        {
          icon: 'list',
          title: 'List stores',
          description: 'See your recent stores',
          prompt: 'List stores',
        },
        {
          icon: 'add',
          title: 'Add store',
          description: 'Create a new store record',
          prompt: 'Add store',
        },
        {
          icon: 'search',
          title: 'Search stores',
          description: 'Search by name or location',
          prompt: 'Search stores',
        },
      ],
      actions: [
        { label: 'List stores', prompt: 'List stores' },
        { label: 'Add store', prompt: 'Add store' },
        { label: 'Search stores', prompt: 'Search stores' },
      ],
    },
    marketing: {
      title: 'Marketing tools',
      description: 'Review materials or generate new copy.',
      items: [
        {
          icon: 'list',
          title: 'View materials',
          description: 'Browse existing assets',
          prompt: 'List marketing materials',
        },
        {
          icon: 'spark',
          title: 'Generate copy',
          description: 'Create a post for a product',
          prompt: 'Generate marketing copy',
        },
        {
          icon: 'spark',
          title: 'Generate image',
          description: 'Create a marketing image',
          prompt: 'Generate marketing image',
        },
      ],
      actions: [
        { label: 'View materials', prompt: 'List marketing materials' },
        { label: 'Generate copy', prompt: 'Generate marketing copy' },
        { label: 'Generate image', prompt: 'Generate marketing image' },
      ],
    },
    analytics: {
      title: 'Analytics',
      description: 'Monitor performance and trends.',
      items: [
        {
          icon: 'stats',
          title: 'View stats',
          description: 'Products, stores, conversations',
          prompt: 'Show stats',
        },
        {
          icon: 'stats',
          title: 'Open analytics',
          description: 'Open the analytics dashboard',
          prompt: 'Open analytics',
        },
      ],
      actions: [
        { label: 'View stats', prompt: 'Show stats' },
        { label: 'Open analytics', prompt: 'Open analytics' },
      ],
    },
    help: {
      title: 'Quick commands',
      description: 'Try these to get started.',
      items: [
        {
          icon: 'list',
          title: 'List products',
          description: 'See items and stock',
          prompt: 'List products',
        },
        {
          icon: 'add',
          title: 'Add store',
          description: 'Create a new store record',
          prompt: 'Add store',
        },
        {
          icon: 'stats',
          title: 'Show stats',
          description: 'View your activity summary',
          prompt: 'Show stats',
        },
      ],
      actions: [
        { label: 'List products', prompt: 'List products' },
        { label: 'Add store', prompt: 'Add store' },
        { label: 'Show stats', prompt: 'Show stats' },
      ],
    },
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

const formatMarketingDate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const maybeDate = (value as { toDate?: () => Date }).toDate?.();
  if (maybeDate instanceof Date) return maybeDate.toISOString().slice(0, 10);
  return undefined;
};

const summarizeProductFilters = (args: Record<string, unknown>, lang: Language): string | undefined => {
  const isTraditional = lang === 'zh-TW';
  const parts: string[] = [];
  const nameContains = typeof args.nameContains === 'string' ? args.nameContains.trim() : '';
  if (nameContains) parts.push(isTraditional ? `關鍵字：${nameContains}` : `Keyword: ${nameContains}`);
  const categoryEquals = typeof args.categoryEquals === 'string' ? args.categoryEquals.trim() : '';
  if (categoryEquals) parts.push(isTraditional ? `分類：${categoryEquals}` : `Category: ${categoryEquals}`);
  const tagsAny = Array.isArray(args.tagsAny)
    ? (args.tagsAny as unknown[]).filter((tag) => typeof tag === 'string' && tag.trim()) as string[]
    : [];
  if (tagsAny.length) parts.push(isTraditional ? `標籤：${tagsAny.join(', ')}` : `Tags: ${tagsAny.join(', ')}`);
  const minPrice = typeof args.minPrice === 'number' ? args.minPrice : undefined;
  const maxPrice = typeof args.maxPrice === 'number' ? args.maxPrice : undefined;
  if (minPrice != null || maxPrice != null) {
    const range =
      minPrice != null && maxPrice != null
        ? `${minPrice}-${maxPrice}`
        : minPrice != null
        ? `>=${minPrice}`
        : `<=${maxPrice}`;
    parts.push(isTraditional ? `價格：${range}` : `Price: ${range}`);
  }
  return parts.length ? parts.join(' · ') : undefined;
};

const summarizeStoreFilters = (args: Record<string, unknown>, lang: Language): string | undefined => {
  const isTraditional = lang === 'zh-TW';
  const parts: string[] = [];
  const nameContains = typeof args.nameContains === 'string' ? args.nameContains.trim() : '';
  if (nameContains) parts.push(isTraditional ? `名稱：${nameContains}` : `Name: ${nameContains}`);
  const typeEquals = typeof args.typeEquals === 'string' ? args.typeEquals.trim() : '';
  if (typeEquals) parts.push(isTraditional ? `類型：${typeEquals}` : `Type: ${typeEquals}`);
  const locationContains = typeof args.locationContains === 'string' ? args.locationContains.trim() : '';
  if (locationContains) parts.push(isTraditional ? `地點：${locationContains}` : `Location: ${locationContains}`);
  return parts.length ? parts.join(' · ') : undefined;
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const parsePickupArgs = (args: Record<string, unknown>) => {
  const pickupArg = typeof args.pickup === 'object' && args.pickup ? (args.pickup as Record<string, unknown>) : {};
  const address =
    normalizeString(args.pickupAddress) || normalizeString(pickupArg.address) || normalizeString(args.address);
  const contactName = normalizeString(args.pickupContactName) || normalizeString(pickupArg.contactName);
  const contactTel = normalizeString(args.pickupContactTel) || normalizeString(pickupArg.contactTel);
  const contactMobile = normalizeString(args.pickupContactMobile) || normalizeString(pickupArg.contactMobile);
  const postNumber = normalizeString(args.pickupPostNumber) || normalizeString(pickupArg.postNumber);
  const yamatoZipCode = normalizeString(args.pickupYamatoZipCode) || normalizeString(pickupArg.yamatoZipCode);

  const pickup: ProductRecord['pickup'] = {};
  if (address) pickup.address = address;
  if (contactName) pickup.contactName = contactName;
  if (contactTel) pickup.contactTel = contactTel;
  if (contactMobile) pickup.contactMobile = contactMobile;
  if (postNumber) pickup.postNumber = postNumber;
  if (yamatoZipCode) pickup.yamatoZipCode = yamatoZipCode;

  return Object.keys(pickup).length ? pickup : undefined;
};

const parseImageUrls = (args: Record<string, unknown>): string[] => {
  const urls: string[] = [];
  const imageUrl = normalizeString(args.imageUrl);
  if (imageUrl) urls.push(imageUrl);
  const imageUrls = Array.isArray(args.imageUrls)
    ? (args.imageUrls as unknown[]).filter((url) => typeof url === 'string' && url.trim()) as string[]
    : [];
  if (imageUrls.length) urls.push(...imageUrls);
  const images = Array.isArray(args.images)
    ? (args.images as unknown[]).filter((url) => typeof url === 'string' && url.trim()) as string[]
    : [];
  if (images.length) urls.push(...images);
  return Array.from(new Set(urls));
};

const formatNameList = (names: string[], lang: Language) => {
  const clean = names.filter(Boolean);
  if (!clean.length) return '';
  return clean.join(lang === 'zh-TW' ? '、' : ', ');
};

const buildPickupFromStore = (store: StoreRecord): ProductRecord['pickup'] | undefined => {
  const pickup: ProductRecord['pickup'] = {};
  const base = store.pickup || {};
  const address = base.address || store.location;
  if (address) pickup.address = address;
  if (base.yamatoZipCode) pickup.yamatoZipCode = base.yamatoZipCode;
  if (base.contactName) pickup.contactName = base.contactName;
  if (base.contactTel) pickup.contactTel = base.contactTel;
  if (base.contactMobile) pickup.contactMobile = base.contactMobile;
  if (base.postNumber) pickup.postNumber = base.postNumber;
  if (base.verifiedAt) pickup.verifiedAt = base.verifiedAt;
  return Object.keys(pickup).length ? pickup : undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const isVoiceQuestion = (message: string, lang: Language): boolean => {
  if (message.includes('?')) return true;
  if (lang === 'zh-TW') {
    return /(如何|怎麼|怎樣|可以|能不能|能否|嗎|要怎麼)/.test(message);
  }
  return /\b(how|what|why|where|when|can i|could i|should i)\b/i.test(message);
};

const hasExplicitProductUpdateDetails = (message: string, lang: Language): boolean => {
  if (/https?:\/\/\S+/i.test(message)) return true;
  if (/\d/.test(message)) return true;
  if (lang === 'zh-TW') {
    return /(價格|庫存|單位|分類|描述|地址|取貨|聯絡|電話|手機|郵遞區號|黑貓)/.test(message);
  }
  return /\b(price|stock|unit|category|description|address|pickup|contact|phone|mobile|zip|zipcode)\b/i.test(message);
};

const hasMarketingKeyword = (message: string, lang: Language): boolean => {
  if (lang === 'zh-TW') {
    return /(行銷|宣傳|素材|文案|海報|廣告)/.test(message);
  }
  return /\b(marketing|promo|promotional|copy|flyer|poster|ad)\b/i.test(message);
};

const isImageUpdateIntent = (message: string, lang: Language): boolean => {
  if (hasMarketingKeyword(message, lang)) return false;
  if (lang === 'zh-TW') {
    const hasImage = /(圖片|照片|相片|影像|相機)/.test(message);
    if (!hasImage) return false;
    return /(新增|上傳|加入|補上|更換|替換|修改|編輯|更新|開啟)/.test(message);
  }
  const hasImage = /\b(image|photo|picture|camera)\b/i.test(message);
  if (!hasImage) return false;
  return /\b(add|upload|change|replace|update|edit|modify|use|take|capture)\b/i.test(message);
};

const extractProductName = (message: string, lang: Language): string => {
  if (lang === 'zh-TW') {
    const match =
      message.match(/(?:產品|商品)\s*([^\s]+(?:\s+[^\s]+)*)/);
    const fromMatch = match?.[1]?.trim();
    if (fromMatch) {
      return fromMatch
        .replace(/(圖片|照片|相片|影像|相機).*/, '')
        .trim();
    }
    return message
      .replace(/(請|想|我要|幫我|麻煩|可以|可否|幫忙)/g, '')
      .replace(/(修改|編輯|更新|新增|上傳|補上|加入|更換|替換|開啟)/g, '')
      .replace(/(產品|商品|圖片|照片|相片|影像|相機)/g, '')
      .replace(/(給|的|一下|一下喔|一下吧)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const match =
    message.match(/(?:product|item)\s+(.+)/i) ||
    message.match(/(?:for|to)\s+(.+)/i);
  const fromMatch = match?.[1]?.trim();
  if (fromMatch) {
    return fromMatch
      .replace(/\b(image|photo|picture|camera)\b.*$/i, '')
      .trim();
  }
  return message
    .replace(/\b(please|can you|could you|i want to|i wanna|help me)\b/ig, '')
    .replace(/\b(add|upload|change|replace|update|edit|modify|set|use|take|capture)\b/ig, '')
    .replace(/\b(image|photo|picture|camera|product|item)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const inferProductUpdateFromVoice = (message: string, lang: Language): { name: string; args?: Record<string, unknown> } | null => {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (isVoiceQuestion(trimmed, lang)) return null;
  const imageIntent = isImageUpdateIntent(trimmed, lang);
  if (!imageIntent && hasExplicitProductUpdateDetails(trimmed, lang)) return null;

  if (lang === 'zh-TW') {
    if (!imageIntent && !/(修改|編輯|更新)/.test(trimmed)) return null;
    const name = extractProductName(trimmed, lang);
    return { name: 'product_update', args: name ? { productName: name } : {} };
  }

  const lower = trimmed.toLowerCase();
  if (!imageIntent && !/\b(modify|edit|update)\b/.test(lower)) return null;
  const name = extractProductName(trimmed, lang);
  return { name: 'product_update', args: name ? { productName: name } : {} };
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

const buildProductEditLink = (
  productId: string,
  options?: { step?: 'pickup' | 'images' | number; media?: 'upload' | 'camera'; enhance?: boolean }
) => {
  const params = new URLSearchParams();
  params.set('action', 'edit');
  params.set('product', productId);
  if (options?.step !== undefined) params.set('step', String(options.step));
  if (options?.media) params.set('media', options.media);
  if (options?.enhance) params.set('enhance', '1');
  return `/farmer/products?${params.toString()}`;
};

export async function executeVoiceFunction(
  call: { name: string; args?: Record<string, unknown> },
  userId: string,
  lang: Language,
  userProfile?: { displayName?: string; role?: 'farmer' | 'market'; pictureUrl?: string }
): Promise<VoiceToolResult> {
  const copy = COPY[lang];
  const isTraditional = lang === 'zh-TW';
  const buildResult = (messages: VoiceAssistantMessage[], ui?: VoiceToolUi): VoiceToolResult => ({
    messages,
    ui,
  });
  const productCatalogUrl = userProfile?.role === 'market' ? '/market/products' : '/farmer/products';
  const storeListUrl = userProfile?.role === 'market' ? '/market/farms' : '/farmer/stores';
  const analyticsUrl = userProfile?.role === 'market' ? '/market/ratings' : '/farmer/analytics';
  const marketingUrl = '/farmer/marketing';

  switch (call.name) {
    case 'show_product_tools':
      return buildResult(
        [{ role: 'assistant', text: copy.productTools }],
        {
          kind: 'product_tools',
          title: TOOL_UI_COPY[lang].product.title,
          description: TOOL_UI_COPY[lang].product.description,
          items: TOOL_UI_COPY[lang].product.items,
          actions: TOOL_UI_COPY[lang].product.actions,
        }
      );
    case 'show_store_tools':
      return buildResult(
        [{ role: 'assistant', text: copy.storeTools }],
        {
          kind: 'store_tools',
          title: TOOL_UI_COPY[lang].store.title,
          description: TOOL_UI_COPY[lang].store.description,
          items: TOOL_UI_COPY[lang].store.items,
          actions: TOOL_UI_COPY[lang].store.actions,
        }
      );
    case 'show_marketing_tools':
      return buildResult(
        [{ role: 'assistant', text: copy.marketingTools }],
        {
          kind: 'marketing_tools',
          title: TOOL_UI_COPY[lang].marketing.title,
          description: TOOL_UI_COPY[lang].marketing.description,
          items: TOOL_UI_COPY[lang].marketing.items,
          actions: TOOL_UI_COPY[lang].marketing.actions,
        }
      );
    case 'show_analytics_tools':
      return buildResult(
        [{ role: 'assistant', text: copy.analyticsTools }],
        {
          kind: 'analytics_tools',
          title: TOOL_UI_COPY[lang].analytics.title,
          description: TOOL_UI_COPY[lang].analytics.description,
          items: TOOL_UI_COPY[lang].analytics.items,
          actions: [
            { label: isTraditional ? '查看統計' : 'View stats', prompt: isTraditional ? '查看統計' : 'Show stats' },
            { label: isTraditional ? '開啟分析' : 'Open analytics', href: analyticsUrl },
          ],
        }
      );
    case 'show_help_options':
      return buildResult(
        [{ role: 'assistant', text: copy.helpOptions }],
        {
          kind: 'help_options',
          title: TOOL_UI_COPY[lang].help.title,
          description: TOOL_UI_COPY[lang].help.description,
          items: TOOL_UI_COPY[lang].help.items,
          actions: TOOL_UI_COPY[lang].help.actions,
        }
      );
    case 'open_dashboard': {
      const url = buildDashboardUrl(userId, userProfile?.role, userProfile?.displayName, userProfile?.pictureUrl);
      return buildResult(
        [{ role: 'assistant', text: url ? copy.dashboardLink(url) : copy.dashboardMissing }],
        url
          ? {
              kind: 'dashboard_link',
              title: isTraditional ? '控制台' : 'Dashboard',
              description: isTraditional ? '開啟完整控制台檢視資料。' : 'Open your full dashboard view.',
              url,
              actionLabel: isTraditional ? '開啟控制台' : 'Open dashboard',
            }
          : undefined
      );
    }
    case 'product_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const products = await DatabaseService.getProductsByUser(userId);
      const slice = products.slice(0, limit);
      if (!slice.length) {
        return buildResult(
          [{ role: 'assistant', text: copy.productListEmpty }],
          {
            kind: 'product_list',
            title: isTraditional ? '產品清單' : 'Products',
            description: isTraditional ? '目前沒有任何產品。' : 'No products yet.',
            context: 'mine',
            items: [],
            emptyState: {
              title: isTraditional ? '還沒有產品' : 'No products yet',
              description: isTraditional ? '可以先新增第一個產品。' : 'Create your first product to get started.',
              actions: [
                { label: isTraditional ? '新增產品' : 'Add product', prompt: isTraditional ? '新增產品' : 'Add product' },
              ],
            },
            actions: [
              { label: isTraditional ? '新增產品' : 'Add product', prompt: isTraditional ? '新增產品' : 'Add product' },
            ],
          }
        );
      }
      const lines = slice.map(formatProductLine).join('\n');
      const uiItems: VoiceToolUiProduct[] = slice.map((product) => ({
        id: product.id,
        name: product.name || '',
        price: product.price,
        unit: product.unit,
        stock: product.stock,
        category: product.category,
        imageUrl: product.images?.[0],
        href: product.id
          ? userProfile?.role === 'market'
            ? `/market/products?product=${product.id}`
            : buildProductEditLink(product.id)
          : productCatalogUrl,
      }));
      return buildResult(
        [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '產品清單' : 'Products')}\n${lines}` }],
        {
          kind: 'product_list',
          title: isTraditional ? '產品清單' : 'Products',
          description: isTraditional ? '最新產品與庫存概況。' : 'Latest products and inventory.',
          context: 'mine',
          items: uiItems,
          actions: [
            { label: isTraditional ? '查看全部產品' : 'View all products', href: productCatalogUrl },
          ],
        }
      );
    }
    case 'store_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const stores = await DatabaseService.getStoresByUser(userId);
      const slice = stores.slice(0, limit);
      if (!slice.length) {
        return buildResult(
          [{ role: 'assistant', text: copy.storeListEmpty }],
          {
            kind: 'store_list',
            title: isTraditional ? '店家清單' : 'Stores',
            description: isTraditional ? '目前沒有任何店家。' : 'No stores yet.',
            context: 'mine',
            items: [],
            emptyState: {
              title: isTraditional ? '尚未建立店家' : 'No stores yet',
              description: isTraditional ? '新增第一間合作店家。' : 'Add your first store to start tracking outreach.',
              actions: [
                { label: isTraditional ? '新增店家' : 'Add store', prompt: isTraditional ? '新增店家' : 'Add store' },
              ],
            },
            actions: [
              { label: isTraditional ? '新增店家' : 'Add store', prompt: isTraditional ? '新增店家' : 'Add store' },
            ],
          }
        );
      }
      const lines = slice.map(formatStoreLine).join('\n');
      const uiItems: VoiceToolUiStore[] = slice.map((store) => ({
        id: store.id,
        name: store.name || '',
        type: store.type,
        location: store.location,
        status: store.status,
        href: storeListUrl,
      }));
      return buildResult(
        [{ role: 'assistant', text: `${copy.listHeader(lang === 'zh-TW' ? '店家清單' : 'Stores')}\n${lines}` }],
        {
          kind: 'store_list',
          title: isTraditional ? '店家清單' : 'Stores',
          description: isTraditional ? '近期聯絡的店家。' : 'Recent store relationships.',
          context: 'mine',
          items: uiItems,
          actions: [
            { label: isTraditional ? '查看店家' : 'View stores', href: storeListUrl },
          ],
        }
      );
    }
    case 'marketing_material_list': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const materials = await DatabaseService.getMarketingMaterialsByUser(userId);
      const slice = materials.slice(0, limit);
      if (!slice.length) {
        return buildResult(
          [{ role: 'assistant', text: copy.marketingListEmpty }],
          {
            kind: 'marketing_list',
            title: isTraditional ? '行銷素材' : 'Marketing materials',
            description: isTraditional ? '目前沒有素材。' : 'No marketing materials yet.',
            items: [],
            emptyState: {
              title: isTraditional ? '尚未有素材' : 'No materials yet',
              description: isTraditional ? '用產品資訊產出第一份素材。' : 'Generate your first marketing asset.',
              actions: [
                { label: isTraditional ? '生成文案' : 'Generate copy', prompt: isTraditional ? '幫我生成行銷文案' : 'Generate marketing copy' },
              ],
            },
            actions: [
              { label: isTraditional ? '打開行銷工具' : 'Open marketing tools', href: marketingUrl },
              { label: isTraditional ? '生成文案' : 'Generate copy', prompt: isTraditional ? '幫我生成行銷文案' : 'Generate marketing copy' },
            ],
          }
        );
      }
      const lines = slice.map((item, index) => `${index + 1}. ${item.title || item.type}`).join('\n');
      const uiItems: VoiceToolUiMarketingItem[] = slice.map((item) => ({
        id: item.id,
        title: item.title || item.type,
        type: item.type,
        imageUrl: item.imageUrl,
        date: formatMarketingDate(item.createdAt),
        href: marketingUrl,
      }));
      return buildResult(
        [
          {
            role: 'assistant',
            text: `${copy.listHeader(lang === 'zh-TW' ? '行銷素材' : 'Marketing materials')}\n${lines}`,
          },
        ],
        {
          kind: 'marketing_list',
          title: isTraditional ? '行銷素材' : 'Marketing materials',
          description: isTraditional ? '最近產出的素材。' : 'Your latest assets.',
          items: uiItems,
          actions: [
            { label: isTraditional ? '打開行銷工具' : 'Open marketing tools', href: marketingUrl },
          ],
        }
      );
    }
    case 'analytics_get_user_stats': {
      const stats = await DatabaseService.getUserStats(userId);
      return buildResult(
        [{ role: 'assistant', text: copy.statsSummary(stats) }],
        {
          kind: 'stats',
          title: isTraditional ? '你的統計' : 'Your stats',
          description: isTraditional ? '產品、店家與對話概況。' : 'Products, stores, and conversations.',
          items: [
            { label: isTraditional ? '產品' : 'Products', value: stats.products },
            { label: isTraditional ? '店家' : 'Stores', value: stats.stores },
            { label: isTraditional ? '對話' : 'Conversations', value: stats.conversations },
          ],
          actions: [
            { label: isTraditional ? '前往分析' : 'Open analytics', href: analyticsUrl },
          ],
        }
      );
    }
    case 'user_set_role': {
      const role = String(call.args?.role || '').trim();
      if (role === 'farmer' || role === 'market') {
        await DatabaseService.updateLineUserRole(userId, role);
        return buildResult(
          [{ role: 'assistant', text: role === 'farmer' ? copy.roleSetFarmer : copy.roleSetMarket }],
          {
            kind: 'role_set',
            title: isTraditional ? '角色已更新' : 'Role updated',
            description: role === 'farmer'
              ? isTraditional
                ? '已切換為賣家模式。'
                : 'Switched to farmer mode.'
              : isTraditional
                ? '已切換為市場模式。'
                : 'Switched to market mode.',
            role,
            actions: [
              { label: isTraditional ? '前往控制台' : 'Open dashboard', href: role === 'market' ? '/market' : '/farmer' },
            ],
          }
        );
      }
      return buildResult([{ role: 'assistant', text: copy.helpOptions }]);
    }
    case 'product_create': {
      const name = typeof call.args?.name === 'string' ? call.args?.name.trim() : '';
      const price = parseNumber(call.args?.price);
      const unit = typeof call.args?.unit === 'string' ? call.args.unit.trim() : '';
      const stock = parseNumber(call.args?.stock);
      const missing: string[] = [];
      if (!name) missing.push(lang === 'zh-TW' ? '名稱' : 'name');
      if (!(typeof price === 'number' && price > 0)) missing.push(lang === 'zh-TW' ? '價格' : 'price');
      if (!unit) missing.push(lang === 'zh-TW' ? '單位' : 'unit');
      if (!(typeof stock === 'number' && stock >= 0)) missing.push(lang === 'zh-TW' ? '庫存' : 'stock');
      if (missing.length) {
        return buildResult([{ role: 'assistant', text: copy.missingProductFields(missing) }]);
      }
      const ensuredPrice = price as number;
      const ensuredStock = stock as number;
      const description = typeof call.args?.description === 'string' ? call.args.description : '';
      const category = typeof call.args?.category === 'string' ? call.args.category : 'general';
      const tags = Array.isArray(call.args?.tags)
        ? ((call.args?.tags as unknown[]).filter((t) => typeof t === 'string') as string[])
        : [];
      const images = parseImageUrls(call.args || {});
      const pickup = parsePickupArgs(call.args || {});
      const created = await DatabaseService.createProduct(userId, {
        name,
        price: ensuredPrice,
        unit,
        stock: ensuredStock,
        description,
        category,
        tags,
        images,
        pickup,
      });
      const canEdit = !!created.id && userProfile?.role !== 'market';
      const productEditUrl = canEdit ? buildProductEditLink(created.id!, { step: 3 }) : undefined;
      const productEditActionUrl = canEdit ? buildProductEditLink(created.id!, { step: 3, enhance: true }) : undefined;
      const imageUploadUrl = canEdit
        ? buildProductEditLink(created.id!, { step: 3, media: 'upload', enhance: true })
        : undefined;
      const imageCameraUrl = canEdit
        ? buildProductEditLink(created.id!, { step: 3, media: 'camera', enhance: true })
        : undefined;
      const pickupUrl = canEdit ? buildProductEditLink(created.id!, { step: 'pickup' }) : undefined;
      const productDetailUrl = created.id
        ? userProfile?.role === 'market'
          ? `/market/products?product=${created.id}`
          : productEditUrl || productCatalogUrl
        : productEditUrl || productCatalogUrl;
      const productUi: VoiceToolUiProduct = {
        id: created.id,
        name,
        price: ensuredPrice,
        unit,
        stock: ensuredStock,
        category,
        imageUrl: images[0],
        imageCount: images.length,
        description,
        pickup,
        href: productEditUrl || productDetailUrl,
      };
      const imagePrompt = isTraditional ? `新增產品圖片 ${name}` : `Add product image for ${name}`;
      const pickupPrompt = isTraditional ? `新增取貨地址 ${name}` : `Add pickup address for ${name}`;
      const followUpNeeded = !images.length || !pickup?.address;
      const followUpMessages: VoiceAssistantMessage[] = followUpNeeded
        ? [{ role: 'assistant', text: copy.productDetailsPrompt }]
        : [];
      return buildResult(
        [
          { role: 'assistant', text: copy.productCreated(name, ensuredPrice, unit, ensuredStock) },
          ...followUpMessages,
        ],
        {
          kind: 'product_created',
          title: isTraditional ? '產品已建立' : 'Product created',
          description: isTraditional ? '已新增到產品清單。' : 'Added to your catalog.',
          product: productUi,
          actions: [
            ...(productEditActionUrl
              ? [{ label: isTraditional ? '完成細節' : 'Complete details', href: productEditActionUrl }]
              : [{ label: isTraditional ? '查看產品' : 'View product', href: productDetailUrl }]),
            ...(imageUploadUrl
              ? [{ label: isTraditional ? '上傳圖片' : 'Upload image', href: imageUploadUrl }]
              : [{ label: isTraditional ? '新增圖片' : 'Add image', prompt: imagePrompt }]),
            ...(imageCameraUrl
              ? [{ label: isTraditional ? '開啟相機' : 'Use camera', href: imageCameraUrl }]
              : []),
            ...(pickupUrl
              ? [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', href: pickupUrl }]
              : [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', prompt: pickupPrompt }]),
          ],
        }
      );
    }
    case 'product_update': {
      const args = call.args || {};
      const productId = normalizeString(args.productId) || normalizeString(args.id);
      const productName = normalizeString(args.productName) || normalizeString(args.name);
      const pickupStoreId = normalizeString(args.pickupStoreId) || normalizeString(args.storeId);
      const pickupStoreName =
        normalizeString(args.pickupStoreName) || normalizeString(args.storeName) || normalizeString(args.store);
      const products = await DatabaseService.getProductsByUser(userId);
      if (!products.length) {
        return buildResult([{ role: 'assistant', text: copy.productListEmpty }]);
      }

      let target = productId
        ? products.find((product) => product.id === productId)
        : undefined;

      if (!target && productName) {
        const matches = products.filter((product) =>
          (product.name || '').toLowerCase().includes(productName.toLowerCase())
        );
        if (matches.length > 1) {
          const names = formatNameList(
            matches.map((match) => match.name || '').slice(0, 5),
            lang
          );
          return buildResult([{ role: 'assistant', text: copy.productUpdateMultiple(names) }]);
        }
        target = matches[0];
        if (!target) {
          return buildResult([{ role: 'assistant', text: copy.productUpdateNotFound }]);
        }
      }

      if (!target) {
        target = products[0];
      }

      if (!target?.id) {
        return buildResult([{ role: 'assistant', text: copy.productUpdateNotFound }]);
      }

      let storePickup: ProductRecord['pickup'] | undefined;
      if (pickupStoreId || pickupStoreName) {
        const stores = await DatabaseService.getStoresByUser(userId);
        if (!stores.length) {
          return buildResult([{ role: 'assistant', text: copy.pickupStoreNotFound }]);
        }
        let store = pickupStoreId ? stores.find((item) => item.id === pickupStoreId) : undefined;
        if (!store && pickupStoreName) {
          const matches = stores.filter((item) =>
            (item.name || '').toLowerCase().includes(pickupStoreName.toLowerCase())
          );
          if (matches.length > 1) {
            const names = formatNameList(
              matches.map((match) => match.name || '').slice(0, 5),
              lang
            );
            return buildResult([{ role: 'assistant', text: copy.pickupStoreMultiple(names) }]);
          }
          store = matches[0];
        }
        if (!store) {
          return buildResult([{ role: 'assistant', text: copy.pickupStoreNotFound }]);
        }
        storePickup = buildPickupFromStore(store);
        if (!storePickup) {
          return buildResult([{ role: 'assistant', text: copy.pickupStoreMissing }]);
        }
      }

      const updates: Partial<ProductRecord> = {};
      if (typeof args.description === 'string') {
        updates.description = args.description;
      }
      if (typeof args.category === 'string' && args.category.trim()) {
        updates.category = args.category.trim();
      }
      if (typeof args.unit === 'string' && args.unit.trim()) {
        updates.unit = args.unit.trim();
      }
      const parsedPrice = parseNumber(args.price);
      if (typeof parsedPrice === 'number' && !Number.isNaN(parsedPrice)) {
        updates.price = parsedPrice;
      }
      const parsedStock = parseNumber(args.stock);
      if (typeof parsedStock === 'number' && !Number.isNaN(parsedStock)) {
        updates.stock = parsedStock;
      }
      if (Array.isArray(args.tags)) {
        updates.tags = (args.tags as unknown[]).filter((tag) => typeof tag === 'string') as string[];
      }

      const imageUrls = parseImageUrls(args);
      if (imageUrls.length) {
        const existing = Array.isArray(target.images)
          ? target.images.filter((url) => typeof url === 'string' && url.trim())
          : [];
        const merged = Array.from(new Set([...imageUrls, ...existing])).slice(0, 10);
        updates.images = merged;
      }

      const pickupUpdate = parsePickupArgs(args);
      if (pickupUpdate || storePickup) {
        updates.pickup = { ...(target.pickup || {}), ...(storePickup || {}), ...(pickupUpdate || {}) };
      }

      if (!Object.keys(updates).length) {
        const targetName = target.name || productName || (isTraditional ? '產品' : 'product');
        const canEdit = !!target.id && userProfile?.role !== 'market';
        const productEditUrl = canEdit ? buildProductEditLink(target.id!, { step: 3 }) : undefined;
        const productEditActionUrl = canEdit ? buildProductEditLink(target.id!, { step: 3, enhance: true }) : undefined;
        const imageUploadUrl = canEdit
          ? buildProductEditLink(target.id!, { step: 3, media: 'upload', enhance: true })
          : undefined;
        const imageCameraUrl = canEdit
          ? buildProductEditLink(target.id!, { step: 3, media: 'camera', enhance: true })
          : undefined;
        const pickupUrl = canEdit ? buildProductEditLink(target.id!, { step: 'pickup' }) : undefined;
        const productDetailUrl = target.id
          ? userProfile?.role === 'market'
            ? `/market/products?product=${target.id}`
            : productEditUrl || productCatalogUrl
          : productEditUrl || productCatalogUrl;
        const productUi: VoiceToolUiProduct = {
          id: target.id,
          name: targetName,
          price: target.price,
          unit: target.unit,
          stock: target.stock,
          category: target.category,
          imageUrl: target.images?.[0],
          imageCount: target.images?.length ?? 0,
          description: target.description,
          pickup: target.pickup,
          href: productEditUrl || productDetailUrl,
        };
        const imagePrompt = isTraditional ? `新增產品圖片 ${targetName}` : `Add product image for ${targetName}`;
        const pickupPrompt = isTraditional ? `新增取貨地址 ${targetName}` : `Add pickup address for ${targetName}`;
        return buildResult(
          [{ role: 'assistant', text: copy.productUpdateMissing }],
          {
            kind: 'product_updated',
            title: isTraditional ? '修改產品' : 'Edit product',
            description: isTraditional
              ? '告訴我想更新的內容，或直接開啟編輯。'
              : 'Tell me what to change, or open the editor.',
            product: productUi,
            actions: [
              ...(productEditActionUrl
                ? [{ label: isTraditional ? '完成細節' : 'Complete details', href: productEditActionUrl }]
                : [{ label: isTraditional ? '查看產品' : 'View product', href: productDetailUrl }]),
              ...(imageUploadUrl
                ? [{ label: isTraditional ? '上傳圖片' : 'Upload image', href: imageUploadUrl }]
                : [{ label: isTraditional ? '新增圖片' : 'Add image', prompt: imagePrompt }]),
              ...(imageCameraUrl
                ? [{ label: isTraditional ? '開啟相機' : 'Use camera', href: imageCameraUrl }]
                : []),
              ...(pickupUrl
                ? [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', href: pickupUrl }]
                : [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', prompt: pickupPrompt }]),
            ],
          }
        );
      }

      await DatabaseService.updateProduct(userId, target.id, updates);

      const updated: ProductRecord = {
        ...target,
        ...updates,
        pickup: updates.pickup ?? target.pickup,
        images: updates.images ?? target.images,
      };
      const updatedName = updated.name || productName || target.name || (isTraditional ? '產品' : 'product');
      const canEdit = !!updated.id && userProfile?.role !== 'market';
      const productEditUrl = canEdit ? buildProductEditLink(updated.id!, { step: 3 }) : undefined;
      const productEditActionUrl = canEdit ? buildProductEditLink(updated.id!, { step: 3, enhance: true }) : undefined;
      const imageUploadUrl = canEdit
        ? buildProductEditLink(updated.id!, { step: 3, media: 'upload', enhance: true })
        : undefined;
      const imageCameraUrl = canEdit
        ? buildProductEditLink(updated.id!, { step: 3, media: 'camera', enhance: true })
        : undefined;
      const pickupUrl = canEdit ? buildProductEditLink(updated.id!, { step: 'pickup' }) : undefined;
      const productDetailUrl = updated.id
        ? userProfile?.role === 'market'
          ? `/market/products?product=${updated.id}`
          : productEditUrl || productCatalogUrl
        : productEditUrl || productCatalogUrl;
      const productUi: VoiceToolUiProduct = {
        id: updated.id,
        name: updatedName,
        price: updated.price,
        unit: updated.unit,
        stock: updated.stock,
        category: updated.category,
        imageUrl: updated.images?.[0],
        imageCount: updated.images?.length ?? 0,
        description: updated.description,
        pickup: updated.pickup,
        href: productEditUrl || productDetailUrl,
      };
      const imagePrompt = isTraditional ? `新增產品圖片 ${updatedName}` : `Add product image for ${updatedName}`;
      const pickupPrompt = isTraditional ? `新增取貨地址 ${updatedName}` : `Add pickup address for ${updatedName}`;
      const followUpNeeded = !productUi.imageCount || !productUi.pickup?.address;
      const followUpMessages: VoiceAssistantMessage[] = followUpNeeded
        ? [{ role: 'assistant', text: copy.productDetailsPrompt }]
        : [];
      return buildResult(
        [{ role: 'assistant', text: copy.productUpdated(updatedName) }, ...followUpMessages],
        {
          kind: 'product_updated',
          title: isTraditional ? '產品已更新' : 'Product updated',
          description: isTraditional ? '內容已更新完成。' : 'Details have been updated.',
          product: productUi,
          actions: [
            ...(productEditActionUrl
              ? [{ label: isTraditional ? '完成細節' : 'Complete details', href: productEditActionUrl }]
              : [{ label: isTraditional ? '查看產品' : 'View product', href: productDetailUrl }]),
            ...(imageUploadUrl
              ? [{ label: isTraditional ? '上傳圖片' : 'Upload image', href: imageUploadUrl }]
              : [{ label: isTraditional ? '新增圖片' : 'Add image', prompt: imagePrompt }]),
            ...(imageCameraUrl
              ? [{ label: isTraditional ? '開啟相機' : 'Use camera', href: imageCameraUrl }]
              : []),
            ...(pickupUrl
              ? [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', href: pickupUrl }]
              : [{ label: isTraditional ? '新增取貨地址' : 'Add pickup address', prompt: pickupPrompt }]),
          ],
        }
      );
    }
    case 'store_create': {
      const name = typeof call.args?.name === 'string' ? call.args.name.trim() : '';
      if (!name) {
        return buildResult([{ role: 'assistant', text: copy.missingStoreName }]);
      }
      const type = typeof call.args?.type === 'string' ? call.args.type : 'other';
      const location = typeof call.args?.location === 'string' ? call.args.location : '';
      const created = await DatabaseService.createStore(userId, { name, type, location });
      const storeUi: VoiceToolUiStore = {
        id: created.id,
        name,
        type,
        location,
        href: storeListUrl,
      };
      return buildResult(
        [{ role: 'assistant', text: copy.storeCreated(name, type, location) }],
        {
          kind: 'store_created',
          title: isTraditional ? '店家已建立' : 'Store created',
          description: isTraditional ? '已新增到店家清單。' : 'Added to your store list.',
          store: storeUi,
          actions: [
            { label: isTraditional ? '開啟店家清單' : 'Open store list', href: storeListUrl },
          ],
        }
      );
    }
    case 'product_browse_public': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const list = await DatabaseService.getAllProducts(limit);
      if (!list.length) {
        return buildResult([{ role: 'assistant', text: copy.searchEmpty }]);
      }
      const lines = list.map(formatProductLine).join('\n');
      const uiItems: VoiceToolUiProduct[] = list.map((product) => ({
        id: product.id,
        name: product.name || '',
        price: product.price,
        unit: product.unit,
        stock: product.stock,
        category: product.category,
        imageUrl: product.images?.[0],
        href: product.id ? `/market/products?product=${product.id}` : '/market/products',
      }));
      return buildResult(
        [
          {
            role: 'assistant',
            text: `${copy.listHeader(lang === 'zh-TW' ? '公開產品' : 'Public products')}\n${lines}`,
          },
        ],
        {
          kind: 'product_list',
          title: isTraditional ? '公開產品' : 'Public products',
          description: isTraditional ? '最新上架的產品。' : 'Recently listed products.',
          context: 'market',
          items: uiItems,
          actions: [
            { label: isTraditional ? '前往市集商品' : 'Open marketplace products', href: '/market/products' },
          ],
        }
      );
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
      const filterSummary = summarizeProductFilters(args, lang);
      if (!list.length) {
        return buildResult([{ role: 'assistant', text: copy.searchEmpty }]);
      }
      const lines = list.map(formatProductLine).join('\n');
      const uiItems: VoiceToolUiProduct[] = list.map((product) => ({
        id: product.id,
        name: product.name || '',
        price: product.price,
        unit: product.unit,
        stock: product.stock,
        category: product.category,
        imageUrl: product.images?.[0],
        href: product.id ? `/market/products?product=${product.id}` : '/market/products',
      }));
      return buildResult(
        [
          {
            role: 'assistant',
            text: `${copy.listHeader(lang === 'zh-TW' ? '搜尋結果' : 'Search results')}\n${lines}`,
          },
        ],
        {
          kind: 'product_list',
          title: isTraditional ? '搜尋結果' : 'Search results',
          description: filterSummary
            ? `${isTraditional ? '篩選條件' : 'Filters'}: ${filterSummary}`
            : isTraditional
              ? '符合條件的產品。'
              : 'Products matching your filters.',
          context: 'market',
          items: uiItems,
          actions: [
            {
              label: isTraditional ? '調整搜尋' : 'Refine search',
              prompt: isTraditional ? '重新搜尋產品' : 'Refine product search',
            },
          ],
        }
      );
    }
    case 'store_browse_public': {
      const limit = normaliseLimit(call.args?.limit, 5);
      const list = await DatabaseService.getAllStores(limit);
      if (!list.length) {
        return buildResult([{ role: 'assistant', text: copy.searchEmpty }]);
      }
      const lines = list.map(formatStoreLine).join('\n');
      const uiItems: VoiceToolUiStore[] = list.map((store) => ({
        id: store.id,
        name: store.name || '',
        type: store.type,
        location: store.location,
        href: '/market/farms',
      }));
      return buildResult(
        [
          {
            role: 'assistant',
            text: `${copy.listHeader(lang === 'zh-TW' ? '公開店家' : 'Public stores')}\n${lines}`,
          },
        ],
        {
          kind: 'store_list',
          title: isTraditional ? '公開店家' : 'Public stores',
          description: isTraditional ? '近期上架的合作店家。' : 'Recent stores in the marketplace.',
          context: 'market',
          items: uiItems,
          actions: [
            { label: isTraditional ? '前往市集店家' : 'Open marketplace stores', href: '/market/farms' },
          ],
        }
      );
    }
    case 'store_search_public': {
      const args = call.args || {};
      const list = await DatabaseService.searchStoresPublic({
        nameContains: typeof args.nameContains === 'string' ? args.nameContains : undefined,
        typeEquals: typeof args.typeEquals === 'string' ? args.typeEquals : undefined,
        locationContains: typeof args.locationContains === 'string' ? args.locationContains : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });
      const filterSummary = summarizeStoreFilters(args, lang);
      if (!list.length) {
        return buildResult([{ role: 'assistant', text: copy.searchEmpty }]);
      }
      const lines = list.map(formatStoreLine).join('\n');
      const uiItems: VoiceToolUiStore[] = list.map((store) => ({
        id: store.id,
        name: store.name || '',
        type: store.type,
        location: store.location,
        href: '/market/farms',
      }));
      return buildResult(
        [
          {
            role: 'assistant',
            text: `${copy.listHeader(lang === 'zh-TW' ? '搜尋結果' : 'Search results')}\n${lines}`,
          },
        ],
        {
          kind: 'store_list',
          title: isTraditional ? '搜尋結果' : 'Search results',
          description: filterSummary
            ? `${isTraditional ? '篩選條件' : 'Filters'}: ${filterSummary}`
            : isTraditional
              ? '符合條件的店家。'
              : 'Stores matching your filters.',
          context: 'market',
          items: uiItems,
          actions: [
            {
              label: isTraditional ? '調整搜尋' : 'Refine search',
              prompt: isTraditional ? '重新搜尋店家' : 'Refine store search',
            },
          ],
        }
      );
    }
    case 'marketplace_get_stats': {
      const stats = await DatabaseService.getMarketplaceStats();
      return buildResult(
        [{ role: 'assistant', text: copy.marketplaceStats(stats) }],
        {
          kind: 'marketplace_stats',
          title: isTraditional ? '市集統計' : 'Marketplace stats',
          description: isTraditional ? '市集供需概況。' : 'Marketplace supply and demand.',
          items: [
            { label: isTraditional ? '賣家' : 'Sellers', value: stats.sellers },
            { label: isTraditional ? '買家' : 'Buyers', value: stats.buyers },
            { label: isTraditional ? '產品' : 'Products', value: stats.products },
            { label: isTraditional ? '店家' : 'Stores', value: stats.stores },
          ],
          actions: [
            { label: isTraditional ? '前往市集' : 'Open marketplace', href: '/market' },
          ],
        }
      );
    }
    default:
      return buildResult([{ role: 'assistant', text: copy.fallback }]);
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
}): Promise<VoiceToolResult> {
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
    mode: 'voice',
  });

  const messages: VoiceAssistantMessage[] = [];

  const fallbackCall = !plan.functionCalls?.length ? inferProductUpdateFromVoice(trimmed, lang) : null;
  const effectiveCalls = plan.functionCalls?.length
    ? plan.functionCalls.slice(0, 1)
    : fallbackCall
    ? [fallbackCall]
    : undefined;

  if (plan.text && !fallbackCall) {
    messages.push({ role: 'assistant', text: plan.text });
  }

  let toolUi: VoiceToolUi | undefined;
  if (effectiveCalls && effectiveCalls.length) {
    const toolMessages: VoiceAssistantMessage[] = [];
    for (const call of effectiveCalls) {
      const results = await executeVoiceFunction(call, userId, lang, userProfile);
      toolMessages.push(...results.messages);
      if (!toolUi && results.ui) {
        toolUi = results.ui;
      }
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

  return { messages, ui: toolUi };
}
