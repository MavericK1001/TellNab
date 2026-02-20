const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { TicketRepository } = require("./repositories/ticketRepository");
const { RbacService } = require("./services/rbacService");
const { TicketService } = require("./services/ticketService");
const { TicketController } = require("./controllers/ticketController");
const { createTicketRoutes } = require("./routes/ticketRoutes");
const { createSystemRoutes } = require("./routes/systemRoutes");

function createSupportV2Router({ authRequired }) {
  const prisma = new PrismaClient();
  const ticketRepository = new TicketRepository(prisma);
  const rbacService = new RbacService(prisma);
  const ticketService = new TicketService({ prisma, ticketRepository, rbacService });
  const ticketController = new TicketController({ ticketService });

  const router = express.Router();

  // Core ticket endpoints
  router.use(createTicketRoutes({ ticketController, authRequired }));
  router.use(createSystemRoutes({ authRequired }));

  // Placeholder endpoint groups required by specification
  router.get("/departments", authRequired, async (_req, res) => {
    const departments = await prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return res.json({ data: departments });
  });

  router.get("/roles", authRequired, async (_req, res) => {
    const roles = await prisma.role.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
    return res.json({ data: roles });
  });

  router.get("/permissions", authRequired, async (_req, res) => {
    const permissions = await prisma.permission.findMany({ where: { deletedAt: null }, orderBy: { key: "asc" } });
    return res.json({ data: permissions });
  });

  router.get("/reports/overview", authRequired, async (_req, res) => {
    const [total, open, resolved, overdue] = await Promise.all([
      prisma.ticket.count({ where: { deletedAt: null } }),
      prisma.ticket.count({ where: { deletedAt: null, status: { in: ["NEW", "OPEN", "PENDING", "REOPENED"] } } }),
      prisma.ticket.count({ where: { deletedAt: null, status: { in: ["RESOLVED", "CLOSED"] } } }),
      prisma.ticket.count({
        where: {
          deletedAt: null,
          status: { in: ["NEW", "OPEN", "PENDING", "REOPENED"] },
          slaDueAt: { lt: new Date() },
        },
      }),
    ]);

    return res.json({
      data: {
        total_tickets: total,
        open_tickets: open,
        resolved_tickets: resolved,
        overdue_tickets: overdue,
      },
    });
  });

  return router;
}

module.exports = {
  createSupportV2Router,
};
