const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { registerSupportRoutes } = require("./Routes");
const { createPermissionPolicy } = require("./Policies/permissionPolicy");
const { createSupportAuthGuard } = require("./Policies/supportAuthGuard");
const { getSupportConfig } = require("./config");
const { TicketRepository } = require("./Repositories/TicketRepository");
const { TicketService } = require("./Services/TicketService");
const { TicketController } = require("./Controllers/TicketController");

function createSupportModule({ authRequired }) {
  const prisma = new PrismaClient();
  const permissionPolicy = createPermissionPolicy({ prisma });
  const supportAuthGuard = createSupportAuthGuard({ authRequired });
  const supportConfig = getSupportConfig();
  const ticketRepository = new TicketRepository({ prisma });
  const ticketService = new TicketService({ prisma, ticketRepository });
  const ticketController = new TicketController({ ticketService });

  const router = express.Router();

  // Support-panel middleware group
  router.use((req, _res, next) => {
    req.context = req.context || {};
    req.context.module = "SUPPORT_2_0";
    req.context.support = supportConfig;
    return next();
  });

  registerSupportRoutes({
    router,
    supportAuthGuard,
    permissionPolicy,
    ticketController,
  });

  return router;
}

module.exports = {
  createSupportModule,
};
