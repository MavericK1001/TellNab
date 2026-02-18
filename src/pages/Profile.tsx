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
        <p className="mt-2 text-slate-300">{profile.bio}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Questions asked
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
            Helpful votes
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {profile.helpfulVotes}
          </p>
        </Card>
      </div>
    </div>
  );
}
