const API_BASE =
  window.SUPPORT_API_BASE ||
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:4000/api"
    : "https://tellnab.onrender.com/api");

const form = document.getElementById("support-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = tone;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const payload = {
    requesterName: String(data.get("requesterName") || "").trim(),
    requesterEmail: String(data.get("requesterEmail") || "").trim(),
    type: String(data.get("type") || "INQUIRY"),
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
