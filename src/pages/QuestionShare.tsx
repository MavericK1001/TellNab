import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import { getPublicQuestionShare } from "../services/api";
import { PublicQuestionShare } from "../types";
import { useSeo } from "../utils/seo";

export default function QuestionShare() {
  const { id } = useParams();
  const [data, setData] = useState<PublicQuestionShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getPublicQuestionShare(id)
      .then(setData)
      .catch(() => setError("Question unavailable."));
  }, [id]);

  useSeo({
    title: data ? `${data.question.title} | TellNab` : "TellNab Question",
    description: data
      ? data.question.body.slice(0, 155)
      : "Anonymous question on TellNab",
    path: id ? `/q/${id}` : "/q",
    image: data?.share.ogImageUrl,
  });

  if (error) {
    return (
      <Card>
        <p className="text-rose-300">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p className="text-slate-300">Loading question…</p>
      </Card>
    );
  }

  const question = data.question;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-white/15 bg-gradient-to-b from-slate-900/82 to-slate-900/65">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">
          Anonymous TellNab Question
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">{question.title}</h1>
        {question.isUrgent ? (
          <span className="mt-3 inline-flex rounded-full border border-rose-300/35 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100">
            Urgent
          </span>
        ) : null}
        <p className="mt-3 text-sm text-slate-300">{question.body}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          {question.category?.name ? (
            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1">
              {question.category.name}
            </span>
          ) : null}
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
            Replies {question.replyCount}
          </span>
        </div>
      </Card>

      <Link
        to={data.ctaUrl}
        className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white"
      >
        Answer on TellNab
      </Link>
    </div>
  );
}
