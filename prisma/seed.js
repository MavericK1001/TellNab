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

  const supportRoles = [
    { key: "CUSTOMER", name: "Customer", description: "Create and manage own tickets" },
    { key: "SUPPORT_AGENT", name: "Support Agent", description: "Handle assigned tickets" },
    { key: "SENIOR_AGENT", name: "Senior Agent", description: "Handle escalations and reassignments" },
    { key: "MANAGER", name: "Manager", description: "Team lead and SLA monitoring" },
    { key: "ADMIN", name: "Admin", description: "Full access" },
  ];

  const supportPermissions = [
    "ticket.create",
    "ticket.read.own",
    "ticket.reply.own",
    "ticket.close.own",
    "ticket.feedback.create",
    "ticket.read.assigned",
    "ticket.reply.assigned",
    "ticket.status.update.assigned",
    "ticket.internal_note.create",
    "ticket.attachment.upload",
    "ticket.escalate",
    "ticket.read.department",
    "ticket.reassign.department",
    "ticket.priority.update.department",
    "ticket.read.all",
    "ticket.assign",
    "sla.monitor",
    "report.read",
    "user.manage",
    "rbac.manage",
    "department.manage",
    "automation.manage",
    "system.settings.manage",
  ];

  const rolePermissionMap = {
    CUSTOMER: [
      "ticket.create",
      "ticket.read.own",
      "ticket.reply.own",
      "ticket.close.own",
      "ticket.feedback.create",
      "ticket.attachment.upload",
    ],
    SUPPORT_AGENT: [
      "ticket.read.assigned",
      "ticket.reply.assigned",
      "ticket.status.update.assigned",
      "ticket.internal_note.create",
      "ticket.attachment.upload",
      "ticket.escalate",
    ],
    SENIOR_AGENT: [
      "ticket.read.department",
      "ticket.reassign.department",
      "ticket.priority.update.department",
      "ticket.reply.assigned",
      "ticket.status.update.assigned",
      "ticket.internal_note.create",
      "ticket.escalate",
    ],
    MANAGER: [
      "ticket.read.all",
      "ticket.assign",
      "ticket.reassign.department",
      "ticket.priority.update.department",
      "sla.monitor",
      "report.read",
      "ticket.internal_note.create",
    ],
    ADMIN: supportPermissions,
  };

  const supportDepartments = [
    { key: "GENERAL", name: "General Support" },
    { key: "BILLING", name: "Billing" },
    { key: "TECH", name: "Technical Support" },
  ];

  const defaultSla = [
    { priority: "LOW", firstResponseMinutes: 240, resolutionMinutes: 2880 },
    { priority: "MEDIUM", firstResponseMinutes: 120, resolutionMinutes: 1440 },
    { priority: "HIGH", firstResponseMinutes: 60, resolutionMinutes: 720 },
    { priority: "URGENT", firstResponseMinutes: 15, resolutionMinutes: 240 },
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

  await Promise.all(
    supportRoles.map((role) =>
      prisma.role.upsert({
        where: { key: role.key },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
          deletedAt: null,
        },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      }),
    ),
  );

  await Promise.all(
    supportPermissions.map((permissionKey) =>
      prisma.permission.upsert({
        where: { key: permissionKey },
        update: {
          name: permissionKey,
          deletedAt: null,
        },
        create: {
          key: permissionKey,
          name: permissionKey,
        },
      }),
    ),
  );

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({ where: { key: { in: supportRoles.map((r) => r.key) } } }),
    prisma.permission.findMany({ where: { key: { in: supportPermissions } } }),
  ]);

  const roleByKey = new Map(roles.map((role) => [role.key, role]));
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

  for (const [roleKey, allowed] of Object.entries(rolePermissionMap)) {
    const role = roleByKey.get(roleKey);
    if (!role) continue;

    for (const permissionKey of allowed) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminRbacRole = roleByKey.get("ADMIN");
  if (adminUser && adminRbacRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRbacRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRbacRole.id,
      },
    });
  }

  for (const department of supportDepartments) {
    const dbDepartment = await prisma.department.upsert({
      where: { key: department.key },
      update: {
        name: department.name,
        isActive: true,
        deletedAt: null,
      },
      create: {
        key: department.key,
        name: department.name,
        isActive: true,
      },
    });

    for (const sla of defaultSla) {
      await prisma.slaPolicy.upsert({
        where: {
          departmentId_priority: {
            departmentId: dbDepartment.id,
            priority: sla.priority,
          },
        },
        update: {
          firstResponseMinutes: sla.firstResponseMinutes,
          resolutionMinutes: sla.resolutionMinutes,
          isActive: true,
        },
        create: {
          departmentId: dbDepartment.id,
          priority: sla.priority,
          firstResponseMinutes: sla.firstResponseMinutes,
          resolutionMinutes: sla.resolutionMinutes,
          isActive: true,
        },
      });
    }
  }

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
