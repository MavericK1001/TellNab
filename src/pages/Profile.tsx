import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import Button from "../components/Button";
import {
  getDashboardSummary,
  getMyBadges,
  getProfile,
  getWalletOverview,
  mockWalletTopup,
  updateProfilePassword,
  updateProfileSettings,
} from "../services/api";
import { BadgeDefinition, UserProfile, WalletOverview } from "../types";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

type ProfileSection =
  | "account"
  | "security"
  | "appearance"
  | "wallet"
  | "badges";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default function Profile() {
  const toast = useToast();
  const { refresh } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [dashboardStats, setDashboardStats] = useState<{
    questionsAsked: number;
    repliesReceived: number;
    savedAdvice: number;
    followedAdvisors: number;
    activityScore: number;
  } | null>(null);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>("account");

  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");

  async function loadProfile() {
    const [profileData, walletData, badgeData, dashboardData] =
      await Promise.all([
        getProfile(),
        getWalletOverview(),
        getMyBadges(),
        getDashboardSummary().catch(() => null),
      ]);
    setProfile(profileData);
    setWallet(walletData);
    setBadges(badgeData.catalog);
    setDashboardStats(dashboardData?.stats || null);
    setNameInput(profileData.name);
    setEmailInput(profileData.email);
    setBioInput(profileData.bio || "");
    setAvatarUrlInput(profileData.avatarUrl || "");
    setCoverUrlInput(profileData.coverImageUrl || "");
  }

  useEffect(() => {
    loadProfile().catch(() => {
      const message =
        "Failed to load profile settings. Please refresh in a moment.";
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

  async function onSaveAccount() {
    try {
      setSavingAccount(true);
      const updated = await updateProfileSettings({
        name: nameInput,
        email: emailInput,
        bio: bioInput,
      });
      setProfile(updated);
      await refresh();
      toast.success("Account settings updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save account settings.";
      toast.error(message);
    } finally {
      setSavingAccount(false);
    }
  }

  async function onSaveAppearance() {
    try {
      setSavingAppearance(true);
      const updated = await updateProfileSettings({
        avatarUrl: avatarUrlInput.trim() || null,
        coverImageUrl: coverUrlInput.trim() || null,
      });
      setProfile(updated);
      await refresh();
      toast.success("Profile images updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update images.";
      toast.error(message);
    } finally {
      setSavingAppearance(false);
    }
  }

  async function onSavePassword() {
    if (newPasswordInput !== confirmPasswordInput) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      await updateProfilePassword({
        currentPassword: currentPasswordInput || undefined,
        newPassword: newPasswordInput,
      });
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      await loadProfile();
      toast.success("Password updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function onImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  const sections = useMemo(
    () => [
      { key: "account" as const, label: "Account" },
      { key: "security" as const, label: "Security" },
      { key: "appearance" as const, label: "Images" },
      { key: "wallet" as const, label: "Wallet" },
      { key: "badges" as const, label: "Badges" },
    ],
    [],
  );

  if (!profile || !wallet) {
    return (
      <Card>
        <p className="text-slate-300">Loading profile…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-cyan-500/10 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <SectionTitle
          title="Profile settings"
          subtitle="Manage your identity, security, and personalized profile controls."
        />
        {dashboardStats ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-200">
              Questions {dashboardStats.questionsAsked}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-200">
              Replies {dashboardStats.repliesReceived}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-200">
              Saved {dashboardStats.savedAdvice}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-200">
              Advisors {dashboardStats.followedAdvisors}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-200">
              Activity {dashboardStats.activityScore}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65 p-3">
          <div className="space-y-1">
            {sections.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  activeSection === item.key
                    ? "bg-violet-500/20 text-violet-100"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {activeSection === "account" ? (
            <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
              <h3 className="text-lg font-semibold text-white">
                Account details
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Update your display identity and profile summary.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-200">Display name</label>
                  <input
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-200">Email</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm text-slate-200">Bio</label>
                <textarea
                  value={bioInput}
                  onChange={(event) => setBioInput(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </div>

              <div className="mt-4">
                <Button
                  onClick={() => void onSaveAccount()}
                  disabled={savingAccount}
                >
                  {savingAccount ? "Saving..." : "Save account settings"}
                </Button>
              </div>
            </Card>
          ) : null}

          {activeSection === "security" ? (
            <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
              <h3 className="text-lg font-semibold text-white">Security</h3>
              <p className="mt-1 text-sm text-slate-400">
                {profile.hasPassword
                  ? "Rotate your password regularly for account safety."
                  : "This account currently uses social sign-in. Add a password to enable email login."}
              </p>

              <div className="mt-4 grid gap-3">
                {profile.hasPassword ? (
                  <div>
                    <label className="text-sm text-slate-200">
                      Current password
                    </label>
                    <input
                      type="password"
                      value={currentPasswordInput}
                      onChange={(event) =>
                        setCurrentPasswordInput(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                    />
                  </div>
                ) : null}
                <div>
                  <label className="text-sm text-slate-200">New password</label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(event) =>
                      setNewPasswordInput(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-200">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(event) =>
                      setConfirmPasswordInput(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Signed in via:{" "}
                <span className="font-semibold text-violet-200">
                  {profile.authProvider || "LOCAL"}
                </span>
              </p>

              <div className="mt-4">
                <Button
                  onClick={() => void onSavePassword()}
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating..." : "Update password"}
                </Button>
              </div>
            </Card>
          ) : null}

          {activeSection === "appearance" ? (
            <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
              <h3 className="text-lg font-semibold text-white">
                Profile images
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Set avatar and cover images by URL or upload a local image.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-200">Avatar image</label>
                  <input
                    value={avatarUrlInput}
                    onChange={(event) => setAvatarUrlInput(event.target.value)}
                    placeholder="https://... or data:image/..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void onImageUpload(event, setAvatarUrlInput)
                    }
                    className="mt-2 block w-full text-xs text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-200">Cover image</label>
                  <input
                    value={coverUrlInput}
                    onChange={(event) => setCoverUrlInput(event.target.value)}
                    placeholder="https://... or data:image/..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void onImageUpload(event, setCoverUrlInput)
                    }
                    className="mt-2 block w-full text-xs text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="mb-2 text-xs text-slate-400">Avatar preview</p>
                  {avatarUrlInput ? (
                    <img
                      src={avatarUrlInput}
                      alt="Avatar preview"
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <p className="text-xs text-slate-500">No avatar set</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="mb-2 text-xs text-slate-400">Cover preview</p>
                  {coverUrlInput ? (
                    <img
                      src={coverUrlInput}
                      alt="Cover preview"
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <p className="text-xs text-slate-500">No cover image set</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Button
                  onClick={() => void onSaveAppearance()}
                  disabled={savingAppearance}
                >
                  {savingAppearance ? "Saving..." : "Save images"}
                </Button>
              </div>
            </Card>
          ) : null}

          {activeSection === "wallet" ? (
            <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Wallet</h3>
                  <p className="text-sm text-slate-400">
                    Hybrid balance for paid and earned credits.
                  </p>
                </div>
                <Button
                  onClick={() => void onMockTopup()}
                  disabled={topupLoading}
                >
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
            </Card>
          ) : null}

          {activeSection === "badges" ? (
            <Card className="border-white/15 bg-gradient-to-b from-slate-900/80 to-slate-900/65">
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
                    <p className="mt-2 font-semibold text-white">
                      {badge.name}
                    </p>
                    <p className="text-sm text-slate-300">
                      {badge.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {badge.awarded ? "Earned" : "Not earned yet"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
