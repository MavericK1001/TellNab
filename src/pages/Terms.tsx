import React from "react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useSeo } from "../utils/seo";

export default function Terms() {
  useSeo({
    title: "Community Terms - TellNab Rules and Safety",
    description:
      "Read TellNab community terms and moderation rules for safe, useful, and respectful advice discussions.",
    path: "/terms",
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Community Terms"
        subtitle="Simple rules for safer, useful discussions."
      />
      <Card>
        <ul className="list-disc space-y-3 pl-5 text-slate-300">
          <li>Be direct, but do not insult, threaten, or harass others.</li>
          <li>No hate speech, discrimination, or targeted abuse.</li>
          <li>Do not share private personal information.</li>
          <li>Advice should be relevant and practical.</li>
          <li>Moderators may remove content that breaks these terms.</li>
        </ul>
      </Card>
    </div>
  );
}
