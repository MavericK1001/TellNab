class RbacService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getUserPermissions(userId) {
    const rows = await this.prisma.userRole.findMany({
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

    const permissionSet = new Set();
    const roles = [];

    for (const row of rows) {
      roles.push(row.role.key);
      for (const map of row.role.permissions) {
        permissionSet.add(map.permission.key);
      }
    }

    return {
      roles,
      permissions: Array.from(permissionSet),
      has(permissionKey) {
        return permissionSet.has(permissionKey);
      },
    };
  }
}

module.exports = { RbacService };
