# VÉLORA — Luxury fashion editorial, runway & portfolio platform

A React/Vite storefront backed by Express, MongoDB Atlas/Mongoose, and Supabase Auth (email/password + Google OAuth). Includes a luxury editorial storefront, searchable/category-filtered product catalogue, runway-show and model portfolio sections, shopping-bag UI, seed demo content, and server-side role authorization.

> **Scope:** This is a full-stack assignment/demo, not a production commerce deployment. Checkout places **cash-on-delivery orders** with server-side pricing and atomic stock reservation. There is **no online payment gateway, no tax calculation, no email notifications, and no image upload** (products use image URLs). Newsletter delivery and real event ingestion are not implemented. Demo show/model content is marked as fictional/unverified. Do not accept real payments until a payment provider (e.g. Razorpay), tax/shipping rules, and operational controls are added and tested.

## What each role can do

| Role | Sees in the app | Server permissions |
| --- | --- | --- |
| **Customer** (default) | Product pages, bag, checkout, **My orders** (cancel until shipped) | Create/read/cancel **own** orders only |
| **Designer** | Everything above + **My products** (create, edit, hide/publish) | Create products; edit only products they created; cannot feature products; cannot see orders or other users |
| **Model** | **Portfolio** placeholder + My orders | Recognised by the server; portfolio self-editing is **not built yet** |
| **Admin** | **Overview** (revenue, orders by status, low stock), **All orders** (change status), **Products** (all), **Users & roles** | Everything above for all users; assigns customer/model/designer roles; cannot grant admin through the app |

Dashboard URL: `http://localhost:5173/#/dashboard`. Roles are enforced on the server; hiding a tab in the UI is only cosmetic.

### Making someone a designer
1. They register and sign in once (this creates their profile).
2. Sign in as the admin → **Dashboard → Users & roles** → change their role.
3. They reload and see the designer dashboard.

## Requirements

- Node.js 20 LTS or newer and npm
- MongoDB Atlas project/database user with network access for your current IP
- Supabase project with email/password and Google provider enabled
- Google OAuth Web Client configured in Supabase

## Setup on Windows

Open PowerShell in `C:\Users\hp\Desktop\coding\velora` (or the folder where you extract this ZIP).

1. Install dependencies:

   ```powershell
   npm install
   npm --prefix client install
   npm --prefix server install
   ```

2. Create environment files by copying examples:

   ```powershell
   Copy-Item server\.env.example server\.env
   Copy-Item client\.env.example client\.env
   ```

3. Fill `server/.env` with your MongoDB Atlas URI, Supabase project URL and **publishable** key. Set `CLIENT_URL=http://localhost:5173`. Do not use a Supabase service-role/secret key in the browser or in these settings. Do not commit either `.env` file.

4. Fill `client/.env` with the same Supabase project URL, its publishable key, and `VITE_API_URL=http://localhost:5000`.

5. In Supabase → Authentication → URL Configuration, set Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to Redirect URLs. In Authentication → Providers → Google, configure the Google Client ID/secret. The Google Cloud OAuth Web Client's authorized redirect URI must be the exact Supabase callback shown on that provider page, normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

6. Start both services from the project root:

   ```powershell
   npm run dev
   ```

   Frontend: `http://localhost:5173`  
   API health: `http://localhost:5000/api/health`

   `http://localhost:5000/` intentionally has no homepage; the Express API is served under `/api`.

7. Seed or refresh the fictional demo catalogue (repeatable/upsert-based). It creates **20 products, 6 runway shows, 6 model profiles**. Re-running updates descriptions/images but never resets stock that real orders have consumed:

   ```powershell
   npm --prefix server run seed
   ```

   Demo photos repeat within a category (only a few demo images are bundled). Replace the image URLs in `server/src/seed.js`, or edit products from the Admin dashboard, with your own licensed images.

## First administrator bootstrap

1. In `server/.env`, set `BOOTSTRAP_ADMIN_EMAIL` to an email address you control.
2. Register that address in VÉLORA and complete email confirmation if Supabase requires it.
3. Sign in once so the backend verifies the Supabase access token and creates the MongoDB profile with the administrator role.
4. Remove `BOOTSTRAP_ADMIN_EMAIL` from `server/.env` and restart the API. Do not leave the bootstrap email configured longer than needed.
5. Never set a role in client-side metadata to obtain privileges. The server uses the MongoDB profile role; new users default to `customer`. Admins can assign `customer`, `model`, or `designer` only. The role endpoint does not grant admin.

If you have already created the Supabase project and Google OAuth app, reuse them; do not paste keys/passwords into chat. If sign-in returns `Invalid login credentials`, confirm the user exists in the same Supabase project URL used by the client, check email confirmation, and reset the password if needed.

## API routes

- `GET /api/health` — API + MongoDB connection state (503 when DB is disconnected)
- `GET /api/products` and `GET /api/products/:id-or-slug` — published catalogue (detail includes sizes, colours, material, care, details)
- `POST /api/products`, `PATCH /api/products/:id`, `GET /api/products/manage/list` — admin/designer product management (designers: own products only)
- `POST /api/orders` — place an order (signed in). Prices and stock come from the database; the browser's prices are ignored
- `GET /api/orders/mine`, `PATCH /api/orders/:id/cancel` — the signed-in customer's orders
- `GET /api/orders`, `PATCH /api/orders/:id/status` — admin only
- `GET /api/admin/summary`, `GET /api/admin/users` — admin only
- `GET /api/shows` — published runway show records
- `GET /api/models` — published model portfolio records
- `GET /api/auth/me` — requires a valid Supabase access token; syncs a MongoDB profile
- `GET /api/auth/customer-area`, `/model-area`, `/designer-area`, `/admin-area` — role-protected examples
- `PATCH /api/auth/profiles/:profileId/role` — admin only; accepts customer/model/designer, never admin

For protected routes, send `Authorization: Bearer <Supabase access token>`.

## Tests and verification

Install dependencies first, then run:

```powershell
npm run build
npm --prefix server test
npm --prefix server run test:security
```

`npm --prefix server test` now includes `test/orders-roles.integration.test.js`, which exercises the real auth middleware (through a fake Supabase endpoint) and checks ordering, stock reservation/rollback, concurrent last-unit orders, order cancellation, role enforcement, and designer ownership. To run against your own MongoDB instead of downloading one, set `MONGODB_TEST_URI`.

The server test suite includes security regressions for missing bearer tokens, role authorization, malformed JSON, unknown routes, and security headers. Tests that require a live MongoDB Atlas connection or valid Supabase/Google OAuth credentials must be run in your configured environment; those external services cannot be verified by a packaged ZIP alone. Record the actual test output before treating this as production-ready.

## Security notes

- Helmet security headers, explicit single-origin CORS, bounded JSON body size, auth-route rate limiting, and generic server errors are enabled.
- Supabase `auth.getUser(accessToken)` validates the bearer token; the API does not trust browser-provided role claims.
- MongoDB role profiles are authoritative. New users are customers; elevated roles are assigned server-side.
- Only publishable Supabase keys belong in client configuration. Keep MongoDB credentials and any Supabase secret/service-role key server-side and private.
- Configure Atlas Network Access narrowly for development; never allow `0.0.0.0/0` in a production database unless you have a deliberate compensating network design.
- Demo images use remote Unsplash URLs. Verify licensing/attribution and replace any image or model/event information before public use.
