const DEFAULT_SUPPORT_URL = "https://support.tellnab.com";
const SUPPORT_VERSION = "20260220";

type SupportRequestType = "ISSUE" | "ABUSE" | "CRISIS";

type BuildSupportRequestUrlInput = {
  type?: SupportRequestType;
  subject?: string;
  pageUrl?: string;
  adviceId?: string;
  commentId?: string;
};

export function buildSupportRequestUrl({
  type = "ISSUE",
  subject = "Issue report",
  pageUrl,
  adviceId,
  commentId,
}: BuildSupportRequestUrlInput = {}) {
  const supportBase =
    (import.meta.env.VITE_SUPPORT_SITE_URL as string | undefined) ||
    DEFAULT_SUPPORT_URL;

  const resolvedPageUrl =
    pageUrl ||
    (typeof window !== "undefined"
      ? window.location.href
      : "https://tellnab.com");

  const params = new URLSearchParams({
    type,
    pageUrl: resolvedPageUrl,
    subject,
    v: SUPPORT_VERSION,
  });

  if (adviceId) {
    params.set("adviceId", adviceId);
  }

  if (commentId) {
    params.set("commentId", commentId);
  }

  return `${supportBase.replace(/\/$/, "")}/?${params.toString()}`;
}
