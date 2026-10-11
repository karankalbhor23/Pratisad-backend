-- AlterTable: portal login by username (admin-provisioned)
ALTER TABLE "business_members" ADD COLUMN "username" TEXT;

UPDATE "business_members"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-z0-9._-]', '', 'g'))
  || '_' || SUBSTRING("id", 1, 8)
WHERE "username" IS NULL AND "email" IS NOT NULL;

UPDATE "business_members"
SET "username" = 'user_' || SUBSTRING("id", 1, 12)
WHERE "username" IS NULL;

ALTER TABLE "business_members" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "business_members" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "business_members_username_key" ON "business_members"("username");

ALTER TABLE "business_members" ALTER COLUMN "status" SET DEFAULT 'active';
