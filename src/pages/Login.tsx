import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import Card from "../components/Card";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

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
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-bold text-white">Login</h1>
        <p className="mt-1 text-sm text-slate-300">
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
              className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
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
              className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="button"
            onClick={() => {
              setEmailInput("admin@tellnab.local");
              setPasswordInput("ChangeMeNow!123");
            }}
            className="text-xs text-violet-300 hover:text-violet-200"
          >
            Use local admin credentials
          </button>

          <Button type="submit" className={loading ? "opacity-70" : ""}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-300">
          No account?{" "}
          <Link to="/register" className="text-violet-300">
            Register
          </Link>
        </p>
      </Card>
    </div>
  );
}
