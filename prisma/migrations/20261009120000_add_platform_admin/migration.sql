CREATE TABLE "platform_admins" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");
