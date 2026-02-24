import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { getHomeOverview, listPublicFeed } from "../services/api";
import { AdviceItem, HomeOverview } from "../types";
import { useSeo } from "../utils/seo";

const SUCCESS_STORIES = [
  {
    title: "Career switch success",
    detail:
      "A software engineer moved from support to product after advice on portfolio positioning.",
  },
  {
    title: "Rishta clarity",
    detail:
      "A user received practical family communication tips and resolved a long-standing rishta conflict.",
  },
  {
    title: "Freelancing breakthrough",
    detail:
      "An early freelancer used pricing advice and secured consistent international clients.",
  },
];

const LOCALIZED_CATEGORIES = [
  "Career",
  "Freelancing",
  "CSS & Govt Jobs",
  "Abroad / Visa",
  "Rishta & Marriage",
  "University / Students",
  "Business",
  "Family Issues",
];

const TRUST_PILLARS = [
  {
    title: "Identity-aware trust",
    detail:
      "Badges, role signals, and moderation help surface credible voices without exposing your identity.",
  },
  {
    title: "Actionable responses",
    detail:
      "Advice is practical, local, and optimized for real decisions—not generic internet noise.",
  },
  {
    title: "Calm, private space",
    detail:
      "People can ask hard questions safely, from career and studies to family and relationships.",
  },
  {
    title: "Pakistan-first relevance",
    detail:
      "Cultural and regional context is built into topic flow, moderation, and advisor perspective.",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Ask anonymously",
    detail:
      "Post your question in seconds with no social pressure and full identity privacy.",
  },
  {
    title: "Get trusted guidance",
    detail:
      "Receive practical responses from people who have solved similar problems.",
  },
  {
    title: "Move with clarity",
    detail:
      "Use advice summaries and helpful answers to decide your next best step.",
  },
];

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default function Home() {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestQuestions, setLatestQuestions] = useState<AdviceItem[]>([]);
  const [recentlyAnswered, setRecentlyAnswered] = useState<AdviceItem[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);

  useSeo({
    title: "TellNab - Anonymous Advice Platform for Pakistan",
    description:
      "Ask anything about career, rishta, studies, business or life and get honest advice from real people.",
    path: "/",
  });

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      getHomeOverview(),
      listPublicFeed({ sort: "LATEST", limit: 8 }),
      listPublicFeed({ sort: "TRENDING", limit: 8 }),
    ])
      .then(([overviewRes, latestRes, answeredRes]) => {
        if (!mounted) return;

        if (overviewRes.status === "fulfilled") {
          setOverview(overviewRes.value);
          setLatestQuestions(overviewRes.value.latestQuestions || []);
          setRecentlyAnswered(overviewRes.value.recentlyAnswered || []);
        }

        if (latestRes.status === "fulfilled" && latestRes.value.items.length) {
          setLatestQuestions((prev) =>
            prev.length ? prev : latestRes.value.items.slice(0, 6),
          );
        }

        if (
          answeredRes.status === "fulfilled" &&
          answeredRes.value.items.length
        ) {
          setRecentlyAnswered((prev) =>
            prev.length
              ? prev
              : answeredRes.value.items
                  .filter((item) => Number(item.helpfulCount || 0) > 0)
                  .slice(0, 6),
          );
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStoryIndex((current) => (current + 1) % SUCCESS_STORIES.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, []);

  const heroStats = [
    {
      label: "Questions asked",
      value:
        overview?.metrics.questionsAsked ??
        overview?.metrics.approvedThreads ??
        0,
    },
    {
      label: "Answers given",
      value:
        overview?.metrics.answersGiven ?? overview?.metrics.totalComments ?? 0,
    },
    {
      label: "Active advisors",
      value: overview?.metrics.activeAdvisors ?? 0,
    },
  ];

  const trendingTopics = useMemo(
    () => overview?.trendingTopics || [],
    [overview?.trendingTopics],
  );

  const topLatestQuestion = latestQuestions[0];
  const topAnsweredQuestion = recentlyAnswered[0];

  return (
    <div className="space-y-7 pb-4">
      <section className="premium-glass overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/18 via-slate-900/80 to-cyan-500/14 p-6 shadow-2xl shadow-slate-950/55 sm:p-9">
        <div className="grid gap-6 lg:grid-cols-5 lg:items-end">
          <div className="space-y-5 lg:col-span-3">
            <div className="inline-flex items-center rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100">
              Trusted anonymous advice network for Pakistan
            </div>
            <h1 className="text-3xl font-black leading-[1.05] text-white sm:text-5xl">
              The safest place to ask real-life questions and get real answers.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
              TellNab combines privacy, moderation, and practical local context
              so people can make better decisions in career, studies, family,
              relationships, and business.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button to="/ask" className="rounded-xl px-5 py-3">
                Ask for Advice
              </Button>
              <Button
                to="/feed"
                variant="secondary"
                className="rounded-xl px-5 py-3"
              >
                Explore Community Feed
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/15 bg-slate-950/70 p-4"
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-violet-100">
                    {loading ? "…" : compactNumber(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <Card className="rounded-2xl border border-violet-300/20 bg-slate-950/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-200/90">
                Community outcome spotlight
              </p>
              <p className="mt-2 text-base font-semibold text-white">
                {SUCCESS_STORIES[storyIndex].title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {SUCCESS_STORIES[storyIndex].detail}
              </p>
              <div className="mt-4 flex gap-1.5">
                {SUCCESS_STORIES.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setStoryIndex(index)}
                    className={`ui-interactive h-2 w-6 rounded-full ${
                      storyIndex === index
                        ? "bg-violet-200"
                        : "bg-violet-300/35"
                    }`}
                    aria-label={`Story ${index + 1}`}
                  />
                ))}
              </div>
            </Card>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {[
                "Anonymous by default",
                "Human-moderated responses",
                "Contextual, Pakistan-first advice",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {HOW_IT_WORKS.map((item, index) => (
          <Card key={item.title} className="rounded-2xl">
            <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-violet-200/30 bg-violet-500/15 px-2 text-xs font-semibold text-violet-100">
              {index + 1}
            </div>
            <p className="mt-3 text-base font-semibold text-white">
              {item.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {item.detail}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">
              Latest Questions
            </h3>
            <Link
              to="/feed"
              className="ui-interactive text-xs font-semibold uppercase tracking-[0.08em] text-violet-200 hover:text-violet-100"
            >
              See all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {latestQuestions.slice(0, 5).map((item, index) => (
              <Link
                key={item.id}
                to={`/advice/${item.id}`}
                className="ui-interactive block rounded-xl border border-white/10 bg-slate-950 p-3 hover:border-violet-300/35"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  {index === 0 && (
                    <span className="rounded-md border border-violet-300/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {item.category?.name || "General"}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="text-lg font-semibold text-white">Trending Topics</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {trendingTopics.length > 0
              ? trendingTopics.map((topic) => (
                  <span
                    key={topic.id}
                    className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
                  >
                    {topic.name} ({topic.count})
                  </span>
                ))
              : LOCALIZED_CATEGORIES.slice(0, 8).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
                  >
                    {topic}
                  </span>
                ))}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <h3 className="text-lg font-semibold text-white">
            Recently Answered
          </h3>
          <div className="mt-3 space-y-2">
            {recentlyAnswered.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                to={`/advice/${item.id}`}
                className="ui-interactive block rounded-xl border border-white/10 bg-slate-950 p-3 hover:border-emerald-300/35"
              >
                <p className="line-clamp-1 text-sm font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-emerald-200">
                  Helpful {item.helpfulCount || 0}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TRUST_PILLARS.map((item) => (
          <Card key={item.title} className="rounded-2xl">
            <p className="text-base font-semibold text-white">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {item.detail}
            </p>
          </Card>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/90">
              Live community pulse
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white">
              Ask now, get guidance fast.
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Your question can reach advisors and experienced peers quickly in
              a trusted, anonymous environment.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LOCALIZED_CATEGORIES.slice(0, 6).map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-4">
            <p className="text-xs uppercase tracking-[0.11em] text-violet-200/80">
              Right now on TellNab
            </p>
            <p className="line-clamp-1 text-sm font-semibold text-white">
              {topLatestQuestion?.title || "New questions are coming in now"}
            </p>
            <p className="line-clamp-1 text-xs text-slate-300">
              {topAnsweredQuestion?.title ||
                "Helpful responses are being shared by the community"}
            </p>
            <div className="pt-2">
              <Button
                to="/ask"
                className="w-full justify-center rounded-xl py-2.5"
              >
                Ask Anonymously
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Link
        to="/ask"
        className="fixed bottom-20 right-5 z-30 inline-flex items-center justify-center rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/50 md:hidden"
      >
        Ask for Advice
      </Link>
    </div>
  );
}
