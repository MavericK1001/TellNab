import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_24px_2px_rgba(167,139,250,0.9)]" />
          <span>TellNab</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Home
          </Link>
          <Link
            to="/feed"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Feed
          </Link>
          <Link
            to="/advice"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Advice
          </Link>
          <Link
            to="/messages"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Messages
          </Link>
          <Link
            to="/profile"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Profile
          </Link>
          {user?.role === "ADMIN" ? (
            <Link
              to="/admin"
              className="rounded-lg px-3 py-2 text-sm text-amber-200 transition hover:bg-white/10 hover:text-amber-100"
            >
              Admin
            </Link>
          ) : null}
          {user?.role === "ADMIN" || user?.role === "MODERATOR" ? (
            <Link
              to="/advice"
              className="rounded-lg px-3 py-2 text-sm text-emerald-200 transition hover:bg-white/10 hover:text-emerald-100"
            >
              Moderate
            </Link>
          ) : null}
          <Link
            to="/about"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            About
          </Link>
          {!user ? (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Register
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Logout
            </button>
          )}
          <Link
            to="/ask"
            className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
          >
            Ask now
          </Link>
        </div>
      </div>
    </nav>
  );
}
