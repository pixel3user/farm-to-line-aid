import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Session, Type } from '@google/genai';
import type { FunctionDeclaration, FunctionResponse } from '@google/genai';
import admin from 'firebase-admin';

const PORT = Number(process.env.PORT || 8080);
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GENERATIVE_LANGUAGE_API_KEY ||
  '';
const MODEL = process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const ALLOW_UNAUTH = process.env.ALLOW_UNAUTH_VOICE === 'true';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const CORS_ORIGINS = CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_ALLOW_ALL = CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes('*');
const LIVE_SESSION_TTL_MS = 1000 * 60 * 15;
const LINE_ID_TOKEN_FALLBACK_TTL_MS = 1000 * 60 * 50;
const LINE_CHANNEL_ID =
  process.env.LINE_CHANNEL_ID || process.env.LINE_LOGIN_CHANNEL_ID || process.env.VITE_LINE_CHANNEL_ID || '';
const RESPONSE_MODALITIES: Modality[] = MODEL.includes('native-audio')
  ? [Modality.AUDIO]
  : [Modality.AUDIO, Modality.TEXT];

const summarizeArgs = (args: unknown) => {
  try {
    return JSON.stringify(args ?? {}).slice(0, 300);
  } catch {
    return '[unserializable]';
  }
};

type RelayAuth =
  | { type: 'firebase'; token: string }
  | { type: 'line'; lineIdToken: string }
  | { type: 'none' };

const buildToolHeaders = (auth: RelayAuth) => {
  if (auth.type === 'firebase' && auth.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === 'line' && auth.lineIdToken) {
    return { 'X-Line-Id-Token': auth.lineIdToken };
  }
  return {};
};

if (!admin.apps.length) {
  admin.initializeApp();
}

console.info('[voice-relay] boot', {
  model: MODEL,
  responseModalities: RESPONSE_MODALITIES.map((value) => value.toString()),
  hasApiBaseUrl: Boolean(API_BASE_URL),
});

const app = express();
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (CORS_ALLOW_ALL) {
        callback(null, true);
        return;
      }
      if (CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/voice/live' });

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'show_product_tools',
    description: 'Show product management shortcuts and guidance.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'show_store_tools',
    description: 'Show store/CRM shortcuts and guidance.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'show_marketing_tools',
    description: 'Show marketing content creation shortcuts.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'show_analytics_tools',
    description: 'Show analytics shortcuts.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'open_dashboard',
    description: 'Open the Farm2Market LIFF dashboard for the user.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'show_help_options',
    description: 'Show help options and tips.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'product_list',
    description: "List the user's products. If a limit is mentioned, include it in args.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'product_create',
    description: 'Create a new product. Required: name, price (>0), unit, stock (>=0).',
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
      },
    },
  },
  {
    name: 'product_open_image_upload',
    description: 'Open the product image upload dialog (no database change).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING },
        productName: { type: Type.STRING },
        media: { type: Type.STRING },
      },
    },
  },
  {
    name: 'product_open_pickup_address',
    description: 'Open the product pickup address dialog (no database change).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING },
        productName: { type: Type.STRING },
      },
    },
  },
  {
    name: 'store_list',
    description: "List the user's stores. If a limit is mentioned, include it in args.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'store_create',
    description: 'Create a new store. Ask for missing: name (required).',
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
    name: 'marketing_material_list',
    description: 'List recent marketing materials. If a limit is mentioned, include it in args.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'analytics_get_user_stats',
    description: 'Get counts for products, stores, conversations for this user.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'user_set_role',
    description: 'Set the user role. Args: { role: "farmer" | "market" }.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        role: { type: Type.STRING },
      },
    },
  },
  {
    name: 'product_browse_public',
    description: 'Browse public products. Optional args: { limit?: number }',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'store_browse_public',
    description: 'Browse public stores/buyers. Optional args: { limit?: number }',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'marketplace_get_stats',
    description: 'Get public marketplace stats (counts of sellers/buyers/products/stores).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'product_search_public',
    description: 'Search products by name/category/tags/price.',
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
    name: 'store_search_public',
    description: 'Search stores by name/type/location.',
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

type LiveRelaySession = {
  session: Session;
  userId: string;
  locale?: string;
  createdAt: number;
  lastUsedAt: number;
  clients: Set<Response>;
  auth: RelayAuth;
  toolCache: Map<
    string,
    { messages: Array<{ role: 'assistant' | 'system'; text: string }>; expiresAt: number; ui?: Record<string, unknown> }
  >;
};

const liveSessions = new Map<string, LiveRelaySession>();
const liveSessionsByUser = new Map<string, string>();
const liveSocketsByUser = new Map<string, WebSocket>();
const TOOL_CACHE_TTL_MS = 1000 * 60 * 2;
const lineIdTokenCache = new Map<string, { userId: string; expiresAt: number }>();

const buildSystemInstruction = (locale?: string) => {
  const isTraditional = locale?.toLowerCase() === 'zh-tw' || locale?.toLowerCase() === 'zh_tw';
  return {
    parts: [
      {
        text: isTraditional
          ? '你是繁體中文語音助理，協助農友管理產品、店家、行銷素材與營運分析。請用繁體中文回覆。不要透露思考過程或計畫步驟。使用工具後，請用一句到兩句話總結結果並提一個簡短的下一步問題。當使用者說要上傳產品圖片或新增取貨地址時，優先使用對應工具直接開啟上傳/取貨地址視窗。'
          : 'You are a helpful voice assistant for Farm2Market. Respond in concise English. Do not reveal reasoning or planning. After using a tool, summarize the result in 1-2 sentences and ask a brief follow-up question. When the user asks to upload a product image or add a pickup address, prefer the tools that directly open the upload/pickup dialogs.',
      },
    ],
  };
};

const verifyToken = async (token: string) => {
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded?.uid || null;
  } catch {
    return null;
  }
};

const getBearerToken = (req: Request) => {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return '';
};

const getLineIdTokenFromRequest = (req: Request) => {
  const headerToken = req.headers['x-line-id-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const bodyToken = typeof req.body?.lineIdToken === 'string' ? req.body.lineIdToken.trim() : '';
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

  if (!LINE_CHANNEL_ID) {
    console.warn('[voice-relay] line verify skipped (missing channel id)');
    return null;
  }

  try {
    const lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: LINE_CHANNEL_ID,
      }),
    });

    const responseText = await lineResponse.text();
    if (!lineResponse.ok) {
      console.warn('[voice-relay] line verify failed', {
        status: lineResponse.status,
        body: responseText.slice(0, 200),
      });
      return null;
    }

    let lineUser: { sub?: unknown; exp?: unknown };
    try {
      lineUser = JSON.parse(responseText) as { sub?: unknown; exp?: unknown };
    } catch {
      console.warn('[voice-relay] line verify parse failed');
      return null;
    }
    const userId = typeof lineUser.sub === 'string' ? lineUser.sub : '';
    if (!userId) return null;
    const exp = typeof lineUser.exp === 'number' ? lineUser.exp : null;
    const expiresAt = exp ? exp * 1000 : Date.now() + LINE_ID_TOKEN_FALLBACK_TTL_MS;
    lineIdTokenCache.set(idToken, { userId, expiresAt });
    return userId;
  } catch {
    return null;
  }
};

const resolveUserIdFromRequest = async (req: Request, fallbackUserId: string) => {
  const token = getBearerToken(req);
  const authedUid = token ? await verifyToken(token) : null;
  if (authedUid) return { userId: authedUid, auth: { type: 'firebase', token } as RelayAuth };

  const lineIdToken = getLineIdTokenFromRequest(req);
  const lineUserId = lineIdToken ? await verifyLineIdToken(lineIdToken) : null;
  if (lineUserId) {
    return { userId: lineUserId, auth: { type: 'line', lineIdToken } as RelayAuth };
  }

  if (ALLOW_UNAUTH && fallbackUserId) {
    return { userId: fallbackUserId, auth: { type: 'none' } as RelayAuth };
  }
  return { userId: '', auth: { type: 'none' } as RelayAuth };
};

const resolveUserIdFromSocket = async ({
  token,
  lineIdToken,
  fallbackUserId,
}: {
  token: string;
  lineIdToken: string;
  fallbackUserId: string;
}) => {
  const authedUid = token ? await verifyToken(token) : null;
  if (authedUid) return { userId: authedUid, auth: { type: 'firebase', token } as RelayAuth };

  const lineUserId = lineIdToken ? await verifyLineIdToken(lineIdToken) : null;
  if (lineUserId) {
    return { userId: lineUserId, auth: { type: 'line', lineIdToken } as RelayAuth };
  }

  if (ALLOW_UNAUTH && fallbackUserId) {
    return { userId: fallbackUserId, auth: { type: 'none' } as RelayAuth };
  }
  return { userId: '', auth: { type: 'none' } as RelayAuth };
};

const broadcastLive = (sessionId: string, payload: Record<string, unknown>) => {
  const entry = liveSessions.get(sessionId);
  if (!entry) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of entry.clients) {
    try {
      client.write(data);
    } catch {
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

wss.on('connection', async (ws: any, req: any) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const token = url.searchParams.get('token') || '';
  const lineIdToken = url.searchParams.get('lineIdToken') || '';
  const locale = url.searchParams.get('locale') || undefined;
  const userIdParam = url.searchParams.get('userId') || '';

  if (!GEMINI_API_KEY) {
    ws.close(1011, 'Missing Gemini API key');
    return;
  }

  const { userId: resolvedUserId, auth } = await resolveUserIdFromSocket({
    token,
    lineIdToken,
    fallbackUserId: userIdParam,
  });

  if (!resolvedUserId) {
    console.warn('[voice-relay] socket unauthorized', {
      hasFirebaseToken: Boolean(token),
      hasLineIdToken: Boolean(lineIdToken),
      hasFallbackUserId: Boolean(userIdParam),
    });
    ws.close(4401, 'Unauthorized');
    return;
  }

  const existingSocket = liveSocketsByUser.get(resolvedUserId);
  if (existingSocket && existingSocket !== ws) {
    try {
      existingSocket.close(1012, 'Replaced by new session');
    } catch {}
  }
  liveSocketsByUser.set(resolvedUserId, ws);

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const toolCache = new Map<
    string,
    {
      messages: Array<{ role: 'assistant' | 'system'; text: string }>;
      expiresAt: number;
      ui?: Record<string, unknown>;
    }
  >();
  const shouldStreamText = RESPONSE_MODALITIES.includes(Modality.TEXT);
  const toolHeaders = buildToolHeaders(auth);
  const session = await ai.live.connect({
    model: MODEL,
    callbacks: {
      onopen: () => {
        console.log('[voice-relay] live socket open', { userId: resolvedUserId, locale });
        ws.send(JSON.stringify({ type: 'status', status: 'open' }));
      },
      onmessage: (message: LiveServerMessage) => {
        void (async () => {
          if (message.toolCall?.functionCalls?.length) {
            console.log('[voice-relay] toolCall received', {
              userId: resolvedUserId,
              count: message.toolCall.functionCalls.length,
            });
            const now = Date.now();
            for (const [key, value] of toolCache.entries()) {
              if (value.expiresAt <= now) {
                toolCache.delete(key);
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
                  ws.send(
                    JSON.stringify({
                      type: 'tool',
                      phase: 'start',
                      name,
                      args,
                      toolCallId: callId,
                    })
                  );
                }
                let toolMessages: Array<{ role: 'assistant' | 'system'; text: string }> = [];
                let toolUi: Record<string, unknown> | undefined;
                if (index > 0) {
                  console.log('[voice-relay] toolCall skipped', { name, id: callId, reason: 'multiple' });
                  toolMessages = [
                    {
                      role: 'assistant',
                      text: 'I can only run one tool at a time. Ask me to run the next step.',
                    },
                  ];
                } else {
                  const signature = `${name}:${JSON.stringify(args)}`;
                  const cached = toolCache.get(signature);
                  if (cached && cached.expiresAt > now) {
                    console.log('[voice-relay] toolCall cache hit', { name, id: callId });
                    toolMessages = cached.messages;
                    toolUi = cached.ui;
                  } else {
                    try {
                      if (!API_BASE_URL) {
                        toolMessages = [{ role: 'assistant', text: 'Tool execution unavailable.' }];
                      } else {
                        console.log('[voice-relay] toolCall execute', { name, id: callId, args: argsSummary });
                        const fetchStart = Date.now();
                        const response = await fetch(`${API_BASE_URL}/api/voice/tool`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...toolHeaders,
                          },
                          body: JSON.stringify({ name, args, locale, userId: resolvedUserId }),
                        });
                        console.log('[voice-relay] toolCall response', {
                          name,
                          id: callId,
                          status: response.status,
                          ms: Date.now() - fetchStart,
                        });
                        const payload = (await response.json()) as {
                          messages?: Array<{ role: 'assistant' | 'system'; text: string }>;
                          ui?: Record<string, unknown>;
                        };
                        toolMessages = Array.isArray(payload?.messages) ? payload.messages : [];
                        toolUi = payload?.ui;
                      }
                    } catch (error) {
                      console.warn('[voice-relay] toolCall error', { name, id: callId, error });
                      toolMessages = [{ role: 'assistant', text: 'Tool execution failed.' }];
                    }
                    toolCache.set(signature, {
                      messages: toolMessages,
                      expiresAt: now + TOOL_CACHE_TTL_MS,
                      ui: toolUi,
                    });
                  }
                }

                if (!call.id) {
                  console.warn('[voice-relay] toolCall missing id', { name, args: argsSummary });
                  return null;
                }
                ws.send(
                  JSON.stringify({
                    type: 'tool',
                    phase: 'done',
                    name,
                    args,
                    toolCallId: call.id,
                    messages: toolMessages,
                    ui: toolUi,
                  })
                );
                const text = toolMessages.map((message) => message.text).filter(Boolean).join('\n').slice(0, 2000);
                console.log('[voice-relay] toolCall done', {
                  name,
                  id: callId,
                  ms: Date.now() - callStart,
                  messages: toolMessages.length,
                });
                return { id: call.id, name, response: { output: { text } } };
              })
            );
            const validResponses = responses.filter(
              (response): response is NonNullable<(typeof responses)[number]> =>
                Boolean(response && typeof response.id === 'string' && response.id)
            );
            const functionResponses: FunctionResponse[] = validResponses.map((r) => ({
              id: r.id,
              name: r.name,
              response: r.response,
            }));
            if (functionResponses.length) {
              for (const response of functionResponses) {
                try {
                  console.log('[voice-relay] sendToolResponse', {
                    count: 1,
                    ids: [response.id],
                  });
                  session.sendToolResponse({ functionResponses: response });
                } catch (error) {
                  console.warn('sendToolResponse failed', error);
                }
              }
            } else {
              console.warn('[voice-relay] sendToolResponse skipped (no responses)');
            }
          }

          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part?.text && shouldStreamText) {
              ws.send(JSON.stringify({ type: 'text', text: part.text }));
            }
            if (part?.inlineData?.data) {
              ws.send(
                JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType,
                })
              );
            }
          }

          if (message.serverContent?.turnComplete) {
            ws.send(JSON.stringify({ type: 'turnComplete' }));
          }
        })();
      },
      onerror: (err: ErrorEvent) => {
        console.warn('Gemini live socket error', err?.message);
        ws.send(
          JSON.stringify({ type: 'status', status: 'error', message: err.message, code: (err as any)?.code })
        );
      },
      onclose: (event: CloseEvent) => {
        console.warn('Gemini live socket closed', event?.code, event?.reason);
        ws.send(
          JSON.stringify({
            type: 'status',
            status: 'closed',
            code: event?.code,
            reason: event?.reason,
          })
        );
      },
    },
    config: {
      responseModalities: RESPONSE_MODALITIES,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      systemInstruction: buildSystemInstruction(locale),
    },
  });

  ws.on('message', (data: any) => {
    try {
      const payload = JSON.parse(data.toString()) as {
        type?: string;
        audioBase64?: string;
        mimeType?: string;
        text?: string;
      };
      if (payload.type === 'audio' && payload.audioBase64) {
        session.sendRealtimeInput({
          media: { data: payload.audioBase64, mimeType: payload.mimeType || 'audio/pcm;rate=16000' },
        });
      } else if (payload.type === 'text' && payload.text) {
        session.sendClientContent({ turns: [payload.text] });
      } else if (payload.type === 'close') {
        ws.close();
      }
    } catch (error) {
      console.warn('Relay message handling failed', error);
      ws.send(
        JSON.stringify({
          type: 'status',
          status: 'error',
          message: error instanceof Error ? error.message : 'Relay message handling failed',
        })
      );
    }
  });

  ws.on('close', () => {
    if (liveSocketsByUser.get(resolvedUserId) === ws) {
      liveSocketsByUser.delete(resolvedUserId);
    }
    try {
      session.close();
    } catch {}
  });
});

const createLiveSession = async ({
  userId,
  locale,
  auth,
}: {
  userId: string;
  locale?: string;
  auth: RelayAuth;
}) => {
  const previousSessionId = liveSessionsByUser.get(userId);
  const sessionId = crypto.randomUUID();
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const shouldStreamText = RESPONSE_MODALITIES.includes(Modality.TEXT);
  const session = await ai.live.connect({
    model: MODEL,
    callbacks: {
      onopen: () => {
        console.log('[voice-relay] sse session open', { sessionId, userId, locale });
        broadcastLive(sessionId, { type: 'status', status: 'open' });
      },
      onmessage: (message: LiveServerMessage) => {
        void (async () => {
          if (message.toolCall?.functionCalls?.length) {
            console.log('[voice-relay] toolCall received (sse)', {
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
                let toolMessages: Array<{ role: 'assistant' | 'system'; text: string }> = [];
                let toolUi: Record<string, unknown> | undefined;
                if (!entry) {
                  console.log('[voice-relay] toolCall skipped (no session)', { name, id: callId });
                  toolMessages = [{ role: 'assistant', text: 'Session expired. Please reconnect.' }];
                } else if (index > 0) {
                  console.log('[voice-relay] toolCall skipped', { name, id: callId, reason: 'multiple' });
                  toolMessages = [
                    {
                      role: 'assistant',
                      text: 'I can only run one tool at a time. Ask me to run the next step.',
                    },
                  ];
                } else {
                  const signature = `${name}:${JSON.stringify(args)}`;
                  const cached = entry.toolCache.get(signature);
                  if (cached && cached.expiresAt > now) {
                    console.log('[voice-relay] toolCall cache hit', { name, id: callId });
                    toolMessages = cached.messages;
                    toolUi = cached.ui;
                  } else {
                    try {
                      if (!API_BASE_URL) {
                        toolMessages = [{ role: 'assistant', text: 'Tool execution unavailable.' }];
                      } else {
                        console.log('[voice-relay] toolCall execute', { name, id: callId, args: argsSummary });
                        const fetchStart = Date.now();
                        const response = await fetch(`${API_BASE_URL}/api/voice/tool`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...buildToolHeaders(entry.auth),
                          },
                          body: JSON.stringify({ name, args, locale, userId }),
                        });
                        console.log('[voice-relay] toolCall response', {
                          name,
                          id: callId,
                          status: response.status,
                          ms: Date.now() - fetchStart,
                        });
                        const payload = (await response.json()) as {
                          messages?: Array<{ role: 'assistant' | 'system'; text: string }>;
                          ui?: Record<string, unknown>;
                        };
                        toolMessages = Array.isArray(payload?.messages) ? payload.messages : [];
                        toolUi = payload?.ui;
                      }
                    } catch (error) {
                      console.warn('[voice-relay] toolCall error', { name, id: callId, error });
                      toolMessages = [{ role: 'assistant', text: 'Tool execution failed.' }];
                    }
                    entry.toolCache.set(signature, {
                      messages: toolMessages,
                      expiresAt: now + TOOL_CACHE_TTL_MS,
                      ui: toolUi,
                    });
                  }
                }

                if (!call.id) {
                  console.warn('[voice-relay] toolCall missing id', { name, args: argsSummary });
                  return null;
                }
                broadcastLive(sessionId, {
                  type: 'tool',
                  phase: 'done',
                  name,
                  args,
                  toolCallId: call.id,
                  messages: toolMessages,
                  ui: toolUi,
                });
                const text = toolMessages.map((message) => message.text).filter(Boolean).join('\n').slice(0, 2000);
                console.log('[voice-relay] toolCall done', {
                  name,
                  id: callId,
                  ms: Date.now() - callStart,
                  messages: toolMessages.length,
                });
                return { id: call.id, name, response: { output: { text } } };
              })
            );
            const validResponses = responses.filter(
              (response): response is NonNullable<(typeof responses)[number]> =>
                Boolean(response && typeof response.id === 'string' && response.id)
            );
            const functionResponses: FunctionResponse[] = validResponses.map((r) => ({
              id: r.id,
              name: r.name,
              response: r.response,
            }));
            if (functionResponses.length) {
              for (const response of functionResponses) {
                try {
                  console.log('[voice-relay] sendToolResponse', {
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
              console.warn('[voice-relay] sendToolResponse skipped (no responses)', { sessionId });
            }
          }

          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part?.text && shouldStreamText) {
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
        broadcastLive(sessionId, {
          type: 'status',
          status: 'error',
          message: error.message,
          code: (error as any)?.code,
        });
        closeLiveSession(sessionId);
      },
      onclose: (event: CloseEvent) => {
        broadcastLive(sessionId, {
          type: 'status',
          status: 'closed',
          reason: event.reason,
          code: event.code,
        });
        closeLiveSession(sessionId);
      },
    },
    config: {
      responseModalities: RESPONSE_MODALITIES,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      systemInstruction: buildSystemInstruction(locale),
    },
  });

  liveSessions.set(sessionId, {
    session,
    userId,
    locale,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    clients: new Set(),
    auth,
    toolCache: new Map(),
  });
  liveSessionsByUser.set(userId, sessionId);
  if (previousSessionId && previousSessionId !== sessionId) {
    console.log('[voice-relay] closing previous session', { userId, previousSessionId });
    closeLiveSession(previousSessionId);
  }

  return sessionId;
};

app.post(['/voice/live/session', '/api/voice/live/session'], async (req: Request, res: Response) => {
  try {
    pruneLiveSessions();
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Missing Gemini API key' });
    }

    const fallbackUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const { userId, auth } = await resolveUserIdFromRequest(req, fallbackUserId);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const locale = typeof req.body?.locale === 'string' ? req.body.locale : undefined;
    const sessionId = await createLiveSession({ userId, locale, auth });
    res.json({ sessionId });
  } catch (error) {
    console.error('Live session error', error);
    res.status(500).json({ error: 'Failed to create live session.' });
  }
});

app.get(['/voice/live/stream', '/api/voice/live/stream'], (req: Request, res: Response) => {
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

app.post(['/voice/live/input', '/api/voice/live/input'], async (req: Request, res: Response) => {
  try {
    pruneLiveSessions();
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    const entry = liveSessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const { userId } = await resolveUserIdFromRequest(req, entry.userId);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (userId !== entry.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const audioBase64 =
      typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    entry.lastUsedAt = Date.now();

    if (audioBase64) {
      const mimeType =
        typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/pcm;rate=16000';
      try {
        entry.session.sendRealtimeInput({ media: { data: audioBase64, mimeType } });
      } catch (error) {
        console.warn('Live input send failed', error);
        return res.status(500).json({ error: 'Live input failed.' });
      }
      return res.json({ ok: true });
    }

    if (text) {
      entry.session.sendClientContent({ turns: [text] });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'No input provided.' });
  } catch (error) {
    console.error('Live input error', error);
    res.status(500).json({ error: 'Live input failed.' });
  }
});

app.post(['/voice/live/close', '/api/voice/live/close'], (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required.' });
  }
  closeLiveSession(sessionId);
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`Voice relay listening on ${PORT}`);
});
