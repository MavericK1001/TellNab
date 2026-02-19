import React, { FormEvent, useState } from "react";
import { isAxiosError } from "axios";
import Button from "../components/Button";
import { createAdvice, listCategories } from "../services/api";
import { CategoryItem } from "../types";
import { useSeo } from "../utils/seo";

export default function Ask() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  React.useEffect(() => {
    listCategories()
      .then(setCategories)
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
    const formData = new FormData(event.currentTarget);

    setLoading(true);
    setStatus(null);

    const title = String(formData.get("title") || "");
    const categoryId = String(formData.get("categoryId") || "");
    const question = String(formData.get("question") || "");
    const anonymous = formData.get("anonymous") === "on";

    try {
      await createAdvice({
        title,
        body: `[Anonymous: ${anonymous ? "Yes" : "No"}]\n\n${question}`,
        categoryId: categoryId || undefined,
      });
      setStatus(
        "Question submitted for moderation. You can track it in Advice.",
      );
      event.currentTarget.reset();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setStatus("Please login first to submit your question.");
      } else {
        setStatus("Submission failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="mb-2 text-2xl font-bold text-white">
            Ask for unfiltered advice
          </h2>
          <p className="mb-6 text-sm text-slate-300">
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
                className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring"
                placeholder="What's on your mind?"
              ></textarea>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="anonymous"
                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                  defaultChecked
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="font-semibold text-white">Get better answers</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Share concrete context</li>
            <li>Ask one clear question</li>
            <li>Say what outcome you want</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-5">
          <h3 className="font-semibold text-white">Reminder</h3>
          <p className="mt-2 text-sm text-violet-100/90">
            Unfiltered does not mean abusive. Keep it respectful.
          </p>
        </div>
      </aside>
    </div>
  );
}
