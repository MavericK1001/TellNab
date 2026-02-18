import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { getHomeOverview, listAdvice } from "../services/api";
import { AdviceItem, HomeOverview } from "../types";

export default function Home() {
  const [threads, setThreads] = useState<AdviceItem[]>([]);
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const todoRoadmap = useMemo(
    () => [
      {
        phase: "Now",
        title: "Trust & product fit",
        points: [
          "Dynamic profiles and impact stats",
          "Homepage live metrics and featured highlights",
          "Unified Ask → Advice submission flow",
        ],
      },
      {
        phase: "Next",
        title: "Engagement loop",
        points: [
          "Thread follow/watchlist",
          "Reply and moderation notifications",
          "Quality scoring for top advice",
        ],
      },
      {
        phase: "Later",
        title: "Market moat",
        points: [
          "Outcome check-ins after 7/30 days",
          "Category-specific advisor credibility",
          "AI quality coach before publish",
        ],
      },
    ],
    [],
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([listAdvice("APPROVED"), getHomeOverview()])
      .then(([items, home]) => {
        if (!mounted) return;
        setThreads(items.slice(0, 6));
        setOverview(home);
      })
      .catch(() => {
        if (!mounted) return;
        setOverviewError(
          "Live insights are warming up. Refresh in a few moments.",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingThreads(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-reveal]"));

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        }
      },
      { threshold: 0.15 },
    );

    targets.forEach((target, index) => {
      (target as HTMLElement).style.transitionDelay = `${Math.min(
        index * 80,
        320,
      )}ms`;
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  const liveMetrics = [
    {
      label: "Approved threads",
      value: overview?.metrics.approvedThreads ?? threads.length,
      accent: "text-violet-200",
    },
    {
      label: "Featured threads",
      value:
        overview?.metrics.featuredThreads ??
        threads.filter((thread) => thread.isFeatured).length,
      accent: "text-amber-200",
    },
    {
      label: "Community comments",
      value: overview?.metrics.totalComments ?? 0,
      accent: "text-cyan-200",
    },
    {
      label: "Active members",
      value: overview?.metrics.activeMembers ?? 0,
      accent: "text-emerald-200",
    },
  ];

  return (
    <div className="space-y-8">
      <section
        data-reveal
        className="reveal-block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl shadow-violet-900/20 sm:p-12"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-200 home-pulse-glow">
              TellNab USP • from dilemma to decision
            </span>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
              Brutally honest advice, safely moderated for real outcomes.
            </h1>
            <p className="max-w-xl text-slate-300">
              Most platforms give noise or shallow opinions. TellNab turns hard
              life decisions into structured threads with moderation, follow-up,
              and actionable clarity.
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

          <Card className="p-5 home-float-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Live highlights
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

              {(overview?.highlights?.length
                ? overview.highlights
                : threads.slice(0, 3)
              ).map((thread) => (
                <article
                  key={thread.id}
                  className="rounded-xl border border-white/10 bg-slate-800/70 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/35"
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

              {overviewError ? (
                <p className="text-xs text-amber-200">{overviewError}</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="grid gap-4 lg:grid-cols-3">
        {[
          {
            phase: "Step 1",
            title: "Post real dilemmas",
            body: "Share high-stakes decisions with context. Anonymous by default, honest by design.",
            tone: "text-violet-300",
          },
          {
            phase: "Step 2",
            title: "Get actionable thread advice",
            body: "Members discuss tradeoffs openly. Strong replies rise in visible discussion threads.",
            tone: "text-sky-300",
          },
          {
            phase: "Step 3",
            title: "Trust through moderation",
            body: "Moderators keep quality high with approval, lock, hold, and featuring controls.",
            tone: "text-emerald-300",
          },
        ].map((item) => (
          <div
            key={item.title}
            data-reveal
            className="reveal-block rounded-2xl border border-white/10 bg-slate-900/70 p-6 transition duration-300 hover:border-violet-300/30"
          >
            <p className={`text-xs uppercase tracking-wider ${item.tone}`}>
              {item.phase}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{item.body}</p>
          </div>
        ))}
      </section>

      <section
        data-reveal
        className="reveal-block grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <Card>
          <h3 className="text-xl font-semibold text-white">
            What makes TellNab unique
          </h3>
          <p className="mt-2 text-slate-300">
            We combine candid crowd advice with a moderated quality layer. The
            result is direct answers without chaos.
          </p>
          <div className="mt-5 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Decision-first threads
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Moderator quality controls
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Featured high-signal advice
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Built for follow-up outcomes
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Live platform stats
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {liveMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-white/10 bg-slate-950 p-3"
              >
                <p className="text-[11px] text-slate-400">{metric.label}</p>
                <p className={`mt-1 text-lg font-semibold ${metric.accent}`}>
                  {loadingThreads ? "…" : metric.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section
        data-reveal
        className="reveal-block rounded-2xl border border-white/10 bg-slate-900/70 p-6"
      >
        <h3 className="text-lg font-semibold text-white">
          Execution to-do list (market leadership)
        </h3>
        <p className="mt-1 text-sm text-slate-300">
          We are building a defensible product loop: better signal, better
          outcomes, better trust.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {todoRoadmap.map((lane) => (
            <article
              key={lane.phase}
              className="rounded-xl border border-white/10 bg-slate-950/70 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">
                {lane.phase}
              </p>
              <h4 className="mt-1 text-sm font-semibold text-white">
                {lane.title}
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {lane.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-0.5 text-emerald-300">●</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        data-reveal
        className="reveal-block rounded-2xl border border-violet-300/20 bg-violet-500/10 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-white">
              Ready to turn uncertainty into a confident decision?
            </h4>
            <p className="text-sm text-violet-100/90">
              Start a thread today. The community and moderation system will do
              the rest.
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
