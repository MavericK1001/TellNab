import { FormEvent, useMemo, useState } from "react";
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

const TOKEN_KEY = "tellnab_support_v2_token";
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

async function apiRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
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
  const [token, setToken] = useState<string>(
    () => window.localStorage.getItem(TOKEN_KEY) || "",
  );
  const [tokenInput, setTokenInput] = useState<string>(
    () => window.localStorage.getItem(TOKEN_KEY) || "",
  );
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [tone, setTone] = useState<"" | "ok" | "error">("");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const handleSaveToken = (event: FormEvent) => {
    event.preventDefault();
    const next = tokenInput.trim();
    if (!next) {
      setTone("error");
      setStatus("Paste a valid bearer token.");
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setTone("ok");
    setStatus("Token saved.");
  };

  const loadTickets = async () => {
    if (!token) {
      setTone("error");
      setStatus("Set a bearer token first.");
      return;
    }

    setLoading(true);
    try {
      const json = await apiRequest<TicketResponse>(
        "/tickets?page=1&page_size=50",
        token,
      );
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
    if (!selected || !token) return;

    setLoading(true);
    try {
      await apiRequest(`/tickets/${encodeURIComponent(selected.id)}`, token, {
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
          <form onSubmit={handleSaveToken}>
            <label>Agent Bearer Token</label>
            <textarea
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              rows={4}
              placeholder="Paste token from /api/auth/login"
            />
            <button type="submit">Save token</button>
          </form>
          <button onClick={loadTickets} disabled={loading || !token}>
            {loading ? "Loading..." : "Refresh tickets"}
          </button>
          {status ? <p data-tone={tone}>{status}</p> : null}
        </div>
      }
      topbar={
        <div>
          <strong>Support Ticket Console</strong>
          <p>Using new module endpoints: /api/tickets*</p>
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
