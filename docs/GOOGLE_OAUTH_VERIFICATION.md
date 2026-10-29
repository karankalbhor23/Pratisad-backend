# Google OAuth verification (Production) — Pratisad

Use this checklist so **any** business user can **Connect Google** without being added as a **Test user**. Until verification completes, keep the OAuth app in **Testing** and add pilot Gmail accounts under **Test users**.

Official references:

- [OAuth verification FAQ](https://support.google.com/cloud/answer/13463817)
- [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [GBP API prerequisites](https://developers.google.com/my-business/content/prereqs)

---

## Do you have to pay?

| Item | Cost |
|------|------|
| **Google OAuth app verification** | **No fee from Google** |
| **Enabling GCP APIs / OAuth client** | **No Google “verification fee”**; you may need a **billing account** on the GCP project to enable APIs (usage is typically within free/low quota for SMB review sync) |
| **OAuth scope `business.manage`** | Shown on your consent screen as **Sensitive** or **Restricted**. If **Restricted** and your app handles tokens on a **server** (Pratisad does), Google usually requires an annual **CASA security assessment** by a **third-party assessor** — **not paid to Google**; price is negotiated with the assessor (often cited roughly **$15k–$75k** for complex apps; smaller apps may pay less). Confirm the badge on **APIs & Services → OAuth consent screen → Scopes**. |
| **Pilot / Testing mode** | **Free** — add up to **100 test users**, no full verification |

**Practical path:** run pilots in **Testing** with test users; start **brand + scope verification** when you are ready for public launch; budget for **CASA** only if Console marks `business.manage` as **Restricted** and Google requests it.

---

## Public URLs (deploy web first)

After deploying `pratisad-web`, set these on the OAuth consent screen:

| Field | URL |
|-------|-----|
| Application home page | `https://pratisad.scaleopal.com` |
| Privacy policy | `https://pratisad.scaleopal.com/privacy` |
| Terms of service | `https://pratisad.scaleopal.com/terms` |
| Authorized domain | `scaleopal.com` (verify domain ownership in Google Search Console or Cloud) |

Optional env on Vercel:

```env
NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=hello@scaleopal.com
```

---

## GCP Console checklist (you do these manually)

### A. OAuth consent screen — Branding

1. [Google Cloud Console](https://console.cloud.google.com/) → project that owns `GOOGLE_OAUTH_CLIENT_ID`
2. **APIs & Services → OAuth consent screen**
3. User type: **External**
4. Fill **App name** (Pratisad), **User support email**, **Developer contact emails**
5. Upload **App logo** (square; matches site)
6. **App domain**: homepage + privacy + terms URLs above
7. **Authorized domains**: `scaleopal.com` (and verify)

### B. Scopes

Add and justify:

- `https://www.googleapis.com/auth/business.manage`

**Copy-paste scope justification:**

> Pratisad is a B2B portal for local businesses. The business owner connects their own Google account and selects one Google Business Profile location. We use business.manage only to list accounts/locations they manage, read reviews for the selected location, and post review replies when the owner enables auto-reply or explicitly approves a draft. We do not use this scope for advertising, unrelated profile edits, or access to other users’ locations. Tokens are stored encrypted on our server; owners can disconnect in the portal or revoke access in Google Account settings.

### C. APIs (same project)

Already required for production sync — confirm enabled:

- Google Business Profile API (`mybusiness.googleapis.com`)
- My Business Account Management API
- My Business Business Information API  
- GBP [access request](https://developers.google.com/my-business/content/prereqs#request-access) approved

### D. OAuth client

- Type: **Web application**
- Redirect URI: `https://api.pratisad.scaleopal.com/integrations/google/callback`
- Same client ID/secret as VPS `.env`

### E. Publish & verify

1. Complete all required fields on consent screen (privacy policy link must work — no login wall)
2. Click **Publish app** / submit for **verification**
3. Answer Google’s questionnaire using the section **Verification questionnaire** below
4. Upload a **demo video** (see script below)
5. Respond promptly to Trust & Safety email threads

Timeline (Google estimates, not guaranteed): brand ~2–3 business days; sensitive scopes ~10 business days; restricted + security assessment ~6+ weeks.

---

## Demo video script (~3–5 minutes)

Record screen + optional voiceover. Show a **real** test business; blur PII if needed.

1. **Homepage** — `https://pratisad.scaleopal.com` (show product name)
2. **Sign in** — business portal user (Clerk)
3. **Google reviews** — note feature visible because admin allowed it
4. **Connect Google** — OAuth consent showing **business.manage**; complete sign-in
5. **Load locations** — pick one location → **Save location**
6. **Sync now** — reviews list loads
7. **Enable auto-reply** (optional) — explain 4–5★ auto-post, 1–3★ approval queue
8. Show **Approve & post** or a posted reply on Google Business Profile (web)
9. **Disconnect Google** in portal — mention revoke at Google Account permissions

Upload to YouTube (**Unlisted**) or Drive link; paste URL in verification form.

---

## Verification questionnaire (short answers)

Use/adapt these in Google’s form:

**What does your app do?**  
Pratisad helps local businesses collect customer feedback and manage Google reviews. Business users connect their Google account to sync reviews and post replies they approve or enable via auto-reply rules.

**Why do you need business.manage?**  
To read reviews and post replies only for the Google Business location the user selects in our portal. No other GBP management features are exposed.

**Is data accessed from a server?**  
Yes. OAuth refresh tokens are stored encrypted on our API server (`api.pratisad.scaleopal.com`). Review text and reply drafts are stored in our database for the business account.

**Who can access Google data?**  
Only the authenticated business portal users for that business, and platform admins for support/abuse (admin should be disclosed). Not shared with other businesses.

**How can users disconnect?**  
Portal → Google reviews → Disconnect; and Google Account → Third-party access → remove Pratisad.

**How do you delete user data?**  
On disconnect we revoke tokens where possible and mark the connection disconnected. Businesses may request deletion via support email; we delete or anonymize per Privacy Policy.

**Privacy policy**  
`https://pratisad.scaleopal.com/privacy`

---

## After approval

1. OAuth consent screen status: **In production**
2. Remove reliance on test users for new customers
3. Keep `WEB_APP_ORIGIN` and redirect URIs aligned
4. Plan for **annual** reverification / CASA if on restricted scopes
5. Set `GOOGLE_REVIEWS_MANUAL_SYNC_COOLDOWN_MS=900000` on VPS for production

---

## What we cannot do in code

- Submit the verification form for you (requires your Google Cloud project owner)
- Verify domain ownership (Search Console / Cloud domain verification)
- Record the demo video (you or your team)
- Pay or schedule CASA assessors (you choose an [empanelled assessor](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) if required)

Deploy privacy/terms pages, then complete sections A–E above.
