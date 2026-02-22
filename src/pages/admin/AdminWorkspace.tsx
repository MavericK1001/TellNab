import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import Button from "../../components/Button";
import {
  adminAdjustWallet,
  adminAssignBadge,
  approveGroupJoinRequest,
  createAdminCategory,
  generateModerationHintWithAi,
  getAdminAuditLogs,
  getAdminBadges,
  getAdminOverview,
  listAdminSupportTickets,
  getAdminUsers,
  listAdminCategories,
  listAdminGroupModerationActions,
  listAdminGroups,
  listModerationActivity,
  listModerationGroupRequests,
  moderationQueue,
  moderateAdvice,
  rejectGroupJoinRequest,
  updateAdminCategory,
  updateAdminAdvisorProfile,
  updateAdminGroup,
  updateAdminSupportTicket,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdviceFlags,
} from "../../services/api";
import {
  AdminAuditLog,
  AdminGroupItem,
  AdminOverview,
  AdminUser,
  AdviceItem,
  AdviceStatus,
  BadgeDefinition,
  CategoryItem,
  ModerationActivityItem,
  ModerationAiHintResult,
  ModerationGroupRequest,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
} from "../../types";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useSeo } from "../../utils/seo";

type SectionKey =
  | "overview"
  | "moderation"
  | "groupRequests"
  | "activity"
  | "support"
  | "users"
  | "wallet"
  | "badges"
  | "categories"
  | "groups"
  | "audit";

type SectionItem = {
  key: SectionKey;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const ALL_SECTIONS: SectionItem[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "moderation", label: "Moderation Queue", icon: "🛡️" },
  { key: "groupRequests", label: "Group Requests", icon: "👥" },
  { key: "activity", label: "Moderation Activity", icon: "🕒" },
  { key: "support", label: "Support Inbox", icon: "🎫" },
  { key: "users", label: "Users & Roles", icon: "🧩", adminOnly: true },
  { key: "wallet", label: "Wallet Controls", icon: "💳", adminOnly: true },
  { key: "badges", label: "Badge Operations", icon: "🏅", adminOnly: true },
  { key: "categories", label: "Categories", icon: "🏷️", adminOnly: true },
  { key: "groups", label: "Group Governance", icon: "🏛️", adminOnly: true },
  { key: "audit", label: "Audit Logs", icon: "🧾", adminOnly: true },
];

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

function badgeClass(isActive: boolean) {
  return isActive
    ? "rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200"
    : "rounded-full border border-white/15 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300";
}

function priorityBadgeClass(priority: string) {
  if (priority === "URGENT") {
    return "rounded-full border border-rose-300/35 bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200";
  }
  if (priority === "LOW") {
    return "rounded-full border border-slate-300/20 bg-slate-700/30 px-2 py-0.5 text-[11px] text-slate-200";
  }
  return "rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200";
}

function statusBadgeClass(status: string) {
  if (status === "OPEN") {
    return "rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200";
  }
  if (status === "IN_PROGRESS") {
    return "rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200";
  }
  if (status === "RESOLVED") {
    return "rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200";
  }
  return "rounded-full border border-slate-300/20 bg-slate-700/30 px-2 py-0.5 text-[11px] text-slate-200";
}

export default function AdminWorkspace() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [groupRequests, setGroupRequests] = useState<ModerationGroupRequest[]>(
    [],
  );
  const [moderationItems, setModerationItems] = useState<AdviceItem[]>([]);
  const [moderationActivity, setModerationActivity] = useState<
    ModerationActivityItem[]
  >([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportStatusFilter, setSupportStatusFilter] = useState<
    SupportTicketStatus | "ALL"
  >("OPEN");
  const [supportPriorityFilter, setSupportPriorityFilter] = useState<
    SupportTicketPriority | "ALL"
  >("ALL");
  const [supportSearch, setSupportSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupHistory, setGroupHistory] = useState<ModerationActivityItem[]>(
    [],
  );
  const [moderationHints, setModerationHints] = useState<
    Record<string, ModerationAiHintResult>
  >({});
  const [hintLoading, setHintLoading] = useState<Record<string, boolean>>({});

  const [moderationStatus, setModerationStatus] =
    useState<AdviceStatus>("PENDING");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBalanceType, setSelectedBalanceType] = useState<
    "PAID" | "EARNED"
  >("PAID");
  const [adjustAmountCents, setAdjustAmountCents] = useState("500");
  const [adjustReason, setAdjustReason] = useState("");
  const [selectedBadgeKey, setSelectedBadgeKey] = useState("");
  const [badgeReason, setBadgeReason] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState("100");

  const [groupOwnerTransferId, setGroupOwnerTransferId] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  useSeo({
    title: isAdmin
      ? "Admin Workspace | TellNab"
      : "Moderation Workspace | TellNab",
    description:
      "Operational workspace for moderation, governance, users, wallet controls, categories, and audit visibility.",
    path: "/admin",
  });

  const visibleSections = useMemo(
    () => ALL_SECTIONS.filter((item) => (item.adminOnly ? isAdmin : true)),
    [isAdmin],
  );

  const sectionCounts = useMemo<Partial<Record<SectionKey, number>>>(
    () => ({
      moderation: moderationItems.length,
      groupRequests: groupRequests.length,
      activity: moderationActivity.length,
      support: supportTickets.length,
      users: users.length,
      badges: badges.length,
      categories: categories.length,
      groups: groups.length,
      audit: auditLogs.length,
    }),
    [
      auditLogs.length,
      badges.length,
      categories.length,
      groupRequests.length,
      groups.length,
      moderationActivity.length,
      moderationItems.length,
      supportTickets.length,
      users.length,
    ],
  );

  const activeSectionMeta = useMemo(
    () => visibleSections.find((item) => item.key === activeSection) || null,
    [activeSection, visibleSections],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const parsedAdjustAmount = Number(adjustAmountCents);
  const canSubmitWalletAdjustment =
    isAdmin &&
    Boolean(selectedUserId) &&
    Number.isInteger(parsedAdjustAmount) &&
    parsedAdjustAmount !== 0 &&
    adjustReason.trim().length >= 10;

  const canSubmitBadgeAssignment =
    isAdmin &&
    Boolean(selectedUserId) &&
    Boolean(selectedBadgeKey) &&
    badgeReason.trim().length >= 10;

  async function loadModeration() {
    const [queue, requests, activity] = await Promise.all([
      moderationQueue(moderationStatus),
      listModerationGroupRequests(),
      listModerationActivity(120),
    ]);
    setModerationItems(queue);
    setGroupRequests(requests);
    setModerationActivity(activity);
  }

  async function loadSupportInbox() {
    const tickets = await listAdminSupportTickets({
      status: supportStatusFilter === "ALL" ? undefined : supportStatusFilter,
      priority:
        supportPriorityFilter === "ALL" ? undefined : supportPriorityFilter,
      q: supportSearch.trim() || undefined,
      limit: 150,
    });
    setSupportTickets(tickets);
  }

  async function loadAdminOnly() {
    if (!isAdmin) {
      setUsers([]);
      setBadges([]);
      setAuditLogs([]);
      setCategories([]);
      setGroups([]);
      return;
    }

    const [usersData, badgesData, logsData, categoryData, groupsData] =
      await Promise.all([
        getAdminUsers(),
        getAdminBadges(),
        getAdminAuditLogs(120),
        listAdminCategories(),
        listAdminGroups(),
      ]);

    setUsers(usersData);
    setBadges(badgesData);
    setAuditLogs(logsData);
    setCategories(categoryData);
    setGroups(groupsData);

    if (!selectedUserId && usersData.length > 0) {
      setSelectedUserId(usersData[0].id);
    }
    if (!selectedBadgeKey && badgesData.length > 0) {
      setSelectedBadgeKey(badgesData[0].key);
    }
    if (!selectedGroupId && groupsData.length > 0) {
      setSelectedGroupId(groupsData[0].id);
    }
  }

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [overviewData] = await Promise.all([getAdminOverview()]);
      setOverview(overviewData);
      await Promise.all([
        loadModeration(),
        loadSupportInbox(),
        loadAdminOnly(),
      ]);
    } catch (err) {
      const message = parseApiError(
        err,
        "Failed to load admin workspace. Confirm backend is running and your role has access.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (activeSection === "moderation") {
      moderationQueue(moderationStatus)
        .then(setModerationItems)
        .catch(() => setModerationItems([]));
    }
  }, [activeSection, moderationStatus]);

  useEffect(() => {
    if (!isAdmin || !selectedGroupId || activeSection !== "groups") {
      setGroupHistory([]);
      return;
    }

    listAdminGroupModerationActions(selectedGroupId, 120)
      .then(setGroupHistory)
      .catch(() => setGroupHistory([]));
  }, [activeSection, isAdmin, selectedGroupId]);

  useEffect(() => {
    if (activeSection !== "support") {
      return;
    }

    void loadSupportInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSection,
    supportPriorityFilter,
    supportSearch,
    supportStatusFilter,
  ]);

  async function reloadAdminOnlyAndOverview() {
    const [overviewData] = await Promise.all([getAdminOverview()]);
    setOverview(overviewData);
    await loadAdminOnly();
  }

  async function onRoleChange(id: string, role: UserRole) {
    try {
      setError(null);
      await updateAdminUserRole(id, role);
      await loadAdminOnly();
      toast.success("User role updated.");
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
      await loadAdminOnly();
      toast.success(`Account ${isActive ? "activated" : "suspended"}.`);
    } catch (err) {
      const message = parseApiError(err, "Failed to update account status.");
      setError(message);
      toast.error(message);
    }
  }

  async function onVerifyAdvisor(id: string, isVerified: boolean) {
    try {
      setActionLoading(true);
      setError(null);
      await updateAdminAdvisorProfile(id, { isVerified });
      toast.success(isVerified ? "Advisor verified." : "Advisor verification removed.");
    } catch (err) {
      const message = parseApiError(err, "Failed to update advisor verification.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onAssignAdvisorCategory(id: string) {
    const advisorCategory = window.prompt(
      "Assign advisor category (example: Career Mentor)",
      "Career Mentor",
    );
    if (!advisorCategory || advisorCategory.trim().length < 2) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await updateAdminAdvisorProfile(id, {
        advisorCategory: advisorCategory.trim(),
      });
      toast.success("Advisor category assigned.");
    } catch (err) {
      const message = parseApiError(err, "Failed to assign advisor category.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onWalletAdjust() {
    if (!canSubmitWalletAdjustment) {
      toast.error(
        "Wallet adjustment requires valid amount and reason (min 10 chars).",
      );
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
      await reloadAdminOnlyAndOverview();
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
      toast.error("Badge assignment requires reason (min 10 chars).");
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
      await reloadAdminOnlyAndOverview();
      toast.success("Badge assigned.");
    } catch (err) {
      const message = parseApiError(err, "Failed to assign badge.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onModerationAction(
    adviceId: string,
    action: "APPROVED" | "HOLD" | "REMOVED",
  ) {
    try {
      setActionLoading(true);
      setError(null);
      const note =
        action === "HOLD"
          ? window.prompt(
              "Optional hold reason for this thread:",
              "Needs more context",
            ) || undefined
          : undefined;

      await moderateAdvice(adviceId, { action, note });
      await Promise.all([
        loadModeration(),
        getAdminOverview().then(setOverview),
      ]);
      toast.success(`Thread moved to ${action}.`);
    } catch (err) {
      const message = parseApiError(err, "Failed to moderate thread.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onToggleFlag(
    item: AdviceItem,
    key: "isLocked" | "isFeatured" | "isSpam",
  ) {
    try {
      setActionLoading(true);
      setError(null);
      await updateAdviceFlags(item.id, { [key]: !item[key] });
      await Promise.all([
        loadModeration(),
        getAdminOverview().then(setOverview),
      ]);
      toast.success(
        `Thread ${
          key === "isLocked"
            ? "lock"
            : key === "isFeatured"
            ? "feature"
            : "spam"
        } flag updated.`,
      );
    } catch (err) {
      const message = parseApiError(err, "Failed to update thread flags.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onGenerateModerationHint(item: AdviceItem) {
    try {
      setHintLoading((current) => ({ ...current, [item.id]: true }));
      const hint = await generateModerationHintWithAi({
        title: item.title,
        body: item.body,
        status: item.status,
        isLocked: item.isLocked,
        isFeatured: item.isFeatured,
        isSpam: item.isSpam,
      });
      setModerationHints((current) => ({ ...current, [item.id]: hint }));
      toast.success("AI triage hint ready.");
    } catch (err) {
      const message = parseApiError(err, "Failed to generate AI hint.");
      setError(message);
      toast.error(message);
    } finally {
      setHintLoading((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function onReviewGroupRequest(
    request: ModerationGroupRequest,
    approve: boolean,
  ) {
    try {
      setActionLoading(true);
      setError(null);
      if (approve) {
        await approveGroupJoinRequest(request.group.id, request.id);
      } else {
        await rejectGroupJoinRequest(request.group.id, request.id);
      }
      await Promise.all([
        loadModeration(),
        getAdminOverview().then(setOverview),
      ]);
      toast.success(
        approve ? "Join request approved." : "Join request rejected.",
      );
    } catch (err) {
      const message = parseApiError(err, "Failed to process join request.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onCreateCategory() {
    const parsedSortOrder = Number(newCategorySortOrder);
    if (!newCategoryName.trim()) {
      toast.error("Category name is required.");
      return;
    }
    if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
      toast.error("Sort order must be a non-negative integer.");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await createAdminCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        sortOrder: parsedSortOrder,
      });
      setNewCategoryName("");
      setNewCategoryDescription("");
      setNewCategorySortOrder("100");
      await reloadAdminOnlyAndOverview();
      toast.success("Category created.");
    } catch (err) {
      const message = parseApiError(err, "Failed to create category.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onPatchCategory(
    categoryId: string,
    payload: Partial<CategoryItem>,
  ) {
    try {
      setActionLoading(true);
      setError(null);
      await updateAdminCategory(categoryId, payload);
      await reloadAdminOnlyAndOverview();
      toast.success("Category updated.");
    } catch (err) {
      const message = parseApiError(err, "Failed to update category.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onUpdateGroup(
    groupId: string,
    payload: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      ownerId?: string;
    },
  ) {
    try {
      setActionLoading(true);
      setError(null);
      await updateAdminGroup(groupId, payload);
      await reloadAdminOnlyAndOverview();
      if (selectedGroupId) {
        const history = await listAdminGroupModerationActions(
          selectedGroupId,
          120,
        );
        setGroupHistory(history);
      }
      toast.success("Group governance update applied.");
    } catch (err) {
      const message = parseApiError(err, "Failed to update group.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onUpdateSupportTicket(
    ticketId: string,
    payload: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      internalNote?: string | null;
      resolutionSummary?: string | null;
    },
    successMessage: string,
  ) {
    try {
      setActionLoading(true);
      setError(null);
      await updateAdminSupportTicket(ticketId, payload);
      await Promise.all([
        loadSupportInbox(),
        getAdminOverview().then(setOverview),
      ]);
      toast.success(successMessage);
    } catch (err) {
      const message = parseApiError(err, "Failed to update support ticket.");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onTransitionSupportTicket(
    ticket: SupportTicket,
    status: SupportTicketStatus,
  ) {
    if (status === "RESOLVED" || status === "CLOSED") {
      const resolutionSummary =
        window.prompt(
          "Add resolution summary (optional):",
          ticket.resolutionSummary || "",
        ) || undefined;
      await onUpdateSupportTicket(
        ticket.id,
        { status, resolutionSummary },
        `Ticket marked ${status.toLowerCase().replace("_", " ")}.`,
      );
      return;
    }

    await onUpdateSupportTicket(
      ticket.id,
      { status },
      `Ticket moved to ${status.toLowerCase().replace("_", " ")}.`,
    );
  }

  if (loading) {
    return (
      <Card>
        <p className="text-slate-300">Loading workspace…</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card className="sticky top-24">
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? "Admin Workspace" : "Moderation Workspace"}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Sidebar-driven operations center for governance and quality
            controls.
          </p>

          <div className="mt-4 space-y-1">
            {visibleSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeSection === section.key
                    ? "bg-violet-500/15 text-violet-100"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="mr-2" aria-hidden>
                      {section.icon}
                    </span>
                    {section.label}
                  </span>
                  {typeof sectionCounts[section.key] === "number" ? (
                    <span className="rounded-full border border-white/15 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
                      {sectionCounts[section.key]}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            className="mt-4 w-full"
            disabled={loading || actionLoading}
            onClick={() => void loadWorkspace()}
          >
            Refresh workspace
          </Button>

          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-400">
            Signed in as {user?.name} ({user?.role})
          </div>
        </Card>
      </aside>

      <section className="space-y-4">
        <Card className="lg:hidden">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Active section
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <select
              value={activeSection}
              onChange={(event) =>
                setActiveSection(event.target.value as SectionKey)
              }
              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {visibleSections.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.icon} {section.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              {activeSectionMeta?.label || "Section"}
            </p>
          </div>
        </Card>

        {error ? (
          <Card>
            <p className="text-rose-300">{error}</p>
          </Card>
        ) : null}

        {activeSection === "overview" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                {isAdmin ? "Admin Overview" : "Moderation Overview"}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Operational snapshot across moderation, groups, and governance.
              </p>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: "Pending moderation",
                  value: overview?.metrics.pendingModeration ?? 0,
                  tone: "text-violet-200",
                },
                {
                  label: "Pending group requests",
                  value: overview?.metrics.pendingGroupRequests ?? 0,
                  tone: "text-cyan-200",
                },
                {
                  label: "Moderation actions (24h)",
                  value: overview?.metrics.moderationActions24h ?? 0,
                  tone: "text-emerald-200",
                },
                {
                  label: "Active groups",
                  value: overview?.metrics.activeGroups ?? 0,
                  tone: "text-amber-200",
                },
                {
                  label: "Active categories",
                  value: overview?.metrics.activeCategories ?? 0,
                  tone: "text-fuchsia-200",
                },
                {
                  label: "Hold threads",
                  value: overview?.metrics.holdThreads ?? 0,
                  tone: "text-rose-200",
                },
              ].map((metric) => (
                <Card key={metric.label} className="bg-slate-900/70">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </p>
                  <p className={`mt-2 text-2xl font-semibold ${metric.tone}`}>
                    {metric.value.toLocaleString()}
                  </p>
                </Card>
              ))}
            </div>

            {isAdmin && overview?.adminOnly ? (
              <Card>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Admin-only health signals
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
                    <p className="text-xs text-slate-400">Total users</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {overview.adminOnly.totalUsers.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
                    <p className="text-xs text-slate-400">Active users</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-200">
                      {overview.adminOnly.activeUsers.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
                    <p className="text-xs text-slate-400">Admin audit (24h)</p>
                    <p className="mt-1 text-xl font-semibold text-violet-200">
                      {overview.adminOnly.adminAuditEntries24h.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeSection === "moderation" ? (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Moderation Queue
                  </h2>
                  <p className="text-sm text-slate-300">
                    Review advice threads and apply status/flag actions quickly.
                  </p>
                </div>
                <select
                  value={moderationStatus}
                  onChange={(event) =>
                    setModerationStatus(event.target.value as AdviceStatus)
                  }
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="HOLD">HOLD</option>
                  <option value="REMOVED">REMOVED</option>
                </select>
              </div>
            </Card>

            {moderationItems.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-200">
                      {item.status}
                    </span>
                    <span className={badgeClass(item.isFeatured)}>
                      {item.isFeatured ? "Featured" : "Not featured"}
                    </span>
                    <span className={badgeClass(item.isLocked)}>
                      {item.isLocked ? "Locked" : "Unlocked"}
                    </span>
                    <span className={badgeClass(item.isSpam)}>
                      {item.isSpam ? "Spam" : "Not spam"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-slate-300">
                  {item.body}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onModerationAction(item.id, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onModerationAction(item.id, "HOLD")}
                  >
                    Hold
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onModerationAction(item.id, "REMOVED")}
                  >
                    Remove
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onToggleFlag(item, "isFeatured")}
                  >
                    {item.isFeatured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onToggleFlag(item, "isLocked")}
                  >
                    {item.isLocked ? "Unlock" : "Lock"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onToggleFlag(item, "isSpam")}
                  >
                    {item.isSpam ? "Unmark spam" : "Mark spam"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={Boolean(hintLoading[item.id])}
                    onClick={() => void onGenerateModerationHint(item)}
                  >
                    {hintLoading[item.id] ? "AI hint..." : "AI triage hint"}
                  </Button>
                </div>

                {moderationHints[item.id] ? (
                  <div className="mt-3 rounded-lg border border-violet-300/20 bg-violet-500/10 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-violet-300/30 px-2 py-0.5 text-violet-100">
                        AI: {moderationHints[item.id].provider}
                      </span>
                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-slate-200">
                        Suggested: {moderationHints[item.id].recommendedAction}
                      </span>
                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-slate-200">
                        Priority: {moderationHints[item.id].priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">
                      {moderationHints[item.id].rationale}
                    </p>
                    {moderationHints[item.id].checks.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                        {moderationHints[item.id].checks.map((check, index) => (
                          <li key={`${check}-${index}`}>{check}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}

            {moderationItems.length === 0 ? (
              <Card>
                <p className="text-slate-400">
                  No advice threads in this queue.
                </p>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeSection === "groupRequests" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Group Join Requests
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Review pending requests across groups where you have moderation
                authority.
              </p>
            </Card>

            {groupRequests.map((request) => (
              <Card key={request.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {request.group.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {request.group.visibility} group
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(request.requestedAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm text-white">
                  Requester: {request.requester.name}
                </p>
                <p className="text-xs text-slate-300">
                  {request.message || "No message"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={actionLoading}
                    onClick={() => void onReviewGroupRequest(request, true)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => void onReviewGroupRequest(request, false)}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ))}

            {groupRequests.length === 0 ? (
              <Card>
                <p className="text-slate-400">
                  No pending requests available for your role.
                </p>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeSection === "activity" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Moderation Activity
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Combined timeline for advice and group moderation actions.
              </p>
            </Card>
            <Card>
              <div className="space-y-2">
                {moderationActivity.map((item) => (
                  <div
                    key={`${item.domain}_${item.id}`}
                    className="rounded-lg border border-white/10 bg-slate-950 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-slate-300">
                          {item.domain}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {item.action}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Target:{" "}
                      {item.target?.title || item.target?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Actor: {item.actor?.name || "Unknown"}{" "}
                      {item.actor?.role ? `(${item.actor.role})` : ""}
                    </p>
                    {item.note ? (
                      <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                    ) : null}
                  </div>
                ))}
                {moderationActivity.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No recent moderation activity.
                  </p>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}

        {activeSection === "support" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Support Inbox
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Triage support tickets with SLA priorities and resolve/close
                workflow.
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-[170px_170px_1fr_auto]">
                <select
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={supportStatusFilter}
                  onChange={(event) =>
                    setSupportStatusFilter(
                      event.target.value as SupportTicketStatus | "ALL",
                    )
                  }
                >
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>

                <select
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={supportPriorityFilter}
                  onChange={(event) =>
                    setSupportPriorityFilter(
                      event.target.value as SupportTicketPriority | "ALL",
                    )
                  }
                >
                  <option value="ALL">All priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>

                <input
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="Search name, email, subject, message"
                  value={supportSearch}
                  onChange={(event) => setSupportSearch(event.target.value)}
                />

                <Button
                  variant="secondary"
                  disabled={actionLoading}
                  onClick={() => void loadSupportInbox()}
                >
                  Refresh
                </Button>
              </div>
            </Card>

            {supportTickets.map((ticket) => (
              <Card key={ticket.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusBadgeClass(ticket.status)}>
                      {ticket.status}
                    </span>
                    <span className={priorityBadgeClass(ticket.priority)}>
                      {ticket.priority}
                    </span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                      SLA {ticket.slaLabel}
                    </span>
                    {ticket.isSlaBreached ? (
                      <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200">
                        SLA breached
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                </div>

                <h3 className="mt-3 text-lg font-semibold text-white">
                  {ticket.subject}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  {ticket.requesterName} • {ticket.requesterEmail}
                </p>
                <p className="mt-2 text-sm text-slate-200">{ticket.message}</p>

                <div className="mt-2 text-xs text-slate-400">
                  <p>Type: {ticket.type}</p>
                  <p>
                    First response due:{" "}
                    {ticket.firstResponseDueAt
                      ? new Date(ticket.firstResponseDueAt).toLocaleString()
                      : "Not set"}
                  </p>
                  <p>
                    First response at:{" "}
                    {ticket.firstResponseAt
                      ? new Date(ticket.firstResponseAt).toLocaleString()
                      : "Pending"}
                  </p>
                  {ticket.pageUrl ? (
                    <p>
                      Page:{" "}
                      <a
                        href={ticket.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-300 underline"
                      >
                        {ticket.pageUrl}
                      </a>
                    </p>
                  ) : null}
                </div>

                {ticket.internalNote ? (
                  <div className="mt-2 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-slate-300">
                    <p className="font-semibold text-slate-200">
                      Internal note
                    </p>
                    <p className="mt-1">{ticket.internalNote}</p>
                  </div>
                ) : null}

                {ticket.resolutionSummary ? (
                  <div className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2 text-xs text-emerald-100">
                    <p className="font-semibold">Resolution summary</p>
                    <p className="mt-1">{ticket.resolutionSummary}</p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() =>
                      void onUpdateSupportTicket(
                        ticket.id,
                        {
                          priority:
                            ticket.priority === "URGENT"
                              ? "NORMAL"
                              : ticket.priority === "NORMAL"
                              ? "LOW"
                              : "URGENT",
                        },
                        "Ticket priority updated.",
                      )
                    }
                  >
                    Cycle priority
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading || ticket.status === "IN_PROGRESS"}
                    onClick={() =>
                      void onTransitionSupportTicket(ticket, "IN_PROGRESS")
                    }
                  >
                    Mark in progress
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading || ticket.status === "RESOLVED"}
                    onClick={() =>
                      void onTransitionSupportTicket(ticket, "RESOLVED")
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading || ticket.status === "CLOSED"}
                    onClick={() =>
                      void onTransitionSupportTicket(ticket, "CLOSED")
                    }
                  >
                    Close
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading || ticket.status === "OPEN"}
                    onClick={() =>
                      void onTransitionSupportTicket(ticket, "OPEN")
                    }
                  >
                    Re-open
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => {
                      const note =
                        window.prompt(
                          "Add/update internal note:",
                          ticket.internalNote || "",
                        ) || "";
                      void onUpdateSupportTicket(
                        ticket.id,
                        { internalNote: note || null },
                        "Internal note updated.",
                      );
                    }}
                  >
                    Add note
                  </Button>
                </div>
              </Card>
            ))}

            {supportTickets.length === 0 ? (
              <Card>
                <p className="text-slate-400">
                  No support tickets match current filters.
                </p>
              </Card>
            ) : null}
          </>
        ) : null}

        {isAdmin && activeSection === "users" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Users & Roles
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Role and account status controls with strict admin authority.
              </p>
            </Card>
            {users.map((adminUser) => (
              <Card key={adminUser.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{adminUser.name}</p>
                    <p className="text-sm text-slate-300">{adminUser.email}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {adminUser.role} •{" "}
                      {adminUser.isActive ? "Active" : "Suspended"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {adminUser.role !== "MEMBER" ? (
                      <Button
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() =>
                          void onRoleChange(adminUser.id, "MEMBER")
                        }
                      >
                        Make Member
                      </Button>
                    ) : null}
                    {adminUser.role !== "MODERATOR" ? (
                      <Button
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() =>
                          void onRoleChange(adminUser.id, "MODERATOR")
                        }
                      >
                        Make Moderator
                      </Button>
                    ) : null}
                    {adminUser.role !== "ADMIN" ? (
                      <Button
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() => void onRoleChange(adminUser.id, "ADMIN")}
                      >
                        Make Admin
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() =>
                        void onStatusChange(adminUser.id, !adminUser.isActive)
                      }
                    >
                      {adminUser.isActive ? "Suspend" : "Activate"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => void onVerifyAdvisor(adminUser.id, true)}
                    >
                      Verify Advisor
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => void onAssignAdvisorCategory(adminUser.id)}
                    >
                      Assign Advisor Category
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : null}

        {isAdmin && activeSection === "wallet" ? (
          <Card>
            <h2 className="text-xl font-semibold text-white">
              Wallet Controls
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Apply manual paid/earned credit corrections with mandatory reason.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <select
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {users.map((adminUser) => (
                  <option key={adminUser.id} value={adminUser.id}>
                    {adminUser.name} ({adminUser.role})
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
                placeholder="Amount cents"
              />
              <Button
                disabled={actionLoading || !canSubmitWalletAdjustment}
                onClick={() => void onWalletAdjust()}
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
          </Card>
        ) : null}

        {isAdmin && activeSection === "badges" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Badge Operations
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Assign badges with an auditable reason.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  {users.map((adminUser) => (
                    <option key={adminUser.id} value={adminUser.id}>
                      {adminUser.name} ({adminUser.role})
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
                  disabled={actionLoading || !canSubmitBadgeAssignment}
                  onClick={() => void onAssignBadge()}
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
            </Card>

            <Card>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Badge catalog
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-white">
                      {badge.icon} {badge.name}
                    </p>
                    <p className="text-xs text-slate-300">
                      {badge.description}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {badge.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        ) : null}

        {isAdmin && activeSection === "categories" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Category Management
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Create, reorder, and activate/deactivate categories.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Category name"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  value={newCategoryDescription}
                  onChange={(event) =>
                    setNewCategoryDescription(event.target.value)
                  }
                  placeholder="Description"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  value={newCategorySortOrder}
                  onChange={(event) =>
                    setNewCategorySortOrder(event.target.value)
                  }
                  type="number"
                  placeholder="Order"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <Button
                  disabled={actionLoading}
                  onClick={() => void onCreateCategory()}
                >
                  Create
                </Button>
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="rounded-lg border border-white/10 bg-slate-950 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          /{category.slug}
                        </p>
                        <p className="text-xs text-slate-300">
                          {category.description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          defaultValue={category.sortOrder}
                          type="number"
                          className="w-24 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                          onBlur={(event) => {
                            const next = Number(event.target.value);
                            if (
                              Number.isInteger(next) &&
                              next >= 0 &&
                              next !== category.sortOrder
                            ) {
                              void onPatchCategory(category.id, {
                                sortOrder: next,
                              });
                            }
                          }}
                        />
                        <Button
                          variant="secondary"
                          disabled={actionLoading}
                          onClick={() =>
                            void onPatchCategory(category.id, {
                              isActive: !category.isActive,
                            })
                          }
                        >
                          {category.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-400">No categories yet.</p>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}

        {isAdmin && activeSection === "groups" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Group Governance
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Transfer ownership and control group active status.
              </p>

              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">Select group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.memberCount} members)
                  </option>
                ))}
              </select>
            </Card>

            {selectedGroup ? (
              <>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedGroup.name}
                      </h3>
                      <p className="text-sm text-slate-300">
                        {selectedGroup.description || "No description"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Owner: {selectedGroup.owner?.name || "Unknown"} •
                        Pending join requests:{" "}
                        {selectedGroup.pendingJoinRequests}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() =>
                        void onUpdateGroup(selectedGroup.id, {
                          isActive: !selectedGroup.isActive,
                        })
                      }
                    >
                      {selectedGroup.isActive
                        ? "Deactivate group"
                        : "Reactivate group"}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      value={groupOwnerTransferId}
                      onChange={(event) =>
                        setGroupOwnerTransferId(event.target.value)
                      }
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select new owner</option>
                      {users
                        .filter((adminUser) => adminUser.isActive)
                        .map((adminUser) => (
                          <option key={adminUser.id} value={adminUser.id}>
                            {adminUser.name} ({adminUser.role})
                          </option>
                        ))}
                    </select>
                    <Button
                      disabled={actionLoading || !groupOwnerTransferId}
                      onClick={() => {
                        const ownerId = groupOwnerTransferId;
                        setGroupOwnerTransferId("");
                        void onUpdateGroup(selectedGroup.id, { ownerId });
                      }}
                    >
                      Transfer ownership
                    </Button>
                  </div>
                </Card>

                <Card>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Group moderation history
                  </h4>
                  <div className="mt-3 space-y-2">
                    {groupHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-white/10 bg-slate-950 p-2"
                      >
                        <p className="text-sm text-white">{item.action}</p>
                        <p className="text-xs text-slate-400">
                          {item.actor?.name || "Unknown"} •{" "}
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        {item.note ? (
                          <p className="text-xs text-slate-500">{item.note}</p>
                        ) : null}
                      </div>
                    ))}
                    {groupHistory.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No group moderation actions found.
                      </p>
                    ) : null}
                  </div>
                </Card>
              </>
            ) : null}
          </>
        ) : null}

        {isAdmin && activeSection === "audit" ? (
          <>
            <Card>
              <h2 className="text-xl font-semibold text-white">
                Admin Audit Logs
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Immutable timeline for wallet and badge admin actions.
              </p>
            </Card>

            <Card>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-white/10 bg-slate-950 p-3"
                  >
                    <p className="text-sm text-white">
                      {log.action} • {log.targetUser?.name || "N/A"}
                    </p>
                    <p className="text-xs text-slate-300">{log.reason}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()} by{" "}
                      {log.admin?.name || "Unknown"}
                    </p>
                  </div>
                ))}
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No audit entries yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}
      </section>
    </div>
  );
}
