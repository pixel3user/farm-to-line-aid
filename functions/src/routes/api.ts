import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import runtimeConfig from "../lib/runtimeConfig";
import { LinePayService, LinePayConfigurationError } from "../lib/linePay";
// removed eager admin import to avoid startup crashes
import { WebhookHandler } from "../api/webhookHandler";
import {
  exchangeCodeForToken,
  getUserProfile,
  mockExchangeCodeForToken,
  mockGetUserProfile,
} from "./lineAuth";
import { LineBotAPI, RichMenuManager, LineMessage } from "../api/lineBot";
import { GoogleGenAI, LiveServerMessage, Modality, Session, Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { executeVoiceAssistantToolCall, handleVoiceAssistantMessage } from "../lib/voiceAssistant";
import { YamatoConfigurationError, YamatoService, YamatoResponse, extractYamatoZipCode, getYamatoConfigSummary } from "../lib/yamato";
import { geocodeAddress, normalizeTaiwanAddress, reverseGeocode } from "../lib/geocoding";
import type {
  OrderRecord,
  OrderLogisticsRecord,
  YamatoShipmentRecord,
  YamatoPickupRecord,
  YamatoTrackingRecord,
  YamatoReverseRecord,
  ProductRecord,
} from "../lib/database-server";

const router = express.Router();

type LiveRelaySession = {
  session: Session;
  userId: string;
  locale?: string;
  createdAt: number;
  lastUsedAt: number;
  clients: Set<Response>;
  toolCache: Map<
    string,
    { messages: Array<{ role: 'assistant' | 'system'; text: string }>; expiresAt: number; ui?: Record<string, unknown> }
  >;
};

const LIVE_SESSION_TTL_MS = 1000 * 60 * 15;
const TOOL_CACHE_TTL_MS = 1000 * 60 * 2;
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "models/gemini-2.5-flash-native-audio-preview-12-2025";
const LIVE_VOICE_NAME = process.env.GEMINI_LIVE_VOICE || "Aoede";
const LIVE_RESPONSE_MODALITIES: Modality[] = LIVE_MODEL.includes("native-audio")
  ? [Modality.AUDIO]
  : [Modality.AUDIO, Modality.TEXT];
const liveSessions = new Map<string, LiveRelaySession>();
const liveSessionsByUser = new Map<string, string>();

const summarizeArgs = (args: unknown) => {
  try {
    return JSON.stringify(args ?? {}).slice(0, 300);
  } catch {
    return '[unserializable]';
  }
};

const LINE_ID_TOKEN_FALLBACK_TTL_MS = 1000 * 60 * 50;
const lineIdTokenCache = new Map<string, { userId: string; expiresAt: number }>();

const getLineIdTokenFromRequest = (req: Request) => {
  const headerToken = req.headers['x-line-id-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const bodyToken = typeof req.body?.lineIdToken === 'string' ? req.body.lineIdToken.trim() : '';
  return bodyToken;
};

const getLineAccessTokenFromRequest = (req: Request) => {
  const headerToken = req.headers['x-line-access-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const bodyToken = typeof req.body?.lineAccessToken === 'string' ? req.body.lineAccessToken.trim() : '';
  return bodyToken;
};

const verifyLineIdToken = async (idToken: string): Promise<string | null> => {
  if (!idToken) return null;
  const cached = lineIdTokenCache.get(idToken);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.userId;
    }
    lineIdTokenCache.delete(idToken);
  }

  const candidateIds = [
    runtimeConfig.lineLoginChannelId,
    runtimeConfig.lineChannelId,
    process.env.LINE_LOGIN_CHANNEL_ID,
    process.env.LINE_LIFF_CHANNEL_ID,
    process.env.LINE_CHANNEL_ID,
  ].filter((value): value is string => Boolean(value && String(value).trim()));
  if (!candidateIds.length) {
    return null;
  }

  for (const channelId of candidateIds) {
    try {
      const lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          id_token: idToken,
          client_id: channelId,
        }),
      });

      if (!lineResponse.ok) {
        const errorBody = await lineResponse.text().catch(() => '');
        console.warn('[verifyLineIdToken] verify failed', {
          status: lineResponse.status,
          channelIdSuffix: channelId.slice(-6),
          errorBody: errorBody.slice(0, 200),
        });
        continue;
      }

      const lineUser = await lineResponse.json();
      const userId = typeof lineUser.sub === 'string' ? lineUser.sub : '';
      if (!userId) continue;
      const expiresAt =
        typeof lineUser.exp === 'number' ? lineUser.exp * 1000 : Date.now() + LINE_ID_TOKEN_FALLBACK_TTL_MS;
      lineIdTokenCache.set(idToken, { userId, expiresAt });
      return userId;
    } catch (error) {
      console.warn('[verifyLineIdToken] verify error', {
        channelIdSuffix: channelId.slice(-6),
        error: (error as Error)?.message || error,
      });
    }
  }

  return null;
};

const verifyLineAccessToken = async (accessToken: string): Promise<string | null> => {
  if (!accessToken) return null;
  try {
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errorBody = await profileResponse.text().catch(() => '');
      console.warn('[verifyLineAccessToken] profile failed', {
        status: profileResponse.status,
        errorBody: errorBody.slice(0, 200),
      });
      return null;
    }

    const profile = await profileResponse.json();
    const userId = typeof profile.userId === 'string' ? profile.userId : '';
    return userId || null;
  } catch (error) {
    console.warn('[verifyLineAccessToken] profile error', {
      error: (error as Error)?.message || error,
    });
    return null;
  }
};

const LIVE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "show_product_tools",
    description: "Show product management shortcuts and guidance.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "show_store_tools",
    description: "Show store/CRM shortcuts and guidance.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "show_marketing_tools",
    description: "Show marketing content creation shortcuts and guidance.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "show_analytics_tools",
    description: "Show analytics shortcuts.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "open_dashboard",
    description: "Open the Farm2Market LIFF dashboard for the user.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "show_help_options",
    description: "Show help options and tips.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "product_list",
    description: "List the user's products. If a limit is mentioned, include it in args.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "product_create",
    description: "Create a new product. Required: name, price (>0), unit, stock (>=0).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        price: { type: Type.NUMBER },
        unit: { type: Type.STRING },
        stock: { type: Type.NUMBER },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        imageUrl: { type: Type.STRING },
        imageUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
        images: { type: Type.ARRAY, items: { type: Type.STRING } },
        pickupAddress: { type: Type.STRING },
        pickupContactName: { type: Type.STRING },
        pickupContactTel: { type: Type.STRING },
        pickupContactMobile: { type: Type.STRING },
        pickupPostNumber: { type: Type.STRING },
        pickupYamatoZipCode: { type: Type.STRING },
      },
    },
  },
  {
    name: "product_update",
    description: "Update an existing product. Provide productId or productName when possible. You can also pass pickupStoreId/pickupStoreName to reuse a store pickup address.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING },
        productName: { type: Type.STRING },
        name: { type: Type.STRING },
        pickupStoreId: { type: Type.STRING },
        pickupStoreName: { type: Type.STRING },
        storeId: { type: Type.STRING },
        storeName: { type: Type.STRING },
        store: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        unit: { type: Type.STRING },
        price: { type: Type.NUMBER },
        stock: { type: Type.NUMBER },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        imageUrl: { type: Type.STRING },
        imageUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
        images: { type: Type.ARRAY, items: { type: Type.STRING } },
        pickupAddress: { type: Type.STRING },
        pickupContactName: { type: Type.STRING },
        pickupContactTel: { type: Type.STRING },
        pickupContactMobile: { type: Type.STRING },
        pickupPostNumber: { type: Type.STRING },
        pickupYamatoZipCode: { type: Type.STRING },
      },
    },
  },
  {
    name: "store_list",
    description: "List the user's stores. If a limit is mentioned, include it in args.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "store_create",
    description: "Create a new store. Ask for missing: name (required).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        type: { type: Type.STRING },
        location: { type: Type.STRING },
      },
    },
  },
  {
    name: "marketing_material_list",
    description: "List recent marketing materials. If a limit is mentioned, include it in args.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "analytics_get_user_stats",
    description: "Get counts for products, stores, conversations for this user.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "user_set_role",
    description: "Set the user role. Args: { role: \"farmer\" | \"market\" }.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        role: { type: Type.STRING },
      },
    },
  },
  {
    name: "product_browse_public",
    description: "Browse public products. Optional args: { limit?: number }",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "store_browse_public",
    description: "Browse public stores/buyers. Optional args: { limit?: number }",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "marketplace_get_stats",
    description: "Get public marketplace stats (counts of sellers/buyers/products/stores).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "product_search_public",
    description: "Search products by name/category/tags/price.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameContains: { type: Type.STRING },
        categoryEquals: { type: Type.STRING },
        tagsAny: { type: Type.ARRAY, items: { type: Type.STRING } },
        minPrice: { type: Type.NUMBER },
        maxPrice: { type: Type.NUMBER },
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "store_search_public",
    description: "Search stores by name/type/location.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameContains: { type: Type.STRING },
        typeEquals: { type: Type.STRING },
        locationContains: { type: Type.STRING },
        limit: { type: Type.INTEGER },
      },
    },
  },
];

const buildLiveSystemInstruction = (locale?: string, pageContext?: string, pageRoute?: string) => {
  const isTraditionalChinese = locale?.toLowerCase() === "zh-tw" || locale?.toLowerCase() === "zh_tw";
  const contextLines: string[] = [];
  if (pageRoute) {
    contextLines.push(
      isTraditionalChinese ? `目前頁面路徑：${pageRoute}` : `Current page route: ${pageRoute}`
    );
  }
  if (pageContext) {
    contextLines.push(
      isTraditionalChinese ? `目前頁面資訊：${pageContext}` : `Current page context: ${pageContext}`
    );
  }
  const contextNote = contextLines.length ? `\n${contextLines.join('\n')}` : '';
  return {
    parts: [
      {
        text: isTraditionalChinese
          ? `你是繁體中文語音助理，協助農友管理產品、店家、行銷素材與營運分析。請用繁體中文回覆。不要透露思考過程或計畫步驟。需要執行動作時請呼叫工具；若缺少必要資訊，請先用一句話追問（例如新增產品需要名稱/價格/單位/庫存）。使用工具後，請用一句到兩句話總結結果並提一個簡短的下一步問題。${contextNote}`
          : `You are a helpful voice assistant for Farm2Market. Respond in concise English. Do not reveal reasoning or planning. Use tools to perform actions; if required info is missing, ask one short follow-up question (e.g., add product needs name/price/unit/stock). After using a tool, summarize the result in 1-2 sentences and ask a brief follow-up question.${contextNote}`,
      },
    ],
  };
};

const broadcastLive = (sessionId: string, payload: Record<string, unknown>) => {
  const entry = liveSessions.get(sessionId);
  if (!entry) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of entry.clients) {
    try {
      client.write(data);
    } catch (error) {
      entry.clients.delete(client);
    }
  }
};

const closeLiveSession = (sessionId: string) => {
  const entry = liveSessions.get(sessionId);
  if (!entry) return;
  entry.clients.forEach((client) => {
    try {
      client.end();
    } catch {}
  });
  entry.clients.clear();
  try {
    entry.session.close();
  } catch {}
  liveSessions.delete(sessionId);
  if (liveSessionsByUser.get(entry.userId) === sessionId) {
    liveSessionsByUser.delete(entry.userId);
  }
};

const pruneLiveSessions = () => {
  const now = Date.now();
  for (const [sessionId, entry] of liveSessions.entries()) {
    if (now - entry.lastUsedAt > LIVE_SESSION_TTL_MS) {
      closeLiveSession(sessionId);
    }
  }
};

// Basic root responder for health/debug
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Farm2Market API",
    endpoints: ["/health", "/payments/line-pay/status", "/orders/cod", "/payments/line-pay/reserve"],
  });
});

const useMockLineApis =
  (process.env.NODE_ENV === "development" || process.env.USE_MOCK_LINE === "true") &&
  process.env.USE_MOCK_LINE !== "false";

const getServerTimestamp = async () => {
  const { default: admin } = await import("../lib/firebaseAdmin");
  return admin.firestore.FieldValue.serverTimestamp();
};

const getArrayTimestamp = async () => {
  const { default: admin } = await import("../lib/firebaseAdmin");
  return admin.firestore.Timestamp.now();
};

const getAuthorizedUserId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/i);
  if (match) {
    try {
      const { default: admin } = await import("../lib/firebaseAdmin");
      const decoded = await admin.auth().verifyIdToken(match[1]);
      return decoded?.uid || null;
    } catch (error) {
      console.warn("Voice assistant auth verification failed:", error);
    }
  }
  const lineIdToken = getLineIdTokenFromRequest(req);
  if (lineIdToken) {
    const userId = await verifyLineIdToken(lineIdToken);
    if (userId) return userId;
  }
  const lineAccessToken = getLineAccessTokenFromRequest(req);
  if (lineAccessToken) {
    return await verifyLineAccessToken(lineAccessToken);
  }
  return null;
};

type NormalizedOrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  imageUrl?: string;
  ownerId?: string;
  pickup?: ProductRecord["pickup"];
};

const resolveSellerBundles = async (
  items: NormalizedOrderItem[]
): Promise<{
  sellerIds: string[];
  sellerItems: Record<string, NormalizedOrderItem[]>;
  sellerProfiles: Record<string, { lineId?: string; displayName?: string }>;
  ownerByProductId: Record<string, string | undefined>;
  productById: Record<string, ProductRecord | undefined>;
}> => {
  const { DatabaseService } = await import("../lib/database-server");
  const uniqueProductIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean))
  );

  const productOwnerMap = new Map<string, string | undefined>();
  const productById = new Map<string, ProductRecord | undefined>();
  await Promise.all(
    uniqueProductIds.map(async (pid) => {
      try {
        const product = await DatabaseService.getProductById(pid);
        productOwnerMap.set(pid, product?.userId);
        productById.set(pid, product || undefined);
      } catch (error) {
        console.warn("Failed to resolve owner for product", pid, error);
        productOwnerMap.set(pid, undefined);
        productById.set(pid, undefined);
      }
    })
  );

  const sellerItems: Record<string, NormalizedOrderItem[]> = {};
  for (const item of items) {
    const ownerId = item.productId ? productOwnerMap.get(item.productId) : undefined;
    if (!ownerId) continue;
    sellerItems[ownerId] = sellerItems[ownerId] || [];
    sellerItems[ownerId].push(item);
  }

  const sellerProfiles: Record<string, { lineId?: string; displayName?: string }> = {};
  await Promise.all(
    Object.keys(sellerItems).map(async (sellerId) => {
      try {
        const profile = await DatabaseService.getLineUser(sellerId);
        sellerProfiles[sellerId] = {
          lineId: profile?.lineId || profile?.lineUserId || sellerId,
          displayName: profile?.displayName || "Farmer",
        };
      } catch (error) {
        console.warn("Failed to fetch seller profile", sellerId, error);
        sellerProfiles[sellerId] = { lineId: sellerId, displayName: "Farmer" };
      }
    })
  );

  const ownerByProductId: Record<string, string | undefined> = {};
  for (const [pid, ownerId] of productOwnerMap.entries()) {
    ownerByProductId[pid] = ownerId;
  }

  const productByIdRecord: Record<string, ProductRecord | undefined> = {};
  for (const [pid, product] of productById.entries()) {
    productByIdRecord[pid] = product;
  }

  return {
    sellerIds: Object.keys(sellerItems),
    sellerItems,
    sellerProfiles,
    ownerByProductId,
    productById: productByIdRecord,
  };
};

type SellerPickupGroup = {
  sellerId: string;
  pickupKey: string;
  pickup: NonNullable<ProductRecord["pickup"]>;
  items: NormalizedOrderItem[];
};

const buildSellerPickupGroups = (
  items: NormalizedOrderItem[],
  ownerByProductId: Record<string, string | undefined>,
  productById: Record<string, ProductRecord | undefined>
): { groups: SellerPickupGroup[]; missingProductIds: string[] } => {
  const groups = new Map<string, SellerPickupGroup>();
  const missingProductIds: string[] = [];

  for (const item of items) {
    const ownerId = item.ownerId || ownerByProductId[item.productId];
    const product = productById[item.productId];
    const pickup = product?.pickup;
    if (!ownerId || !pickup?.address || !pickup?.yamatoZipCode) {
      if (item.productId) {
        missingProductIds.push(item.productId);
      }
      continue;
    }
    const pickupKey = `${ownerId}:${pickup.address}:${pickup.yamatoZipCode}`;
    const entry = groups.get(pickupKey) || {
      sellerId: ownerId,
      pickupKey,
      pickup,
      items: [],
    };
    entry.items.push({ ...item, ownerId, pickup });
    groups.set(pickupKey, entry);
  }

  return { groups: Array.from(groups.values()), missingProductIds };
};

const notifySellersOfOrder = async ({
  orderId,
  items,
  buyerName,
  shippingSummary,
  paymentMethod,
  preResolved,
}: {
  orderId: string;
  items: NormalizedOrderItem[];
  buyerName?: string | null;
  shippingSummary?: string;
  paymentMethod?: string;
  preResolved?: {
    sellerIds: string[];
    sellerItems: Record<string, NormalizedOrderItem[]>;
    sellerProfiles: Record<string, { lineId?: string; displayName?: string }>;
  };
}) => {
  const resolved =
    preResolved ||
    (await resolveSellerBundles(items));
  const { sellerIds, sellerItems, sellerProfiles } = resolved;
  if (!sellerIds.length) {
    return resolved;
  }

  const bot = new LineBotAPI();
  const frontendBase =
    runtimeConfig.frontendBaseUrl ||
    process.env.FRONTEND_BASE_URL ||
    (runtimeConfig.liffUrl && !/liff\.line\.me/i.test(runtimeConfig.liffUrl) ? runtimeConfig.liffUrl : undefined) ||
    'https://farm2market.tw';
  const scheduleUrl = `${(frontendBase || '').replace(/\/$/, '')}/farmer/delivery?order=${encodeURIComponent(orderId)}`;
  const scheduleDialogUrl = `${scheduleUrl}&dialog=label`;

  await Promise.all(
    sellerIds.map(async (sellerId) => {
      const destination = sellerProfiles[sellerId]?.lineId || sellerId;
      if (!destination) return;

      const ownedItems = sellerItems[sellerId] || [];
      const itemsFlex = ownedItems.slice(0, 10).map((item) => ({
        type: "box",
        layout: "baseline",
        spacing: "sm",
        action: {
          type: "uri",
          uri: scheduleDialogUrl,
        },
        contents: [
          { type: "text", text: item.name || "商品", weight: "bold", size: "sm", flex: 6, wrap: true },
          { type: "text", text: `x${item.quantity}`, size: "sm", flex: 2, align: "end" },
          { type: "text", text: `${item.price}${item.unit ? `/${item.unit}` : ""}`, size: "xs", color: "#888888", flex: 2, align: "end" },
        ],
      }));
      const flex: LineMessage = {
        type: "flex",
        altText: "有新訂單",
        contents: {
          type: "bubble",
          hero: {
            type: "box",
            layout: "vertical",
            paddingAll: "14px",
            backgroundColor: "#F0FDF4",
            contents: [
              { type: "text", text: "新訂單等待確認", weight: "bold", size: "lg", color: "#166534" },
              { type: "text", text: `訂單編號：${orderId}`, size: "sm", color: "#166534" },
              buyerName ? { type: "text", text: `買家：${buyerName}`, size: "sm", color: "#166534" } : null,
              paymentMethod ? { type: "text", text: `付款方式：${paymentMethod}`, size: "sm", color: "#166534" } : null,
              shippingSummary ? { type: "text", text: `配送地點：${shippingSummary}`, size: "sm", color: "#166534", wrap: true } : null,
            ].filter(Boolean),
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "請確認是否接受此訂單",
                weight: "bold",
                size: "md",
                color: "#111827",
              },
              ...itemsFlex,
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#16a34a",
                action: {
                  type: "uri",
                  label: "確認訂單",
                  uri: `${scheduleDialogUrl}&action=confirm`,
                },
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "uri",
                  label: "不接受此訂單",
                  uri: `${scheduleUrl}&action=decline`,
                },
              },
              {
                type: "button",
                style: "link",
                action: {
                  type: "uri",
                  label: "查看配送排程",
                  uri: scheduleDialogUrl,
                },
              },
            ],
          },
        },
      };

      try {
        await bot.pushMessage(destination, [
          flex,
        ]);
      } catch (error) {
        console.warn("Failed to push order notification", { sellerId, error });
      }
    })
  );

  return resolved;
};

const formatShippingAddress = (shipping?: OrderRecord["shipping"]) => {
  if (!shipping) return "";
  return [shipping.city, shipping.addressLine1, shipping.addressLine2]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .trim();
};

const normalizeOrderItems = (order: OrderRecord): NormalizedOrderItem[] => {
  return (order.items || []).map((item) => ({
    productId: String(item.productId || ''),
    name: item.name || 'Item',
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    unit: item.unit,
    imageUrl: item.imageUrl,
    ownerId: item.ownerId,
  }));
};

const buildProductSummary = (items: NormalizedOrderItem[]) => {
  if (!items.length) return "Items";
  const slice = items.slice(0, 3);
  const summary = slice
    .map((item) => `${item.name || "Item"}x${item.quantity || 1}`)
    .join(", ");
  if (items.length > slice.length) {
    return `${summary} +${items.length - slice.length}`;
  }
  return summary;
};

const resolveRecipientPhones = (
  phone: string | undefined,
  overrides?: { recipientTel?: string; recipientMobile?: string }
) => {
  if (overrides?.recipientTel || overrides?.recipientMobile) {
    return {
      RecipientTel: overrides.recipientTel || "",
      RecipientMobile: overrides.recipientMobile || "",
    };
  }
  const raw = (phone || "").trim();
  const digits = raw.replace(/[^0-9]/g, "");
  if (/^09\d{8}$/.test(digits)) {
    return { RecipientTel: "", RecipientMobile: digits };
  }
  return { RecipientTel: raw, RecipientMobile: "" };
};

const normalizeTaiwanMobile = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("886") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  return digits;
};

const resolveSenderPhones = (options: {
  contactTel?: string;
  contactMobile?: string;
  fallbackTel?: string;
  fallbackMobile?: string;
}) => {
  const rawMobile = (options.contactMobile || "").trim();
  const rawTel = (options.contactTel || "").trim();
  if (rawMobile) {
    const normalizedMobile = normalizeTaiwanMobile(rawMobile);
    return { SenderTel: rawTel, SenderMobile: normalizedMobile || rawMobile };
  }
  if (rawTel) {
    const digits = rawTel.replace(/[^0-9]/g, "");
    if (/^09\d{8}$/.test(digits)) {
      return { SenderTel: "", SenderMobile: digits };
    }
    return { SenderTel: rawTel, SenderMobile: "" };
  }
  const fallbackMobile = (options.fallbackMobile || "").trim();
  if (fallbackMobile) {
    const normalizedMobile = normalizeTaiwanMobile(fallbackMobile);
    return { SenderTel: options.fallbackTel || "", SenderMobile: normalizedMobile || fallbackMobile };
  }
  return { SenderTel: options.fallbackTel || "", SenderMobile: "" };
};

const parseTelephoneParts = (value: string | undefined) => {
  const raw = (value || "").trim();
  if (!raw) return { area: "", number: "", ext: "" };
  if (raw.includes("-")) {
    const [area, rest] = raw.split("-", 2);
    return { area: area || "", number: rest || "", ext: "" };
  }
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length >= 9) {
    return { area: digits.slice(0, 2), number: digits.slice(2), ext: "" };
  }
  return { area: "", number: digits, ext: "" };
};

const resolveYamatoSender = (overrides?: {
  senderName?: string;
  senderTel?: string;
  senderMobile?: string;
  senderAddress?: string;
  senderZipCode?: string;
}) => {
  const sender = {
    name: (overrides?.senderName || "").trim(),
    tel: (overrides?.senderTel || "").trim(),
    mobile: (overrides?.senderMobile || "").trim(),
    address: (overrides?.senderAddress || "").trim(),
    zipCode: (overrides?.senderZipCode || "").trim(),
  };
  if (!sender.name || (!sender.tel && !sender.mobile) || !sender.address || !sender.zipCode) {
    throw new YamatoConfigurationError(
      "Sender details are required. Provide senderName/senderTel/senderMobile/senderAddress/senderZipCode or use splitBySeller."
    );
  }
  return sender;
};

const hasSenderFields = (entry: Record<string, any>) => {
  const name = typeof entry.SenderName === "string" ? entry.SenderName.trim() : "";
  const address = typeof entry.SenderAddress === "string" ? entry.SenderAddress.trim() : "";
  const zipCode = typeof entry.SenderZipCode === "string" ? entry.SenderZipCode.trim() : "";
  const tel = typeof entry.SenderTel === "string" ? entry.SenderTel.trim() : "";
  const mobile = typeof entry.SenderMobile === "string" ? entry.SenderMobile.trim() : "";
  return Boolean(name && address && zipCode && (tel || mobile));
};

const resolveReceiptLocation = (order: OrderRecord, overrides?: { receiptLocation?: string; receiptStationNo?: string }) => {
  const receiptLocation =
    overrides?.receiptLocation ||
    (order.shipping?.method === "pickup_station" ? "02" : "01");
  const receiptStationNo =
    overrides?.receiptStationNo ||
    (order.shipping?.method === "pickup_station" ? order.shipping?.pickupOfficeNo : "");
  return { receiptLocation, receiptStationNo };
};

type YamatoFlag = "Y" | "N";

const normalizeYamatoFlag = (value: unknown, fallback: YamatoFlag = "N"): YamatoFlag => {
  if (value === true) return "Y";
  if (value === false) return "N";
  if (value === "Y" || value === "N") return value;
  return fallback;
};

const normalizeYamatoCode = (value: unknown, fallback: string, padLength = 4) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return /^\d+$/.test(trimmed) ? trimmed.padStart(padLength, "0") : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).padStart(padLength, "0");
  }
  return fallback;
};

const normalizeYamatoTime = (value: unknown, fallback: string) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).padStart(2, "0");
  }
  return fallback;
};

const normalizeYamatoDate = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const digits = String(Math.trunc(value)).replace(/[^0-9]/g, "");
    return digits.length === 8 ? digits : "";
  }
  if (typeof value !== "string") return "";
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length === 8 ? digits : "";
};

const normalizePickupQuantity = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
};

const resolvePickupQuantities = (payload: Record<string, any>) => {
  const normal = normalizePickupQuantity(
    payload.NormalQuantity ?? payload.normalQuantity ?? payload.Piece ?? payload.piece
  );
  const cold = normalizePickupQuantity(payload.ColdQuantity ?? payload.coldQuantity);
  const freeze = normalizePickupQuantity(payload.FreezeQuantity ?? payload.freezeQuantity);
  return { NormalQuantity: normal, ColdQuantity: cold, FreezeQuantity: freeze };
};

const hasPickupQuantity = (quantities: {
  NormalQuantity: number;
  ColdQuantity: number;
  FreezeQuantity: number;
}) => quantities.NormalQuantity + quantities.ColdQuantity + quantities.FreezeQuantity > 0;

const parseYamatoDate = (value: string) => {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  return new Date(Date.UTC(year, month, day));
};

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const formatYamatoDate = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const digits = `${year}${month}${day}`;
  if (digits.length === 8) return digits;
  const fallback = formatter.format(date).replace(/[^0-9]/g, "");
  return fallback.length === 8 ? fallback : "";
};

const parseYamatoHolidayList = (value: string | undefined) => {
  if (!value) return new Set<string>();
  const normalized = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/[^0-9]/g, ""))
    .filter((entry) => entry.length === 8);
  return new Set(normalized);
};

const YAMATO_HOLIDAYS = parseYamatoHolidayList(process.env.YAMATO_HOLIDAYS);
const yamatoWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  weekday: "short",
});

const isYamatoDebugEnabled = () => {
  const value = (process.env.YAMATO_DEBUG || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
};

const summarizeYamatoDateValue = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value;
};

const logYamatoDateDebug = (message: string, details: Record<string, unknown>) => {
  if (!isYamatoDebugEnabled()) return;
  console.info(`[yamato][date] ${message}`, details);
};

const isYamatoSunday = (date: Date) =>
  yamatoWeekdayFormatter.format(date).toLowerCase() === "sun";

const isYamatoHoliday = (dateKey: string) => YAMATO_HOLIDAYS.has(dateKey);

const isYamatoBlackoutDate = (date: Date, dateKey: string) =>
  isYamatoSunday(date) || isYamatoHoliday(dateKey);

const validateYamatoShipmentDates = (shipmentDate: string, deliveryDate: string) => {
  const normalizedShipment = normalizeYamatoDate(String(shipmentDate ?? ""));
  const normalizedDelivery = normalizeYamatoDate(String(deliveryDate ?? ""));
  logYamatoDateDebug("input", {
    shipmentDate: summarizeYamatoDateValue(shipmentDate),
    deliveryDate: summarizeYamatoDateValue(deliveryDate),
    normalizedShipment,
    normalizedDelivery,
    holidayCount: YAMATO_HOLIDAYS.size,
  });
  if (!normalizedShipment || !normalizedDelivery) {
    logYamatoDateDebug("format_error", { normalizedShipment, normalizedDelivery });
    return "ShipmentDate and DeliveryDate must be in YYYYMMDD format.";
  }
  const shipment = parseYamatoDate(normalizedShipment);
  const delivery = parseYamatoDate(normalizedDelivery);
  if (!shipment || !delivery) {
    logYamatoDateDebug("parse_error", {
      normalizedShipment,
      normalizedDelivery,
      shipmentParsed: Boolean(shipment),
      deliveryParsed: Boolean(delivery),
    });
    return "ShipmentDate and DeliveryDate must be valid dates.";
  }
  logYamatoDateDebug("parsed", {
    shipmentISO: shipment.toISOString(),
    deliveryISO: delivery.toISOString(),
  });
  const todayKey = formatYamatoDate(new Date());
  if (normalizedShipment < todayKey) {
    logYamatoDateDebug("past_shipment", { normalizedShipment, todayKey });
    return "ShipmentDate cannot be in the past.";
  }
  if (normalizedDelivery < todayKey) {
    logYamatoDateDebug("past_delivery", { normalizedDelivery, todayKey });
    return "DeliveryDate cannot be in the past.";
  }
  const shipmentIsSunday = isYamatoSunday(shipment);
  const deliveryIsSunday = isYamatoSunday(delivery);
  const shipmentIsHoliday = isYamatoHoliday(normalizedShipment);
  const deliveryIsHoliday = isYamatoHoliday(normalizedDelivery);
  if (shipmentIsSunday || shipmentIsHoliday) {
    logYamatoDateDebug("shipment_blackout", {
      normalizedShipment,
      shipmentIsSunday,
      shipmentIsHoliday,
    });
    return "ShipmentDate cannot be on Sundays or holidays.";
  }
  if (deliveryIsSunday || deliveryIsHoliday) {
    logYamatoDateDebug("delivery_blackout", {
      normalizedDelivery,
      deliveryIsSunday,
      deliveryIsHoliday,
    });
    return "DeliveryDate cannot be on Sundays or holidays.";
  }
  const diffDays = Math.floor((delivery.getTime() - shipment.getTime()) / 86400000);
  if (diffDays < 1) {
    logYamatoDateDebug("delivery_not_after", { diffDays, normalizedShipment, normalizedDelivery });
    return "DeliveryDate must be after ShipmentDate.";
  }
  if (diffDays > 7) {
    logYamatoDateDebug("delivery_too_far", { diffDays, normalizedShipment, normalizedDelivery });
    return "DeliveryDate must be within 7 days after ShipmentDate.";
  }
  logYamatoDateDebug("valid", { normalizedShipment, normalizedDelivery, diffDays });
  return null;
};

const resolveYamatoShipmentDates = (payload: Record<string, any>) => {
  const normalizedShipment = normalizeYamatoDate(payload.ShipmentDate);
  const normalizedDelivery = normalizeYamatoDate(payload.DeliveryDate);
  logYamatoDateDebug("resolve", {
    rawShipment: summarizeYamatoDateValue(payload.ShipmentDate),
    rawDelivery: summarizeYamatoDateValue(payload.DeliveryDate),
    normalizedShipment,
    normalizedDelivery,
  });
  const shipmentDate = normalizedShipment || formatYamatoDate(new Date());
  let deliveryDate = normalizedDelivery;
  const parsedShipment = parseYamatoDate(shipmentDate);
  if (!deliveryDate) {
    deliveryDate = parsedShipment ? formatYamatoDate(addUtcDays(parsedShipment, 1)) : shipmentDate;
  }
  if (!normalizedDelivery && deliveryDate <= shipmentDate) {
    deliveryDate = parsedShipment ? formatYamatoDate(addUtcDays(parsedShipment, 1)) : deliveryDate;
  }
  if (!normalizedDelivery && deliveryDate <= shipmentDate) {
    const today = formatYamatoDate(new Date());
    const parsedToday = parseYamatoDate(today);
    deliveryDate = parsedToday ? formatYamatoDate(addUtcDays(parsedToday, 1)) : deliveryDate;
  }
  return { shipmentDate, deliveryDate };
};

const resolvePrintOBTDefaults = (payload: Record<string, any>, order: OrderRecord) => {
  const isCollectionFallback: YamatoFlag = order.paymentMethod === "cod" ? "Y" : "N";
  const isCollection = normalizeYamatoFlag(payload.IsCollection, isCollectionFallback);
  const { shipmentDate, deliveryDate } = resolveYamatoShipmentDates(payload);
  return {
    Thermosphere: normalizeYamatoCode(payload.Thermosphere, "0001"),
    Spec: normalizeYamatoCode(payload.Spec, "0001"),
    ShipmentDate: shipmentDate,
    DeliveryDate: deliveryDate,
    DeliveryTime: normalizeYamatoTime(payload.DeliveryTime, "04"),
    IsFreight: normalizeYamatoFlag(payload.IsFreight, "N"),
    IsCollection: isCollection,
    IsSwipe: normalizeYamatoFlag(payload.IsSwipe, "N"),
    IsDeclare: normalizeYamatoFlag(payload.IsDeclare, "N"),
  };
};

const resolveB2SDefaults = (payload: Record<string, any>, order: OrderRecord) => {
  const isCollectionFallback: YamatoFlag = order.paymentMethod === "cod" ? "Y" : "N";
  const isCollection = normalizeYamatoFlag(payload.IsCollection, isCollectionFallback);
  return {
    Thermosphere: normalizeYamatoCode(payload.Thermosphere, "0001"),
    Spec: normalizeYamatoCode(payload.Spec, "0001"),
    IsCollection: isCollection,
  };
};

const appendOrderLogistics = async (
  orderId: string,
  order: OrderRecord,
  updates: Partial<OrderLogisticsRecord>
) => {
  const { DatabaseService } = await import("../lib/database-server");
  const current = order.logistics || {};
  const next: OrderLogisticsRecord = {
    ...current,
    ...updates,
    provider: current.provider || updates.provider || "yamato",
  };
  await DatabaseService.updateOrder(orderId, { logistics: next });
  return next;
};

const appendOrderShipment = async (
  orderId: string,
  order: OrderRecord,
  shipment: YamatoShipmentRecord
) => {
  const current = order.logistics || {};
  const shipments = Array.isArray(current.shipments)
    ? [...current.shipments, shipment]
    : [shipment];
  const env = current.environment || getYamatoConfigSummary().environment;
  return appendOrderLogistics(orderId, order, { shipments, environment: env });
};

const normalizeShipmentOrders = (orders: any[]) => {
  return orders.map((item) => {
    const deliveryId = typeof item?.DeliveryId === "string" ? item.DeliveryId.trim() : "";
    return {
      obtNumber: item?.OBTNumber || "",
      orderId: item?.OrderId || "",
      ...(deliveryId ? { deliveryId } : {}),
      fileNo: item?.FileNo || "",
    };
  });
};

const appendOrderPickup = async (
  orderId: string,
  order: OrderRecord,
  pickup: YamatoPickupRecord
) => {
  const current = order.logistics || {};
  const pickups = Array.isArray(current.pickups)
    ? [...current.pickups, pickup]
    : [pickup];
  const env = current.environment || getYamatoConfigSummary().environment;
  return appendOrderLogistics(orderId, order, { pickups, environment: env });
};

const getFrontendBaseUrl = () =>
  runtimeConfig.frontendBaseUrl ||
  process.env.FRONTEND_BASE_URL ||
  (runtimeConfig.liffUrl && !/liff\.line\.me/i.test(runtimeConfig.liffUrl) ? runtimeConfig.liffUrl : undefined) ||
  'https://farm2market.tw';

const LINE_FILE_MESSAGE_LIMIT_BYTES = 10 * 1024 * 1024;

const buildSellerScheduleUrl = (orderId: string, fileNo?: string) => {
  const base = (getFrontendBaseUrl() || '').replace(/\/$/, '');
  const params = new URLSearchParams({ order: orderId });
  if (fileNo) {
    params.set('label', fileNo);
    params.set('dialog', 'label');
  }
  return `${base}/farmer/delivery?${params.toString()}`;
};

const buildBuyerScheduleUrl = (orderId: string) => {
  const base = (getFrontendBaseUrl() || '').replace(/\/$/, '');
  return `${base}/market/schedule?order=${encodeURIComponent(orderId)}`;
};

const prepareLineLabelFileMessage = async (params: { orderId: string; fileNo: string }) => {
  const result = await YamatoService.downloadOBT({ FileNo: params.fileNo });
  if (result.kind === 'json') {
    throw new Error(result.data?.Message || 'Unable to download label.');
  }
  const fileBuffer = result.data;
  const fileSize = Buffer.isBuffer(fileBuffer) ? fileBuffer.length : 0;
  if (!fileSize) {
    throw new Error('Empty label file.');
  }
  if (fileSize > LINE_FILE_MESSAGE_LIMIT_BYTES) {
    throw new Error('Label exceeds LINE file size limit.');
  }

  const { default: admin } = await import('../lib/firebaseAdmin');
  const bucket = admin.storage().bucket();
  const fileId = crypto.randomUUID();
  const fileName = `yamato-label-${params.fileNo || fileId}.pdf`;
  const filePath = `yamato_labels/${params.orderId}/${fileId}.pdf`;
  const file = bucket.file(filePath);

  await file.save(fileBuffer, {
    contentType: result.contentType || 'application/pdf',
    resumable: false,
    metadata: { cacheControl: 'public,max-age=3600' },
  });

  let signedUrl: string;
  try {
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    signedUrl = url;
  } catch (signError: any) {
    const message = String(signError?.message || '');
    if (message.includes('iam.serviceAccounts.signBlob') || message.includes('SigningError')) {
      await file.makePublic();
      signedUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`;
    } else {
      throw signError;
    }
  }

  return {
    url: signedUrl,
    fileName,
    fileSize,
    message: {
      type: 'file',
      originalContentUrl: signedUrl,
      fileName,
      fileSize,
    } as LineMessage,
  };
};

const buildYamatoLabelMessage = (params: {
  orderId: string;
  fileNo?: string;
  obtNumbers?: string[];
  scheduleUrl: string;
}): LineMessage => {
  const obtText = params.obtNumbers?.length ? params.obtNumbers.join(', ') : '';
  return {
    type: "flex",
    altText: `託運單已建立 #${params.orderId}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        backgroundColor: "#f0fdf4",
        contents: [
          { type: "text", text: "託運單已建立", weight: "bold", size: "lg", color: "#166534" },
          { type: "text", text: `#${params.orderId}`, size: "sm", color: "#065f46" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          params.fileNo
            ? {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  { type: "text", text: "檔案", size: "xs", color: "#6b7280", flex: 2 },
                  { type: "text", text: params.fileNo, size: "sm", color: "#111827", wrap: true, flex: 8 },
                ],
              }
            : null,
          obtText
            ? {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  { type: "text", text: "託運單號", size: "xs", color: "#6b7280", flex: 2 },
                  { type: "text", text: obtText, size: "sm", color: "#111827", wrap: true, flex: 8 },
                ],
              }
            : null,
          {
            type: "text",
            text: "點擊下方按鈕查看並下載託運單。",
            size: "sm",
            color: "#111827",
            wrap: true,
          },
        ].filter(Boolean),
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#16a34a",
            height: "sm",
            action: {
              type: "uri",
              label: "查看託運單",
              uri: params.scheduleUrl,
            },
          },
        ],
      },
    },
  };
};

const notifySellersLabelReady = async (
  sellerIds: string[],
  params: { orderId: string; fileNo?: string; obtNumbers?: string[] }
) => {
  const rawRecipients = sellerIds.filter(Boolean);
  if (!rawRecipients.length) return;
  const { DatabaseService } = await import("../lib/database-server");
  const resolved = await Promise.all(
    rawRecipients.map(async (sellerId) => {
      try {
        const profile = await DatabaseService.getLineUser(sellerId);
        return profile?.lineId || profile?.lineUserId || sellerId;
      } catch (error) {
        console.warn("Failed to resolve seller LINE ID", sellerId, error);
        return sellerId;
      }
    })
  );
  const recipients = resolved.filter(Boolean);
  if (!recipients.length) return;
  const scheduleUrl = buildSellerScheduleUrl(params.orderId, params.fileNo);
  const message = buildYamatoLabelMessage({
    orderId: params.orderId,
    fileNo: params.fileNo,
    obtNumbers: params.obtNumbers,
    scheduleUrl,
  });
  let fileMessage: LineMessage | null = null;
  if (params.fileNo) {
    try {
      const filePayload = await prepareLineLabelFileMessage({
        orderId: params.orderId,
        fileNo: params.fileNo,
      });
      fileMessage = filePayload.message;
    } catch (error) {
      console.warn('Failed to prepare LINE label file message', error);
    }
  }
  const bot = new LineBotAPI();
  const messages = fileMessage ? [message, fileMessage] : [message];
  await Promise.all(recipients.map((id) => bot.pushMessage(id, messages)));
};

const notifyBuyerLabelReady = async (
  order: OrderRecord,
  params: { orderId: string; scheduleUrl: string }
) => {
  const buyerId = order.buyer?.userId;
  if (!buyerId) return;
  const bot = new LineBotAPI();
  const message: LineMessage = {
    type: "flex",
    altText: `訂單 ${params.orderId} 已確認`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        backgroundColor: "#e0f2fe",
        contents: [
          { type: "text", text: "訂單已確認", weight: "bold", size: "lg", color: "#0f172a" },
          { type: "text", text: `#${params.orderId}`, size: "sm", color: "#0ea5e9" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "託運單已建立，配送排程更新完成。",
            wrap: true,
            size: "sm",
            color: "#0f172a",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#0ea5e9",
            height: "sm",
            action: {
              type: "uri",
              label: "查看配送進度",
              uri: params.scheduleUrl,
            },
          },
        ],
      },
    },
  };

  await bot.pushMessage(buyerId, [message]);
};

const respondYamatoJson = (res: Response, result: { ok: boolean; status: number; data: any }) => {
  const isOk = result?.data && typeof result.data === "object" && result.data.IsOK === "Y";
  const status = isOk && result.ok ? 200 : result.ok ? 400 : result.status || 502;
  res.status(status).json(result.data);
};

const handleYamatoError = (res: Response, error: unknown) => {
  if (error instanceof YamatoConfigurationError) {
    return res.status(500).json({ error: error.message });
  }
  const message = (error as any)?.message || "Yamato request failed.";
  return res.status(500).json({ error: message });
};

const verifyLineWebhook = (req: Request, res: Response, next: NextFunction) => {
  const channelSecret = runtimeConfig.lineChannelSecret || "";
  const signature = req.headers["x-line-signature"] as string | undefined;

  if (!signature || !channelSecret) {
    return res.status(401).send("Unauthorized");
  }

  const rawBody = (req as any).rawBody as Buffer | undefined;
  const bodyBuffer = rawBody ? rawBody : Buffer.from(JSON.stringify(req.body));

  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(bodyBuffer)
    .digest("base64");

  if (hash !== signature) {
    return res.status(401).send("Unauthorized");
  }

  next();
};

router.post("/webhook", verifyLineWebhook, async (req, res) => {
  try {
    const webhookHandler = new WebhookHandler();
    const events = req.body.events || [];

    console.log("Received webhook events:", events.length);

    await webhookHandler.handleEvents(events);

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/webhook", (_req, res) => {
  res.status(200).send("Webhook endpoint is active");
});

router.post("/webhook/setup", async (req, res) => {
  try {
    const { webhookUrl, channelAccessToken } = req.body;

    const response = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ endpoint: webhookUrl }),
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: "Failed to set webhook",
        error: await response.text(),
      });
    }

    const verifyResponse = await fetch("https://api.line.me/v2/bot/channel/webhook/test", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    });

    res.json({
      success: true,
      message: verifyResponse.ok ? "Webhook verified successfully" : "Webhook set but verification failed",
      webhookUrl,
    });
  } catch (error) {
    console.error("Webhook setup error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error });
  }
});

router.post("/line/richmenu/deploy", async (req, res) => {
  try {
    const {
      config,
      richMenuConfig,
      imageBase64,
      imageUrl,
      setDefault = true,
      liffAppId,
      channelAccessToken,
    } = req.body || {};

    const skipLineApi =
      runtimeConfig.skipLineApi || runtimeConfig.useMockLine || runtimeConfig.isEmulator;

    const accessToken =
      (channelAccessToken as string | undefined) ||
      runtimeConfig.lineAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!accessToken && !skipLineApi) {
      return res.status(400).json({
        error: "LINE channel access token is missing. Set LINE_CHANNEL_ACCESS_TOKEN on the server.",
      });
    }

    const defaultLiffUrl = liffAppId
      ? `https://liff.line.me/${liffAppId}`
      : runtimeConfig.liffUrl || process.env.LIFF_URL || "";

    const defaultConfig = {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "Farm2Market Main Menu",
      chatBarText: "Open menu",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 1686 },
          action: { type: "uri", uri: defaultLiffUrl || "https://liff.line.me/YOUR-APP-ID" },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
          action: { type: "postback", data: "source=richmenu&action=help", displayText: "Help" },
        },
      ],
    };

    const payloadConfig = config || richMenuConfig || {};
    const menuConfig = { ...defaultConfig, ...payloadConfig };

    const parseBase64Image = (
      data: string | undefined
    ): { buffer: Buffer; contentType: string } | null => {
      if (!data || typeof data !== "string") return null;

      const base64Match = data.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,(.+)$/);
      const contentType = base64Match?.[1] || "image/png";
      const base64Body = base64Match ? base64Match[2] : data;

      try {
        return {
          buffer: Buffer.from(base64Body, "base64"),
          contentType,
        };
      } catch (error) {
        console.error("Failed to parse base64 image", error);
        return null;
      }
    };

    const resolveImage = async () => {
      const base64Image = parseBase64Image(imageBase64);
      if (base64Image) return base64Image;

      if (typeof imageUrl === "string" && imageUrl.length) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Unable to fetch image from URL: ${response.status}`);
        }
        const contentType = response.headers.get("content-type") || "image/png";
        const arrayBuffer = await response.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), contentType };
      }

      return null;
    };

    if (skipLineApi) {
      const mockId = `richmenu-mock-${Date.now()}`;
      return res.json({
        success: true,
        skipped: true,
        richMenuId: mockId,
        message: "SKIP_LINE_API or emulator mode detected; returning mock richMenuId.",
        config: menuConfig,
      });
    }

    const manager = new RichMenuManager(accessToken);
    const richMenuId = await manager.createRichMenu(menuConfig);

    const image = await resolveImage();
    if (image) {
      await manager.uploadRichMenuImage(richMenuId, image.buffer, image.contentType);
    }

    if (setDefault) {
      await manager.setDefaultRichMenu(richMenuId);
    }

    res.json({
      success: true,
      richMenuId,
      uploadedImage: Boolean(image),
      setDefault: Boolean(setDefault),
    });
  } catch (error: any) {
    console.error("Rich menu deploy failed:", error);
    res.status(500).json({
      error: "Unable to deploy rich menu",
      details: error?.message || error,
    });
  }
});

router.get("/user/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const stats = await DatabaseService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

router.get("/user/:userId/products", async (req, res) => {
  try {
    const { userId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const products = await DatabaseService.getProductsByUser(userId);
    res.json(products);
  } catch (error) {
    console.error("Products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/user/:userId/products", async (req, res) => {
  try {
    const { userId } = req.params;
    const productData = req.body;

    const { DatabaseService } = await import("../lib/database-server");
    const result = await DatabaseService.createProduct(userId, productData);
    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.get("/user/:userId/stores", async (req, res) => {
  try {
    const { userId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const stores = await DatabaseService.getStoresByUser(userId);
    res.json(stores);
  } catch (error) {
    console.error("Stores error:", error);
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

router.post("/user/:userId/stores", async (req, res) => {
  try {
    const { userId } = req.params;
    const storeData = req.body;

    const { DatabaseService } = await import("../lib/database-server");
    const result = await DatabaseService.createStore(userId, storeData);
    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error("Create store error:", error);
    res.status(500).json({ error: "Failed to create store" });
  }
});

router.get("/user/:userId/conversations", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const { DatabaseService } = await import("../lib/database-server");
    const conversations = await DatabaseService.getRecentConversations(userId, limit);
    res.json(conversations);
  } catch (error) {
    console.error("Conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/user/:userId/marketing-materials", async (req, res) => {
  try {
    const { userId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const materials = await DatabaseService.getMarketingMaterialsByUser(userId);
    res.json(materials);
  } catch (error) {
    console.error("Marketing materials error:", error);
    res.status(500).json({ error: "Failed to fetch marketing materials" });
  }
});

// Saved addresses
router.get('/user/:userId/addresses', async (req, res) => {
  try {
    const { userId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const addresses = await DatabaseService.getSavedAddresses(userId);
    res.json({ addresses });
  } catch (error) {
    console.error('Fetch addresses error:', error);
    res.status(500).json({ error: 'Unable to fetch addresses' });
  }
});

router.post('/user/:userId/addresses', async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = req.body || {};
    const { DatabaseService } = await import("../lib/database-server");
    const result = await DatabaseService.upsertSavedAddress(userId, payload);
    const addresses = await DatabaseService.getSavedAddresses(userId);
    res.json({ success: true, id: result.id, addresses });
  } catch (error) {
    console.error('Save address error:', error);
    res.status(500).json({ error: 'Unable to save address' });
  }
});

router.delete('/user/:userId/addresses/:addressId', async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    await DatabaseService.deleteSavedAddress(userId, addressId);
    const addresses = await DatabaseService.getSavedAddresses(userId);
    res.json({ success: true, addresses });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Unable to delete address' });
  }
});

router.post("/auth/line/token", useMockLineApis ? mockExchangeCodeForToken : exchangeCodeForToken);
router.post("/auth/line/profile", useMockLineApis ? mockGetUserProfile : getUserProfile);

router.post('/auth/line', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken?: string };

    if (!idToken) {
      return res.status(400).json({ error: 'LIFF ID token is required' });
    }

    const lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_CHANNEL_ID || '',
      }),
    });

    if (!lineResponse.ok) {
      console.error('LINE token verification failed:', lineResponse.status);
      return res.status(401).json({ error: 'Invalid LIFF ID token' });
    }

    const lineUser = await lineResponse.json();
    console.log('LINE user verified:', lineUser.sub);

    const { default: admin } = await import("../lib/firebaseAdmin");
    const customToken = await admin.auth().createCustomToken(lineUser.sub, {
      lineUserId: lineUser.sub,
      displayName: lineUser.name,
      pictureUrl: lineUser.picture,
    });

    res.json({
      success: true,
      customToken,
      user: {
        lineUserId: lineUser.sub,
        displayName: lineUser.name,
        pictureUrl: lineUser.picture,
      },
    });
  } catch (error) {
    console.error('LINE authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/payments/line-pay/reserve', async (req: Request, res: Response) => {
  try {
    const { items, currency = 'TWD', successUrl, cancelUrl, buyer, metadata, shipping } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const normalizedItems: NormalizedOrderItem[] = items.map((item: any, index: number) => ({
      productId: String(item?.productId || item?.id || `product-${index + 1}`),
      name: String(item?.name || `Item ${index + 1}`),
      price: Number(item?.price || 0),
      quantity: Number(item?.quantity || 0),
      unit: item?.unit,
      imageUrl: item?.imageUrl,
    }));

    const invalidItem = normalizedItems.find((item) => !(item.price > 0) || !(item.quantity > 0));
    if (invalidItem) {
      return res.status(400).json({ error: `Invalid cart item detected: ${invalidItem.name}` });
    }

    const amount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Order total must be greater than zero.' });
    }

    const orderId =
      req.body?.orderId ||
      `F2M-${Date.now()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;

    const fallbackResultBase =
      typeof successUrl === 'string' && successUrl.length
        ? successUrl
        : `${runtimeConfig.frontendBaseUrl || 'http://localhost:8080'}/payments/line-pay/result`;

    const resolvedCancelUrl =
      typeof cancelUrl === 'string' && cancelUrl.length
        ? cancelUrl
        : `${fallbackResultBase}?status=cancelled`;

    const requiredShippingFields = ['fullName', 'phone', 'addressLine1', 'city', 'postalCode'];
    const missingShippingField = requiredShippingFields.find(
      (field) => !shipping || typeof shipping[field] !== 'string' || !shipping[field].trim()
    );

    if (missingShippingField) {
      return res.status(400).json({ error: 'Shipping details are incomplete.' });
    }

    const shippingSummary =
      shipping && typeof shipping === "object"
        ? `${shipping.city || ""} ${shipping.addressLine1 || ""}`.trim()
        : undefined;

    const sellerBundle = await resolveSellerBundles(normalizedItems);
    const { sellerIds, ownerByProductId } = sellerBundle;
    const itemsWithOwner = normalizedItems.map((item) => ({
      ...item,
      ownerId: ownerByProductId[item.productId],
    }));
    const { DatabaseService } = await import("../lib/database-server");

    await DatabaseService.createOrder({
      orderId,
      status: 'pending',
      paymentMethod: 'line_pay',
      amount,
      currency,
      items: itemsWithOwner,
      sellerIds,
      buyer,
      shipping,
      metadata: { ...(metadata ?? {}), paymentMethod: 'line_pay' },
      deliveryStatus: 'awaiting_pickup',
      redirectUrls: {
        successUrl: fallbackResultBase,
        cancelUrl: resolvedCancelUrl,
      },
    });

    const reserveResponse = await LinePayService.reservePayment({
      amount,
      currency,
      orderId,
      packages: [
        {
          id: 'cart',
          amount,
          products: normalizedItems.map((item) => ({
            id: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            imageUrl: item.imageUrl,
            productId: item.productId,
          })),
        },
      ],
      redirectUrls: {
        confirmUrl: fallbackResultBase,
        cancelUrl: resolvedCancelUrl,
      },
    });

    const reservedAt = await getServerTimestamp();

    await DatabaseService.updateOrder(orderId, {
      status: 'reserved',
      sellerIds,
      linePay: {
        transactionId: reserveResponse.info?.transactionId,
        paymentUrl: reserveResponse.info?.paymentUrl,
        reservedAt,
        rawReserveResponse: reserveResponse,
      },
    });

    notifySellersOfOrder({
      orderId,
      items: itemsWithOwner,
      buyerName: buyer?.displayName || buyer?.email || buyer?.userId,
      shippingSummary,
      paymentMethod: 'LINE Pay (pending)',
      preResolved: sellerBundle,
    }).catch((error) => {
      console.warn('LINE notification skipped for order', orderId, error);
    });

    res.json({
      orderId,
      amount,
      currency,
      transactionId: reserveResponse.info?.transactionId,
      paymentUrl: reserveResponse.info?.paymentUrl,
    });
  } catch (error: any) {
    console.error('LINE Pay reserve error:', error);
    if (error instanceof LinePayConfigurationError) {
      return res.status(500).json({ error: 'LINE Pay is not fully configured on the server.' });
    }
    res.status(500).json({ error: error?.message || 'Unable to create LINE Pay payment.' });
  }
});

router.post('/payments/line-pay/confirm', async (req: Request, res: Response) => {
  try {
    const { orderId, transactionId } = req.body || {};
    if (!orderId || !transactionId) {
      return res.status(400).json({ error: 'orderId and transactionId are required.' });
    }

    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'paid') {
      return res.json({ order });
    }

    if (order.linePay?.transactionId && order.linePay.transactionId !== transactionId) {
      return res.status(400).json({ error: 'Transaction mismatch for this order.' });
    }

    const confirmation = await LinePayService.confirmPayment(transactionId, order.amount, order.currency || 'TWD');

    const confirmedAt = await getServerTimestamp();

    await DatabaseService.updateOrder(orderId, {
      status: 'paid',
      linePay: {
        ...(order.linePay || {}),
        transactionId,
        confirmedAt,
        rawConfirmResponse: confirmation,
      },
    });

    const updatedOrder = await DatabaseService.getOrderByOrderId(orderId);
    res.json({ order: updatedOrder, confirmation });
  } catch (error: any) {
    console.error('LINE Pay confirm error:', error);
    if (error instanceof LinePayConfigurationError) {
      return res.status(500).json({ error: 'LINE Pay is not fully configured on the server.' });
    }
    res.status(500).json({ error: error?.message || 'Unable to confirm LINE Pay payment.' });
  }
});

router.post('/orders/:orderId/confirm', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    await DatabaseService.confirmOrder(orderId);

    // Notify farmer and buyer
    try {
      const bot = new LineBotAPI();
      const sellerIds = (order.sellerIds || []).filter(Boolean);
      const buyerId = order.buyer?.userId;
      const itemsSummary = (order.items || [])
        .slice(0, 6)
        .map((item) => `${item.name || '商品'} x${item.quantity || 1}`)
        .join(' • ');
      const shippingSummary = [
        order.shipping?.city,
        order.shipping?.addressLine1,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      const frontendBase =
        runtimeConfig.frontendBaseUrl ||
        process.env.FRONTEND_BASE_URL ||
        (runtimeConfig.liffUrl && !/liff\.line\.me/i.test(runtimeConfig.liffUrl) ? runtimeConfig.liffUrl : undefined) ||
        'https://farm2market.tw';
      const scheduleUrl = `${(frontendBase || '').replace(/\/$/, '')}/farmer/delivery?order=${encodeURIComponent(orderId)}`;
      const scheduleDialogUrl = `${scheduleUrl}&dialog=label`;
      const buyerScheduleUrl = `${(frontendBase || '').replace(/\/$/, '')}/market/schedule?order=${encodeURIComponent(orderId)}`;

      const sellerMessage: LineMessage = {
        type: "flex",
        altText: `訂單 ${orderId} 已確認`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            paddingAll: "14px",
            backgroundColor: "#ecfdf3",
            contents: [
              { type: "text", text: "訂單已確認", weight: "bold", size: "lg", color: "#166534" },
              { type: "text", text: `#${orderId}`, size: "sm", color: "#065f46" },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              { type: "text", text: "已移至配送排程，檢視路線並安排出貨。", wrap: true, size: "sm", color: "#111827" },
              itemsSummary
                ? {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      { type: "text", text: "品項", size: "xs", color: "#6b7280", flex: 2 },
                      { type: "text", text: itemsSummary, size: "sm", color: "#111827", wrap: true, flex: 8 },
                    ],
                  }
                : null,
              shippingSummary
                ? {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      { type: "text", text: "地址", size: "xs", color: "#6b7280", flex: 2 },
                      { type: "text", text: shippingSummary, size: "sm", color: "#111827", wrap: true, flex: 8 },
                    ],
                  }
                : null,
            ].filter(Boolean),
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#16a34a",
                height: "sm",
                action: {
                  type: "uri",
                  label: "開啟配送排程",
                  uri: scheduleDialogUrl,
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "uri",
                  label: "查看此訂單",
                  uri: scheduleDialogUrl,
                },
              },
            ],
          },
        },
      };

      const pickupDatesMessage: LineMessage = {
        type: "flex",
        altText: `請填寫取件與配達日期 #${orderId}`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            paddingAll: "14px",
            backgroundColor: "#fef3c7",
            contents: [
              { type: "text", text: "下一步：填寫取件與配達日期", weight: "bold", size: "md", color: "#92400e" },
              { type: "text", text: `#${orderId}`, size: "sm", color: "#92400e" },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "請輸入取件日期與希望配達日期，以完成託運單建立。",
                wrap: true,
                size: "sm",
                color: "#111827",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#16a34a",
                height: "sm",
                action: {
                  type: "uri",
                  label: "填寫取件/配達日期",
                  uri: scheduleDialogUrl,
                },
              },
            ],
          },
        },
      };

      const buyerMessage: LineMessage = {
        type: "flex",
        altText: `你的訂單 ${orderId} 已確認`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            paddingAll: "14px",
            backgroundColor: "#e0f2fe",
            contents: [
              { type: "text", text: "訂單已確認", weight: "bold", size: "lg", color: "#0f172a" },
              { type: "text", text: `#${orderId}`, size: "sm", color: "#0ea5e9" },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              { type: "text", text: "我們已收到並確認你的訂單，配送排程已更新。", wrap: true, size: "sm", color: "#0f172a" },
              itemsSummary
                ? {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      { type: "text", text: "內容", size: "xs", color: "#6b7280", flex: 2 },
                      { type: "text", text: itemsSummary, size: "sm", color: "#0f172a", wrap: true, flex: 8 },
                    ],
                  }
                : null,
              shippingSummary
                ? {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      { type: "text", text: "配送", size: "xs", color: "#6b7280", flex: 2 },
                      { type: "text", text: shippingSummary, size: "sm", color: "#0f172a", wrap: true, flex: 8 },
                    ],
                  }
                : null,
            ].filter(Boolean),
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#0ea5e9",
                height: "sm",
                action: {
                  type: "uri",
                  label: "查看配送進度",
                  uri: buyerScheduleUrl,
                },
              },
            ],
          },
        },
      };

      await Promise.all([
        sellerIds.length
          ? Promise.all(sellerIds.map((id) => bot.pushMessage(id, [sellerMessage, pickupDatesMessage])))
          : Promise.resolve(),
        buyerId ? bot.pushMessage(buyerId, [buyerMessage]) : Promise.resolve(),
      ]);
    } catch (notifyError) {
      console.warn('Notification failed after confirmation', notifyError);
    }

    const updated = await DatabaseService.getOrderByOrderId(orderId);
    res.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('Order confirm error:', error);
    res.status(500).json({ error: error?.message || 'Unable to confirm order.' });
  }
});

router.post('/orders/:orderId/decline', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await DatabaseService.updateOrder(orderId, { status: 'cancelled', deliveryStatus: 'cancelled' });

    try {
      const bot = new LineBotAPI();
      const buyerId = order.buyer?.userId;
      if (buyerId) {
        await bot.pushMessage(buyerId, [
          {
            type: "text",
            text: `訂單 ${orderId} 未被接受，請重新下單或聯絡農友。`,
          },
        ]);
      }
    } catch (notifyError) {
      console.warn('Decline notification failed', notifyError);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Order decline error:', error);
    res.status(500).json({ error: error?.message || 'Unable to decline order.' });
  }
});

router.post('/orders/cod', async (req: Request, res: Response) => {
  try {
    const { items, currency = 'TWD', buyer, shipping, metadata } = req.body || {};
    console.log('[COD] Incoming order request', {
      itemCount: Array.isArray(items) ? items.length : 0,
      buyerId: buyer?.userId,
      buyerName: buyer?.displayName || buyer?.email,
      shippingCity: shipping?.city,
      shippingLine1: shipping?.addressLine1,
    });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const normalizedItems: NormalizedOrderItem[] = items.map((item: any, index: number) => ({
      productId: String(item?.productId || item?.id || `product-${index + 1}`),
      name: String(item?.name || `Item ${index + 1}`),
      price: Number(item?.price || 0),
      quantity: Number(item?.quantity || 0),
      unit: item?.unit,
      imageUrl: item?.imageUrl,
    }));

    const invalidItem = normalizedItems.find((item) => !(item.price > 0) || !(item.quantity > 0));
    if (invalidItem) {
      return res.status(400).json({ error: `Invalid cart item detected: ${invalidItem.name}` });
    }

    const amount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Order total must be greater than zero.' });
    }

    const orderId =
      req.body?.orderId ||
      `COD-${Date.now()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;

    const requiredShippingFields = ['fullName', 'phone', 'addressLine1', 'city', 'postalCode'];
    const missingShippingField = requiredShippingFields.find(
      (field) => !shipping || typeof shipping[field] !== 'string' || !shipping[field].trim()
    );

    if (missingShippingField) {
      return res.status(400).json({ error: 'Shipping details are incomplete.' });
    }

    const shippingSummary =
      shipping && typeof shipping === "object"
        ? `${shipping.city || ""} ${shipping.addressLine1 || ""}`.trim()
        : undefined;

    const buyerUserId = typeof buyer?.userId === 'string' && buyer.userId.trim()
      ? buyer.userId
      : (typeof buyer?.lineUserId === 'string' && buyer.lineUserId.trim() ? buyer.lineUserId : undefined);
    const normalizedBuyer = {
      ...(buyer || {}),
      userId: buyerUserId || `guest-${Date.now()}`,
      role: (buyer && (buyer as any).role) || 'market',
      source: (buyer && (buyer as any).source) || 'web',
    };

    const sellerBundle = await resolveSellerBundles(normalizedItems);
    const { sellerIds, ownerByProductId } = sellerBundle;
    const itemsWithOwner = normalizedItems.map((item) => ({
      ...item,
      ownerId: ownerByProductId[item.productId],
    }));
    const { DatabaseService } = await import("../lib/database-server");

    await DatabaseService.createOrder({
      orderId,
      status: 'pending',
      paymentMethod: 'cod',
      amount,
      currency,
      items: itemsWithOwner,
      sellerIds,
      buyer: normalizedBuyer,
      shipping,
      metadata: { ...(metadata ?? {}), paymentMethod: 'cod' },
      deliveryStatus: 'awaiting_pickup',
    });

    console.log('[COD] Order persisted', { orderId, sellerIds, amount, currency });

    notifySellersOfOrder({
      orderId,
      items: itemsWithOwner,
      buyerName: buyer?.displayName || buyer?.email || buyer?.userId,
      shippingSummary,
      paymentMethod: 'COD',
      preResolved: sellerBundle,
    }).catch((error) => {
      console.warn('LINE notification skipped for COD order', orderId, error);
    });

    res.json({
      orderId,
      amount,
      currency,
      sellerIds,
      message: 'Order placed with cash on delivery.',
    });
  } catch (error: any) {
    console.error('[COD] Order error:', error);
    res.status(500).json({ error: error?.message || 'Unable to create order.' });
  }
});

router.get('/payments/line-pay/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const safeLinePay = order.linePay
      ? {
          ...order.linePay,
          rawConfirmResponse: undefined,
          rawReserveResponse: undefined,
        }
      : undefined;

    res.json({
      order: {
        ...order,
        linePay: safeLinePay,
      },
    });
  } catch (error) {
    console.error('Fetch order error:', error);
    res.status(500).json({ error: 'Unable to fetch order.' });
  }
});

router.get('/payments/line-pay/status', (_req: Request, res: Response) => {
  const issues: string[] = [];
  const hasChannelId = Boolean(runtimeConfig.linePayChannelId);
  const hasChannelSecret = Boolean(runtimeConfig.linePayChannelSecret);
  if (!hasChannelId) {
    issues.push('LINE_PAY_CHANNEL_ID (or Functions config linepay.channel_id) is missing.');
  }
  if (!hasChannelSecret) {
    issues.push('LINE_PAY_CHANNEL_SECRET (or Functions config linepay.channel_secret) is missing.');
  }

  const frontendBaseUrl = runtimeConfig.frontendBaseUrl || '';
  const sampleConfirmUrl = frontendBaseUrl
    ? `${frontendBaseUrl.replace(/\/$/, '')}/payments/line-pay/result`
    : '';

  res.json({
    configured: hasChannelId && hasChannelSecret,
    hasChannelId,
    hasChannelSecret,
    sandbox: runtimeConfig.linePaySandbox !== false,
    frontendBaseUrl,
    sampleConfirmUrl,
    apiBaseUrl: runtimeConfig.apiBaseUrl || '',
    issues,
  });
});

router.get('/logistics/yamato/config', (_req: Request, res: Response) => {
  res.json(getYamatoConfigSummary());
});

router.post('/logistics/address/geocode', async (req: Request, res: Response) => {
  try {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) {
      return res.status(400).json({ error: "query is required." });
    }
    const limit = Number.isFinite(req.body?.limit) ? Number(req.body.limit) : 5;
    const result = await geocodeAddress(query, Math.min(Math.max(limit, 1), 10));
    return res.json(result);
  } catch (error) {
    const message = (error as any)?.message || "Address lookup failed.";
    return res.status(500).json({ error: message });
  }
});

router.post('/logistics/address/reverse', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat/lng are required." });
    }
    const limit = Number.isFinite(req.body?.limit) ? Number(req.body.limit) : 5;
    const result = await reverseGeocode(lat, lng, Math.min(Math.max(limit, 1), 10));
    return res.json(result);
  } catch (error) {
    const message = (error as any)?.message || "Reverse geocoding failed.";
    return res.status(500).json({ error: message });
  }
});

router.post('/logistics/yamato/resolve-zip', async (req: Request, res: Response) => {
  try {
    const rawAddress = typeof req.body?.address === "string" ? req.body.address.trim() : "";
    const address = normalizeTaiwanAddress(rawAddress);
    if (!address) {
      return res.status(400).json({ error: "address is required." });
    }
    const result = await YamatoService.parseAddress({
      PostType: "01",
      Addresses: [{ Search: address }],
    });
    if (!result.ok || result.data?.IsOK !== "Y") {
      return res.status(result.status || 400).json({
        error: "Unable to resolve zip code.",
        raw: result.data,
      });
    }
    const addresses = (result.data as any)?.Data?.Addresses || [];
    const postNumber = addresses?.[0]?.PostNumber || "";
    const yamatoZipCode = extractYamatoZipCode(postNumber);
    if (!yamatoZipCode) {
      return res.status(400).json({
        error: "No postal code returned for address.",
        raw: result.data,
      });
    }
    res.json({
      address,
      normalizedAddress: address,
      postNumber,
      yamatoZipCode,
      raw: result.data,
    });
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/parse-address', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.parseAddress(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/print-obt', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.printOBT(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/print-obt-picking-list', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.printOBTByPickingList(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/print-obt-b2s', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.printOBTByB2S(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/download-obt', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.downloadOBT(req.body || {});
    if (result.kind === 'json') {
      const status = result.ok && result.data?.IsOK === "Y" ? 200 : result.status || 400;
      return res.status(status).json(result.data);
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', result.contentDisposition || 'attachment; filename="yamato-label.pdf"');
    return res.status(result.status || 200).send(result.data);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/download-obt-line', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const fileNo = typeof payload.FileNo === 'string' ? payload.FileNo.trim() : '';
    const orderId = typeof payload.orderId === 'string' ? payload.orderId.trim() : '';
    if (!fileNo) {
      return res.status(400).json({ ok: false, error: 'FileNo is required.' });
    }

    const traceId = crypto.randomUUID();
    const lineIdToken = getLineIdTokenFromRequest(req);
    const lineAccessToken = getLineAccessTokenFromRequest(req);
    console.log('[download-obt-line] start', {
      traceId,
      fileNoSuffix: fileNo.slice(-6),
      orderIdSuffix: orderId ? orderId.slice(-6) : '',
      hasLineIdToken: Boolean(lineIdToken),
      hasLineAccessTokenFromRequest: Boolean(lineAccessToken),
      hasLineChannelAccessToken: Boolean(runtimeConfig.lineAccessToken),
      hasLineChannelId: Boolean(runtimeConfig.lineChannelId),
      hasLineLoginChannelId: Boolean(runtimeConfig.lineLoginChannelId),
      isEmulator: runtimeConfig.isEmulator,
      useMockLine: runtimeConfig.useMockLine,
      skipLineApi: runtimeConfig.skipLineApi,
    });

    const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
    const authorizedUserId = await getAuthorizedUserId(req);
    const targetUserId =
      authorizedUserId ||
      ((runtimeConfig.isEmulator || runtimeConfig.useMockLine) ? lineUserId : '');
    if (!targetUserId) {
      console.warn('[download-obt-line] auth failed', {
        traceId,
        lineUserIdSuffix: lineUserId ? lineUserId.slice(-6) : '',
      });
      return res.status(401).json({ ok: false, error: 'LINE authentication required.' });
    }
    console.log('[download-obt-line] auth ok', {
      traceId,
      targetUserIdSuffix: targetUserId.slice(-6),
    });

    let order: OrderRecord | null = null;
    if (orderId) {
      try {
        const { DatabaseService } = await import('../lib/database-server');
        const fetched = await DatabaseService.getOrderByOrderId(orderId);
        if (fetched) {
          const isSeller = Array.isArray(fetched.sellerIds) && fetched.sellerIds.includes(targetUserId);
          const isBuyer = fetched.buyer?.userId === targetUserId;
          if (isSeller || isBuyer) {
            order = fetched;
          } else {
            console.warn('[download-obt-line] order not linked to user', {
              traceId,
              orderIdSuffix: orderId.slice(-6),
              targetUserIdSuffix: targetUserId.slice(-6),
            });
          }
        }
      } catch (error) {
        console.warn('[download-obt-line] order lookup failed', {
          traceId,
          orderIdSuffix: orderId.slice(-6),
          error: (error as Error)?.message || error,
        });
      }
    }

    const result = await YamatoService.downloadOBT({ FileNo: fileNo });
    if (result.kind === 'json') {
      const status = result.ok && result.data?.IsOK === "Y" ? 200 : result.status || 400;
      console.warn('[download-obt-line] yamato download failed', {
        traceId,
        status,
        message: result.data?.Message,
      });
      return res.status(status).json({ ok: false, error: result.data?.Message || 'Unable to download label.' });
    }
    console.log('[download-obt-line] yamato download ok', {
      traceId,
      contentType: result.contentType,
      size: result.data.length,
    });

    const { default: admin } = await import('../lib/firebaseAdmin');
    const bucket = admin.storage().bucket();
    const fileId = crypto.randomUUID();
    const fileName = `yamato-label-${fileNo || fileId}.pdf`;
    const filePath = `yamato_labels/${targetUserId}/${fileId}.pdf`;
    const file = bucket.file(filePath);

    await file.save(result.data, {
      contentType: result.contentType || 'application/pdf',
      resumable: false,
      metadata: { cacheControl: 'public,max-age=3600' },
    });
    console.log('[download-obt-line] storage saved', {
      traceId,
      filePath,
      contentType: result.contentType || 'application/pdf',
    });

    let signedUrl: string;
    try {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      signedUrl = url;
    } catch (signError: any) {
      const message = String(signError?.message || '');
      if (message.includes('iam.serviceAccounts.signBlob') || message.includes('SigningError')) {
        await file.makePublic();
        signedUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`;
      } else {
        throw signError;
      }
    }
    console.log('[download-obt-line] signed url ready', {
      traceId,
      urlHost: (() => {
        try {
          return new URL(signedUrl).host;
        } catch {
          return '';
        }
      })(),
    });

    const fileSize = result.data.length;
    const formatOrderAmount = (amount: number, currency?: string) => {
      if (!Number.isFinite(amount)) return '';
      const code = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'TWD';
      try {
        return new Intl.NumberFormat('zh-TW', {
          style: 'currency',
          currency: code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${amount.toLocaleString('zh-TW')} ${code}`;
      }
    };

    const buildLabelFlex = (
      note: string,
      actionUrl?: string,
      orderInfo?: OrderRecord | null
    ): LineMessage => {
      const buyerName =
        typeof orderInfo?.buyer?.displayName === 'string' && orderInfo.buyer.displayName.trim()
          ? orderInfo.buyer.displayName.trim()
          : '';
      const totalText = orderInfo ? formatOrderAmount(orderInfo.amount, orderInfo.currency) : '';
      const items = Array.isArray(orderInfo?.items) ? orderInfo?.items : [];
      const itemLines = items.slice(0, 4).map((item) => {
        const name = item.name || '商品';
        const qty = Number(item.quantity || 0);
        const unit = item.unit ? ` ${item.unit}` : '';
        const qtyText = qty ? `x${qty}${unit}` : '';
        return {
          type: 'text',
          text: qtyText ? `${name} ${qtyText}` : name,
          size: 'sm',
          color: '#111827',
          wrap: true,
        };
      });
      const remaining = items.length - itemLines.length;
      if (remaining > 0) {
        itemLines.push({
          type: 'text',
          text: `另有 ${remaining} 項`,
          size: 'xs',
          color: '#6b7280',
          wrap: true,
        });
      }

      const detailItems: any[] = [];
      if (orderInfo?.orderId) {
        detailItems.push({
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '訂單編號', size: 'xs', color: '#6b7280', flex: 3 },
            { type: 'text', text: orderInfo.orderId, size: 'sm', color: '#111827', wrap: true, flex: 7 },
          ],
        });
      }
      if (buyerName) {
        detailItems.push({
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '買家', size: 'xs', color: '#6b7280', flex: 3 },
            { type: 'text', text: buyerName, size: 'sm', color: '#111827', wrap: true, flex: 7 },
          ],
        });
      }
      if (totalText) {
        detailItems.push({
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '訂單金額', size: 'xs', color: '#6b7280', flex: 3 },
            { type: 'text', text: totalText, size: 'sm', color: '#111827', wrap: true, flex: 7 },
          ],
        });
      }
      if (itemLines.length) {
        detailItems.push(
          { type: 'text', text: '商品明細', size: 'xs', color: '#6b7280' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: itemLines }
        );
      }

      const contents: any = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '12px',
          backgroundColor: '#ecfdf5',
          contents: [
            { type: 'text', text: '託運單已準備完成', weight: 'bold', size: 'lg', color: '#065f46' },
            orderInfo?.orderId
              ? { type: 'text', text: `訂單編號：${orderInfo.orderId}`, size: 'sm', color: '#166534', wrap: true }
              : null,
            { type: 'text', text: '黑貓宅急便託運單', size: 'sm', color: '#166534' },
          ].filter(Boolean),
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: note, size: 'sm', color: '#111827', wrap: true },
            detailItems.length
              ? { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: detailItems }
              : null,
          ].filter(Boolean),
        },
      };

      if (actionUrl) {
        contents.footer = {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#16a34a',
              action: { type: 'uri', label: '開啟託運單', uri: actionUrl },
            },
          ],
        };
      }

      return {
        type: 'flex',
        altText: orderInfo?.orderId ? `託運單已準備完成 #${orderInfo.orderId}` : '託運單已準備完成',
        contents,
      };
    };

    const bot = new LineBotAPI();
    const labelFlex = buildLabelFlex('點擊下方按鈕查看並下載託運單。', signedUrl, order);
    const fileMessage: LineMessage = {
      type: 'file',
      originalContentUrl: signedUrl,
      fileName,
      fileSize,
    };

    try {
      await bot.pushMessage(targetUserId, [labelFlex]);
      console.log('[download-obt-line] card sent', { traceId });
    } catch (error) {
      console.warn('[download-obt-line] card send failed', { traceId, error });
      throw error;
    }

    let fileSent = false;
    try {
      await bot.pushMessage(targetUserId, [fileMessage]);
      fileSent = true;
      console.log('[download-obt-line] file sent', { traceId, fileSize });
    } catch (error) {
      console.warn('[download-obt-line] file send failed', { traceId, error });
    }

    return res.status(200).json({ ok: true, url: signedUrl, fileName, fileSent, traceId });
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/call', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const result = await YamatoService.callPickup({
      ...payload,
      IsContact: normalizeYamatoFlag(payload.IsContact, "N"),
      IsTrolley: normalizeYamatoFlag(payload.IsTrolley, "N"),
    });
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/reserve-add', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.reserveAdd(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/reserve-edit', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.reserveEdit(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/reserve-delete', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.reserveDelete(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/reserve-query', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.reserveQuery(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/logistics/yamato/obt-status', async (req: Request, res: Response) => {
  try {
    const result = await YamatoService.obtStatus(req.body || {});
    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/orders/:orderId/logistics/yamato/print-obt', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payload = req.body || {};
    const {
      recipientName,
      recipientAddress,
      recipientTel,
      recipientMobile,
      productName,
      productTypeId,
      senderName,
      senderTel,
      senderMobile,
      senderZipCode,
      senderAddress,
      receiptLocation,
      receiptStationNo,
      splitBySeller,
      sellerId,
      sellerIds,
      Orders,
      ...restPayload
    } = payload;
    const rawOrders = Array.isArray(Orders) ? Orders : [];
    if (!rawOrders.length && !splitBySeller) {
      return res.status(400).json({ error: "Orders is required for PrintOBT." });
    }

    const resolvedRecipientName = recipientName || order.shipping?.fullName || "";
    const resolvedRecipientAddress = recipientAddress || formatShippingAddress(order.shipping);
    if (!resolvedRecipientName || !resolvedRecipientAddress) {
      return res.status(400).json({ error: "Order shipping data is incomplete for recipient." });
    }

    const phones = resolveRecipientPhones(order.shipping?.phone, { recipientTel, recipientMobile });
    const receipt = resolveReceiptLocation(order, { receiptLocation, receiptStationNo });
    if (receipt.receiptLocation === "02" && !receipt.receiptStationNo) {
      return res.status(400).json({ error: "ReceiptStationNo is required for pickup station shipments." });
    }
    const printDefaults = resolvePrintOBTDefaults(restPayload, order);

    if (splitBySeller) {
      const dateError = validateYamatoShipmentDates(
        printDefaults.ShipmentDate,
        printDefaults.DeliveryDate
      );
      if (dateError) {
        return res.status(400).json({ error: dateError });
      }
      const normalizedItems = normalizeOrderItems(order);
      const sellerBundle = await resolveSellerBundles(normalizedItems);
      const { ownerByProductId, productById, sellerProfiles } = sellerBundle;
      const { groups, missingProductIds } = buildSellerPickupGroups(
        normalizedItems,
        ownerByProductId,
        productById
      );
      if (missingProductIds.length) {
        return res.status(400).json({
          error: "Missing pickup address or Yamato zip code for some products.",
          missingProductIds: Array.from(new Set(missingProductIds)),
        });
      }

      const sellerFilter = Array.isArray(sellerIds)
        ? sellerIds.filter((id: any) => typeof id === "string")
        : typeof sellerId === "string"
        ? [sellerId]
        : null;
      const filteredGroups = sellerFilter
        ? groups.filter((group) => sellerFilter.includes(group.sellerId))
        : groups;
      if (!filteredGroups.length) {
        return res.status(400).json({ error: "No pickup groups matched the provided seller filter." });
      }

      const results: Array<{
        sellerId: string;
        pickupKey: string;
        response: YamatoResponse;
      }> = [];
      let buyerLabelReady = false;

      for (const [index, group] of filteredGroups.entries()) {
        const pickup = group.pickup;
        const senderLabel =
          pickup.contactName || sellerProfiles[group.sellerId]?.displayName || senderName || "Sender";
        const senderPhones = resolveSenderPhones({
          contactTel: pickup.contactTel,
          contactMobile: pickup.contactMobile,
          fallbackTel: senderTel,
          fallbackMobile: senderMobile,
        });
        if (!senderPhones.SenderTel && !senderPhones.SenderMobile) {
          return res.status(400).json({
            error: "Pickup contact phone is required for sender.",
            sellerId: group.sellerId,
          });
        }

        const groupTotal = group.items.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
          0
        );
        const orderEntry = {
          OBTNumber: "",
          OrderId: `${orderId}-${index + 1}`,
          Thermosphere: printDefaults.Thermosphere,
          Spec: printDefaults.Spec,
          RecipientName: resolvedRecipientName,
          RecipientTel: phones.RecipientTel,
          RecipientMobile: phones.RecipientMobile,
          RecipientAddress: resolvedRecipientAddress,
          ReceiptLocation: receipt.receiptLocation,
          ReceiptStationNo: receipt.receiptStationNo || "",
          SenderName: senderLabel,
          SenderTel: senderPhones.SenderTel,
          SenderMobile: senderPhones.SenderMobile,
          SenderZipCode: pickup.yamatoZipCode,
          SenderAddress: pickup.address,
          ShipmentDate: printDefaults.ShipmentDate,
          DeliveryDate: printDefaults.DeliveryDate,
          DeliveryTime: printDefaults.DeliveryTime,
          IsFreight: printDefaults.IsFreight,
          IsCollection: printDefaults.IsCollection,
          ProductName: productName || buildProductSummary(group.items),
          ProductTypeId: productTypeId || "0015",
          CollectionAmount:
            printDefaults.IsCollection === "Y"
              ? Math.max(0, Math.round(groupTotal))
              : Math.max(0, Math.round(Number(restPayload.CollectionAmount || 0))),
          IsSwipe: printDefaults.IsSwipe,
          IsDeclare: printDefaults.IsDeclare,
        };

        const result = await YamatoService.printOBT({
          ...restPayload,
          Orders: [orderEntry],
        });

        if (result.ok && result.data?.IsOK === "Y") {
          const data = result.data?.Data as any;
          const orders = Array.isArray(data?.Orders) ? data.Orders : [];
          const shipment: YamatoShipmentRecord = {
            service: "PrintOBT",
            sellerId: group.sellerId,
            fileNo: data?.FileNo || orders?.[0]?.FileNo,
            printDateTime: data?.PrintDateTime,
            orders: orders.length
              ? normalizeShipmentOrders(orders)
              : undefined,
            createdAt: await getArrayTimestamp(),
          };
          await appendOrderShipment(orderId, order, shipment);
          buyerLabelReady = true;
          try {
            await notifySellersLabelReady([group.sellerId], {
              orderId,
              fileNo: shipment.fileNo,
              obtNumbers: orders.map((item: any) => item?.OBTNumber).filter(Boolean),
            });
          } catch (notifyError) {
            console.warn('Yamato label LINE notification failed', notifyError);
          }
        }

        results.push({ sellerId: group.sellerId, pickupKey: group.pickupKey, response: result.data });
      }

      if (buyerLabelReady) {
        try {
          await notifyBuyerLabelReady(order, {
            orderId,
            scheduleUrl: buildBuyerScheduleUrl(orderId),
          });
        } catch (notifyError) {
          console.warn('Buyer label LINE notification failed', notifyError);
        }
      }

      return res.json({ split: true, results });
    }

    const needsSenderFallback = rawOrders.some((entry: Record<string, any>) => !hasSenderFields(entry));
    const sender = needsSenderFallback
      ? resolveYamatoSender({ senderName, senderTel, senderMobile, senderZipCode, senderAddress })
      : null;
    const enrichedOrders = rawOrders.map((entry: Record<string, any>, index: number) => {
      const isCollection = normalizeYamatoFlag(
        entry.IsCollection ?? printDefaults.IsCollection,
        printDefaults.IsCollection
      );
      const collectionAmount =
        isCollection === "Y"
          ? Math.max(
              0,
              Math.round(
                Number(entry.CollectionAmount ?? restPayload.CollectionAmount ?? order.amount ?? 0)
              )
            )
          : 0;
      return {
        ...entry,
        OrderId: entry.OrderId || (index === 0 ? orderId : `${orderId}-${index + 1}`),
        OBTNumber: entry.OBTNumber ?? "",
        Thermosphere: normalizeYamatoCode(entry.Thermosphere, printDefaults.Thermosphere),
        Spec: normalizeYamatoCode(entry.Spec, printDefaults.Spec),
        RecipientName: entry.RecipientName || resolvedRecipientName,
        RecipientTel: entry.RecipientTel || phones.RecipientTel,
        RecipientMobile: entry.RecipientMobile || phones.RecipientMobile,
        RecipientAddress: entry.RecipientAddress || resolvedRecipientAddress,
        ReceiptLocation: entry.ReceiptLocation || receipt.receiptLocation,
        ReceiptStationNo: entry.ReceiptStationNo || receipt.receiptStationNo || "",
        SenderName: entry.SenderName || sender?.name,
        SenderTel: entry.SenderTel || sender?.tel,
        SenderMobile: entry.SenderMobile || sender?.mobile,
        SenderZipCode: entry.SenderZipCode || sender?.zipCode,
        SenderAddress: entry.SenderAddress || sender?.address,
        ShipmentDate: normalizeYamatoDate(entry.ShipmentDate) || printDefaults.ShipmentDate,
        DeliveryDate: normalizeYamatoDate(entry.DeliveryDate) || printDefaults.DeliveryDate,
        DeliveryTime: normalizeYamatoTime(entry.DeliveryTime, printDefaults.DeliveryTime),
        IsFreight: normalizeYamatoFlag(entry.IsFreight ?? printDefaults.IsFreight, printDefaults.IsFreight),
        IsCollection: isCollection,
        ProductName: entry.ProductName || productName || order.items?.[0]?.name || "Item",
        ProductTypeId: entry.ProductTypeId || productTypeId || "0015",
        CollectionAmount: collectionAmount,
        IsSwipe: normalizeYamatoFlag(entry.IsSwipe ?? printDefaults.IsSwipe, printDefaults.IsSwipe),
        IsDeclare: normalizeYamatoFlag(entry.IsDeclare ?? printDefaults.IsDeclare, printDefaults.IsDeclare),
      };
    });

    let dateError: string | null = null;
    let dateErrorOrderId: string | undefined;
    for (const entry of enrichedOrders) {
      const entryError = validateYamatoShipmentDates(entry.ShipmentDate, entry.DeliveryDate);
      if (entryError) {
        dateError = entryError;
        dateErrorOrderId = entry.OrderId;
        break;
      }
    }
    if (dateError) {
      return res.status(400).json({
        error: dateError,
        orderId: dateErrorOrderId,
      });
    }

    const result = await YamatoService.printOBT({
      ...restPayload,
      Orders: enrichedOrders,
    });

    if (result.ok && result.data?.IsOK === "Y") {
      const data = result.data?.Data as any;
      const printDateTime = data?.PrintDateTime;
      const orders = Array.isArray(data?.Orders) ? data.Orders : [];
      const shipment: YamatoShipmentRecord = {
        service: "PrintOBT",
        fileNo: data?.FileNo || orders?.[0]?.FileNo,
        printDateTime,
        orders: normalizeShipmentOrders(orders),
        createdAt: await getArrayTimestamp(),
      };
      await appendOrderShipment(orderId, order, shipment);
      try {
        await notifySellersLabelReady(order.sellerIds || [], {
          orderId,
          fileNo: shipment.fileNo,
          obtNumbers: orders.map((item: any) => item?.OBTNumber).filter(Boolean),
        });
      } catch (notifyError) {
        console.warn('Yamato label LINE notification failed', notifyError);
      }
      try {
        await notifyBuyerLabelReady(order, {
          orderId,
          scheduleUrl: buildBuyerScheduleUrl(orderId),
        });
      } catch (notifyError) {
        console.warn('Buyer label LINE notification failed', notifyError);
      }
    }

    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/orders/:orderId/logistics/yamato/print-obt-picking-list', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payload = req.body || {};
    const {
      recipientName,
      recipientAddress,
      recipientTel,
      recipientMobile,
      productName,
      productTypeId,
      senderName,
      senderTel,
      senderMobile,
      senderZipCode,
      senderAddress,
      receiptLocation,
      receiptStationNo,
      Orders,
      ...restPayload
    } = payload;
    const rawOrders = Array.isArray(Orders) ? Orders : [];
    if (!rawOrders.length) {
      return res.status(400).json({ error: "Orders is required for PrintOBTByPickingList." });
    }

    const resolvedRecipientName = recipientName || order.shipping?.fullName || "";
    const resolvedRecipientAddress = recipientAddress || formatShippingAddress(order.shipping);
    if (!resolvedRecipientName || !resolvedRecipientAddress) {
      return res.status(400).json({ error: "Order shipping data is incomplete for recipient." });
    }

    const phones = resolveRecipientPhones(order.shipping?.phone, { recipientTel, recipientMobile });
    const receipt = resolveReceiptLocation(order, { receiptLocation, receiptStationNo });
    if (receipt.receiptLocation === "02" && !receipt.receiptStationNo) {
      return res.status(400).json({ error: "ReceiptStationNo is required for pickup station shipments." });
    }
    const printDefaults = resolvePrintOBTDefaults(restPayload, order);

    const needsSenderFallback = rawOrders.some((entry: Record<string, any>) => !hasSenderFields(entry));
    const sender = needsSenderFallback
      ? resolveYamatoSender({ senderName, senderTel, senderMobile, senderZipCode, senderAddress })
      : null;

    const enrichedOrders = rawOrders.map((entry: Record<string, any>, index: number) => {
      const isCollection = normalizeYamatoFlag(
        entry.IsCollection ?? printDefaults.IsCollection,
        printDefaults.IsCollection
      );
      const collectionAmount =
        isCollection === "Y"
          ? Math.max(
              0,
              Math.round(
                Number(entry.CollectionAmount ?? restPayload.CollectionAmount ?? order.amount ?? 0)
              )
            )
          : 0;
      return {
        ...entry,
        OrderId: entry.OrderId || (index === 0 ? orderId : `${orderId}-${index + 1}`),
        OBTNumber: entry.OBTNumber ?? "",
        Thermosphere: normalizeYamatoCode(entry.Thermosphere, printDefaults.Thermosphere),
        Spec: normalizeYamatoCode(entry.Spec, printDefaults.Spec),
        RecipientName: entry.RecipientName || resolvedRecipientName,
        RecipientTel: entry.RecipientTel || phones.RecipientTel,
        RecipientMobile: entry.RecipientMobile || phones.RecipientMobile,
        RecipientAddress: entry.RecipientAddress || resolvedRecipientAddress,
        ReceiptLocation: entry.ReceiptLocation || receipt.receiptLocation,
        ReceiptStationNo: entry.ReceiptStationNo || receipt.receiptStationNo || "",
        SenderName: entry.SenderName || sender?.name,
        SenderTel: entry.SenderTel || sender?.tel,
        SenderMobile: entry.SenderMobile || sender?.mobile,
        SenderZipCode: entry.SenderZipCode || sender?.zipCode,
        SenderAddress: entry.SenderAddress || sender?.address,
        ShipmentDate: normalizeYamatoDate(entry.ShipmentDate) || printDefaults.ShipmentDate,
        DeliveryDate: normalizeYamatoDate(entry.DeliveryDate) || printDefaults.DeliveryDate,
        DeliveryTime: normalizeYamatoTime(entry.DeliveryTime, printDefaults.DeliveryTime),
        IsFreight: normalizeYamatoFlag(entry.IsFreight ?? printDefaults.IsFreight, printDefaults.IsFreight),
        IsCollection: isCollection,
        ProductName: entry.ProductName || productName || order.items?.[0]?.name || "Item",
        ProductTypeId: entry.ProductTypeId || productTypeId || "0015",
        CollectionAmount: collectionAmount,
        IsSwipe: normalizeYamatoFlag(entry.IsSwipe ?? printDefaults.IsSwipe, printDefaults.IsSwipe),
        IsDeclare: normalizeYamatoFlag(entry.IsDeclare ?? printDefaults.IsDeclare, printDefaults.IsDeclare),
      };
    });

    let dateError: string | null = null;
    let dateErrorOrderId: string | undefined;
    for (const entry of enrichedOrders) {
      const entryError = validateYamatoShipmentDates(entry.ShipmentDate, entry.DeliveryDate);
      if (entryError) {
        dateError = entryError;
        dateErrorOrderId = entry.OrderId;
        break;
      }
    }
    if (dateError) {
      return res.status(400).json({
        error: dateError,
        orderId: dateErrorOrderId,
      });
    }

    const result = await YamatoService.printOBTByPickingList({
      ...restPayload,
      Orders: enrichedOrders,
    });

    if (result.ok && result.data?.IsOK === "Y") {
      const data = result.data?.Data as any;
      const printDateTime = data?.PrintDateTime;
      const orders = Array.isArray(data?.Orders) ? data.Orders : [];
      const shipment: YamatoShipmentRecord = {
        service: "PrintOBTByPickingList",
        fileNo: data?.FileNo || orders?.[0]?.FileNo,
        printDateTime,
        orders: normalizeShipmentOrders(orders),
        createdAt: await getArrayTimestamp(),
      };
      await appendOrderShipment(orderId, order, shipment);
      try {
        await notifySellersLabelReady(order.sellerIds || [], {
          orderId,
          fileNo: shipment.fileNo,
          obtNumbers: orders.map((item: any) => item?.OBTNumber).filter(Boolean),
        });
      } catch (notifyError) {
        console.warn('Yamato label LINE notification failed', notifyError);
      }
      try {
        await notifyBuyerLabelReady(order, {
          orderId,
          scheduleUrl: buildBuyerScheduleUrl(orderId),
        });
      } catch (notifyError) {
        console.warn('Buyer label LINE notification failed', notifyError);
      }
    }

    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/orders/:orderId/logistics/yamato/print-obt-b2s', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payload = req.body || {};
    const {
      recipientName,
      recipientTel,
      recipientMobile,
      senderName,
      senderTel,
      senderMobile,
      senderZipCode,
      senderAddress,
      receiveStoreId: defaultReceiveStoreId,
      splitBySeller,
      sellerId,
      sellerIds,
      Orders,
      ...restPayload
    } = payload;
    const rawOrders = Array.isArray(Orders) ? Orders : [];
    if (!rawOrders.length && !splitBySeller) {
      return res.status(400).json({ error: "Orders is required for PrintOBTByB2S." });
    }

    const resolvedRecipientName = recipientName || order.shipping?.fullName || "";
    if (!resolvedRecipientName) {
      return res.status(400).json({ error: "Order shipping data is incomplete for recipient." });
    }
    const phones = resolveRecipientPhones(order.shipping?.phone, { recipientTel, recipientMobile });
    const receiveStoreId =
      defaultReceiveStoreId ||
      order.shipping?.storeId ||
      "";

    if (!receiveStoreId && splitBySeller) {
      return res.status(400).json({ error: "ReceiveStoreId is required for B2S shipments." });
    }
    const b2sDefaults = resolveB2SDefaults(restPayload, order);

    if (splitBySeller) {
      const normalizedItems = normalizeOrderItems(order);
      const sellerBundle = await resolveSellerBundles(normalizedItems);
      const { ownerByProductId, productById, sellerProfiles } = sellerBundle;
      const { groups, missingProductIds } = buildSellerPickupGroups(
        normalizedItems,
        ownerByProductId,
        productById
      );
      if (missingProductIds.length) {
        return res.status(400).json({
          error: "Missing pickup address or Yamato zip code for some products.",
          missingProductIds: Array.from(new Set(missingProductIds)),
        });
      }

      const sellerFilter = Array.isArray(sellerIds)
        ? sellerIds.filter((id: any) => typeof id === "string")
        : typeof sellerId === "string"
        ? [sellerId]
        : null;
      const filteredGroups = sellerFilter
        ? groups.filter((group) => sellerFilter.includes(group.sellerId))
        : groups;
      if (!filteredGroups.length) {
        return res.status(400).json({ error: "No pickup groups matched the provided seller filter." });
      }

      const results: Array<{
        sellerId: string;
        pickupKey: string;
        response: YamatoResponse;
      }> = [];
      let buyerLabelReady = false;

      for (const [index, group] of filteredGroups.entries()) {
        const pickup = group.pickup;
        const senderLabel =
          pickup.contactName || sellerProfiles[group.sellerId]?.displayName || senderName || "Sender";
        const senderPhones = resolveSenderPhones({
          contactTel: pickup.contactTel,
          contactMobile: pickup.contactMobile,
          fallbackTel: senderTel,
          fallbackMobile: senderMobile,
        });
        if (!senderPhones.SenderTel && !senderPhones.SenderMobile) {
          return res.status(400).json({
            error: "Pickup contact phone is required for sender.",
            sellerId: group.sellerId,
          });
        }

        const groupTotal = group.items.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
          0
        );
        const orderEntry = {
          OBTNumber: "",
          OrderId: `${orderId}-${index + 1}`,
          Thermosphere: b2sDefaults.Thermosphere,
          Spec: b2sDefaults.Spec,
          ReceiveStoreId: receiveStoreId,
          RecipientName: resolvedRecipientName,
          RecipientTel: phones.RecipientTel,
          RecipientMobile: phones.RecipientMobile,
          SenderName: senderLabel,
          SenderTel: senderPhones.SenderTel,
          SenderMobile: senderPhones.SenderMobile,
          SenderZipCode: pickup.yamatoZipCode,
          SenderAddress: pickup.address,
          IsCollection: b2sDefaults.IsCollection,
          CollectionAmount:
            b2sDefaults.IsCollection === "Y"
              ? Math.max(0, Math.round(groupTotal))
              : Math.max(0, Math.round(Number(restPayload.CollectionAmount || 0))),
        };

        const result = await YamatoService.printOBTByB2S({
          ...restPayload,
          Orders: [orderEntry],
        });

        if (result.ok && result.data?.IsOK === "Y") {
          const data = result.data?.Data as any;
          const orders = Array.isArray(data?.Orders) ? data.Orders : [];
          const shipment: YamatoShipmentRecord = {
            service: "PrintOBTByB2S",
            sellerId: group.sellerId,
            fileNo: data?.FileNo || orders?.[0]?.FileNo,
            printDateTime: data?.PrintDateTime,
            orders: orders.length
              ? normalizeShipmentOrders(orders)
              : undefined,
            createdAt: await getArrayTimestamp(),
          };
          await appendOrderShipment(orderId, order, shipment);
          buyerLabelReady = true;
          try {
            await notifySellersLabelReady([group.sellerId], {
              orderId,
              fileNo: shipment.fileNo,
              obtNumbers: orders.map((item: any) => item?.OBTNumber).filter(Boolean),
            });
          } catch (notifyError) {
            console.warn('Yamato label LINE notification failed', notifyError);
          }
        }

        results.push({ sellerId: group.sellerId, pickupKey: group.pickupKey, response: result.data });
      }

      if (buyerLabelReady) {
        try {
          await notifyBuyerLabelReady(order, {
            orderId,
            scheduleUrl: buildBuyerScheduleUrl(orderId),
          });
        } catch (notifyError) {
          console.warn('Buyer label LINE notification failed', notifyError);
        }
      }

      return res.json({ split: true, results });
    }

    const needsSenderFallback = rawOrders.some((entry: Record<string, any>) => !hasSenderFields(entry));
    const sender = needsSenderFallback
      ? resolveYamatoSender({ senderName, senderTel, senderMobile, senderZipCode, senderAddress })
      : null;

    const enrichedOrders = rawOrders.map((entry: Record<string, any>, index: number) => {
      const receiveStoreId =
        entry.ReceiveStoreId ||
        defaultReceiveStoreId ||
        order.shipping?.storeId ||
        "";
      const isCollection = normalizeYamatoFlag(
        entry.IsCollection ?? b2sDefaults.IsCollection,
        b2sDefaults.IsCollection
      );
      const collectionAmount =
        isCollection === "Y"
          ? Math.max(
              0,
              Math.round(
                Number(entry.CollectionAmount ?? restPayload.CollectionAmount ?? order.amount ?? 0)
              )
            )
          : 0;
      return {
        ...entry,
        OrderId: entry.OrderId || (index === 0 ? orderId : `${orderId}-${index + 1}`),
        OBTNumber: entry.OBTNumber ?? "",
        Thermosphere: normalizeYamatoCode(entry.Thermosphere, b2sDefaults.Thermosphere),
        Spec: normalizeYamatoCode(entry.Spec, b2sDefaults.Spec),
        ReceiveStoreId: receiveStoreId,
        RecipientName: entry.RecipientName || resolvedRecipientName,
        RecipientTel: entry.RecipientTel || phones.RecipientTel,
        RecipientMobile: entry.RecipientMobile || phones.RecipientMobile,
        SenderName: entry.SenderName || sender?.name,
        SenderTel: entry.SenderTel || sender?.tel,
        SenderMobile: entry.SenderMobile || sender?.mobile,
        SenderZipCode: entry.SenderZipCode || sender?.zipCode,
        SenderAddress: entry.SenderAddress || sender?.address,
        IsCollection: isCollection,
        CollectionAmount: collectionAmount,
      };
    });

    if (enrichedOrders.some((entry: any) => !entry.ReceiveStoreId)) {
      return res.status(400).json({ error: "ReceiveStoreId is required for B2S shipments." });
    }

    const result = await YamatoService.printOBTByB2S({
      ...restPayload,
      Orders: enrichedOrders,
    });

    if (result.ok && result.data?.IsOK === "Y") {
      const data = result.data?.Data as any;
      const printDateTime = data?.PrintDateTime;
      const orders = Array.isArray(data?.Orders) ? data.Orders : [];
      const shipment: YamatoShipmentRecord = {
        service: "PrintOBTByB2S",
        fileNo: data?.FileNo || orders?.[0]?.FileNo,
        printDateTime,
        orders: normalizeShipmentOrders(orders),
        createdAt: await getArrayTimestamp(),
      };
      await appendOrderShipment(orderId, order, shipment);
      try {
        await notifySellersLabelReady(order.sellerIds || [], {
          orderId,
          fileNo: shipment.fileNo,
          obtNumbers: orders.map((item: any) => item?.OBTNumber).filter(Boolean),
        });
      } catch (notifyError) {
        console.warn('Yamato label LINE notification failed', notifyError);
      }
      try {
        await notifyBuyerLabelReady(order, {
          orderId,
          scheduleUrl: buildBuyerScheduleUrl(orderId),
        });
      } catch (notifyError) {
        console.warn('Buyer label LINE notification failed', notifyError);
      }
    }

    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/orders/:orderId/logistics/yamato/pickup', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payload = req.body || {};
    const { splitBySeller, sellerId, sellerIds, Piece, Weight, TakeDate, ...restPayload } = payload;
    const isContact = normalizeYamatoFlag(payload.IsContact, "N");
    const isTrolley = normalizeYamatoFlag(payload.IsTrolley, "N");
    const pickupQuantities = resolvePickupQuantities(payload);
    if (!hasPickupQuantity(pickupQuantities)) {
      console.warn('[yamato][pickup] missing quantities', {
        orderId,
        splitBySeller: Boolean(splitBySeller),
        sellerId,
        piece: Piece,
        weight: Weight,
        takeDate: TakeDate,
        quantities: pickupQuantities,
      });
      return res.status(400).json({
        error: "NormalQuantity, ColdQuantity, or FreezeQuantity must be greater than 0.",
      });
    }

    if (splitBySeller) {
      const normalizedItems = normalizeOrderItems(order);
      const sellerBundle = await resolveSellerBundles(normalizedItems);
      const { ownerByProductId, productById, sellerProfiles } = sellerBundle;
      const { groups, missingProductIds } = buildSellerPickupGroups(
        normalizedItems,
        ownerByProductId,
        productById
      );
      if (missingProductIds.length) {
        return res.status(400).json({
          error: "Missing pickup address or Yamato zip code for some products.",
          missingProductIds: Array.from(new Set(missingProductIds)),
        });
      }

      const sellerFilter = Array.isArray(sellerIds)
        ? sellerIds.filter((id: any) => typeof id === "string")
        : typeof sellerId === "string"
        ? [sellerId]
        : null;
      const filteredGroups = sellerFilter
        ? groups.filter((group) => sellerFilter.includes(group.sellerId))
        : groups;
      if (!filteredGroups.length) {
        return res.status(400).json({ error: "No pickup groups matched the provided seller filter." });
      }

      const results: Array<{ sellerId: string; pickupKey: string; response: YamatoResponse }> = [];
      for (const group of filteredGroups) {
        const pickup = group.pickup;
        const senderLabel =
          pickup.contactName || sellerProfiles[group.sellerId]?.displayName || payload.CustomerName || "Sender";
        const senderPhones = resolveSenderPhones({
          contactTel: pickup.contactTel,
          contactMobile: pickup.contactMobile,
          fallbackTel: payload.ContactTelNumber,
          fallbackMobile: payload.ContactMobile,
        });
        const telParts = parseTelephoneParts(senderPhones.SenderTel);
        const requestPayload = {
          ...restPayload,
          ...pickupQuantities,
          CustomerName: payload.CustomerName || senderLabel,
          ContactName: payload.ContactName || senderLabel,
          ContactAddress: pickup.address,
          ContactTelArea: payload.ContactTelArea || telParts.area,
          ContactTelNumber: payload.ContactTelNumber || telParts.number,
          ContactTelExt: payload.ContactTelExt || telParts.ext,
          ContactMobile: payload.ContactMobile || senderPhones.SenderMobile,
          IsContact: isContact,
          IsTrolley: isTrolley,
        };

        console.log('[yamato][pickup] request', {
          orderId,
          sellerId: group.sellerId,
          pickupKey: group.pickupKey,
          quantities: pickupQuantities,
          hasContactTel: Boolean(requestPayload.ContactTelNumber),
          hasContactMobile: Boolean(requestPayload.ContactMobile),
          takeDate: TakeDate,
        });

        const result = await YamatoService.callPickup(requestPayload);
        if (!result.ok || result.data?.IsOK !== "Y") {
          console.warn('[yamato][pickup] response', {
            orderId,
            sellerId: group.sellerId,
            pickupKey: group.pickupKey,
            status: result.status,
            isOk: result.data?.IsOK,
            message: result.data?.Message,
          });
        }
        if (result.ok && result.data?.IsOK === "Y") {
          const pickupRecord: YamatoPickupRecord = {
            sellerId: group.sellerId,
            srvTranId: result.data?.SrvTranId,
            message: result.data?.Message,
            requestedAt: await getArrayTimestamp(),
          };
          await appendOrderPickup(orderId, order, pickupRecord);
        }

        results.push({ sellerId: group.sellerId, pickupKey: group.pickupKey, response: result.data });
      }

      return res.json({ split: true, results });
    }

    const customerName =
      typeof payload.CustomerName === "string" ? payload.CustomerName.trim() : "";
    const contactAddress =
      typeof payload.ContactAddress === "string" ? payload.ContactAddress.trim() : "";
    const contactName =
      typeof payload.ContactName === "string" ? payload.ContactName.trim() : "";
    if (!customerName || !contactAddress) {
      return res.status(400).json({
        error: "CustomerName and ContactAddress are required when splitBySeller is false.",
      });
    }
    const requestPayload = {
      ...restPayload,
      ...pickupQuantities,
      CustomerName: customerName,
      ContactName: contactName || customerName,
      ContactAddress: contactAddress,
      IsContact: isContact,
      IsTrolley: isTrolley,
    };
    console.log('[yamato][pickup] request', {
      orderId,
      quantities: pickupQuantities,
      hasContactTel: Boolean(requestPayload.ContactTelNumber),
      hasContactMobile: Boolean(requestPayload.ContactMobile),
      takeDate: TakeDate,
    });
    const result = await YamatoService.callPickup(requestPayload);
    if (!result.ok || result.data?.IsOK !== "Y") {
      console.warn('[yamato][pickup] response', {
        orderId,
        status: result.status,
        isOk: result.data?.IsOK,
        message: result.data?.Message,
      });
    }

    if (result.ok && result.data?.IsOK === "Y") {
      const pickupRecord: YamatoPickupRecord = {
        srvTranId: result.data?.SrvTranId,
        message: result.data?.Message,
        requestedAt: await getServerTimestamp(),
      };
      await appendOrderLogistics(orderId, order, { pickup: pickupRecord });
    }

    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.post('/orders/:orderId/logistics/yamato/obt-status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { DatabaseService } = await import("../lib/database-server");
    const order = await DatabaseService.getOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payload = req.body || {};
    let obtNumbers = Array.isArray(payload.OBTNumbers) ? payload.OBTNumbers : [];
    if (!obtNumbers.length && Array.isArray(order.logistics?.shipments)) {
      obtNumbers = order.logistics?.shipments
        ?.flatMap((shipment) => shipment.orders || [])
        .map((entry) => entry.obtNumber)
        .filter(Boolean) as string[];
    }

    if (!obtNumbers.length) {
      return res.status(400).json({ error: "OBTNumbers are required to query status." });
    }

    const result = await YamatoService.obtStatus({ ...payload, OBTNumbers: obtNumbers });

    if (result.ok && result.data?.IsOK === "Y") {
      const data = result.data?.Data as any;
      const obt = Array.isArray(data?.OBTs) ? data.OBTs[0] : undefined;
      const tracking: YamatoTrackingRecord = {
        lastFetchedAt: await getServerTimestamp(),
        latest: obt
          ? {
              statusId: obt.StatusId,
              statusName: obt.StatusName,
              stationName: obt.StationName,
              createDateTime: obt.CreateDateTime,
            }
          : undefined,
        history: Array.isArray(obt?.StatusList)
          ? obt.StatusList.map((entry: any) => ({
              statusId: entry.StatusId,
              statusName: entry.StatusName,
              stationName: entry.StationName,
              createDateTime: entry.CreateDateTime,
            }))
          : undefined,
      };
      await appendOrderLogistics(orderId, order, { tracking });
    }

    respondYamatoJson(res, result);
  } catch (error) {
    handleYamatoError(res, error);
  }
});

router.get('/health', async (_req, res) => {
  try {
    const { DatabaseService } = await import("../lib/database-server");
    await DatabaseService.healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error,
    });
  }
});

router.post('/voice/assistant', async (req: Request, res: Response) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    let userId = await getAuthorizedUserId(req);
    if (!userId) {
      const allowUnsafe =
        runtimeConfig.isEmulator ||
        runtimeConfig.useMockLine ||
        process.env.ALLOW_UNAUTH_VOICE === 'true';
      const fallbackUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      if (allowUnsafe && fallbackUserId) {
        userId = fallbackUserId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const locale = typeof req.body?.locale === 'string' ? req.body.locale : undefined;
    const pageContextRaw = typeof req.body?.pageContext === 'string' ? req.body.pageContext.trim() : '';
    const pageContext = pageContextRaw ? pageContextRaw.slice(0, 2000) : undefined;
    const pageRoute = typeof req.body?.pageRoute === 'string' ? req.body.pageRoute.trim() : undefined;
    const response = await handleVoiceAssistantMessage({ message, userId, locale, pageContext, pageRoute });
    res.json(response);
  } catch (error) {
    console.error('Voice assistant error:', error);
    res.status(500).json({ error: 'Voice assistant failed.' });
  }
});

router.post('/voice/tool', async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Tool name is required.' });
    }

    let userId = await getAuthorizedUserId(req);
    if (!userId) {
      const allowUnsafe =
        runtimeConfig.isEmulator ||
        runtimeConfig.useMockLine ||
        process.env.ALLOW_UNAUTH_VOICE === 'true';
      const fallbackUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      if (allowUnsafe && fallbackUserId) {
        userId = fallbackUserId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const args = typeof req.body?.args === 'object' && req.body?.args ? req.body.args : {};
    const locale = typeof req.body?.locale === 'string' ? req.body.locale : undefined;
    const startedAt = Date.now();
    console.log('[voice-tool] start', {
      name,
      userId,
      locale,
      args: summarizeArgs(args),
    });
    const result = await executeVoiceAssistantToolCall({ call: { name, args }, userId, locale });
    const { messages, ui } = result;
    console.log('[voice-tool] done', {
      name,
      userId,
      ms: Date.now() - startedAt,
      messages: messages.length,
    });
    res.json({ messages, ui });
  } catch (error) {
    console.error('Voice tool execution error:', error);
    res.status(500).json({ error: 'Voice tool execution failed.' });
  }
});

router.post('/voice/live/session', async (req: Request, res: Response) => {
  try {
    pruneLiveSessions();
    let userId = await getAuthorizedUserId(req);
    if (!userId) {
      const allowUnsafe =
        runtimeConfig.isEmulator ||
        runtimeConfig.useMockLine ||
        process.env.ALLOW_UNAUTH_VOICE === 'true';
      const fallbackUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      if (allowUnsafe && fallbackUserId) {
        userId = fallbackUserId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GENERATIVE_LANGUAGE_API_KEY ||
      '';
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server.' });
    }

    const locale = typeof req.body?.locale === 'string' ? req.body.locale : undefined;
    const pageContextRaw = typeof req.body?.pageContext === 'string' ? req.body.pageContext.trim() : '';
    const pageContext = pageContextRaw ? pageContextRaw.slice(0, 2000) : '';
    const pageRoute = typeof req.body?.pageRoute === 'string' ? req.body.pageRoute.trim() : '';
    const previousSessionId = liveSessionsByUser.get(userId);
    const sessionId = crypto.randomUUID();

    const ai = new GoogleGenAI({ apiKey });
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => {
          console.log('[voice-live] socket open', { sessionId });
          broadcastLive(sessionId, { type: 'status', status: 'open' });
        },
        onmessage: (message: LiveServerMessage) => {
          void (async () => {
            if (message.toolCall?.functionCalls?.length) {
              console.log('[voice-live] toolCall received', {
                sessionId,
                userId,
                count: message.toolCall.functionCalls.length,
              });
              const entry = liveSessions.get(sessionId);
              const now = Date.now();
              if (entry) {
                for (const [key, value] of entry.toolCache.entries()) {
                  if (value.expiresAt <= now) {
                    entry.toolCache.delete(key);
                  }
                }
              }

              const responses = await Promise.all(
                message.toolCall.functionCalls.map(async (call, index) => {
                  const name = call.name || 'unknown';
                  const args = call.args || {};
                  const callId = call.id || '';
                  const argsSummary = summarizeArgs(args);
                  const callStart = Date.now();
                  if (callId) {
                    broadcastLive(sessionId, {
                      type: 'tool',
                      phase: 'start',
                      name,
                      args,
                      toolCallId: callId,
                    });
                  }
                  let messages: Array<{ role: 'assistant' | 'system'; text: string }> = [];
                  let ui: Record<string, unknown> | undefined;
                  if (!entry) {
                    console.log('[voice-live] toolCall skipped (no session)', { name, id: callId });
                    messages = [{ role: 'assistant', text: 'Session expired. Please reconnect.' }];
                  } else if (index > 0) {
                    console.log('[voice-live] toolCall skipped', { name, id: callId, reason: 'multiple' });
                    messages = [
                      {
                        role: 'assistant',
                        text: 'I can only run one tool at a time. Ask me to run the next step.',
                      },
                    ];
                  } else {
                    const signature = `${name}:${JSON.stringify(args)}`;
                    const cached = entry.toolCache.get(signature);
                    if (cached && cached.expiresAt > now) {
                      console.log('[voice-live] toolCall cache hit', { name, id: callId });
                      messages = cached.messages;
                      ui = cached.ui;
                    } else {
                      const result = await executeVoiceAssistantToolCall({
                        call: { name, args },
                        userId,
                        locale,
                      });
                      messages = result.messages;
                      ui = result.ui as Record<string, unknown> | undefined;
                      entry.toolCache.set(signature, {
                        messages,
                        ui,
                        expiresAt: now + TOOL_CACHE_TTL_MS,
                      });
                    }
                  }

                  if (!call.id) {
                    console.warn('[voice-live] toolCall missing id', { name, args: argsSummary });
                    return null;
                  }
                  broadcastLive(sessionId, {
                    type: 'tool',
                    phase: 'done',
                    name,
                    args,
                    toolCallId: call.id,
                    messages,
                    ui,
                  });
                  const text = messages.map((message) => message.text).filter(Boolean).join('\n').slice(0, 2000);
                  console.log('[voice-live] toolCall done', {
                    name,
                    id: callId,
                    ms: Date.now() - callStart,
                    messages: messages.length,
                  });
                  return { id: call.id, name, response: { output: { text } } };
                })
              );
              const validResponses = responses.filter(
                (response): response is { id: string; name: string; response: { output: { text: string } } } =>
                  Boolean(response && typeof response.id === 'string' && response.id)
              );
              const functionResponses = validResponses.map((r) => ({
                id: r.id,
                name: r.name,
                response: r.response,
              }));
              if (functionResponses.length) {
                for (const response of functionResponses) {
                  try {
                    console.log('[voice-live] sendToolResponse', {
                      sessionId,
                      count: 1,
                      ids: [response.id],
                    });
                    session.sendToolResponse({ functionResponses: response });
                  } catch (error) {
                    console.warn('sendToolResponse failed', error);
                  }
                }
              } else {
                console.warn('[voice-live] sendToolResponse skipped (no responses)', { sessionId });
              }
            }

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part?.text && LIVE_RESPONSE_MODALITIES.includes(Modality.TEXT)) {
                broadcastLive(sessionId, { type: 'text', text: part.text });
              }
              if (part?.inlineData?.data) {
                broadcastLive(sessionId, {
                  type: 'audio',
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType,
                });
              }
            }

            if (message.serverContent?.turnComplete) {
              broadcastLive(sessionId, { type: 'turnComplete' });
            }
          })();
        },
        onerror: (error: ErrorEvent) => {
          console.warn('[voice-live] socket error', { sessionId, message: error.message });
          broadcastLive(sessionId, { type: 'status', status: 'error', message: error.message });
          closeLiveSession(sessionId);
        },
        onclose: (event: CloseEvent) => {
          console.log('[voice-live] socket closed', { sessionId, reason: event.reason, code: event.code });
          broadcastLive(sessionId, { type: 'status', status: 'closed', reason: event.reason });
          closeLiveSession(sessionId);
        },
      },
      config: {
        responseModalities: LIVE_RESPONSE_MODALITIES,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: LIVE_VOICE_NAME },
          },
        },
        tools: [{ functionDeclarations: LIVE_FUNCTION_DECLARATIONS }],
        systemInstruction: buildLiveSystemInstruction(
          locale,
          pageContext || undefined,
          pageRoute || undefined
        ),
      },
    });

    liveSessions.set(sessionId, {
      session,
      userId,
      locale,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      clients: new Set(),
      toolCache: new Map(),
    });
    liveSessionsByUser.set(userId, sessionId);
    if (previousSessionId && previousSessionId !== sessionId) {
      console.log('[voice-live] closing previous session', { userId, previousSessionId });
      closeLiveSession(previousSessionId);
    }

    console.log('[voice-live] session created', {
      sessionId,
      userId,
      locale,
      model: LIVE_MODEL,
      modalities: LIVE_RESPONSE_MODALITIES.map((value) => value.toString()),
    });

    res.json({ sessionId });
  } catch (error) {
    console.error('Live session error:', error);
    res.status(500).json({ error: 'Failed to create live session.' });
  }
});

router.get('/voice/live/stream', (req: Request, res: Response) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
  const entry = liveSessions.get(sessionId);
  if (!entry) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();

  entry.clients.add(res);
  entry.lastUsedAt = Date.now();
  res.write(`data: ${JSON.stringify({ type: 'status', status: 'stream-open' })}\n\n`);

  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    entry.clients.delete(res);
  });
});

router.post('/voice/live/input', async (req: Request, res: Response) => {
  try {
    pruneLiveSessions();
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    const entry = liveSessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const authUserId = await getAuthorizedUserId(req);
    if (authUserId && authUserId !== entry.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const audioBase64 =
      typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    entry.lastUsedAt = Date.now();

    if (audioBase64) {
      const mimeType =
        typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/pcm;rate=16000';
      entry.session.sendRealtimeInput({ media: { data: audioBase64, mimeType } });
      return res.json({ ok: true });
    }

    if (text) {
      entry.session.sendClientContent({ turns: [text] });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'No input provided.' });
  } catch (error) {
    console.error('Live input error:', error);
    res.status(500).json({ error: 'Live input failed.' });
  }
});

router.post('/voice/live/close', async (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required.' });
  }
  closeLiveSession(sessionId);
  res.json({ ok: true });
});

router.post('/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const audioBase64 =
      typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required.' });
    }

    let userId = await getAuthorizedUserId(req);
    if (!userId) {
      const allowUnsafe =
        runtimeConfig.isEmulator ||
        runtimeConfig.useMockLine ||
        process.env.ALLOW_UNAUTH_VOICE === 'true';
      const fallbackUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      if (allowUnsafe && fallbackUserId) {
        userId = fallbackUserId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GENERATIVE_LANGUAGE_API_KEY ||
      '';
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server.' });
    }

    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/wav';
    const locale = typeof req.body?.locale === 'string' ? req.body.locale : '';
    const isTraditionalChinese = locale.toLowerCase() === 'zh-tw' || locale.toLowerCase() === 'zh_tw';
    const prompt = isTraditionalChinese
      ? '請逐字轉錄這段語音。只輸出轉錄文字，不要加入任何說明。'
      : 'Transcribe this audio verbatim. Output only the transcript and nothing else.';

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
    });

    const transcript =
      response.text ||
      response.candidates?.[0]?.content?.parts
        ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .join('') ||
      '';

    res.json({ transcript: transcript.trim() });
  } catch (error) {
    console.error('Voice transcription error:', error);
    res.status(500).json({ error: 'Voice transcription failed.' });
  }
});

router.post('/marketing/generate-stream', async (req: Request, res: Response) => {
  const requestId = `marketing-stream:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GENERATIVE_LANGUAGE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';
  if (!apiKey) {
    res.status(500).write(JSON.stringify({ type: 'error', message: 'Missing GEMINI_API_KEY on server.' }) + '\n');
    res.end();
    console.error(`[${requestId}] Missing GEMINI_API_KEY env; aborting request.`);
    return;
  }

  const body = (req.body ?? {}) as {
    prompt?: string;
    product?: { name?: string; category?: string; description?: string };
    image?: { base64?: string; mimeType?: string };
    imageUrl?: string;
    language?: string;
  };

  const product = body.product ?? {};
  const userPrompt = (body.prompt ?? '').trim();
  const languageInput = (body.language ?? '').toString();
  const normalizedLanguage = languageInput.toLowerCase();
  const isTraditionalChinese = normalizedLanguage === 'zh-tw' || normalizedLanguage === 'zh_tw';

  const systemInstructionText = isTraditionalChinese
    ? '將此產品照片提升至電商行銷品質：修正光線/對比/白平衡，去除灰塵/雜訊，略微銳化，使用乾淨純白背景並加上柔和自然陰影。**不得以任何方式更改產品或包裝**（不得編輯標籤/文字/標誌/顏色/形狀/大小）。'
    : 'Enhance this product photo to e-commerce marketing quality: correct lighting/contrast/white balance, remove dust/noise, sharpen slightly, clean pure white background with a soft natural shadow. **Do not change the product or packaging in any way** (no edits to label/text/logo/colors/shape/size).';

  const prompt = [
    userPrompt || 'Create marketing-ready product image and matching marketing copy.',
    'Output marketing text (headline, caption, call-to-action, hashtags) and return an image.',
    product?.name ? `Product name: ${product.name}` : null,
    product?.category ? `Category: ${product.category}` : null,
    product?.description ? `Description: ${product.description}` : null,
    isTraditionalChinese
      ? '以繁體中文撰寫標題、文案、CTA、Hashtag 與設計重點，語氣友善專業，並強調產地與新鮮度。'
      : 'Provide the headline, caption, CTA, hashtags, and design notes in English.',
    isTraditionalChinese ? '生成的影像請符合台灣/華人市場的美感與情境。' : null,
    isTraditionalChinese
      ? '輸出文字內容時僅提供最終促銷文案，勿加入額外說明、步驟或 JSON。'
      : 'Only output the final promotional copy ready for the product detail page—do not include explanations, steps, or JSON.'
  ]
    .filter(Boolean)
    .join('\n');

  const model = 'gemini-2.5-flash-image';
  const ai = new GoogleGenAI({ apiKey });

  const config: any = {
    responseModalities: ['IMAGE', 'TEXT'],
    systemInstruction: [
      {
        text: systemInstructionText
      }
    ]
  };

  const parts: any[] = [{ text: prompt }];
  let hasImage = Boolean(body.image?.base64);
  if (!hasImage && body.imageUrl) {
    try {
      const imageResponse = await fetch(body.imageUrl);
      if (imageResponse.ok) {
        const mimeType = imageResponse.headers.get('content-type') || 'image/png';
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        const base64 = bytes.toString('base64');
        body.image = { base64, mimeType };
        hasImage = true;
      } else {
        console.warn(`[${requestId}] Unable to fetch image from URL: ${body.imageUrl}`);
      }
    } catch (error) {
      console.warn(`[${requestId}] Failed to download image from URL: ${body.imageUrl}`, error);
    }
  }
  if (body.image?.base64) {
    parts.push({
      inlineData: {
        mimeType: body.image.mimeType || 'image/png',
        data: body.image.base64
      }
    });
  }

  const contents: any[] = [{ role: 'user', parts }];

  console.log(
    `[${requestId}] Generating marketing stream for product="${product?.name || 'N/A'}" promptLength=${prompt.length} imageAttached=${hasImage} language=${languageInput || 'default'}`
  );

  let chunkIndex = 0;
  let streamedTextChars = 0;
  let streamedImages = 0;

  try {
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents
    });

    for await (const chunk of response) {
      chunkIndex += 1;
      const candidate = chunk?.candidates?.[0];
      const chunkParts = candidate?.content?.parts ?? [];

      for (const part of chunkParts) {
        if (part?.inlineData?.data) {
          streamedImages += 1;
          const dataLength = part.inlineData.data?.length ?? 0;
          console.log(`[${requestId}] chunk=${chunkIndex} received image part #${streamedImages} bytes=${dataLength}`);
          res.write(
            JSON.stringify({
              type: 'image',
              mimeType: part.inlineData.mimeType || 'image/png',
              base64: part.inlineData.data
            }) + '\n'
          );
        }
      }

      if (chunk?.text) {
        streamedTextChars += chunk.text.length;
        console.log(`[${requestId}] chunk=${chunkIndex} received text chars=${chunk.text.length} total=${streamedTextChars}`);
        res.write(JSON.stringify({ type: 'text', text: chunk.text }) + '\n');
      }
    }

    res.write(JSON.stringify({ type: 'done' }) + '\n');
    res.end();
    console.log(
      `[${requestId}] completed stream chunks=${chunkIndex} totalTextChars=${streamedTextChars} totalImages=${streamedImages}`
    );
  } catch (error) {
    console.error(`[${requestId}] Error while streaming marketing output`, error);
    res.write(JSON.stringify({ type: 'error', message: (error as Error).message }) + '\n');
    res.end();
  }
});

export default router;
