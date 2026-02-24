import React from "react";
import { buildSupportRequestUrl } from "../utils/support";

export default function ReportIssueButton() {
  const href = buildSupportRequestUrl({
    type: "ISSUE",
    subject: "Issue report",
  });

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-violet-300/35 bg-violet-600/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 transition hover:bg-violet-500"
      aria-label="Report issue"
    >
      🐞 Report issue
    </a>
  );
}
