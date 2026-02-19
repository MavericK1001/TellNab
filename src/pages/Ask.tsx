import React, { FormEvent, useState } from "react";
import { isAxiosError } from "axios";
import Button from "../components/Button";
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
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [targetTone, setTargetTone] = useState<
    "balanced" | "direct" | "empathetic"
  >("balanced");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  React.useEffect(() => {
    listCategories()
      .then((loaded) => {
        setCategories(loaded);
        setCategoryId((current) => current || loaded[0]?.id || "");
      })
      .catch(() => setCategories([]));
  }, []);

  useSeo({
    title: "Ask for Advice - Post Your Dilemma | TellNab",
    description:
      "Post your question anonymously and get direct, moderated advice from the TellNab community.",
    path: "/ask",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatus(null);

    try {
      await createAdvice({
        title,
        body: `[Anonymous: ${anonymous ? "Yes" : "No"}]\n\n${question}`,
        categoryId: categoryId || undefined,
      });
      setStatus(
        "Question submitted for moderation. You can track it in Advice.",
      );
      setTitle("");
      setQuestion("");
      setAnonymous(true);
      setAiSuggestions([]);
      setAiProvider(null);
      if (categories[0]?.id) {
        setCategoryId(categories[0].id);
      }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setStatus("Please login first to submit your question.");
      } else {
        setStatus(parseApiError(error, "Submission failed. Please try again."));
      }
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
        anonymous,
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
            Ask for unfiltered advice
          </h2>
          <p className="mb-6 text-sm leading-6 text-slate-300">
            Write clearly, keep it short, and include enough context for better
            responses.
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
                Category
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Question
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="anonymous"
                  checked={anonymous}
                  onChange={(event) => setAnonymous(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                />
                Post anonymously
              </label>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary">
                  Preview
                </Button>
                <Button type="submit" className={loading ? "opacity-70" : ""}>
                  {loading ? "Publishing..." : "Publish question"}
                </Button>
              </div>
            </div>

            {status ? (
              <p className="text-sm text-emerald-300">{status}</p>
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
