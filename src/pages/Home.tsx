import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import {
  getConversations,
  getHomeOverview,
  getProfile,
  listAdvisorLeaderboard,
  listAdvice,
  listFollowingAdvice,
  listNotifications,
} from "../services/api";
import {
  AdviceItem,
  AdvisorProfile,
  ConversationSummary,
  HomeOverview,
  NotificationItem,
  UserProfile,
} from "../types";
import { useSeo } from "../utils/seo";
import { useAuth } from "../context/AuthContext";

function formatRelativeTime(value?: string | null) {
  if (!value) return "just now";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "just now";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Home() {
  const { user } = useAuth();

  const [threads, setThreads] = useState<AdviceItem[]>([]);
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<
    NotificationItem[]
  >([]);
  const [watchlist, setWatchlist] = useState<AdviceItem[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<AdvisorProfile[]>([]);
  const [loadingMomentum, setLoadingMomentum] = useState(false);
  const [momentumError, setMomentumError] = useState<string | null>(null);

  useSeo({
    title: "TellNab - Anonymous Advice Threads for Real Decisions",
    description:
      "TellNab is a moderated anonymous advice community for career, relationships, money, and life dilemmas. Ask directly and get actionable answers.",
    path: "/",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "TellNab",
      url: `${import.meta.env.VITE_SITE_URL || "https://tellnab.com"}/`,
      description:
        "Moderated anonymous advice threads for real life decisions.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${
          import.meta.env.VITE_SITE_URL || "https://tellnab.com"
        }/feed?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  });

  const trustSignals = useMemo(
    () => [
      {
        title: "Moderated quality",
        description:
          "Every public thread passes moderation before it reaches the feed.",
      },
      {
        title: "Live prioritization",
        description:
          "Boosted and featured labels make urgency and quality instantly visible.",
      },
      {
        title: "Action-first outcomes",
        description:
          "Follow threads, track replies, and return through notifications quickly.",
      },
    ],
    [],
  );

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([listAdvice("APPROVED"), getHomeOverview()])
      .then((results) => {
        if (!mounted) return;

        const [threadsResult, overviewResult] = results;

        if (threadsResult.status === "fulfilled") {
          setThreads(threadsResult.value.slice(0, 8));
        }

        listAdvisorLeaderboard(5)
          .then((rows) => setLeaderboard(rows))
          .catch(() => setLeaderboard([]));

        if (overviewResult.status === "fulfilled") {
          setOverview(overviewResult.value);
        }

        if (
          threadsResult.status === "rejected" ||
          overviewResult.status === "rejected"
        ) {
          setOverviewError(
            "Live insights are warming up. Refresh in a few moments.",
          );
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingOverview(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setProfile(null);
      setUnreadCount(0);
      setRecentNotifications([]);
      setWatchlist([]);
      setConversations([]);
      setMomentumError(null);
      setLoadingMomentum(false);
      return;
    }

    setLoadingMomentum(true);
    setMomentumError(null);

    Promise.allSettled([
      getProfile(),
      listNotifications(),
      listFollowingAdvice(),
      getConversations(),
    ])
      .then((results) => {
        if (!mounted) return;

        const [
          profileResult,
          notificationsResult,
          watchlistResult,
          conversationsResult,
        ] = results;

        let hasFailure = false;

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
        } else {
          hasFailure = true;
        }

        if (notificationsResult.status === "fulfilled") {
          setUnreadCount(notificationsResult.value.unreadCount);
          setRecentNotifications(
            notificationsResult.value.notifications.slice(0, 3),
          );
        } else {
          hasFailure = true;
        }

        if (watchlistResult.status === "fulfilled") {
          setWatchlist(watchlistResult.value.slice(0, 3));
        } else {
          hasFailure = true;
        }

        if (conversationsResult.status === "fulfilled") {
          setConversations(conversationsResult.value.slice(0, 3));
        } else {
          hasFailure = true;
        }

        if (hasFailure) {
          setMomentumError("Some personalized widgets are still syncing.");
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingMomentum(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

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
      label: "Boosted now",
      value:
        overview?.metrics.boostedThreads ??
        threads.filter((thread) => thread.isBoostActive).length,
      accent: "text-rose-200",
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

  const highlights = overview?.highlights?.length
    ? overview.highlights.slice(0, 5)
    : threads.slice(0, 5);

  const dashboardQuickStats = [
    {
      label: "Approved",
      value: overview?.metrics.approvedThreads ?? threads.length,
      accent: "text-violet-200",
    },
    {
      label: "Boosted",
      value:
        overview?.metrics.boostedThreads ??
        threads.filter((thread) => thread.isBoostActive).length,
      accent: "text-rose-200",
    },
    {
      label: user ? "Unread" : "Members",
      value: user ? unreadCount : overview?.metrics.activeMembers ?? 0,
      accent: user ? "text-cyan-200" : "text-emerald-200",
    },
  ];

  return (
    <div className="space-y-8">
      <section
        data-reveal
        className="reveal-block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/12 via-slate-900 to-cyan-500/10 p-8 shadow-2xl shadow-violet-900/20 sm:p-10"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-200 home-pulse-glow">
              Dashboard mode • high-signal decisions
            </span>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
              Ask for advice your way — anonymously or publicly.
            </h1>
            <p className="max-w-xl text-slate-300">
              Post with full privacy or with your profile. TellNab keeps advice
              high-signal, moderated, and actionable.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button to="/ask" className="rounded-xl px-5 py-3">
                Ask Anonymously
              </Button>
              <Button
                to="/ask?identity=PUBLIC"
                variant="secondary"
                className="rounded-xl px-5 py-3"
              >
                Ask with Profile
              </Button>
              <Button
                to="/feed"
                variant="secondary"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Browse feed
              </Button>
            </div>
            <p className="text-sm font-medium text-violet-100/90">
              Your identity, your choice.
            </p>
          </div>

          <Card className="border-white/15 bg-gradient-to-b from-slate-900/82 to-slate-900/65 p-5 home-float-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Dashboard pulse
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {dashboardQuickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-slate-800/70 p-3"
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {stat.label}
                  </p>
                  <p className={`mt-1 text-xl font-bold ${stat.accent}`}>
                    {loadingOverview ? "…" : stat.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-xs text-violet-100">
              {user
                ? "Personalized panels below use your notifications, follows, and conversations."
                : "Sign in to unlock personalized momentum panels and quick continuation cards."}
            </div>
          </Card>
        </div>
      </section>

      <section
        data-reveal
        className="reveal-block rounded-2xl border border-white/10 bg-slate-900/70 p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Live platform snapshot
            </h2>
            <p className="text-sm text-slate-300">
              What is active right now across TellNab.
            </p>
          </div>
          <Link
            to="/feed"
            className="text-xs font-semibold text-violet-200 hover:text-violet-100"
          >
            View full feed →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {liveMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/10 bg-slate-950 p-4"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {metric.label}
              </p>
              <p className={`mt-1 text-xl font-semibold ${metric.accent}`}>
                {loadingOverview ? "…" : metric.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      {leaderboard.length > 0 ? (
        <section
          data-reveal
          className="reveal-block rounded-2xl border border-white/10 bg-slate-900/70 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Public advisor leaderboard
            </h2>
            <Link to="/feed" className="text-xs font-semibold text-violet-200">
              View feed
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {leaderboard.map((advisor, index) => (
              <div
                key={advisor.userId}
                className="rounded-xl border border-white/10 bg-slate-950 p-3"
              >
                <p className="text-xs text-slate-400">#{index + 1}</p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">
                  {advisor.displayName}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {advisor.level?.replaceAll("_", " ") || "Advisor"}
                </p>
                <p className="mt-1 text-xs text-violet-200">
                  Helpful {advisor.helpfulCount || 0}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        data-reveal
        className="reveal-block grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"
      >
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">
                High-signal threads now
              </h3>
              <p className="text-sm text-slate-300">
                Featured by quality, boosted by urgency, sorted for relevance.
              </p>
            </div>
            <Link
              to="/advice"
              className="text-xs font-semibold text-violet-200 hover:text-violet-100"
            >
              Open all →
            </Link>
          </div>

          <div className="space-y-3">
            {loadingOverview ? (
              <p className="text-sm text-slate-300">Loading highlights…</p>
            ) : null}

            {!loadingOverview && highlights.length === 0 ? (
              <p className="text-sm text-slate-300">No approved threads yet.</p>
            ) : null}

            {highlights.map((thread) => (
              <article
                key={thread.id}
                className="rounded-xl border border-white/10 bg-slate-950/80 p-4 transition duration-300 hover:border-violet-300/35"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {thread.title}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {thread.identityMode === "ANONYMOUS" || thread.isAnonymous ? (
                      <span className="rounded-full border border-slate-300/25 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                        Anonymous
                      </span>
                    ) : (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                        Public
                      </span>
                    )}
                    {thread.isBoostActive ? (
                      <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        Boosted
                      </span>
                    ) : null}
                    {thread.isFeatured ? (
                      <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        Featured
                      </span>
                    ) : null}
                    {thread.isLocked ? (
                      <span className="rounded-full border border-slate-300/25 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                        Locked
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                  {thread.body}
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  {thread.identityMode === "PUBLIC" ? (
                    <span className="inline-flex items-center gap-2">
                      {thread.author?.avatarUrl ? (
                        <img
                          src={thread.author.avatarUrl}
                          alt={thread.author?.name || "Profile"}
                          className="h-5 w-5 rounded-full border border-white/20 object-cover"
                        />
                      ) : null}
                      by {thread.author?.name || "Unknown"} • {formatRelativeTime(thread.createdAt)}
                    </span>
                  ) : (
                    <span>by Anonymous • {formatRelativeTime(thread.createdAt)}</span>
                  )}
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

        <Card>
          <h3 className="text-lg font-semibold text-white">Your momentum</h3>
          <p className="mt-1 text-sm text-slate-300">
            {user
              ? "Unread updates, followed threads, and your current activity."
              : "Sign in to unlock your personalized dashboard modules."}
          </p>

          {!user ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-300">
                Get personal momentum cards for watchlist, notifications, and
                conversations.
              </div>
              <Button to="/login" className="w-full justify-center">
                Sign in for dashboard
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Unread notifications
                </p>
                <p className="mt-1 text-2xl font-semibold text-cyan-200">
                  {loadingMomentum ? "…" : unreadCount.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Followed threads
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-200">
                  {loadingMomentum ? "…" : watchlist.length.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Your impact
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {loadingMomentum
                    ? "Syncing profile…"
                    : `${profile?.asks ?? 0} asks • ${
                        profile?.replies ?? 0
                      } replies • ${profile?.badgesCount ?? 0} badges`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  to="/notifications"
                  variant="secondary"
                  className="justify-center"
                >
                  Notifications
                </Button>
                <Button
                  to="/profile"
                  variant="secondary"
                  className="justify-center"
                >
                  Profile
                </Button>
              </div>

              {momentumError ? (
                <p className="text-xs text-amber-200">{momentumError}</p>
              ) : null}
            </div>
          )}
        </Card>
      </section>

      {user ? (
        <section data-reveal className="reveal-block grid gap-4 lg:grid-cols-3">
          <Card>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Watchlist activity
            </h4>
            <div className="mt-3 space-y-2">
              {loadingMomentum ? (
                <p className="text-sm text-slate-300">Loading watchlist…</p>
              ) : null}
              {!loadingMomentum && watchlist.length === 0 ? (
                <p className="text-sm text-slate-300">
                  Follow threads in Advice Center to build your watchlist.
                </p>
              ) : null}
              {watchlist.map((item) => (
                <Link
                  key={item.id}
                  to={`/advice/${item.id}`}
                  className="block rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-violet-300/30"
                >
                  <p className="line-clamp-1 font-medium text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.isBoostActive
                      ? "Boosted"
                      : item.isFeatured
                      ? "Featured"
                      : "Active"}
                  </p>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Unread notifications
            </h4>
            <div className="mt-3 space-y-2">
              {loadingMomentum ? (
                <p className="text-sm text-slate-300">Loading notifications…</p>
              ) : null}
              {!loadingMomentum && recentNotifications.length === 0 ? (
                <p className="text-sm text-slate-300">You are all caught up.</p>
              ) : null}
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
                >
                  <p className="line-clamp-1 text-sm font-medium text-white">
                    {notification.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                    {notification.body}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Recent conversations
            </h4>
            <div className="mt-3 space-y-2">
              {loadingMomentum ? (
                <p className="text-sm text-slate-300">Loading conversations…</p>
              ) : null}
              {!loadingMomentum && conversations.length === 0 ? (
                <p className="text-sm text-slate-300">
                  No conversations yet. Start one from Messages.
                </p>
              ) : null}
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
                >
                  <p className="line-clamp-1 text-sm font-medium text-white">
                    {conversation.participants.map((p) => p.name).join(", ")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                    {conversation.lastMessage?.body || "No messages yet"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section data-reveal className="reveal-block grid gap-4 lg:grid-cols-3">
        {trustSignals.map((signal) => (
          <Card key={signal.title} className="p-5">
            <h3 className="text-base font-semibold text-white">
              {signal.title}
            </h3>
            <p className="mt-2 text-sm text-slate-300">{signal.description}</p>
          </Card>
        ))}
      </section>

      <section
        data-reveal
        className="reveal-block rounded-2xl border border-violet-300/20 bg-violet-500/10 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-white">
              Have a high-stakes decision right now?
            </h4>
            <p className="text-sm text-violet-100/90">
              Start a thread and get structured feedback from members and
              moderators.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              to="/ask"
              className="bg-white text-violet-700 hover:bg-violet-100"
            >
              Start a thread
            </Button>
            <Button to="/advice" variant="secondary">
              Open advice center
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
