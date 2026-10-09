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
| `CORS_ORIGIN` | Allowed CORS origins (single URL or comma-separated list) | `http://localhost:3000` |
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
   - A reverse proxy (e.g. Nginx, Caddy, or Traefik) on the VPS terminates SSL for `api.pratisad.in` and forwards traffic to the `api` container port `4000`.
2. **Environment**: Production secrets are injected via secure VPS environment files or Docker secrets.
