import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { listCategories, listPublicFeed, reactHelpful } from "../services/api";
import { AdviceItem, CategoryItem } from "../types";
import { useSeo } from "../utils/seo";

export default function Feed() {
  const [posts, setPosts] = useState<AdviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"TRENDING" | "LATEST">("TRENDING");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reactionBusyId, setReactionBusyId] = useState<string | null>(null);

  useSeo({
    title: "Advice Feed - Trending Anonymous Threads | TellNab",
    description:
      "Browse approved TellNab advice threads. Explore featured discussions on career, relationships, money, and personal growth.",
    path: "/feed",
  });

  async function loadPage(isReset: boolean) {
    if (isReset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await listPublicFeed({
        cursor: isReset ? undefined : nextCursor || undefined,
        limit: 12,
        categoryId: selectedCategoryId || undefined,
        sort,
        query: query.trim() || undefined,
      });

      setPosts((prev) => {
        const merged = isReset ? response.items : [...prev, ...response.items];
        const deduped = new Map<string, AdviceItem>();
        merged.forEach((item) => deduped.set(item.id, item));
        return Array.from(deduped.values());
      });
      setNextCursor(response.pageInfo.nextCursor);
      setHasMore(response.pageInfo.hasMore);
    } catch {
      setError("Unable to load feed. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage(true);

    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [selectedCategoryId, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPage(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => posts, [posts]);
  const mostHelpfulPostId = useMemo(() => {
    if (!filtered.length) return null;
    return [...filtered].sort(
      (a, b) => Number(b.helpfulCount || 0) - Number(a.helpfulCount || 0),
    )[0]?.id;
  }, [filtered]);

  async function onHelpful(post: AdviceItem) {
    try {
      setReactionBusyId(post.id);
      const result = await reactHelpful(post.id, "toggle");
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                helpfulCount: result.helpfulCount,
              }
            : item,
        ),
      );
    } catch {
      // soft fail
    } finally {
      setReactionBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <SectionTitle
          title="Thread Feed"
          subtitle="Live approved threads from the community. Open any thread to read and reply."
        />
      </div>

      <Card className="rounded-2xl border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/60">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads by title, content, or author"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "TRENDING" | "LATEST")
            }
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="TRENDING">Trending</option>
            <option value="LATEST">Latest</option>
          </select>
          <select
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <span className="rounded-xl border border-violet-300/25 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200">
            {loading ? "Loading…" : `${filtered.length} threads`}
          </span>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="text-slate-300">Loading feed…</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            {error ? (
              <Card>
                <p className="text-rose-300">{error}</p>
              </Card>
            ) : null}

            {filtered.map((post) => (
              <Card
                key={post.id}
                className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65 transition hover:border-violet-400/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                      {post.status}
                    </span>
                    {post.isFeatured ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                        Featured
                      </span>
                    ) : null}
                    {post.category?.name ? (
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                        {post.category.name}
                      </span>
                    ) : null}
                    {post.isBoostActive ? (
                      <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200">
                        Boosted
                      </span>
                    ) : null}
                    {post.identityMode === "ANONYMOUS" || post.isAnonymous ? (
                      <span className="rounded-full border border-slate-300/25 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                        Anonymous
                      </span>
                    ) : (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                        Public
                      </span>
                    )}
                    {post.isUrgent ? (
                      <span className="rounded-full border border-rose-300/35 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100">
                        Urgent
                      </span>
                    ) : null}
                    {post.priorityTier === "PRIORITY" ||
                    post.priorityTier === "URGENT" ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                        {post.priorityTier}
                      </span>
                    ) : null}
                    {post.isLocked ? (
                      <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200">
                        Locked
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>

                <h3 className="mt-3 text-lg font-semibold text-white">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-slate-300">
                  {post.body}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {post.identityMode === "PUBLIC" ? (
                      <span className="inline-flex items-center gap-2">
                        {post.author?.avatarUrl ? (
                          <img
                            src={post.author.avatarUrl}
                            alt={post.author?.name || "Profile"}
                            className="h-5 w-5 rounded-full border border-white/20 object-cover"
                          />
                        ) : null}
                        <span>by {post.author?.name || "Unknown"}</span>
                      </span>
                    ) : (
                      <span>by Anonymous</span>
                    )}
                    {post.author?.advisorProfile?.level ? (
                      <span className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
                        {post.author.advisorProfile.level.replaceAll("_", " ")}
                      </span>
                    ) : null}
                    {post.author?.advisorProfile?.isVerified ? (
                      <Link
                        to={`/advisors/${post.author.id}`}
                        className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Verified advisor
                      </Link>
                    ) : null}
                    {Number(post.author?.advisorProfile?.helpfulCount || 0) >= 25 ? (
                      <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                        Top Contributor
                      </span>
                    ) : null}
                    {mostHelpfulPostId === post.id ? (
                      <span className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
                        Most Helpful Answer
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reactionBusyId === post.id}
                      onClick={() => void onHelpful(post)}
                      className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                    >
                      Helpful {post.helpfulCount || 0}
                    </button>
                    <Link
                      to={`/advice/${post.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
                    >
                      Open thread
                    </Link>
                  </div>
                </div>
              </Card>
            ))}

            {!error && filtered.length === 0 ? (
              <Card>
                <p className="text-slate-400">
                  No threads found with current filters.
                </p>
              </Card>
            ) : null}

            {hasMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadPage(false)}
                  disabled={loadingMore}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </div>

          <Card className="h-fit border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Feed system status
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>• Source: approved advice threads</p>
              <p>• Sorted: trending score or latest</p>
              <p>• Access: public-only visibility</p>
              <p>• Pagination: cursor based</p>
            </div>
          </Card>
        </div>
      )}

      <Link
        to="/ask"
        className="fixed bottom-5 right-5 z-20 inline-flex items-center justify-center rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/50 md:hidden"
      >
        Ask anonymously
      </Link>
    </div>
  );
}
