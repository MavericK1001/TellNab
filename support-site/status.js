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
