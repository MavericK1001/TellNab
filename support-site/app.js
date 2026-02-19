const API_BASE =
  window.SUPPORT_API_BASE ||
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:4000/api"
    : "https://tellnab.onrender.com/api");

const form = document.getElementById("support-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const prioritySelect = document.getElementById("priority-select");
const slaInfoEl = document.getElementById("sla-info");
const statusListEl = document.getElementById("status-list");

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

  submitBtn.disabled = true;
  setStatus("Submitting...", "");

  try {
    const response = await fetch(`${API_BASE}/support/tickets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(json?.message || "Failed to submit request.");
    }

    form.reset();
    setStatus(
      `Submitted successfully. Ticket ID: ${json?.ticket?.id || "created"}.`,
      "ok",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
