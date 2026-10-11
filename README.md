# Pratisad API (`pratisad-api`)

Backend API service for **Pratisad** — an AI-assisted customer feedback and review platform.

Built with [NestJS](https://nestjs.com/), [TypeScript](https://www.typescriptlang.org/), [Prisma ORM](https://www.prisma.io/), and [PostgreSQL](https://www.postgresql.org/).

---

## Prerequisites

- **Node.js**: v20.x or higher (LTS recommended)
- **npm**: v10.x or higher
- **Docker & Docker Compose**: v2.x or higher (for containerized PostgreSQL and API)

---

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

## Environment Setup

Copy the template `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port on which the NestJS API listens | `4000` |
| `CORS_ORIGIN` | Allowed CORS origins (single URL or comma-separated list) | `http://localhost:3000` (prod: `https://pratisad.scaleopal.com`) |
| `PLATFORM_ADMIN_EMAIL` | Email allowlisted as platform admin (seeded via `npm run db:seed`) | `admin@example.com` |
| `CLERK_SECRET_KEY` | Clerk secret key (same app as pratisad-web) | From Clerk Dashboard |
| `DATABASE_URL` | PostgreSQL connection string | See connection details below |

#### Database Connection Strings

- **Direct Host Development (API on host machine, PostgreSQL in Docker)**:
  ```env
  DATABASE_URL="postgresql://pratisad_user:pratisad_password@127.0.0.1:5432/pratisad_db?schema=public"
  ```
- **Docker Compose Networking (both API and PostgreSQL running in Docker)**:
  ```env
  DATABASE_URL="postgresql://pratisad_user:pratisad_password@postgres:5432/pratisad_db?schema=public"
  ```

> **Security Note**: Never commit `.env` files to source control. Only safe `.env.example` templates are tracked.

---

## PostgreSQL Setup (Local Development)

Start the local PostgreSQL container via Docker Compose:

```bash
docker compose up -d postgres
```

> **Network Isolation**: In local Docker Compose, PostgreSQL is bound exclusively to `127.0.0.1:5432` (the local loopback interface) for Prisma CLI and host tool access. It is **never** exposed publicly (`0.0.0.0`).

To check container health:

```bash
docker compose ps postgres
```

To stop the PostgreSQL container:

```bash
docker compose down
```

---

## Prisma Commands

Generate Prisma Client:

```bash
npx prisma generate
```

Run migrations (in development):

```bash
npx prisma migrate dev --name init_m0_foundation
```

Deploy migrations (in production / CI):

```bash
npx prisma migrate deploy
```

Open Prisma Studio to inspect the database:

```bash
npx prisma studio
```

---

## Development Server

Once PostgreSQL is up and migrations are applied, run the API locally on your host machine:

```bash
# Watch mode (hot reload)
npm run start:dev

# Standard start
npm run start
```

### Health Check Endpoint

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "pratisad-api"
}
```

---

## Testing & Linting

```bash
# Linting
npm run lint

# Unit tests
npm run test

# End-to-End tests
npm run test:e2e
```

---

## Docker Development

To run the full stack (PostgreSQL + NestJS API) in Docker:

```bash
docker compose up -d --build
```

View application logs:

```bash
docker compose logs -f api
```

Stop the stack:

```bash
docker compose down
```

---

## Production Docker Build

Build the production multi-stage Docker image:

```bash
docker build -t pratisad-api:latest .
```

---

## Deployment Target: Hostinger VPS

The API is architected for deployment on a **Hostinger VPS** running Docker:

1. **Architecture**:
   - The VPS runs Docker Compose managing the `api` and `postgres` containers.
   - The PostgreSQL database is accessible **only** within the internal Docker bridge network (`pratisad_net`) and is **never** exposed to the public internet.
   - A reverse proxy (e.g. Nginx, Caddy, or Traefik) on the VPS terminates SSL for `api.pratisad.scaleopal.com` and forwards traffic to `127.0.0.1:4000`.
2. **Environment**: Production secrets are injected via secure VPS environment files or Docker secrets.
3. **Scaleopal VPS** (shared Postgres + NPM, port 4002): `docker compose -f docker-compose.vps.yml up -d --build`
4. **Deploy updates**: `git pull && ./scripts/deploy-vps.sh` — same pattern as LMS
5. See [DEPLOYMENT.md](./DEPLOYMENT.md) for GitHub clone, NPM, Cloudflare, and first-time setup

---

## Business Domain and API (M1)

The **Business** domain represents a shop, restaurant, service provider, or other organization using Pratisad. This API provides endpoints for managing business information and retrieving public business data for customer-facing review pages.

### Database Model: Business

| Field | Type | Constraints |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `name` | String | Required, max 200 characters |
| `slug` | String | Required, unique, 2-50 characters, lowercase alphanumeric with hyphens |
| `description` | String | Optional, max 1000 characters; customer-facing copy on `/r/{slug}` |
| `localContext` | String | Optional, max 2000 characters; **AI review-draft prompt only** (not returned on public by-slug). Recommended format: `Category:`, `Setting:`, optional `Area:`, and `Vocabulary:` lines (admin UI can generate this). |
| `keywordsRatingLow` | String[] | Optional, max 30 items × 60 chars; experience chips for ratings **1–3** (empty → platform defaults) |
| `keywordsRatingHigh` | String[] | Optional, max 30 items × 60 chars; experience chips for ratings **4–5** (empty → platform defaults) |
| `logoUrl` | String | Optional, valid URL, max 500 characters |
| `coverImageUrl` | String | Optional, valid URL, max 500 characters |
| `primaryColor` | String | Optional, hex color format (e.g., `#2563EB`) |
| `googleReviewUrl` | String | Optional, valid URL, max 500 characters |
| `isActive` | Boolean | Default `true` |
| `createdAt` | DateTime | Auto-generated on creation |
| `updatedAt` | DateTime | Auto-updated on modification |

### Applying the Business Migration

After pulling the latest code with the Business model, apply the migration:

```bash
npx prisma migrate deploy
```

For development with migration creation:

```bash
npx prisma migrate dev
```

### Validation Rules

**Slug Format:**
- Must contain only lowercase letters (`a-z`), numbers (`0-9`), and hyphens (`-`)
- Must be between 2 and 50 characters
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens
- Valid examples: `my-restaurant`, `cafe-123`, `pizza-place`
- Invalid examples: `MyRestaurant`, `-cafe`, `test--place`, `a`

**URLs:**
- Must include protocol (`http://` or `https://`)
- Generic URL validation is applied (does not verify that a URL is a genuine Google review link)

**Primary Color:**
- Must be a valid 6-digit hex color code
- Format: `#RRGGBB` (case-insensitive)
- Examples: `#2563EB`, `#FF5733`, `#000000`

### API Endpoints

#### 1. Create Business

```http
POST /businesses
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "The Great Restaurant",
  "slug": "the-great-restaurant",
  "description": "A wonderful place to dine with family and friends",
  "logoUrl": "https://example.com/logo.png",
  "coverImageUrl": "https://example.com/cover.jpg",
  "primaryColor": "#2563EB",
  "googleReviewUrl": "https://g.page/the-great-restaurant/review",
  "isActive": true
}
```

**Required Fields:** `name`, `slug`

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "The Great Restaurant",
  "slug": "the-great-restaurant",
  "description": "A wonderful place to dine with family and friends",
  "logoUrl": "https://example.com/logo.png",
  "coverImageUrl": "https://example.com/cover.jpg",
  "primaryColor": "#2563EB",
  "googleReviewUrl": "https://g.page/the-great-restaurant/review",
  "isActive": true,
  "createdAt": "2026-10-09T10:30:00.000Z",
  "updatedAt": "2026-10-09T10:30:00.000Z"
}
```

**Error Responses:**

- **400 Bad Request**: Invalid request body, validation failure
- **409 Conflict**: Slug already exists

---

#### 2. List Businesses (Paginated)

```http
GET /businesses?page=1&limit=20
```

**Query Parameters:**

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `page` | Integer | `1` | Min: 1 |
| `limit` | Integer | `20` | Min: 1, Max: 100 |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "The Great Restaurant",
      "slug": "the-great-restaurant",
      "description": "A wonderful place to dine",
      "logoUrl": "https://example.com/logo.png",
      "coverImageUrl": "https://example.com/cover.jpg",
      "primaryColor": "#2563EB",
      "googleReviewUrl": "https://g.page/the-great-restaurant/review",
      "isActive": true,
      "createdAt": "2026-10-09T10:30:00.000Z",
      "updatedAt": "2026-10-09T10:30:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 42,
  "totalPages": 3
}
```

**Error Responses:**

- **400 Bad Request**: Invalid pagination parameters (e.g., page < 1, limit > 100)

---

#### 3. Get Business by ID

```http
GET /businesses/:id
```

**Path Parameters:**

- `id`: Business UUID

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "The Great Restaurant",
  "slug": "the-great-restaurant",
  "description": "A wonderful place to dine",
  "logoUrl": "https://example.com/logo.png",
  "coverImageUrl": "https://example.com/cover.jpg",
  "primaryColor": "#2563EB",
  "googleReviewUrl": "https://g.page/the-great-restaurant/review",
  "isActive": true,
  "createdAt": "2026-10-09T10:30:00.000Z",
  "updatedAt": "2026-10-09T10:30:00.000Z"
}
```

**Error Responses:**

- **404 Not Found**: Business does not exist

---

#### 4. Update Business

```http
PATCH /businesses/:id
Content-Type: application/json
```

**Path Parameters:**

- `id`: Business UUID

**Request Body (all fields optional):**

```json
{
  "name": "Updated Restaurant Name",
  "description": "Updated description",
  "primaryColor": "#FF5733"
}
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Restaurant Name",
  "slug": "the-great-restaurant",
  "description": "Updated description",
  "logoUrl": "https://example.com/logo.png",
  "coverImageUrl": "https://example.com/cover.jpg",
  "primaryColor": "#FF5733",
  "googleReviewUrl": "https://g.page/the-great-restaurant/review",
  "isActive": true,
  "createdAt": "2026-10-09T10:30:00.000Z",
  "updatedAt": "2026-10-09T14:25:00.000Z"
}
```

**Error Responses:**

- **400 Bad Request**: Invalid request body or validation failure
- **404 Not Found**: Business does not exist
- **409 Conflict**: Slug already exists (when updating slug)

---

#### 5. Get Public Business by Slug

```http
GET /businesses/by-slug/:slug
```

**Path Parameters:**

- `slug`: Business slug (e.g., `the-great-restaurant`)

**Purpose:** This endpoint is designed for customer-facing review pages at `https://pratisad.scaleopal.com/r/{slug}`. It returns only public-facing information and filters for active businesses only.

**Response (200 OK):**

```json
{
  "name": "The Great Restaurant",
  "slug": "the-great-restaurant",
  "description": "A wonderful place to dine with family and friends",
  "logoUrl": "https://example.com/logo.png",
  "coverImageUrl": "https://example.com/cover.jpg",
  "primaryColor": "#2563EB",
  "googleReviewUrl": "https://g.page/the-great-restaurant/review"
}
```

**Important Notes:**

- Only returns businesses where `isActive = true`
- Does **not** include internal fields: `id`, `isActive`, `createdAt`, `updatedAt`
- Returns only the seven approved public fields listed above

**Error Responses:**

- **404 Not Found**: Business does not exist, is inactive, or slug not found

---

### Authentication and Security Limitations

**⚠️ IMPORTANT:** The Business management endpoints (`POST`, `PATCH`, `GET /businesses`, `GET /businesses/:id`) do **not** currently implement authentication or authorization.

**Security Implications:**

1. These endpoints are **not safe for unrestricted public production access** without authentication.
2. Business data can be created, viewed, and modified by anyone who can reach the API.
3. The public lookup endpoint (`GET /businesses/by-slug/:slug`) is intended for customer-facing use and returns only limited, non-sensitive data for active businesses.

**Planned Resolution:**

A future milestone (M2 or later) will implement:
- Business owner authentication (e.g., JWT-based auth)
- Role-based access control (RBAC)
- Business-level isolation (users can only manage their own businesses)
- API rate limiting and additional security hardening

**Current Deployment Recommendation:**

- Do not expose management endpoints to the public internet without additional security measures (e.g., IP allowlisting, VPN, or reverse proxy authentication).
- The public lookup endpoint can be safely exposed for customer-facing review page functionality.

---

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "statusCode": 400,
  "message": ["Descriptive error message"],
  "error": "Bad Request"
}
```

**Common HTTP Status Codes:**

- `400 Bad Request`: Validation failure, malformed input
- `404 Not Found`: Resource does not exist
- `409 Conflict`: Duplicate slug or other unique constraint violation
- `500 Internal Server Error`: Unexpected server error

---

## Review Drafts

`POST /review-drafts` creates an editable draft from customer-provided feedback. It accepts `businessSlug`, an integer `rating` from 1 to 5, one to ten keyword strings (each must be allowed for that business and rating band: 1–3 vs 4–5), and an optional comment up to 1000 characters. A successful response is `{ "draft": "..." }`. Draft prompts use `localContext`, not `description`.

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (an OpenRouter-supported model ID) in the server environment. Tests mock `fetch`, so they do not need a real API key or provider request.

The endpoint does not store feedback or drafts. It uses an in-memory limit of 10 requests per IP per minute; this only protects a single application instance. Production deployments should apply shared rate limiting at the edge or with a distributed store.

## Platform Admin Authorization

`GET /auth/me` accepts any signed-in Clerk user and returns `platform_admin` or `business_user` (from `platform_admins` or an active `business_members` row).

`POST /feedback` stores private customer feedback for ratings 1–3 only. `POST /review-drafts` still generates AI drafts and records usage plus a feedback row for insights.

Business-management routes (`POST/PATCH/GET /businesses`, portal-user invite, usage) require platform admin. `GET /portal/*` requires an active business member. Seed platform admins with `PLATFORM_ADMIN_EMAIL` and `npm run db:seed`.
