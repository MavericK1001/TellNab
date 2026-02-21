import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import {
  followAdvisor,
  getAdvisorProfile,
  unfollowAdvisor,
} from "../services/api";
import { AdvisorProfile as AdvisorProfileType } from "../types";
import { useAuth } from "../context/AuthContext";

export default function AdvisorProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [advisor, setAdvisor] = useState<AdvisorProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdvisorProfile(id)
      .then(setAdvisor)
      .catch(() => setError("Advisor profile not found."))
      .finally(() => setLoading(false));
  }, [id]);

  async function onToggleFollow() {
    if (!advisor || !user) return;
    setBusy(true);
    try {
      if (advisor.isFollowing) {
        const result = await unfollowAdvisor(advisor.userId);
        setAdvisor({
          ...advisor,
          isFollowing: false,
          followersCount: result.followersCount,
        });
      } else {
        const result = await followAdvisor(advisor.userId);
        setAdvisor({
          ...advisor,
          isFollowing: true,
          followersCount: result.followersCount,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-slate-300">Loading advisor profile…</p>
      </Card>
    );
  }

  if (!advisor) {
    return (
      <Card>
        <p className="text-rose-300">
          {error || "Advisor profile unavailable."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={advisor.displayName}
        subtitle="Verified advisor profile, specialties, and activity stats"
      />

      <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white">
              {advisor.displayName}
            </p>
            <p className="text-sm text-slate-400">{advisor.user?.name}</p>
          </div>
          {advisor.isVerified ? (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Verified
            </span>
          ) : null}
          {advisor.level ? (
            <span className="rounded-full border border-violet-300/30 bg-violet-500/12 px-3 py-1 text-xs font-semibold text-violet-100">
              {advisor.level.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>

        {advisor.bio ? (
          <p className="mt-3 text-sm text-slate-300">{advisor.bio}</p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Rating</p>
            <p className="text-lg font-semibold text-white">
              {advisor.rating.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Replies</p>
            <p className="text-lg font-semibold text-white">
              {advisor.totalReplies}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Helpful</p>
            <p className="text-lg font-semibold text-white">
              {advisor.helpfulCount || 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Response time</p>
            <p className="text-lg font-semibold text-white">
              {advisor.responseTimeMins} mins
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Followers</p>
            <p className="text-lg font-semibold text-white">
              {advisor.followersCount}
            </p>
          </div>
        </div>

        {advisor.specialties.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {advisor.specialties.map((item) => (
              <span
                key={item}
                className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={() => void onToggleFollow()}
              disabled={busy || user.id === advisor.userId}
              className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
            >
              {advisor.isFollowing ? "Following" : "Follow advisor"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/20"
            >
              Login to follow
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
