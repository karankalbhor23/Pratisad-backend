-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "localContext" TEXT,
ADD COLUMN     "keywordsRatingLow" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "keywordsRatingHigh" TEXT[] DEFAULT ARRAY[]::TEXT[];
