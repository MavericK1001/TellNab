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

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10 p-6 shadow-2xl shadow-slate-950/40 sm:p-9">
        <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">
          Pakistan’s First Anonymous Advice Platform for Real-Life Decisions
        </h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          Ask anything about career, rishta, studies, business or life — get
          honest advice from real people.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button to="/ask" className="rounded-xl px-5 py-3">
            Ask for Advice
          </Button>
          <Button
            to="/feed"
            variant="secondary"
            className="rounded-xl px-5 py-3"
          >
            Give Advice
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="text-lg font-semibold text-white">Latest Questions</h3>
          <div className="mt-3 space-y-2">
            {latestQuestions.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                to={`/advice/${item.id}`}
                className="block rounded-xl border border-white/10 bg-slate-950 p-3 hover:border-violet-300/35"
              >
                <p className="line-clamp-1 text-sm font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {item.category?.name || "General"}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
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
              : LOCALIZED_CATEGORIES.slice(0, 6).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
                  >
                    {topic}
                  </span>
                ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white">
            Recently Answered
          </h3>
          <div className="mt-3 space-y-2">
            {recentlyAnswered.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                to={`/advice/${item.id}`}
                className="block rounded-xl border border-white/10 bg-slate-950 p-3 hover:border-emerald-300/35"
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

      <section className="grid gap-3 md:grid-cols-3">
        {["100% Anonymous", "Moderated Advice", "Built for Pakistan"].map(
          (label) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/60 p-5 text-center"
            >
              <p className="text-base font-semibold text-white">{label}</p>
            </div>
          ),
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h3 className="text-lg font-semibold text-white">Success Stories</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-violet-300/25 bg-violet-500/10 p-5">
          <p className="text-sm font-semibold text-violet-100">
            {SUCCESS_STORIES[storyIndex].title}
          </p>
          <p className="mt-2 text-sm text-violet-50/90">
            {SUCCESS_STORIES[storyIndex].detail}
          </p>
          <div className="mt-3 flex gap-1">
            {SUCCESS_STORIES.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setStoryIndex(index)}
                className={`h-2 w-6 rounded-full ${
                  storyIndex === index ? "bg-violet-200" : "bg-violet-300/35"
                }`}
                aria-label={`Story ${index + 1}`}
              />
            ))}
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
