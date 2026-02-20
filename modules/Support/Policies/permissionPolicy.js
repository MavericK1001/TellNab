const ROLE = {
  CUSTOMER: "CUSTOMER",
  AGENT: "SUPPORT_AGENT",
  SENIOR_AGENT: "SENIOR_AGENT",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
};

const PERMISSION = {
  TICKET_CREATE: "ticket.create",
  TICKET_VIEW_OWN: "ticket.read.own",
  TICKET_REPLY_OWN: "ticket.reply.own",
  TICKET_CLOSE_OWN: "ticket.close.own",
  FEEDBACK_CREATE: "ticket.feedback.create",

  TICKET_VIEW_ASSIGNED: "ticket.read.assigned",
  TICKET_REPLY_ASSIGNED: "ticket.reply.assigned",
  TICKET_STATUS_UPDATE: "ticket.status.update.assigned",
  INTERNAL_NOTE_CREATE: "ticket.internal_note.create",
  ATTACHMENT_UPLOAD: "ticket.attachment.upload",
  TICKET_ESCALATE: "ticket.escalate",

  TICKET_VIEW_DEPARTMENT: "ticket.read.department",
  TICKET_REASSIGN: "ticket.reassign.department",
  PRIORITY_UPDATE: "ticket.priority.update.department",

  TICKET_VIEW_ALL: "ticket.read.all",
  TICKET_ASSIGN: "ticket.assign",
  SLA_MONITOR: "sla.monitor",
  REPORT_READ: "report.read",

  USER_MANAGE: "user.manage",
  RBAC_MANAGE: "rbac.manage",
  DEPARTMENT_MANAGE: "department.manage",
  AUTOMATION_MANAGE: "automation.manage",
  SETTINGS_MANAGE: "system.settings.manage",
};

function createPermissionPolicy({ prisma }) {
  async function getAcl(userId) {
    const rows = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const roles = new Set();
    const permissions = new Set();

    for (const row of rows) {
      roles.add(row.role.key);
      for (const map of row.role.permissions) {
        permissions.add(map.permission.key);
      }
    }

    return {
      roles,
      permissions,
      hasRole: (role) => roles.has(role),
      hasPermission: (permission) => permissions.has(permission),
    };
  }

  function requirePermission(permission) {
    return async (req, res, next) => {
      const acl = await getAcl(req.user.id);
      req.supportAcl = acl;
      if (!acl.hasPermission(permission)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    };
  }

  function requireAnyPermission(permissions) {
    return async (req, res, next) => {
      const acl = await getAcl(req.user.id);
      req.supportAcl = acl;
      const allowed = permissions.some((permission) => acl.hasPermission(permission));
      if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    };
  }

  return {
    ROLE,
    PERMISSION,
    getAcl,
    requirePermission,
    requireAnyPermission,
  };
}

module.exports = {
  createPermissionPolicy,
};
