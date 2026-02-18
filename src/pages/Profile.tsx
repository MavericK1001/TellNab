import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { getProfile } from "../services/api";
import { UserProfile } from "../types";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  if (!profile) {
    return (
      <Card>
        <p className="text-slate-300">Loading profile…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Profile"
        subtitle="Your TellNab activity and impact."
      />

      <Card>
        <h3 className="text-xl font-semibold text-white">{profile.name}</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-violet-200">
          {profile.role}
        </p>
        <p className="mt-2 text-slate-300">{profile.bio}</p>
        <p className="mt-3 text-xs text-slate-400">
          Member since {new Date(profile.memberSince).toLocaleDateString()}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Threads posted
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{profile.asks}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Replies posted
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {profile.replies}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Featured threads
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {profile.featuredThreads}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Approved threads
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {profile.approvedThreads}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Pending review
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {profile.pendingThreads}
          </p>
        </Card>
      </div>
    </div>
  );
}
