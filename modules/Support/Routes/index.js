const { registerTicketRoutes } = require("./ticket.routes");

function registerSupportRoutes({ router, supportAuthGuard, permissionPolicy, ticketController }) {
  registerTicketRoutes({
    router,
    supportAuthGuard,
    permissionPolicy,
    ticketController,
  });
}

module.exports = {
  registerSupportRoutes,
};
