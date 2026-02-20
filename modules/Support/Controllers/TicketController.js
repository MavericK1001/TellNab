const { z } = require("zod");

const createTicketSchema = z.object({
  subject: z.string().min(5).max(180),
  description: z.string().min(10).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  departmentId: z.string().min(1).optional(),
});

const ticketListQuerySchema = z.object({
  q: z.string().optional().default(""),
  status: z.enum(["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED", "REOPENED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  department_id: z.string().optional(),
  assigned_agent_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const updateTicketSchema = z
  .object({
    status: z.enum(["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED", "REOPENED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    departmentId: z.string().optional(),
    assignedAgentId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

const messageSchema = z.object({ body: z.string().min(1).max(4000) });
const internalNoteSchema = z.object({ note: z.string().min(1).max(2000) });

function ticketResource(ticket) {
  return {
    id: ticket.id,
    ticket_number: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    department_id: ticket.departmentId,
    customer_id: ticket.customerId,
    assigned_agent_id: ticket.assignedAgentId,
    sla_due_at: ticket.slaDueAt,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    department: ticket.department,
    customer: ticket.customer,
    assigned_agent: ticket.assignedAgent,
  };
}

class TicketController {
  constructor({ ticketService }) {
    this.ticketService = ticketService;
  }

  create = async (req, res) => {
    try {
      const body = createTicketSchema.parse(req.body || {});
      const ticket = await this.ticketService.createTicket({
        actorId: req.user.id,
        body,
      });
      return res.status(201).json({ data: ticketResource(ticket) });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  list = async (req, res) => {
    try {
      const query = ticketListQuerySchema.parse(req.query || {});
      const { rows, total } = await this.ticketService.listTickets({
        acl: req.supportAcl,
        actorId: req.user.id,
        query,
      });

      return res.json({
        data: rows.map(ticketResource),
        meta: {
          page: query.page,
          page_size: query.page_size,
          total,
          total_pages: Math.ceil(total / query.page_size),
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  update = async (req, res) => {
    try {
      const body = updateTicketSchema.parse(req.body || {});
      const ticket = await this.ticketService.updateTicket({
        actorId: req.user.id,
        id: req.params.id,
        body,
      });
      return res.json({ data: ticketResource(ticket) });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  addMessage = async (req, res) => {
    try {
      const body = messageSchema.parse(req.body || {});
      const message = await this.ticketService.addMessage({
        actorId: req.user.id,
        actorRole: req.user.role,
        id: req.params.id,
        body,
      });
      return res.status(201).json({ data: message });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  addInternalNote = async (req, res) => {
    try {
      const body = internalNoteSchema.parse(req.body || {});
      const note = await this.ticketService.addInternalNote({
        actorId: req.user.id,
        id: req.params.id,
        note: body.note,
      });
      return res.status(201).json({ data: note });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  handleError(error, res) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", issues: error.issues });
    }
    if (error?.message === "department_scope_required") {
      return res.status(400).json({ message: "department_id is required for your role scope" });
    }
    if (error?.message === "support_department_missing") {
      return res.status(503).json({ message: "Support departments are not seeded yet" });
    }
    return res.status(500).json({ message: "Support module request failed" });
  }
}

module.exports = {
  TicketController,
};
