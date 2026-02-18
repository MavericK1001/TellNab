const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@tellnab.local";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "M@v99N@b!123";
  const adminName = process.env.ADMIN_SEED_NAME || "TellNab Admin";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Seed complete. Admin email: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
