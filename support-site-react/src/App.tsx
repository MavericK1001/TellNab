import { FormEvent, useEffect, useMemo, useState } from "react";

type SupportPriority = "URGENT" | "NORMAL" | "LOW";
type SupportType = "INQUIRY" | "ISSUE" | "SUGGESTION";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: SupportPriority;
  slaLabel: string;
  updatedAt: string;
  resolutionSummary: string | null;
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
  new Set([PRIMARY_API_BASE, "/api", "https://tellnab.onrender.com/api", "http://127.0.0.1:4000/api"]),
);

const SAVED_TICKETS_KEY = "tellnab_support_tickets";

const slaLabels: Record<SupportPriority, string> = {
  URGENT: "Urgent SLA: first response target is 4 hours.",
  NORMAL: "Normal SLA: first response target is 24 hours.",
  LOW: "Low SLA: first response target is 72 hours.",
};

const statusItems = [
  { title: "Core API", kind: "operational", state: "Operational", detail: "No active outage detected." },
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
  if (Array.isArray(apiError.issues) && apiError.issues.length > 0 && apiError.issues[0]?.message) {
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
    ...existing.filter((item) => !(item.ticketId === ticketId && item.requesterEmail === normalizedEmail)),
  ].slice(0, 20);

  window.localStorage.setItem(SAVED_TICKETS_KEY, JSON.stringify(next));
}

async function lookupTicket(ticketId: string, requesterEmail: string): Promise<Ticket> {
  const payload = {
    ticketId: ticketId.trim(),
    requesterEmail: requesterEmail.trim().toLowerCase(),
  };

  let response: Response | null = null;
  let json: any = {};
  let lastNetworkError: unknown = null;

  for (const base of API_BASE_CANDIDATES) {
    try {
      response = await fetch(`${base}/support/tickets/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      json = await response.json().catch(() => ({}));
      if (response.ok) break;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!response) throw lastNetworkError || new Error("Network request failed.");
  if (!response.ok) throw new Error(normalizeValidationMessage(json) || "Ticket not found.");
  if (!json.ticket) throw new Error("Ticket response missing payload.");
  return json.ticket as Ticket;
}

export default function App() {
  const queryPrefill = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      type: (params.get("type") || "INQUIRY") as SupportType,
      pageUrl: params.get("pageUrl") || "",
      subject: params.get("subject") || "",
    };
  }, []);

  const [formStatus, setFormStatus] = useState("");
  const [formTone, setFormTone] = useState<"" | "ok" | "error">("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [lookupTone, setLookupTone] = useState<"" | "ok" | "error">("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [type, setType] = useState<SupportType>(queryPrefill.type);
  const [priority, setPriority] = useState<SupportPriority>("NORMAL");
  const [pageUrl, setPageUrl] = useState(queryPrefill.pageUrl);
  const [subject, setSubject] = useState(queryPrefill.subject);
  const [message, setMessage] = useState("");

  const [lookupTicketId, setLookupTicketId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  useEffect(() => {
    const initialSaved = readSavedTickets();
    if (!initialSaved.length) return;

    setLookupStatus("Loading your recent tickets...");
    Promise.allSettled(initialSaved.map((item) => lookupTicket(item.ticketId, item.requesterEmail)))
      .then((results) => {
        const loaded = results
          .filter((result): result is PromiseFulfilledResult<Ticket> => result.status === "fulfilled")
          .map((result) => result.value);
        setTickets(loaded);
        setLookupStatus(loaded.length ? "Recent tickets loaded." : "No saved tickets found.");
      })
      .catch(() => {
        setTickets([]);
        setLookupTone("error");
        setLookupStatus("Could not load saved tickets.");
      });
  }, []);

  async function refreshSavedTickets() {
    const current = readSavedTickets();
    const results = await Promise.allSettled(current.map((item) => lookupTicket(item.ticketId, item.requesterEmail)));
    const loaded = results
      .filter((result): result is PromiseFulfilledResult<Ticket> => result.status === "fulfilled")
      .map((result) => result.value);
    setTickets(loaded);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (requesterName.trim().length < 2) {
      setFormTone("error");
      setFormStatus("Please enter your full name (min 2 characters).");
      return;
    }
    if (!requesterEmail.includes("@")) {
      setFormTone("error");
      setFormStatus("Please enter a valid email address.");
      return;
    }
    if (subject.trim().length < 5) {
      setFormTone("error");
      setFormStatus("Subject must be at least 5 characters.");
      return;
    }
    if (message.trim().length < 20) {
      setFormTone("error");
      setFormStatus("Message must be at least 20 characters.");
      return;
    }

    setLoading(true);
    setFormTone("");
    setFormStatus("Submitting...");

    const payload = {
      requesterName: requesterName.trim(),
      requesterEmail: requesterEmail.trim(),
      type,
      priority,
      pageUrl: pageUrl.trim(),
      subject: subject.trim(),
      message: message.trim(),
    };

    try {
      let response: Response | null = null;
      let json: any = {};
      let lastNetworkError: unknown = null;

      for (const base of API_BASE_CANDIDATES) {
        try {
          response = await fetch(`${base}/support/tickets`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          json = await response.json().catch(() => ({}));
          if (response.ok) break;
        } catch (error) {
          lastNetworkError = error;
        }
      }

      if (!response) throw lastNetworkError || new Error("Network request failed.");
      if (!response.ok) {
        throw new Error(normalizeValidationMessage(json) || "Failed to submit request.");
      }

      const createdId = json?.ticket?.id as string | undefined;
      if (createdId) {
        saveTicketReference(createdId, payload.requesterEmail);
        await refreshSavedTickets();
      }

      setRequesterName("");
      setRequesterEmail("");
      setType("INQUIRY");
      setPriority("NORMAL");
      setPageUrl("");
      setSubject("");
      setMessage("");

      setFormTone("ok");
      setFormStatus(`Submitted successfully. Ticket ID: ${createdId || "created"}.`);
    } catch (error) {
      setFormTone("error");
      setFormStatus(error instanceof Error ? error.message : "Something went wrong.");
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
      const ticket = await lookupTicket(lookupTicketId, lookupEmail);
      saveTicketReference(ticket.id, lookupEmail);
      await refreshSavedTickets();
      setLookupTone("ok");
      setLookupStatus("Ticket loaded.");
    } catch (error) {
      setLookupTone("error");
      setLookupStatus(error instanceof Error ? error.message : "Ticket lookup failed.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">support.tellnab.com</p>
        <h1>TellNab Support Center</h1>
        <p className="subtitle">Submit inquiries, report issues, or share suggestions.</p>
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

      <section className="panel">
        <h2>Contact support</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid two">
            <label>
              Full name
              <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} required />
            </label>
          </div>

          <div className="grid two">
            <label>
              Request type
              <select value={type} onChange={(e) => setType(e.target.value as SupportType)}>
                <option value="INQUIRY">General inquiry</option>
                <option value="ISSUE">Issue / bug</option>
                <option value="SUGGESTION">Feature suggestion</option>
              </select>
            </label>
            <label>
              Priority (SLA)
              <select value={priority} onChange={(e) => setPriority(e.target.value as SupportPriority)}>
                <option value="NORMAL">Normal • 24h first response</option>
                <option value="URGENT">Urgent • 4h first response</option>
                <option value="LOW">Low • 72h first response</option>
              </select>
            </label>
          </div>

          <label>
            Affected page URL (optional)
            <input type="url" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://tellnab.com/..." />
          </label>

          <p className="sla-info">{slaLabels[priority]}</p>

          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>

          <label>
            Message
            <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </label>

          <div className="actions">
            <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Send to support"}</button>
            <p className={formTone}>{formStatus}</p>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Your support inbox</h2>
        <form onSubmit={handleLookup} className="lookup-form">
          <div className="grid two">
            <label>
              Ticket ID
              <input value={lookupTicketId} onChange={(e) => setLookupTicketId(e.target.value)} required />
            </label>
            <label>
              Email used on ticket
              <input type="email" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} required />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={lookupLoading}>{lookupLoading ? "Checking..." : "Check ticket"}</button>
            <p className={lookupTone}>{lookupStatus}</p>
          </div>
        </form>

        <div className="ticket-inbox-list">
          {tickets.length === 0 ? (
            <p className="subtle">No tickets loaded yet. Submit a ticket or lookup by ID + email.</p>
          ) : (
            tickets.map((ticket) => (
              <article className="ticket-card" key={ticket.id}>
                <div className="ticket-top">
                  <p className="ticket-id">Ticket: {ticket.id}</p>
                  <span className={`status-pill ${String(ticket.status || "OPEN").toLowerCase()}`}>{ticket.status}</span>
                </div>
                <p className="ticket-subject">{ticket.subject}</p>
                <p className="ticket-meta">Priority: {ticket.priority} • SLA: {ticket.slaLabel}</p>
                <p className="ticket-meta">Updated: {new Date(ticket.updatedAt).toLocaleString()}</p>
                <div className="ticket-reply">
                  <p className="ticket-reply-label">Support reply</p>
                  <p>{ticket.resolutionSummary || "No reply yet. Our team will update this ticket soon."}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
