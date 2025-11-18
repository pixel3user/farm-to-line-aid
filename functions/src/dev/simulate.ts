/*
 Minimal CLI to simulate LINE webhook events against WebhookHandler.
 Usage examples:
   ts-node src/dev/simulate.ts --text "我要管理產品" --user U123
   ts-node src/dev/simulate.ts --postback "action=set_role&role=farmer" --user U123
   ts-node src/dev/simulate.ts --call show_product_tools --user U123
   ts-node src/dev/simulate.ts --follow --user U123
 The script logs messages that would have been sent by the bot.
*/

import { WebhookHandler } from '../api/webhookHandler';
import type { WebhookEvent, LineMessage } from '../api/lineBot';

// Capture replies by monkey-patching the LineBotAPI used inside WebhookHandler.
// We rely on the fact WebhookHandler constructs its own LineBotAPI instance.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlerAny: any = new WebhookHandler();

// Replace reply method to print to console instead of hitting LINE API
if (handlerAny && handlerAny.lineBot) {
  const original = handlerAny.lineBot.replyMessage?.bind(handlerAny.lineBot);
  handlerAny.lineBot.replyMessage = async (replyToken: string, messages: LineMessage[]) => {
    console.log('--- Reply ---');
    console.log('replyToken:', replyToken);
    for (const m of messages) {
      console.dir(m, { depth: null });
    }
    console.log('--- End Reply ---');
    if (original) return; // skip real API
  };
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
    else {
      positionals.push(a);
    }
  }
  // Windows/PowerShell sometimes drops flags when invoked via npm scripts.
  // Support positional fallback: [text] [userId]
  if (!('text' in args) && positionals[0] && !positionals[0].startsWith('--')) {
    args.text = positionals[0];
  }
  if (!('user' in args) && !('userId' in args) && positionals[1] && !positionals[1].startsWith('--')) {
    args.user = positionals[1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const userId = String(args.user || args.userId || 'U_TEST_USER');
  const now = Date.now();

  const events: WebhookEvent[] = [];

  if (args.follow) {
    events.push({
      type: 'follow',
      replyToken: 'R' + now,
      source: { type: 'user', userId },
    } as WebhookEvent);
  }

  if (typeof args.text === 'string') {
    events.push({
      type: 'message',
      replyToken: 'R' + (now + 1),
      source: { type: 'user', userId },
      message: { type: 'text', id: String(now), text: String(args.text) },
    } as WebhookEvent);
  }

  if (typeof args.postback === 'string') {
    events.push({
      type: 'postback',
      replyToken: 'R' + (now + 2),
      source: { type: 'user', userId },
      postback: { data: String(args.postback) },
    } as WebhookEvent);
  }

  if (typeof args.call === 'string') {
    // Simulate a direct tool call by crafting a message that Gemini would parse.
    // We piggyback on handleTextWithGemini by sending a recognizable hint.
    // For transparent testing, directly invoke the internal switch via a small shim.
    const name = String(args.call);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: any = {
      replyToken: 'R' + (now + 3),
      text: name,
      userId,
      rawEvent: { type: 'message', replyToken: 'R' + (now + 3), source: { type: 'user', userId } } as WebhookEvent,
    };
    if (typeof (handlerAny as any).handleTextWithGemini === 'function') {
      // Call the internal helper but fake the plan object path by calling the switch segment directly
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const segment = (handlerAny as any);
      if (segment && typeof segment['lineBot']?.replyMessage === 'function') {
        // Reuse the switch by building a minimal object similar to plan
        const fakeCall = { name, args: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawEvent: any = context.rawEvent;
        // Inline the switch body via a tiny dispatcher
        // Only covers declared names; otherwise prints a warning
        const dispatch = async () => {
          switch (name) {
            case 'show_product_tools':
              return await handlerAny.handleProductInquiry(context.replyToken);
            case 'show_store_tools':
              return await handlerAny.handleStoreInquiry(context.replyToken);
            case 'show_marketing_tools':
              return await handlerAny.handleMarketingInquiry(context.replyToken);
            case 'show_analytics_tools':
              return await handlerAny.handleAnalyticsInquiry(context.replyToken);
            case 'open_dashboard':
              return await handlerAny.handleWebAppAccess({ ...rawEvent, replyToken: context.replyToken }, '開啟控制台');
            case 'show_help_options':
              return await handlerAny.handleHelpInquiry(context.replyToken);
            case 'product_list':
              return await handlerAny.execProductList(context.replyToken, userId, fakeCall.args);
            case 'product_create':
              return await handlerAny.execProductCreate(context.replyToken, userId, { name: '測試商品', price: 100, unit: '斤', stock: 5 });
            case 'product_create_then_skip_image': {
              await handlerAny.execProductCreate(context.replyToken, userId, { name: '測試商品', price: 100, unit: '斤', stock: 5 });
              // simulate skip postback
              await handlerAny.handlePostback({
                type: 'postback',
                source: { userId, type: 'user' },
                replyToken: context.replyToken,
                postback: { data: 'action=product_draft_skip' },
              });
              return [];
            }
            case 'product_create_then_generic': {
              await handlerAny.execProductCreate(context.replyToken, userId, { name: '雞蛋', price: 120, unit: '斤', stock: 10, category: 'eggs' });
              await handlerAny.handlePostback({
                type: 'postback',
                source: { userId, type: 'user' },
                replyToken: context.replyToken,
                postback: { data: 'action=product_draft_generic' },
              });
              return [];
            }
            case 'store_list':
              return await handlerAny.execStoreList(context.replyToken, userId, fakeCall.args);
            case 'store_create':
              return await handlerAny.execStoreCreate(context.replyToken, userId, { name: '測試店家', type: 'retailer', location: 'Taipei' });
            case 'marketing_material_list':
              return await handlerAny.execMarketingMaterialList(context.replyToken, userId, fakeCall.args);
            case 'analytics_get_user_stats':
              return await handlerAny.execAnalyticsUserStats(context.replyToken, userId);
            case 'user_set_role':
              return await handlerAny.handlePostback({ type: 'postback', replyToken: context.replyToken, source: { type: 'user', userId }, postback: { data: 'action=set_role&role=farmer' } } as WebhookEvent);
            case 'product_browse_public':
            case 'store_browse_public':
            case 'marketplace_get_stats':
            case 'product_search_public':
            case 'store_search_public':
              console.warn('Public browse/search tools require Firestore data; prefer using --text to trigger Gemini search flows.');
              return;
            default:
              console.warn('Unknown call name:', name);
          }
        };
        await dispatch();
      }
    }
  }

  if (!events.length && !args.call) {
    console.log('Nothing to simulate. Try one of:\n  --follow  --text "我要管理產品"  --postback "action=set_role&role=farmer"  --call show_product_tools  --user U123');
    process.exit(0);
  }

  if (events.length) {
    await handlerAny.handleEvents(events);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


