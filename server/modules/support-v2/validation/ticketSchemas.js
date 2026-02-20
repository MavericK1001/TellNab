const { z } = require("zod");
const { TICKET_PRIORITY, TICKET_STATUS } = require("../permissions");

const createTicketSchema = z.object({
  subject: z.string().min(5).max(180),
  description: z.string().min(10).max(5000),
  departmentId: z.string().min(1),
  priority: z.enum(Object.values(TICKET_PRIORITY)).default(TICKET_PRIORITY.MEDIUM),
  tags: z.array(z.string().min(1)).optional().default([]),
});

const updateTicketSchema = z
  .object({
    status: z.enum(Object.values(TICKET_STATUS)).optional(),
    priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
    departmentId: z.string().min(1).optional(),
    assignedAgentId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

const ticketListQuerySchema = z.object({
  q: z.string().max(120).optional().default(""),
  status: z.enum(Object.values(TICKET_STATUS)).optional(),
  priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
  departmentId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const addMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(z.string().min(1)).optional().default([]),
});

const addInternalNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
});

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  ticketListQuerySchema,
  addMessageSchema,
  addInternalNoteSchema,
  feedbackSchema,
};
