import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { NotificationItem } from "../types";
import { useSeo } from "../utils/seo";

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: "Notifications | TellNab",
    description:
      "Track replies, moderation updates, and thread activity notifications.",
    path: "/notifications",
    robots: "noindex,nofollow",
  });

  async function loadNotifications() {
    try {
      setError(null);
      const data = await listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tellnab:notifications-updated", {
            detail: { unreadCount: data.unreadCount },
          }),
        );
      }
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function onMarkRead(item: NotificationItem) {
    await markNotificationRead(item.id, !item.isRead);
    await loadNotifications();
  }

  async function onMarkAllRead() {
    await markAllNotificationsRead();
    await loadNotifications();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <SectionTitle
          title="Notifications"
          subtitle="Replies, moderation updates, and activity from threads you care about."
        />
      </div>

      <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            Unread notifications:{" "}
            <span className="font-semibold text-violet-200">{unreadCount}</span>
          </p>
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
          >
            Mark all read
          </button>
        </div>
      </Card>

      <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
        {loading ? (
          <p className="text-slate-300">Loading notifications…</p>
        ) : null}
        {error ? <p className="text-rose-300">{error}</p> : null}

        {!loading && !error ? (
          <div className="space-y-3">
            {notifications.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.isRead
                    ? "border-white/10 bg-slate-950/70"
                    : "border-violet-300/25 bg-violet-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">{item.body}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onMarkRead(item)}
                    className="rounded-xl border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {item.isRead ? "Mark unread" : "Mark read"}
                  </button>
                </div>

                {item.adviceId ? (
                  <Link
                    to={`/advice/${item.adviceId}`}
                    className="mt-3 inline-flex text-xs font-semibold text-violet-200 hover:text-violet-100"
                  >
                    Open thread →
                  </Link>
                ) : null}
              </article>
            ))}

            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">No notifications yet.</p>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
