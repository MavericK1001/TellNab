import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import Card from "../components/Card";
import Button from "../components/Button";
import {
  approveGroupJoinRequest,
  createGroup,
  getGroupDetail,
  joinGroup,
  leaveGroup,
  listCategories,
  listGroupJoinRequests,
  listGroups,
  rejectGroupJoinRequest,
} from "../services/api";
import { CategoryItem, GroupJoinRequest, GroupSummary } from "../types";
import { useAuth } from "../context/AuthContext";
import { useSeo } from "../utils/seo";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "ALL" | "PUBLIC" | "PRIVATE"
  >("ALL");
  const [topicCategoryIdFilter, setTopicCategoryIdFilter] =
    useState<string>("");

  useSeo({
    title: "Discussion Groups | TellNab",
    description: "Create and join public/private discussion groups in TellNab.",
    path: "/groups",
  });

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const canReviewRequests =
    selectedGroup?.membership?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.role === "MODERATOR";

  async function loadGroups() {
    try {
      setLoading(true);
      const list = await listGroups({
        q: query.trim() || undefined,
        visibility: visibilityFilter,
        topicCategoryId: topicCategoryIdFilter || undefined,
      });
      setGroups(list);
      if (!selectedGroupId && list.length > 0) {
        setSelectedGroupId(list[0].id);
      } else if (
        selectedGroupId &&
        !list.some((item) => item.id === selectedGroupId)
      ) {
        setSelectedGroupId(list[0]?.id || null);
      }
    } catch {
      setIsError(true);
      setStatus("Failed to load groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, visibilityFilter, topicCategoryIdFilter]);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroups();
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!selectedGroupId || !canReviewRequests) {
      setJoinRequests([]);
      return;
    }

    setRequestLoading(true);
    listGroupJoinRequests(selectedGroupId)
      .then(setJoinRequests)
      .catch(() => setJoinRequests([]))
      .finally(() => setRequestLoading(false));
  }, [selectedGroupId, canReviewRequests]);

  async function onCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setStatus(null);
      setIsError(false);
      const created = await createGroup({
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || ""),
        visibility: String(formData.get("visibility") || "PUBLIC") as
          | "PUBLIC"
          | "PRIVATE",
        topicCategoryId:
          String(formData.get("topicCategoryId") || "") || undefined,
      });
      setStatus("Group created.");
      await loadGroups();
      setSelectedGroupId(created.id);
      event.currentTarget.reset();
    } catch (error) {
      setIsError(true);
      if (
        isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
      ) {
        setStatus(error.response.data.message);
        return;
      }
      setStatus("Failed to create group.");
    }
  }

  async function onJoin(groupId: string) {
    try {
      setStatus(null);
      setIsError(false);
      const result = await joinGroup(groupId);
      if (result.status === "PENDING") {
        setStatus("Join request submitted.");
      } else {
        setStatus("You joined the group.");
      }
      await loadGroups();
      const detail = await getGroupDetail(groupId);
      setGroups((prev) =>
        prev.map((item) => (item.id === detail.group.id ? detail.group : item)),
      );
    } catch (error) {
      setIsError(true);
      if (
        isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
      ) {
        setStatus(error.response.data.message);
        return;
      }
      setStatus("Failed to join group.");
    }
  }

  async function onLeave(groupId: string) {
    try {
      setStatus(null);
      setIsError(false);
      await leaveGroup(groupId);
      setStatus("You left the group.");
      await loadGroups();
    } catch (error) {
      setIsError(true);
      if (
        isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
      ) {
        setStatus(error.response.data.message);
        return;
      }
      setStatus("Failed to leave group.");
    }
  }

  async function onReviewRequest(requestId: string, approve: boolean) {
    if (!selectedGroupId) return;

    try {
      if (approve) {
        await approveGroupJoinRequest(selectedGroupId, requestId);
      } else {
        await rejectGroupJoinRequest(selectedGroupId, requestId);
      }

      const next = await listGroupJoinRequests(selectedGroupId);
      setJoinRequests(next);
      await loadGroups();
    } catch {
      setIsError(true);
      setStatus("Failed to process join request.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-4">
        <Card className="rounded-3xl border-white/15 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Topic Communities
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Build recurring communities around one topic. Open communities allow
            instant join, private ones use moderated request-to-join.
          </p>

          {user ? (
            <form className="mt-4 space-y-3" onSubmit={onCreateGroup}>
              <input
                name="name"
                required
                minLength={3}
                placeholder="Group name"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <textarea
                name="description"
                rows={3}
                placeholder="What is this group for?"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <select
                name="topicCategoryId"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                defaultValue=""
              >
                <option value="" disabled>
                  Select topic category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                name="visibility"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                defaultValue="PUBLIC"
              >
                <option value="PUBLIC">Public (open join)</option>
                <option value="PRIVATE">Private (request to join)</option>
              </select>
              <Button type="submit">Create group</Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-amber-200">
              Login to create groups.
            </p>
          )}

          {status ? (
            <p
              className={`mt-3 text-sm ${
                isError ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {status}
            </p>
          ) : null}
        </Card>

        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/60">
          <h2 className="text-lg font-semibold text-white">
            Discover communities
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by topic or name"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 sm:col-span-2"
            />
            <select
              value={visibilityFilter}
              onChange={(event) =>
                setVisibilityFilter(
                  event.target.value as "ALL" | "PUBLIC" | "PRIVATE",
                )
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100"
            >
              <option value="ALL">All access types</option>
              <option value="PUBLIC">Public only</option>
              <option value="PRIVATE">Request to join</option>
            </select>
          </div>
          <select
            value={topicCategoryIdFilter}
            onChange={(event) => setTopicCategoryIdFilter(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100"
          >
            <option value="">All topic categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {loading ? (
            <p className="mt-3 text-sm text-slate-300">Loading…</p>
          ) : null}
          <div className="mt-3 space-y-3">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={`block w-full rounded-xl border p-3 text-left transition ${
                  selectedGroupId === group.id
                    ? "border-violet-400/50 bg-violet-500/10"
                    : "border-white/10 bg-slate-950"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{group.name}</p>
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-slate-300">
                    {group.visibility === "PRIVATE"
                      ? "Request to join"
                      : "Open join"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                  {group.description}
                </p>
                {group.topicCategory ? (
                  <p className="mt-1 text-[11px] text-cyan-200">
                    Topic: {group.topicCategory.name}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-slate-400">
                  {group.memberCount} members
                </p>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/60">
          <h2 className="text-lg font-semibold text-white">Group details</h2>
          {!selectedGroup ? (
            <p className="mt-3 text-sm text-slate-300">
              Pick a group to view details.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-white">{selectedGroup.name}</p>
              <p className="text-sm text-slate-300">
                {selectedGroup.description}
              </p>
              {selectedGroup.topicCategory ? (
                <p className="text-xs text-cyan-200">
                  Topic: {selectedGroup.topicCategory.name}
                </p>
              ) : null}
              <p className="text-xs text-slate-400">
                Owner: {selectedGroup.owner?.name || "Unknown"}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedGroup.membership ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onLeave(selectedGroup.id)}
                  >
                    Leave group
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void onJoin(selectedGroup.id)}
                  >
                    {selectedGroup.visibility === "PRIVATE"
                      ? "Request to join"
                      : "Join group"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        {selectedGroup && canReviewRequests ? (
          <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/60">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Join requests
            </h3>
            {requestLoading ? (
              <p className="mt-3 text-sm text-slate-300">Loading…</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {joinRequests.length === 0 && !requestLoading ? (
                <p className="text-sm text-slate-400">No pending requests.</p>
              ) : null}
              {joinRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-slate-950 p-3"
                >
                  <p className="text-sm font-medium text-white">
                    {request.requester.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {request.message || "No message"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      onClick={() => void onReviewRequest(request.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void onReviewRequest(request.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
