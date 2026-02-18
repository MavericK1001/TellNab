import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="mt-1 text-sm text-slate-300">
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
              className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-200">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-200">Password</label>
            <input
              name="password"
              type="password"
              minLength={12}
              required
              className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
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

        <p className="mt-4 text-sm text-slate-300">
          Already have an account?{" "}
          <Link to="/login" className="text-violet-300">
            Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
