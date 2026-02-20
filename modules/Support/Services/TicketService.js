class TicketService {
  constructor({ prisma, ticketRepository }) {
    this.prisma = prisma;
    this.ticketRepository = ticketRepository;
  }

  async getSlaDueAt(departmentId, priority) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { departmentId, priority, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const fallbackMinutes = 24 * 60;
    const minutes = policy?.resolutionMinutes || fallbackMinutes;
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  async createTicket({ actorId, body }) {
    const slaDueAt = await this.getSlaDueAt(body.departmentId, body.priority);

    const ticket = await this.ticketRepository.create({
      subject: body.subject,
      description: body.description,
      status: "NEW",
      priority: body.priority,
      departmentId: body.departmentId,
      customerId: actorId,
      slaDueAt,
    });

    await this.ticketRepository.logActivity({
      ticketId: ticket.id,
      action: "TICKET_CREATED",
      performedBy: actorId,
      metadata: JSON.stringify({ priority: body.priority, departmentId: body.departmentId }),
    });

    return this.ticketRepository.findById(ticket.id);
  }

  async listTickets({ acl, actorId, query }) {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.assigned_agent_id ? { assignedAgentId: query.assigned_agent_id } : {}),
      ...(query.q
        ? {
            OR: [
              { ticketNumber: { contains: query.q } },
              { subject: { contains: query.q } },
              { description: { contains: query.q } },
            ],
          }
        : {}),
    };

    if (acl.hasPermission("ticket.read.all")) {
      // no extra scoping
    } else if (acl.hasPermission("ticket.read.department")) {
      if (!query.department_id) {
        const error = new Error("department_scope_required");
        throw error;
      }
    } else if (acl.hasPermission("ticket.read.assigned")) {
      where.assignedAgentId = actorId;
    } else {
      where.customerId = actorId;
    }

    return this.ticketRepository.list(where, {
      page: query.page,
      pageSize: query.page_size,
    });
  }

  async updateTicket({ actorId, id, body }) {
    const updated = await this.ticketRepository.update(id, body);
    await this.ticketRepository.logActivity({
      ticketId: id,
      action: "TICKET_UPDATED",
      performedBy: actorId,
      metadata: JSON.stringify(body),
    });
    return updated;
  }

  async addMessage({ actorId, actorRole, id, body }) {
    const message = await this.ticketRepository.createMessage({
      ticketId: id,
      senderId: actorId,
      senderRole: actorRole,
      body: body.body,
    });

    await this.ticketRepository.logActivity({
      ticketId: id,
      action: "MESSAGE_ADDED",
      performedBy: actorId,
      metadata: JSON.stringify({ messageId: message.id }),
    });

    return message;
  }

  async addInternalNote({ actorId, id, note }) {
    const created = await this.ticketRepository.createInternalNote({
      ticketId: id,
      userId: actorId,
      note,
    });

    await this.ticketRepository.logActivity({
      ticketId: id,
      action: "INTERNAL_NOTE_ADDED",
      performedBy: actorId,
      metadata: JSON.stringify({ internalNoteId: created.id }),
    });

    return created;
  }
}

module.exports = {
  TicketService,
};
