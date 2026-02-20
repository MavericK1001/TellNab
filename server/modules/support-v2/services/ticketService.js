const { PERMISSIONS, TICKET_STATUS } = require("../permissions");

class TicketService {
  constructor({ prisma, ticketRepository, rbacService }) {
    this.prisma = prisma;
    this.ticketRepository = ticketRepository;
    this.rbacService = rbacService;
  }

  async getSlaDueAt(departmentId, priority) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { departmentId, priority, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const now = Date.now();
    const minutes = policy?.resolutionMinutes || 24 * 60;
    return new Date(now + minutes * 60 * 1000);
  }

  async createTicket(actor, payload) {
    const acl = await this.rbacService.getUserPermissions(actor.id);
    if (!acl.has(PERMISSIONS.TICKET_CREATE)) {
      throw new Error("forbidden");
    }

    const slaDueAt = await this.getSlaDueAt(payload.departmentId, payload.priority);

    const ticket = await this.ticketRepository.createTicket({
      ...payload,
      customerId: actor.id,
      status: TICKET_STATUS.NEW,
      slaDueAt,
    });

    await this.ticketRepository.logActivity({
      ticketId: ticket.id,
      action: "TICKET_CREATED",
      performedBy: actor.id,
      metadata: JSON.stringify({ departmentId: payload.departmentId, priority: payload.priority }),
    });

    return this.ticketRepository.findById(ticket.id);
  }

  async listTickets(actor, query) {
    const acl = await this.rbacService.getUserPermissions(actor.id);

    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.assignedAgentId ? { assignedAgentId: query.assignedAgentId } : {}),
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

    if (acl.has(PERMISSIONS.TICKET_READ_ALL)) {
      // no additional scope
    } else if (acl.has(PERMISSIONS.TICKET_READ_DEPARTMENT)) {
      const profile = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { id: true } });
      if (!profile) throw new Error("forbidden");
      // Department-scoping can be resolved using staff profile mapping in a dedicated table.
      // For now, require explicit department filter for department-scoped roles.
      if (!query.departmentId) throw new Error("department_scope_required");
    } else if (acl.has(PERMISSIONS.TICKET_READ_ASSIGNED)) {
      where.assignedAgentId = actor.id;
    } else if (acl.has(PERMISSIONS.TICKET_READ_OWN)) {
      where.customerId = actor.id;
    } else {
      throw new Error("forbidden");
    }

    return this.ticketRepository.list(where, query.page, query.pageSize);
  }

  async updateTicket(actor, ticketId, payload) {
    const acl = await this.rbacService.getUserPermissions(actor.id);
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new Error("not_found");

    const canAssign = acl.has(PERMISSIONS.TICKET_ASSIGN) || acl.has(PERMISSIONS.TICKET_REASSIGN_DEPARTMENT);
    const canUpdatePriority =
      acl.has(PERMISSIONS.TICKET_PRIORITY_UPDATE_DEPARTMENT) || acl.has(PERMISSIONS.TICKET_ASSIGN);
    const canUpdateStatus =
      acl.has(PERMISSIONS.TICKET_STATUS_UPDATE_ASSIGNED) ||
      acl.has(PERMISSIONS.TICKET_REASSIGN_DEPARTMENT) ||
      acl.has(PERMISSIONS.TICKET_ASSIGN);

    if (payload.assignedAgentId !== undefined && !canAssign) throw new Error("forbidden");
    if (payload.priority !== undefined && !canUpdatePriority) throw new Error("forbidden");
    if (payload.status !== undefined && !canUpdateStatus) throw new Error("forbidden");

    if (acl.has(PERMISSIONS.TICKET_STATUS_UPDATE_ASSIGNED) && !acl.has(PERMISSIONS.TICKET_ASSIGN)) {
      if (ticket.assignedAgentId && ticket.assignedAgentId !== actor.id) {
        throw new Error("forbidden");
      }
    }

    const updated = await this.ticketRepository.update(ticketId, payload);
    await this.ticketRepository.logActivity({
      ticketId,
      action: "TICKET_UPDATED",
      performedBy: actor.id,
      metadata: JSON.stringify(payload),
    });

    return updated;
  }

  async addMessage(actor, ticketId, payload) {
    const acl = await this.rbacService.getUserPermissions(actor.id);
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new Error("not_found");

    const isOwner = ticket.customerId === actor.id;
    const isAssignee = ticket.assignedAgentId === actor.id;

    if (isOwner && !acl.has(PERMISSIONS.TICKET_REPLY_OWN)) throw new Error("forbidden");
    if (!isOwner && !isAssignee && !acl.has(PERMISSIONS.TICKET_READ_ALL) && !acl.has(PERMISSIONS.TICKET_READ_DEPARTMENT)) {
      throw new Error("forbidden");
    }

    const message = await this.ticketRepository.createMessage({
      ticketId,
      senderId: actor.id,
      senderRole: actor.role || "USER",
      body: payload.body,
    });

    await this.ticketRepository.logActivity({
      ticketId,
      action: "MESSAGE_ADDED",
      performedBy: actor.id,
      metadata: JSON.stringify({ messageId: message.id }),
    });

    return message;
  }
}

module.exports = { TicketService };
