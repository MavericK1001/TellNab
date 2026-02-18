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
};

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";

const variants: Record<Variant, string> = {
  primary: "bg-violet-500 text-white hover:bg-violet-400",
  secondary: "border border-white/20 text-slate-200 hover:bg-white/10",
  ghost: "text-slate-300 hover:bg-white/10 hover:text-white",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  to,
  type = "button",
  onClick,
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
