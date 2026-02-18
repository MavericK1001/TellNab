import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 ${className}`}
    >
      {children}
    </div>
  );
}
