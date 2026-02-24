import React, { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import UserIdentityDisplay from "../components/UserIdentityDisplay";
import {
  addAdviceComment,
  convertAdviceToPublic,
  createAdviceBoostCheckout,
  deleteAdviceCommentAsModerator,
  deleteMyAdviceComment,
  followAdviceThread,
  generateCommentDraftWithAi,
  getAdviceDetail,
  getQuestionShareMeta,
  moderateAdvice,
  uploadMedia,
  unfollowAdviceThread,
  updateAdviceFlags,
} from "../services/api";
import { AdviceComment, AdviceItem, AdviceStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import { buildSupportRequestUrl } from "../utils/support";
import { useSeo } from "../utils/seo";

export default function AdviceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [advice, setAdvice] = useState<AdviceItem | null>(null);
  const [comments, setComments] = useState<AdviceComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<AdviceComment | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [commentAiLoading, setCommentAiLoading] = useState(false);
  const [commentAiSuggestions, setCommentAiSuggestions] = useState<string[]>(
    [],
  );
  const [commentAiProvider, setCommentAiProvider] = useState<string | null>(
    null,
  );
  const [followPending, setFollowPending] = useState(false);
  const [boostPending, setBoostPending] = useState(false);
  const [boostMessage, setBoostMessage] = useState<string | null>(null);
  const [moderationPending, setModerationPending] = useState(false);
  const [convertingIdentity, setConvertingIdentity] = useState(false);
  const [moderationMessage, setModerationMessage] = useState<string | null>(
    null,
  );
  const [shareMeta, setShareMeta] = useState<{
    shareUrl: string;
    whatsappUrl: string;
  } | null>(null);
  const boostPriceUsd = Number(import.meta.env.VITE_BOOST_PRICE_USD || 4.99);
  const isModeratorOrAdmin =
    user?.role === "ADMIN" || user?.role === "MODERATOR";

  const boostDurationDays = Number(
    import.meta.env.VITE_BOOST_DURATION_DAYS || 3,
  );
  const reportThreadUrl = id
    ? buildSupportRequestUrl({
        type: "ABUSE",
        subject: "Report thread",
        adviceId: id,
      })
    : null;

  function parseApiError(err: unknown, fallback: string) {
    if (typeof err === "object" && err && "response" in err) {
      const response = (
        err as {
          response?: {
            data?: { message?: string };
          };
        }
      ).response;

      if (response?.data?.message) {
        return response.data.message;
      }
    }
    return fallback;
  }

  useSeo({
    title: advice
      ? `${advice.title} | TellNab Advice Thread`
      : "Advice Thread | TellNab",
    description: advice
      ? advice.body.slice(0, 155)
      : "Read real advice thread discussions on TellNab.",
    path: id ? `/advice/${id}` : "/advice",
    structuredData:
      advice && id
        ? {
            "@context": "https://schema.org",
            "@type": "DiscussionForumPosting",
            headline: advice.title,
            articleBody: advice.body,
            datePublished: advice.createdAt,
            dateModified: advice.updatedAt,
            author: {
              "@type": "Person",
              name: advice.author?.name || "TellNab Member",
            },
            commentCount: comments.length,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `${
                import.meta.env.VITE_SITE_URL || "https://tellnab.com"
              }/advice/${id}`,
            },
          }
        : undefined,
  });

  async function load() {
    if (!id) return;
    try {
      setError(null);
      const data = await getAdviceDetail(id);
      setAdvice(data.advice);
      setComments(data.comments);
      try {
        const share = await getQuestionShareMeta(id);
        setShareMeta({
          shareUrl: share.shareUrl,
          whatsappUrl: share.whatsappUrl,
        });
      } catch {
        setShareMeta(null);
      }
    } catch {
      setError(
        "Unable to open this advice. It may still be pending or removed.",
      );
    }
  }

  async function onCopyShareLink() {
    if (!shareMeta) return;
    const absoluteUrl = `${window.location.origin}${shareMeta.shareUrl}`;
    await navigator.clipboard.writeText(absoluteUrl);
    setModerationMessage("Share link copied.");
  }

  async function onConvertToPublic() {
    if (!id || !advice) return;
    try {
      setConvertingIdentity(true);
      const updated = await convertAdviceToPublic(id);
      setAdvice(updated);
      setModerationMessage("Post converted to public profile.");
    } catch {
      setModerationMessage("Unable to convert post identity.");
    } finally {
      setConvertingIdentity(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    try {
      if (voiceMode && voiceFile) {
        const uploaded = await uploadMedia(voiceFile);
        await addAdviceComment(id, {
          parentId: replyTo?.id,
          messageType: "VOICE",
          audioUrl: uploaded.fileUrl,
          transcript: voiceTranscript || undefined,
          body: voiceTranscript || "Voice reply",
        });
      } else {
        await addAdviceComment(id, {
          body: commentBody,
          parentId: replyTo?.id,
        });
      }
      setCommentBody("");
      setVoiceFile(null);
      setVoiceTranscript("");
      setVoiceMode(false);
      setCommentAiSuggestions([]);
      setCommentAiProvider(null);
      setReplyTo(null);
      await load();
    } catch {
      setError("Comment failed. Thread might be locked.");
    }
  }

  async function onAiAssistComment() {
    if (!advice) return;
    if (commentBody.trim().length < 6 && !replyTo) {
      setError("Write a short draft first, or choose a reply target.");
      return;
    }

    try {
      setCommentAiLoading(true);
      setError(null);

      const result = await generateCommentDraftWithAi({
        adviceTitle: advice.title,
        adviceBody: advice.body,
        parentComment: replyTo?.body,
        draft: commentBody,
        targetTone: "balanced",
      });

      setCommentBody(result.draftComment || commentBody);
      setCommentAiSuggestions(result.suggestions || []);
      setCommentAiProvider(result.provider || null);
    } catch (error) {
      setError(parseApiError(error, "AI comment assist failed."));
    } finally {
      setCommentAiLoading(false);
    }
  }

  async function onToggleFollow() {
    if (!id || !user || !advice) return;

    try {
      setFollowPending(true);
      if (advice.isFollowing) {
        await unfollowAdviceThread(id);
      } else {
        await followAdviceThread(id);
      }
      await load();
    } finally {
      setFollowPending(false);
    }
  }

  async function onBoost() {
    if (!id || !user || !advice) return;

    try {
      setBoostPending(true);
      setBoostMessage(null);
      await createAdviceBoostCheckout(id);
      setBoostMessage("Boost activated successfully.");
      await load();
    } catch {
      setBoostMessage("Boost checkout failed. Please try again.");
    } finally {
      setBoostPending(false);
    }
  }

  async function onModerationAction(action: Exclude<AdviceStatus, "PENDING">) {
    if (!id || !isModeratorOrAdmin) return;

    try {
      setModerationPending(true);
      setModerationMessage(null);
      const note =
        action === "HOLD"
          ? window.prompt("Optional hold reason:", "Needs more context") ||
            undefined
          : undefined;
      await moderateAdvice(id, { action, note });
      setModerationMessage(`Thread moved to ${action}.`);
      await load();
    } catch {
      setModerationMessage("Failed to update thread status.");
    } finally {
      setModerationPending(false);
    }
  }

  async function onToggleFlag(key: "isLocked" | "isFeatured" | "isSpam") {
    if (!id || !advice || !isModeratorOrAdmin) return;

    try {
      setModerationPending(true);
      setModerationMessage(null);
      await updateAdviceFlags(id, { [key]: !advice[key] });
      setModerationMessage(
        `${
          key === "isLocked"
            ? "Lock"
            : key === "isFeatured"
            ? "Feature"
            : "Spam"
        } flag updated.`,
      );
      await load();
    } catch {
      setModerationMessage("Failed to update thread flags.");
    } finally {
      setModerationPending(false);
    }
  }

  async function onDeleteComment(comment: AdviceComment) {
    if (!id || !user) return;

    const isOwner = comment.author.id === user.id;
    if (!isModeratorOrAdmin && !isOwner) return;

    const confirmed = window.confirm(
      "Delete this comment? Any replies under it will also be removed.",
    );
    if (!confirmed) return;

    try {
      setModerationPending(true);
      setModerationMessage(null);
      if (isModeratorOrAdmin) {
        await deleteAdviceCommentAsModerator(id, comment.id);
      } else {
        await deleteMyAdviceComment(id, comment.id);
      }
      setModerationMessage("Comment removed.");
      await load();
    } catch (error) {
      setModerationMessage(parseApiError(error, "Failed to remove comment."));
    } finally {
      setModerationPending(false);
    }
  }

  function renderComments(parentId: string | null, depth = 0): React.ReactNode {
    const children = comments.filter(
      (comment) => (comment.parentId || null) === parentId,
    );
    if (children.length === 0) return null;

    return children.map((comment) => (
      <div
        key={comment.id}
        className={`rounded-lg border border-white/10 bg-slate-950 p-3 ${
          depth > 0 ? "ml-4 mt-2" : ""
        }`}
      >
        {comment.messageType === "VOICE" && comment.audioUrl ? (
          <div className="space-y-2">
            <audio controls className="w-full">
              <source src={comment.audioUrl} />
            </audio>
            {comment.transcript ? (
              <p className="text-sm text-slate-300">{comment.transcript}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-200">{comment.body}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <UserIdentityDisplay
            displayName={comment.author.displayName || comment.author.name}
            roleLabel={comment.author.roleLabel}
            roleTone={comment.author.roleTone}
            advisorCategory={comment.author.advisorCategory}
            badges={comment.author.badges}
            className="max-w-[70%]"
          />
          {user ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReplyTo(comment)}
                className="text-xs font-semibold text-violet-300 transition hover:text-violet-200"
              >
                Reply
              </button>
              {isModeratorOrAdmin || user.id === comment.author.id ? (
                <button
                  type="button"
                  disabled={moderationPending}
                  onClick={() => void onDeleteComment(comment)}
                  className="text-xs font-semibold text-rose-300 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {renderComments(comment.id, depth + 1)}
      </div>
    ));
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
      <Card className="border-white/15 bg-gradient-to-b from-slate-900/82 to-slate-900/65">
        <h1 className="text-2xl font-bold text-white">{advice.title}</h1>
        <p className="mt-2 text-slate-300">{advice.body}</p>
        <p className="mt-2 text-xs text-slate-400">by</p>
        {advice.identityMode === "PUBLIC" ? (
          <div className="mt-1">
            <UserIdentityDisplay
              displayName={
                advice.author?.displayName || advice.author?.name || "Unknown"
              }
              roleLabel={advice.author?.roleLabel}
              roleTone={advice.author?.roleTone}
              advisorCategory={advice.author?.advisorCategory}
              badges={advice.author?.badges}
            />
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-300">Anonymous</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              advice.identityMode === "PUBLIC"
                ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100"
                : "border-slate-300/30 bg-slate-500/10 text-slate-200"
            }`}
          >
            {advice.identityMode === "PUBLIC" ? "Public" : "Anonymous"}
          </span>
          {advice.isUrgent ? (
            <span className="rounded-full border border-rose-300/35 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100">
              Urgent
            </span>
          ) : null}
          {advice.author?.advisorProfile?.level ? (
            <span className="rounded-full border border-violet-300/30 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
              {advice.author.advisorProfile.level.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Followers: {advice.followCount || 0}
          </p>
          {user ? (
            <button
              type="button"
              disabled={followPending}
              onClick={() => void onToggleFollow()}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                advice.isFollowing
                  ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                  : "border-violet-300/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
              } ${followPending ? "opacity-70" : ""}`}
            >
              {followPending
                ? "Updating..."
                : advice.isFollowing
                ? "Following"
                : "Follow thread"}
            </button>
          ) : null}
        </div>
        {shareMeta ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={shareMeta.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"
            >
              Share WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void onCopyShareLink()}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"
            >
              Copy link
            </button>
            <a
              href={shareMeta.shareUrl}
              className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100"
            >
              Open share card
            </a>
            {reportThreadUrl ? (
              <a
                href={reportThreadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100"
              >
                Report thread
              </a>
            ) : null}
          </div>
        ) : null}
        {advice.isLocked ? (
          <p className="mt-2 text-xs text-amber-200">Thread is locked.</p>
        ) : null}
        {advice.isBoostActive ? (
          <p className="mt-2 text-xs text-rose-200">
            Boost active until{" "}
            {advice.boostExpiresAt
              ? new Date(advice.boostExpiresAt).toLocaleString()
              : "soon"}
            .
          </p>
        ) : null}
        {user && advice.isOwner ? (
          <div className="mt-3">
            {advice.identityMode !== "PUBLIC" ? (
              <button
                type="button"
                disabled={convertingIdentity}
                onClick={() => void onConvertToPublic()}
                className={`mr-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 ${
                  convertingIdentity ? "opacity-70" : ""
                }`}
              >
                {convertingIdentity ? "Converting..." : "Convert to public"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={boostPending || advice.isBoostActive || advice.isLocked}
              onClick={() => void onBoost()}
              className={`rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 ${
                boostPending || advice.isBoostActive || advice.isLocked
                  ? "cursor-not-allowed opacity-70"
                  : ""
              }`}
            >
              {advice.isBoostActive
                ? "Boost active"
                : boostPending
                ? "Boosting..."
                : `Boost thread for $${boostPriceUsd.toFixed(
                    2,
                  )}/${boostDurationDays}d`}
            </button>
            {boostMessage ? (
              <p className="mt-2 text-xs text-slate-300">{boostMessage}</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      {isModeratorOrAdmin ? (
        <Card className="border-white/15 bg-gradient-to-b from-slate-900/82 to-slate-900/65">
          <h2 className="text-lg font-semibold text-white">
            Thread management
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Moderator controls for status and visibility flags.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onModerationAction("APPROVED")}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onModerationAction("HOLD")}
            >
              Hold
            </Button>
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onModerationAction("REMOVED")}
            >
              Remove
            </Button>
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onToggleFlag("isLocked")}
            >
              {advice.isLocked ? "Unlock" : "Lock"}
            </Button>
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onToggleFlag("isFeatured")}
            >
              {advice.isFeatured ? "Unfeature" : "Feature"}
            </Button>
            <Button
              variant="secondary"
              disabled={moderationPending}
              onClick={() => void onToggleFlag("isSpam")}
            >
              {advice.isSpam ? "Unmark spam" : "Mark spam"}
            </Button>
          </div>
          {moderationMessage ? (
            <p className="mt-2 text-xs text-slate-300">{moderationMessage}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="border-white/15 bg-gradient-to-b from-slate-900/82 to-slate-900/65">
        <h2 className="text-lg font-semibold text-white">Comments</h2>
        <div className="mt-3 space-y-2">
          {renderComments(null)}
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400">No comments yet.</p>
          ) : null}
        </div>

        {user ? (
          <>
            {replyTo ? (
              <div className="mt-4 rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2">
                <p className="text-xs text-violet-100">
                  Replying to{" "}
                  <span className="font-semibold">{replyTo.author.name}</span>
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

            <form className="mt-4 flex gap-2" onSubmit={onComment}>
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceMode((value) => !value)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                  >
                    {voiceMode ? "Text mode" : "Voice mode"}
                  </button>
                  {voiceMode ? (
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) =>
                        setVoiceFile(event.target.files?.[0] || null)
                      }
                      className="text-xs text-slate-300"
                    />
                  ) : null}
                </div>

                {voiceMode ? (
                  <input
                    value={voiceTranscript}
                    onChange={(event) => setVoiceTranscript(event.target.value)}
                    placeholder="Optional transcript"
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                ) : (
                  <input
                    name="body"
                    required
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder={
                      replyTo ? "Write your reply" : "Write a comment"
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onAiAssistComment()}
                disabled={commentAiLoading || voiceMode}
              >
                {commentAiLoading ? "AI..." : "AI assist"}
              </Button>
              <Button type="submit" variant="secondary">
                {replyTo ? "Reply" : "Comment"}
              </Button>
            </form>

            {commentAiSuggestions.length > 0 ? (
              <div className="mt-2 rounded-lg border border-violet-300/20 bg-violet-500/10 p-2">
                <p className="text-[11px] text-violet-100">
                  AI suggestions
                  {commentAiProvider ? ` (${commentAiProvider})` : ""}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-300">
                  {commentAiSuggestions.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}
