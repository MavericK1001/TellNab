import { spawn } from "node:child_process";

const BASE_URL = "http://127.0.0.1:4000";
const SERVER_START_TIMEOUT_MS = 15000;

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

function fail(step, response) {
  console.error(`${step}_FAIL`, response.status, JSON.stringify(response.json));
}

async function runSmoke() {
  let server = null;

  try {
    const alreadyHealthy = await waitForHealth(1000);
    if (!alreadyHealthy) {
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

    const healthy = alreadyHealthy || (await waitForHealth(SERVER_START_TIMEOUT_MS));
    if (!healthy) {
      throw new Error("Server did not become healthy in time");
    }

    const stamp = Date.now();

    const member = await req("/api/auth/register", {
      method: "POST",
      body: {
        name: "Wallet Member",
        email: `wallet.member.${stamp}@test.local`,
        password: "MemberPass!1234",
      },
    });
    if (!member.ok) {
      fail("REGISTER", member);
      return 1;
    }

    const memberCookie = member.cookie;

    const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@tellnab.local";
    const candidatePasswords = [
      process.env.ADMIN_SEED_PASSWORD,
      "ChangeMeNow!123",
      "M@v99N@b!123",
    ].filter(Boolean);

    let admin = null;
    for (const password of candidatePasswords) {
      const attempt = await req("/api/auth/login", {
        method: "POST",
        body: {
          email: adminEmail,
          password,
        },
      });

      if (attempt.ok) {
        admin = attempt;
        break;
      }
    }

    if (!admin) {
      console.error("ADMIN_LOGIN_FAIL", "Unable to log in with available seed password candidates");
      return 1;
    }

    const adminCookie = admin.cookie;

    const topup = await req("/api/wallet/topup/mock", {
      method: "POST",
      cookie: memberCookie,
      body: { amountCents: 500 },
    });
    if (!topup.ok) {
      fail("TOPUP", topup);
      return 1;
    }

    const created = await req("/api/advice", {
      method: "POST",
      cookie: memberCookie,
      body: {
        title: "How to reset my career strategy this quarter?",
        body: "I need practical advice for a realistic 90-day career reset plan.",
      },
    });
    if (!created.ok) {
      fail("CREATE_ADVICE", created);
      return 1;
    }

    const adviceId = created.json?.advice?.id;
    if (!adviceId) {
      console.error("CREATE_ADVICE_FAIL", "Missing advice id");
      return 1;
    }

    const approve = await req(`/api/moderation/advice/${adviceId}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { action: "APPROVED" },
    });
    if (!approve.ok) {
      fail("APPROVE_ADVICE", approve);
      return 1;
    }

    for (let i = 1; i <= 5; i += 1) {
      const comment = await req(`/api/advice/${adviceId}/comments`, {
        method: "POST",
        cookie: memberCookie,
        body: { body: `Helpful reflection ${i}` },
      });
      if (!comment.ok) {
        fail(`COMMENT_${i}`, comment);
        return 1;
      }
    }

    const adminBadges = await req("/api/admin/badges", {
      method: "GET",
      cookie: adminCookie,
    });
    if (!adminBadges.ok) {
      fail("ADMIN_BADGES", adminBadges);
      return 1;
    }

    const communityPillar = (adminBadges.json?.badges || []).find((badge) => badge.key === "COMMUNITY_PILLAR");
    if (!communityPillar) {
      console.error("ADMIN_BADGES_FAIL", "COMMUNITY_PILLAR badge missing from catalog");
      return 1;
    }

    const assignBadge = await req("/api/admin/badges/assign", {
      method: "POST",
      cookie: adminCookie,
      body: {
        userId: member.json?.user?.id,
        badgeKey: "COMMUNITY_PILLAR",
        reason: "Outstanding guidance quality in discussion threads",
      },
    });
    if (!assignBadge.ok) {
      fail("ASSIGN_BADGE", assignBadge);
      return 1;
    }

    const adjustWallet = await req("/api/admin/wallet/adjustments", {
      method: "POST",
      cookie: adminCookie,
      body: {
        userId: member.json?.user?.id,
        balanceType: "PAID",
        amountCents: -200,
        reason: "Manual correction for duplicated promo top-up",
      },
    });
    if (!adjustWallet.ok) {
      fail("WALLET_ADJUST", adjustWallet);
      return 1;
    }

    const wallet = await req("/api/wallet", {
      method: "GET",
      cookie: memberCookie,
    });
    if (!wallet.ok) {
      fail("WALLET_FETCH", wallet);
      return 1;
    }

    const badges = await req("/api/badges", {
      method: "GET",
      cookie: memberCookie,
    });
    if (!badges.ok) {
      fail("BADGES_FETCH", badges);
      return 1;
    }

    const logs = await req("/api/admin/audit-logs?limit=20", {
      method: "GET",
      cookie: adminCookie,
    });
    if (!logs.ok) {
      fail("AUDIT_LOGS", logs);
      return 1;
    }

    const awardedKeys = (badges.json?.awards || []).map((award) => award.badge?.key).filter(Boolean);
    const requiredBadges = ["FIRST_THREAD", "ACTIVE_ADVISOR", "COMMUNITY_PILLAR"];
    const hasAllBadges = requiredBadges.every((key) => awardedKeys.includes(key));

    if (!hasAllBadges) {
      console.error("BADGES_ASSERT_FAIL", JSON.stringify({ requiredBadges, awardedKeys }));
      return 1;
    }

    const hasWalletAdjustmentLog = (logs.json?.logs || []).some((entry) => entry.action === "WALLET_ADJUSTMENT");
    const hasBadgeAssignedLog = (logs.json?.logs || []).some((entry) => entry.action === "BADGE_ASSIGNED");

    if (!hasWalletAdjustmentLog || !hasBadgeAssignedLog) {
      console.error(
        "AUDIT_ASSERT_FAIL",
        JSON.stringify({ hasWalletAdjustmentLog, hasBadgeAssignedLog, count: (logs.json?.logs || []).length }),
      );
      return 1;
    }

    console.log(
      "SMOKE_WALLET_BADGES_OK",
      JSON.stringify(
        {
          adviceId,
          paidCents: wallet.json?.wallet?.paidCents,
          earnedCents: wallet.json?.wallet?.earnedCents,
          badges: awardedKeys,
          auditCount: (logs.json?.logs || []).length,
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
