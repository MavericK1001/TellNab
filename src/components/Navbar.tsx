import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    await logout();
    closeMobileMenu();
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="group inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_24px_2px_rgba(167,139,250,0.9)]" />
            <span>TellNab</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 md:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>

          <div className="hidden items-center gap-2 md:flex">
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
            <Link
              to="/notifications"
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Notifications
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

        <div
          aria-hidden={!mobileOpen}
          className={`overflow-hidden transition-all duration-300 ease-out md:hidden ${
            mobileOpen
              ? "mt-3 max-h-[640px] opacity-100"
              : "mt-0 max-h-0 opacity-0"
          }`}
        >
          <div className="grid gap-1 rounded-xl border border-white/10 bg-slate-900/90 p-2">
            <Link
              to="/"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Home
            </Link>
            <Link
              to="/feed"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Feed
            </Link>
            <Link
              to="/advice"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Advice
            </Link>
            <Link
              to="/messages"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Messages
            </Link>
            <Link
              to="/profile"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Profile
            </Link>
            <Link
              to="/notifications"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Notifications
            </Link>
            {user?.role === "ADMIN" ? (
              <Link
                to="/admin"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 text-sm text-amber-200 transition hover:bg-white/10"
              >
                Admin
              </Link>
            ) : null}
            {user?.role === "ADMIN" || user?.role === "MODERATOR" ? (
              <Link
                to="/advice"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 text-sm text-emerald-200 transition hover:bg-white/10"
              >
                Moderate
              </Link>
            ) : null}
            <Link
              to="/about"
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              About
            </Link>
            {!user ? (
              <>
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={closeMobileMenu}
                  className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Register
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
              >
                Logout
              </button>
            )}
            <Link
              to="/ask"
              onClick={closeMobileMenu}
              className="mt-1 rounded-lg bg-violet-500 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-violet-400"
            >
              Ask now
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
