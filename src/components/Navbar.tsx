import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listNotifications } from "../services/api";

const desktopBaseClass =
  "rounded-xl px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60";

const mobileBaseClass =
  "rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60";

function desktopNavClass(isActive: boolean) {
  return `${desktopBaseClass} ${
    isActive
      ? "border border-violet-300/25 bg-violet-500/18 text-violet-100"
      : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
  }`;
}

function mobileNavClass(isActive: boolean) {
  return `${mobileBaseClass} ${
    isActive
      ? "border border-violet-300/25 bg-violet-500/18 text-violet-100"
      : "border border-transparent text-slate-200 hover:border-white/10 hover:bg-white/10"
  }`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function onScroll() {
      setIsCompact(window.scrollY > 18);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let alive = true;
    async function loadNotifications() {
      try {
        const data = await listNotifications();
        if (!alive) return;
        setUnreadCount(data.unreadCount || 0);
      } catch {
        // ignore transient nav fetch errors
      }
    }

    function onNotificationsUpdated(event: Event) {
      const custom = event as CustomEvent<{ unreadCount?: number }>;
      if (typeof custom.detail?.unreadCount === "number") {
        setUnreadCount(custom.detail.unreadCount);
        return;
      }
      void loadNotifications();
    }

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 25000);
    window.addEventListener(
      "tellnab:notifications-updated",
      onNotificationsUpdated as EventListener,
    );

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(
        "tellnab:notifications-updated",
        onNotificationsUpdated as EventListener,
      );
    };
  }, [user]);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    await logout();
    closeMobileMenu();
  }

  return (
    <nav
      className={`sticky top-0 z-30 border-b border-white/10 backdrop-blur-xl transition-all duration-300 ${
        isCompact
          ? "bg-slate-950/88 shadow-xl shadow-black/30"
          : "bg-slate-950/65"
      }`}
    >
      <div
        className={`h-px w-full bg-gradient-to-r from-violet-500/45 via-sky-400/30 to-emerald-400/35 transition-opacity duration-300 ${
          isCompact ? "opacity-70" : "opacity-100"
        }`}
      />
      <div
        className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          isCompact ? "py-2" : "py-3"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className={`group inline-flex items-center gap-2 font-semibold tracking-tight text-white transition-all ${
              isCompact ? "text-base" : "text-lg"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_26px_3px_rgba(167,139,250,0.9)]" />
            <span>TellNab</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center rounded-xl border border-white/10 bg-slate-900/65 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>

          <div className="relative hidden items-center gap-1.5 lg:flex">
            <NavLink
              to="/"
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              Home
            </NavLink>
            <NavLink
              to="/feed"
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              Feed
            </NavLink>
            <NavLink
              to="/groups"
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              Groups
            </NavLink>
            <NavLink
              to="/advice"
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              Advice
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              About
            </NavLink>

            {user ? (
              <>
                <NavLink
                  to="/messages"
                  className={({ isActive }) => desktopNavClass(isActive)}
                >
                  Messages
                </NavLink>
                <NavLink
                  to="/notifications"
                  className={({ isActive }) => desktopNavClass(isActive)}
                >
                  <span className="inline-flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) => desktopNavClass(isActive)}
                >
                  Profile
                </NavLink>
              </>
            ) : null}

            {user?.role === "ADMIN" || user?.role === "MODERATOR" ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `${desktopNavClass(isActive)} ${
                    user?.role === "ADMIN"
                      ? "text-amber-200 hover:text-amber-100"
                      : "text-emerald-200 hover:text-emerald-100"
                  }`
                }
              >
                {user?.role === "ADMIN" ? "Admin" : "Moderation Hub"}
              </NavLink>
            ) : null}

            {!user ? (
              <>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <NavLink
                  to="/login"
                  className={({ isActive }) => desktopNavClass(isActive)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) => desktopNavClass(isActive)}
                >
                  Register
                </NavLink>
              </>
            ) : (
              <>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <span className="rounded-full border border-white/12 bg-slate-900/75 px-2.5 py-1 text-[11px] text-slate-300">
                  {user.name} • {user.role}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/10 hover:text-white"
                >
                  Logout
                </button>
              </>
            )}

            <Link
              to="/ask"
              className={`ml-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-violet-500 via-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 transition hover:-translate-y-0.5 hover:from-violet-400 hover:to-fuchsia-400 ${
                isCompact ? "px-3.5 py-1.5" : "px-4 py-2"
              }`}
            >
              <span aria-hidden="true">✦</span>
              Ask now
            </Link>
          </div>
        </div>

        <div
          aria-hidden={!mobileOpen}
          className={`overflow-hidden transition-all duration-300 ease-out lg:hidden ${
            mobileOpen
              ? "mt-3 max-h-[640px] opacity-100"
              : "mt-0 max-h-0 opacity-0"
          }`}
        >
          <div className="grid gap-1 rounded-2xl border border-white/10 bg-slate-900/88 p-2 shadow-xl shadow-black/30">
            <NavLink
              to="/"
              onClick={closeMobileMenu}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              Home
            </NavLink>
            <NavLink
              to="/feed"
              onClick={closeMobileMenu}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              Feed
            </NavLink>
            <NavLink
              to="/groups"
              onClick={closeMobileMenu}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              Groups
            </NavLink>
            <NavLink
              to="/advice"
              onClick={closeMobileMenu}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              Advice
            </NavLink>
            <NavLink
              to="/about"
              onClick={closeMobileMenu}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              About
            </NavLink>

            {user ? (
              <>
                <div className="my-1 h-px bg-white/10" />
                <NavLink
                  to="/messages"
                  onClick={closeMobileMenu}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  Messages
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={closeMobileMenu}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  Profile
                </NavLink>
                <NavLink
                  to="/notifications"
                  onClick={closeMobileMenu}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  <span className="inline-flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
              </>
            ) : null}

            {!user ? (
              <>
                <div className="my-1 h-px bg-white/10" />
                <NavLink
                  to="/login"
                  onClick={closeMobileMenu}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={closeMobileMenu}
                  className={({ isActive }) => mobileNavClass(isActive)}
                >
                  Register
                </NavLink>
              </>
            ) : null}

            {user?.role === "ADMIN" || user?.role === "MODERATOR" ? (
              <NavLink
                to="/admin"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `${mobileNavClass(isActive)} ${
                    user?.role === "ADMIN"
                      ? "text-amber-200"
                      : "text-emerald-200"
                  }`
                }
              >
                {user?.role === "ADMIN" ? "Admin" : "Moderation Hub"}
              </NavLink>
            ) : null}

            {user ? (
              <>
                <div className="mt-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                  Signed in as {user.name} ({user.role})
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            ) : null}

            <Link
              to="/ask"
              onClick={closeMobileMenu}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-400 hover:to-fuchsia-400"
            >
              Ask now
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
