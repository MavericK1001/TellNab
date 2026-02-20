const express = require("express");

function createTicketRoutes({ ticketController, authRequired }) {
  const router = express.Router();

  router.get("/tickets", authRequired, ticketController.list);
  router.post("/tickets", authRequired, ticketController.create);
  router.get("/tickets/:id", authRequired, ticketController.detail);
  router.patch("/tickets/:id", authRequired, ticketController.update);
  router.post("/tickets/:id/messages", authRequired, ticketController.addMessage);

  return router;
}

module.exports = { createTicketRoutes };
