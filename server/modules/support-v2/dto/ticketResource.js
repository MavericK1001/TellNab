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
    department: ticket.department
      ? { id: ticket.department.id, key: ticket.department.key, name: ticket.department.name }
      : null,
    customer: ticket.customer
      ? { id: ticket.customer.id, name: ticket.customer.name, email: ticket.customer.email }
      : null,
    assigned_agent: ticket.assignedAgent
      ? { id: ticket.assignedAgent.id, name: ticket.assignedAgent.name, email: ticket.assignedAgent.email }
      : null,
    tags: Array.isArray(ticket.tags) ? ticket.tags.map((t) => ({ id: t.tag.id, key: t.tag.key, name: t.tag.name })) : [],
  };
}

function paginatedResource({ data, page, pageSize, total }) {
  return {
    data,
    meta: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
}

module.exports = {
  ticketResource,
  paginatedResource,
};
