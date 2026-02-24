import React from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  to?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
};

const base =
  "ui-interactive inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-500 via-violet-500 to-cyan-500 text-white shadow-[0_14px_30px_-16px_rgba(124,58,237,0.95)] hover:-translate-y-0.5 hover:from-violet-400 hover:to-cyan-400 hover:shadow-[0_20px_36px_-18px_rgba(124,58,237,0.98)] active:translate-y-0",
  secondary:
    "border border-white/15 bg-slate-900/70 text-slate-100 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.06)] hover:-translate-y-0.5 hover:border-white/25 hover:bg-slate-800/80",
  ghost:
    "border border-transparent text-slate-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/10 hover:text-white",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  to,
  type = "button",
  onClick,
  disabled = false,
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${
    disabled ? "cursor-not-allowed opacity-60" : ""
  } ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
