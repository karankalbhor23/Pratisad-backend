-- CreateEnum
CREATE TYPE "BusinessMemberStatus" AS ENUM ('invited', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('private_submit', 'draft_generated');

-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "status" "BusinessMemberStatus" NOT NULL DEFAULT 'invited',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "keywords" TEXT[],
    "comment" TEXT,
    "isPrivate" BOOLEAN NOT NULL,
    "readAt" TIMESTAMP(3),
    "source" "FeedbackSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_members_businessId_key" ON "business_members"("businessId");

-- CreateIndex
CREATE INDEX "business_members_email_idx" ON "business_members"("email");

-- CreateIndex
CREATE INDEX "business_members_clerkUserId_idx" ON "business_members"("clerkUserId");

-- CreateIndex
CREATE INDEX "feedback_submissions_businessId_createdAt_idx" ON "feedback_submissions"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_businessId_createdAt_idx" ON "ai_usage_events"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
