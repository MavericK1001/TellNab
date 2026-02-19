import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import Button from "../components/Button";
import {
  getMyBadges,
  getProfile,
  getWalletOverview,
  mockWalletTopup,
} from "../services/api";
import { BadgeDefinition, UserProfile, WalletOverview } from "../types";
import { useToast } from "../context/ToastContext";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);

  async function loadProfile() {
    const [profileData, walletData, badgeData] = await Promise.all([
      getProfile(),
      getWalletOverview(),
      getMyBadges(),
    ]);
    setProfile(profileData);
    setWallet(walletData);
    setBadges(badgeData.catalog);
  }

  useEffect(() => {
    loadProfile().catch(() => {
      const message =
        "Failed to load wallet and badges. Please refresh in a moment.";
      setWalletError(message);
      toast.error(message);
    });
  }, []);

  async function onMockTopup() {
    try {
      setTopupLoading(true);
      setWalletError(null);
      await mockWalletTopup(500);
      const refreshedWallet = await getWalletOverview();
      setWallet(refreshedWallet);
      toast.success("Wallet top-up completed.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet top-up failed.";
      setWalletError(message);
      toast.error(message);
    } finally {
      setTopupLoading(false);
    }
  }

  if (!profile || !wallet) {
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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Wallet</h3>
            <p className="text-sm text-slate-400">
              Hybrid balance for paid and earned credits.
            </p>
          </div>
          <Button onClick={() => void onMockTopup()} disabled={topupLoading}>
            {topupLoading ? "Adding…" : "Mock top-up $5"}
          </Button>
        </div>
        {walletError ? (
          <p className="mt-3 text-sm text-rose-300">{walletError}</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Paid balance
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatUsd(wallet.wallet.paidCents)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Earned balance
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatUsd(wallet.wallet.earnedCents)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">
              {formatUsd(wallet.wallet.totalCents)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Daily top-up cap: {formatUsd(wallet.limits.dailyTopupCapCents)} • Max
          single top-up: {formatUsd(wallet.limits.topupMaxCents)}
        </p>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-white">
            Recent wallet activity
          </p>
          {wallet.transactions.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm"
            >
              <div>
                <p className="text-slate-200">{item.reason}</p>
                <p className="text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <p
                className={
                  item.amountCents >= 0 ? "text-emerald-300" : "text-rose-300"
                }
              >
                {item.amountCents >= 0 ? "+" : ""}
                {formatUsd(item.amountCents)}
              </p>
            </div>
          ))}
          {wallet.transactions.length === 0 ? (
            <p className="text-sm text-slate-400">
              No wallet transactions yet.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">Badges</h3>
        <p className="mt-1 text-sm text-slate-400">
          All badges are visible. Earned badges are highlighted.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`rounded-xl border p-3 ${
                badge.awarded
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-white/10 bg-slate-900/50"
              }`}
            >
              <p className="text-xl">{badge.icon}</p>
              <p className="mt-2 font-semibold text-white">{badge.name}</p>
              <p className="text-sm text-slate-300">{badge.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                {badge.awarded ? "Earned" : "Not earned yet"}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
