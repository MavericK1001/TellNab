const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@tellnab.local";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "M@v99N@b!123";
  const adminName = process.env.ADMIN_SEED_NAME || "TellNab Admin";
  const badgeDefinitions = [
    {
      key: "FIRST_THREAD",
      name: "First Thread",
      description: "Posted your first advice thread.",
      icon: "🧵",
    },
    {
      key: "ACTIVE_ADVISOR",
      name: "Active Advisor",
      description: "Shared 5 or more comments to help others.",
      icon: "💬",
    },
    {
      key: "COMMUNITY_PILLAR",
      name: "Community Pillar",
      description: "Manually awarded by admins for outstanding contribution.",
      icon: "🏛️",
    },
  ];
  const categories = [
    {
      slug: "career",
      name: "Career",
      description: "Job transitions, workplace decisions, and long-term growth.",
      sortOrder: 10,
    },
    {
      slug: "relationships",
      name: "Relationships",
      description: "Family, friendship, dating, and communication dilemmas.",
      sortOrder: 20,
    },
    {
      slug: "money",
      name: "Money",
      description: "Budgeting, debt, investing, and income decisions.",
      sortOrder: 30,
    },
    {
      slug: "personal-growth",
      name: "Personal Growth",
      description: "Habits, confidence, mindset, and life direction.",
      sortOrder: 40,
    },
    {
      slug: "health-lifestyle",
      name: "Health & Lifestyle",
      description: "Physical wellness, routines, and lifestyle changes.",
      sortOrder: 50,
    },
    {
      slug: "general",
      name: "General",
      description: "Any other personal decision that needs clear advice.",
      sortOrder: 100,
    },
  ];

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

  await Promise.all(
    badgeDefinitions.map((badge) =>
      prisma.badgeDefinition.upsert({
        where: { key: badge.key },
        update: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          isActive: true,
        },
        create: {
          key: badge.key,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          isActive: true,
        },
      }),
    ),
  );

  await Promise.all(
    categories.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      }),
    ),
  );

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
