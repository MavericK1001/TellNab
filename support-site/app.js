const PRIMARY_API_BASE =
  window.SUPPORT_API_BASE ||
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

const form = document.getElementById("support-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const lookupForm = document.getElementById("ticket-lookup-form");
const lookupBtn = document.getElementById("lookup-btn");
const lookupStatusEl = document.getElementById("lookup-status");
const ticketInboxListEl = document.getElementById("ticket-inbox-list");
const prioritySelect = document.getElementById("priority-select");
const slaInfoEl = document.getElementById("sla-info");
const statusListEl = document.getElementById("status-list");
const SAVED_TICKETS_KEY = "tellnab_support_tickets";

const statusItems = [
  {
    title: "Core API",
    kind: "operational",
    state: "Operational",
    detail: "No active outage detected.",
    updatedAt: new Date().toISOString(),
  },
  {
    title: "Incident",
    kind: "incident",
    state: "Monitoring",
    detail: "Intermittent login delays earlier today are now stabilized.",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: "Maintenance window",
    kind: "maintenance",
    state: "Scheduled",
    detail: "Planned maintenance Sunday 02:00–03:00 UTC.",
    updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

const slaLabels = {
  URGENT: "Urgent SLA: first response target is 4 hours.",
  NORMAL: "Normal SLA: first response target is 24 hours.",
  LOW: "Low SLA: first response target is 72 hours.",
};

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = tone;
}

function setLookupStatus(text, tone = "") {
  lookupStatusEl.textContent = text;
  lookupStatusEl.className = tone;
}

function readSavedTickets() {
  try {
    const raw = window.localStorage.getItem(SAVED_TICKETS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTicketReference(ticketId, requesterEmail) {
  const existing = readSavedTickets();
  const next = [
    { ticketId, requesterEmail: requesterEmail.toLowerCase(), savedAt: new Date().toISOString() },
    ...existing.filter(
      (item) =>
        !(item.ticketId === ticketId && item.requesterEmail === requesterEmail.toLowerCase()),
    ),
  ].slice(0, 20);

  try {
    window.localStorage.setItem(SAVED_TICKETS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failure
  }
}

function renderTicketInbox(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    ticketInboxListEl.innerHTML =
      '<p class="subtle">No tickets loaded yet. Submit a ticket or lookup by ID + email.</p>';
    return;
  }

  ticketInboxListEl.innerHTML = tickets
    .map((ticket) => {
      const reply = ticket.resolutionSummary
        ? ticket.resolutionSummary
        : "No reply yet. Our team will update this ticket soon.";

      return `
        <article class="ticket-card">
          <div class="ticket-top">
            <p class="ticket-id">Ticket: ${ticket.id}</p>
            <span class="status-pill ${String(ticket.status || "OPEN").toLowerCase()}">${ticket.status}</span>
          </div>
          <p class="ticket-subject">${ticket.subject}</p>
          <p class="ticket-meta">Priority: ${ticket.priority} • SLA: ${ticket.slaLabel}</p>
          <p class="ticket-meta">Updated: ${new Date(ticket.updatedAt).toLocaleString()}</p>
          <div class="ticket-reply">
            <p class="ticket-reply-label">Support reply</p>
            <p>${reply}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function lookupTicket(ticketId, requesterEmail) {
  const payload = {
    ticketId: String(ticketId || "").trim(),
    requesterEmail: String(requesterEmail || "").trim().toLowerCase(),
  };

  if (payload.ticketId.length < 8) {
    throw new Error("Ticket ID must be at least 8 characters.");
  }

  if (!payload.requesterEmail.includes("@")) {
    throw new Error("Please enter the same email used when submitting the ticket.");
  }

  let response = null;
  let json = {};
  let lastNetworkError = null;

  for (const base of API_BASE_CANDIDATES) {
    try {
      response = await fetch(`${base}/support/tickets/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      json = await response.json().catch(() => ({}));
      if (response.ok) {
        break;
      }
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!response) {
    throw lastNetworkError || new Error("Network request failed.");
  }

  if (!response.ok) {
    throw new Error(normalizeValidationMessage(json) || "Ticket not found.");
  }

  if (!json.ticket) {
    throw new Error("Ticket response missing payload.");
  }

  return json.ticket;
}

function normalizeValidationMessage(apiError) {
  if (!apiError || typeof apiError !== "object") {
    return null;
  }

  if (Array.isArray(apiError.issues) && apiError.issues.length > 0) {
    const firstIssue = apiError.issues[0];
    if (firstIssue && typeof firstIssue.message === "string") {
      return firstIssue.message;
    }
  }

  if (typeof apiError.message === "string") {
    return apiError.message;
  }

  return null;
}

function renderStatusItems() {
  statusListEl.innerHTML = statusItems
    .map(
      (item) => `
      <article class="status-card">
        <span class="status-pill ${item.kind}">${item.state}</span>
        <p class="status-title">${item.title}</p>
        <p class="status-meta">${item.detail}</p>
        <p class="status-meta">Updated: ${new Date(item.updatedAt).toLocaleString()}</p>
      </article>
    `,
    )
    .join("");
}

function applyQueryPrefill() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const pageUrl = params.get("pageUrl");
  const subject = params.get("subject");

  if (type && ["INQUIRY", "ISSUE", "SUGGESTION"].includes(type)) {
    form.elements.type.value = type;
  }

  if (pageUrl) {
    form.elements.pageUrl.value = pageUrl;
  }

  if (subject) {
    form.elements.subject.value = subject;
  }
}

function syncSlaInfo() {
  slaInfoEl.textContent = slaLabels[prioritySelect.value] || "";
}

renderStatusItems();
applyQueryPrefill();
syncSlaInfo();
prioritySelect.addEventListener("change", syncSlaInfo);

const initialSavedTickets = readSavedTickets();
if (initialSavedTickets.length > 0) {
  setLookupStatus("Loading your recent tickets...", "");
  Promise.allSettled(
    initialSavedTickets.map((item) => lookupTicket(item.ticketId, item.requesterEmail)),
  )
    .then((results) => {
      const tickets = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      renderTicketInbox(tickets);
      setLookupStatus(tickets.length ? "Recent tickets loaded." : "No saved tickets found.", "");
    })
    .catch(() => {
      renderTicketInbox([]);
      setLookupStatus("Could not load saved tickets.", "error");
    });
} else {
  renderTicketInbox([]);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const payload = {
    requesterName: String(data.get("requesterName") || "").trim(),
    requesterEmail: String(data.get("requesterEmail") || "").trim(),
    type: String(data.get("type") || "INQUIRY"),
    priority: String(data.get("priority") || "NORMAL"),
    pageUrl: String(data.get("pageUrl") || "").trim(),
    subject: String(data.get("subject") || "").trim(),
    message: String(data.get("message") || "").trim(),
  };

  if (payload.requesterName.length < 2) {
    setStatus("Please enter your full name (min 2 characters).", "error");
    return;
  }
  if (!payload.requesterEmail.includes("@")) {
    setStatus("Please enter a valid email address.", "error");
    return;
  }
  if (payload.subject.length < 5) {
    setStatus("Subject must be at least 5 characters.", "error");
    return;
  }
  if (payload.message.length < 20) {
    setStatus("Message must be at least 20 characters.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Submitting...", "");

  try {
    let response = null;
    let json = {};
    let lastNetworkError = null;

    for (const base of API_BASE_CANDIDATES) {
      try {
        response = await fetch(`${base}/support/tickets`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        json = await response.json().catch(() => ({}));
        if (response.ok) {
          break;
        }
      } catch (error) {
        lastNetworkError = error;
      }
    }

    if (!response) {
      throw (
        lastNetworkError ||
        new Error("Network request failed. Please try again in a moment.")
      );
    }

    if (!response.ok) {
      const detailedMessage = normalizeValidationMessage(json);
      throw new Error(
        detailedMessage ||
          "Failed to submit request. If this persists, check CORS_ORIGINS includes support.tellnab.com.",
      );
    }

    form.reset();
    saveTicketReference(json?.ticket?.id, payload.requesterEmail);
    setStatus(
      `Submitted successfully. Ticket ID: ${json?.ticket?.id || "created"}.`,
      "ok",
    );

    const currentTickets = readSavedTickets();
    Promise.allSettled(
      currentTickets.map((item) => lookupTicket(item.ticketId, item.requesterEmail)),
    ).then((results) => {
      const tickets = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      renderTicketInbox(tickets);
    });
  } catch (error) {
    const message =
      error instanceof Error &&
      /Failed to fetch|Load failed|NetworkError/i.test(error.message)
        ? "Request could not reach support API. Please retry. If it keeps failing, backend CORS may still be missing support.tellnab.com."
        : error instanceof Error
          ? error.message
          : "Something went wrong.";

    setStatus(message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(lookupForm);
  const ticketId = String(data.get("ticketId") || "").trim();
  const requesterEmail = String(data.get("requesterEmail") || "").trim();

  lookupBtn.disabled = true;
  setLookupStatus("Checking ticket...", "");

  try {
    const ticket = await lookupTicket(ticketId, requesterEmail);
    saveTicketReference(ticket.id, requesterEmail);
    const currentTickets = readSavedTickets();
    const ticketResults = await Promise.allSettled(
      currentTickets.map((item) => lookupTicket(item.ticketId, item.requesterEmail)),
    );
    const tickets = ticketResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    renderTicketInbox(tickets);
    setLookupStatus("Ticket loaded.", "ok");
  } catch (error) {
    setLookupStatus(error instanceof Error ? error.message : "Ticket lookup failed.", "error");
  } finally {
    lookupBtn.disabled = false;
  }
});
