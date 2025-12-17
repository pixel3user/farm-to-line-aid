# LINE Pay Setup Guide

This guide walks through everything you need in the LINE Developers console to make the `/market/checkout` → LINE Pay flow work in Farm2Market AI.

## 1. Create (or enable) a LINE Pay Channel

1. Log into [LINE Developers Console](https://developers.line.biz/console/) using the business account that owns your LIFF/LINE Login channel.
2. Inside the provider you already use for Farm2Market, request **LINE Pay** and create a **Payment channel**. Sandbox approval is near instant, production requires an additional merchant review.
3. Note the following values from the LINE Pay channel dashboard:
   - **Channel ID**
   - **Channel Secret Key**
   - **Merchant ID** (used for reconciliation but not needed in code)
4. In the LINE Pay channel → **App settings**, add the domain serving your web app (e.g. `https://demo.farm2market.ai`). This must match the domain configured in your LIFF app as well.

## 2. Set callback URLs for LINE Pay

Inside the LINE Pay channel settings, configure the following URLs:

- **Confirm URL:** `https://<your-domain>/payments/line-pay/result`
- **Cancel URL:** `https://<your-domain>/payments/line-pay/result?status=cancelled`

These URLs must use HTTPS and be publicly reachable from LINE. They map to the `/payments/line-pay/result` page that completes the confirmation API call.

## 3. Register allowed web origins

Inside each of the following sections add the same domain(s):

- LINE Pay → **App settings** → Allowed domains
- LIFF app → **Endpoint URL** and **Allowed domains**

If you plan to test locally on devices, also add `https://liff.line.me` and your tunnel/mocked hostname.

## 4. Configure the application environment

Populate both the root `.env` and `functions/.env` (or `firebase functions:config:set`) with the new LINE Pay credentials:

```env
LINE_PAY_CHANNEL_ID=your_line_pay_channel_id
LINE_PAY_CHANNEL_SECRET=your_line_pay_channel_secret
LINE_PAY_SANDBOX=true # switch to false for production once LINE approves you

# Optional but recommended for redirects
FRONTEND_BASE_URL=https://your-domain
API_BASE_URL=https://your-api-domain
```

When deploying Firebase Functions, the same values can be stored via:

```bash
firebase functions:config:set \
  linepay.channel_id="your_line_pay_channel_id" \
  linepay.channel_secret="your_line_pay_channel_secret" \
  linepay.sandbox="true" \
  app.frontend_url="https://your-domain" \
  app.api_base_url="https://your-api-domain"
```

## 5. Verify configuration locally

1. Start the stack with `npm run dev` (runs the Vite client on `8080` and the Express server on `3000`).
2. Open `http://localhost:8080/market/checkout`. The new **LINE Pay Setup Checklist** card displays whether the backend sees the credentials.
3. Alternatively call `GET http://localhost:3000/api/payments/line-pay/status`. A `configured: true` response means the checkout can reserve payments.
4. Add products to the cart and hit **Proceed to LINE Pay**. You should be redirected to the sandbox payment page.

## 6. Promote to production

1. Request LINE Pay production access in the Developers console and wait for approval.
2. Replace the sandbox channel credentials with the production ones.
3. Set `LINE_PAY_SANDBOX=false` (or `linepay.sandbox=false` in Functions config).
4. Update the Confirm/Cancel URLs to the production domain.
5. Run through one live transaction to verify settlement before opening access to shoppers.

## Troubleshooting

- **Reserve call returns “LINE Pay is not fully configured”:** One of the credentials is missing or incorrect. Re-run the `/api/payments/line-pay/status` check.
- **LINE Pay redirect loops back immediately:** The Confirm URL is not reachable from LINE or the domain is not whitelisted.
- **“Failed to start checkout” toast:** Check the server logs for LINE Pay API errors (the sandbox will specify if the order amount is invalid or duplicated).

Following the checklist above plus the inline helper on `/market/checkout` ensures developers always know what is missing before going live with payments.
