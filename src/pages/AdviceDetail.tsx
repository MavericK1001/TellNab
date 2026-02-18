import React, { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import { addAdviceComment, getAdviceDetail } from "../services/api";
import { AdviceComment, AdviceItem } from "../types";
import { useAuth } from "../context/AuthContext";

export default function AdviceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [advice, setAdvice] = useState<AdviceItem | null>(null);
  const [comments, setComments] = useState<AdviceComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      setError(null);
      const data = await getAdviceDetail(id);
      setAdvice(data.advice);
      setComments(data.comments);
    } catch {
      setError(
        "Unable to open this advice. It may still be pending or removed.",
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "");

    try {
      await addAdviceComment(id, { body });
      event.currentTarget.reset();
      await load();
    } catch {
      setError("Comment failed. Thread might be locked.");
    }
  }

  if (error) {
    return (
      <Card>
        <p className="text-rose-300">{error}</p>
      </Card>
    );
  }

  if (!advice) {
    return (
      <Card>
        <p className="text-slate-300">Loading advice…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-2xl font-bold text-white">{advice.title}</h1>
        <p className="mt-2 text-slate-300">{advice.body}</p>
        <p className="mt-2 text-xs text-slate-400">
          by {advice.author?.name || "Unknown"}
        </p>
        {advice.isLocked ? (
          <p className="mt-2 text-xs text-amber-200">Thread is locked.</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Comments</h2>
        <div className="mt-3 space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-white/10 bg-slate-950 p-3"
            >
              <p className="text-sm text-slate-200">{comment.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {comment.author.name}
              </p>
            </div>
          ))}
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400">No comments yet.</p>
          ) : null}
        </div>

        {user ? (
          <form className="mt-4 flex gap-2" onSubmit={onComment}>
            <input
              name="body"
              required
              placeholder="Write a comment"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <Button type="submit" variant="secondary">
              Comment
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
