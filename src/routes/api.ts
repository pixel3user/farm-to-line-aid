// API Routes for Farm2Market AI
import express from 'express';
import { WebhookHandler } from '../api/webhookHandler';
import { DatabaseService } from '../lib/database-server';
import crypto from 'crypto';
import admin from '../lib/firebaseAdmin';
import { 
  exchangeCodeForToken, 
  getUserProfile,
  mockExchangeCodeForToken,
  mockGetUserProfile
} from './lineAuth';

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

// LINE Login endpoints
router.post('/auth/line/token', mockExchangeCodeForToken);
router.post('/auth/line/profile', mockGetUserProfile);

// POST: LINE authentication endpoint (LIFF)
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
    
    // Initialize admin if not already done
    if (!admin.apps.length) {
      const serviceAccount = {
        type: "service_account",
        project_id: "farm2market-99",
        private_key_id: "c333b4e691a0c0a1ed3081998aa1baefbc284f7f",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYfUd0WqqdQpD9\nzEFeHuby0GY3UDm4n7kD1VszenSu8PuimuZyTOj6unnDzcntNV2iM7oaBCWPdLfY\nB0erqYhJi/Yhi0A/uns/Kn+zpPxNH8RNWaGXEjlTER6D2U70LCcwFCYyUpmkiAK5\n4s+XIpBkynOG/7ZSPjdOgpHpI5k5KAad4svTsji5t6d5CQbosfCa/0q+0dvYk90+\n07D+q/8NbnL1AoqaJb3KE2JFr9p4fiFsacE2A4qt+gaeRoBV/P0BOQG9ZZ7aMhJy\n+HK/sv3+lshfpyjL/7xdSQ3hBfmeBETiD15n/jGaz3XhDg26++gInNAUA5jZ3nuI\nfy3ppedtAgMBAAECggEAIWDbegCaqql/QmpSL8lS8WAZSnD3nVQfCgzExYCdafWk\nzpLUcg4So8nJiVt6xTSDrcUM7gLyqZYk3E1vCvQWG8TVG6HlM440f241h0SqU9fQ\ng96McAbyyLBshIamSjZeimao5vxeTQRdazyhphtBqRCf1FIr0a1fCJ9QEOKYtruA\n2dH7hp+2kLGYnWHt1RyUwj+rmpTF/sPFYvcvMQsQre6at8Nh5e4ZLIXAyPvlmvpp\npCG5wSiF+Ripe29s5Ff9NKKDdKHnkielQnb4FReqS2WCPYbTk0IbXTQ6qGR1+u5b\nugMa1Y9VFteUHgvDU8UCs43cdVT/nsmxVXfZ9pizQQKBgQD8HrEFwnsoSeejSWfn\nMdpVyBwkpx9S8ExlqlwlDxwwIQUqh7WbvAmQWOrsglb5twkvP14DSePNg2Z/q4qq\n/O1DkDVGGckYEsO98KCoIu3XisIxQJdVVTrEpPVjz5EchmkhXqx1C2V4KX9m3wjn\nYv8tNIv/5SM6JlDznIco7/klDQKBgQDb0jWnZW+iDa9gceSCm/0xYf7H1s3lGfEy\nXugOdQvyA0tiLv+k0UPjS5zxlUU6a5hf02aFXUbdqxx5jlhb4ke2ynFEglMP0Nzl\nMinruVeNg8I0xN3cwoRlznRtIkNwE89QCw+WfGaYRj0SJXRZca5oGDDJNgWm5kqa\n1JelWUXz4QKBgHclHe0l4kPA4UnGN+cHJTIitkIQBHqSetgUsSUGRgDsqd9WcNme\n/DoN+z83vViXSizc2lXdhl0purec3pQ9oPar4LE3IFRTEdPiMloi35lbxre12Y6H\nD5W8iwbXIbGER4xwjDln4FTv73gy8KdAnmzDh2Gv7HzffKQTlcAf3/LFAoGBAIHV\nIoOAUfLxCkh4fHL4Fw93xbfakzlhnSgXDhCb6TZD495VzABY6TPykPvPIlhi/Fh8\nz+ytLxH14peZD28Vsy2vXD8OimipAA8PFdt4WNHopGfubuvYp8JJslJTDmnACY5J\nOiezyhTeR2vUW2gI0O4Ce64cDjKJij7wmbC7jamBAoGBAK0fZWcv0d74GwD90M+6\nZTpJ//ZaBzqYEa7ukT6kCiCJWVychWZGxwcQERSi6lGWFNIiCbtALq3AOI/uP3r3\nlfyLF1Pj3nrbUA/CaIT8Q6gAn9Bhdf5ichib6HgzGZHb4nc2D7qcVNj44hR3hKxk\nOSdpzmlCcTutIt91ha5XFi+j\n-----END PRIVATE KEY-----\n",
        client_email: "firebase-adminsdk-fbsvc@farm2market-99.iam.gserviceaccount.com",
        client_id: "108614495138611466373",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40farm2market-99.iam.gserviceaccount.com",
        universe_domain: "googleapis.com"
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "farm2market-99"
      });
    }
    
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
