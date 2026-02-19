import { spawn } from "node:child_process";

const BASE_URL = "http://127.0.0.1:4000";
const SERVER_START_TIMEOUT_MS = 15000;
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || "admin@tellnab.local";
const ADMIN_PASSWORD_CANDIDATES = [
  process.env.ADMIN_SEED_PASSWORD,
  "M@v99N@b!123",
  "ChangeMeNow!123",
].filter(Boolean);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(250);
  }
  return false;
}

async function req(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = {};
  try {
    json = await res.json();
  } catch {
    // ignore non-json responses
  }

  const setCookie = res.headers.get("set-cookie");
  const nextCookie = setCookie ? setCookie.split(";")[0] : cookie;

  return { ok: res.ok, status: res.status, json, cookie: nextCookie };
}

function logFailure(step, response) {
  console.error(`${step}_FAIL`, response.status, JSON.stringify(response.json));
}

async function loginAsAdmin() {
  for (const password of ADMIN_PASSWORD_CANDIDATES) {
    const response = await req("/api/auth/login", {
      method: "POST",
      body: {
        email: ADMIN_EMAIL,
        password,
      },
    });

    if (response.ok) {
      return response;
    }
  }

  return req("/api/auth/login", {
    method: "POST",
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD_CANDIDATES[0],
    },
  });
}

async function runSmoke() {
  let server = null;

  const healthyBeforeStart = await waitForHealth(1000);
  if (!healthyBeforeStart) {
    server = spawn("npm", ["run", "dev:server"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    server.stdout.on("data", (chunk) => {
      process.stdout.write(String(chunk));
    });

    server.stderr.on("data", (chunk) => {
      process.stderr.write(String(chunk));
    });
  }

  try {
    const healthy = await waitForHealth(SERVER_START_TIMEOUT_MS);
    if (!healthy) {
      throw new Error("Server did not become healthy in time");
    }

    const timestamp = Date.now();

    const reg = await req("/api/auth/register", {
      method: "POST",
      body: {
        name: "Member User",
        email: `member${timestamp}@test.local`,
        password: "MemberPass!1234",
      },
    });
    if (!reg.ok) {
      logFailure("REGISTER", reg);
      return 1;
    }

    const created = await req("/api/advice", {
      method: "POST",
      cookie: reg.cookie,
      body: {
        title: "Need honest advice about career switch",
        body: "I want to switch careers this year. Should I commit full-time or part-time first?",
      },
    });
    if (!created.ok) {
      logFailure("CREATE", created);
      return 1;
    }

    const adviceId = created.json?.advice?.id;
    if (!adviceId) {
      console.error("CREATE_FAIL", "Missing advice id in response");
      return 1;
    }

    const admin = await loginAsAdmin();
    if (!admin.ok) {
      logFailure("ADMIN_LOGIN", admin);
      return 1;
    }

    const approve = await req(`/api/moderation/advice/${adviceId}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { action: "APPROVED" },
    });
    if (!approve.ok) {
      logFailure("APPROVE", approve);
      return 1;
    }

    const feature = await req(`/api/moderation/advice/${adviceId}/flags`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { isFeatured: true },
    });
    if (!feature.ok) {
      logFailure("FEATURE", feature);
      return 1;
    }

    const open = await req(`/api/advice/${adviceId}`);
    if (!open.ok) {
      logFailure("OPEN", open);
      return 1;
    }

    const commentBefore = await req(`/api/advice/${adviceId}/comments`, {
      method: "POST",
      cookie: reg.cookie,
      body: { body: "My first comment as member" },
    });
    if (!commentBefore.ok) {
      logFailure("COMMENT1", commentBefore);
      return 1;
    }

    const lock = await req(`/api/moderation/advice/${adviceId}/flags`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { isLocked: true },
    });
    if (!lock.ok) {
      logFailure("LOCK", lock);
      return 1;
    }

    const commentAfter = await req(`/api/advice/${adviceId}/comments`, {
      method: "POST",
      cookie: reg.cookie,
      body: { body: "This should be blocked due to lock" },
    });

    if (commentAfter.ok) {
      logFailure("LOCK_ENFORCEMENT", commentAfter);
      return 1;
    }

    console.log(
      "SMOKE_OK",
      JSON.stringify(
        {
          adviceId,
          openStatus: open.status,
          firstCommentStatus: commentBefore.status,
          lockedCommentStatus: commentAfter.status,
          featured: feature.json?.advice?.isFeatured,
          locked: lock.json?.advice?.isLocked,
        },
        null,
        2,
      ),
    );

    return 0;
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

runSmoke()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error("SMOKE_UNHANDLED", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
