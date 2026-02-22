import React, { FormEvent, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation } from "react-router-dom";
import Button from "../components/Button";
import IdentityModeSelector from "../components/IdentityModeSelector";
import { useAuth } from "../context/AuthContext";
import {
  createAdvice,
  generateAdviceDraftWithAi,
  listCategories,
} from "../services/api";
import { CategoryItem } from "../types";
import { useSeo } from "../utils/seo";

function parseApiError(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;

  const data = error.response?.data as
    | {
        message?: string;
        error?: { message?: string };
      }
    | undefined;

  return data?.error?.message || data?.message || fallback;
}

export default function Ask() {
  const { user } = useAuth();
  const location = useLocation();
  const phaseUrgentMode =
    String(import.meta.env.VITE_PHASE1_URGENT_MODE || "false").toLowerCase() ===
    "true";
  const phaseSmartMatching =
    String(
      import.meta.env.VITE_PHASE1_SMART_MATCHING || "false",
    ).toLowerCase() === "true";

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [identityMode, setIdentityMode] = useState<"ANONYMOUS" | "PUBLIC">(
    "ANONYMOUS",
  );
  const [categoryId, setCategoryId] = useState("");
  const [targetTone, setTargetTone] = useState<
    "balanced" | "direct" | "empathetic"
  >("balanced");
  const [targetAudience, setTargetAudience] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [postLanguage, setPostLanguage] = useState<
    "ENGLISH" | "URDU" | "ROMAN_URDU"
  >("ENGLISH");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  React.useEffect(() => {
    listCategories()
      .then((loaded) => {
        setCategories(loaded);
        setCategoryId((current) => current || loaded[0]?.id || "");
      })
      .catch(() => setCategories([]));
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const identity = String(params.get("identity") || "").toUpperCase();
    if (identity === "PUBLIC") {
      setIdentityMode("PUBLIC");
    }
  }, [location.search]);

  useSeo({
    title: "Instant Ask Flow - Anonymous Advice | TellNab",
    description:
      "Share your situation in 3 simple steps and get honest advice from real people across Pakistan.",
    path: "/ask",
  });

  const localizedCategoryLabels = useMemo(
    () => [
      "Career",
      "Freelancing",
      "CSS & Govt Jobs",
      "Abroad / Visa",
      "Rishta & Marriage",
      "University / Students",
      "Business",
      "Family Issues",
    ],
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatus(null);

    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);

      const withLanguageTag = Array.from(
        new Set([
          ...tags,
          `lang:${postLanguage.toLowerCase().replaceAll("_", "-")}`,
        ]),
      ).slice(0, 12);

      await createAdvice({
        title,
        body: question,
        categoryId: categoryId || undefined,
        identityMode: "ANONYMOUS",
        ...(phaseSmartMatching
          ? {
              tags: withLanguageTag,
              targetAudience: targetAudience.trim() || undefined,
            }
          : { tags: withLanguageTag }),
        ...(phaseUrgentMode ? { isUrgent } : {}),
      });
      setStatus(
        "Your anonymous post is live in moderation. People are viewing your problem. New advice coming in.",
      );
      setTitle("");
      setQuestion("");
      setIsUrgent(false);
      setTagsInput("");
      setTargetAudience("");
      setAiSuggestions([]);
      setAiProvider(null);
      setPostLanguage("ENGLISH");
      if (!user) {
        setShowSignupPrompt(true);
      }
      if (categories[0]?.id) {
        setCategoryId(categories[0].id);
      }
    } catch (error) {
      setStatus(parseApiError(error, "Submission failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleAiDraft() {
    if (question.trim().length < 20) {
      setStatus(
        "Add a bit more context (at least 20 chars) before using AI assist.",
      );
      return;
    }

    setAiLoading(true);
    setStatus(null);

    try {
      const result = await generateAdviceDraftWithAi({
        title,
        question,
        targetTone,
        anonymous: identityMode === "ANONYMOUS",
      });

      setTitle(result.draftTitle || title);
      setQuestion(result.draftBody || question);
      setAiSuggestions(result.suggestions || []);
      setAiProvider(result.provider || null);
      setStatus("AI draft generated. Review before publishing.");
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setStatus("Please login first to use AI assist.");
      } else {
        setStatus(parseApiError(error, "AI assist failed. Please try again."));
      }
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Instant Ask Flow
          </h2>
          <p className="mb-4 text-sm text-violet-100">
            Step 1: Select category • Step 2: Write your situation • Step 3:
            Post anonymously
          </p>

          <IdentityModeSelector value={"ANONYMOUS"} onChange={() => null} />

          <p className="mb-6 text-sm leading-6 text-slate-300">
            No signup required to post. Share context clearly to get better,
            faster responses.
          </p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-200">
                Title
              </label>
              <input
                type="text"
                name="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring"
                placeholder="e.g. Should I quit my job without a backup?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Step 1 — Category
              </label>
              <select
                name="categoryId"
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 focus:ring"
              >
                {categories.length === 0 ? (
                  <option value="">Loading categories…</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>

              {categories.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const active = categoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryId(category.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          active
                            ? "border-violet-300/70 bg-violet-500/20 text-violet-100"
                            : "border-white/15 bg-slate-900/65 text-slate-300 hover:border-white/30"
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {localizedCategoryLabels.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Language
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { key: "ENGLISH", label: "English" },
                  { key: "URDU", label: "Urdu" },
                  { key: "ROMAN_URDU", label: "Roman Urdu" },
                ].map((language) => {
                  const active = postLanguage === language.key;
                  return (
                    <button
                      key={language.key}
                      type="button"
                      onClick={() =>
                        setPostLanguage(
                          language.key as "ENGLISH" | "URDU" | "ROMAN_URDU",
                        )
                      }
                      className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                        active
                          ? "border-violet-300/70 bg-violet-500/20 text-violet-100"
                          : "border-white/15 bg-slate-900/65 text-slate-300 hover:border-white/30"
                      }`}
                    >
                      {language.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {phaseUrgentMode ? (
              <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3">
                <label className="inline-flex items-center gap-2 text-sm text-rose-100">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(event) => setIsUrgent(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950"
                  />
                  Mark this question as urgent
                </label>
              </div>
            ) : null}

            {phaseSmartMatching ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring"
                    placeholder="career, startup, stress"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Target audience (optional)
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring"
                    placeholder="Students, founders, new parents"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Step 2 — Write your situation
              </label>
              <textarea
                rows={7}
                name="question"
                required
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring"
                placeholder="What's on your mind?"
              ></textarea>
            </div>

            <div className="rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/12 to-cyan-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    TellNab AI Draft Assist
                  </p>
                  <p className="text-xs text-violet-100/90">
                    Generate a clearer draft and keep your tone intentional.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAiDraft}
                  disabled={aiLoading || question.trim().length < 20}
                >
                  {aiLoading ? "Generating..." : "Generate AI draft"}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-300">Tone</span>
                {(["balanced", "direct", "empathetic"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setTargetTone(tone)}
                    className={`rounded-xl border px-2.5 py-1 text-xs transition ${
                      targetTone === tone
                        ? "border-violet-300/70 bg-violet-400/25 text-violet-100"
                        : "border-white/15 bg-slate-900/60 text-slate-300 hover:border-white/25"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
                {aiProvider ? (
                  <span className="ml-auto text-xs text-slate-400">
                    Provider: {aiProvider}
                  </span>
                ) : null}
              </div>

              {aiSuggestions.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {aiSuggestions.map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pb-20 md:pb-0">
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary">
                  Preview
                </Button>
                <Button type="submit" className={loading ? "opacity-70" : ""}>
                  {loading ? "Posting..." : "Step 3 — Post anonymously"}
                </Button>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-14 z-20 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur md:hidden">
              <Button
                type="submit"
                className={`w-full ${loading ? "opacity-70" : ""}`}
              >
                {loading ? "Posting..." : "Ask for Advice"}
              </Button>
            </div>

            {status ? (
              <p className="text-sm text-emerald-300">{status}</p>
            ) : null}

            {showSignupPrompt ? (
              <div className="rounded-2xl border border-violet-300/30 bg-violet-500/15 p-4">
                <p className="text-sm font-semibold text-violet-100">
                  Your question is submitted. Create an account to track
                  replies, save threads, and get notifications.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button to="/register">Continue with Signup</Button>
                  <Link
                    to="/advice"
                    className="inline-flex items-center rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    View advice feed
                  </Link>
                </div>
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/75 to-slate-900/55 p-5">
          <h3 className="font-semibold text-white">Get better answers</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Share concrete context</li>
            <li>Ask one clear question</li>
            <li>Say what outcome you want</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/15 to-cyan-500/10 p-5">
          <h3 className="font-semibold text-white">Reminder</h3>
          <p className="mt-2 text-sm text-violet-100/90">
            Unfiltered does not mean abusive. Keep it respectful.
          </p>
        </div>
      </aside>
    </div>
  );
}
