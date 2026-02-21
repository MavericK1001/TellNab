class TicketRepository {
  constructor({ prisma }) {
    this.prisma = prisma;
  }

  async getLatestTicketNumber(tx) {
    return tx.ticket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { ticketNumber: true },
    });
  }

  async create(payload) {
    return this.prisma.$transaction(async (tx) => {
      const latest = await this.getLatestTicketNumber(tx);
      const current = Number(String(latest?.ticketNumber || "TN-0000").replace("TN-", "")) || 0;
      const next = `TN-${String(current + 1).padStart(4, "0")}`;

      return tx.ticket.create({
        data: {
          ticketNumber: next,
          subject: payload.subject,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          departmentId: payload.departmentId,
          customerId: payload.customerId,
          assignedAgentId: payload.assignedAgentId || null,
          slaDueAt: payload.slaDueAt,
        },
      });
    });
  }

  async list(where, { page, pageSize }) {
    const skip = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          department: true,
          customer: { select: { id: true, name: true, email: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
          tags: { include: { tag: true } },
          messages: {
            include: {
              sender: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return { rows, total };
  }

  async findById(id) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        department: true,
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async update(id, data) {
    return this.prisma.ticket.update({
      where: { id },
      data,
      include: {
        department: true,
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async createMessage(data) {
    return this.prisma.ticketMessage.create({
      data,
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async createInternalNote(data) {
    return this.prisma.ticketInternalNote.create({ data });
  }

  async logActivity(data) {
    return this.prisma.ticketActivityLog.create({ data });
  }

  async listMessages(ticketId) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

module.exports = {
  TicketRepository,
};
