import React from "react";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export default function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-[-0.01em] text-white sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="max-w-3xl text-sm leading-7 text-slate-300">{subtitle}</p>
      ) : null}
    </div>
  );
}
