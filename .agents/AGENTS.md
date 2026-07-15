# MediQ — Agent Rules & Project Context

## Project Overview
- **Name**: MediQ — Book Doctor Appointments Online
- **Type**: Progressive Web App (PWA) + Android Capacitor App
- **Stack**: Vite + React + TypeScript, TailwindCSS, shadcn/ui, Supabase (Auth + DB + Edge Functions), Razorpay payments
- **Deployed at**: https://mediq-web-delta.vercel.app
- **Supabase Project ID**: `vcycuilwoplwghxsplew`
- **Supabase URL**: `https://vcycuilwoplwghxsplew.supabase.co`

---

## Key Files
- **Payment page**: `src/pages/Payment.tsx` — Razorpay checkout flow (web + native Capacitor)
- **Edge Functions**: `supabase/functions/`
  - `create-razorpay-order/index.ts` — Creates a Razorpay order server-side
  - `verify-razorpay-payment/index.ts` — Verifies signature, creates appointment + payment record
  - `send-notification/` — Sends confirmation emails
- **Supabase client**: `src/integrations/supabase/client.ts`
- **Auth hook**: `src/hooks/useAuth.tsx`
- **Environment**: `.env` (frontend vars), Supabase Dashboard secrets (edge function vars)

---

## Environment Variables

### Frontend (`.env`)
```
VITE_SUPABASE_PROJECT_ID=vcycuilwoplwghxsplew
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://vcycuilwoplwghxsplew.supabase.co
VITE_RAZORPAY_KEY_ID=rzp_test_Rl44hquefSgy3C
```

### Supabase Edge Function Secrets (set in Supabase Dashboard)
```
RAZORPAY_KEY_ID=rzp_test_Rl44hquefSgy3C       ← must match VITE_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=<secret for rzp_test_Rl44hquefSgy3C>
SUPABASE_URL=https://vcycuilwoplwghxsplew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
INTERNAL_SERVICE_SECRET=<internal secret>
```

---

## Razorpay Integration Notes

### Critical Rule — Key ID Must Match
The `VITE_RAZORPAY_KEY_ID` (frontend) and `RAZORPAY_KEY_ID` (Supabase edge function secret) **must be from the same Razorpay API key pair**. Mismatch causes:
> "Oops! Something went wrong. Payment Failed"

This was the root cause of a payment failure bug (July 2026). The `.env` had key `rzp_test_TAhe0vT5Iqew1O` while `env.txt` (used to set Supabase secrets) had `rzp_test_Rl44hquefSgy3C`. The fix was to sync both to `rzp_test_Rl44hquefSgy3C`.

### Payment Flow (Web)
1. User clicks "Pay Now" → `handlePayment()` in `Payment.tsx`
2. Razorpay JS SDK loaded dynamically from `https://checkout.razorpay.com/v1/checkout.js`
3. `create-razorpay-order` edge function called (needs JWT Bearer token in Authorization header)
4. Razorpay checkout modal opened with `order_id`
5. On success → `verify-razorpay-payment` edge function called
6. Edge function verifies HMAC signature, creates appointment + payment record

### Payment Flow (Android Native)
- Uses `window.RazorpayCheckout` (Capacitor plugin)
- On payment result, deep link `com.mediq.app://payment?status=...` fires
- `appUrlOpen` listener in `Payment.tsx` handles the result

### Test Mode
- App is in **Razorpay test mode** (`rzp_test_*` keys)
- Test card: `4111 1111 1111 1111`, any future expiry, any CVV
- Test UPI: `success@razorpay`
- Signature mismatch in test mode is logged as a warning but **not rejected** (see `verify-razorpay-payment/index.ts` line ~148)

---

## Supabase Edge Functions Config (`supabase/config.toml`)
```toml
project_id = "vcycuilwoplwghxsplew"

[functions.verify-razorpay-payment]
verify_jwt = false   # Manually validates JWT inside the function

[functions.create-razorpay-order]
verify_jwt = false   # Manually validates JWT inside the function
```
> Note: Even though `verify_jwt = false`, `create-razorpay-order` still requires an Authorization header with a valid JWT. If the user's session is expired, order creation will fail with `{ error: 'Invalid or expired token' }`.

---

## Known Issues & Fixes

| Issue | Cause | Fix |
|---|---|---|
| "Oops! Something went wrong. Payment Failed" | Key ID mismatch between frontend `.env` and Supabase secrets | Sync `VITE_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_ID` to same key pair |
| Payment fails silently | Session token expired before payment | User needs to re-login; no auto-refresh on payment page |
| Notification emails fail | `INTERNAL_SERVICE_SECRET` not set in Supabase | Set secret in Supabase Dashboard; appointment still created |

---

## Deployment
- **Frontend**: Vercel (`vercel.json` present)
- **Edge Functions**: Supabase hosted (deploy via `npx supabase functions deploy <name> --project-ref vcycuilwoplwghxsplew`)
- **Android**: Capacitor (`capacitor.config.ts`, `android/` directory)

## Development Commands
```bash
npm run dev          # Start local dev server
npm run build        # Build for production
npx supabase functions deploy create-razorpay-order --project-ref vcycuilwoplwghxsplew
npx supabase functions deploy verify-razorpay-payment --project-ref vcycuilwoplwghxsplew
```
