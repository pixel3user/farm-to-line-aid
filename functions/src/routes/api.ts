import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import runtimeConfig from "../lib/runtimeConfig";
// removed eager admin import to avoid startup crashes
import { WebhookHandler } from "../api/webhookHandler";
import {
  exchangeCodeForToken,
  getUserProfile,
  mockExchangeCodeForToken,
  mockGetUserProfile,
} from "./lineAuth";

const router = express.Router();

const useMockLineApis =
  (process.env.NODE_ENV === "development" || process.env.USE_MOCK_LINE === "true") &&
  process.env.USE_MOCK_LINE !== "false";

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

export default router;
