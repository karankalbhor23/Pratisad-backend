"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
        console.warn('DEV_ADMIN_EMAIL is not set; skipping platform admin seed.');
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
//# sourceMappingURL=seed.js.map