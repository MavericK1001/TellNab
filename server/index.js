const path = require("node:path");
const dotenv = require("dotenv");

const defaultEnvFile =
  process.env.NODE_ENV === "production"
    ? "config/live/server.env"
    : "config/local/server.env";

dotenv.config({ path: path.resolve(process.cwd(), process.env.ENV_FILE || defaultEnvFile) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");

const ROLES = {
  MEMBER: "MEMBER",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
};

const ADVICE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  HOLD: "HOLD",
  REMOVED: "REMOVED",
};

const NOTIFICATION_TYPES = {
  REPLY: "REPLY",
  NEW_COMMENT: "NEW_COMMENT",
  MODERATION: "MODERATION",
  GROUP_JOIN_REQUEST: "GROUP_JOIN_REQUEST",
  GROUP_JOIN_APPROVED: "GROUP_JOIN_APPROVED",
};

const GROUP_VISIBILITY = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
};

const GROUP_MEMBER_ROLE = {
  OWNER: "OWNER",
  MODERATOR: "MODERATOR",
  MEMBER: "MEMBER",
};

const GROUP_JOIN_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const SOCIAL_AUTH_PROVIDER = {
  GOOGLE: "GOOGLE",
  APPLE: "APPLE",
};

const SUPPORT_TICKET_TYPE = {
  INQUIRY: "INQUIRY",
  ISSUE: "ISSUE",
  SUGGESTION: "SUGGESTION",
};

const SUPPORT_TICKET_STATUS = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.SERVER_PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const CORS_ORIGINS = process.env.CORS_ORIGINS || "";
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "12h";
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === "production" ? 20 : 200),
);
const BOOST_PAYMENT_MODE = String(process.env.BOOST_PAYMENT_MODE || "mock").toLowerCase();
const BOOST_PRICE_USD = Number(process.env.BOOST_PRICE_USD || 4.99);
const BOOST_DURATION_DAYS = Number(process.env.BOOST_DURATION_DAYS || 3);
const WALLET_TOPUP_MODE = String(process.env.WALLET_TOPUP_MODE || "mock").toLowerCase();
const WALLET_TOPUP_MAX_CENTS = Math.max(100, Number(process.env.WALLET_TOPUP_MAX_CENTS || 10000));
const WALLET_DAILY_TOPUP_CAP_CENTS = Math.max(
  WALLET_TOPUP_MAX_CENTS,
  Number(process.env.WALLET_DAILY_TOPUP_CAP_CENTS || 20000),
);
const ADMIN_WALLET_MAX_ADJUST_CENTS = Math.max(
  100,
  Number(process.env.ADMIN_WALLET_MAX_ADJUST_CENTS || 10000),
);
const AI_ASSIST_MODE = String(process.env.AI_ASSIST_MODE || "mock").toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const WALLET_BALANCE_TYPES = {
  PAID: "PAID",
  EARNED: "EARNED",
};

const WALLET_SOURCE = {
  MOCK_TOPUP: "MOCK_TOPUP",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
  BADGE_REWARD: "BADGE_REWARD",
};

const BADGE_KEYS = {
  FIRST_THREAD: "FIRST_THREAD",
  ACTIVE_ADVISOR: "ACTIVE_ADVISOR",
  COMMUNITY_PILLAR: "COMMUNITY_PILLAR",
};

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("Missing/weak JWT_SECRET. Use at least 32 characters.");
}

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

const allowedOrigins = new Set([
  ...parseAllowedOrigins(CORS_ORIGINS),
]);

const normalizedCorsOrigin = normalizeOrigin(CORS_ORIGIN);
if (normalizedCorsOrigin) {
  allowedOrigins.add(normalizedCorsOrigin);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) ||
        LOCAL_ORIGIN_PATTERN.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "32kb" }));

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts. Please wait and try again." },
});

const walletTopupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many wallet top-up attempts. Please wait and try again." },
});

const supportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many support submissions. Please try again shortly." },
});

app.use("/api/auth", authLimiter);
app.use("/api/support", supportLimiter);

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || null,
    coverImageUrl: user.coverImageUrl || null,
    authProvider: user.authProvider || "LOCAL",
    hasPassword: user.hasPassword !== false,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = bearer || req.cookies.tn_auth;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

function moderatorOrAdminRequired(req, res, next) {
  if (!req.user || (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.MODERATOR)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

function sanitizeAdvice(advice) {
  return {
    id: advice.id,
    title: advice.title,
    body: advice.body,
    status: advice.status,
    isLocked: advice.isLocked,
    isFeatured: advice.isFeatured,
    isSpam: advice.isSpam,
    isBoostActive: advice.isBoostActive,
    boostExpiresAt: advice.boostExpiresAt || null,
    holdReason: advice.holdReason,
    followCount: Number(advice.followCount || 0),
    isFollowing: Boolean(advice.isFollowing),
    createdAt: advice.createdAt,
    updatedAt: advice.updatedAt,
    category: advice.category
      ? {
          id: advice.category.id,
          slug: advice.category.slug,
          name: advice.category.name,
        }
      : null,
    group: advice.group
      ? {
          id: advice.group.id,
          slug: advice.group.slug,
          name: advice.group.name,
          visibility: advice.group.visibility,
        }
      : null,
    author: advice.author
      ? {
          id: advice.author.id,
          name: advice.author.name,
          role: advice.author.role,
        }
      : undefined,
  };
}

function sanitizeCategory(category) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

function sanitizeDiscussionGroup(group, options = {}) {
  const memberCount = Number(group.memberCount ?? options.memberCount ?? 0);
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    description: group.description,
    visibility: group.visibility,
    isActive: group.isActive,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    owner: group.owner
      ? {
          id: group.owner.id,
          name: group.owner.name,
          isActive: group.owner.isActive,
        }
      : null,
    membership: options.membership || null,
    memberCount,
  };
}

function parseBearerOrCookieToken(req) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  return bearer || req.cookies.tn_auth || null;
}

async function getOptionalAuthUser(req) {
  try {
    const token = parseBearerOrCookieToken(req);
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function getBoostPriceCents() {
  return Math.max(50, Math.round((Number.isFinite(BOOST_PRICE_USD) ? BOOST_PRICE_USD : 4.99) * 100));
}

function getBoostDays() {
  const parsed = Number.isFinite(BOOST_DURATION_DAYS) ? BOOST_DURATION_DAYS : 3;
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

function calculateBoostExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + getBoostDays());
  return expiresAt;
}

async function clearExpiredBoosts() {
  await prisma.advice.updateMany({
    where: {
      isBoostActive: true,
      boostExpiresAt: { lt: new Date() },
    },
    data: {
      isBoostActive: false,
      boostActivatedAt: null,
      boostExpiresAt: null,
    },
  });
}

function sanitizeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    adviceId: notification.adviceId || null,
    commentId: notification.commentId || null,
  };
}

function sanitizeWalletTransaction(transaction) {
  return {
    id: transaction.id,
    amountCents: transaction.amountCents,
    balanceType: transaction.balanceType,
    direction: transaction.direction,
    reason: transaction.reason,
    source: transaction.source,
    resultingPaidCents: transaction.resultingPaidCents,
    resultingEarnedCents: transaction.resultingEarnedCents,
    createdAt: transaction.createdAt,
    performedBy: transaction.performedBy
      ? {
          id: transaction.performedBy.id,
          name: transaction.performedBy.name,
          role: transaction.performedBy.role,
        }
      : null,
  };
}

function sanitizeBadgeDefinition(badge) {
  return {
    id: badge.id,
    key: badge.key,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    isActive: badge.isActive,
  };
}

function sanitizeUserBadge(userBadge) {
  return {
    id: userBadge.id,
    source: userBadge.source,
    reason: userBadge.reason,
    isVisible: userBadge.isVisible,
    awardedAt: userBadge.awardedAt,
    badge: userBadge.badge ? sanitizeBadgeDefinition(userBadge.badge) : null,
    awardedBy: userBadge.awardedBy
      ? {
          id: userBadge.awardedBy.id,
          name: userBadge.awardedBy.name,
          role: userBadge.awardedBy.role,
        }
      : null,
  };
}

function sanitizeAuditLog(log) {
  return {
    id: log.id,
    action: log.action,
    reason: log.reason,
    metadata: log.metadata,
    createdAt: log.createdAt,
    admin: log.admin
      ? {
          id: log.admin.id,
          name: log.admin.name,
          role: log.admin.role,
        }
      : null,
    targetUser: log.targetUser
      ? {
          id: log.targetUser.id,
          name: log.targetUser.name,
          role: log.targetUser.role,
        }
      : null,
  };
}

function sendError(res, { status, code, message, details }) {
  const payload = {
    ok: false,
    error: {
      code,
      message,
      details: details || undefined,
    },
    message,
  };

  if (details) {
    payload.issues = details;
  }

  return res.status(status).json(payload);
}

function isPrismaNotFoundError(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2025");
}

async function applyWalletDelta(
  tx,
  { userId, balanceType, amountCents, reason, source, performedById = null },
) {
  if (!amountCents || !Number.isInteger(amountCents)) {
    throw new Error("Invalid wallet amount");
  }

  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const nextPaid =
    balanceType === WALLET_BALANCE_TYPES.PAID ? user.walletPaidCents + amountCents : user.walletPaidCents;
  const nextEarned =
    balanceType === WALLET_BALANCE_TYPES.EARNED ? user.walletEarnedCents + amountCents : user.walletEarnedCents;

  if (nextPaid < 0 || nextEarned < 0) {
    throw new Error("Insufficient balance");
  }

  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: {
      walletPaidCents: nextPaid,
      walletEarnedCents: nextEarned,
      walletLifetimeEarnedCents:
        balanceType === WALLET_BALANCE_TYPES.EARNED && amountCents > 0
          ? user.walletLifetimeEarnedCents + amountCents
          : user.walletLifetimeEarnedCents,
    },
  });

  const transaction = await tx.walletTransaction.create({
    data: {
      userId,
      amountCents,
      balanceType,
      direction: amountCents >= 0 ? "CREDIT" : "DEBIT",
      reason,
      source,
      performedById,
      resultingPaidCents: updatedUser.walletPaidCents,
      resultingEarnedCents: updatedUser.walletEarnedCents,
    },
    include: {
      performedBy: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return { user: updatedUser, transaction };
}

async function awardBadgeIfMissing(tx, { userId, badgeKey, source, reason = null, awardedById = null }) {
  const badge = await tx.badgeDefinition.findUnique({ where: { key: badgeKey } });
  if (!badge || !badge.isActive) {
    return null;
  }

  const existing = await tx.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId: badge.id,
      },
    },
  });

  if (existing) {
    return null;
  }

  const created = await tx.userBadge.create({
    data: {
      userId,
      badgeId: badge.id,
      source,
      reason,
      awardedById,
      isVisible: true,
    },
    include: {
      badge: true,
      awardedBy: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return created;
}

async function evaluateAutoBadges(userId) {
  const [threadCount, replyCount] = await Promise.all([
    prisma.advice.count({ where: { authorId: userId } }),
    prisma.adviceComment.count({ where: { authorId: userId } }),
  ]);

  await prisma.$transaction(async (tx) => {
    if (threadCount >= 1) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.FIRST_THREAD,
        source: "AUTO",
        reason: "Posted first advice thread",
      });
    }

    if (replyCount >= 5) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.ACTIVE_ADVISOR,
        source: "AUTO",
        reason: "Reached 5 replies",
      });
    }
  });
}

async function createNotification(data) {
  try {
    await prisma.notification.create({ data });
  } catch {
    // notifications should not break primary user action
  }
}

async function resolveDefaultCategoryId() {
  const fallbackCategory = await prisma.category.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return fallbackCategory?.id || null;
}

function normalizeText(value, maxLength) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!maxLength || cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function isLikelySpamTitle(title) {
  const cleaned = normalizeText(title, 160).toLowerCase();
  if (!cleaned) return false;

  const lettersOnly = cleaned.replace(/[^a-z]/g, "");
  if (lettersOnly.length < 8) return false;

  const hasNoSpaces = !/\s/.test(cleaned);
  const uniqueRatio = new Set(lettersOnly).size / lettersOnly.length;
  const vowelCount = (lettersOnly.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowelCount / lettersOnly.length;
  const keyboardChunkHits = (lettersOnly.match(/asd|dsa|qwe|ewq|zxc|cxz|poi|iop|lkj|jkl/g) || []).length;

  const bigramCounts = new Map();
  for (let i = 0; i < lettersOnly.length - 1; i += 1) {
    const bigram = lettersOnly.slice(i, i + 2);
    bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
  }
  const totalBigrams = Math.max(lettersOnly.length - 1, 1);
  const repeatedBigramHits = Array.from(bigramCounts.values()).reduce(
    (sum, count) => (count > 1 ? sum + count : sum),
    0,
  );
  const repeatedBigramRatio = repeatedBigramHits / totalBigrams;

  if (/(.)\1{3,}/.test(lettersOnly)) return true;

  if (keyboardChunkHits >= 2) {
    return true;
  }

  if (hasNoSpaces && uniqueRatio <= 0.34) return true;

  if (hasNoSpaces && lettersOnly.length >= 10 && vowelRatio < 0.2) return true;

  if (hasNoSpaces && lettersOnly.length >= 9 && uniqueRatio <= 0.5 && repeatedBigramRatio >= 0.5) {
    return true;
  }

  if (lettersOnly.length >= 12 && uniqueRatio <= 0.55 && repeatedBigramRatio >= 0.58) {
    return true;
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ""))
    .filter((token) => token.length >= 3);

  if (tokens.length >= 2) {
    const suspiciousTokens = tokens.filter((token) => {
      const tokenUniqueRatio = new Set(token).size / token.length;
      const tokenKeyboardHits = (token.match(/asd|dsa|qwe|ewq|zxc|cxz|poi|iop|lkj|jkl/g) || []).length;
      return tokenKeyboardHits >= 1 || tokenUniqueRatio <= 0.45 || /(.)\1{2,}/.test(token);
    }).length;

    if (suspiciousTokens >= 2) {
      return true;
    }
  }

  return false;
}

function buildTitleFromQuestion(question) {
  const fallback = "Need advice on a personal decision";
  if (!question) return fallback;

  const firstSentence = normalizeText(question.split(/[.!?]/)[0], 90);
  if (!firstSentence) return fallback;

  const prefix = /^(i\s|my\s|we\s|our\s|should\s|is\s|am\s|can\s)/i.test(firstSentence)
    ? "Advice needed: "
    : "Need advice: ";

  return normalizeText(`${prefix}${firstSentence}`, 120);
}

function buildMockAdviceAssist({ title, question, targetTone }) {
  const toneLead =
    targetTone === "direct"
      ? "I need direct feedback."
      : targetTone === "empathetic"
        ? "I need practical advice, but please be kind."
        : "I need balanced and honest advice.";

  const cleanedQuestion = normalizeText(question, 2200);
  const draftTitle = normalizeText(title, 120) || buildTitleFromQuestion(cleanedQuestion);

  const draftBody = `${toneLead}\n\nContext:\n${cleanedQuestion}\n\nMain question:\nWhat should I do next, and why?\n\nConstraints:\n- Time\n- Money\n- Risk tolerance`;

  return {
    draftTitle,
    draftBody,
    suggestions: [
      "Add one concrete timeline (e.g., decision needed in 30 days).",
      "Include your best and worst-case outcomes in one sentence each.",
      "Mention what you already tried so replies are more specific.",
    ],
    provider: "mock",
  };
}

async function tryOpenAiAdviceAssist({ title, question, targetTone }) {
  if (AI_ASSIST_MODE !== "openai" || !OPENAI_API_KEY) {
    return null;
  }

  const toneHint =
    targetTone === "direct"
      ? "direct and concise"
      : targetTone === "empathetic"
        ? "empathetic and practical"
        : "balanced and practical";

  const userPrompt = [
    "Rewrite the following TellNab advice thread draft.",
    `Desired tone: ${toneHint}.`,
    "Return strict JSON with keys: draftTitle (string), draftBody (string), suggestions (string[]).",
    `Existing title: ${normalizeText(title, 140) || "(none)"}`,
    `Question/body: ${normalizeText(question, 2600)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You rewrite user-generated advice posts. Keep the intent unchanged. Avoid harmful language and return only JSON.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const draftTitle = normalizeText(parsed?.draftTitle || title, 120);
  const draftBody = normalizeText(parsed?.draftBody || question, 2600);
  const suggestions = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions
        .map((item) => normalizeText(item, 140))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  if (!draftBody) {
    return null;
  }

  return {
    draftTitle: draftTitle || buildTitleFromQuestion(draftBody),
    draftBody,
    suggestions,
    provider: "openai",
  };
}

async function buildAiAdviceAssistResult(payload) {
  const openAiResult = await tryOpenAiAdviceAssist(payload);
  if (openAiResult) return openAiResult;
  return buildMockAdviceAssist(payload);
}

async function callOpenAiJson(systemPrompt, userPrompt) {
  if (AI_ASSIST_MODE !== "openai" || !OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildMockCommentAssist({ draft, parentComment, targetTone }) {
  const toneLead =
    targetTone === "direct"
      ? "Short direct response:"
      : targetTone === "empathetic"
        ? "Supportive response:"
        : "Balanced response:";

  const opening = parentComment
    ? `I understand your point about "${normalizeText(parentComment, 80)}".`
    : "Thanks for sharing this context.";

  return {
    draftComment: `${toneLead} ${opening} ${normalizeText(draft || "", 500)} ${
      targetTone === "direct"
        ? "Given your constraints, I would prioritize the lowest-risk next step this week."
        : "A practical next step is to test one small option before a full commitment."
    }`.trim(),
    suggestions: [
      "Reference one concrete detail from the original thread.",
      "Suggest an immediate next step, not just a long-term idea.",
      "Keep tone respectful while being specific.",
    ],
    provider: "mock",
  };
}

async function tryOpenAiCommentAssist({ adviceTitle, adviceBody, parentComment, draft, targetTone }) {
  const toneHint =
    targetTone === "direct"
      ? "direct and concise"
      : targetTone === "empathetic"
        ? "empathetic and practical"
        : "balanced and practical";

  const parsed = await callOpenAiJson(
    "You improve draft comments for online advice threads. Keep it civil and practical. Return JSON only.",
    [
      "Improve this comment draft for an advice thread.",
      `Tone: ${toneHint}.`,
      "Return JSON with keys: draftComment (string), suggestions (string[]).",
      `Thread title: ${normalizeText(adviceTitle, 140)}`,
      `Thread body: ${normalizeText(adviceBody, 1200)}`,
      `Parent comment: ${normalizeText(parentComment || "", 400) || "(none)"}`,
      `Current draft: ${normalizeText(draft || "", 900)}`,
    ].join("\n"),
  );

  if (!parsed) return null;

  const draftComment = normalizeText(parsed?.draftComment || draft, 1200);
  if (!draftComment) return null;

  return {
    draftComment,
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.map((item) => normalizeText(item, 140)).filter(Boolean).slice(0, 4)
      : [],
    provider: "openai",
  };
}

async function buildAiCommentAssistResult(payload) {
  const openAiResult = await tryOpenAiCommentAssist(payload);
  if (openAiResult) return openAiResult;
  return buildMockCommentAssist(payload);
}

function buildMockModerationHint({ body, status, isLocked, isSpam }) {
  if (isSpam) {
    return {
      recommendedAction: "REMOVED",
      priority: "HIGH",
      rationale: "Thread is currently flagged as spam and should receive higher-priority review.",
      checks: [
        "Verify spam indicators across title/body and posting pattern.",
        "Confirm moderation history aligns with spam classification.",
        "If misclassified, clear spam flag and document reason.",
      ],
      provider: "mock",
    };
  }

  const riskyTerms = /(scam|hate|violence|abuse|illegal|self-harm|kill)/i.test(body);
  if (riskyTerms) {
    return {
      recommendedAction: "HOLD",
      priority: "HIGH",
      rationale: "Potentially sensitive language detected. Human review recommended before publish.",
      checks: [
        "Verify whether harmful intent is explicit or contextual.",
        "Request clarifying context from author if ambiguous.",
        "Apply policy-consistent hold note for auditability.",
      ],
      provider: "mock",
    };
  }

  if (status === "PENDING") {
    return {
      recommendedAction: "APPROVED",
      priority: "MEDIUM",
      rationale: "No immediate high-risk terms detected in quick triage scan.",
      checks: [
        "Confirm respectful wording and no targeted abuse.",
        "Ensure enough context exists for useful replies.",
        `Thread lock currently ${isLocked ? "enabled" : "disabled"}; verify intended state.`,
      ],
      provider: "mock",
    };
  }

  return {
    recommendedAction: "KEEP_STATUS",
    priority: "LOW",
    rationale: "Current status appears consistent with quick triage checks.",
    checks: [
      "Review recent moderator actions for consistency.",
      "Check if new reports/comments require status change.",
    ],
    provider: "mock",
  };
}

async function tryOpenAiModerationHint({ title, body, status, isLocked, isFeatured, isSpam }) {
  const parsed = await callOpenAiJson(
    "You produce moderation triage hints. Do not make final policy claims. Return JSON only.",
    [
      "Generate triage hint for a moderation queue item.",
      "Return JSON with keys: recommendedAction, priority, rationale, checks.",
      "recommendedAction must be one of APPROVED, HOLD, REMOVED, KEEP_STATUS.",
      "priority must be one of LOW, MEDIUM, HIGH.",
      `Title: ${normalizeText(title, 160)}`,
      `Body: ${normalizeText(body, 1600)}`,
      `Current status: ${status}`,
      `Locked: ${String(isLocked)}, Featured: ${String(isFeatured)}, Spam: ${String(isSpam)}`,
    ].join("\n"),
  );

  if (!parsed) return null;

  const recommendedAction = ["APPROVED", "HOLD", "REMOVED", "KEEP_STATUS"].includes(
    String(parsed?.recommendedAction || ""),
  )
    ? parsed.recommendedAction
    : null;

  const priority = ["LOW", "MEDIUM", "HIGH"].includes(String(parsed?.priority || ""))
    ? parsed.priority
    : null;

  const rationale = normalizeText(parsed?.rationale || "", 320);
  if (!recommendedAction || !priority || !rationale) return null;

  return {
    recommendedAction,
    priority,
    rationale,
    checks: Array.isArray(parsed?.checks)
      ? parsed.checks.map((item) => normalizeText(item, 160)).filter(Boolean).slice(0, 4)
      : [],
    provider: "openai",
  };
}

async function buildAiModerationHintResult(payload) {
  const openAiResult = await tryOpenAiModerationHint(payload);
  if (openAiResult) return openAiResult;
  return buildMockModerationHint(payload);
}

function canUserModerateGroup(group, user) {
  if (!user) return false;
  if (group.ownerId === user.id) return true;
  return user.role === ROLES.ADMIN || user.role === ROLES.MODERATOR;
}

function canFallbackModerateGroupJoin(group, user) {
  if (!user) return false;
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.MODERATOR) {
    return false;
  }

  if (!group.owner) return true;
  return !group.owner.isActive;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function isValidProfileImageValue(value) {
  if (!value) return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  if (value.startsWith("data:image/")) return true;
  return false;
}

function normalizeOptionalText(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function socialFallbackName(provider) {
  if (provider === SOCIAL_AUTH_PROVIDER.APPLE) {
    return "Apple Member";
  }
  return "Google Member";
}

function socialPlaceholderEmail(provider, providerSubject) {
  const domain = provider === SOCIAL_AUTH_PROVIDER.APPLE ? "apple" : "google";
  return `${providerSubject.toLowerCase()}@${domain}.tellnab.social`;
}

async function buildProfilePayload(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const [asks, replies, featuredThreads, approvedThreads, pendingThreads, badgeCount] = await Promise.all([
    prisma.advice.count({ where: { authorId: userId } }),
    prisma.adviceComment.count({ where: { authorId: userId } }),
    prisma.advice.count({ where: { authorId: userId, isFeatured: true } }),
    prisma.advice.count({ where: { authorId: userId, status: ADVICE_STATUS.APPROVED } }),
    prisma.advice.count({ where: { authorId: userId, status: ADVICE_STATUS.PENDING } }),
    prisma.userBadge.count({ where: { userId, isVisible: true } }),
  ]);

  const roleLabel =
    user.role === ROLES.ADMIN
      ? "Admin"
      : user.role === ROLES.MODERATOR
        ? "Moderator"
        : "Member";

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    authProvider: user.authProvider || "LOCAL",
    hasPassword: user.hasPassword !== false,
    bio:
      user.bio || `${roleLabel} at TellNab • helping people make clear decisions with direct advice.`,
    avatarUrl: user.avatarUrl || null,
    coverImageUrl: user.coverImageUrl || null,
    memberSince: user.createdAt,
    asks,
    replies,
    featuredThreads,
    approvedThreads,
    pendingThreads,
    wallet: {
      paidCents: user.walletPaidCents,
      earnedCents: user.walletEarnedCents,
      lifetimeEarnedCents: user.walletLifetimeEarnedCents,
    },
    badgesCount: badgeCount,
  };
}

const registerSchema = z.object({
  email: z.string().email().max(150),
  name: z.string().min(2).max(60),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
});

const loginSchema = z.object({
  email: z.string().email().max(150),
  password: z.string().min(8).max(128),
});

const socialAuthSchema = z.object({
  provider: z.enum(["google", "apple"]),
  providerSubject: z.string().min(6).max(120).optional(),
  email: z.string().email().max(150).optional(),
  name: z.string().min(2).max(80).optional(),
  avatarUrl: z.string().max(5000).optional(),
});

const googleSocialCodeSchema = z.object({
  code: z.string().min(8),
});

const profileUpdateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    email: z.string().email().max(150).optional(),
    bio: z.string().max(240).optional(),
    avatarUrl: z.string().max(5000).nullable().optional(),
    coverImageUrl: z.string().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
  });

const profilePasswordUpdateSchema = z.object({
  currentPassword: z.string().min(8).max(128).optional(),
  newPassword: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
});

const roleUpdateSchema = z.object({
  role: z.enum([ROLES.MEMBER, ROLES.MODERATOR, ROLES.ADMIN]),
});

const statusUpdateSchema = z.object({
  isActive: z.boolean(),
});

const createAdviceSchema = z.object({
  title: z.string().min(5).max(140),
  body: z.string().min(10).max(5000),
  categoryId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
});

const createDiscussionGroupSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  visibility: z.enum([GROUP_VISIBILITY.PUBLIC, GROUP_VISIBILITY.PRIVATE]).default(GROUP_VISIBILITY.PUBLIC),
});

const createGroupJoinRequestSchema = z.object({
  message: z.string().max(300).optional(),
});

const reviewGroupJoinRequestSchema = z.object({
  reason: z.string().min(3).max(300).optional(),
});

const moderateAdviceSchema = z.object({
  action: z.enum([ADVICE_STATUS.APPROVED, ADVICE_STATUS.HOLD, ADVICE_STATUS.REMOVED]),
  note: z.string().max(500).optional(),
});

const adviceFlagsSchema = z
  .object({
    isLocked: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isSpam: z.boolean().optional(),
  })
  .refine((v) => v.isLocked !== undefined || v.isFeatured !== undefined || v.isSpam !== undefined, {
    message: "At least one flag is required",
  });

const commentSchema = z.object({
  body: z.string().min(1).max(1000),
  parentId: z.string().optional(),
});

const moderateCommentDeleteSchema = z.object({
  reason: z.string().min(3).max(240).optional(),
});

const createConversationSchema = z.object({
  recipientId: z.string().min(1),
});

const createMessageSchema = z.object({
  body: z.string().min(1).max(3000),
});

const userSearchQuerySchema = z.object({
  q: z.string().max(80).optional().default(""),
});

const notificationReadSchema = z.object({
  isRead: z.boolean(),
});

const createBoostCheckoutSchema = z.object({});

const aiAdviceAssistSchema = z.object({
  title: z.string().max(140).optional().default(""),
  question: z.string().min(20).max(5000),
  targetTone: z.enum(["balanced", "direct", "empathetic"]).optional().default("balanced"),
  outcome: z.string().max(180).optional(),
  anonymous: z.boolean().optional(),
});

const aiCommentAssistSchema = z.object({
  adviceTitle: z.string().min(2).max(160),
  adviceBody: z.string().min(10).max(5000),
  parentComment: z.string().max(1000).optional(),
  draft: z.string().max(1500).optional().default(""),
  targetTone: z.enum(["balanced", "direct", "empathetic"]).optional().default("balanced"),
});

const aiModerationHintSchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(10).max(5000),
  status: z.enum([ADVICE_STATUS.PENDING, ADVICE_STATUS.APPROVED, ADVICE_STATUS.HOLD, ADVICE_STATUS.REMOVED]),
  isLocked: z.boolean(),
  isFeatured: z.boolean(),
  isSpam: z.boolean(),
});

const walletTopupSchema = z.object({
  amountCents: z.number().int().min(100).max(WALLET_TOPUP_MAX_CENTS),
});

const adminWalletAdjustmentSchema = z.object({
  userId: z.string().min(1),
  balanceType: z.enum([WALLET_BALANCE_TYPES.PAID, WALLET_BALANCE_TYPES.EARNED]),
  amountCents: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "Amount cannot be zero" })
    .refine((value) => Math.abs(value) <= ADMIN_WALLET_MAX_ADJUST_CENTS, {
      message: `Adjustment exceeds max allowed (${ADMIN_WALLET_MAX_ADJUST_CENTS} cents)`,
    }),
  reason: z.string().min(10).max(240),
});

const adminBadgeAssignSchema = z.object({
  userId: z.string().min(1),
  badgeKey: z.string().min(2).max(80),
  reason: z.string().min(10).max(240),
});

const adminCategoryCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(240).optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

const adminCategoryUpdateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    slug: z.string().min(2).max(80).optional(),
    description: z.string().max(240).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const adminGroupUpdateSchema = z
  .object({
    name: z.string().min(3).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    ownerId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const supportTicketCreateSchema = z.object({
  type: z.enum([
    SUPPORT_TICKET_TYPE.INQUIRY,
    SUPPORT_TICKET_TYPE.ISSUE,
    SUPPORT_TICKET_TYPE.SUGGESTION,
  ]),
  requesterName: z.string().min(2).max(80),
  requesterEmail: z.string().email().max(150),
  subject: z.string().min(5).max(180),
  message: z.string().min(20).max(5000),
  pageUrl: z.string().max(1000).optional(),
});

const supportTicketAdminUpdateSchema = z
  .object({
    status: z
      .enum([
        SUPPORT_TICKET_STATUS.OPEN,
        SUPPORT_TICKET_STATUS.IN_PROGRESS,
        SUPPORT_TICKET_STATUS.RESOLVED,
        SUPPORT_TICKET_STATUS.CLOSED,
      ])
      .optional(),
    internalNote: z.string().max(1000).nullable().optional(),
    resolutionSummary: z.string().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tellnab-server" });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "tellnab-server",
    message: "Backend is running",
    health: "/api/health",
  });
});

app.post("/api/support/tickets", async (req, res) => {
  try {
    const data = supportTicketCreateSchema.parse(req.body || {});
    const safePageUrl = normalizeOptionalText(data.pageUrl);

    if (safePageUrl && !safePageUrl.startsWith("http://") && !safePageUrl.startsWith("https://")) {
      return res.status(400).json({ message: "Invalid page URL" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        type: data.type,
        status: SUPPORT_TICKET_STATUS.OPEN,
        requesterName: data.requesterName.trim(),
        requesterEmail: data.requesterEmail.toLowerCase(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        pageUrl: safePageUrl,
        ipAddress: req.ip || null,
        userAgent: normalizeOptionalText(req.headers["user-agent"]),
      },
    });

    return res.status(201).json({
      message: "Support request received. We will get back to you soon.",
      ticket: {
        id: ticket.id,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to submit support request" });
  }
});

app.get("/api/admin/support/tickets", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
    const type = typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100;

    if (status && !Object.values(SUPPORT_TICKET_STATUS).includes(status)) {
      return res.status(400).json({ message: "Invalid support ticket status filter" });
    }

    if (type && !Object.values(SUPPORT_TICKET_TYPE).includes(type)) {
      return res.status(400).json({ message: "Invalid support ticket type filter" });
    }

    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { requesterName: { contains: search } },
              { requesterEmail: { contains: search } },
              { subject: { contains: search } },
              { message: { contains: search } },
            ],
          }
        : {}),
    };

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        resolvedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return res.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        type: ticket.type,
        status: ticket.status,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        subject: ticket.subject,
        message: ticket.message,
        pageUrl: ticket.pageUrl,
        internalNote: ticket.internalNote,
        resolutionSummary: ticket.resolutionSummary,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        resolvedBy: ticket.resolvedBy,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch support tickets" });
  }
});

app.patch("/api/admin/support/tickets/:id", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const data = supportTicketAdminUpdateSchema.parse(req.body || {});
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ message: "Support ticket not found" });
    }

    const nextStatus = data.status || existing.status;
    const shouldMarkResolved =
      nextStatus === SUPPORT_TICKET_STATUS.RESOLVED || nextStatus === SUPPORT_TICKET_STATUS.CLOSED;

    const updated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.internalNote !== undefined ? { internalNote: normalizeOptionalText(data.internalNote) } : {}),
        ...(data.resolutionSummary !== undefined
          ? { resolutionSummary: normalizeOptionalText(data.resolutionSummary) }
          : {}),
        ...(shouldMarkResolved
          ? { resolvedAt: existing.resolvedAt || new Date(), resolvedById: req.user.id }
          : { resolvedAt: null, resolvedById: null }),
      },
      include: {
        resolvedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return res.json({
      ticket: {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        requesterName: updated.requesterName,
        requesterEmail: updated.requesterEmail,
        subject: updated.subject,
        message: updated.message,
        pageUrl: updated.pageUrl,
        internalNote: updated.internalNote,
        resolutionSummary: updated.resolutionSummary,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        resolvedAt: updated.resolvedAt,
        resolvedBy: updated.resolvedBy,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update support ticket" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        hasPassword: true,
        authProvider: "LOCAL",
        role: ROLES.MEMBER,
        isActive: true,
      },
    });

    const token = createToken(user);
    res.cookie("tn_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    });

    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account suspended" });
    }

    if (user.hasPassword === false) {
      return res.status(400).json({ message: "This account uses social sign-in. Use Google or Apple login." });
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user);
    res.cookie("tn_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    });

    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/social", async (req, res) => {
  try {
    socialAuthSchema.parse(req.body);
    return res.status(410).json({
      message:
        "Legacy social login is disabled. Use Google OAuth sign-in via /api/auth/social/google-code.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Social login failed" });
  }
});

app.post("/api/auth/social/google-code", async (req, res) => {
  try {
    const { code } = googleSocialCodeSchema.parse(req.body);

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!googleClientId || !googleClientSecret) {
      return res.status(503).json({
        message: "Google sign-in is not configured on the server.",
      });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      const reason =
        (typeof tokenData?.error_description === "string" && tokenData.error_description) ||
        (typeof tokenData?.error === "string" && tokenData.error) ||
        "Google authorization failed.";
      return res.status(400).json({ message: reason });
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo.sub || !userInfo.email) {
      const reason =
        (typeof userInfo?.error_description === "string" && userInfo.error_description) ||
        (typeof userInfo?.error === "string" && userInfo.error) ||
        "Google user profile could not be verified.";
      return res.status(400).json({ message: reason });
    }

    if (userInfo.email_verified === false) {
      return res.status(400).json({ message: "Google account email is not verified." });
    }

    const provider = SOCIAL_AUTH_PROVIDER.GOOGLE;
    const providerSubject = String(userInfo.sub).toLowerCase();
    const providerField = "googleSub";
    const incomingEmail = String(userInfo.email).toLowerCase();
    const incomingName = normalizeOptionalText(userInfo.name || "") || socialFallbackName(provider);
    const safeAvatar = normalizeOptionalText(userInfo.picture || "");

    if (safeAvatar && !isValidProfileImageValue(safeAvatar)) {
      return res.status(400).json({ message: "Invalid avatar image URL" });
    }

    let user = await prisma.user.findFirst({
      where: {
        [providerField]: providerSubject,
      },
    });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: incomingEmail } });
    }

    if (!user) {
      const randomPassword = await bcrypt.hash(`${provider}:${providerSubject}:${Date.now()}`, 12);
      user = await prisma.user.create({
        data: {
          email: incomingEmail,
          name: incomingName,
          passwordHash: randomPassword,
          hasPassword: false,
          authProvider: provider,
          avatarUrl: safeAvatar || null,
          role: ROLES.MEMBER,
          isActive: true,
          [providerField]: providerSubject,
        },
      });
    } else {
      if (!user.isActive) {
        return res.status(403).json({ message: "Account suspended" });
      }

      const updateData = {
        authProvider: provider,
      };

      if (!user[providerField]) {
        updateData[providerField] = providerSubject;
      }

      if (safeAvatar && !user.avatarUrl) {
        updateData.avatarUrl = safeAvatar;
      }

      if (incomingName && user.name !== incomingName) {
        updateData.name = incomingName;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    const token = createToken(user);
    res.cookie("tn_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    });

    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Google social login failed" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("tn_auth");
  return res.json({ success: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.get("/api/users/search", authRequired, async (req, res) => {
  try {
    const { q } = userSearchQuerySchema.parse({
      q: typeof req.query.q === "string" ? req.query.q.trim() : "",
    });

    if (q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: req.user.id },
        OR: [{ name: { contains: q } }, { email: { contains: q } }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return res.json({ users });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to search users" });
  }
});

app.get("/api/profile", authRequired, async (req, res) => {
  try {
    const profile = await buildProfilePayload(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ profile });
  } catch {
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

app.patch("/api/profile", authRequired, async (req, res) => {
  try {
    const data = profileUpdateSchema.parse(req.body);
    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.email !== undefined) {
      const nextEmail = data.email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ message: "Email already in use" });
      }
      updateData.email = nextEmail;
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio.trim();
    }

    if (data.avatarUrl !== undefined) {
      const avatarUrl = normalizeOptionalText(data.avatarUrl || "");
      if (avatarUrl && !isValidProfileImageValue(avatarUrl)) {
        return res.status(400).json({ message: "Invalid avatar image URL" });
      }
      updateData.avatarUrl = avatarUrl;
    }

    if (data.coverImageUrl !== undefined) {
      const coverImageUrl = normalizeOptionalText(data.coverImageUrl || "");
      if (coverImageUrl && !isValidProfileImageValue(coverImageUrl)) {
        return res.status(400).json({ message: "Invalid cover image URL" });
      }
      updateData.coverImageUrl = coverImageUrl;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    const profile = await buildProfilePayload(req.user.id);
    return res.json({ profile, message: "Profile updated." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

app.patch("/api/profile/password", authRequired, async (req, res) => {
  try {
    const data = profilePasswordUpdateSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.hasPassword) {
      if (!data.currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
    }

    if (data.currentPassword && data.currentPassword === data.newPassword) {
      return res.status(400).json({ message: "New password must be different" });
    }

    const nextHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: nextHash,
        hasPassword: true,
      },
    });

    return res.json({ success: true, message: "Password updated." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update password" });
  }
});

app.get("/api/wallet", authRequired, async (req, res) => {
  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id } }),
    prisma.walletTransaction.findMany({
      where: { userId: req.user.id },
      include: {
        performedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({
    wallet: {
      paidCents: user.walletPaidCents,
      earnedCents: user.walletEarnedCents,
      lifetimeEarnedCents: user.walletLifetimeEarnedCents,
      totalCents: user.walletPaidCents + user.walletEarnedCents,
    },
    transactions: transactions.map(sanitizeWalletTransaction),
    limits: {
      topupMode: WALLET_TOPUP_MODE,
      topupMaxCents: WALLET_TOPUP_MAX_CENTS,
      dailyTopupCapCents: WALLET_DAILY_TOPUP_CAP_CENTS,
    },
  });
});

app.post("/api/wallet/topup/mock", authRequired, walletTopupLimiter, async (req, res) => {
  try {
    const { amountCents } = walletTopupSchema.parse(req.body);

    if (WALLET_TOPUP_MODE !== "mock") {
      return res.status(503).json({ message: "Wallet top-up provider is not configured" });
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const todayTopups = await prisma.walletTransaction.aggregate({
      where: {
        userId: req.user.id,
        source: WALLET_SOURCE.MOCK_TOPUP,
        amountCents: { gt: 0 },
        createdAt: { gte: dayStart },
      },
      _sum: {
        amountCents: true,
      },
    });

    const usedToday = Number(todayTopups._sum.amountCents || 0);
    if (usedToday + amountCents > WALLET_DAILY_TOPUP_CAP_CENTS) {
      return res.status(429).json({
        message: "Daily top-up cap reached",
        usedTodayCents: usedToday,
        dailyCapCents: WALLET_DAILY_TOPUP_CAP_CENTS,
      });
    }

    const result = await prisma.$transaction(async (tx) =>
      applyWalletDelta(tx, {
        userId: req.user.id,
        balanceType: WALLET_BALANCE_TYPES.PAID,
        amountCents,
        reason: "Mock wallet top-up",
        source: WALLET_SOURCE.MOCK_TOPUP,
        performedById: req.user.id,
      }),
    );

    return res.status(201).json({
      wallet: {
        paidCents: result.user.walletPaidCents,
        earnedCents: result.user.walletEarnedCents,
        lifetimeEarnedCents: result.user.walletLifetimeEarnedCents,
        totalCents: result.user.walletPaidCents + result.user.walletEarnedCents,
      },
      transaction: sanitizeWalletTransaction(result.transaction),
      message: "Mock top-up completed",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to top up wallet" });
  }
});

app.get("/api/badges", authRequired, async (req, res) => {
  const [catalog, userBadges] = await Promise.all([
    prisma.badgeDefinition.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.userBadge.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        badge: true,
        awardedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { awardedAt: "desc" },
    }),
  ]);

  const awardedMap = new Map(userBadges.map((item) => [item.badge.key, item]));
  return res.json({
    catalog: catalog.map((badge) => ({
      ...sanitizeBadgeDefinition(badge),
      awarded: awardedMap.has(badge.key),
      award: awardedMap.has(badge.key) ? sanitizeUserBadge(awardedMap.get(badge.key)) : null,
    })),
    awards: userBadges.map(sanitizeUserBadge),
  });
});

app.get("/api/notifications", authRequired, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
  return res.json({ notifications: notifications.map(sanitizeNotification), unreadCount });
});

app.patch("/api/notifications/:id", authRequired, async (req, res) => {
  try {
    const { isRead } = notificationReadSchema.parse(req.body);

    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead },
    });

    if (!notification.count) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update notification" });
  }
});

app.patch("/api/notifications/read-all", authRequired, async (_req, res) => {
  await prisma.notification.updateMany({
    where: { userId: _req.user.id, isRead: false },
    data: { isRead: true },
  });

  return res.json({ success: true });
});

app.get("/api/home/overview", async (_req, res) => {
  try {
    await clearExpiredBoosts();

    const [approvedThreads, featuredThreads, boostedThreads, totalComments, activeMembers, pendingReview, highlights] =
      await Promise.all([
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED, isFeatured: true } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED, isBoostActive: true } }),
        prisma.adviceComment.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.PENDING } }),
        prisma.advice.findMany({
          where: { status: ADVICE_STATUS.APPROVED },
          orderBy: [{ isBoostActive: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
          take: 3,
          include: { author: true, category: true, group: true },
        }),
      ]);

    return res.json({
      metrics: {
        approvedThreads,
        featuredThreads,
        boostedThreads,
        totalComments,
        activeMembers,
        pendingReview,
      },
      highlights: highlights.map(sanitizeAdvice),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load homepage overview" });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.json({ categories: categories.map(sanitizeCategory) });
  } catch {
    return res.status(500).json({ message: "Failed to load categories" });
  }
});

app.get("/api/categories/:slug", async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
    });

    if (!category || !category.isActive) {
      return res.status(404).json({ message: "Category not found" });
    }

    const approvedThreads = await prisma.advice.count({
      where: { categoryId: category.id, status: ADVICE_STATUS.APPROVED },
    });

    return res.json({
      category: sanitizeCategory(category),
      approvedThreads,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load category" });
  }
});

app.get("/api/admin/users", authRequired, adminRequired, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return res.json({ users: users.map(sanitizeUser) });
});

app.patch("/api/admin/users/:id/role", authRequired, adminRequired, async (req, res) => {
  try {
    const { role } = roleUpdateSchema.parse(req.body);
    const { id } = req.params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user.id === id && role !== ROLES.ADMIN) {
      return res.status(400).json({ message: "Admin cannot demote own account" });
    }

    if (target.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN, isActive: true } });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot remove the last active admin" });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
    });

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Role update failed" });
  }
});

app.patch("/api/admin/users/:id/status", authRequired, adminRequired, async (req, res) => {
  try {
    const { isActive } = statusUpdateSchema.parse(req.body);
    const { id } = req.params;

    if (req.user.id === id && !isActive) {
      return res.status(400).json({ message: "Admin cannot suspend own account" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(404).json({ message: "User not found" });
  }
});

app.get("/api/admin/badges", authRequired, adminRequired, async (_req, res) => {
  const badges = await prisma.badgeDefinition.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return res.json({ badges: badges.map(sanitizeBadgeDefinition) });
});

app.post("/api/admin/badges/assign", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminBadgeAssignSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const award = await awardBadgeIfMissing(tx, {
        userId: data.userId,
        badgeKey: data.badgeKey,
        source: "ADMIN",
        reason: data.reason,
        awardedById: req.user.id,
      });

      if (!award) {
        throw new Error("Badge not found, inactive, or already assigned");
      }

      await tx.adminAuditLog.create({
        data: {
          action: "BADGE_ASSIGNED",
          reason: data.reason,
          metadata: JSON.stringify({ badgeKey: data.badgeKey }),
          adminId: req.user.id,
          targetUserId: data.userId,
        },
      });

      return award;
    });

    return res.status(201).json({ award: sanitizeUserBadge(result) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }

    if (error instanceof Error && error.message.includes("already assigned")) {
      return res.status(409).json({ message: error.message });
    }

    return res.status(500).json({ message: "Failed to assign badge" });
  }
});

app.post("/api/admin/wallet/adjustments", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminWalletAdjustmentSchema.parse(req.body);

    if (data.userId === req.user.id) {
      return res.status(400).json({ message: "Admins cannot adjust their own wallet" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const walletResult = await applyWalletDelta(tx, {
        userId: data.userId,
        balanceType: data.balanceType,
        amountCents: data.amountCents,
        reason: data.reason,
        source: WALLET_SOURCE.ADMIN_ADJUSTMENT,
        performedById: req.user.id,
      });

      await tx.adminAuditLog.create({
        data: {
          action: "WALLET_ADJUSTMENT",
          reason: data.reason,
          metadata: JSON.stringify({
            balanceType: data.balanceType,
            amountCents: data.amountCents,
            transactionId: walletResult.transaction.id,
          }),
          adminId: req.user.id,
          targetUserId: data.userId,
        },
      });

      return walletResult;
    });

    return res.status(201).json({
      wallet: {
        paidCents: result.user.walletPaidCents,
        earnedCents: result.user.walletEarnedCents,
        lifetimeEarnedCents: result.user.walletLifetimeEarnedCents,
        totalCents: result.user.walletPaidCents + result.user.walletEarnedCents,
      },
      transaction: sanitizeWalletTransaction(result.transaction),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }

    if (error instanceof Error && error.message === "Insufficient balance") {
      return res.status(400).json({ message: "Adjustment would cause negative balance" });
    }

    if (error instanceof Error && error.message === "User not found") {
      return res.status(404).json({ message: "Target user not found" });
    }

    return res.status(500).json({ message: "Failed to apply wallet adjustment" });
  }
});

app.get("/api/admin/audit-logs", authRequired, adminRequired, async (req, res) => {
  const requestedLimit = Number(req.query.limit || 50);
  const limit = Math.max(1, Math.min(200, Number.isFinite(requestedLimit) ? requestedLimit : 50));

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      admin: {
        select: { id: true, name: true, role: true },
      },
      targetUser: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return res.json({ logs: logs.map(sanitizeAuditLog) });
});

app.get("/api/admin/overview", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      pendingModeration,
      holdThreads,
      removedThreads,
      pendingGroupRequests,
      totalGroups,
      activeGroups,
      totalCategories,
      activeCategories,
      adviceActions24h,
      groupActions24h,
    ] = await Promise.all([
      prisma.advice.count({ where: { status: ADVICE_STATUS.PENDING } }),
      prisma.advice.count({ where: { status: ADVICE_STATUS.HOLD } }),
      prisma.advice.count({ where: { status: ADVICE_STATUS.REMOVED } }),
      prisma.groupJoinRequest.count({
        where: {
          status: GROUP_JOIN_STATUS.PENDING,
          group: { isActive: true },
        },
      }),
      prisma.discussionGroup.count(),
      prisma.discussionGroup.count({ where: { isActive: true } }),
      prisma.category.count(),
      prisma.category.count({ where: { isActive: true } }),
      prisma.adviceModerationAction.count({ where: { createdAt: { gte: since24h } } }),
      prisma.groupModerationAction.count({ where: { createdAt: { gte: since24h } } }),
    ]);

    let adminOnly = null;
    if (req.user.role === ROLES.ADMIN) {
      const [totalUsers, activeUsers, adminAuditEntries24h] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.adminAuditLog.count({ where: { createdAt: { gte: since24h } } }),
      ]);

      adminOnly = {
        totalUsers,
        activeUsers,
        adminAuditEntries24h,
      };
    }

    return res.json({
      metrics: {
        pendingModeration,
        holdThreads,
        removedThreads,
        pendingGroupRequests,
        totalGroups,
        activeGroups,
        totalCategories,
        activeCategories,
        moderationActions24h: adviceActions24h + groupActions24h,
      },
      adminOnly,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load admin overview" });
  }
});

app.get("/api/admin/categories", authRequired, adminRequired, async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.json({ categories: categories.map(sanitizeCategory) });
  } catch {
    return res.status(500).json({ message: "Failed to load admin categories" });
  }
});

app.post("/api/admin/categories", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminCategoryCreateSchema.parse(req.body || {});
    const baseSlug = slugify(data.slug || data.name);

    if (!baseSlug) {
      return res.status(400).json({ message: "Category slug is invalid" });
    }

    const existing = await prisma.category.findUnique({ where: { slug: baseSlug } });
    if (existing) {
      return res.status(409).json({ message: "Category slug already exists" });
    }

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug: baseSlug,
        description: data.description || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });

    return res.status(201).json({ category: sanitizeCategory(category) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to create category" });
  }
});

app.patch("/api/admin/categories/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminCategoryUpdateSchema.parse(req.body || {});
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let nextSlug;
    if (data.slug || data.name) {
      nextSlug = slugify(data.slug || data.name || category.name);
      if (!nextSlug) {
        return res.status(400).json({ message: "Category slug is invalid" });
      }

      const slugConflict = await prisma.category.findFirst({
        where: {
          slug: nextSlug,
          id: { not: category.id },
        },
      });

      if (slugConflict) {
        return res.status(409).json({ message: "Category slug already exists" });
      }
    }

    const updated = await prisma.category.update({
      where: { id: category.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });

    return res.json({ category: sanitizeCategory(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update category" });
  }
});

app.get("/api/admin/groups", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const groups = await prisma.discussionGroup.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        owner: {
          select: { id: true, name: true, isActive: true },
        },
        _count: {
          select: {
            memberships: true,
            joinRequests: true,
            advices: true,
          },
        },
      },
      take: 300,
    });

    const pendingByGroup = await prisma.groupJoinRequest.groupBy({
      by: ["groupId"],
      where: { status: GROUP_JOIN_STATUS.PENDING },
      _count: { _all: true },
    });

    const pendingMap = pendingByGroup.reduce((acc, item) => {
      acc[item.groupId] = item._count._all;
      return acc;
    }, {});

    return res.json({
      groups: groups.map((group) => ({
        ...sanitizeDiscussionGroup(group, { memberCount: group._count.memberships }),
        pendingJoinRequests: Number(pendingMap[group.id] || 0),
        adviceCount: Number(group._count.advices || 0),
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load admin groups" });
  }
});

app.patch("/api/admin/groups/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminGroupUpdateSchema.parse(req.body || {});

    const group = await prisma.discussionGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    let nextOwner = null;
    if (data.ownerId && data.ownerId !== group.ownerId) {
      nextOwner = await prisma.user.findUnique({ where: { id: data.ownerId } });
      if (!nextOwner || !nextOwner.isActive) {
        return res.status(400).json({ message: "New owner must be an active user" });
      }
    }

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const updated = await tx.discussionGroup.update({
        where: { id: group.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(nextOwner ? { ownerId: nextOwner.id } : {}),
        },
        include: {
          owner: {
            select: { id: true, name: true, isActive: true },
          },
        },
      });

      if (nextOwner) {
        await tx.groupMembership.upsert({
          where: {
            groupId_userId: {
              groupId: group.id,
              userId: nextOwner.id,
            },
          },
          update: {
            role: GROUP_MEMBER_ROLE.OWNER,
          },
          create: {
            groupId: group.id,
            userId: nextOwner.id,
            role: GROUP_MEMBER_ROLE.OWNER,
          },
        });

        await tx.groupMembership.updateMany({
          where: {
            groupId: group.id,
            userId: group.ownerId,
            role: GROUP_MEMBER_ROLE.OWNER,
          },
          data: { role: GROUP_MEMBER_ROLE.MODERATOR },
        });

        await tx.groupModerationAction.create({
          data: {
            groupId: group.id,
            actorId: req.user.id,
            action: "OWNER_TRANSFERRED",
            reason: `Transferred owner from ${group.ownerId} to ${nextOwner.id}`,
          },
        });
      }

      if (data.isActive !== undefined) {
        await tx.groupModerationAction.create({
          data: {
            groupId: group.id,
            actorId: req.user.id,
            action: data.isActive ? "GROUP_REACTIVATED" : "GROUP_DEACTIVATED",
            reason: "Status updated from admin workspace",
          },
        });
      }

      return updated;
    });

    return res.json({ group: sanitizeDiscussionGroup(updatedGroup) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update group" });
  }
});

app.get("/api/admin/groups/:id/moderation-actions", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 80);
    const limit = Math.max(1, Math.min(300, Number.isFinite(limitRaw) ? limitRaw : 80));

    const group = await prisma.discussionGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!canUserModerateGroup(group, req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const actions = await prisma.groupModerationAction.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return res.json({
      actions: actions.map((action) => ({
        id: action.id,
        action: action.action,
        reason: action.reason,
        metadata: action.metadata,
        createdAt: action.createdAt,
        actor: action.actor,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load group moderation actions" });
  }
});

app.get("/api/moderation/group-requests", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const requests = await prisma.groupJoinRequest.findMany({
      where: {
        status: GROUP_JOIN_STATUS.PENDING,
        group: { isActive: true },
      },
      include: {
        requester: {
          select: { id: true, name: true, role: true },
        },
        group: {
          include: {
            owner: {
              select: { id: true, name: true, isActive: true },
            },
          },
        },
      },
      orderBy: { requestedAt: "asc" },
      take: 300,
    });

    const visible = requests.filter((request) => {
      if (req.user.role === ROLES.ADMIN) return true;

      const isOwner = request.group.ownerId === req.user.id;
      if (isOwner) return true;

      return canFallbackModerateGroupJoin(request.group, req.user);
    });

    return res.json({
      requests: visible.map((request) => ({
        id: request.id,
        status: request.status,
        message: request.message,
        requestedAt: request.requestedAt,
        requester: request.requester,
        group: sanitizeDiscussionGroup(request.group),
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load moderation group requests" });
  }
});

app.get("/api/moderation/activity", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 80);
    const limit = Math.max(10, Math.min(300, Number.isFinite(limitRaw) ? limitRaw : 80));

    const [adviceActions, groupActions] = await Promise.all([
      prisma.adviceModerationAction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          moderator: {
            select: { id: true, name: true, role: true },
          },
          advice: {
            select: { id: true, title: true, status: true },
          },
        },
      }),
      prisma.groupModerationAction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          actor: {
            select: { id: true, name: true, role: true },
          },
          group: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    const combined = [
      ...adviceActions.map((action) => ({
        id: action.id,
        domain: "ADVICE",
        action: action.action,
        note: action.note,
        createdAt: action.createdAt,
        actor: action.moderator,
        target: action.advice,
      })),
      ...groupActions.map((action) => ({
        id: action.id,
        domain: "GROUP",
        action: action.action,
        note: action.reason,
        createdAt: action.createdAt,
        actor: action.actor,
        target: action.group,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({ actions: combined });
  } catch {
    return sendError(res, {
      status: 500,
      code: "MODERATION_ACTIVITY_LOAD_FAILED",
      message: "Failed to load moderation activity",
    });
  }
});

app.post("/api/ai/advice-assist", authRequired, async (req, res) => {
  try {
    const data = aiAdviceAssistSchema.parse(req.body || {});

    const result = await buildAiAdviceAssistResult({
      title: data.title,
      question: data.question,
      targetTone: data.targetTone,
      outcome: data.outcome,
      anonymous: data.anonymous,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }

    return sendError(res, {
      status: 500,
      code: "AI_ASSIST_FAILED",
      message: "Failed to generate AI draft",
    });
  }
});

app.post("/api/ai/comment-assist", authRequired, async (req, res) => {
  try {
    const data = aiCommentAssistSchema.parse(req.body || {});

    const result = await buildAiCommentAssistResult({
      adviceTitle: data.adviceTitle,
      adviceBody: data.adviceBody,
      parentComment: data.parentComment,
      draft: data.draft,
      targetTone: data.targetTone,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }

    return sendError(res, {
      status: 500,
      code: "AI_COMMENT_ASSIST_FAILED",
      message: "Failed to generate AI comment draft",
    });
  }
});

app.post("/api/ai/moderation-hint", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const data = aiModerationHintSchema.parse(req.body || {});

    const result = await buildAiModerationHintResult({
      title: data.title,
      body: data.body,
      status: data.status,
      isLocked: data.isLocked,
      isFeatured: data.isFeatured,
      isSpam: data.isSpam,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }

    return sendError(res, {
      status: 500,
      code: "AI_MODERATION_HINT_FAILED",
      message: "Failed to generate moderation hint",
    });
  }
});

app.post("/api/advice", authRequired, async (req, res) => {
  try {
    const data = createAdviceSchema.parse(req.body);
    const autoSpamFlag = isLikelySpamTitle(data.title);

    let resolvedCategoryId = data.categoryId || null;
    if (resolvedCategoryId) {
      const category = await prisma.category.findUnique({ where: { id: resolvedCategoryId } });
      if (!category || !category.isActive) {
        return sendError(res, {
          status: 400,
          code: "INVALID_CATEGORY",
          message: "Invalid category",
        });
      }
    } else {
      resolvedCategoryId = await resolveDefaultCategoryId();
    }

    let resolvedGroupId = data.groupId || null;
    if (resolvedGroupId) {
      const membership = await prisma.groupMembership.findFirst({
        where: {
          groupId: resolvedGroupId,
          userId: req.user.id,
        },
        include: {
          group: true,
        },
      });

      if (!membership || !membership.group.isActive) {
        return sendError(res, {
          status: 403,
          code: "GROUP_POST_FORBIDDEN",
          message: "You must be a group member to post inside this group",
        });
      }
    }

    const advice = await prisma.advice.create({
      data: {
        title: data.title,
        body: data.body,
        status: ADVICE_STATUS.PENDING,
        isSpam: autoSpamFlag,
        authorId: req.user.id,
        categoryId: resolvedCategoryId,
        groupId: resolvedGroupId,
      },
      include: {
        author: true,
        category: true,
        group: true,
      },
    });

    await evaluateAutoBadges(req.user.id);

    return res.status(201).json({ advice: sanitizeAdvice(advice) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }
    return sendError(res, {
      status: 500,
      code: "ADVICE_CREATE_FAILED",
      message: "Failed to create advice",
    });
  }
});

app.get("/api/advice", async (req, res) => {
  await clearExpiredBoosts();

  const status = String(req.query.status || ADVICE_STATUS.APPROVED);
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  const allowAll = req.headers.authorization || req.cookies.tn_auth;

  let where = {
    status: ADVICE_STATUS.APPROVED,
    ...(categoryId ? { categoryId } : {}),
    ...(groupId ? { groupId } : {}),
  };
  if (allowAll && Object.values(ADVICE_STATUS).includes(status)) {
    where = {
      status,
      ...(categoryId ? { categoryId } : {}),
      ...(groupId ? { groupId } : {}),
    };
  }

  const list = await prisma.advice.findMany({
    where,
    orderBy: [{ isBoostActive: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
    include: { author: true, category: true, group: true },
  });

  return res.json({ advices: list.map(sanitizeAdvice) });
});

app.get("/api/advice/mine", authRequired, async (req, res) => {
  await clearExpiredBoosts();

  const list = await prisma.advice.findMany({
    where: { authorId: req.user.id },
    orderBy: [{ isBoostActive: "desc" }, { createdAt: "desc" }],
    include: { author: true, category: true, group: true },
  });
  return res.json({ advices: list.map(sanitizeAdvice) });
});

app.get("/api/advice/follows", authRequired, async (req, res) => {
  const follows = await prisma.adviceFollow.findMany({
    where: { userId: req.user.id },
    select: { adviceId: true },
  });

  return res.json({ adviceIds: follows.map((item) => item.adviceId) });
});

app.get("/api/advice/following", authRequired, async (req, res) => {
  await clearExpiredBoosts();

  const list = await prisma.advice.findMany({
    where: {
      status: ADVICE_STATUS.APPROVED,
      follows: { some: { userId: req.user.id } },
    },
    orderBy: [{ isBoostActive: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
    include: { author: true, category: true, group: true },
  });

  const withFollow = list.map((advice) => ({ ...advice, isFollowing: true }));
  return res.json({ advices: withFollow.map(sanitizeAdvice) });
});

app.post("/api/advice/:id/follow", authRequired, async (req, res) => {
  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });

  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  await prisma.adviceFollow.upsert({
    where: {
      adviceId_userId: {
        adviceId: advice.id,
        userId: req.user.id,
      },
    },
    update: {},
    create: {
      adviceId: advice.id,
      userId: req.user.id,
    },
  });

  return res.status(201).json({ success: true });
});

app.delete("/api/advice/:id/follow", authRequired, async (req, res) => {
  await prisma.adviceFollow.deleteMany({
    where: {
      adviceId: req.params.id,
      userId: req.user.id,
    },
  });

  return res.json({ success: true });
});

app.get("/api/advice/:id/boost/status", async (req, res) => {
  await clearExpiredBoosts();

  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });
  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  return res.json({
    adviceId: advice.id,
    isBoostActive: advice.isBoostActive,
    boostExpiresAt: advice.boostExpiresAt,
  });
});

app.post("/api/advice/:id/boost/checkout", authRequired, async (req, res) => {
  try {
    createBoostCheckoutSchema.parse(req.body || {});
    await clearExpiredBoosts();

    const advice = await prisma.advice.findUnique({
      where: { id: req.params.id },
      include: { author: true, category: true, group: true },
    });

    if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
      return sendError(res, {
        status: 404,
        code: "ADVICE_NOT_FOUND",
        message: "Advice not found",
      });
    }

    if (advice.authorId !== req.user.id) {
      return sendError(res, {
        status: 403,
        code: "BOOST_FORBIDDEN",
        message: "Only the thread owner can boost this thread",
      });
    }

    if (advice.isLocked) {
      return sendError(res, {
        status: 400,
        code: "ADVICE_LOCKED",
        message: "Locked threads cannot be boosted",
      });
    }

    if (advice.isBoostActive) {
      return sendError(res, {
        status: 409,
        code: "BOOST_ALREADY_ACTIVE",
        message: "Thread already has an active boost",
      });
    }

    if (BOOST_PAYMENT_MODE !== "mock") {
      return sendError(res, {
        status: 503,
        code: "BOOST_PROVIDER_UNAVAILABLE",
        message: "Payment provider is not configured yet",
      });
    }

    const priceCents = getBoostPriceCents();
    const boostDays = getBoostDays();
    const expiresAt = calculateBoostExpiryDate();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.adviceBoostOrder.create({
        data: {
          adviceId: advice.id,
          userId: req.user.id,
          amountCents: priceCents,
          currency: "USD",
          status: "PAID",
          provider: "MOCK",
          providerRef: `mock_${Date.now()}`,
          boostDays,
          paidAt: new Date(),
        },
      });

      const updatedAdvice = await tx.advice.update({
        where: { id: advice.id },
        data: {
          isBoostActive: true,
          boostActivatedAt: new Date(),
          boostExpiresAt: expiresAt,
        },
        include: { author: true, category: true, group: true },
      });

      return { order, advice: updatedAdvice };
    });

    return res.status(201).json({
      order: {
        id: result.order.id,
        amountCents: result.order.amountCents,
        currency: result.order.currency,
        status: result.order.status,
        provider: result.order.provider,
        paidAt: result.order.paidAt,
        boostDays: result.order.boostDays,
      },
      advice: sanitizeAdvice(result.advice),
      message: "Boost activated in mock payment mode",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }
    return sendError(res, {
      status: 500,
      code: "BOOST_CHECKOUT_FAILED",
      message: "Failed to create boost checkout",
    });
  }
});

app.get("/api/advice/:id", async (req, res) => {
  await clearExpiredBoosts();

  const viewer = await getOptionalAuthUser(req);

  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    include: {
      author: true,
      category: true,
      group: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!advice) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  const canAccessUnpublished = Boolean(
    viewer && (viewer.id === advice.authorId || viewer.role === ROLES.ADMIN || viewer.role === ROLES.MODERATOR),
  );

  if (advice.status !== ADVICE_STATUS.APPROVED && !canAccessUnpublished) {
    return sendError(res, {
      status: 403,
      code: "ADVICE_NOT_PUBLIC",
      message: "Advice not publicly available",
    });
  }

  const followCount = await prisma.adviceFollow.count({ where: { adviceId: advice.id } });

  let followedByCurrentUser = false;
  if (viewer) {
    const follow = await prisma.adviceFollow.findUnique({
      where: {
        adviceId_userId: {
          adviceId: advice.id,
          userId: viewer.id,
        },
      },
    });
    followedByCurrentUser = Boolean(follow);
  }

  return res.json({
    advice: sanitizeAdvice({ ...advice, followCount, isFollowing: followedByCurrentUser }),
    comments: advice.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      author: { id: comment.author.id, name: comment.author.name },
    })),
  });
});

app.post("/api/advice/:id/comments", authRequired, async (req, res) => {
  try {
    const data = commentSchema.parse(req.body);
    const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });

    if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
      return sendError(res, {
        status: 404,
        code: "ADVICE_COMMENTING_UNAVAILABLE",
        message: "Advice not available for comments",
      });
    }

    if (advice.isLocked && req.user.role === ROLES.MEMBER) {
      return sendError(res, {
        status: 403,
        code: "COMMENTS_LOCKED",
        message: "Comments are locked by moderators",
      });
    }

    const comment = await prisma.adviceComment.create({
      data: {
        body: data.body,
        parentId: data.parentId || null,
        adviceId: advice.id,
        authorId: req.user.id,
      },
      include: { author: true },
    });

    await evaluateAutoBadges(req.user.id);

    if (data.parentId) {
      const parent = await prisma.adviceComment.findUnique({ where: { id: data.parentId } });
      if (parent && parent.authorId !== req.user.id) {
        await createNotification({
          userId: parent.authorId,
          type: NOTIFICATION_TYPES.REPLY,
          title: "New reply to your comment",
          body: `${req.user.name} replied in a thread you commented on.`,
          adviceId: advice.id,
          commentId: comment.id,
        });
      }
    }

    if (advice.authorId !== req.user.id) {
      await createNotification({
        userId: advice.authorId,
        type: NOTIFICATION_TYPES.NEW_COMMENT,
        title: "New comment on your advice",
        body: `${req.user.name} commented on your advice thread.`,
        adviceId: advice.id,
        commentId: comment.id,
      });
    }

    return res.status(201).json({
      comment: {
        id: comment.id,
        body: comment.body,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        author: { id: comment.author.id, name: comment.author.name },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }
    return sendError(res, {
      status: 500,
      code: "COMMENT_CREATE_FAILED",
      message: "Failed to add comment",
    });
  }
});

app.delete("/api/advice/:adviceId/comments/:commentId", authRequired, async (req, res) => {
  try {
    const advice = await prisma.advice.findUnique({ where: { id: req.params.adviceId } });
    if (!advice) {
      return sendError(res, {
        status: 404,
        code: "ADVICE_NOT_FOUND",
        message: "Advice not found",
      });
    }

    const rootComment = await prisma.adviceComment.findUnique({
      where: { id: req.params.commentId },
    });

    if (!rootComment || rootComment.adviceId !== advice.id) {
      return sendError(res, {
        status: 404,
        code: "COMMENT_NOT_FOUND",
        message: "Comment not found",
      });
    }

    if (rootComment.authorId !== req.user.id) {
      return sendError(res, {
        status: 403,
        code: "COMMENT_DELETE_FORBIDDEN",
        message: "You can only delete your own comment",
      });
    }

    const idsToDelete = [rootComment.id];
    const levels = [[rootComment.id]];
    let cursor = [rootComment.id];

    while (cursor.length > 0) {
      const children = await prisma.adviceComment.findMany({
        where: {
          parentId: { in: cursor },
          adviceId: advice.id,
        },
        select: { id: true },
      });

      if (children.length === 0) {
        break;
      }

      const next = children.map((item) => item.id);
      idsToDelete.push(...next);
      levels.push(next);
      cursor = next;
    }

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({
        where: {
          commentId: { in: idsToDelete },
        },
      });

      for (let i = levels.length - 1; i >= 0; i -= 1) {
        await tx.adviceComment.deleteMany({
          where: {
            id: { in: levels[i] },
          },
        });
      }
    });

    return res.json({
      success: true,
      removedCount: idsToDelete.length,
    });
  } catch {
    return sendError(res, {
      status: 500,
      code: "COMMENT_DELETE_FAILED",
      message: "Failed to remove comment",
    });
  }
});

app.get("/api/moderation/advice", authRequired, moderatorOrAdminRequired, async (req, res) => {
  const status = String(req.query.status || ADVICE_STATUS.PENDING);
  const finalStatus = Object.values(ADVICE_STATUS).includes(status) ? status : ADVICE_STATUS.PENDING;

  const list = await prisma.advice.findMany({
    where: { status: finalStatus },
    orderBy: { createdAt: "desc" },
    include: { author: true, category: true, group: true },
  });

  return res.json({ advices: list.map(sanitizeAdvice) });
});

app.patch("/api/moderation/advice/:id", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const data = moderateAdviceSchema.parse(req.body);

    const advice = await prisma.advice.update({
      where: { id: req.params.id },
      data: {
        status: data.action,
        holdReason: data.action === ADVICE_STATUS.HOLD ? data.note || null : null,
        ...(data.action !== ADVICE_STATUS.APPROVED
          ? {
              isBoostActive: false,
              boostActivatedAt: null,
              boostExpiresAt: null,
            }
          : {}),
        moderatedById: req.user.id,
        moderatedAt: new Date(),
      },
      include: { author: true, category: true, group: true },
    });

    await prisma.adviceModerationAction.create({
      data: {
        adviceId: advice.id,
        moderatorId: req.user.id,
        action: data.action,
        note: data.note || null,
      },
    });

    if (advice.authorId !== req.user.id) {
      await createNotification({
        userId: advice.authorId,
        type: NOTIFICATION_TYPES.MODERATION,
        title: "Advice moderation update",
        body: `Your thread status is now ${advice.status}.`,
        adviceId: advice.id,
      });
    }

    return res.json({ advice: sanitizeAdvice(advice) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }
    if (isPrismaNotFoundError(error)) {
      return sendError(res, {
        status: 404,
        code: "ADVICE_NOT_FOUND",
        message: "Advice not found",
      });
    }
    return sendError(res, {
      status: 500,
      code: "ADVICE_MODERATION_UPDATE_FAILED",
      message: "Failed to update moderation status",
    });
  }
});

app.patch("/api/moderation/advice/:id/flags", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const data = adviceFlagsSchema.parse(req.body);

    const advice = await prisma.advice.update({
      where: { id: req.params.id },
      data: {
        ...(data.isLocked !== undefined ? { isLocked: data.isLocked } : {}),
        ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
        ...(data.isSpam !== undefined ? { isSpam: data.isSpam } : {}),
        ...(data.isLocked === true
          ? {
              isBoostActive: false,
              boostActivatedAt: null,
              boostExpiresAt: null,
            }
          : {}),
        moderatedById: req.user.id,
        moderatedAt: new Date(),
      },
      include: { author: true, category: true, group: true },
    });

    await prisma.adviceModerationAction.create({
      data: {
        adviceId: advice.id,
        moderatorId: req.user.id,
        action: "FLAGS_UPDATED",
        note: `locked=${String(advice.isLocked)}, featured=${String(advice.isFeatured)}, spam=${String(advice.isSpam)}`,
      },
    });

    if (advice.authorId !== req.user.id) {
      await createNotification({
        userId: advice.authorId,
        type: NOTIFICATION_TYPES.MODERATION,
        title: "Advice moderation flags updated",
        body: `Thread flags changed: locked=${String(advice.isLocked)}, featured=${String(advice.isFeatured)}, spam=${String(advice.isSpam)}.`,
        adviceId: advice.id,
      });
    }

    return res.json({ advice: sanitizeAdvice(advice) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: error.issues,
      });
    }
    if (isPrismaNotFoundError(error)) {
      return sendError(res, {
        status: 404,
        code: "ADVICE_NOT_FOUND",
        message: "Advice not found",
      });
    }
    return sendError(res, {
      status: 500,
      code: "ADVICE_FLAGS_UPDATE_FAILED",
      message: "Failed to update moderation flags",
    });
  }
});

app.delete(
  "/api/moderation/advice/:adviceId/comments/:commentId",
  authRequired,
  moderatorOrAdminRequired,
  async (req, res) => {
    try {
      const payload = moderateCommentDeleteSchema.parse(req.body || {});

      const advice = await prisma.advice.findUnique({ where: { id: req.params.adviceId } });
      if (!advice) {
        return sendError(res, {
          status: 404,
          code: "ADVICE_NOT_FOUND",
          message: "Advice not found",
        });
      }

      const rootComment = await prisma.adviceComment.findUnique({
        where: { id: req.params.commentId },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      if (!rootComment || rootComment.adviceId !== advice.id) {
        return sendError(res, {
          status: 404,
          code: "COMMENT_NOT_FOUND",
          message: "Comment not found",
        });
      }

      const idsToDelete = [rootComment.id];
      const levels = [[rootComment.id]];
      let cursor = [rootComment.id];

      while (cursor.length > 0) {
        const children = await prisma.adviceComment.findMany({
          where: {
            parentId: { in: cursor },
            adviceId: advice.id,
          },
          select: { id: true },
        });

        if (children.length === 0) {
          break;
        }

        const next = children.map((item) => item.id);
        idsToDelete.push(...next);
        levels.push(next);
        cursor = next;
      }

      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({
          where: {
            commentId: { in: idsToDelete },
          },
        });

        for (let i = levels.length - 1; i >= 0; i -= 1) {
          await tx.adviceComment.deleteMany({
            where: {
              id: { in: levels[i] },
            },
          });
        }

        await tx.adviceModerationAction.create({
          data: {
            adviceId: advice.id,
            moderatorId: req.user.id,
            action: "COMMENT_REMOVED",
            note: payload.reason || `Deleted comment ${rootComment.id} and ${idsToDelete.length - 1} replies`,
          },
        });
      });

      if (rootComment.authorId !== req.user.id) {
        await createNotification({
          userId: rootComment.authorId,
          type: NOTIFICATION_TYPES.MODERATION,
          title: "Comment removed by moderation",
          body: payload.reason || "Your comment was removed by a moderator.",
          adviceId: advice.id,
        });
      }

      return res.json({
        success: true,
        removedCount: idsToDelete.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, {
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: error.issues,
        });
      }
      return sendError(res, {
        status: 500,
        code: "MODERATION_COMMENT_DELETE_FAILED",
        message: "Failed to remove comment",
      });
    }
  },
);

app.get("/api/groups", async (req, res) => {
  try {
    const viewer = await getOptionalAuthUser(req);

    const where = {
      isActive: true,
      ...(viewer
        ? {
            OR: [
              { visibility: GROUP_VISIBILITY.PUBLIC },
              { memberships: { some: { userId: viewer.id } } },
            ],
          }
        : { visibility: GROUP_VISIBILITY.PUBLIC }),
    };

    const groups = await prisma.discussionGroup.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        owner: {
          select: { id: true, name: true, isActive: true },
        },
        memberships: viewer
          ? {
              where: { userId: viewer.id },
              take: 1,
            }
          : false,
        _count: {
          select: { memberships: true },
        },
      },
      take: 200,
    });

    return res.json({
      groups: groups.map((group) =>
        sanitizeDiscussionGroup(group, {
          membership: Array.isArray(group.memberships) && group.memberships[0]
            ? {
                role: group.memberships[0].role,
                joinedAt: group.memberships[0].joinedAt,
              }
            : null,
          memberCount: group._count.memberships,
        }),
      ),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load groups" });
  }
});

app.post("/api/groups", authRequired, async (req, res) => {
  try {
    const data = createDiscussionGroupSchema.parse(req.body);
    const baseSlug = slugify(data.name) || `group-${Date.now()}`;

    let uniqueSlug = baseSlug;
    for (let i = 0; i < 8; i += 1) {
      const existing = await prisma.discussionGroup.findUnique({ where: { slug: uniqueSlug } });
      if (!existing) break;
      uniqueSlug = `${baseSlug}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.discussionGroup.create({
        data: {
          name: data.name,
          description: data.description || null,
          visibility: data.visibility,
          ownerId: req.user.id,
          slug: uniqueSlug,
          isActive: true,
        },
        include: {
          owner: {
            select: { id: true, name: true, isActive: true },
          },
        },
      });

      await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId: req.user.id,
          role: GROUP_MEMBER_ROLE.OWNER,
        },
      });

      return group;
    });

    return res.status(201).json({ group: sanitizeDiscussionGroup(created, { membership: { role: GROUP_MEMBER_ROLE.OWNER } }) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to create group" });
  }
});

app.get("/api/groups/:id", async (req, res) => {
  try {
    const viewer = await getOptionalAuthUser(req);
    const group = await prisma.discussionGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, name: true, isActive: true },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!group || !group.isActive) {
      return res.status(404).json({ message: "Group not found" });
    }

    const viewerMembership = viewer
      ? group.memberships.find((item) => item.userId === viewer.id) || null
      : null;

    if (
      group.visibility === GROUP_VISIBILITY.PRIVATE &&
      !viewerMembership &&
      !(viewer && canUserModerateGroup(group, viewer))
    ) {
      return res.status(403).json({ message: "Private group" });
    }

    const pendingCount = await prisma.groupJoinRequest.count({
      where: {
        groupId: group.id,
        status: GROUP_JOIN_STATUS.PENDING,
      },
    });

    return res.json({
      group: sanitizeDiscussionGroup(group, {
        membership: viewerMembership
          ? { role: viewerMembership.role, joinedAt: viewerMembership.joinedAt }
          : null,
        memberCount: group.memberships.length,
      }),
      members: group.memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
        user: membership.user,
      })),
      pendingRequests: pendingCount,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load group" });
  }
});

app.post("/api/groups/:id/join", authRequired, async (req, res) => {
  try {
    const payload = createGroupJoinRequestSchema.parse(req.body || {});

    const group = await prisma.discussionGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!group || !group.isActive) {
      return res.status(404).json({ message: "Group not found" });
    }

    const existingMembership = await prisma.groupMembership.findFirst({
      where: {
        groupId: group.id,
        userId: req.user.id,
      },
    });

    if (existingMembership) {
      return res.json({
        status: "MEMBER",
        membership: {
          role: existingMembership.role,
          joinedAt: existingMembership.joinedAt,
        },
      });
    }

    if (group.visibility === GROUP_VISIBILITY.PUBLIC) {
      const membership = await prisma.groupMembership.create({
        data: {
          groupId: group.id,
          userId: req.user.id,
          role: GROUP_MEMBER_ROLE.MEMBER,
        },
      });

      return res.status(201).json({
        status: "JOINED",
        membership: {
          role: membership.role,
          joinedAt: membership.joinedAt,
        },
      });
    }

    const existingPending = await prisma.groupJoinRequest.findFirst({
      where: {
        groupId: group.id,
        requesterId: req.user.id,
        status: GROUP_JOIN_STATUS.PENDING,
      },
    });

    if (existingPending) {
      return res.json({ status: GROUP_JOIN_STATUS.PENDING, requestId: existingPending.id });
    }

    const joinRequest = await prisma.groupJoinRequest.create({
      data: {
        groupId: group.id,
        requesterId: req.user.id,
        status: GROUP_JOIN_STATUS.PENDING,
        message: payload.message || null,
      },
    });

    if (group.ownerId !== req.user.id && group.owner?.isActive) {
      await createNotification({
        userId: group.ownerId,
        type: NOTIFICATION_TYPES.GROUP_JOIN_REQUEST,
        title: "New group join request",
        body: `${req.user.name} requested to join ${group.name}.`,
      });
    }

    return res.status(201).json({
      status: GROUP_JOIN_STATUS.PENDING,
      requestId: joinRequest.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to join group" });
  }
});

app.get("/api/groups/:id/join-requests", authRequired, async (req, res) => {
  try {
    const group = await prisma.discussionGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!group || !group.isActive) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isOwner = group.ownerId === req.user.id;
    const canFallback = canFallbackModerateGroupJoin(group, req.user);

    if (!isOwner && !canFallback) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requests = await prisma.groupJoinRequest.findMany({
      where: {
        groupId: group.id,
        status: GROUP_JOIN_STATUS.PENDING,
      },
      include: {
        requester: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { requestedAt: "asc" },
      take: 200,
    });

    return res.json({
      requests: requests.map((request) => ({
        id: request.id,
        status: request.status,
        message: request.message,
        requestedAt: request.requestedAt,
        requester: request.requester,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load join requests" });
  }
});

app.post("/api/groups/:id/join-requests/:requestId/approve", authRequired, async (req, res) => {
  try {
    const payload = reviewGroupJoinRequestSchema.parse(req.body || {});
    const joinRequest = await prisma.groupJoinRequest.findFirst({
      where: {
        id: req.params.requestId,
        groupId: req.params.id,
      },
      include: {
        group: {
          include: {
            owner: {
              select: { id: true, isActive: true },
            },
          },
        },
      },
    });

    if (!joinRequest || !joinRequest.group.isActive) {
      return res.status(404).json({ message: "Join request not found" });
    }

    if (joinRequest.status !== GROUP_JOIN_STATUS.PENDING) {
      return res.status(409).json({ message: "Join request already resolved" });
    }

    const isOwner = joinRequest.group.ownerId === req.user.id;
    const canFallback = canFallbackModerateGroupJoin(joinRequest.group, req.user);

    if (!isOwner && !canFallback) {
      return res.status(403).json({ message: "Only the owner can approve while owner is active" });
    }

    const authority = isOwner
      ? "OWNER"
      : !joinRequest.group.owner
        ? "MODERATOR_FALLBACK_NO_OWNER"
        : "MODERATOR_FALLBACK_OWNER_INACTIVE";

    await prisma.$transaction(async (tx) => {
      await tx.groupJoinRequest.update({
        where: { id: joinRequest.id },
        data: {
          status: GROUP_JOIN_STATUS.APPROVED,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
          decisionReason: payload.reason || null,
        },
      });

      await tx.groupMembership.upsert({
        where: {
          groupId_userId: {
            groupId: joinRequest.groupId,
            userId: joinRequest.requesterId,
          },
        },
        update: {},
        create: {
          groupId: joinRequest.groupId,
          userId: joinRequest.requesterId,
          role: GROUP_MEMBER_ROLE.MEMBER,
        },
      });

      await tx.groupModerationAction.create({
        data: {
          groupId: joinRequest.groupId,
          actorId: req.user.id,
          action: "JOIN_REQUEST_APPROVED",
          reason: payload.reason || null,
          metadata: JSON.stringify({ requestId: joinRequest.id, authority }),
        },
      });
    });

    await createNotification({
      userId: joinRequest.requesterId,
      type: NOTIFICATION_TYPES.GROUP_JOIN_APPROVED,
      title: "Group join approved",
      body: `Your request to join ${joinRequest.group.name} was approved.`,
    });

    return res.json({ success: true, authority });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to approve join request" });
  }
});

app.post("/api/groups/:id/join-requests/:requestId/reject", authRequired, async (req, res) => {
  try {
    const payload = reviewGroupJoinRequestSchema.parse(req.body || {});
    const joinRequest = await prisma.groupJoinRequest.findFirst({
      where: {
        id: req.params.requestId,
        groupId: req.params.id,
      },
      include: {
        group: {
          include: {
            owner: {
              select: { id: true, isActive: true },
            },
          },
        },
      },
    });

    if (!joinRequest || !joinRequest.group.isActive) {
      return res.status(404).json({ message: "Join request not found" });
    }

    if (joinRequest.status !== GROUP_JOIN_STATUS.PENDING) {
      return res.status(409).json({ message: "Join request already resolved" });
    }

    const isOwner = joinRequest.group.ownerId === req.user.id;
    const canFallback = canFallbackModerateGroupJoin(joinRequest.group, req.user);
    if (!isOwner && !canFallback) {
      return res.status(403).json({ message: "Only the owner can reject while owner is active" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupJoinRequest.update({
        where: { id: joinRequest.id },
        data: {
          status: GROUP_JOIN_STATUS.REJECTED,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
          decisionReason: payload.reason || null,
        },
      });

      await tx.groupModerationAction.create({
        data: {
          groupId: joinRequest.groupId,
          actorId: req.user.id,
          action: "JOIN_REQUEST_REJECTED",
          reason: payload.reason || null,
          metadata: JSON.stringify({ requestId: joinRequest.id }),
        },
      });
    });

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to reject join request" });
  }
});

app.post("/api/groups/:id/leave", authRequired, async (req, res) => {
  try {
    const group = await prisma.discussionGroup.findUnique({ where: { id: req.params.id } });
    if (!group || !group.isActive) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.ownerId === req.user.id) {
      return res.status(400).json({ message: "Owner cannot leave group. Transfer ownership first." });
    }

    await prisma.groupMembership.deleteMany({
      where: {
        groupId: group.id,
        userId: req.user.id,
      },
    });

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ message: "Failed to leave group" });
  }
});

app.get("/api/messages/conversations", authRequired, async (req, res) => {
  const links = await prisma.conversationParticipant.findMany({
    where: { userId: req.user.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return res.json({
    conversations: links.map((link) => ({
      id: link.conversation.id,
      participants: link.conversation.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
      })),
      lastMessage: link.conversation.messages[0]
        ? {
            id: link.conversation.messages[0].id,
            body: link.conversation.messages[0].body,
            createdAt: link.conversation.messages[0].createdAt,
          }
        : null,
    })),
  });
});

app.post("/api/messages/conversations", authRequired, async (req, res) => {
  try {
    const data = createConversationSchema.parse(req.body);

    if (data.recipientId === req.user.id) {
      return res.status(400).json({ message: "Cannot message yourself" });
    }

    const recipient = await prisma.user.findUnique({ where: { id: data.recipientId } });
    if (!recipient || !recipient.isActive) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [req.user.id, data.recipientId] },
          },
        },
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      return res.json({ conversation: { id: existing.id } });
    }

    const conversation = await prisma.conversation.create({
      data: {
        createdById: req.user.id,
        participants: {
          create: [{ userId: req.user.id }, { userId: data.recipientId }],
        },
      },
    });

    return res.status(201).json({ conversation: { id: conversation.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to create conversation" });
  }
});

app.get("/api/messages/conversations/:id", authRequired, async (req, res) => {
  const link = await prisma.conversationParticipant.findFirst({
    where: { conversationId: req.params.id, userId: req.user.id },
  });

  if (!link) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: "asc" },
    include: { sender: true },
  });

  return res.json({
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      sender: { id: message.sender.id, name: message.sender.name },
    })),
  });
});

app.post("/api/messages/conversations/:id", authRequired, async (req, res) => {
  try {
    const data = createMessageSchema.parse(req.body);

    const link = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: req.user.id },
    });

    if (!link) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const message = await prisma.message.create({
      data: {
        body: data.body,
        conversationId: req.params.id,
        senderId: req.user.id,
      },
      include: { sender: true },
    });

    return res.status(201).json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        sender: { id: message.sender.id, name: message.sender.name },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to send message" });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`TellNab API running on http://localhost:${PORT}`);
});
