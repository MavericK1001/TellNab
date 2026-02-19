import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register, socialLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSocialSignup(provider: "google" | "apple") {
    try {
      setLoading(true);
      setError(null);
      await socialLogin(provider);
      navigate("/profile");
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : "Social signup failed.";
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    try {
      setLoading(true);
      setError(null);
      await register(name, email, password);
      navigate("/profile");
    } catch {
      setError("Registration failed. Use a stronger password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-stretch">
      <Card className="rounded-3xl border-white/15 bg-gradient-to-br from-violet-500/20 via-slate-900/70 to-cyan-500/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/90">
          Join TellNab
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Create account
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Join TellNab and participate securely.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-slate-200">Name</label>
            <input
              name="name"
              type="text"
              minLength={2}
              required
              className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-200">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-200">Password</label>
            <input
              name="password"
              type="password"
              minLength={12}
              required
              className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Use at least 12 chars with upper/lower/number/symbol.
            </p>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className={loading ? "opacity-70" : ""}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSocialSignup("google")}
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
          >
            Sign up with Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSocialSignup("apple")}
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
          >
            Sign up with Apple
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-300">
          Already have an account?{" "}
          <Link to="/login" className="text-violet-300">
            Login
          </Link>
        </p>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Account safety</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Your display name can stay pseudonymous.</li>
          <li>Strong passwords reduce account risk.</li>
          <li>Moderators review threads for quality and safety.</li>
        </ul>
      </Card>
    </div>
  );
}
