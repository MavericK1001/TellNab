function registerTicketRoutes({ router, supportAuthGuard, permissionPolicy, ticketController }) {
  const { requirePermission, requireAnyPermission, PERMISSION } = permissionPolicy;

  router.get(
    "/api/tickets",
    supportAuthGuard,
    requireAnyPermission([
      PERMISSION.TICKET_VIEW_OWN,
      PERMISSION.TICKET_VIEW_ASSIGNED,
      PERMISSION.TICKET_VIEW_DEPARTMENT,
      PERMISSION.TICKET_VIEW_ALL,
    ]),
    ticketController.list,
  );

  router.post(
    "/api/tickets",
    supportAuthGuard,
    requirePermission(PERMISSION.TICKET_CREATE),
    ticketController.create,
  );

  router.patch(
    "/api/tickets/:id",
    supportAuthGuard,
    requireAnyPermission([
      PERMISSION.TICKET_STATUS_UPDATE,
      PERMISSION.TICKET_REASSIGN,
      PERMISSION.TICKET_ASSIGN,
      PERMISSION.PRIORITY_UPDATE,
    ]),
    ticketController.update,
  );

  router.post(
    "/api/tickets/:id/messages",
    supportAuthGuard,
    requireAnyPermission([
      PERMISSION.TICKET_REPLY_OWN,
      PERMISSION.TICKET_REPLY_ASSIGNED,
      PERMISSION.TICKET_VIEW_DEPARTMENT,
      PERMISSION.TICKET_VIEW_ALL,
    ]),
    ticketController.addMessage,
  );

  router.post(
    "/api/tickets/:id/internal-notes",
    supportAuthGuard,
    requirePermission(PERMISSION.INTERNAL_NOTE_CREATE),
    ticketController.addInternalNote,
  );

  // Required API surface scaffolds
  router.get(
    "/api/departments",
    supportAuthGuard,
    requireAnyPermission([PERMISSION.TICKET_VIEW_ALL, PERMISSION.DEPARTMENT_MANAGE]),
    async (_req, res) => {
      return res.status(501).json({ message: "departments endpoint scaffolded" });
    },
  );

  router.get("/api/users", supportAuthGuard, requirePermission(PERMISSION.USER_MANAGE), async (_req, res) => {
    return res.status(501).json({ message: "users endpoint scaffolded" });
  });

  router.get("/api/roles", supportAuthGuard, requirePermission(PERMISSION.RBAC_MANAGE), async (_req, res) => {
    const roleKeys = Object.values(permissionPolicy.ROLE || {});
    const roles = roleKeys.map((key) => ({
      key,
      name: String(key || "")
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    }));

    return res.json({ roles, data: roles });
  });

  router.get("/api/reports", supportAuthGuard, requirePermission(PERMISSION.REPORT_READ), async (_req, res) => {
    return res.status(501).json({ message: "reports endpoint scaffolded" });
  });
}

module.exports = {
  registerTicketRoutes,
};
