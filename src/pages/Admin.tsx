import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import {
  adminAdjustWallet,
  adminAssignBadge,
  getAdminAuditLogs,
  getAdminBadges,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../services/api";
import { AdminAuditLog, AdminUser, BadgeDefinition, UserRole } from "../types";
import { useToast } from "../context/ToastContext";

export default function Admin() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBalanceType, setSelectedBalanceType] = useState<
    "PAID" | "EARNED"
  >("PAID");
  const [adjustAmountCents, setAdjustAmountCents] = useState("500");
  const [adjustReason, setAdjustReason] = useState("");
  const [selectedBadgeKey, setSelectedBadgeKey] = useState("");
  const [badgeReason, setBadgeReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAdjustAmount = Number(adjustAmountCents);
  const canSubmitWalletAdjustment =
    Boolean(selectedUserId) &&
    Number.isInteger(parsedAdjustAmount) &&
    parsedAdjustAmount !== 0 &&
    adjustReason.trim().length >= 10;
  const canSubmitBadgeAssignment =
    Boolean(selectedUserId) &&
    Boolean(selectedBadgeKey) &&
    badgeReason.trim().length >= 10;

  function parseApiError(err: unknown, fallback: string) {
    if (typeof err === "object" && err && "response" in err) {
      const response = (
        err as {
          response?: {
            data?: { message?: string; issues?: Array<{ message?: string }> };
          };
        }
      ).response;

      if (response?.data?.issues?.length && response.data.issues[0]?.message) {
        return response.data.issues[0].message as string;
      }

      if (response?.data?.message) {
        return response.data.message;
      }
    }
    return fallback;
  }

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const [usersData, badgesData, logsData] = await Promise.all([
        getAdminUsers(),
        getAdminBadges(),
        getAdminAuditLogs(60),
      ]);
      setUsers(usersData);
      setBadges(badgesData);
      setAuditLogs(logsData);
      if (!selectedUserId && usersData.length > 0) {
        setSelectedUserId(usersData[0].id);
      }
      if (!selectedBadgeKey && badgesData.length > 0) {
        setSelectedBadgeKey(badgesData[0].key);
      }
    } catch (err) {
      setError(
        parseApiError(
          err,
          "Failed to load admin data. Ensure backend is running and you are admin.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onRoleChange(id: string, role: UserRole) {
    try {
      setError(null);
      await updateAdminUserRole(id, role);
      await loadUsers();
      toast.success("User role updated successfully.");
    } catch (err) {
      const message = parseApiError(err, "Failed to update role.");
      setError(message);
      toast.error(message);
    }
  }

  async function onStatusChange(id: string, isActive: boolean) {
    try {
      setError(null);
      await updateAdminUserStatus(id, isActive);
      await loadUsers();
      toast.success(
        `Account ${isActive ? "activated" : "suspended"} successfully.`,
      );
    } catch (err) {
      const message = parseApiError(err, "Failed to update account status.");
      setError(message);
      toast.error(message);
    }
  }

  async function onWalletAdjust() {
    if (!canSubmitWalletAdjustment) {
      const message =
        "Wallet adjustment needs a valid non-zero integer amount and a reason of at least 10 characters.";
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await adminAdjustWallet({
        userId: selectedUserId,
        balanceType: selectedBalanceType,
        amountCents: parsedAdjustAmount,
        reason: adjustReason,
      });
      setAdjustReason("");
      await loadUsers();
      toast.success("Wallet adjustment completed.");
    } catch (err) {
      const message = parseApiError(err, "Failed to apply wallet adjustment.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onAssignBadge() {
    if (!canSubmitBadgeAssignment) {
      const message =
        "Badge assignment needs a reason of at least 10 characters.";
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await adminAssignBadge({
        userId: selectedUserId,
        badgeKey: selectedBadgeKey,
        reason: badgeReason,
      });
      setBadgeReason("");
      await loadUsers();
      toast.success("Badge assigned successfully.");
    } catch (err) {
      const message = parseApiError(err, "Failed to assign badge.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
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

      {!loading ? (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-white">
              Wallet adjustment
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Conservative defaults: max 10,000 cents per adjustment and
              mandatory reason.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <select
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={selectedBalanceType}
                onChange={(event) =>
                  setSelectedBalanceType(
                    event.target.value as "PAID" | "EARNED",
                  )
                }
              >
                <option value="PAID">Paid balance</option>
                <option value="EARNED">Earned balance</option>
              </select>
              <input
                type="number"
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={adjustAmountCents}
                onChange={(event) => setAdjustAmountCents(event.target.value)}
                placeholder="Amount cents (e.g. 500 or -500)"
              />
              <Button
                onClick={() => void onWalletAdjust()}
                disabled={actionLoading || !canSubmitWalletAdjustment}
              >
                Apply adjustment
              </Button>
            </div>
            <textarea
              className="mt-3 min-h-[80px] w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              placeholder="Reason (required, min 10 chars)"
            />
            <p className="mt-2 text-xs text-slate-500">
              Reason length: {adjustReason.trim().length}/10 minimum
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white">Assign badge</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={selectedBadgeKey}
                onChange={(event) => setSelectedBadgeKey(event.target.value)}
              >
                {badges.map((badge) => (
                  <option key={badge.id} value={badge.key}>
                    {badge.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void onAssignBadge()}
                disabled={actionLoading || !canSubmitBadgeAssignment}
              >
                Assign badge
              </Button>
            </div>
            <textarea
              className="mt-3 min-h-[80px] w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
              value={badgeReason}
              onChange={(event) => setBadgeReason(event.target.value)}
              placeholder="Reason (required, min 10 chars)"
            />
            <p className="mt-2 text-xs text-slate-500">
              Reason length: {badgeReason.trim().length}/10 minimum
            </p>
          </Card>

          <div className="space-y-3">
            {users.map((user) => (
              <Card key={user.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-sm text-slate-300">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Role: {user.role} •{" "}
                      {user.isActive ? "Active" : "Suspended"}
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
                      onClick={() =>
                        void onStatusChange(user.id, !user.isActive)
                      }
                    >
                      {user.isActive ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-white">Audit log</h2>
            <p className="mt-1 text-sm text-slate-400">
              Latest admin badge and wallet actions.
            </p>
            <div className="mt-4 space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2"
                >
                  <p className="text-sm text-white">
                    {log.action} • {log.targetUser?.name || "N/A"}
                  </p>
                  <p className="text-xs text-slate-400">{log.reason}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()} by{" "}
                    {log.admin?.name || "Unknown"}
                  </p>
                </div>
              ))}
              {auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400">No admin logs yet.</p>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
