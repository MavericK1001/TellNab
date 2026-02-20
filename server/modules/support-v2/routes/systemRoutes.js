const express = require("express");

function notImplemented(res, feature) {
  return res.status(501).json({ message: `${feature} endpoint scaffolded. Implement service logic.` });
}

function createSystemRoutes({ authRequired }) {
  const router = express.Router();

  // Auth (support portal context)
  router.post("/auth/login", (_req, res) => notImplemented(res, "Auth login"));
  router.post("/auth/logout", authRequired, (_req, res) => res.json({ ok: true }));

  // Messages
  router.get("/tickets/:id/messages", authRequired, (_req, res) => notImplemented(res, "Ticket messages list"));

  // Internal notes
  router.get("/tickets/:id/internal-notes", authRequired, (_req, res) =>
    notImplemented(res, "Internal notes list"),
  );
  router.post("/tickets/:id/internal-notes", authRequired, (_req, res) =>
    notImplemented(res, "Internal notes create"),
  );

  // Users
  router.get("/users", authRequired, (_req, res) => notImplemented(res, "Users list"));
  router.patch("/users/:id", authRequired, (_req, res) => notImplemented(res, "User update"));

  // Departments
  router.post("/departments", authRequired, (_req, res) => notImplemented(res, "Department create"));
  router.patch("/departments/:id", authRequired, (_req, res) => notImplemented(res, "Department update"));

  // Roles & permissions
  router.post("/roles", authRequired, (_req, res) => notImplemented(res, "Role create"));
  router.patch("/roles/:id", authRequired, (_req, res) => notImplemented(res, "Role update"));
  router.post("/roles/:id/permissions", authRequired, (_req, res) =>
    notImplemented(res, "Role permissions attach"),
  );

  // Reports
  router.get("/reports/team-performance", authRequired, (_req, res) =>
    notImplemented(res, "Team performance report"),
  );
  router.get("/reports/sla-compliance", authRequired, (_req, res) =>
    notImplemented(res, "SLA compliance report"),
  );

  return router;
}

module.exports = { createSystemRoutes };
