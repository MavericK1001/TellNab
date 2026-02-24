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
          <li>
            Paid thread boosts may increase visibility for approved threads, but
            they are always clearly labeled as boosted.
          </li>
          <li>
            Wallet credits are recorded in an auditable ledger. Promotional,
            earned, and paid balances may follow different limits.
          </li>
          <li>
            Badges can be earned automatically through activity or assigned by
            admins with documented reasons and review logs.
          </li>
          <li>Moderators may remove content that breaks these terms.</li>
        </ul>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">
          Abuse and spam policy
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          We actively moderate harassment, manipulation, repeat spam, scams, and
          harmful content. Reports from users and moderator reviews both trigger
          action.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>
            <span className="font-semibold text-slate-100">Disallowed:</span>{" "}
            threats, hate, targeted abuse, doxxing, sexual exploitation,
            scam/promo spam, and repeated low-quality posting.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Enforcement:</span>{" "}
            hold, remove, lock, and spam-flag actions are applied per thread
            severity and repeat behavior.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Escalation:</span>{" "}
            urgent risk indicators are routed for priority moderation review.
          </li>
        </ul>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">Urgent safety note</h3>
        <p className="mt-2 text-sm text-slate-300">
          TellNab is not an emergency service. If someone is in immediate
          danger, contact local emergency services immediately.
        </p>
      </Card>
    </div>
  );
}
