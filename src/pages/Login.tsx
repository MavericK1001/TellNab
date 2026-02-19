import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import Card from "../components/Card";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, socialLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  async function handleSocialLogin(provider: "google" | "apple") {
    try {
      setLoading(true);
      setError(null);
      await socialLogin(provider);
      navigate("/profile");
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : "Social login failed.";
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput;

    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      navigate("/profile");
    } catch (err) {
      if (isAxiosError(err)) {
        if (!err.response) {
          setError("Cannot reach server. Please make sure backend is running.");
          return;
        }

        if (err.response.status === 401) {
          setError("Invalid email or password.");
          return;
        }

        if (err.response.status === 403) {
          setError("Account suspended. Contact admin.");
          return;
        }

        if (err.response.status === 429) {
          setError(
            "Too many login attempts. Please wait a few minutes and try again.",
          );
          return;
        }

        const apiMessage =
          typeof err.response.data?.message === "string"
            ? err.response.data.message
            : null;
        setError(apiMessage || "Login failed. Please try again.");
        return;
      }

      const reason = err instanceof Error ? err.message : String(err);
      setError(`Login failed. ${reason}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-stretch">
      <Card className="rounded-3xl border-white/15 bg-gradient-to-br from-violet-500/20 via-slate-900/70 to-cyan-500/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/90">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Login
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Access your TellNab account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-slate-200">Email</label>
            <input
              name="email"
              type="email"
              required
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-200">Password</label>
            <input
              name="password"
              type="password"
              required
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className={loading ? "opacity-70" : ""}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSocialLogin("google")}
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
          >
            Continue with Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSocialLogin("apple")}
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
          >
            Continue with Apple
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-300">
          No account?{" "}
          <Link to="/register" className="text-violet-300">
            Register
          </Link>
        </p>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Privacy first</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Post anonymously with moderator review.</li>
          <li>Follow threads and return to your watchlist.</li>
          <li>Use AI draft help before you submit.</li>
        </ul>
      </Card>
    </div>
  );
}
