import { FormEvent, useEffect, useMemo, useState } from "react";

type SupportPriority = "URGENT" | "NORMAL" | "LOW";
type SupportType = "INQUIRY" | "ISSUE" | "SUGGESTION";
type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: SupportStatus;
  type: SupportType;
  priority: SupportPriority;
  slaLabel: string;
  updatedAt: string;
  requesterName: string;
  requesterEmail: string;
  resolutionSummary: string | null;
  assignedTo?: { id: string; name: string; role: string } | null;
};

type TicketMessage = {
  id: string;
  senderType: "MEMBER" | "AGENT" | "SYSTEM";
  senderName: string | null;
  body: string;
  createdAt: string;
};

type AgentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SavedTicket = {
  ticketId: string;
  requesterEmail: string;
};

const PRIMARY_API_BASE =
  (window as any).SUPPORT_API_BASE ||
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:4000/api"
    : "https://tellnab.onrender.com/api");

const API_BASE_CANDIDATES = Array.from(
  new Set([
    PRIMARY_API_BASE,
    "/api",
    "https://tellnab.onrender.com/api",
    "http://127.0.0.1:4000/api",
  ]),
);

const SAVED_TICKETS_KEY = "tellnab_support_tickets";
const AGENT_TOKEN_KEY = "tellnab_support_agent_token";

const slaLabels: Record<SupportPriority, string> = {
  URGENT: "Urgent SLA: first response target is 4 hours.",
  NORMAL: "Normal SLA: first response target is 24 hours.",
  LOW: "Low SLA: first response target is 72 hours.",
};

const statusItems = [
  {
    title: "Core API",
    kind: "operational",
    state: "Operational",
    detail: "No active outage detected.",
  },
  {
    title: "Incident",
    kind: "incident",
    state: "Monitoring",
    detail: "Intermittent login delays earlier today are now stabilized.",
  },
  {
    title: "Maintenance window",
    kind: "maintenance",
    state: "Scheduled",
    detail: "Planned maintenance Sunday 02:00–03:00 UTC.",
  },
];

function normalizeValidationMessage(apiError: any) {
  if (!apiError || typeof apiError !== "object") return null;
  if (
    Array.isArray(apiError.issues) &&
    apiError.issues.length > 0 &&
    apiError.issues[0]?.message
  ) {
    return apiError.issues[0].message as string;
  }
  if (typeof apiError.message === "string") return apiError.message;
  return null;
}

function readSavedTickets(): SavedTicket[] {
  try {
    const raw = window.localStorage.getItem(SAVED_TICKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTicketReference(ticketId: string, requesterEmail: string) {
  const normalizedEmail = requesterEmail.toLowerCase();
  const existing = readSavedTickets();
  const next = [
    { ticketId, requesterEmail: normalizedEmail },
    ...existing.filter(
      (item) =>
        !(
          item.ticketId === ticketId && item.requesterEmail === normalizedEmail
        ),
    ),
  ].slice(0, 20);

  window.localStorage.setItem(SAVED_TICKETS_KEY, JSON.stringify(next));
}

async function apiRequest(
  path: string,
  init?: RequestInit,
  options?: { includeCreds?: boolean; authToken?: string | null },
) {
  const includeCreds = options?.includeCreds === true;
  const authToken = options?.authToken || null;
  let response: Response | null = null;
  let json: any = {};
  let lastNetworkError: unknown = null;

  for (const base of API_BASE_CANDIDATES) {
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init?.headers || {}),
        },
        credentials: includeCreds ? "include" : "same-origin",
      });

      const contentType =
        response.headers.get("content-type")?.toLowerCase() || "";
      const isJsonResponse =
        contentType.includes("application/json") ||
        contentType.includes("application/problem+json");

      if (!isJsonResponse) {
        // Some hosts rewrite unknown routes to index.html (200 text/html).
        // Treat that as an invalid API response and try the next base URL.
        if (response.ok) {
          continue;
        }
        json = {};
      } else {
        json = await response.json().catch(() => ({}));
      }

      if (response.ok) return json;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!response) {
    throw lastNetworkError || new Error("Network request failed.");
  }
  throw new Error(normalizeValidationMessage(json) || "Request failed.");
}

async function loadMemberThread(ticketId: string, requesterEmail: string) {
  const json = await apiRequest(
    `/support/tickets/${encodeURIComponent(
      ticketId,
    )}/thread?requesterEmail=${encodeURIComponent(requesterEmail)}`,
    { method: "GET" },
  );
  return json as { ticket: Ticket; messages: TicketMessage[] };
}

export default function App() {
  const queryPrefill = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      type: (params.get("type") || "INQUIRY") as SupportType,
      pageUrl: params.get("pageUrl") || "",
      subject: params.get("subject") || "",
      ticketId: params.get("ticketId") || "",
      email: params.get("email") || "",
      view: params.get("view") || "",
    };
  }, []);

  const [mode, setMode] = useState<"member" | "agent">(
    queryPrefill.view === "agent" ? "agent" : "member",
  );

  const [formStatus, setFormStatus] = useState("");
  const [formTone, setFormTone] = useState<"" | "ok" | "error">("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [lookupTone, setLookupTone] = useState<"" | "ok" | "error">("");
  const [memberTickets, setMemberTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<TicketMessage[]>([]);
  const [memberReply, setMemberReply] = useState("");
  const [isMemberChatOpen, setIsMemberChatOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [memberReplyLoading, setMemberReplyLoading] = useState(false);

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [type, setType] = useState<SupportType>(queryPrefill.type);
  const [priority, setPriority] = useState<SupportPriority>("NORMAL");
  const [pageUrl, setPageUrl] = useState(queryPrefill.pageUrl);
  const [subject, setSubject] = useState(queryPrefill.subject);
  const [message, setMessage] = useState("");

  const [lookupTicketId, setLookupTicketId] = useState(queryPrefill.ticketId);
  const [lookupEmail, setLookupEmail] = useState(queryPrefill.email);

  const [agentUser, setAgentUser] = useState<AgentUser | null>(null);
  const [agentToken, setAgentToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(AGENT_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [agentTickets, setAgentTickets] = useState<Ticket[]>([]);
  const [agentSelectedTicket, setAgentSelectedTicket] = useState<Ticket | null>(
    null,
  );
  const [agentMessages, setAgentMessages] = useState<TicketMessage[]>([]);
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [agentTone, setAgentTone] = useState<"" | "ok" | "error">("");
  const [agentReply, setAgentReply] = useState("");
  const [agentReplyLoading, setAgentReplyLoading] = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [ticketStatusDraft, setTicketStatusDraft] =
    useState<SupportStatus>("IN_PROGRESS");
  const [ticketPriorityDraft, setTicketPriorityDraft] =
    useState<SupportPriority>("NORMAL");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "mine" | "unassigned"
  >("all");
  const [agentLoadingTickets, setAgentLoadingTickets] = useState(false);

  async function refreshSavedTickets() {
    const current = readSavedTickets();
    const results = await Promise.allSettled(
      current.map((item) =>
        loadMemberThread(item.ticketId, item.requesterEmail),
      ),
    );
    const loaded = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          ticket: Ticket;
          messages: TicketMessage[];
        }> => result.status === "fulfilled",
      )
      .map((result) => result.value.ticket)
      .filter((ticket): ticket is Ticket => Boolean(ticket && ticket.id));
    setMemberTickets(loaded);
  }

  async function openMemberThread(ticketId: string, email: string) {
    const data = await loadMemberThread(ticketId, email.toLowerCase());
    setSelectedTicket(data.ticket);
    setSelectedMessages(data.messages);
    setIsMemberChatOpen(true);
    saveTicketReference(ticketId, email);
    await refreshSavedTickets();
  }

  useEffect(() => {
    const initialSaved = readSavedTickets();
    if (!initialSaved.length && !(queryPrefill.ticketId && queryPrefill.email))
      return;

    if (queryPrefill.ticketId && queryPrefill.email) {
      saveTicketReference(queryPrefill.ticketId, queryPrefill.email);
    }

    setLookupStatus("Loading your recent tickets...");
    refreshSavedTickets()
      .then(() => setLookupStatus("Recent tickets loaded."))
      .catch(() => {
        setLookupTone("error");
        setLookupStatus("Could not load saved tickets.");
      });
  }, [queryPrefill.ticketId, queryPrefill.email]);

  useEffect(() => {
    if (!(queryPrefill.ticketId && queryPrefill.email)) return;
    openMemberThread(queryPrefill.ticketId, queryPrefill.email).catch(() => {
      // ignore auto-open failures; user can manually lookup
    });
  }, [queryPrefill.ticketId, queryPrefill.email]);

  useEffect(() => {
    if (!agentToken) {
      setAgentUser(null);
      return;
    }

    loadAgentMe().catch(() => {
      setAgentToken(null);
      setAgentUser(null);
      try {
        window.localStorage.removeItem(AGENT_TOKEN_KEY);
      } catch {
        // ignore storage failure
      }
    });
  }, [agentToken]);

  async function loadAgentMe() {
    const json = await apiRequest(
      "/support/agent/me",
      { method: "GET" },
      { authToken: agentToken, includeCreds: true },
    );
    setAgentUser(json.user as AgentUser);
  }

  async function loadAgentTickets() {
    if (!agentUser) return;
    setAgentLoadingTickets(true);
    try {
      const query = new URLSearchParams();
      if (assignmentFilter !== "all") {
        query.set("assigned", assignmentFilter);
      }
      const json = await apiRequest(
        `/support/agent/tickets?${query.toString()}`,
        { method: "GET" },
        { authToken: agentToken, includeCreds: true },
      );
      setAgentTickets((json.tickets || []) as Ticket[]);
    } finally {
      setAgentLoadingTickets(false);
    }
  }

  async function openAgentTicket(ticketId: string) {
    const json = await apiRequest(
      `/support/agent/tickets/${encodeURIComponent(ticketId)}`,
      { method: "GET" },
      { authToken: agentToken, includeCreds: true },
    );
    setAgentSelectedTicket(json.ticket as Ticket);
    setAgentMessages((json.messages || []) as TicketMessage[]);
    setTicketStatusDraft(
      (json.ticket?.status || "IN_PROGRESS") as SupportStatus,
    );
    setTicketPriorityDraft(
      (json.ticket?.priority || "NORMAL") as SupportPriority,
    );
  }

  useEffect(() => {
    if (!agentUser) return;
    loadAgentTickets().catch((error) => {
      setAgentTone("error");
      setAgentStatus(
        error instanceof Error
          ? error.message
          : "Failed to load agent tickets.",
      );
    });
  }, [agentUser, assignmentFilter]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFormTone("");
    setFormStatus("Submitting...");

    try {
      const json = await apiRequest("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim(),
          type,
          priority,
          pageUrl: pageUrl.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const createdId = json?.ticket?.id as string | undefined;
      if (createdId) {
        saveTicketReference(createdId, requesterEmail);
        await refreshSavedTickets();
        await openMemberThread(createdId, requesterEmail);
      }

      setRequesterName("");
      setRequesterEmail("");
      setType("INQUIRY");
      setPriority("NORMAL");
      setPageUrl("");
      setSubject("");
      setMessage("");
      setFormTone("ok");
      setFormStatus(
        `Submitted successfully. Ticket ID: ${createdId || "created"}.`,
      );
    } catch (error) {
      setFormTone("error");
      setFormStatus(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(event: FormEvent) {
    event.preventDefault();
    setLookupLoading(true);
    setLookupTone("");
    setLookupStatus("Checking ticket...");

    try {
      await openMemberThread(lookupTicketId, lookupEmail);
      setLookupTone("ok");
      setLookupStatus("Ticket loaded.");
    } catch (error) {
      setLookupTone("error");
      setLookupStatus(
        error instanceof Error ? error.message : "Ticket lookup failed.",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleMemberReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedTicket) return;

    setMemberReplyLoading(true);
    try {
      await apiRequest(
        `/support/tickets/${encodeURIComponent(selectedTicket.id)}/replies`,
        {
          method: "POST",
          body: JSON.stringify({
            requesterEmail: selectedTicket.requesterEmail,
            message: memberReply.trim(),
          }),
        },
      );
      setMemberReply("");
      await openMemberThread(selectedTicket.id, selectedTicket.requesterEmail);
    } catch (error) {
      setLookupTone("error");
      setLookupStatus(
        error instanceof Error ? error.message : "Failed to send reply.",
      );
    } finally {
      setMemberReplyLoading(false);
    }
  }

  async function handleMemberClose() {
    if (!selectedTicket) return;
    try {
      await apiRequest(
        `/support/tickets/${encodeURIComponent(selectedTicket.id)}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            requesterEmail: selectedTicket.requesterEmail,
          }),
        },
      );
      await openMemberThread(selectedTicket.id, selectedTicket.requesterEmail);
    } catch (error) {
      setLookupTone("error");
      setLookupStatus(
        error instanceof Error ? error.message : "Failed to close ticket.",
      );
    }
  }

  async function handleAgentLogin(event: FormEvent) {
    event.preventDefault();
    setAgentTone("");
    setAgentStatus("Signing in...");
    try {
      const loginJson = await apiRequest(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: agentEmail.trim(),
            password: agentPassword,
          }),
        },
        { includeCreds: true },
      );

      const token = String(loginJson?.token || "").trim();
      if (!token) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      setAgentToken(token);
      try {
        window.localStorage.setItem(AGENT_TOKEN_KEY, token);
      } catch {
        // ignore storage failure
      }

      if (loginJson?.user) {
        setAgentUser(loginJson.user as AgentUser);
      } else {
        await loadAgentMe();
      }
      setAgentTone("ok");
      setAgentStatus("Signed in. Loading tickets...");
    } catch (error) {
      setAgentTone("error");
      setAgentStatus(
        error instanceof Error ? error.message : "Agent login failed.",
      );
    }
  }

  async function handleAgentReply(event: FormEvent) {
    event.preventDefault();
    if (!agentSelectedTicket) return;

    setAgentReplyLoading(true);
    try {
      await apiRequest(
        `/support/agent/tickets/${encodeURIComponent(
          agentSelectedTicket.id,
        )}/replies`,
        {
          method: "POST",
          body: JSON.stringify({
            message: agentReply.trim(),
            status: ticketStatusDraft,
            notifyByEmail,
          }),
        },
        { authToken: agentToken, includeCreds: true },
      );
      setAgentReply("");
      await openAgentTicket(agentSelectedTicket.id);
      await loadAgentTickets();
      setAgentTone("ok");
      setAgentStatus("Reply sent and ticket updated.");
    } catch (error) {
      setAgentTone("error");
      setAgentStatus(
        error instanceof Error ? error.message : "Failed to send agent reply.",
      );
    } finally {
      setAgentReplyLoading(false);
    }
  }

  async function saveAgentTicketControls(assignToMe = false, unassign = false) {
    if (!agentSelectedTicket) return;

    try {
      await apiRequest(
        `/support/agent/tickets/${encodeURIComponent(agentSelectedTicket.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: ticketStatusDraft,
            priority: ticketPriorityDraft,
            ...(assignToMe && agentUser ? { assignedToId: agentUser.id } : {}),
            ...(unassign ? { assignedToId: null } : {}),
          }),
        },
        { authToken: agentToken, includeCreds: true },
      );
      await openAgentTicket(agentSelectedTicket.id);
      await loadAgentTickets();
      setAgentTone("ok");
      setAgentStatus("Ticket settings saved.");
    } catch (error) {
      setAgentTone("error");
      setAgentStatus(
        error instanceof Error
          ? error.message
          : "Failed to save ticket settings.",
      );
    }
  }

  function handleAgentLogout() {
    setAgentToken(null);
    setAgentUser(null);
    setAgentTickets([]);
    setAgentSelectedTicket(null);
    setAgentMessages([]);
    setAgentReply("");
    setAgentStatus("Signed out.");
    setAgentTone("");
    try {
      window.localStorage.removeItem(AGENT_TOKEN_KEY);
    } catch {
      // ignore storage failure
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">support.tellnab.com</p>
        <h1>TellNab Support Center</h1>
        <p className="subtitle">
          Member support chat + support team ticket workspace.
        </p>
        <div className="mode-switch">
          <button
            type="button"
            className={mode === "member" ? "active-tab" : ""}
            onClick={() => setMode("member")}
          >
            Member Portal
          </button>
          <button
            type="button"
            className={mode === "agent" ? "active-tab" : ""}
            onClick={() => setMode("agent")}
          >
            Support Team
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Public system status</h2>
        <div className="status-grid">
          {statusItems.map((item) => (
            <article className="status-card" key={item.title}>
              <span className={`status-pill ${item.kind}`}>{item.state}</span>
              <p className="status-title">{item.title}</p>
              <p className="status-meta">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {mode === "member" ? (
        <>
          <section className="panel">
            <h2>Create support ticket</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid two">
                <label>
                  Full name
                  <input
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="grid two">
                <label>
                  Request type
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as SupportType)}
                  >
                    <option value="INQUIRY">General inquiry</option>
                    <option value="ISSUE">Issue / bug</option>
                    <option value="SUGGESTION">Feature suggestion</option>
                  </select>
                </label>
                <label>
                  Priority (SLA)
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as SupportPriority)
                    }
                  >
                    <option value="NORMAL">Normal • 24h first response</option>
                    <option value="URGENT">Urgent • 4h first response</option>
                    <option value="LOW">Low • 72h first response</option>
                  </select>
                </label>
              </div>
              <label>
                Affected page URL (optional)
                <input
                  type="url"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://tellnab.com/..."
                />
              </label>
              <p className="sla-info">{slaLabels[priority]}</p>
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </label>
              <label>
                Message
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </label>
              <div className="actions">
                <button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Send to support"}
                </button>
                <p className={formTone}>{formStatus}</p>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Your support inbox</h2>
            <p className="subtle">
              Open any ticket to launch chat in a side panel. You can reply or
              close from there.
            </p>
            <form onSubmit={handleLookup} className="lookup-form">
              <div className="grid two">
                <label>
                  Ticket ID
                  <input
                    value={lookupTicketId}
                    onChange={(e) => setLookupTicketId(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Email used on ticket
                  <input
                    type="email"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="actions">
                <button type="submit" disabled={lookupLoading}>
                  {lookupLoading ? "Checking..." : "Open ticket"}
                </button>
                <p className={lookupTone}>{lookupStatus}</p>
              </div>
            </form>

            <div className="ticket-inbox-list">
              {memberTickets.length === 0 ? (
                <p className="subtle">
                  No tickets loaded yet. Submit a ticket or lookup by ID +
                  email.
                </p>
              ) : (
                memberTickets.map((ticket) => (
                  <article
                    className="ticket-card clickable"
                    key={ticket.id}
                    onClick={() =>
                      openMemberThread(ticket.id, ticket.requesterEmail)
                    }
                  >
                    <div className="ticket-top">
                      <p className="ticket-id">Ticket: {ticket.id}</p>
                      <span
                        className={`status-pill ${String(
                          ticket.status,
                        ).toLowerCase()}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="ticket-subject">{ticket.subject}</p>
                    <p className="ticket-meta">
                      Updated: {new Date(ticket.updatedAt).toLocaleString()}
                    </p>
                  </article>
                ))
              )}
            </div>

            {isMemberChatOpen && selectedTicket ? (
              <>
                <div
                  className="chat-overlay"
                  onClick={() => setIsMemberChatOpen(false)}
                />
                <aside className="chat-drawer" role="dialog" aria-modal="true">
                  <div className="chat-drawer-head">
                    <div>
                      <p className="ticket-meta">
                        Ticket ID: {selectedTicket.id}
                      </p>
                      <h3>{selectedTicket.subject}</h3>
                    </div>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setIsMemberChatOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="thread-list">
                    {selectedMessages.map((item) => (
                      <div
                        key={item.id}
                        className={`chat-bubble ${
                          item.senderType === "MEMBER"
                            ? "member"
                            : item.senderType === "AGENT"
                            ? "agent"
                            : "system"
                        }`}
                      >
                        <p className="bubble-meta">
                          {item.senderName || item.senderType} •{" "}
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <p>{item.body}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleMemberReply}>
                    <label>
                      Reply to support
                      <textarea
                        value={memberReply}
                        rows={4}
                        onChange={(e) => setMemberReply(e.target.value)}
                        required
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" disabled={memberReplyLoading}>
                        {memberReplyLoading ? "Sending..." : "Send reply"}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={handleMemberClose}
                      >
                        Close ticket
                      </button>
                    </div>
                  </form>
                </aside>
              </>
            ) : null}
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Support team workspace</h2>
          <p className="subtle">
            Pick a ticket from the left, manage status/assignment, and reply in
            one place.
          </p>
          {!agentUser ? (
            <form onSubmit={handleAgentLogin}>
              <div className="grid two">
                <label>
                  Support email
                  <input
                    type="email"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="actions">
                <button type="submit">Sign in as support</button>
                <p className={agentTone}>{agentStatus}</p>
              </div>
            </form>
          ) : (
            <div className="split-grid">
              <div>
                <div className="actions">
                  <p className="subtle">
                    Signed in as {agentUser.name} ({agentUser.role})
                  </p>
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleAgentLogout}
                  >
                    Sign out
                  </button>
                  <select
                    value={assignmentFilter}
                    onChange={(e) =>
                      setAssignmentFilter(
                        e.target.value as "all" | "mine" | "unassigned",
                      )
                    }
                  >
                    <option value="all">All tickets</option>
                    <option value="mine">Assigned to me</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </div>
                {agentLoadingTickets ? (
                  <p className="subtle">Loading tickets...</p>
                ) : (
                  <div className="ticket-inbox-list">
                    {agentTickets.map((ticket) => (
                      <article
                        className="ticket-card clickable"
                        key={ticket.id}
                        onClick={() => openAgentTicket(ticket.id)}
                      >
                        <div className="ticket-top">
                          <p className="ticket-id">{ticket.id}</p>
                          <span
                            className={`status-pill ${String(
                              ticket.status,
                            ).toLowerCase()}`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <p className="ticket-subject">{ticket.subject}</p>
                        <p className="ticket-meta">{ticket.requesterEmail}</p>
                        <p className="ticket-meta">
                          {ticket.assignedTo?.name
                            ? `Assigned: ${ticket.assignedTo.name}`
                            : "Unassigned"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="chat-panel">
                {!agentSelectedTicket ? (
                  <p className="subtle">
                    Select a ticket to open chat and manage controls.
                  </p>
                ) : (
                  <>
                    <div className="ticket-top">
                      <h3>{agentSelectedTicket.subject}</h3>
                      <span
                        className={`status-pill ${String(
                          agentSelectedTicket.status,
                        ).toLowerCase()}`}
                      >
                        {agentSelectedTicket.status}
                      </span>
                    </div>
                    <p className="ticket-meta">
                      Requester: {agentSelectedTicket.requesterName} •{" "}
                      {agentSelectedTicket.requesterEmail}
                    </p>

                    <div className="grid two compact">
                      <label>
                        Status
                        <select
                          value={ticketStatusDraft}
                          onChange={(e) =>
                            setTicketStatusDraft(
                              e.target.value as SupportStatus,
                            )
                          }
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </label>
                      <label>
                        Priority
                        <select
                          value={ticketPriorityDraft}
                          onChange={(e) =>
                            setTicketPriorityDraft(
                              e.target.value as SupportPriority,
                            )
                          }
                        >
                          <option value="URGENT">URGENT</option>
                          <option value="NORMAL">NORMAL</option>
                          <option value="LOW">LOW</option>
                        </select>
                      </label>
                    </div>

                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => saveAgentTicketControls(false, false)}
                      >
                        Save settings
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => saveAgentTicketControls(true, false)}
                      >
                        Assign to me
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => saveAgentTicketControls(false, true)}
                      >
                        Unassign
                      </button>
                    </div>

                    <div className="thread-list">
                      {agentMessages.map((item) => (
                        <div
                          key={item.id}
                          className={`chat-bubble ${
                            item.senderType === "MEMBER"
                              ? "member"
                              : item.senderType === "AGENT"
                              ? "agent"
                              : "system"
                          }`}
                        >
                          <p className="bubble-meta">
                            {item.senderName || item.senderType} •{" "}
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                          <p>{item.body}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAgentReply}>
                      <label>
                        Reply to member
                        <textarea
                          rows={4}
                          value={agentReply}
                          onChange={(e) => setAgentReply(e.target.value)}
                          required
                        />
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={notifyByEmail}
                          onChange={(e) => setNotifyByEmail(e.target.checked)}
                        />
                        Notify member by email
                      </label>
                      <div className="actions">
                        <button type="submit" disabled={agentReplyLoading}>
                          {agentReplyLoading
                            ? "Sending..."
                            : "Send support reply"}
                        </button>
                        <p className={agentTone}>{agentStatus}</p>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
