# VÉLORA Stage 3 — Supabase Auth + MongoDB profiles + role authorization

This is a **merge patch** for the Stage 2 project, not a replacement for the `velora` folder. Back up the project before merging. These files are a starter implementation; configure and test them locally before treating the site as production-ready.

## What this stage adds

- Email/password sign-up and sign-in.
- Google OAuth sign-in through Supabase.
- Supabase access-token verification by the Express server.
- A MongoDB `UserProfile` document created/updated when an authenticated user calls `GET /api/auth/me`.
- Roles `customer`, `model`, `designer`, `admin` stored only in MongoDB, not trusted from browser metadata.
- `requireAuth` and `requireRole(...)` middleware plus sample protected endpoints.
- Admin-only role assignment for customer/model/designer. The endpoint cannot grant `admin`.
- Bootstrap admin via a single confirmed email set in the server's private `.env`.

## Important security behavior

1. The browser receives only Supabase's publishable key. Never put a Supabase secret/service-role key in the React `VITE_*` environment.
2. The server validates access tokens using `supabase.auth.getUser(token)`; it does not trust a decoded JWT or a role sent by the browser.
3. User metadata is used only for display name/avatar. Role changes in Supabase `user_metadata` do not grant permissions.
4. Every new profile defaults to `customer`. A model/designer role must be assigned by an admin after reviewing the account.
5. Admin bootstrap applies only when `BOOTSTRAP_ADMIN_EMAIL` exactly matches a confirmed Supabase email. Keep this variable private. After the first admin profile is created, remove the variable from `.env` and restart the server. Existing role remains in MongoDB.
6. This protects Express API routes. Do not expose sensitive data through unprotected routes or direct client-side MongoDB access. Production deployment also needs HTTPS, rate limiting, robust logging, and appropriate operational controls.

## A. Merge the patch on Windows

1. Stop the running app with `Ctrl+C` in each terminal.
2. Back up `C:\Users\hp\Desktop\coding\velora`.
3. Download `velora-stage3-patch.zip` and extract it to `C:\Users\hp\Desktop\coding` (not inside the existing `velora` folder). The archive contains a `velora` folder, so it will merge into the project.
4. In VS Code open `C:\Users\hp\Desktop\coding\velora`.

PowerShell command if the ZIP is in Downloads:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\velora-stage3-patch.zip" -DestinationPath "C:\Users\hp\Desktop\coding" -Force
```

## B. Configure Supabase

1. Open https://supabase.com/dashboard and create/open the VÉLORA project.
2. In **Project Settings → API** (or the project's Connect/API details), copy the **Project URL** and the **publishable key**. Older projects may label the public key `anon`. The publishable/anon key is intended for the frontend; never use the secret/service-role key here.
3. In **Authentication → URL Configuration**, set Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to the allowed Redirect URLs.
4. In **Authentication → Providers → Email**, enable email/password sign-in. For development, keep email confirmation enabled if possible; test by opening the confirmation email. If confirmation is enabled, a new signup may not create an active session until confirmed.
5. For Google OAuth, follow Supabase's current Google provider guide: https://supabase.com/docs/guides/auth/social-login/auth-google
   - In Google Cloud Console, create/select a project and configure the OAuth consent screen / Google Auth Platform audience.
   - Create an OAuth Client ID of type **Web application**.
   - In Google Cloud's **Authorized redirect URIs**, add the callback URI shown by Supabase under Authentication → Providers → Google. It is typically `https://<project-ref>.supabase.co/auth/v1/callback`; copy the exact URI shown in your dashboard.
   - Copy the Google Client ID and Client Secret into the Supabase Google provider settings, enable Google, and save.
   - Supabase's provider callback URI above is different from your app redirect URL. The app redirect URL is `http://localhost:5173` and belongs in Supabase URL Configuration.
6. Do not add wildcards to Google's authorized redirect URI. Use the exact callback URL Supabase displays.

## C. Configure environment files

### Frontend

Open `client` in the project. Create `client/.env` by copying `client/.env.example`:

```powershell
cd C:\Users\hp\Desktop\coding\velora\client
copy .env.example .env
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your real project URL/key. Keep `VITE_API_URL=http://localhost:5000` for local development. Restart Vite after changing environment variables.

### Backend

Open `server/.env`. Keep your existing Stage 2 values (`PORT`, `CLIENT_URL`, `MONGODB_URI`) and append the following values from `server/.env.stage3.example`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
BOOTSTRAP_ADMIN_EMAIL=you@example.com
```

Replace placeholders. `BOOTSTRAP_ADMIN_EMAIL` should be the email you control and will confirm in Supabase. After that user signs in and `GET /api/auth/me` succeeds, the MongoDB profile becomes admin. Then remove `BOOTSTRAP_ADMIN_EMAIL` from `.env` and restart the server. Do not commit either `.env` file.

## D. Install dependencies

Run these commands in Command Prompt or the VS Code terminal:

```cmd
cd /d C:\Users\hp\Desktop\coding\velora
npm --prefix server install @supabase/supabase-js
npm --prefix client install @supabase/supabase-js
```

## E. Wire the routes and UI into existing files

The patch intentionally does not overwrite Stage 2's main files, so your existing storefront remains intact.

### Backend route

Open `server/src/server.js`. Add the import shown in `server/src/server.stage3-snippet.js.txt` and mount `app.use("/api/auth", authRoutes);` after JSON middleware and before the server starts listening. Keep all existing Stage 2 routes and DB setup. Example placement:

```js
import authRoutes from "./routes/auth.js";
// ... app creation and middleware ...
app.use(express.json());
// ... existing routes ...
app.use("/api/auth", authRoutes);
// ... existing app.listen(...) logic ...
```

### Frontend UI

Open `client/src/App.jsx`. Add:

```jsx
import AuthPanel from "./components/AuthPanel.jsx";
```

Render `<AuthPanel />` in the account area or near the bottom of the existing page's JSX. Do not replace your existing `App.jsx` with the snippet file. The snippet is also saved as `client/src/App.stage3-snippet.jsx.txt`.

## F. Run and verify

Start backend in terminal 1:

```cmd
cd /d C:\Users\hp\Desktop\coding\velora
npm --prefix server run dev
```

Start frontend in terminal 2:

```cmd
cd /d C:\Users\hp\Desktop\coding\velora
npm --prefix client run dev
```

If your Stage 2 root `npm run dev` already starts both processes, you may use it instead after installing dependencies.

Verify:

1. Open `http://localhost:5173` and find the account panel.
2. Sign up with an email you can access. If confirmation is enabled, confirm the email, then sign in.
3. Sign out and use email/password sign-in.
4. Use **Continue with Google**; after consent, you should return to the local site.
5. After successful login, the UI should show email and role `customer` (unless this is the configured confirmed bootstrap-admin email).
6. Open `http://localhost:5000/api/auth/me` directly: it should return 401 without a Bearer token. That is expected.
7. Authenticated browser requests call `/api/auth/me` with the Supabase access token and should return the MongoDB profile.
8. In MongoDB Atlas/Compass, inspect database `velora`, collection `userprofiles` (Mongoose's default pluralization). Each Supabase user should have one profile, keyed by `supabaseUserId`.
9. Test protected routes from browser devtools or an API client by sending `Authorization: Bearer <access_token>` to `/api/auth/customer-area`, `/api/auth/model-area`, `/api/auth/designer-area`, and `/api/auth/admin-area`. Non-admin users should get 403 for admin-only routes. Do not paste tokens into chats or public issue trackers.

## G. Assign model/designer roles

Sign in with the bootstrap admin account. The `GET /api/auth/me` response includes the MongoDB profile `id`. Using an API client, send a PATCH request to `http://localhost:5000/api/auth/profiles/<PROFILE_ID>/role` with:

Header:

```http
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
Content-Type: application/json
```

JSON body:

```json
{ "role": "model" }
```

Allowed values are `customer`, `model`, `designer`. The endpoint rejects `admin`; admin provisioning is separate. Never share an access token. For a demo, role assignment can be performed from an API client; a dedicated admin UI can be added later.

## H. Common problems

- **Supabase is not configured**: check `client/.env`, names must start with `VITE_`, and restart Vite.
- **503 Authentication is not configured**: check `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `server/.env`, then restart backend.
- **401 on `/api/auth/me`**: expected without a token; if signed in, inspect browser Network tab and verify the request has `Authorization: Bearer ...`.
- **Google redirect_uri_mismatch**: copy the exact callback URL from Supabase Google provider settings into Google's Authorized redirect URIs. Do not use `localhost:5173` as Google's provider callback.
- **Redirect URL not allowed**: add `http://localhost:5173` (and optionally `http://localhost:5173/**`) in Supabase Authentication → URL Configuration.
- **Profile sync fails**: check the server terminal, MongoDB connection, environment values, and that `authRoutes` is mounted.
- **Email signup says check email**: expected when confirmation is enabled. Confirm first, then sign in.
- **Role still customer**: roles are not self-selected. Confirm that the bootstrap email exactly matches the verified email and that the profile-sync endpoint has run. Remove bootstrap env only after the admin profile is created.

## References

- Supabase React quickstart: https://supabase.com/docs/guides/auth/quickstarts/react
- Supabase `getUser(jwt)` reference: https://supabase.com/docs/reference/javascript/auth-getuser
- Google OAuth setup: https://supabase.com/docs/guides/auth/social-login/auth-google
- Redirect URL configuration: https://supabase.com/docs/guides/auth/redirect-urls
