# ==========================================
# Pratisad API - Production Multi-Stage Dockerfile
# ==========================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install OpenSSL required for Prisma engine
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy application source code
COPY . .

# Generate Prisma Client for linux target
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy generated Prisma artifacts and schema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled application code
COPY --from=builder /app/dist ./dist

# Create and switch to non-root user
USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
