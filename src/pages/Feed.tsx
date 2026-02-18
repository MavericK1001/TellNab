import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { listAdvice } from "../services/api";
import { AdviceItem } from "../types";

export default function Feed() {
  const [posts, setPosts] = useState<AdviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    listAdvice("APPROVED")
      .then(setPosts)
      .catch(() => setError("Unable to load feed. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      if (featuredOnly && !post.isFeatured) return false;
      if (!query.trim()) return true;

      const q = query.toLowerCase();
      return (
        post.title.toLowerCase().includes(q) ||
        post.body.toLowerCase().includes(q) ||
        (post.author?.name || "").toLowerCase().includes(q)
      );
    });
  }, [featuredOnly, posts, query]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Thread Feed"
        subtitle="Live approved threads from the community. Open any thread to read and reply."
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads by title, content, or author"
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(event) => setFeaturedOnly(event.target.checked)}
            />
            Featured only
          </label>
          <span className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200">
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
                className="border-white/15 bg-slate-900/80 transition hover:border-violet-400/40"
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
                  <p className="text-xs text-slate-400">
                    by {post.author?.name || "Unknown"}
                  </p>
                  <Link
                    to={`/advice/${post.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
                  >
                    Open thread
                  </Link>
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
          </div>

          <Card className="h-fit">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Feed system status
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>• Source: approved advice threads</p>
              <p>• Sorted: featured first, latest next</p>
              <p>• Access: public feed, open thread details</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
