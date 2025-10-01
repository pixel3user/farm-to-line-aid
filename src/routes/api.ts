// API Routes for Farm2Market AI
import express from 'express';
import { WebhookHandler } from '../api/webhookHandler';
import { DatabaseService } from '../lib/database-server';
import crypto from 'crypto';

const router = express.Router();

// Webhook verification middleware
const verifyLineWebhook = (req: any, res: any, next: any) => {
  const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = req.headers['x-line-signature'];
  
  if (!signature || !channelSecret) {
    return res.status(401).send('Unauthorized');
  }

  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  
  if (hash !== signature) {
    return res.status(401).send('Unauthorized');
  }

  next();
};

// LINE Webhook endpoint
router.post('/webhook', verifyLineWebhook, async (req: any, res: any) => {
  try {
    const webhookHandler = new WebhookHandler();
    const events = req.body.events || [];
    
    console.log('Received webhook events:', events.length);
    
    await webhookHandler.handleEvents(events);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// GET: Test endpoint for webhook verification
router.get('/webhook', async (req: any, res: any) => {
  res.status(200).send('Webhook endpoint is active');
});

// POST: Setup webhook in LINE Developers Console
router.post('/webhook/setup', async (req: any, res: any) => {
  try {
    const { webhookUrl, channelAccessToken } = req.body;
    
    const response = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        endpoint: webhookUrl
      })
    });

    if (response.ok) {
      // Verify the webhook
      const verifyResponse = await fetch('https://api.line.me/v2/bot/channel/webhook/test', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${channelAccessToken}`
        }
      });

      res.json({
        success: true,
        message: verifyResponse.ok ? 'Webhook verified successfully' : 'Webhook set but verification failed',
        webhookUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to set webhook',
        error: await response.text()
      });
    }
  } catch (error) {
    console.error('Webhook setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error
    });
  }
});

// GET: User statistics
router.get('/user/:userId/stats', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const stats = await DatabaseService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// GET: User products
router.get('/user/:userId/products', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const products = await DatabaseService.getProductsByUser(userId);
    res.json(products);
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST: Create new product
router.post('/user/:userId/products', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const productData = req.body;
    
    const result = await DatabaseService.createProduct(userId, productData);
    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// GET: User stores
router.get('/user/:userId/stores', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const stores = await DatabaseService.getStoresByUser(userId);
    res.json(stores);
  } catch (error) {
    console.error('Stores error:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// POST: Create new store
router.post('/user/:userId/stores', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const storeData = req.body;
    
    const result = await DatabaseService.createStore(userId, storeData);
    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// GET: User conversations
router.get('/user/:userId/conversations', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const conversations = await DatabaseService.getRecentConversations(userId, limit);
    res.json(conversations);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET: User marketing materials
router.get('/user/:userId/marketing-materials', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const materials = await DatabaseService.getMarketingMaterialsByUser(userId);
    res.json(materials);
  } catch (error) {
    console.error('Marketing materials error:', error);
    res.status(500).json({ error: 'Failed to fetch marketing materials' });
  }
});

// POST: LINE authentication endpoint
router.post('/auth/line', async (req: any, res: any) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'LIFF ID token is required' });
    }

    // Verify LIFF ID token with LINE API
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

    // Create Firebase custom token
    const admin = require('firebase-admin');
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
      }
    });
  } catch (error) {
    console.error('LINE authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET: System health check
router.get('/health', async (req: any, res: any) => {
  try {
    // Test Firebase connection
    await DatabaseService.getUserStats('health-check-user');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        gemini: 'configured'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error,
      services: {
        database: 'error',
        gemini: 'error'
      }
    });
  }
});

export default router;
