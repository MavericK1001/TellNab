import { FormEvent, useEffect, useMemo, useState } from "react";
import { SupportLayout } from "./modules/support-v2/components/SupportLayout";
import { TicketListTable } from "./modules/support-v2/components/TicketListTable";
import { TicketDetailPanel } from "./modules/support-v2/components/TicketDetailPanel";

type TicketRow = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  assigned_agent_id?: string | null;
  sla_due_at: string;
};

type TicketResponse = {
  data: TicketRow[];
  meta?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type ApiError = { message?: string; issues?: { message?: string }[] };

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const PRIMARY_API_BASE =
  (window as any).SUPPORT_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api`;

const API_BASE_CANDIDATES = Array.from(
  new Set([
    PRIMARY_API_BASE,
    "/api",
    "https://tellnab.onrender.com/api",
    "http://127.0.0.1:4000/api",
  ]),
);

function getErrorMessage(payload: ApiError | null, fallback: string) {
  if (!payload) return fallback;
  if (Array.isArray(payload.issues) && payload.issues[0]?.message)
    return payload.issues[0].message;
  if (typeof payload.message === "string" && payload.message.trim())
    return payload.message;
  return fallback;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return Boolean(
    typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.email === "string" &&
      typeof user.role === "string",
  );
}

function extractAuthUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== "object") return null;
  const maybeUser = (payload as { user?: unknown }).user;
  return isAuthUser(maybeUser) ? maybeUser : null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response | null = null;
  let payload: unknown = null;
  let lastError: unknown = null;

  for (const base of API_BASE_CANDIDATES) {
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers || {}),
        },
        credentials: "include",
      });

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      const isJsonResponse = contentType.includes("application/json");

      if (isJsonResponse) {
        payload = await response.json().catch(() => null);
      } else {
        payload = null;
      }

      if (response.ok && isJsonResponse) {
        return payload as T;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw (lastError as Error) || new Error("Support API is not reachable.");
  }

  throw new Error(getErrorMessage(payload as ApiError | null, "Support request failed."));
}

export default function AppV2() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [tone, setTone] = useState<"" | "ok" | "error">("");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const refreshSession = async () => {
    try {
      const session = await apiRequest<unknown>("/auth/me");
      const user = extractAuthUser(session);
      if (!user) {
        setAuthUser(null);
        return null;
      }
      setAuthUser(user);
      return user;
    } catch {
      setAuthUser(null);
      return null;
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const handleUseExistingSession = async () => {
    setLoading(true);
    try {
      const user = await refreshSession();
      if (!user) {
        setTone("error");
        setStatus("No active session found. Sign in first on tellnab.com or here.");
        return;
      }
      setTone("ok");
      setStatus(`Session found for ${user.name}.`);
    } catch (error) {
      setTone("error");
      setStatus(error instanceof Error ? error.message : "Could not read existing session.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setTone("error");
      setStatus("Enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const login = await apiRequest<unknown>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const user = extractAuthUser(login);
      if (!user) {
        throw new Error("Login succeeded but user session payload is invalid.");
      }
      setAuthUser(user);
      setTone("ok");
      setStatus(`Signed in as ${user.name}.`);
    } catch (error) {
      setTone("error");
      setStatus(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    const current = authUser || (await refreshSession());
    if (!current) {
      setTone("error");
      setStatus("Please sign in first.");
      return;
    }

    setLoading(true);
    try {
      const json = await apiRequest<TicketResponse | null>(
        "/tickets?page=1&page_size=50",
      );
      const rows = Array.isArray(json?.data) ? json.data : [];
      setTickets(rows);
      setSelectedTicketId((prev) => prev || rows[0]?.id || "");
      setTone("ok");
      setStatus(`Loaded ${rows.length} tickets.`);
    } catch (error) {
      setTone("error");
      setStatus(
        error instanceof Error ? error.message : "Unable to load tickets.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!selected) return;

    setLoading(true);
    try {
      await apiRequest(`/tickets/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setTone("ok");
      setStatus(`Ticket updated to ${nextStatus}.`);
      await loadTickets();
    } catch (error) {
      setTone("error");
      setStatus(
        error instanceof Error ? error.message : "Failed to update ticket.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SupportLayout
      sidebar={
        <div className="support-sidebar-stack">
          <h2>Support 2.0</h2>
          <p>Subdomain API: {PRIMARY_API_BASE}</p>
          {authUser ? (
            <p>
              Signed in: {authUser.name} ({authUser.role})
            </p>
          ) : (
            <p>Sign in with your normal TellNab account.</p>
          )}

          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@tellnab.com"
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="support-btn-row">
            <button onClick={handleUseExistingSession} disabled={loading}>
              Use existing session
            </button>

            <button onClick={loadTickets} disabled={loading || !authUser}>
              {loading ? "Loading..." : "Refresh tickets"}
            </button>
          </div>
          {status ? <p className={`status-message ${tone}`}>{status}</p> : null}
        </div>
      }
      topbar={
        <div>
          <strong>Support Ticket Console</strong>
          <p>Using your standard TellNab sign-in session.</p>
        </div>
      }
      list={<TicketListTable rows={tickets} onOpen={setSelectedTicketId} />}
      detail={
        selected ? (
          <div>
            <TicketDetailPanel
              ticketNumber={selected.ticket_number}
              subject={selected.subject}
              status={selected.status}
              priority={selected.priority}
              assignedAgent={selected.assigned_agent_id || null}
              slaDueAt={selected.sla_due_at}
            />
            <div className="support-btn-row">
              <button
                onClick={() => handleUpdateStatus("OPEN")}
                disabled={loading}
              >
                Mark OPEN
              </button>
              <button
                onClick={() => handleUpdateStatus("PENDING")}
                disabled={loading}
              >
                Mark PENDING
              </button>
              <button
                onClick={() => handleUpdateStatus("RESOLVED")}
                disabled={loading}
              >
                Mark RESOLVED
              </button>
            </div>
          </div>
        ) : (
          <p>Select a ticket from the list.</p>
        )
      }
    />
  );
}
