import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import {
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../services/api";
import { AdminUser, UserRole } from "../types";

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminUsers();
      setUsers(data);
    } catch {
      setError(
        "Failed to load users. Ensure backend is running and you are admin.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onRoleChange(id: string, role: UserRole) {
    await updateAdminUserRole(id, role);
    await loadUsers();
  }

  async function onStatusChange(id: string, isActive: boolean) {
    await updateAdminUserStatus(id, isActive);
    await loadUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Console</h1>
        <p className="text-sm text-slate-300">
          Manage roles and account status with strict access control.
        </p>
      </div>

      {loading ? (
        <Card>
          <p className="text-slate-300">Loading users…</p>
        </Card>
      ) : null}
      {error ? (
        <Card>
          <p className="text-rose-300">{error}</p>
        </Card>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-300">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Role: {user.role} • {user.isActive ? "Active" : "Suspended"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.role !== "MEMBER" ? (
                    <Button
                      variant="secondary"
                      onClick={() => void onRoleChange(user.id, "MEMBER")}
                    >
                      Make Member
                    </Button>
                  ) : null}
                  {user.role !== "MODERATOR" ? (
                    <Button
                      variant="secondary"
                      onClick={() => void onRoleChange(user.id, "MODERATOR")}
                    >
                      Make Moderator
                    </Button>
                  ) : null}
                  {user.role !== "ADMIN" ? (
                    <Button
                      variant="secondary"
                      onClick={() => void onRoleChange(user.id, "ADMIN")}
                    >
                      Make Admin
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => void onStatusChange(user.id, !user.isActive)}
                  >
                    {user.isActive ? "Suspend" : "Activate"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
