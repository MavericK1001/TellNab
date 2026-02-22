import React from "react";

type BadgeItem = {
  key: string;
  name: string;
  description?: string;
  icon?: string;
  tone?: string;
};

const toneClassMap: Record<string, string> = {
  rose: "border-rose-300/35 bg-rose-500/15 text-rose-100",
  violet: "border-violet-300/35 bg-violet-500/15 text-violet-100",
  emerald: "border-emerald-300/35 bg-emerald-500/15 text-emerald-100",
  amber: "border-amber-300/35 bg-amber-500/15 text-amber-100",
  cyan: "border-cyan-300/35 bg-cyan-500/15 text-cyan-100",
  slate: "border-slate-300/30 bg-slate-500/10 text-slate-200",
};

function roleToneClass(tone?: string) {
  return toneClassMap[tone || "slate"] || toneClassMap.slate;
}

export default function UserIdentityDisplay({
  displayName,
  roleLabel,
  roleTone,
  advisorCategory,
  badges,
  className,
}: {
  displayName: string;
  roleLabel?: string;
  roleTone?: string;
  advisorCategory?: string | null;
  badges?: BadgeItem[];
  className?: string;
}) {
  return (
    <div className={className || "space-y-1"}>
      <p
        className="text-sm font-semibold text-white"
        title={`${displayName}${roleLabel ? ` • ${roleLabel}` : ""}`}
      >
        {displayName}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {roleLabel ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleToneClass(
              roleTone,
            )}`}
          >
            {roleLabel}
          </span>
        ) : null}
        {advisorCategory ? (
          <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
            {advisorCategory}
          </span>
        ) : null}
        {(badges || []).slice(0, 5).map((badge) => (
          <span
            key={badge.key}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${roleToneClass(
              badge.tone,
            )}`}
            title={badge.description || badge.name}
          >
            {badge.icon ? `${badge.icon} ` : ""}
            {badge.name}
          </span>
        ))}
      </div>
    </div>
  );
}
