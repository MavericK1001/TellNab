import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import Button from "../components/Button";
import Card from "../components/Card";
import {
  addAdviceComment,
  createAdviceBoostCheckout,
  createAdvice,
  followAdviceThread,
  getAdviceDetail,
  listAdvice,
  listFollowedAdviceIds,
  listFollowingAdvice,
  moderateAdvice,
  moderationQueue,
  unfollowAdviceThread,
  updateAdviceFlags,
} from "../services/api";
import { AdviceComment, AdviceItem, AdviceStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import { useSeo } from "../utils/seo";

export default function AdviceCenter() {
  const { user } = useAuth();
  const [adviceList, setAdviceList] = useState<AdviceItem[]>([]);
  const [selectedAdviceId, setSelectedAdviceId] = useState<string | null>(null);
  const [selectedComments, setSelectedComments] = useState<AdviceComment[]>([]);
  const [replyTo, setReplyTo] = useState<AdviceComment | null>(null);
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
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<AdviceItem[]>([]);
  const [followActionId, setFollowActionId] = useState<string | null>(null);
  const [boostActionId, setBoostActionId] = useState<string | null>(null);

  useSeo({
    title: "Advice Threads - Ask and Discuss Real Decisions | TellNab",
    description:
      "Open advice threads, submit your own dilemma, and participate in moderated discussions on TellNab.",
    path: "/advice",
  });

  const canModerate = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const boostPriceUsd = Number(import.meta.env.VITE_BOOST_PRICE_USD || 4.99);
  const boostDurationDays = Number(
    import.meta.env.VITE_BOOST_DURATION_DAYS || 3,
  );

  const selectedAdvice = useMemo(
    () => adviceList.find((item) => item.id === selectedAdviceId) || null,
    [adviceList, selectedAdviceId],
  );

  async function loadAdvice() {
    try {
      setLoading(true);
      setError(null);
      setQueueLoading(true);
      const [liveAdvice, liveQueue, liveFollowIds, liveWatchlist] =
        await Promise.all([
          listAdvice("APPROVED"),
          canModerate ? moderationQueue(queueStatus) : Promise.resolve([]),
          user ? listFollowedAdviceIds() : Promise.resolve([]),
          user ? listFollowingAdvice() : Promise.resolve([]),
        ]);
      setAdviceList(liveAdvice);
      setQueue(liveQueue);
      setFollowedIds(liveFollowIds);
      setWatchlist(liveWatchlist);
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
  }, [canModerate, queueStatus, user?.id]);

  useEffect(() => {
    if (!selectedAdviceId) return;
    setReplyTo(null);
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
      await addAdviceComment(selectedAdviceId, {
        body,
        parentId: replyTo?.id,
      });
      formElement.reset();
      setReplyTo(null);
      const detail = await getAdviceDetail(selectedAdviceId);
      setSelectedComments(detail.comments);
    } catch {
      setError("Comment failed. This advice may be locked by moderators.");
    }
  }

  function renderThreadComments(
    comments: AdviceComment[],
    parentId: string | null,
    depth = 0,
  ): React.ReactNode {
    const children = comments.filter(
      (comment) => (comment.parentId || null) === parentId,
    );

    if (children.length === 0) {
      return null;
    }

    return children.map((comment) => (
      <div
        key={comment.id}
        className={`rounded-lg border border-white/10 bg-slate-950 p-3 ${
          depth > 0 ? "ml-4 mt-2" : ""
        }`}
      >
        <p className="text-sm text-slate-200">{comment.body}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">{comment.author.name}</p>
          {user ? (
            <button
              type="button"
              onClick={() => setReplyTo(comment)}
              className="text-xs font-semibold text-violet-300 hover:text-violet-200"
            >
              Reply
            </button>
          ) : null}
        </div>
        {renderThreadComments(comments, comment.id, depth + 1)}
      </div>
    ));
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
    payload: { isLocked?: boolean; isFeatured?: boolean; isSpam?: boolean },
  ) {
    try {
      setQueueActionId(id);
      await updateAdviceFlags(id, payload);
      await loadAdvice();
    } finally {
      setQueueActionId(null);
    }
  }

  async function onToggleFollow(adviceId: string) {
    if (!user) return;

    try {
      setFollowActionId(adviceId);
      if (followedIds.includes(adviceId)) {
        await unfollowAdviceThread(adviceId);
      } else {
        await followAdviceThread(adviceId);
      }

      const [liveFollowIds, liveWatchlist] = await Promise.all([
        listFollowedAdviceIds(),
        listFollowingAdvice(),
      ]);
      setFollowedIds(liveFollowIds);
      setWatchlist(liveWatchlist);
    } finally {
      setFollowActionId(null);
    }
  }

  async function onBoost(adviceId: string) {
    try {
      setBoostActionId(adviceId);
      await createAdviceBoostCheckout(adviceId);
      setSubmitIsError(false);
      setSubmitMessage(
        "Boost activated. Your thread is prioritized in listing order.",
      );
      await loadAdvice();
    } catch (err) {
      setSubmitIsError(true);
      if (
        isAxiosError(err) &&
        typeof err.response?.data?.message === "string"
      ) {
        setSubmitMessage(err.response.data.message);
        return;
      }
      setSubmitMessage("Boost checkout failed. Please try again.");
    } finally {
      setBoostActionId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2">
        <Card className="rounded-3xl border-white/15 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10">
          <h1 className="bg-gradient-to-r from-violet-200 to-cyan-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
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
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <textarea
                name="body"
                required
                minLength={10}
                rows={4}
                placeholder="Write your advice request"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
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

        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
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
                className="block w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-left transition hover:border-violet-400/50"
              >
                <p className="text-base font-semibold text-white">
                  {item.title}
                  {item.isBoostActive ? (
                    <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">
                      Boosted
                    </span>
                  ) : null}
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

                {user ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleFollow(item.id)}
                      disabled={followActionId === item.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        followedIds.includes(item.id)
                          ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                          : "border-violet-300/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                      } ${followActionId === item.id ? "opacity-70" : ""}`}
                    >
                      {followActionId === item.id
                        ? "Updating..."
                        : followedIds.includes(item.id)
                        ? "Following"
                        : "Follow thread"}
                    </button>
                    {item.author?.id === user.id &&
                    item.status === "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() => void onBoost(item.id)}
                        disabled={
                          boostActionId === item.id || item.isBoostActive
                        }
                        className={`rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 ${
                          boostActionId === item.id || item.isBoostActive
                            ? "cursor-not-allowed opacity-70"
                            : ""
                        }`}
                      >
                        {item.isBoostActive
                          ? "Boost active"
                          : boostActionId === item.id
                          ? "Boosting..."
                          : `Boost $${boostPriceUsd.toFixed(
                              2,
                            )}/${boostDurationDays}d`}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </button>
            ))}
            {!loading && adviceList.length === 0 ? (
              <p className="text-slate-400">No approved advice yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
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
              {selectedAdvice.isBoostActive ? (
                <p className="mt-2 text-xs text-rose-200">
                  Boost active until{" "}
                  {selectedAdvice.boostExpiresAt
                    ? new Date(selectedAdvice.boostExpiresAt).toLocaleString()
                    : "soon"}
                  .
                </p>
              ) : null}
              {user && selectedAdvice.author?.id === user.id ? (
                <button
                  type="button"
                  onClick={() => void onBoost(selectedAdvice.id)}
                  disabled={
                    boostActionId === selectedAdvice.id ||
                    selectedAdvice.isBoostActive
                  }
                  className={`mt-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 ${
                    boostActionId === selectedAdvice.id ||
                    selectedAdvice.isBoostActive
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  }`}
                >
                  {selectedAdvice.isBoostActive
                    ? "Boost active"
                    : boostActionId === selectedAdvice.id
                    ? "Boosting..."
                    : `Boost this thread for $${boostPriceUsd.toFixed(
                        2,
                      )}/${boostDurationDays}d`}
                </button>
              ) : null}

              <div className="mt-4 space-y-2">
                {renderThreadComments(selectedComments, null)}
                {selectedComments.length === 0 ? (
                  <p className="text-xs text-slate-400">No comments yet.</p>
                ) : null}
              </div>

              {user ? (
                <>
                  {replyTo ? (
                    <div className="mt-3 rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2">
                      <p className="text-xs text-violet-100">
                        Replying to{" "}
                        <span className="font-semibold">
                          {replyTo.author.name}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="mt-1 text-xs font-semibold text-violet-200 hover:text-violet-100"
                      >
                        Cancel reply
                      </button>
                    </div>
                  ) : null}

                  <form className="mt-3 space-y-2" onSubmit={onComment}>
                    <input
                      name="body"
                      required
                      placeholder={
                        replyTo ? "Write your reply" : "Write a comment/reply"
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                    />
                    <Button type="submit" variant="secondary">
                      {replyTo ? "Reply" : "Add comment"}
                    </Button>
                  </form>
                </>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              Select an advice post to view comments and replies.
            </p>
          )}
        </Card>

        {user ? (
          <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
            <h3 className="text-lg font-semibold text-white">Your watchlist</h3>
            <p className="mt-1 text-xs text-slate-400">
              Followed threads you want to revisit.
            </p>

            <div className="mt-3 space-y-2">
              {watchlist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-slate-950 p-3"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                    {item.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Link
                      to={`/advice/${item.id}`}
                      className="text-xs font-semibold text-violet-200 hover:text-violet-100"
                    >
                      Open thread
                    </Link>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-200 hover:text-rose-100"
                      onClick={() => void onToggleFollow(item.id)}
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              ))}

              {watchlist.length === 0 ? (
                <p className="text-xs text-slate-400">
                  You are not following any thread yet.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {canModerate ? (
          <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
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
                    className={`rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${
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

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        void onFlags(item.id, {
                          isSpam: !item.isSpam,
                        })
                      }
                    >
                      {item.isSpam ? "Mark clean" : "Mark spam"}
                    </Button>
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
