import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { listAdvice } from "../services/api";
import { AdviceItem } from "../types";

export default function Home() {
  const [threads, setThreads] = useState<AdviceItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  useEffect(() => {
    listAdvice("APPROVED")
      .then((items) => setThreads(items.slice(0, 4)))
      .finally(() => setLoadingThreads(false));
  }, []);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl shadow-violet-900/20 sm:p-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-200">
              Community thread system
            </span>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
              Honest thread-based advice for real-life decisions.
            </h1>
            <p className="max-w-xl text-slate-300">
              Ask, discuss, moderate, and follow full conversations in one
              aligned system. Featured threads rise to the top for visibility.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button to="/advice" className="rounded-xl px-5 py-3">
                Open threads
              </Button>
              <Button
                to="/feed"
                variant="secondary"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Browse feed
              </Button>
            </div>
          </div>

          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Latest threads
            </p>
            <div className="space-y-3">
              {loadingThreads ? (
                <p className="text-sm text-slate-300">Loading threads…</p>
              ) : null}

              {!loadingThreads && threads.length === 0 ? (
                <p className="text-sm text-slate-300">
                  No approved threads yet.
                </p>
              ) : null}

              {threads.map((thread) => (
                <article
                  key={thread.id}
                  className="rounded-xl border border-white/10 bg-slate-800/70 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-white">
                      {thread.title}
                    </p>
                    {thread.isFeatured ? (
                      <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        Featured
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                    {thread.body}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      by {thread.author?.name || "Unknown"}
                    </p>
                    <Link
                      to={`/advice/${thread.id}`}
                      className="text-xs font-semibold text-violet-200 hover:text-violet-100"
                    >
                      Open thread →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-wider text-violet-300">
            System 1
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Publish & approve
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            New advice is submitted, reviewed by moderators, then published.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-wider text-sky-300">
            System 2
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Thread discussions
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Each advice opens a full thread where members can discuss and reply.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-wider text-emerald-300">
            System 3
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Moderation controls
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Moderators can hold/remove, feature, and lock threads when needed.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h3 className="text-xl font-semibold text-white">Community tone</h3>
          <p className="mt-2 text-slate-300">
            TellNab is direct but moderated. Personal attacks, hate, and
            harassment are removed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Honest
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Direct
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Actionable
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Respectful
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Platform stats
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">Live threads</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {loadingThreads ? "…" : threads.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">Feed status</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                Online
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-white">
              Need clarity on something today?
            </h4>
            <p className="text-sm text-violet-100/90">
              Post now and get advice from people who understand.
            </p>
          </div>
          <Button
            to="/advice"
            className="bg-white text-violet-700 hover:bg-violet-100"
          >
            Start a thread
          </Button>
        </div>
      </section>
    </div>
  );
}
