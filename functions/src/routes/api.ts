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
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

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

type NormalizedOrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  imageUrl?: string;
};

const resolveSellerBundles = async (
  items: NormalizedOrderItem[]
): Promise<{
  sellerIds: string[];
  sellerItems: Record<string, NormalizedOrderItem[]>;
  sellerProfiles: Record<string, { lineId?: string; displayName?: string }>;
  ownerByProductId: Record<string, string | undefined>;
}> => {
  const { DatabaseService } = await import("../lib/database-server");
  const uniqueProductIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean))
  );

  const productOwnerMap = new Map<string, string | undefined>();
  await Promise.all(
    uniqueProductIds.map(async (pid) => {
      try {
        const product = await DatabaseService.getProductById(pid);
        productOwnerMap.set(pid, product?.userId);
      } catch (error) {
        console.warn("Failed to resolve owner for product", pid, error);
        productOwnerMap.set(pid, undefined);
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

  return { sellerIds: Object.keys(sellerItems), sellerItems, sellerProfiles, ownerByProductId };
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
    runtimeConfig.liffUrl ||
    'https://farm2market-99.web.app';
  const scheduleUrl = `${(frontendBase || '').replace(/\/$/, '')}/farmer/delivery?order=${encodeURIComponent(orderId)}`;

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
          uri: scheduleUrl,
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
                  uri: `${scheduleUrl}&action=confirm`,
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
                  uri: scheduleUrl,
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
          action: { type: "message", text: "Help" },
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
        runtimeConfig.liffUrl ||
        'https://farm2market-99.web.app';
      const scheduleUrl = `${(frontendBase || '').replace(/\/$/, '')}/farmer/delivery?order=${encodeURIComponent(orderId)}`;
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
                  uri: scheduleUrl,
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "uri",
                  label: "查看此訂單",
                  uri: scheduleUrl,
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
        sellerIds.length ? Promise.all(sellerIds.map((id) => bot.pushMessage(id, [sellerMessage]))) : Promise.resolve(),
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

router.post('/marketing/generate-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GENERATIVE_LANGUAGE_API_KEY ||
    '';
  if (!apiKey) {
    res.status(500).write(JSON.stringify({ type: 'error', message: 'Missing GEMINI_API_KEY on server.' }) + '\n');
    res.end();
    return;
  }

  const body = (req.body ?? {}) as {
    prompt?: string;
    product?: { name?: string; category?: string; description?: string };
    image?: { base64?: string; mimeType?: string };
  };

  const product = body.product ?? {};
  const userPrompt = (body.prompt ?? '').trim();
  const prompt = [
    userPrompt || 'Create marketing-ready product image and matching marketing copy.',
    'Output marketing text (headline, caption, call-to-action, hashtags) and return an image.',
    product?.name ? `Product name: ${product.name}` : null,
    product?.category ? `Category: ${product.category}` : null,
    product?.description ? `Description: ${product.description}` : null
  ]
    .filter(Boolean)
    .join('\n');

  const model = 'gemini-2.5-flash-image';
  const ai = new GoogleGenAI({ apiKey });

  const config: any = {
    responseModalities: ['IMAGE', 'TEXT'],
    systemInstruction: [
      {
        text: 'Improve the uploaded image and make the product looks like a marketing ready pictures of the product.'
      }
    ]
  };

  const parts: any[] = [{ text: prompt }];
  if (body.image?.base64) {
    parts.push({
      inlineData: {
        mimeType: body.image.mimeType || 'image/png',
        data: body.image.base64
      }
    });
  }

  const contents: any[] = [{ role: 'user', parts }];

  try {
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents
    });

    for await (const chunk of response) {
      const candidate = chunk?.candidates?.[0];
      const chunkParts = candidate?.content?.parts ?? [];

      for (const part of chunkParts) {
        if (part?.inlineData?.data) {
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
        res.write(JSON.stringify({ type: 'text', text: chunk.text }) + '\n');
      }
    }

    res.write(JSON.stringify({ type: 'done' }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ type: 'error', message: (error as Error).message }) + '\n');
    res.end();
  }
});

export default router;
