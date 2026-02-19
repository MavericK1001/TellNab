import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/78 to-slate-900/58 p-6 shadow-xl shadow-slate-950/45 ring-1 ring-white/5 backdrop-blur-sm transition duration-200 hover:border-white/15 hover:shadow-slate-950/55 ${className}`}
    >
      {children}
    </div>
  );
}
