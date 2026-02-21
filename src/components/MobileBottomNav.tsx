import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function itemClass(isActive: boolean) {
  return `inline-flex flex-1 items-center justify-center px-2 py-2 text-xs font-semibold transition ${
    isActive ? "text-violet-100" : "text-slate-300"
  }`;
}

export default function MobileBottomNav() {
  const { user } = useAuth();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        <NavLink to="/" className={({ isActive }) => itemClass(isActive)}>
          Home
        </NavLink>
        <NavLink to="/feed" className={({ isActive }) => itemClass(isActive)}>
          Feed
        </NavLink>
        <NavLink to="/ask" className={({ isActive }) => itemClass(isActive)}>
          Ask
        </NavLink>
        <NavLink to="/advice" className={({ isActive }) => itemClass(isActive)}>
          Advice
        </NavLink>
        <NavLink
          to={user ? "/notifications" : "/login"}
          className={({ isActive }) => itemClass(isActive)}
        >
          Alerts
        </NavLink>
      </div>
    </div>
  );
}
