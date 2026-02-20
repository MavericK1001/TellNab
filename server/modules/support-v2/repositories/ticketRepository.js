class TicketRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async nextTicketNumber(tx) {
    const row = await tx.ticket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { ticketNumber: true },
    });

    const current = Number(String(row?.ticketNumber || "TN-0000").replace(/^TN-/, "")) || 0;
    return `TN-${String(current + 1).padStart(4, "0")}`;
  }

  async createTicket(data) {
    return this.prisma.$transaction(async (tx) => {
      const ticketNumber = await this.nextTicketNumber(tx);
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          subject: data.subject,
          description: data.description,
          status: data.status,
          priority: data.priority,
          departmentId: data.departmentId,
          customerId: data.customerId,
          assignedAgentId: data.assignedAgentId || null,
          slaDueAt: data.slaDueAt,
        },
      });

      if (Array.isArray(data.tags) && data.tags.length) {
        for (const key of data.tags) {
          const tag = await tx.tag.upsert({
            where: { key },
            update: { name: key },
            create: { key, name: key },
          });
          await tx.ticketTag.upsert({
            where: { ticketId_tagId: { ticketId: ticket.id, tagId: tag.id } },
            update: {},
            create: { ticketId: ticket.id, tagId: tag.id },
          });
        }
      }

      return ticket;
    });
  }

  async findById(id) {
    return this.prisma.ticket.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: true,
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async list(where, page, pageSize) {
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
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return { total, rows };
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
    });
  }

  async listMessages(ticketId) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      include: { sender: { select: { id: true, name: true, email: true } }, attachments: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async createInternalNote(data) {
    return this.prisma.ticketInternalNote.create({ data });
  }

  async listInternalNotes(ticketId) {
    return this.prisma.ticketInternalNote.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async logActivity(data) {
    return this.prisma.ticketActivityLog.create({ data });
  }

  async listActivity(ticketId) {
    return this.prisma.ticketActivityLog.findMany({
      where: { ticketId },
      include: { performer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = { TicketRepository };
