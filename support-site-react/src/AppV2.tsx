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

const API_BASE =
  (window as any).SUPPORT_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api`;

function getErrorMessage(payload: ApiError | null, fallback: string) {
  if (!payload) return fallback;
  if (Array.isArray(payload.issues) && payload.issues[0]?.message)
    return payload.issues[0].message;
  if (typeof payload.message === "string" && payload.message.trim())
    return payload.message;
  return fallback;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as ApiError | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Support request failed."));
  }

  return payload as T;
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
      const session = await apiRequest<{ user: AuthUser }>("/auth/me");
      setAuthUser(session.user);
      return session.user;
    } catch {
      setAuthUser(null);
      return null;
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setTone("error");
      setStatus("Enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const login = await apiRequest<{ user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAuthUser(login.user);
      setTone("ok");
      setStatus(`Signed in as ${login.user.name}.`);
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
      const json = await apiRequest<TicketResponse>("/tickets?page=1&page_size=50");
      setTickets(json.data || []);
      setSelectedTicketId((prev) => prev || json.data?.[0]?.id || "");
      setTone("ok");
      setStatus(`Loaded ${json.data?.length || 0} tickets.`);
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
        <div>
          <h2>Support 2.0</h2>
          <p>Subdomain API: {API_BASE}</p>
          {authUser ? (
            <p>Signed in: {authUser.name} ({authUser.role})</p>
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

          <button onClick={refreshSession} disabled={loading}>
            Use existing session
          </button>

          <button onClick={loadTickets} disabled={loading || !authUser}>
            {loading ? "Loading..." : "Refresh tickets"}
          </button>
          {status ? <p data-tone={tone}>{status}</p> : null}
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
            <div>
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
