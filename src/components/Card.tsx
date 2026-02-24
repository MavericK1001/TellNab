import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`premium-glass rounded-2xl p-6 ring-1 ring-white/5 backdrop-blur-sm transition duration-200 hover:border-white/25 hover:shadow-[0_20px_50px_-26px_rgba(15,23,42,0.95)] ${className}`}
    >
      {children}
    </div>
  );
}
