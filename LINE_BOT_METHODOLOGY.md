# Farm2Market LINE Bot Methodology

This document explains how the LINE bot implemented under `functions/` orchestrates conversations, automation, and data exchange across Google Cloud Functions, Gemini, and the Firebase backend. Use it as a guide to understand the end‑to‑end flow from inbound LINE events to actionable outcomes inside the Farm2Market platform.

## 1. Runtime Topology
- The server code lives in `functions/src`. `app.ts` composes an Express app that mounts REST routes under `/api`.
- `index.ts` exposes the app through three Asia‑East1 HTTPS Cloud Functions:
  - `api`: generic REST API surface.
  - `webhook`: rewrites requests to `/api/webhook` for LINE callbacks.
  - `health`: rewrites requests to `/api/health` for uptime checks.
- Deployment uses the Firebase Functions runtime; environment values come from `.env`, Firebase config, or secrets.

## 2. Inbound Webhook Pipeline
- `routes/api.ts` registers `POST /api/webhook`, guarded by `verifyLineWebhook`, which recreates LINE’s HMAC SHA‑256 check against the `X-Line-Signature` header using `lineChannelSecret`. Invalid signatures are rejected with 401.
- Raw request bodies are preserved (`express.json({ verify })`) so the HMAC can be recomputed faithfully.
- After signature verification, `WebhookHandler.handleEvents` receives the event array (batch delivery).
- `EventDeduper` (`lib/idempotency.ts`) hashes the relevant event envelope and stores it in `firestore.collection('webhook_event_dedupe')` so retries from LINE are ignored for five minutes.

## 3. Event Routing Inside the Webhook Handler
- `WebhookHandler.handleSingleEvent` fan-outs by `event.type`:
  - `follow`: onboard new users.
  - `message`: route to `handleTextMessage` or `handleImageMessage`.
  - `postback`: interpret quick-action payloads.
  - Other event types are logged for observability.
- Each branch uses `LineBotAPI` (`api/lineBot.ts`) to talk to LINE. The class handles:
  - `replyMessage`, `pushMessage`, `getUserProfile`, and `getMessageContent`.
  - Deduping reply-tokens (to avoid “reply token used” errors).
  - Emulator/mocked scenarios via `SKIP_LINE_API`, `USE_MOCK_LINE`, `FUNCTIONS_EMULATOR`, or `FORCE_LINE_API`.

## 4. Follow Event Onboarding Workflow
- Fetches the LINE profile via `LineBotAPI.getUserProfile`.
- Persists or updates the user document in `firestore.collection('line_users')` with display name, avatar, role, and timestamps (`DatabaseService`).
- Sends a structured welcome sequence via `MessageTemplates` (Flex cards + quick replies) to collect the seller/buyer role and offer shortcuts.

## 5. Text Message Flow
1. `ConversationStore.getRecentTurns` loads the last 12 turns stored under `line_users/{userId}/conversation_history`.
2. Session hygiene:
   - `SESSION_IDLE_MS` (10 minutes) resets stale sessions, clears search filters, and expires product drafts waiting for images.
3. Draft watchdog:
   - If the user is mid-way through a product creation that is paused for an image, the handler inspects the text for “skip/generic/cancel” intents and finalises or cancels the draft accordingly.
4. Quick deterministic queries:
   - `tryHandleQuickProductQuery` extracts simple price filters or keywords (“eggs under 180”) without invoking Gemini. Matches hit `DatabaseService.searchProductsPublic` and respond with a Flex carousel while persisting sticky search filters.
5. Gemini-driven orchestration:
   - `handleTextWithGemini` calls `generateConversationPlan` in `lib/gemini-client.ts`.
   - The plan carries optional `functionCalls` (tool calls), `lineMessages`, or fallback `text`.
   - When Gemini emits tool calls, the handler maps them to concrete exec* methods (e.g., `product_list`, `product_create`, `store_search_public`). Each method calls `DatabaseService` to read/write Firestore, builds Flex payloads, and queues quick replies for the next step.
   - If Gemini returns composed `lineMessages`, they are sent verbatim; otherwise plain text is wrapped into LINE text messages.
6. Conversation persistence:
   - `persistConversation` truncates user/assistant messages to 2,000 characters, converts Flex/template payloads into textual summaries, and appends them to the conversation history collection for future context.

## 6. Gemini Integration Details
- `generateConversationPlan` uses the Google Generative AI SDK (`@google/genai`) targeting the `GEMINI_MODEL_ID` (default `gemini-2.5-flash-lite`).
- System instructions enforce LINE-safe JSON, require Flex payloads where possible, and list the only legal function calls.
- Allowed tools span:
  - Menus (`show_*`), dashboard launch, help.
  - CRUD shortcuts (`product_*`, `store_*`, `marketing_material_list`, `analytics_get_user_stats`).
  - Marketplace browsing/search for public data (`product_search_public`, `store_search_public`, etc.).
- `requestConversationPlan` streams prior turns and user metadata (role, display name) so Gemini can personalise prompts and remain stateful per `sessionUserId`.
- If Gemini fails or violates policy, the handler retries with clarifying instructions or falls back to deterministic prompts.
- Image analysis is stubbed by `analyzeImageWithGemini`, ready to be swapped with the real vision model once the API key is configured.

## 7. Automation for Products, Stores, and Analytics
- Products (`DatabaseService.createProduct`):
  - Enforces required fields server-side before writing to `firestore.collection('products')`.
  - Stores Gemini-enriched metadata (`geminiData`) when provided.
  - Returns Flex confirmations with quick replies that offer image binding.
- Store creation and listing mirror the product patterns through `createStore`, `getStoresByUser`, and Flex summaries.
- Marketing materials:
  - `getMarketingMaterialsByUser` surfaces recently generated assets for quick reuse.
- Analytics:
  - `getUserStats` counts products, stores, and conversations via Firestore aggregation queries. Responses are converted into Flex-based dashboards when the `analytics_get_user_stats` tool fires.

## 8. Image Message Workflow
1. Download the binary via `LineBotAPI.getMessageContent`.
2. Optimise with `sharp` (auto-rotate, JPEG quality 70) to reduce storage.
3. Upload to Cloud Storage bucket using Firebase Admin (`line_user_images/{userId}/{timestamp}-{messageId}.jpg`).
4. Attempt to sign a 7-day URL; if the service account lacks `signBlob`, fall back to `makePublic`.
5. Persist a document under `line_users/{userId}/images` noting the storage path, download URL, and metadata.
6. Automation branches:
   - Pending product draft → call `finalizeProductDraft`, create the product, mark the draft completed, and reply with a Flex confirmation.
   - Image binding requested → update product record via `DatabaseService.updateProductImages`.
   - Otherwise invoke `analyzeImageWithGemini` and surface CTA buttons (flyer, shelf card, recipe card) through a template message. Postbacks queue additional automation tasks handled in `handlePostback`.

## 9. Postback and Quick-Action Handling
- Postback payloads are parsed as URL parameters (`parsePostbackData`).
- Supported actions include:
  - `set_role`: updates the LINE user document and returns tailored next steps.
  - `product_draft_*`: skip/generic/cancel flows for drafts awaiting images.
  - `product_image_bind` / `product_image_use_latest`: records the target product for the next photo.
  - `send_intro`, `send_reorder_reminder`, `snooze_reminder`: drafts ready-to-send messages for CRM tasks.
  - Marketing shortcuts (`create_flyer`, `create_shelf_card`, `create_recipe_card`) send acknowledgements and can be extended to trigger background jobs.
  - Search filter adjustments (`search_set_price`) re-run product searches with updated ranges.
- Each branch replies immediately via LINE and, when relevant, updates Firestore collections for persistence.

## 10. Firebase Data Model Touchpoints
- `line_users`: primary profile records, role, LIFF metadata, and nested subcollections:
  - `conversation_history`: capped at 200 docs via `ConversationStore.trimHistory`.
  - `product_drafts`: workflow states (`awaiting_image`, `completed`, `cancelled`, `expired`).
  - `images`: uploaded image metadata.
  - `settings/image_binding`: temporary instructions for directing the next photo.
- `products`, `stores`, `marketing_materials`: entity collections with ownership (`userId`) and automation metadata.
- `webhook_event_dedupe`: transient idempotency keys managed by `EventDeduper`.
- Cloud Storage bucket: holds optimised media assets referenced in Flex responses or marketing content.

## 11. Supporting REST APIs Under `/api`
- Auth helpers:
  - `POST /api/auth/line/token` and `/profile` integrate with LINE Login; mock counterparts support development toggled by `USE_MOCK_LINE`.
  - `POST /api/auth/line` verifies LIFF ID tokens and issues Firebase custom auth tokens.
- Business data endpoints:
  - `/user/:userId/stats`, `/products`, `/stores`, `/conversations`, `/marketing-materials` expose CRUD-style operations and analytics for the web dashboard.
- Webhook management:
  - `POST /api/webhook/setup` registers and verifies the bot endpoint with LINE’s channel API.
- `GET /api/health` runs a Firestore health check so Cloud Functions monitoring can detect outages.

## 12. Configuration and Environment Controls
- `runtimeConfig.ts` merges Firebase Functions config with `process.env` to populate:
  - `lineAccessToken`, `lineChannelSecret`, `liffUrl`.
  - Feature toggles: `skipLineApi`, `useMockLine`, `isEmulator`.
- `LineBotAPI.shouldSkipLineApi` respects these toggles so development environments avoid calling the real LINE API.
- The Firebase Admin SDK initialises from `FIREBASE_SERVICE_ACCOUNT` JSON when present, otherwise falls back to ADC or anonymous project credentials.
- Gemini requires `GEMINI_API_KEY` or compatible env var; without it the handler gracefully falls back to clarification prompts.

## 13. Reliability & Observability
- Structured logging throughout `WebhookHandler`, `LineBotAPI`, and `gemini-client` surfaces event summaries, tool call selections, and error conditions.
- Error guards ensure LINE is always replied to (even on failure) to prevent retries.
- `EventDeduper.markCompleted` extends TTLs for processed events so duplicate deliveries during long running operations remain suppressed.
- Health endpoint and Firestore-based sanity checks support deployment monitoring and automated smoke tests.

---

By following the pipelines above, you can trace any LINE interaction—from signature validation to AI planning, database mutations, and outbound Flex messages—through the Farm2Market Cloud Functions stack. Extend behaviour by adding new Gemini tool bindings, DatabaseService helpers, or postback handlers, keeping the choreography between Gemini plans, Firestore writes, and LINE messaging consistent with the patterns documented here.
