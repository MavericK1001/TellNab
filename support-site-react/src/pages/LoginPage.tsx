import { FormEvent, useState } from "react";

type Props = {
  loading: boolean;
  status: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  onUseSession: () => Promise<void>;
};

export function LoginPage({ loading, status, onSubmit, onUseSession }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(email, password);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">TellNab Support</p>
        <h1>Sign in</h1>
        <p className="subtle">Use your existing TellNab account session.</p>

        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          className="ghost"
          disabled={loading}
          onClick={onUseSession}
        >
          Use existing session
        </button>

        {status ? <p className="status-message">{status}</p> : null}
      </section>
    </main>
  );
}
