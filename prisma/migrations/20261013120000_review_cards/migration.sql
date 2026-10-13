-- CreateEnum
CREATE TYPE "ReviewCardStatus" AS ENUM ('unassigned', 'assigned', 'revoked');

-- CreateTable
CREATE TABLE "review_card_batches" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_card_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_cards" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "serialInBatch" INTEGER NOT NULL,
    "businessId" TEXT,
    "status" "ReviewCardStatus" NOT NULL DEFAULT 'unassigned',
    "assignedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_cards_token_key" ON "review_cards"("token");

-- CreateIndex
CREATE INDEX "review_cards_batchId_status_idx" ON "review_cards"("batchId", "status");

-- CreateIndex
CREATE INDEX "review_cards_businessId_idx" ON "review_cards"("businessId");

-- AddForeignKey
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "review_card_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
