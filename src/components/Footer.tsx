import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} TellNab. Honest advice, better decisions.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/about" className="transition hover:text-white">
            About
          </Link>
          <Link to="/terms" className="transition hover:text-white">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
