/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const roles = [
  "CUSTOMER",
  "SUPPORT_AGENT",
  "SENIOR_AGENT",
  "MANAGER",
  "ADMIN",
];

const permissions = [
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

async function main() {
  for (const roleKey of roles) {
    await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: roleKey, deletedAt: null },
      create: { key: roleKey, name: roleKey },
    });
  }

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { name: key, deletedAt: null },
      create: { key, name: key },
    });
  }

  console.log("Support 2.0 roles and permissions seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
