-- CreateEnum
CREATE TYPE "GoogleReviewProcessingState" AS ENUM ('synced', 'draft_ready', 'pending_approval', 'queued_post', 'posted', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "GoogleReviewReplyMode" AS ENUM ('auto', 'manual', 'approved');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "googleAutoReplyAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleLocationName" TEXT,
ADD COLUMN     "googleLocationTitle" TEXT,
ADD COLUMN     "googleAutoReplySettings" JSONB;

-- CreateTable
CREATE TABLE "google_business_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "googleAccountEmail" TEXT,
    "googleAccountName" TEXT,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_business_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_pending_states" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_oauth_pending_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_reviews" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "googleReviewName" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewerDisplayName" TEXT,
    "reviewCreateTime" TIMESTAMP(3),
    "replyComment" TEXT,
    "replyUpdateTime" TIMESTAMP(3),
    "draftReplyText" TEXT,
    "processingState" "GoogleReviewProcessingState" NOT NULL DEFAULT 'synced',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_review_reply_attempts" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "GoogleReviewReplyMode" NOT NULL,
    "draftText" TEXT,
    "postedText" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "google_review_reply_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_business_connections_businessId_key" ON "google_business_connections"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_pending_states_nonce_key" ON "google_oauth_pending_states"("nonce");

-- CreateIndex
CREATE INDEX "google_oauth_pending_states_businessId_idx" ON "google_oauth_pending_states"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "google_reviews_googleReviewName_key" ON "google_reviews"("googleReviewName");

-- CreateIndex
CREATE INDEX "google_reviews_businessId_processingState_idx" ON "google_reviews"("businessId", "processingState");

-- CreateIndex
CREATE INDEX "google_reviews_businessId_syncedAt_idx" ON "google_reviews"("businessId", "syncedAt" DESC);

-- CreateIndex
CREATE INDEX "google_review_reply_attempts_reviewId_attemptedAt_idx" ON "google_review_reply_attempts"("reviewId", "attemptedAt" DESC);

-- AddForeignKey
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_pending_states" ADD CONSTRAINT "google_oauth_pending_states_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_review_reply_attempts" ADD CONSTRAINT "google_review_reply_attempts_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "google_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
