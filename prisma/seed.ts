import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (
    process.env.PLATFORM_ADMIN_EMAIL ?? process.env.DEV_ADMIN_EMAIL
  )
    ?.trim()
    .toLowerCase();
  if (!email) {
    console.warn(
      'PLATFORM_ADMIN_EMAIL is not set; skipping platform admin seed.',
    );
    return;
  }

  await prisma.platformAdmin.upsert({
    where: { email },
    update: { isActive: true },
    create: { email, isActive: true },
  });

  console.log(`Platform admin seeded: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
