const {
  createTicketSchema,
  updateTicketSchema,
  ticketListQuerySchema,
  addMessageSchema,
} = require("../validation/ticketSchemas");
const { ticketResource, paginatedResource } = require("../dto/ticketResource");

class TicketController {
  constructor({ ticketService }) {
    this.ticketService = ticketService;
  }

  create = async (req, res) => {
    try {
      const payload = createTicketSchema.parse(req.body || {});
      const ticket = await this.ticketService.createTicket(req.user, payload);
      return res.status(201).json({ data: ticketResource(ticket) });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  list = async (req, res) => {
    try {
      const query = ticketListQuerySchema.parse(req.query || {});
      const { rows, total } = await this.ticketService.listTickets(req.user, query);
      const data = rows.map(ticketResource);
      return res.json(paginatedResource({ data, total, page: query.page, pageSize: query.pageSize }));
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  detail = async (req, res) => {
    try {
      const { rows } = await this.ticketService.listTickets(req.user, {
        page: 1,
        pageSize: 1,
        q: req.params.id,
      });
      const ticket = rows.find((row) => row.id === req.params.id || row.ticketNumber === req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      return res.json({ data: ticketResource(ticket) });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  update = async (req, res) => {
    try {
      const payload = updateTicketSchema.parse(req.body || {});
      const ticket = await this.ticketService.updateTicket(req.user, req.params.id, payload);
      return res.json({ data: ticketResource(ticket) });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  addMessage = async (req, res) => {
    try {
      const payload = addMessageSchema.parse(req.body || {});
      const message = await this.ticketService.addMessage(req.user, req.params.id, payload);
      return res.status(201).json({ data: message });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  handleError(error, res) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation failed", issues: error.issues });
    }
    if (error?.message === "forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (error?.message === "not_found") {
      return res.status(404).json({ message: "Resource not found" });
    }
    if (error?.message === "department_scope_required") {
      return res.status(400).json({ message: "Department filter is required for your role" });
    }
    return res.status(500).json({ message: "Unexpected server error" });
  }
}

module.exports = { TicketController };
