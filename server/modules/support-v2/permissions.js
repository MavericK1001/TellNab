const CORE_ROLES = {
  CUSTOMER: "CUSTOMER",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  SENIOR_AGENT: "SENIOR_AGENT",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
};

const PERMISSIONS = {
  TICKET_CREATE: "ticket.create",
  TICKET_READ_OWN: "ticket.read.own",
  TICKET_REPLY_OWN: "ticket.reply.own",
  TICKET_CLOSE_OWN: "ticket.close.own",
  FEEDBACK_CREATE: "ticket.feedback.create",

  TICKET_READ_ASSIGNED: "ticket.read.assigned",
  TICKET_REPLY_ASSIGNED: "ticket.reply.assigned",
  TICKET_STATUS_UPDATE_ASSIGNED: "ticket.status.update.assigned",
  TICKET_INTERNAL_NOTE_CREATE: "ticket.internal_note.create",
  TICKET_ATTACHMENT_UPLOAD: "ticket.attachment.upload",
  TICKET_ESCALATE: "ticket.escalate",

  TICKET_READ_DEPARTMENT: "ticket.read.department",
  TICKET_REASSIGN_DEPARTMENT: "ticket.reassign.department",
  TICKET_PRIORITY_UPDATE_DEPARTMENT: "ticket.priority.update.department",

  TICKET_READ_ALL: "ticket.read.all",
  TICKET_ASSIGN: "ticket.assign",
  SLA_MONITOR: "sla.monitor",
  REPORT_READ: "report.read",

  USER_MANAGE: "user.manage",
  RBAC_MANAGE: "rbac.manage",
  DEPARTMENT_MANAGE: "department.manage",
  AUTOMATION_MANAGE: "automation.manage",
  SYSTEM_SETTINGS_MANAGE: "system.settings.manage",
};

const TICKET_STATUS = {
  NEW: "NEW",
  OPEN: "OPEN",
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
};

const TICKET_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

module.exports = {
  CORE_ROLES,
  PERMISSIONS,
  TICKET_STATUS,
  TICKET_PRIORITY,
};
