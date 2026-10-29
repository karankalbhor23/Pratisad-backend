# Deploying Pratisad API (Scaleopal VPS)

Production URLs:

| Service | URL |
|---------|-----|
| Frontend | `https://pratisad.scaleopal.com` (Vercel) |
| API | `https://api.pratisad.scaleopal.com` (VPS + NPM) |

This matches your **LMS workflow**: GitHub repo on the VPS → `git pull` → `docker compose` rebuild.

---

## Architecture on your VPS

```text
api.pratisad.scaleopal.com
        ↓
Nginx Proxy Manager (:443)     /root/stack/
        ↓
127.0.0.1:4002  →  pratisad-api container
                           ↓
                    postgres:5432 / pratisad_db
                    (shared stack_scaleopal_network)
```

Host ports already used: **4000** (LMS prod), **4001** (LMS staging). Pratisad uses **4002**.

---

## One-time VPS setup

### 1. GitHub access on the VPS

Same as LMS — either HTTPS + token or SSH deploy key.

**SSH deploy key (recommended):**

```bash
ssh-keygen -t ed25519 -C "vps-pratisad-api" -f ~/.ssh/id_ed25519_pratisad -N ""
cat ~/.ssh/id_ed25519_pratisad.pub
```

Add the public key in GitHub → repo → **Settings → Deploy keys** (read-only is enough).

```bash
# ~/.ssh/config snippet (optional)
Host github.com-pratisad
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_pratisad
```

### 2. Clone the repo

```bash
cd /root
git clone git@github.com:YOUR_ORG/pratisad-api.git pratisad-api
cd pratisad-api
```

### 3. Environment file

```bash
cp .env.vps.example .env
nano .env
```

Use the **same postgres password** as `/root/stack/.env` (`POSTGRES_PASSWORD`).

Required values:

```env
CORS_ORIGIN=https://pratisad.scaleopal.com
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/pratisad_db?schema=public
PLATFORM_ADMIN_EMAIL=your-admin@scaleopal.com
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
WEB_APP_ORIGIN=https://pratisad.scaleopal.com
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
E2E_AUTH_BYPASS=false

# Optional — Google review auto-reply (see "Google Business Profile" below)
# GOOGLE_OAUTH_CLIENT_ID=
# GOOGLE_OAUTH_CLIENT_SECRET=
# GOOGLE_OAUTH_REDIRECT_URI=https://api.pratisad.scaleopal.com/integrations/google/callback
# GOOGLE_TOKEN_ENCRYPTION_KEY=
# GOOGLE_OAUTH_STATE_SECRET=
```

Register a Clerk webhook pointing to `https://api.pratisad.scaleopal.com/webhooks/clerk` with event **user.created** (activates invited business portal users).

---

## Google Business Profile (review auto-reply)

Feature is **off for every business** until an admin enables **Allow Google auto-reply** on the business edit page. Then the portal user connects Google, picks a location, and enables auto-reply.

### 1. Google Cloud (one-time)

1. Create a GCP project and enable billing.
2. Enable APIs (Library search names):
   - **Google Business Profile API** (`mybusiness.googleapis.com`) — **reviews & replies** (required; not the same as “Performance API”)
   - **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
   - **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
3. **Request GBP API access** (required for many new projects): even with APIs “Enabled”, quota is often **0** until Google approves access. Submit the form at [Google Business Profile API prerequisites — Request access](https://developers.google.com/my-business/content/prereqs#request-access). Wait for approval email before **Load locations** / sync will work.
4. OAuth consent screen (External): add scope `https://www.googleapis.com/auth/business.manage`, privacy policy URL, test users while in Testing.
5. Create OAuth **Web client** redirect URI: `https://api.pratisad.scaleopal.com/integrations/google/callback` (and local `http://localhost:4000/integrations/google/callback` for dev).
6. Publish OAuth app to Production after Google verification (required for non–test users).

### 2. VPS env (add to `.env`)

```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://api.pratisad.scaleopal.com/integrations/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=long_random_secret
GOOGLE_OAUTH_STATE_SECRET=another_long_random_secret
WEB_APP_ORIGIN=https://pratisad.scaleopal.com
```

Generate secrets with `openssl rand -base64 32` (or equivalent). Redeploy API after migration `20261028120000_google_reviews`.

### 3. Behaviour

- Scheduled sync: **once daily** (04:00 UTC cron). Portal **Sync now** for manual pull (optional cooldown via `GOOGLE_REVIEWS_MANUAL_SYNC_COOLDOWN_MS`; use `900000` for 15 minutes in production).
- **4–5★** with auto-reply on: AI reply posted automatically after sync.
- **1–3★**: AI draft → business **Approve & post** in portal.
- Admin setting `googleAutoReplyAllowed=false` stops processing and hides portal UI.

Rollback without code deploy: revoke admin allow on affected businesses.

### Troubleshooting: `401 invalid_client` / OAuth client was not found

Google shows this when the **client_id in the sign-in URL is wrong or unknown**. Fix on the VPS and in Google Cloud:

1. **Use the Web client ID**, not the secret. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**, open your **OAuth 2.0 Client ID** of type **Web application**. Copy **Client ID** (ends with `.apps.googleusercontent.com`) into `GOOGLE_OAUTH_CLIENT_ID`. Put **Client secret** in `GOOGLE_OAUTH_CLIENT_SECRET` only.
2. **No quotes or spaces** in `/root/pratisad-api/.env`:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```
3. **Same GCP project** as the OAuth consent screen where you added `business.manage`.
4. **Redirect URI** in Google Cloud must exactly match `GOOGLE_OAUTH_REDIRECT_URI`:
   `https://api.pratisad.scaleopal.com/integrations/google/callback`
5. After editing `.env`, recreate the API container so env loads:
   ```bash
   cd /root/pratisad-api && docker compose -f docker-compose.vps.yml up -d --force-recreate
   ```
6. Check API container logs (`docker logs pratisad-api --since 10m`) after one connect attempt. Look for:
   - `Google OAuth callback missing params` — Google did not send `code`/`state` (proxy stripping query string, wrong redirect URI host, or user cancelled).
   - `Google OAuth callback failed (encryption)` — set `GOOGLE_TOKEN_ENCRYPTION_KEY` and recreate container.
   - `Google OAuth callback failed (refresh_token)` — revoke app at myaccount.google.com/permissions and reconnect.
   - `Google OAuth callback completed successfully` — connection saved; use **Load locations** in portal.

### Connected but “Could not load locations”

OAuth can succeed while **Business Profile API** calls fail. On VPS:

```bash
docker logs pratisad-api --since 10m 2>&1 | grep "Google API"
```

**403** on `mybusinessaccountmanagement.googleapis.com` or `mybusinessbusinessinformation.googleapis.com` usually means **GBP API access not approved** (quota stays 0 until Google approves). Enable **Google Business Profile API** (`mybusiness.googleapis.com`) — not only Performance API — and submit [request access](https://developers.google.com/my-business/content/prereqs#request-access).

If the client was deleted in Google Cloud, create a new Web OAuth client and update both env vars.

---

### 4. Create database on shared Postgres

```bash
chmod +x scripts/init-vps-db.sh scripts/deploy-vps.sh
./scripts/init-vps-db.sh
```

### 5. First deploy

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Migrations run automatically on container start (`docker-entrypoint.sh`).

### 6. Seed platform admin (once)

```bash
docker compose -f docker-compose.vps.yml --profile tools run --rm seed
```

### 7. Nginx Proxy Manager

Open `http://72.62.163.10:81` → **Proxy Hosts** → **Add**:

| Field | Value |
|-------|--------|
| Domain | `api.pratisad.scaleopal.com` |
| Scheme | `http` |
| Forward hostname | `72.62.163.10` |
| Forward port | `4002` |
| Block common exploits | On |
| Websockets | Off |
| SSL | Request new Let's Encrypt certificate |

### 8. Cloudflare DNS

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `api.pratisad` | `72.62.163.10` | DNS only (grey) |

### 9. Verify

```bash
curl http://127.0.0.1:4002/health
curl https://api.pratisad.scaleopal.com/health
```

---

## Day-to-day deploy (after code changes)

On the VPS:

```bash
cd /root/pratisad-api
./scripts/deploy-vps.sh
```

Or manually (same as LMS):

```bash
cd /root/pratisad-api
git pull origin main
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml logs -f --tail=50 pratisad-api
```

Rebuild without pull:

```bash
./scripts/deploy-vps.sh --no-pull
```

---

## Useful commands

```bash
# Logs
docker compose -f docker-compose.vps.yml logs -f pratisad-api

# Restart without rebuild
docker compose -f docker-compose.vps.yml restart pratisad-api

# Stop
docker compose -f docker-compose.vps.yml down

# Re-run migrations + seed
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml --profile tools run --rm seed
```

---

## Clerk alignment

- Same **production** Clerk app as Vercel frontend.
- `CLERK_SECRET_KEY` must match Vercel.
- `PLATFORM_ADMIN_EMAIL` must match Clerk admin user email.
- Session token claims: `metadata` + `primary_email_address`.

---

## Security checklist

- [ ] `.env` never committed to Git
- [ ] `E2E_AUTH_BYPASS=false`
- [ ] API on `127.0.0.1:4002` only (NPM handles public HTTPS)
- [ ] Clerk sign-up disabled
- [ ] Production Clerk keys (`sk_live_`)
