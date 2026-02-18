import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import Button from "../components/Button";
import Card from "../components/Card";
import {
  addAdviceComment,
  createAdvice,
  getAdviceDetail,
  listAdvice,
  moderateAdvice,
  moderationQueue,
  updateAdviceFlags,
} from "../services/api";
import { AdviceComment, AdviceItem, AdviceStatus } from "../types";
import { useAuth } from "../context/AuthContext";

export default function AdviceCenter() {
  const { user } = useAuth();
  const [adviceList, setAdviceList] = useState<AdviceItem[]>([]);
  const [selectedAdviceId, setSelectedAdviceId] = useState<string | null>(null);
  const [selectedComments, setSelectedComments] = useState<AdviceComment[]>([]);
  const [queue, setQueue] = useState<AdviceItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<AdviceStatus>("PENDING");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueActionId, setQueueActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitIsError, setSubmitIsError] = useState(false);
  const [submittingAdvice, setSubmittingAdvice] = useState(false);
  const submittingAdviceRef = useRef(false);

  const canModerate = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const selectedAdvice = useMemo(
    () => adviceList.find((item) => item.id === selectedAdviceId) || null,
    [adviceList, selectedAdviceId],
  );

  async function loadAdvice() {
    try {
      setLoading(true);
      setError(null);
      setQueueLoading(true);
      const [liveAdvice, liveQueue] = await Promise.all([
        listAdvice("APPROVED"),
        canModerate ? moderationQueue(queueStatus) : Promise.resolve([]),
      ]);
      setAdviceList(liveAdvice);
      setQueue(liveQueue);
    } catch {
      setError("Failed to load advice content.");
    } finally {
      setLoading(false);
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    loadAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canModerate, queueStatus]);

  useEffect(() => {
    if (!selectedAdviceId) return;
    getAdviceDetail(selectedAdviceId)
      .then((payload) => setSelectedComments(payload.comments))
      .catch(() => setSelectedComments([]));
  }, [selectedAdviceId]);

  async function onCreateAdvice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingAdviceRef.current) {
      return;
    }

    submittingAdviceRef.current = true;
    setSubmittingAdvice(true);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "");
    const body = String(form.get("body") || "");

    try {
      setSubmitMessage(null);
      setSubmitIsError(false);
      await createAdvice({ title, body });
      formElement.reset();
      setSubmitMessage("Submitted for approval. A moderator will review it.");
      await loadAdvice();
    } catch (err) {
      setSubmitIsError(true);
      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          setSubmitMessage("Your session expired. Please login again.");
          return;
        }
        if (err.response?.status === 400) {
          setSubmitMessage("Please check title/body length and try again.");
          return;
        }

        const apiMessage =
          typeof err.response?.data?.message === "string"
            ? err.response.data.message
            : null;

        if (err.response?.status) {
          setSubmitMessage(
            `Submission failed (${err.response.status})${
              apiMessage ? `: ${apiMessage}` : "."
            }`,
          );
          return;
        }
      }
      if (err instanceof Error && err.message) {
        setSubmitMessage(`Submission failed: ${err.message}`);
        return;
      }
      setSubmitMessage(
        "Submission failed. Please check backend connection and try again.",
      );
    } finally {
      submittingAdviceRef.current = false;
      setSubmittingAdvice(false);
    }
  }

  async function onComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAdviceId) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("body") || "");

    try {
      await addAdviceComment(selectedAdviceId, { body });
      formElement.reset();
      const detail = await getAdviceDetail(selectedAdviceId);
      setSelectedComments(detail.comments);
    } catch {
      setError("Comment failed. This advice may be locked by moderators.");
    }
  }

  async function onModerate(
    id: string,
    action: Exclude<AdviceStatus, "PENDING">,
  ) {
    try {
      setQueueActionId(id);
      await moderateAdvice(id, { action });
      await loadAdvice();
    } finally {
      setQueueActionId(null);
    }
  }

  async function onFlags(
    id: string,
    payload: { isLocked?: boolean; isFeatured?: boolean },
  ) {
    try {
      setQueueActionId(id);
      await updateAdviceFlags(id, payload);
      await loadAdvice();
    } finally {
      setQueueActionId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2">
        <Card>
          <h1 className="bg-gradient-to-r from-violet-200 to-cyan-200 bg-clip-text text-2xl font-bold text-transparent">
            Advice Section
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Publish advice requests. Posts are approved by moderators before
            public visibility.
          </p>

          {user ? (
            <form className="mt-4 space-y-3" onSubmit={onCreateAdvice}>
              <input
                name="title"
                required
                minLength={5}
                placeholder="Advice title"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <textarea
                name="body"
                required
                minLength={10}
                rows={4}
                placeholder="Write your advice request"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <Button
                type="submit"
                className={
                  submittingAdvice ? "pointer-events-none opacity-70" : ""
                }
              >
                {submittingAdvice ? "Submitting..." : "Submit for approval"}
              </Button>
              {submitMessage ? (
                <p
                  className={`text-sm ${
                    submitIsError ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {submitMessage}
                </p>
              ) : null}
            </form>
          ) : (
            <p className="mt-3 text-sm text-amber-200">
              Login to submit advice requests.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-white">
            Approved advice feed
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Featured advice appears first. Open any thread for full discussion.
          </p>
          {loading ? <p className="mt-3 text-slate-300">Loading…</p> : null}
          {error ? <p className="mt-3 text-rose-300">{error}</p> : null}

          <div className="mt-4 space-y-3">
            {adviceList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedAdviceId(item.id)}
                className="block w-full rounded-lg border border-white/10 bg-slate-950 p-4 text-left transition hover:border-violet-400/50"
              >
                <p className="text-base font-semibold text-white">
                  {item.title}
                  {item.isFeatured ? (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                      Featured
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-slate-300 line-clamp-2">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  by {item.author?.name || "Unknown"}
                </p>
                <div className="mt-2 text-xs text-violet-300">
                  <Link to={`/advice/${item.id}`}>Open full thread →</Link>
                </div>
              </button>
            ))}
            {!loading && adviceList.length === 0 ? (
              <p className="text-slate-400">No approved advice yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card>
          <h3 className="text-lg font-semibold text-white">Advice thread</h3>
          {selectedAdvice ? (
            <>
              <p className="mt-2 font-semibold text-white">
                {selectedAdvice.title}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {selectedAdvice.body}
              </p>
              {selectedAdvice.isLocked ? (
                <p className="mt-2 text-xs text-amber-200">
                  This thread is locked by moderators.
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                {selectedComments.map((comment) => (
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
                {selectedComments.length === 0 ? (
                  <p className="text-xs text-slate-400">No comments yet.</p>
                ) : null}
              </div>

              {user ? (
                <form className="mt-3 space-y-2" onSubmit={onComment}>
                  <input
                    name="body"
                    required
                    placeholder="Write a comment/reply"
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                  <Button type="submit" variant="secondary">
                    Add comment
                  </Button>
                </form>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              Select an advice post to view comments and replies.
            </p>
          )}
        </Card>

        {canModerate ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">
                Moderation queue
              </h3>
              <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
                {queueLoading ? "Loading…" : `${queue.length} items`}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["PENDING", "HOLD", "REMOVED"] as AdviceStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setQueueStatus(status)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                      queueStatus === status
                        ? "border-violet-300/50 bg-violet-500/20 text-violet-100"
                        : "border-white/10 bg-slate-950 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {status}
                  </button>
                ),
              )}
            </div>

            <div className="mt-3 space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-slate-950/90 p-4 shadow-lg shadow-slate-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug text-white">
                      {item.title}
                    </p>
                    <span className="rounded-md border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-200">
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                    {item.body}
                  </p>

                  <p className="mt-2 text-[11px] text-slate-400">
                    by {item.author?.name || "Unknown"}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => void onModerate(item.id, "APPROVED")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => void onModerate(item.id, "HOLD")}
                    >
                      Hold
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => void onModerate(item.id, "REMOVED")}
                    >
                      Remove
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        void onFlags(item.id, { isLocked: !item.isLocked })
                      }
                    >
                      {item.isLocked ? "Unlock" : "Lock"}
                    </Button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        void onFlags(item.id, {
                          isFeatured: !item.isFeatured,
                        })
                      }
                    >
                      {item.isFeatured ? "Unfeature" : "Feature"}
                    </Button>
                    <Link
                      to={`/advice/${item.id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-300/40 hover:text-white"
                    >
                      Open thread
                    </Link>
                  </div>

                  {queueActionId === item.id ? (
                    <p className="mt-2 text-[11px] text-violet-200">
                      Updating moderation…
                    </p>
                  ) : null}
                </div>
              ))}
              {!queueLoading && queue.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-slate-950 p-3 text-xs text-slate-400">
                  No advice in {queueStatus.toLowerCase()} state.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
