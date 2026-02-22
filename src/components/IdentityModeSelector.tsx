import React from "react";

type IdentityMode = "ANONYMOUS" | "PUBLIC";

type Props = {
  value: IdentityMode;
  onChange: (value: IdentityMode) => void;
  className?: string;
};

export default function IdentityModeSelector({
  value,
  onChange,
  className,
}: Props) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-950/70 p-2 ${
        className || ""
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Identity mode
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("ANONYMOUS")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
            value === "ANONYMOUS"
              ? "bg-violet-500/30 text-violet-100"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Ask Anonymously
        </button>
        <button
          type="button"
          onClick={() => onChange("PUBLIC")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
            value === "PUBLIC"
              ? "bg-cyan-500/25 text-cyan-100"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Ask with Profile
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-300">Your identity, your choice.</p>
    </div>
  );
}
