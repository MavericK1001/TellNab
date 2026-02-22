const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
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
const multer = require("multer");
const { WebSocketServer } = require("ws");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { createSupportModule } = require("../modules/Support");

const ROLES = {
  MEMBER: "MEMBER",
  SUPPORT_MEMBER: "SUPPORT_MEMBER",
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
  REACTION: "REACTION",
  ADVISOR_ACTIVITY: "ADVISOR_ACTIVITY",
  CRISIS_ALERT: "CRISIS_ALERT",
  MATCHED_QUESTION: "MATCHED_QUESTION",
  URGENT_QUESTION: "URGENT_QUESTION",
  GROUP_JOIN_REQUEST: "GROUP_JOIN_REQUEST",
  GROUP_JOIN_APPROVED: "GROUP_JOIN_APPROVED",
};

const ADVICE_VISIBILITY = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
};

const ADVICE_IDENTITY_MODE = {
  ANONYMOUS: "ANONYMOUS",
  PUBLIC: "PUBLIC",
};

const ADVICE_PRIORITY_TIER = {
  NORMAL: "NORMAL",
  PRIORITY: "PRIORITY",
  URGENT: "URGENT",
};

const ADVICE_COMMENT_TYPE = {
  TEXT: "TEXT",
  VOICE: "VOICE",
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

const SUPPORT_TICKET_PRIORITY = {
  URGENT: "URGENT",
  NORMAL: "NORMAL",
  LOW: "LOW",
};

const SUPPORT_MESSAGE_SENDER = {
  MEMBER: "MEMBER",
  AGENT: "AGENT",
  SYSTEM: "SYSTEM",
};

const SUPPORT_SLA_HOURS = {
  [SUPPORT_TICKET_PRIORITY.URGENT]: 4,
  [SUPPORT_TICKET_PRIORITY.NORMAL]: 24,
  [SUPPORT_TICKET_PRIORITY.LOW]: 72,
};

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.SERVER_PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const CORS_ORIGINS = process.env.CORS_ORIGINS || "";
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "12h";
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const TELLNAB_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)?tellnab\.com$/i;
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
const SUPPORT_PORTAL_URL = process.env.SUPPORT_PORTAL_URL || "https://support.tellnab.com";
const SUPPORT_EMAIL_WEBHOOK_URL = process.env.SUPPORT_EMAIL_WEBHOOK_URL || "";
const SUPPORT_EMAIL_FROM = String(process.env.SUPPORT_EMAIL_FROM || "contact@tellnab.com").trim();
const SUPPORT_SUBDOMAIN = String(process.env.SUPPORT_SUBDOMAIN || "support.tellnab.com").toLowerCase();
const ENABLE_LEGACY_SUPPORT = String(process.env.ENABLE_LEGACY_SUPPORT || "false").toLowerCase() === "true";
const AUTH_COOKIE_DOMAIN = String(process.env.AUTH_COOKIE_DOMAIN || "").trim();
const FEATURE_PUBLIC_FEED_V2 = String(process.env.FEATURE_PUBLIC_FEED_V2 || "false").toLowerCase() === "true";
const FEATURE_ADVISOR_PROFILES =
  String(process.env.FEATURE_ADVISOR_PROFILES || "false").toLowerCase() === "true";
const FEATURE_PRIORITY_ADVICE =
  String(process.env.FEATURE_PRIORITY_ADVICE || "false").toLowerCase() === "true";
const FEATURE_REALTIME_NOTIFICATIONS =
  String(process.env.FEATURE_REALTIME_NOTIFICATIONS || "false").toLowerCase() === "true";
const FEATURE_VOICE_REPLIES = String(process.env.FEATURE_VOICE_REPLIES || "false").toLowerCase() === "true";
const FEATURE_CRISIS_DETECTION =
  String(process.env.FEATURE_CRISIS_DETECTION || "false").toLowerCase() === "true";
const FEATURE_SAVED_ADVICE = String(process.env.FEATURE_SAVED_ADVICE || "false").toLowerCase() === "true";
const PHASE1_SMART_MATCHING = String(process.env.PHASE1_SMART_MATCHING || "false").toLowerCase() === "true";
const PHASE1_ADVISOR_LEVELS = String(process.env.PHASE1_ADVISOR_LEVELS || "false").toLowerCase() === "true";
const PHASE1_URGENT_MODE = String(process.env.PHASE1_URGENT_MODE || "false").toLowerCase() === "true";
const PHASE1_SHARE_CARDS = String(process.env.PHASE1_SHARE_CARDS || "false").toLowerCase() === "true";
const GUEST_ADVICE_EMAIL =
  String(process.env.GUEST_ADVICE_EMAIL || "anonymous.poster@tellnab.local").trim().toLowerCase();
const GUEST_ADVICE_NAME = String(process.env.GUEST_ADVICE_NAME || "Anonymous User").trim() || "Anonymous User";

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
  VERIFIED_ADVISOR: "VERIFIED_ADVISOR",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  TOP_CONTRIBUTOR: "TOP_CONTRIBUTOR",
  MOST_HELPFUL: "MOST_HELPFUL",
  HELPFUL_100: "HELPFUL_100",
  TRENDING_ADVISOR: "TRENDING_ADVISOR",
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
        (normalizedOrigin && TELLNAB_ORIGIN_PATTERN.test(normalizedOrigin)) ||
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
app.locals.prisma = prisma;

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || "") || "";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});
const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: Number(process.env.SUPPORT_UPLOAD_MAX_BYTES || 10 * 1024 * 1024),
  },
});

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

const supportCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.SUPPORT_CREATE_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many support submissions. Please try again shortly." },
});

const supportReplyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.SUPPORT_REPLY_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many support replies. Please wait and try again." },
});

app.use("/api/auth", authLimiter);

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

function buildAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12,
    ...(AUTH_COOKIE_DOMAIN ? { domain: AUTH_COOKIE_DOMAIN } : {}),
  };
}

function buildAuthClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(AUTH_COOKIE_DOMAIN ? { domain: AUTH_COOKIE_DOMAIN } : {}),
  };
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

function supportStaffRequired(req, res, next) {
  if (
    !req.user ||
    (req.user.role !== ROLES.ADMIN &&
      req.user.role !== ROLES.MODERATOR &&
      req.user.role !== ROLES.SUPPORT_MEMBER)
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

const realtimeHub = {
  emitTicketMessage: (_ticketId, _message) => {},
  emitPrivateMessage: (_targetUserId, _message) => {},
  emitUserEvent: (_targetUserId, _eventType, _payload) => {},
  notifyPresence: () => {},
};

if (String(process.env.ENABLE_SUPPORT_V2 || "true").toLowerCase() !== "false") {
  const supportModuleRouter = createSupportModule({
    authRequired,
    realtimeHub,
    sendSupportEmailNotification,
    supportPortalUrl: SUPPORT_PORTAL_URL,
    supportFromEmail: SUPPORT_EMAIL_FROM,
  });
  const supportApiPrefixes = [
    "/api/tickets",
    "/api/departments",
    "/api/users",
    "/api/roles",
    "/api/reports",
  ];

  function getRequestHost(req) {
    const rawForwarded = req.headers["x-forwarded-host"];
    const forwardedHost =
      typeof rawForwarded === "string" ? rawForwarded.split(",")[0].trim() : "";
    const host = (forwardedHost || req.headers.host || "").toLowerCase();
    return host.split(":")[0];
  }

  function isSupportSubdomainRequest(req) {
    return getRequestHost(req) === SUPPORT_SUBDOMAIN;
  }

  function isSupportApiPath(req) {
    const path = String(req.path || "");
    return supportApiPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  // Support 2.0 loads for support subdomain traffic and direct Support API paths.
  app.use((req, res, next) => {
    if (!isSupportSubdomainRequest(req) && !isSupportApiPath(req)) {
      return next();
    }
    return supportModuleRouter(req, res, next);
  });
}

function sanitizeAdvice(advice) {
  const identityMode = resolveAdviceIdentityMode(advice);
  const isAnonymous = identityMode === ADVICE_IDENTITY_MODE.ANONYMOUS;

  return {
    id: advice.id,
    title: advice.title,
    body: stripLegacyAnonymousPrefix(advice.body),
    status: advice.status,
    identityMode,
    isAnonymous,
    visibility: advice.visibility || ADVICE_VISIBILITY.PUBLIC,
    isLocked: advice.isLocked,
    isFeatured: advice.isFeatured,
    isSpam: advice.isSpam,
    isCrisisFlagged: Boolean(advice.isCrisisFlagged),
    crisisKeywords: advice.crisisKeywords || null,
    isBoostActive: advice.isBoostActive,
    helpfulCount: Number(advice.helpfulCount || 0),
    viewCount: Number(advice.viewCount || 0),
    priorityTier: advice.priorityTier || ADVICE_PRIORITY_TIER.NORMAL,
    priorityScore: Number(advice.priorityScore || 0),
    boostExpiresAt: advice.boostExpiresAt || null,
    holdReason: advice.holdReason,
    tags: advice.tags ? parseJsonArray(advice.tags) : null,
    targetAudience: advice.targetAudience || null,
    isUrgent: Boolean(advice.isUrgent),
    followCount: Number(advice.followCount || 0),
    isFollowing: Boolean(advice.isFollowing),
    isOwner: Boolean(advice.isOwner),
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
          id: isAnonymous ? undefined : advice.author.id,
          name: isAnonymous ? "Anonymous" : advice.author.name,
          displayName: isAnonymous
            ? "Anonymous"
            : advice.author.advisorProfile?.displayName || advice.author.name,
          role: isAnonymous ? undefined : advice.author.role,
          roleLabel: isAnonymous ? undefined : roleLabelFromUser(advice.author),
          roleTone: isAnonymous ? undefined : roleToneFromUser(advice.author),
          advisorCategory: isAnonymous ? null : advisorCategoryFromUser(advice.author),
          badges: isAnonymous ? [] : normalizeIdentityBadges(advice.author),
          avatarUrl: isAnonymous ? null : advice.author.avatarUrl || null,
          advisorProfile: !isAnonymous && advice.author.advisorProfile
            ? {
                displayName: advice.author.advisorProfile.displayName,
                isVerified: Boolean(advice.author.advisorProfile.isVerified),
                ratingAvg: Number(advice.author.advisorProfile.ratingAvg || 0),
                totalReplies: Number(advice.author.advisorProfile.totalReplies || 0),
                helpfulCount: Number(advice.author.advisorProfile.helpfulCount || 0),
                responseTimeMins: Number(advice.author.advisorProfile.responseTimeMins || 0),
                level: String(advice.author.advisorProfile.level || "NEW"),
              }
            : null,
        }
      : undefined,
  };
}

function adviceAuthorInclude() {
  return {
    include: {
      ...(FEATURE_ADVISOR_PROFILES ? { advisorProfile: true } : {}),
      badges: {
        where: { isVisible: true },
        include: { badge: true },
        orderBy: { awardedAt: "desc" },
        take: 8,
      },
    },
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

function roleLabelFromUser(user) {
  if (!user) return "Member";
  if (user.role === ROLES.ADMIN) return "Admin";
  if (user.role === ROLES.MODERATOR) return "Moderator";
  if (Boolean(user.advisorProfile?.isVerified)) return "Verified Advisor";
  if (Number(user.advisorProfile?.helpfulCount || 0) >= 25) return "Top Contributor";
  return "Member";
}

function roleToneFromUser(user) {
  if (!user) return "slate";
  if (user.role === ROLES.ADMIN) return "rose";
  if (user.role === ROLES.MODERATOR) return "violet";
  if (Boolean(user.advisorProfile?.isVerified)) return "emerald";
  if (Number(user.advisorProfile?.helpfulCount || 0) >= 25) return "amber";
  return "slate";
}

function advisorCategoryFromUser(user) {
  const specialties = parseJsonArray(user?.advisorProfile?.specialties);
  return specialties.length ? String(specialties[0]) : null;
}

function normalizeIdentityBadges(user) {
  const assigned = Array.isArray(user?.badges)
    ? user.badges
        .filter((item) => item?.badge?.isActive && item.isVisible !== false)
        .map((item) => ({
          key: item.badge.key,
          name: item.badge.name,
          description: item.badge.description,
          icon: item.badge.icon,
          tone:
            item.badge.key === BADGE_KEYS.ADMIN
              ? "rose"
              : item.badge.key === BADGE_KEYS.MODERATOR
                ? "violet"
                : item.badge.key === BADGE_KEYS.VERIFIED_ADVISOR
                  ? "emerald"
                  : item.badge.key === BADGE_KEYS.TOP_CONTRIBUTOR
                    ? "amber"
                    : "cyan",
        }))
    : [];

  const deduped = new Map();
  assigned.forEach((item) => {
    deduped.set(item.key, item);
  });
  return Array.from(deduped.values());
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
  const [threadCount, replyCount, helpfulReceivedAgg, profile, user] = await Promise.all([
    prisma.advice.count({ where: { authorId: userId } }),
    prisma.adviceComment.count({ where: { authorId: userId } }),
    prisma.advice.aggregate({
      where: { authorId: userId },
      _sum: { helpfulCount: true },
    }),
    FEATURE_ADVISOR_PROFILES ? prisma.advisorProfile.findUnique({ where: { userId } }) : null,
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);

  const helpfulReceived = Number(helpfulReceivedAgg?._sum?.helpfulCount || 0);

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

    if (Boolean(profile?.isVerified)) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.VERIFIED_ADVISOR,
        source: "AUTO",
        reason: "Advisor profile is verified",
      });
    }

    if (user?.role === ROLES.MODERATOR) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.MODERATOR,
        source: "AUTO",
        reason: "Moderator trust role",
      });
    }

    if (user?.role === ROLES.ADMIN) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.ADMIN,
        source: "AUTO",
        reason: "Admin trust role",
      });
    }

    if (replyCount >= 25 || helpfulReceived >= 40) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.TOP_CONTRIBUTOR,
        source: "AUTO",
        reason: "High contribution activity",
      });
    }

    if (helpfulReceived >= 60) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.MOST_HELPFUL,
        source: "AUTO",
        reason: "Received consistently helpful reactions",
      });
    }

    if (helpfulReceived >= 100) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.HELPFUL_100,
        source: "AUTO",
        reason: "Crossed 100+ helpful reactions",
      });
    }

    if (
      Number(profile?.levelScore || 0) >= 130 ||
      Number(profile?.followersCount || 0) >= 12 ||
      helpfulReceived >= 80
    ) {
      await awardBadgeIfMissing(tx, {
        userId,
        badgeKey: BADGE_KEYS.TRENDING_ADVISOR,
        source: "AUTO",
        reason: "Strong advisor momentum",
      });
    }
  });
}

async function createNotification(data) {
  try {
    const created = await prisma.notification.create({ data });
    if (FEATURE_REALTIME_NOTIFICATIONS && created?.userId) {
      realtimeHub.emitUserEvent(created.userId, "notification_received", {
        notification: sanitizeNotification(created),
      });
    }
    return created;
  } catch {
    // notifications should not break primary user action
    return null;
  }
}

function sanitizeAdvisorProfile(profile, options = {}) {
  if (!profile) return null;
  const specialties = (() => {
    try {
      return JSON.parse(profile.specialties || "[]");
    } catch {
      return [];
    }
  })();

  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || null,
    bio: profile.bio || null,
    specialties: Array.isArray(specialties) ? specialties : [],
    isVerified: Boolean(profile.isVerified),
    rating: Number(profile.ratingAvg || 0),
    ratingCount: Number(profile.ratingCount || 0),
    totalReplies: Number(profile.totalReplies || 0),
    helpfulCount: Number(profile.helpfulCount || 0),
    responseTimeMins: Number(profile.responseTimeMins || 0),
    level: String(profile.level || "NEW"),
    levelScore: Number(profile.levelScore || 0),
    followersCount: Number(profile.followersCount || 0),
    isFollowing: Boolean(options.isFollowing),
    user: profile.user
      ? {
          id: profile.user.id,
          name: profile.user.name,
          role: profile.user.role,
        }
      : null,
  };
}

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "self harm",
  "self-harm",
  "want to die",
  "hurt myself",
  "overdose",
  "can't go on",
  "ending it all",
];

function detectCrisisKeywords(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return [];
  return CRISIS_KEYWORDS.filter((keyword) => normalized.includes(keyword));
}

function buildTrendingScore(advice) {
  const createdAt = new Date(advice.createdAt || Date.now()).getTime();
  const ageHours = Math.max(1, (Date.now() - createdAt) / (1000 * 60 * 60));
  const helpful = Number(advice.helpfulCount || 0);
  const views = Number(advice.viewCount || 0);
  const followCount = Number(advice.followCount || 0);
  const priority = advice.priorityTier === ADVICE_PRIORITY_TIER.URGENT
    ? 100
    : advice.priorityTier === ADVICE_PRIORITY_TIER.PRIORITY
      ? 30
      : 0;
  return Math.round((helpful * 6 + followCount * 4 + views * 0.2 + priority) / Math.pow(ageHours, 0.8));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeAdvisorLevel(stats) {
  const helpful = Number(stats.helpfulCount || 0);
  const replies = Number(stats.totalReplies || 0);
  const responseTimeMins = Number(stats.responseTimeMins || 1440);
  const consistency = Number(stats.consistency || 0);

  const responseSpeedScore = responseTimeMins <= 30 ? 40 : responseTimeMins <= 120 ? 25 : responseTimeMins <= 360 ? 10 : 0;
  const score = helpful * 2 + replies + consistency * 4 + responseSpeedScore;

  if (score >= 250) return { level: "ELITE_ADVISOR", levelScore: score };
  if (score >= 150) return { level: "PRO_ADVISOR", levelScore: score };
  if (score >= 90) return { level: "TOP_LISTENER", levelScore: score };
  if (score >= 35) return { level: "ACTIVE", levelScore: score };
  return { level: "NEW", levelScore: score };
}

async function recalculateAdvisorStats(userId) {
  if (!PHASE1_ADVISOR_LEVELS || !FEATURE_ADVISOR_PROFILES) return;

  try {
    const [profile, totalReplies, helpfulCount, recentReplies] = await Promise.all([
      prisma.advisorProfile.findUnique({ where: { userId } }),
      prisma.adviceComment.count({ where: { authorId: userId } }),
      prisma.adviceReaction.count({
        where: {
          type: "HELPFUL",
          advice: {
            comments: { some: { authorId: userId } },
          },
        },
      }),
      prisma.adviceComment.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { createdAt: true },
      }),
    ]);

    if (!profile) return;

    let consistency = 0;
    if (recentReplies.length > 1) {
      const newest = new Date(recentReplies[0].createdAt).getTime();
      const oldest = new Date(recentReplies[recentReplies.length - 1].createdAt).getTime();
      const spanDays = Math.max(1, (newest - oldest) / (1000 * 60 * 60 * 24));
      consistency = Math.min(10, Math.round(recentReplies.length / spanDays));
    }

    const avgResponse = Number(profile.responseTimeMins || 1440);
    const levelResult = computeAdvisorLevel({ helpfulCount, totalReplies, responseTimeMins: avgResponse, consistency });

    await prisma.advisorProfile.update({
      where: { userId },
      data: {
        totalReplies,
        helpfulCount,
        level: levelResult.level,
        levelScore: levelResult.levelScore,
        statsUpdatedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
  } catch {
    // stats are best-effort and must not break request flow
  }
}

function scheduleAdvisorStatsRecalculation(userId) {
  if (!PHASE1_ADVISOR_LEVELS || !userId) return;
  setTimeout(() => {
    recalculateAdvisorStats(userId).catch(() => null);
  }, 0);
}

async function matchAdvisorsToQuestion(adviceId) {
  if (!PHASE1_SMART_MATCHING || !FEATURE_ADVISOR_PROFILES) return [];

  const advice = await prisma.advice.findUnique({
    where: { id: adviceId },
    include: { category: true },
  });
  if (!advice) return [];

  const now = new Date();
  const cached = await prisma.adviceAdvisorMatch.findMany({
    where: {
      adviceId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
  });
  if (cached.length) return cached;

  const tags = parseJsonArray(advice.tags).map((item) => String(item).toLowerCase());
  const categoryToken = String(advice.category?.name || "").toLowerCase();

  const candidates = await prisma.advisorProfile.findMany({
    where: { isPublic: true },
    include: {
      user: { select: { id: true, isActive: true } },
    },
    orderBy: [{ isVerified: "desc" }, { levelScore: "desc" }, { helpfulCount: "desc" }],
    take: 40,
  });

  const scored = candidates
    .filter((row) => row.user?.isActive)
    .map((row) => {
      const specialties = parseJsonArray(row.specialties).map((item) => String(item).toLowerCase());
      const overlap = tags.filter((tag) => specialties.includes(tag)).length;
      const categoryHit = categoryToken && specialties.includes(categoryToken) ? 1 : 0;
      const helpful = Number(row.helpfulCount || 0);
      const activityBoost = row.lastActiveAt
        ? Math.max(0, 20 - Math.round((Date.now() - new Date(row.lastActiveAt).getTime()) / (1000 * 60 * 60 * 6)))
        : 0;
      const score = overlap * 40 + categoryHit * 22 + helpful * 0.2 + activityBoost + Number(row.levelScore || 0) * 0.05;

      return {
        advisorId: row.userId,
        score,
        reason: overlap || categoryHit ? "specialty_match" : "activity_helpful_rank",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!scored.length) return [];

  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  const created = await prisma.$transaction(
    scored.map((item) =>
      prisma.adviceAdvisorMatch.upsert({
        where: {
          adviceId_advisorId: {
            adviceId,
            advisorId: item.advisorId,
          },
        },
        create: {
          adviceId,
          advisorId: item.advisorId,
          score: item.score,
          reason: item.reason,
          isUrgent: Boolean(advice.isUrgent),
          expiresAt,
        },
        update: {
          score: item.score,
          reason: item.reason,
          isUrgent: Boolean(advice.isUrgent),
          expiresAt,
        },
      }),
    ),
  );

  return created;
}

function scheduleAdvisorMatching(advice) {
  if (!PHASE1_SMART_MATCHING) return;

  setTimeout(async () => {
    try {
      const matches = await matchAdvisorsToQuestion(advice.id);
      if (!matches.length) return;

      await Promise.all(
        matches.map((match) =>
          createNotification({
            userId: match.advisorId,
            type: advice.isUrgent ? NOTIFICATION_TYPES.URGENT_QUESTION : NOTIFICATION_TYPES.MATCHED_QUESTION,
            title: advice.isUrgent ? "Urgent question matched to you" : "New question matched to your expertise",
            body: `${advice.title} was matched to your profile.`,
            adviceId: advice.id,
          }),
        ),
      );

      if (FEATURE_REALTIME_NOTIFICATIONS) {
        matches.forEach((match) => {
          realtimeHub.emitUserEvent(match.advisorId, "advisor_match", {
            adviceId: advice.id,
            isUrgent: Boolean(advice.isUrgent),
          });
        });
      }
    } catch {
      // best effort only
    }
  }, 0);
}

async function notifyCrisisModerationQueue({ adviceId, actorName, source }) {
  const moderators = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [ROLES.MODERATOR, ROLES.ADMIN] },
    },
    select: { id: true },
  });

  await Promise.all(
    moderators.map((moderator) =>
      createNotification({
        userId: moderator.id,
        type: NOTIFICATION_TYPES.CRISIS_ALERT,
        title: "Urgent safety review required",
        body: `${actorName} submitted ${source} flagged for crisis review.`,
        adviceId,
      }),
    ),
  );
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

function inferIdentityModeFromBody(body) {
  const firstLine = String(body || "").split(/\r?\n/)[0] || "";
  const match = firstLine.match(/^\[Anonymous:\s*(Yes|No)\]/i);
  if (!match) return ADVICE_IDENTITY_MODE.ANONYMOUS;
  return String(match[1]).toLowerCase() === "no"
    ? ADVICE_IDENTITY_MODE.PUBLIC
    : ADVICE_IDENTITY_MODE.ANONYMOUS;
}

function stripLegacyAnonymousPrefix(body) {
  return String(body || "").replace(/^\[Anonymous:\s*(Yes|No)\]\s*\n\n?/i, "");
}

function resolveAdviceIdentityMode(advice) {
  const current = String(advice?.identityMode || "").toUpperCase();
  if (current === ADVICE_IDENTITY_MODE.PUBLIC || current === ADVICE_IDENTITY_MODE.ANONYMOUS) {
    return current;
  }
  return inferIdentityModeFromBody(advice?.body);
}

let guestAdviceUserCache = null;

async function getOrCreateGuestAdviceUser() {
  if (guestAdviceUserCache?.id) {
    return guestAdviceUserCache;
  }

  const passwordHash = await bcrypt.hash(`guest-${JWT_SECRET}`, 8);
  const user = await prisma.user.upsert({
    where: { email: GUEST_ADVICE_EMAIL },
    update: {
      name: GUEST_ADVICE_NAME,
      role: ROLES.MEMBER,
      isActive: true,
      hasPassword: false,
    },
    create: {
      email: GUEST_ADVICE_EMAIL,
      name: GUEST_ADVICE_NAME,
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      hasPassword: false,
      authProvider: "LOCAL",
    },
  });

  guestAdviceUserCache = user;
  return user;
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

async function sendSupportEmailNotification({ to, subject, text, from = SUPPORT_EMAIL_FROM, meta = {} }) {
  const target = normalizeOptionalText(to);
  if (!target) {
    return;
  }

  const sender = normalizeOptionalText(from) || "contact@tellnab.com";

  if (!SUPPORT_EMAIL_WEBHOOK_URL) {
    console.log("[support-email][skipped] missing SUPPORT_EMAIL_WEBHOOK_URL", {
      to: target,
      subject,
      meta,
    });
    return;
  }

  try {
    const response = await fetch(SUPPORT_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: target,
        from: sender,
        subject,
        text,
        meta,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[support-email][error] webhook rejected", {
        status: response.status,
        body,
      });
    }
  } catch (error) {
    console.error("[support-email][error] failed to send", error);
  }
}

function getSupportSlaHours(priority) {
  return SUPPORT_SLA_HOURS[priority] || SUPPORT_SLA_HOURS[SUPPORT_TICKET_PRIORITY.NORMAL];
}

function getSupportSlaLabel(priority) {
  const hours = getSupportSlaHours(priority);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

function serializeSupportTicket(ticket) {
  const priority = ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL;
  const firstResponseDueAt = ticket.firstResponseDueAt || null;
  const firstResponseAt = ticket.firstResponseAt || null;
  const supportAssignmentMeta = extractSupportAssigneeFromInternalNote(ticket.internalNote);
  const isAwaitingFirstResponse = !firstResponseAt;
  const isSlaBreached = Boolean(
    isAwaitingFirstResponse &&
      firstResponseDueAt &&
      new Date(firstResponseDueAt).getTime() < Date.now() &&
      ticket.status !== SUPPORT_TICKET_STATUS.RESOLVED &&
      ticket.status !== SUPPORT_TICKET_STATUS.CLOSED,
  );

  return {
    id: ticket.id,
    type: ticket.type,
    priority,
    slaTargetHours: getSupportSlaHours(priority),
    slaLabel: getSupportSlaLabel(priority),
    status: ticket.status,
    requesterName: ticket.requesterName,
    requesterEmail: ticket.requesterEmail,
    subject: ticket.subject,
    message: ticket.message,
    pageUrl: ticket.pageUrl,
    firstResponseDueAt,
    firstResponseAt,
    isSlaBreached,
    internalNote: supportAssignmentMeta.internalNote,
    resolutionSummary: ticket.resolutionSummary,
    assignedTo: ticket.assignedTo || supportAssignmentMeta.assignedTo || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    resolvedBy: ticket.resolvedBy || null,
  };
}

function serializeSupportTicketMessage(message) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    senderType: message.senderType,
    senderName: message.senderName,
    senderEmail: message.senderEmail,
    senderUserId: message.senderUserId,
    body: message.body,
    createdAt: message.createdAt,
  };
}

function buildSupportTranscriptLine(label, text) {
  const safeText = String(text || "").trim();
  const safeLabel = String(label || "Support").trim();
  return `[${new Date().toISOString()}] ${safeLabel}: ${safeText}`;
}

function normalizeSupportTagValue(value) {
  return String(value || "")
    .replace(/[|\]\n\r]/g, " ")
    .trim();
}

function extractSupportAssigneeFromInternalNote(internalNote) {
  const note = typeof internalNote === "string" ? internalNote : "";
  const match = note.match(/\[assigned_to:([^|\]]+)\|([^|\]]*)\|([^|\]]*)\]/i);

  const cleanInternalNote = note.replace(/\[assigned_to:[^\]]+\]/gi, "").trim();

  if (!match) {
    return {
      assignedTo: null,
      internalNote: cleanInternalNote || null,
    };
  }

  return {
    assignedTo: {
      id: normalizeSupportTagValue(match[1]),
      name: normalizeSupportTagValue(match[2]) || "Support",
      role: normalizeSupportTagValue(match[3]) || ROLES.SUPPORT_MEMBER,
    },
    internalNote: cleanInternalNote || null,
  };
}

function mergeSupportAssignmentIntoInternalNote(internalNote, assignee) {
  const { internalNote: clean } = extractSupportAssigneeFromInternalNote(internalNote);
  if (!assignee) {
    return clean || null;
  }

  const tag = `[assigned_to:${normalizeSupportTagValue(assignee.id)}|${normalizeSupportTagValue(
    assignee.name,
  )}|${normalizeSupportTagValue(assignee.role)}]`;

  return clean ? `${tag}\n${clean}` : tag;
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

  const [asks, replies, featuredThreads, approvedThreads, pendingThreads, badgeCount, awards, advisorProfile] = await Promise.all([
    prisma.advice.count({ where: { authorId: userId } }),
    prisma.adviceComment.count({ where: { authorId: userId } }),
    prisma.advice.count({ where: { authorId: userId, isFeatured: true } }),
    prisma.advice.count({ where: { authorId: userId, status: ADVICE_STATUS.APPROVED } }),
    prisma.advice.count({ where: { authorId: userId, status: ADVICE_STATUS.PENDING } }),
    prisma.userBadge.count({ where: { userId, isVisible: true } }),
    prisma.userBadge.findMany({
      where: { userId, isVisible: true },
      include: {
        badge: true,
        awardedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { awardedAt: "desc" },
      take: 20,
    }),
    FEATURE_ADVISOR_PROFILES ? prisma.advisorProfile.findUnique({ where: { userId } }) : null,
  ]);

  const roleLabel =
    user.role === ROLES.ADMIN
      ? "Admin"
      : user.role === ROLES.MODERATOR
        ? "Moderator"
        : advisorProfile?.isVerified
          ? "Verified Advisor"
          : "Member";

  const roleTone =
    user.role === ROLES.ADMIN
      ? "rose"
      : user.role === ROLES.MODERATOR
        ? "violet"
        : advisorProfile?.isVerified
          ? "emerald"
          : "slate";

  const expertiseCategories = Array.from(
    new Set(parseJsonArray(advisorProfile?.specialties || "[]").map((item) => String(item).trim()).filter(Boolean)),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel,
    roleTone,
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
    totalAnswers: replies,
    helpfulAnswersCount: Number(advisorProfile?.helpfulCount || 0),
    expertiseCategories,
    wallet: {
      paidCents: user.walletPaidCents,
      earnedCents: user.walletEarnedCents,
      lifetimeEarnedCents: user.walletLifetimeEarnedCents,
    },
    badgesCount: badgeCount,
    badges: awards.map(sanitizeUserBadge),
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
  role: z.enum([ROLES.MEMBER, ROLES.SUPPORT_MEMBER, ROLES.MODERATOR, ROLES.ADMIN]),
});

const statusUpdateSchema = z.object({
  isActive: z.boolean(),
});

const supportMemberUpdateSchema = z.object({
  isSupportMember: z.boolean(),
});

const createAdviceSchema = z.object({
  title: z.string().min(5).max(140),
  body: z.string().min(10).max(5000),
  categoryId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  identityMode: z.enum([ADVICE_IDENTITY_MODE.ANONYMOUS, ADVICE_IDENTITY_MODE.PUBLIC]).optional(),
  visibility: z.enum([ADVICE_VISIBILITY.PUBLIC, ADVICE_VISIBILITY.PRIVATE]).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  targetAudience: z.string().min(2).max(120).optional(),
  isUrgent: z.boolean().optional(),
});

const updateAdviceIdentitySchema = z.object({
  identityMode: z.enum([ADVICE_IDENTITY_MODE.PUBLIC]),
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

const commentSchema = z
  .object({
    body: z.string().max(1000).optional(),
    parentId: z.string().optional(),
    messageType: z.enum([ADVICE_COMMENT_TYPE.TEXT, ADVICE_COMMENT_TYPE.VOICE]).optional(),
    audioUrl: z.string().url().max(5000).optional(),
    audioDurationSec: z.number().int().min(1).max(3600).optional(),
    transcript: z.string().max(2000).optional(),
  })
  .refine(
    (value) => {
      const type = value.messageType || ADVICE_COMMENT_TYPE.TEXT;
      if (type === ADVICE_COMMENT_TYPE.VOICE) {
        return Boolean(value.audioUrl);
      }
      return Boolean(String(value.body || "").trim().length);
    },
    { message: "Text body is required for text comments and audioUrl is required for voice comments" },
  );

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

const createPriorityCheckoutSchema = z.object({
  provider: z.string().min(2).max(32).optional(),
});

const publicFeedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(12),
  categoryId: z.string().min(1).optional(),
  sort: z.enum(["TRENDING", "LATEST"]).default("TRENDING"),
  q: z.string().max(120).optional().default(""),
});

const helpfulReactionSchema = z.object({
  action: z.enum(["add", "remove", "toggle"]).default("toggle"),
});

const advisorListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(12),
  q: z.string().max(120).optional().default(""),
  specialty: z.string().max(80).optional(),
  verifiedOnly: z.coerce.boolean().optional().default(false),
});

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

const adminAdvisorUpdateSchema = z
  .object({
    isVerified: z.boolean().optional(),
    advisorCategory: z.string().min(2).max(80).optional(),
    displayName: z.string().min(2).max(80).optional(),
  })
  .refine(
    (value) =>
      value.isVerified !== undefined ||
      value.advisorCategory !== undefined ||
      value.displayName !== undefined,
    { message: "At least one advisor field is required" },
  );

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
  priority: z
    .enum([
      SUPPORT_TICKET_PRIORITY.URGENT,
      SUPPORT_TICKET_PRIORITY.NORMAL,
      SUPPORT_TICKET_PRIORITY.LOW,
    ])
    .optional(),
  requesterName: z.string().min(2).max(80),
  requesterEmail: z.string().email().max(150),
  subject: z.string().min(5).max(180),
  message: z.string().min(20).max(5000),
  pageUrl: z.string().max(1000).optional(),
});

const supportTicketLookupSchema = z.object({
  ticketId: z.string().min(8).max(80),
  requesterEmail: z.string().email().max(150),
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
    priority: z
      .enum([
        SUPPORT_TICKET_PRIORITY.URGENT,
        SUPPORT_TICKET_PRIORITY.NORMAL,
        SUPPORT_TICKET_PRIORITY.LOW,
      ])
      .optional(),
    internalNote: z.string().max(1000).nullable().optional(),
    resolutionSummary: z.string().max(1000).nullable().optional(),
    assignedToId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const supportTicketThreadLookupSchema = z.object({
  requesterEmail: z.string().email().max(150),
});

const supportTicketMemberReplySchema = z.object({
  requesterEmail: z.string().email().max(150),
  message: z.string().min(1).max(5000),
});

const supportTicketMemberCloseSchema = z.object({
  requesterEmail: z.string().email().max(150),
});

const supportTicketAgentReplySchema = z.object({
  message: z.string().min(1).max(5000),
  status: z
    .enum([
      SUPPORT_TICKET_STATUS.OPEN,
      SUPPORT_TICKET_STATUS.IN_PROGRESS,
      SUPPORT_TICKET_STATUS.RESOLVED,
      SUPPORT_TICKET_STATUS.CLOSED,
    ])
    .optional(),
  resolutionSummary: z.string().max(1000).nullable().optional(),
  notifyByEmail: z.boolean().optional().default(true),
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

if (ENABLE_LEGACY_SUPPORT) {
app.post("/api/support/tickets", supportCreateLimiter, async (req, res) => {
  try {
    const data = supportTicketCreateSchema.parse(req.body || {});
    const safePageUrl = normalizeOptionalText(data.pageUrl);
    const priority = data.priority || SUPPORT_TICKET_PRIORITY.NORMAL;
    const slaHours = getSupportSlaHours(priority);
    const firstResponseDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    if (safePageUrl && !safePageUrl.startsWith("http://") && !safePageUrl.startsWith("https://")) {
      return res.status(400).json({ message: "Invalid page URL" });
    }

    let createdTicketId = null;

    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const created = await tx.supportTicket.create({
          data: {
            type: data.type,
            priority,
            status: SUPPORT_TICKET_STATUS.OPEN,
            requesterName: data.requesterName.trim(),
            requesterEmail: data.requesterEmail.toLowerCase(),
            subject: data.subject.trim(),
            message: data.message.trim(),
            pageUrl: safePageUrl,
            firstResponseDueAt,
            ipAddress: req.ip || null,
            userAgent: normalizeOptionalText(req.headers["user-agent"]),
          },
        });

        createdTicketId = created.id;

        await tx.supportTicketMessage.create({
          data: {
            ticketId: created.id,
            senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
            senderName: created.requesterName,
            senderEmail: created.requesterEmail,
            body: created.message,
          },
        });

        return tx.supportTicket.findUnique({
          where: { id: created.id },
          include: {
            resolvedBy: {
              select: { id: true, name: true, role: true },
            },
            assignedTo: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        });
      });

      if (ticket) {
        return res.status(201).json({
          message: "Support request received. We will get back to you soon.",
          ticket: serializeSupportTicket(ticket),
        });
      }
    } catch (primaryError) {
      console.error("[support] primary ticket create failed", primaryError);
    }

    // Fallback path for environments where newer support columns/relations are not yet migrated.
    const fallbackTicket = await prisma.supportTicket.create({
      data: {
        type: data.type,
        requesterName: data.requesterName.trim(),
        requesterEmail: data.requesterEmail.toLowerCase(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        pageUrl: safePageUrl,
      },
      select: {
        id: true,
      },
    });

    createdTicketId = fallbackTicket.id;

    try {
      await prisma.supportTicketMessage.create({
        data: {
          ticketId: fallbackTicket.id,
          senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
          senderName: data.requesterName.trim(),
          senderEmail: data.requesterEmail.toLowerCase(),
          body: data.message.trim(),
        },
      });
    } catch (messageError) {
      console.error("[support] fallback message create failed", messageError);
    }

    return res.status(201).json({
      message: "Support request received. We will get back to you soon.",
      ticket: {
        id: createdTicketId,
        status: SUPPORT_TICKET_STATUS.OPEN,
        priority,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }

    console.error("[support] submit failed", error);
    return res.status(500).json({
      message: "Failed to submit support request",
      code:
        error && typeof error === "object" && typeof error.code === "string"
          ? error.code
          : undefined,
    });
  }
});

app.post("/api/support/tickets/status", async (req, res) => {
  try {
    const data = supportTicketLookupSchema.parse(req.body || {});
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: data.ticketId,
        requesterEmail: data.requesterEmail.toLowerCase(),
      },
      include: {
        resolvedBy: {
          select: { id: true, name: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const responseTicket = serializeSupportTicket(ticket);
    return res.json({
      ticket: {
        id: responseTicket.id,
        type: responseTicket.type,
        priority: responseTicket.priority,
        slaTargetHours: responseTicket.slaTargetHours,
        slaLabel: responseTicket.slaLabel,
        status: responseTicket.status,
        subject: responseTicket.subject,
        message: responseTicket.message,
        pageUrl: responseTicket.pageUrl,
        firstResponseDueAt: responseTicket.firstResponseDueAt,
        firstResponseAt: responseTicket.firstResponseAt,
        isSlaBreached: responseTicket.isSlaBreached,
        resolutionSummary: responseTicket.resolutionSummary,
        assignedTo: responseTicket.assignedTo,
        createdAt: responseTicket.createdAt,
        updatedAt: responseTicket.updatedAt,
        resolvedAt: responseTicket.resolvedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to lookup support ticket" });
  }
});

app.get("/api/admin/support/tickets", authRequired, moderatorOrAdminRequired, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
    const type = typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : "";
    const priority =
      typeof req.query.priority === "string" ? req.query.priority.trim().toUpperCase() : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100;

    if (status && !Object.values(SUPPORT_TICKET_STATUS).includes(status)) {
      return res.status(400).json({ message: "Invalid support ticket status filter" });
    }

    if (type && !Object.values(SUPPORT_TICKET_TYPE).includes(type)) {
      return res.status(400).json({ message: "Invalid support ticket type filter" });
    }

    if (priority && !Object.values(SUPPORT_TICKET_PRIORITY).includes(priority)) {
      return res.status(400).json({ message: "Invalid support ticket priority filter" });
    }

    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
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

    try {
      const tickets = await prisma.supportTicket.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      });

      return res.json({
        tickets: tickets.map((ticket) => serializeSupportTicket(ticket)),
      });
    } catch (primaryError) {
      console.error("[support] admin ticket list primary query failed, using fallback", primaryError);
    }

    const fallbackTickets = await prisma.supportTicket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        type: true,
        priority: true,
        status: true,
        requesterName: true,
        requesterEmail: true,
        subject: true,
        message: true,
        pageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      tickets: fallbackTickets.map((ticket) => ({
        id: ticket.id,
        type: ticket.type,
        priority: ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL,
        slaTargetHours: getSupportSlaHours(ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        slaLabel: getSupportSlaLabel(ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        status: ticket.status || SUPPORT_TICKET_STATUS.OPEN,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        subject: ticket.subject,
        message: ticket.message,
        pageUrl: ticket.pageUrl,
        firstResponseDueAt: null,
        firstResponseAt: null,
        isSlaBreached: false,
        internalNote: null,
        resolutionSummary: null,
        assignedTo: null,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: null,
        resolvedBy: null,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch support tickets" });
  }
});

app.patch("/api/admin/support/tickets/:id", authRequired, supportStaffRequired, async (req, res) => {
  try {
    const data = supportTicketAdminUpdateSchema.parse(req.body || {});
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ message: "Support ticket not found" });
    }

    const nextStatus = data.status || existing.status;
    const nextPriority = data.priority || existing.priority || SUPPORT_TICKET_PRIORITY.NORMAL;
    const shouldMarkResolved =
      nextStatus === SUPPORT_TICKET_STATUS.RESOLVED || nextStatus === SUPPORT_TICKET_STATUS.CLOSED;
    const shouldMarkFirstResponse =
      !existing.firstResponseAt &&
      (nextStatus === SUPPORT_TICKET_STATUS.IN_PROGRESS || shouldMarkResolved);

    try {
      const updated = await prisma.supportTicket.update({
        where: { id: existing.id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.priority && !existing.firstResponseAt
            ? {
                firstResponseDueAt: new Date(
                  new Date(existing.createdAt).getTime() + getSupportSlaHours(nextPriority) * 60 * 60 * 1000,
                ),
              }
            : {}),
          ...(shouldMarkFirstResponse ? { firstResponseAt: new Date() } : {}),
          ...(data.internalNote !== undefined ? { internalNote: normalizeOptionalText(data.internalNote) } : {}),
          ...(data.resolutionSummary !== undefined
            ? { resolutionSummary: normalizeOptionalText(data.resolutionSummary) }
            : {}),
          ...(data.assignedToId !== undefined
            ? { assignedToId: normalizeOptionalText(data.assignedToId) }
            : {}),
          ...(shouldMarkResolved
            ? { resolvedAt: existing.resolvedAt || new Date(), resolvedById: req.user.id }
            : { resolvedAt: null, resolvedById: null }),
        },
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      });

      return res.json({
        ticket: serializeSupportTicket(updated),
      });
    } catch (primaryError) {
      console.error("[support] admin ticket update primary flow failed, using fallback", primaryError);
    }

    const fallbackUpdated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.internalNote !== undefined ? { internalNote: normalizeOptionalText(data.internalNote) } : {}),
        ...(data.resolutionSummary !== undefined
          ? { resolutionSummary: normalizeOptionalText(data.resolutionSummary) }
          : {}),
      },
      select: {
        id: true,
        type: true,
        priority: true,
        status: true,
        requesterName: true,
        requesterEmail: true,
        subject: true,
        message: true,
        pageUrl: true,
        internalNote: true,
        resolutionSummary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      ticket: {
        id: fallbackUpdated.id,
        type: fallbackUpdated.type,
        priority: fallbackUpdated.priority || SUPPORT_TICKET_PRIORITY.NORMAL,
        slaTargetHours: getSupportSlaHours(fallbackUpdated.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        slaLabel: getSupportSlaLabel(fallbackUpdated.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        status: fallbackUpdated.status || SUPPORT_TICKET_STATUS.OPEN,
        requesterName: fallbackUpdated.requesterName,
        requesterEmail: fallbackUpdated.requesterEmail,
        subject: fallbackUpdated.subject,
        message: fallbackUpdated.message,
        pageUrl: fallbackUpdated.pageUrl,
        firstResponseDueAt: null,
        firstResponseAt: null,
        isSlaBreached: false,
        internalNote: fallbackUpdated.internalNote || null,
        resolutionSummary: fallbackUpdated.resolutionSummary || null,
        assignedTo: null,
        createdAt: fallbackUpdated.createdAt,
        updatedAt: fallbackUpdated.updatedAt,
        resolvedAt: null,
        resolvedBy: null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update support ticket" });
  }
});

app.get("/api/support/agent/me", authRequired, supportStaffRequired, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

app.get("/api/support/agent/tickets", authRequired, supportStaffRequired, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
    const type = typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : "";
    const priority =
      typeof req.query.priority === "string" ? req.query.priority.trim().toUpperCase() : "";
    const assigned = typeof req.query.assigned === "string" ? req.query.assigned.trim().toLowerCase() : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100;

    if (status && !Object.values(SUPPORT_TICKET_STATUS).includes(status)) {
      return res.status(400).json({ message: "Invalid support ticket status filter" });
    }

    if (type && !Object.values(SUPPORT_TICKET_TYPE).includes(type)) {
      return res.status(400).json({ message: "Invalid support ticket type filter" });
    }

    if (priority && !Object.values(SUPPORT_TICKET_PRIORITY).includes(priority)) {
      return res.status(400).json({ message: "Invalid support ticket priority filter" });
    }

    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(assigned === "mine"
        ? { assignedToId: req.user.id }
        : assigned === "unassigned"
          ? { assignedToId: null }
          : {}),
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

    try {
      const tickets = await prisma.supportTicket.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      return res.json({
        tickets: tickets.map((ticket) => {
          const serialized = serializeSupportTicket(ticket);
          return {
            ...serialized,
            latestMessage: ticket.messages[0] ? serializeSupportTicketMessage(ticket.messages[0]) : null,
          };
        }),
      });
    } catch (primaryError) {
      console.error("[support] agent ticket list primary query failed, using fallback", primaryError);
    }

    const { assignedToId, ...whereWithoutAssignment } = where;

    let fallbackTickets = [];
    try {
      fallbackTickets = await prisma.supportTicket.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          priority: true,
          status: true,
          requesterName: true,
          requesterEmail: true,
          subject: true,
          message: true,
          pageUrl: true,
          internalNote: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (fallbackQueryError) {
      console.error("[support] agent ticket list fallback query failed, using assignment-less query", fallbackQueryError);
      fallbackTickets = await prisma.supportTicket.findMany({
        where: whereWithoutAssignment,
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          priority: true,
          status: true,
          requesterName: true,
          requesterEmail: true,
          subject: true,
          message: true,
          pageUrl: true,
          internalNote: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const normalizedFallbackTickets = fallbackTickets
      .map((ticket) => {
        const assignmentMeta = extractSupportAssigneeFromInternalNote(ticket.internalNote);
        return {
          ...ticket,
          assignedTo: assignmentMeta.assignedTo,
          internalNote: assignmentMeta.internalNote,
        };
      })
      .filter((ticket) => {
        if (assigned === "mine") {
          return ticket.assignedTo && ticket.assignedTo.id === req.user.id;
        }
        if (assigned === "unassigned") {
          return !ticket.assignedTo;
        }
        return true;
      });

    return res.json({
      tickets: normalizedFallbackTickets.map((ticket) => ({
        id: ticket.id,
        type: ticket.type,
        priority: ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL,
        slaTargetHours: getSupportSlaHours(ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        slaLabel: getSupportSlaLabel(ticket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        status: ticket.status || SUPPORT_TICKET_STATUS.OPEN,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        subject: ticket.subject,
        message: ticket.message,
        pageUrl: ticket.pageUrl,
        firstResponseDueAt: null,
        firstResponseAt: null,
        isSlaBreached: false,
        internalNote: ticket.internalNote || null,
        resolutionSummary: null,
        assignedTo: ticket.assignedTo || null,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: null,
        resolvedBy: null,
        latestMessage: null,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch support tickets" });
  }
});

app.get("/api/support/agent/tickets/:id", authRequired, supportStaffRequired, async (req, res) => {
  try {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }

      return res.json({
        ticket: serializeSupportTicket(ticket),
        messages: ticket.messages.map((message) => serializeSupportTicketMessage(message)),
      });
    } catch (primaryError) {
      console.error("[support] agent ticket detail primary query failed, using fallback", primaryError);
    }

    const fallbackTicket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        type: true,
        priority: true,
        status: true,
        requesterName: true,
        requesterEmail: true,
        subject: true,
        message: true,
        pageUrl: true,
        internalNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fallbackTicket) {
      return res.status(404).json({ message: "Support ticket not found" });
    }

    const assignmentMeta = extractSupportAssigneeFromInternalNote(fallbackTicket.internalNote);

    let messages = [];
    try {
      if (prisma.supportTicketMessage && typeof prisma.supportTicketMessage.findMany === "function") {
        const rows = await prisma.supportTicketMessage.findMany({
          where: { ticketId: fallbackTicket.id },
          orderBy: { createdAt: "asc" },
        });
        messages = rows.map((message) => serializeSupportTicketMessage(message));
      }
    } catch (messageError) {
      console.error("[support] agent ticket detail message fallback failed", messageError);
    }

    if (messages.length === 0 && fallbackTicket.message) {
      messages.push({
        id: `initial-${fallbackTicket.id}`,
        ticketId: fallbackTicket.id,
        senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
        senderName: fallbackTicket.requesterName,
        senderEmail: fallbackTicket.requesterEmail,
        senderUserId: null,
        body: fallbackTicket.message,
        createdAt: fallbackTicket.createdAt,
      });
    }

    return res.json({
      ticket: {
        id: fallbackTicket.id,
        type: fallbackTicket.type,
        priority: fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL,
        slaTargetHours: getSupportSlaHours(fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        slaLabel: getSupportSlaLabel(fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        status: fallbackTicket.status || SUPPORT_TICKET_STATUS.OPEN,
        requesterName: fallbackTicket.requesterName,
        requesterEmail: fallbackTicket.requesterEmail,
        subject: fallbackTicket.subject,
        message: fallbackTicket.message,
        pageUrl: fallbackTicket.pageUrl,
        firstResponseDueAt: null,
        firstResponseAt: null,
        isSlaBreached: false,
        internalNote: assignmentMeta.internalNote,
        resolutionSummary: null,
        assignedTo: assignmentMeta.assignedTo,
        createdAt: fallbackTicket.createdAt,
        updatedAt: fallbackTicket.updatedAt,
        resolvedAt: null,
        resolvedBy: null,
      },
      messages,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch support ticket" });
  }
});

app.patch("/api/support/agent/tickets/:id", authRequired, supportStaffRequired, async (req, res) => {
  try {
    const data = supportTicketAdminUpdateSchema.parse(req.body || {});
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ message: "Support ticket not found" });
    }

    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (
        !assignee ||
        (assignee.role !== ROLES.ADMIN &&
          assignee.role !== ROLES.MODERATOR &&
          assignee.role !== ROLES.SUPPORT_MEMBER)
      ) {
        return res.status(400).json({ message: "Assigned support user must be support staff" });
      }
    }

    const nextStatus = data.status || existing.status;
    const nextPriority = data.priority || existing.priority || SUPPORT_TICKET_PRIORITY.NORMAL;
    const shouldMarkResolved =
      nextStatus === SUPPORT_TICKET_STATUS.RESOLVED || nextStatus === SUPPORT_TICKET_STATUS.CLOSED;
    const shouldMarkFirstResponse =
      !existing.firstResponseAt &&
      (nextStatus === SUPPORT_TICKET_STATUS.IN_PROGRESS || shouldMarkResolved);

    let updated = null;
    let assigneeForFallback = null;

    try {
      updated = await prisma.supportTicket.update({
        where: { id: existing.id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.priority && !existing.firstResponseAt
            ? {
                firstResponseDueAt: new Date(
                  new Date(existing.createdAt).getTime() + getSupportSlaHours(nextPriority) * 60 * 60 * 1000,
                ),
              }
            : {}),
          ...(shouldMarkFirstResponse ? { firstResponseAt: new Date() } : {}),
          ...(data.internalNote !== undefined ? { internalNote: normalizeOptionalText(data.internalNote) } : {}),
          ...(data.resolutionSummary !== undefined
            ? { resolutionSummary: normalizeOptionalText(data.resolutionSummary) }
            : {}),
          ...(data.assignedToId !== undefined
            ? { assignedToId: normalizeOptionalText(data.assignedToId) }
            : {}),
          ...(shouldMarkResolved
            ? { resolvedAt: existing.resolvedAt || new Date(), resolvedById: req.user.id }
            : { resolvedAt: null, resolvedById: null }),
        },
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      });
    } catch (primaryError) {
      console.error("[support] agent ticket update primary flow failed, using fallback", primaryError);
    }

    if (!updated) {
      const normalizedAssignedToId =
        data.assignedToId !== undefined ? normalizeOptionalText(data.assignedToId) : undefined;

      if (normalizedAssignedToId) {
        const assignee = await prisma.user.findUnique({ where: { id: normalizedAssignedToId } });
        if (!assignee) {
          return res.status(400).json({ message: "Assigned support user was not found" });
        }
        assigneeForFallback = {
          id: assignee.id,
          name: assignee.name,
          role: assignee.role,
        };
      }

      const fallbackData = {
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.internalNote !== undefined ? { internalNote: normalizeOptionalText(data.internalNote) } : {}),
        ...(data.resolutionSummary !== undefined
          ? { resolutionSummary: normalizeOptionalText(data.resolutionSummary) }
          : {}),
        ...(normalizedAssignedToId !== undefined ? { assignedToId: normalizedAssignedToId } : {}),
        ...(shouldMarkResolved ? { resolvedAt: existing.resolvedAt || new Date() } : { resolvedAt: null }),
      };

      try {
        updated = await prisma.supportTicket.update({
          where: { id: existing.id },
          data: fallbackData,
          select: {
            id: true,
            type: true,
            priority: true,
            status: true,
            requesterName: true,
            requesterEmail: true,
            subject: true,
            message: true,
            pageUrl: true,
            internalNote: true,
            resolutionSummary: true,
            createdAt: true,
            updatedAt: true,
            resolvedAt: true,
          },
        });
      } catch (fallbackError) {
        console.error("[support] agent ticket update fallback relation path failed", fallbackError);

        if (normalizedAssignedToId !== undefined) {
          try {
            const noteBase =
              data.internalNote !== undefined ? normalizeOptionalText(data.internalNote) : existing.internalNote;
            updated = await prisma.supportTicket.update({
              where: { id: existing.id },
              data: {
                ...fallbackData,
                internalNote: mergeSupportAssignmentIntoInternalNote(noteBase, assigneeForFallback),
              },
              select: {
                id: true,
                type: true,
                priority: true,
                status: true,
                requesterName: true,
                requesterEmail: true,
                subject: true,
                message: true,
                pageUrl: true,
                internalNote: true,
                resolutionSummary: true,
                createdAt: true,
                updatedAt: true,
                resolvedAt: true,
              },
            });
          } catch (legacyAssignmentError) {
            console.error("[support] agent ticket update legacy assignment fallback failed", legacyAssignmentError);
          }
        }
      }
    }

    if (!updated) {
      return res.status(500).json({ message: "Failed to update support ticket" });
    }

    return res.json({ ticket: serializeSupportTicket(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update support ticket" });
  }
});

app.post(
  "/api/support/agent/tickets/:id/replies",
  authRequired,
  supportStaffRequired,
  supportReplyLimiter,
  async (req, res) => {
  try {
    const data = supportTicketAgentReplySchema.parse(req.body || {});
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ message: "Support ticket not found" });
    }

    const nextStatus = data.status || SUPPORT_TICKET_STATUS.IN_PROGRESS;
    const shouldMarkResolved =
      nextStatus === SUPPORT_TICKET_STATUS.RESOLVED || nextStatus === SUPPORT_TICKET_STATUS.CLOSED;
    let updated = null;

    try {
      updated = await prisma.$transaction(async (tx) => {
        await tx.supportTicketMessage.create({
          data: {
            ticketId: existing.id,
            senderType: SUPPORT_MESSAGE_SENDER.AGENT,
            senderName: req.user.name,
            senderEmail: req.user.email,
            senderUserId: req.user.id,
            body: data.message.trim(),
          },
        });

        return tx.supportTicket.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            firstResponseAt: existing.firstResponseAt || new Date(),
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
            assignedTo: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        });
      });
    } catch (primaryError) {
      console.error("[support] agent reply primary flow failed", primaryError);
    }

    if (!updated) {
      // Fallback path for partially migrated environments.
      const canUseMessageModel = Boolean(
        prisma.supportTicketMessage && typeof prisma.supportTicketMessage.create === "function",
      );

      try {
        if (canUseMessageModel) {
          await prisma.supportTicketMessage.create({
            data: {
              ticketId: existing.id,
              senderType: SUPPORT_MESSAGE_SENDER.AGENT,
              senderName: req.user.name,
              senderEmail: req.user.email,
              body: data.message.trim(),
            },
          });
        }
      } catch (messageError) {
        console.error("[support] agent reply message fallback failed", messageError);
      }

      const fallbackUpdateData = {
        status: nextStatus,
      };

      try {
        updated = await prisma.supportTicket.update({
          where: { id: existing.id },
          data: fallbackUpdateData,
        });
      } catch (updateError) {
        console.error("[support] agent reply ticket fallback update failed", updateError);

        // Legacy fallback: persist conversation directly into ticket message body.
        try {
          const transcriptLine = buildSupportTranscriptLine(
            `Support (${req.user.name || "Agent"})`,
            data.message,
          );
          updated = await prisma.supportTicket.update({
            where: { id: existing.id },
            data: {
              message: `${String(existing.message || "").trim()}\n\n${transcriptLine}`.trim(),
            },
          });
        } catch (legacyUpdateError) {
          console.error("[support] agent reply legacy transcript fallback failed", legacyUpdateError);
          return res.status(500).json({ message: "Failed to send support reply" });
        }
      }

      if (!canUseMessageModel) {
        try {
          const transcriptLine = buildSupportTranscriptLine(
            `Support (${req.user.name || "Agent"})`,
            data.message,
          );
          updated = await prisma.supportTicket.update({
            where: { id: existing.id },
            data: {
              message: `${String(existing.message || "").trim()}\n\n${transcriptLine}`.trim(),
            },
          });
        } catch (legacyAppendError) {
          console.error("[support] agent reply transcript append skipped", legacyAppendError);
        }
      }
    }

    const responseLink = `${SUPPORT_PORTAL_URL.replace(/\/$/, "")}/?view=member&ticketId=${encodeURIComponent(
      existing.id,
    )}&email=${encodeURIComponent(existing.requesterEmail)}`;

    if (data.notifyByEmail !== false) {
      await sendSupportEmailNotification({
        to: existing.requesterEmail,
        subject: `TellNab support member replied to ticket ${existing.id}`,
        text: [
          `Hello ${existing.requesterName},`,
          "",
          `${req.user.name || "A support member"} has replied to your ticket.`,
          `Ticket ID: ${existing.id}`,
          `Subject: ${existing.subject}`,
          "",
          `Open chat and reply or close the ticket: ${responseLink}`,
        ].join("\n"),
        meta: {
          ticketId: existing.id,
          type: "agent_reply",
        },
      });
    }

    return res.json({
      ticket: serializeSupportTicket(updated),
      notified: data.notifyByEmail !== false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("[support] agent reply failed", error);
    return res.status(500).json({ message: "Failed to send support reply" });
  }
  },
);

app.get("/api/support/tickets/:id/thread", async (req, res) => {
  try {
    const query = supportTicketThreadLookupSchema.parse(req.query || {});
    const requesterEmail = query.requesterEmail.toLowerCase();

    try {
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id: req.params.id,
          requesterEmail,
        },
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      return res.json({
        ticket: serializeSupportTicket(ticket),
        messages: ticket.messages.map((message) => serializeSupportTicketMessage(message)),
      });
    } catch (primaryError) {
      console.error("[support] thread primary query failed, using fallback", primaryError);
    }

    const fallbackTicket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        requesterEmail,
      },
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        requesterName: true,
        requesterEmail: true,
        subject: true,
        message: true,
        pageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fallbackTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    let fallbackMessages = [];
    try {
      if (prisma.supportTicketMessage && typeof prisma.supportTicketMessage.findMany === "function") {
        const rows = await prisma.supportTicketMessage.findMany({
          where: { ticketId: fallbackTicket.id },
          orderBy: { createdAt: "asc" },
        });
        fallbackMessages = rows.map((message) => serializeSupportTicketMessage(message));
      }
    } catch (messageError) {
      console.error("[support] thread message fallback failed", messageError);
    }

    if (fallbackMessages.length === 0 && fallbackTicket.message) {
      fallbackMessages.push({
        id: `initial-${fallbackTicket.id}`,
        ticketId: fallbackTicket.id,
        senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
        senderName: fallbackTicket.requesterName,
        senderEmail: fallbackTicket.requesterEmail,
        senderUserId: null,
        body: fallbackTicket.message,
        createdAt: fallbackTicket.createdAt,
      });
    }

    return res.json({
      ticket: {
        id: fallbackTicket.id,
        type: fallbackTicket.type,
        priority: fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL,
        slaTargetHours: getSupportSlaHours(fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        slaLabel: getSupportSlaLabel(fallbackTicket.priority || SUPPORT_TICKET_PRIORITY.NORMAL),
        status: fallbackTicket.status || SUPPORT_TICKET_STATUS.OPEN,
        requesterName: fallbackTicket.requesterName,
        requesterEmail: fallbackTicket.requesterEmail,
        subject: fallbackTicket.subject,
        message: fallbackTicket.message,
        pageUrl: fallbackTicket.pageUrl,
        firstResponseDueAt: null,
        firstResponseAt: null,
        isSlaBreached: false,
        internalNote: null,
        resolutionSummary: null,
        assignedTo: null,
        createdAt: fallbackTicket.createdAt,
        updatedAt: fallbackTicket.updatedAt,
        resolvedAt: null,
        resolvedBy: null,
      },
      messages: fallbackMessages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to load support thread" });
  }
});

app.post("/api/support/tickets/:id/replies", supportReplyLimiter, async (req, res) => {
  try {
    const data = supportTicketMemberReplySchema.parse(req.body || {});
    const requesterEmail = data.requesterEmail.toLowerCase();

    const existing = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        requesterEmail,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (existing.status === SUPPORT_TICKET_STATUS.CLOSED) {
      return res.status(400).json({ message: "Closed tickets cannot receive new replies" });
    }

    let updated = null;

    try {
      updated = await prisma.$transaction(async (tx) => {
        await tx.supportTicketMessage.create({
          data: {
            ticketId: existing.id,
            senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
            senderName: existing.requesterName,
            senderEmail: requesterEmail,
            body: data.message.trim(),
          },
        });

        return tx.supportTicket.update({
          where: { id: existing.id },
          data: {
            status:
              existing.status === SUPPORT_TICKET_STATUS.RESOLVED
                ? SUPPORT_TICKET_STATUS.IN_PROGRESS
                : existing.status,
            resolvedAt: null,
            resolvedById: null,
          },
          include: {
            resolvedBy: {
              select: { id: true, name: true, role: true },
            },
            assignedTo: {
              select: { id: true, name: true, role: true, email: true },
            },
          },
        });
      });
    } catch (primaryError) {
      console.error("[support] member reply primary flow failed", primaryError);
    }

    if (!updated) {
      const canUseMessageModel = Boolean(
        prisma.supportTicketMessage && typeof prisma.supportTicketMessage.create === "function",
      );

      try {
        if (canUseMessageModel) {
          await prisma.supportTicketMessage.create({
            data: {
              ticketId: existing.id,
              senderType: SUPPORT_MESSAGE_SENDER.MEMBER,
              senderName: existing.requesterName,
              senderEmail: requesterEmail,
              body: data.message.trim(),
            },
          });
        }
      } catch (messageError) {
        console.error("[support] member reply message fallback failed", messageError);
      }

      const nextStatus =
        existing.status === SUPPORT_TICKET_STATUS.RESOLVED
          ? SUPPORT_TICKET_STATUS.IN_PROGRESS
          : existing.status;

      try {
        updated = await prisma.supportTicket.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
          },
        });
      } catch (updateError) {
        console.error("[support] member reply ticket fallback update failed", updateError);
      }

      if (!canUseMessageModel || !updated) {
        try {
          const transcriptLine = buildSupportTranscriptLine("Member", data.message);
          updated = await prisma.supportTicket.update({
            where: { id: existing.id },
            data: {
              status: nextStatus,
              message: `${String(existing.message || "").trim()}\n\n${transcriptLine}`.trim(),
            },
          });
        } catch (legacyError) {
          console.error("[support] member reply legacy transcript fallback failed", legacyError);
          return res.status(500).json({ message: "Failed to send ticket reply" });
        }
      }
    }

    return res.status(201).json({
      ticket: serializeSupportTicket(updated),
      message: "Reply sent to support team",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("[support] member reply failed", error);
    return res.status(500).json({ message: "Failed to send ticket reply" });
  }
});

app.post("/api/support/tickets/:id/close", async (req, res) => {
  try {
    const data = supportTicketMemberCloseSchema.parse(req.body || {});
    const requesterEmail = data.requesterEmail.toLowerCase();

    const existing = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        requesterEmail,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    let updated = null;
    try {
      updated = await prisma.supportTicket.update({
        where: { id: existing.id },
        data: {
          status: SUPPORT_TICKET_STATUS.CLOSED,
          resolvedAt: existing.resolvedAt || new Date(),
        },
        include: {
          resolvedBy: {
            select: { id: true, name: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      });
    } catch (primaryError) {
      console.error("[support] member close primary flow failed, using fallback", primaryError);
    }

    if (!updated) {
      updated = await prisma.supportTicket.update({
        where: { id: existing.id },
        data: {
          status: SUPPORT_TICKET_STATUS.CLOSED,
          resolvedAt: existing.resolvedAt || new Date(),
        },
        select: {
          id: true,
          type: true,
          priority: true,
          status: true,
          requesterName: true,
          requesterEmail: true,
          subject: true,
          message: true,
          pageUrl: true,
          internalNote: true,
          resolutionSummary: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
        },
      });
    }

    try {
      if (prisma.supportTicketMessage && typeof prisma.supportTicketMessage.create === "function") {
        await prisma.supportTicketMessage.create({
          data: {
            ticketId: existing.id,
            senderType: SUPPORT_MESSAGE_SENDER.SYSTEM,
            body: "Ticket closed by member.",
          },
        });
      }
    } catch (messageError) {
      console.error("[support] member close message logging failed", messageError);
    }

    return res.json({ ticket: serializeSupportTicket(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to close ticket" });
  }
});
}

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
    res.cookie("tn_auth", token, buildAuthCookieOptions());

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
    res.cookie("tn_auth", token, buildAuthCookieOptions());

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
    res.cookie("tn_auth", token, buildAuthCookieOptions());

    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Google social login failed" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("tn_auth", buildAuthClearCookieOptions());
  return res.json({ success: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.post("/api/uploads", authRequired, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    return res.status(201).json({
      data: {
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype || "application/octet-stream",
        fileSize: Number(req.file.size || 0),
      },
    });
  } catch {
    return res.status(500).json({ message: "File upload failed" });
  }
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

    const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

    const [
      approvedThreads,
      featuredThreads,
      boostedThreads,
      totalComments,
      activeMembers,
      pendingReview,
      totalQuestions,
      activeAdvisorRows,
      highlights,
      latestQuestions,
      recentComments,
      topicSource,
    ] =
      await Promise.all([
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED, isFeatured: true } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED, isBoostActive: true } }),
        prisma.adviceComment.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.PENDING } }),
        prisma.advice.count(),
        prisma.adviceComment.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { authorId: true },
          distinct: ["authorId"],
        }),
        prisma.advice.findMany({
          where: { status: ADVICE_STATUS.APPROVED },
          orderBy: [{ isBoostActive: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
          take: 3,
          include: { author: true, category: true, group: true },
        }),
        prisma.advice.findMany({
          where: { status: ADVICE_STATUS.APPROVED },
          orderBy: [{ createdAt: "desc" }],
          take: 6,
          include: { author: true, category: true, group: true },
        }),
        prisma.adviceComment.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            advice: {
              include: { author: true, category: true, group: true },
            },
          },
        }),
        prisma.advice.findMany({
          where: { status: ADVICE_STATUS.APPROVED, categoryId: { not: null } },
          orderBy: [{ createdAt: "desc" }],
          take: 150,
          include: { category: true },
        }),
      ]);

    const trendingCounts = new Map();
    for (const item of topicSource) {
      if (!item.category) continue;
      const key = item.category.id;
      const existing = trendingCounts.get(key) || {
        id: item.category.id,
        slug: item.category.slug,
        name: item.category.name,
        count: 0,
      };
      existing.count += 1;
      trendingCounts.set(key, existing);
    }

    const trendingTopics = Array.from(trendingCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const recentMap = new Map();
    for (const comment of recentComments) {
      const advice = comment.advice;
      if (!advice || advice.status !== ADVICE_STATUS.APPROVED || recentMap.has(advice.id)) continue;
      recentMap.set(advice.id, sanitizeAdvice(advice));
      if (recentMap.size >= 6) break;
    }

    const recentlyAnswered = Array.from(recentMap.values());

    return res.json({
      metrics: {
        approvedThreads,
        featuredThreads,
        boostedThreads,
        totalComments,
        activeMembers,
        pendingReview,
        questionsAsked: totalQuestions,
        answersGiven: totalComments,
        activeAdvisors: activeAdvisorRows.length,
      },
      highlights: highlights.map(sanitizeAdvice),
      latestQuestions: latestQuestions.map(sanitizeAdvice),
      trendingTopics,
      recentlyAnswered,
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

    await evaluateAutoBadges(id);

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Role update failed" });
  }
});

app.patch(
  "/api/moderation/users/:id/support-role",
  authRequired,
  moderatorOrAdminRequired,
  async (req, res) => {
    try {
      const { isSupportMember } = supportMemberUpdateSchema.parse(req.body || {});
      const { id } = req.params;

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }

      if (req.user.role !== ROLES.ADMIN && (target.role === ROLES.ADMIN || target.role === ROLES.MODERATOR)) {
        return res.status(403).json({ message: "Only admins can change staff role for admins/moderators" });
      }

      if (target.role === ROLES.ADMIN || target.role === ROLES.MODERATOR) {
        return res.status(400).json({ message: "Admin and moderator accounts are already support staff" });
      }

      const nextRole = isSupportMember ? ROLES.SUPPORT_MEMBER : ROLES.MEMBER;
      const user = await prisma.user.update({
        where: { id },
        data: { role: nextRole },
      });

      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", issues: error.issues });
      }
      return res.status(500).json({ message: "Support role update failed" });
    }
  },
);

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

app.patch("/api/admin/advisors/:userId", authRequired, adminRequired, async (req, res) => {
  try {
    const data = adminAdvisorUpdateSchema.parse(req.body || {});
    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const current = await prisma.advisorProfile.findUnique({ where: { userId: req.params.userId } });
    const currentSpecialties = parseJsonArray(current?.specialties || "[]").map((item) => String(item));
    const normalizedCategory = data.advisorCategory ? normalizeText(data.advisorCategory, 80) : undefined;
    const mergedSpecialties =
      normalizedCategory !== undefined
        ? Array.from(new Set([normalizedCategory, ...currentSpecialties])).slice(0, 10)
        : currentSpecialties;

    const profile = await prisma.advisorProfile.upsert({
      where: { userId: req.params.userId },
      create: {
        userId: req.params.userId,
        displayName: data.displayName || target.name,
        isVerified: Boolean(data.isVerified),
        specialties: JSON.stringify(mergedSpecialties),
      },
      update: {
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
        ...(normalizedCategory !== undefined ? { specialties: JSON.stringify(mergedSpecialties) } : {}),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await evaluateAutoBadges(req.params.userId);

    return res.json({ advisor: sanitizeAdvisorProfile(profile, { isFollowing: false }) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to update advisor profile" });
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

app.post("/api/advice", async (req, res) => {
  try {
    const viewer = await getOptionalAuthUser(req);
    const actorUser = viewer || (await getOrCreateGuestAdviceUser());
    const isGuestSubmission = !viewer;
    const data = createAdviceSchema.parse(req.body);
    const identityMode = isGuestSubmission
      ? ADVICE_IDENTITY_MODE.ANONYMOUS
      : data.identityMode || inferIdentityModeFromBody(data.body);
    const normalizedBody = stripLegacyAnonymousPrefix(data.body);
    const autoSpamFlag = isLikelySpamTitle(data.title);
    const normalizedTags = Array.isArray(data.tags)
      ? Array.from(new Set(data.tags.map((tag) => normalizeText(tag, 40)).filter(Boolean))).slice(0, 12)
      : [];
    const isUrgent = PHASE1_URGENT_MODE ? Boolean(data.isUrgent) : false;
    const crisisMatches = FEATURE_CRISIS_DETECTION
      ? detectCrisisKeywords(`${data.title}\n${data.body}`)
      : [];
    const isCrisisFlagged = crisisMatches.length > 0;

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

    let resolvedGroupId = isGuestSubmission ? null : data.groupId || null;
    if (resolvedGroupId) {
      const membership = await prisma.groupMembership.findFirst({
        where: {
          groupId: resolvedGroupId,
          userId: actorUser.id,
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
        body: normalizedBody,
        status: ADVICE_STATUS.PENDING,
        identityMode,
        isSpam: autoSpamFlag,
        ...(FEATURE_PUBLIC_FEED_V2
          ? {
              visibility: data.visibility || ADVICE_VISIBILITY.PUBLIC,
            }
          : {}),
        ...(FEATURE_CRISIS_DETECTION
          ? {
              isCrisisFlagged,
              crisisKeywords: isCrisisFlagged ? JSON.stringify(crisisMatches) : null,
              priorityTier:
                isCrisisFlagged || isUrgent ? ADVICE_PRIORITY_TIER.URGENT : ADVICE_PRIORITY_TIER.NORMAL,
              priorityScore: isCrisisFlagged ? 1000 : isUrgent ? 850 : 0,
              holdReason: isCrisisFlagged ? "CRISIS_REVIEW_REQUIRED" : null,
            }
          : {}),
        ...(PHASE1_SMART_MATCHING || PHASE1_URGENT_MODE
          ? {
              tags: normalizedTags.length ? JSON.stringify(normalizedTags) : null,
              targetAudience: data.targetAudience ? normalizeText(data.targetAudience, 120) : null,
              isUrgent,
            }
          : {}),
        authorId: actorUser.id,
        categoryId: resolvedCategoryId,
        groupId: resolvedGroupId,
      },
      include: {
        author: adviceAuthorInclude(),
        category: true,
        group: true,
      },
    });

    if (!isGuestSubmission) {
      await evaluateAutoBadges(actorUser.id);
    }

    if (isCrisisFlagged) {
      await notifyCrisisModerationQueue({
        adviceId: advice.id,
        actorName: actorUser.name,
        source: "an advice thread",
      });
    }

    if (PHASE1_SMART_MATCHING || PHASE1_URGENT_MODE) {
      scheduleAdvisorMatching(advice);
    }

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
    ...(FEATURE_PUBLIC_FEED_V2 ? { visibility: ADVICE_VISIBILITY.PUBLIC } : {}),
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
    orderBy: [
      ...(PHASE1_URGENT_MODE ? [{ isUrgent: "desc" }] : []),
      { isBoostActive: "desc" },
      { isFeatured: "desc" },
      { createdAt: "desc" },
    ],
    include: { author: adviceAuthorInclude(), category: true, group: true },
  });

  return res.json({ advices: list.map(sanitizeAdvice) });
});

app.get("/api/advice/mine", authRequired, async (req, res) => {
  await clearExpiredBoosts();

  const list = await prisma.advice.findMany({
    where: { authorId: req.user.id },
    orderBy: [{ isBoostActive: "desc" }, { createdAt: "desc" }],
    include: { author: adviceAuthorInclude(), category: true, group: true },
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
    orderBy: [
      ...(PHASE1_URGENT_MODE ? [{ isUrgent: "desc" }] : []),
      { isBoostActive: "desc" },
      { isFeatured: "desc" },
      { createdAt: "desc" },
    ],
    include: { author: adviceAuthorInclude(), category: true, group: true },
  });

  const withFollow = list.map((advice) => ({ ...advice, isFollowing: true }));
  return res.json({ advices: withFollow.map(sanitizeAdvice) });
});

app.get("/api/public/feed", async (req, res) => {
  if (!FEATURE_PUBLIC_FEED_V2) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Public feed v2 is disabled",
    });
  }

  await clearExpiredBoosts();

  const parsed = publicFeedQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    return sendError(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid feed query",
      details: parsed.error.issues,
    });
  }

  const { cursor, limit, categoryId, sort, q } = parsed.data;
  const where = {
    status: ADVICE_STATUS.APPROVED,
    visibility: ADVICE_VISIBILITY.PUBLIC,
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { body: { contains: q } },
            { author: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "LATEST"
      ? [...(PHASE1_URGENT_MODE ? [{ isUrgent: "desc" }] : []), { createdAt: "desc" }]
      : [
          ...(PHASE1_URGENT_MODE ? [{ isUrgent: "desc" }] : []),
          { priorityScore: "desc" },
          { helpfulCount: "desc" },
          { viewCount: "desc" },
          { isBoostActive: "desc" },
          { createdAt: "desc" },
        ];

  const items = await prisma.advice.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy,
    include: {
      author: adviceAuthorInclude(),
      category: true,
      group: true,
      follows: { select: { id: true } },
    },
  });

  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, -1) : items;
  const advices = sliced
    .map((item) => ({
      ...sanitizeAdvice({ ...item, followCount: item.follows?.length || 0 }),
      trendingScore: buildTrendingScore(item),
    }))
    .sort((a, b) => (sort === "LATEST" ? 0 : b.trendingScore - a.trendingScore));

  return res.json({
    items: advices,
    pageInfo: {
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id || null : null,
      hasMore,
      limit,
      sort,
    },
  });
});

app.post("/api/advice/:id/reactions/helpful", authRequired, async (req, res) => {
  if (!FEATURE_PUBLIC_FEED_V2) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Helpful reactions are disabled",
    });
  }

  const parsed = helpfulReactionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid reaction input",
      details: parsed.error.issues,
    });
  }

  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });
  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  const existing = await prisma.adviceReaction.findUnique({
    where: {
      adviceId_userId_type: {
        adviceId: advice.id,
        userId: req.user.id,
        type: "HELPFUL",
      },
    },
  });

  const action = parsed.data.action;
  const shouldAdd = action === "add" || (action === "toggle" && !existing);
  const shouldRemove = action === "remove" || (action === "toggle" && Boolean(existing));

  if (shouldAdd && !existing) {
    await prisma.adviceReaction.create({
      data: {
        adviceId: advice.id,
        userId: req.user.id,
        type: "HELPFUL",
      },
    });
  }

  if (shouldRemove && existing) {
    await prisma.adviceReaction.delete({ where: { id: existing.id } });
  }

  const helpfulCount = await prisma.adviceReaction.count({
    where: { adviceId: advice.id, type: "HELPFUL" },
  });

  await prisma.advice.update({
    where: { id: advice.id },
    data: { helpfulCount },
  });

  if (PHASE1_ADVISOR_LEVELS) {
    scheduleAdvisorStatsRecalculation(advice.authorId);
  }

  const reacted = shouldAdd && !existing;
  if (reacted && advice.authorId !== req.user.id) {
    await createNotification({
      userId: advice.authorId,
      type: NOTIFICATION_TYPES.REACTION,
      title: "Your thread received a helpful reaction",
      body: `${req.user.name} found your thread helpful.`,
      adviceId: advice.id,
    });
  }

  return res.json({
    adviceId: advice.id,
    helpfulCount,
    reacted,
  });
});

app.post("/api/advice/:id/views", async (req, res) => {
  if (!FEATURE_PUBLIC_FEED_V2) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "View tracking is disabled",
    });
  }

  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });
  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  const updated = await prisma.advice.update({
    where: { id: advice.id },
    data: { viewCount: { increment: 1 } },
    select: { id: true, viewCount: true },
  });

  return res.json({ adviceId: updated.id, viewCount: updated.viewCount });
});

app.post("/api/advice/:id/priority/checkout", authRequired, async (req, res) => {
  if (!FEATURE_PRIORITY_ADVICE) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Priority advice is disabled",
    });
  }

  const parsed = createPriorityCheckoutSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid priority checkout input",
      details: parsed.error.issues,
    });
  }

  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });
  if (!advice || advice.authorId !== req.user.id) {
    return sendError(res, {
      status: 403,
      code: "PRIORITY_FORBIDDEN",
      message: "Only the advice owner can request priority",
    });
  }

  const amountCents = Math.max(100, Math.round(getBoostPriceCents() * 0.75));
  const provider = String(parsed.data.provider || "PENDING_GATEWAY").toUpperCase();

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.advicePriorityOrder.create({
      data: {
        adviceId: advice.id,
        userId: req.user.id,
        amountCents,
        currency: "USD",
        status: "REQUIRES_PAYMENT",
        provider,
        providerRef: `priority_${Date.now()}`,
        queueTier: ADVICE_PRIORITY_TIER.PRIORITY,
      },
    });

    const updatedAdvice = await tx.advice.update({
      where: { id: advice.id },
      data: {
        priorityTier: ADVICE_PRIORITY_TIER.PRIORITY,
        priorityScore: 500,
      },
      include: {
        author: adviceAuthorInclude(),
        category: true,
        group: true,
      },
    });

    return { order, advice: updatedAdvice };
  });

  return res.status(201).json({
    order: result.order,
    advice: sanitizeAdvice(result.advice),
    checkout: {
      provider,
      state: "payment_required",
    },
  });
});

app.get("/api/advisors", async (req, res) => {
  if (!FEATURE_ADVISOR_PROFILES) {
    return res.json({ items: [], pageInfo: { nextCursor: null, hasMore: false } });
  }

  const parsed = advisorListQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    return sendError(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid advisor query",
      details: parsed.error.issues,
    });
  }

  const viewer = await getOptionalAuthUser(req);
  const { cursor, limit, q, specialty, verifiedOnly } = parsed.data;

  const rows = await prisma.advisorProfile.findMany({
    where: {
      isPublic: true,
      ...(verifiedOnly ? { isVerified: true } : {}),
      ...(specialty ? { specialties: { contains: specialty } } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q } },
              { bio: { contains: q } },
              { user: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ isVerified: "desc" }, { ratingAvg: "desc" }, { followersCount: "desc" }],
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, -1) : rows;

  let followingSet = new Set();
  if (viewer) {
    const links = await prisma.advisorFollow.findMany({
      where: {
        followerId: viewer.id,
        advisorId: { in: sliced.map((item) => item.userId) },
      },
      select: { advisorId: true },
    });
    followingSet = new Set(links.map((link) => link.advisorId));
  }

  return res.json({
    items: sliced.map((item) =>
      sanitizeAdvisorProfile(item, { isFollowing: followingSet.has(item.userId) }),
    ),
    pageInfo: {
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id || null : null,
      hasMore,
      limit,
    },
  });
});

app.get("/api/advisors/leaderboard", async (req, res) => {
  if (!FEATURE_ADVISOR_PROFILES) {
    return res.json({ items: [] });
  }

  const limit = Math.min(50, Math.max(5, Number(req.query.limit || 20)));

  const profiles = await prisma.advisorProfile.findMany({
    where: {
      isPublic: true,
    },
    include: {
      user: { select: { id: true, name: true, role: true, isActive: true } },
    },
    orderBy: [{ levelScore: "desc" }, { helpfulCount: "desc" }, { totalReplies: "desc" }],
    take: limit,
  });

  const advisors = profiles.filter((profile) => profile.user?.isActive);

  const adviceCounts = await prisma.advice.groupBy({
    by: ["authorId"],
    where: {
      status: ADVICE_STATUS.APPROVED,
      identityMode: ADVICE_IDENTITY_MODE.PUBLIC,
      authorId: { in: advisors.map((item) => item.userId) },
    },
    _count: { authorId: true },
  });
  const countMap = new Map(adviceCounts.map((item) => [item.authorId, Number(item._count.authorId || 0)]));

  return res.json({
    items: advisors
      .map((profile) => ({
        ...sanitizeAdvisorProfile(profile, { isFollowing: false }),
        adviceGiven: countMap.get(profile.userId) || 0,
      }))
      .filter((row) => row.adviceGiven > 0),
  });
});

app.get("/api/advisors/:userId", async (req, res) => {
  if (!FEATURE_ADVISOR_PROFILES) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Advisor profiles are disabled",
    });
  }

  const viewer = await getOptionalAuthUser(req);
  const profile = await prisma.advisorProfile.findFirst({
    where: {
      userId: req.params.userId,
      isPublic: true,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  if (!profile) {
    return sendError(res, {
      status: 404,
      code: "ADVISOR_NOT_FOUND",
      message: "Advisor profile not found",
    });
  }

  let isFollowing = false;
  const [adviceGiven, categoryRows] = await Promise.all([
    prisma.advice.count({
      where: {
        authorId: profile.userId,
        status: ADVICE_STATUS.APPROVED,
        identityMode: ADVICE_IDENTITY_MODE.PUBLIC,
      },
    }),
    prisma.advice.findMany({
      where: {
        authorId: profile.userId,
        status: ADVICE_STATUS.APPROVED,
        identityMode: ADVICE_IDENTITY_MODE.PUBLIC,
        categoryId: { not: null },
      },
      include: { category: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (viewer) {
    const link = await prisma.advisorFollow.findUnique({
      where: {
        followerId_advisorId: {
          followerId: viewer.id,
          advisorId: profile.userId,
        },
      },
    });
    isFollowing = Boolean(link);
  }

  const expertiseCategories = Array.from(
    new Set(
      categoryRows
        .map((item) => item.category?.name)
        .filter(Boolean),
    ),
  );

  return res.json({
    advisor: {
      ...sanitizeAdvisorProfile(profile, { isFollowing }),
      adviceGiven,
      expertiseCategories,
    },
  });
});

app.post("/api/advisors/:userId/follow", authRequired, async (req, res) => {
  if (!FEATURE_ADVISOR_PROFILES) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Advisor profiles are disabled",
    });
  }

  if (req.params.userId === req.user.id) {
    return sendError(res, {
      status: 400,
      code: "SELF_FOLLOW_NOT_ALLOWED",
      message: "You cannot follow yourself",
    });
  }

  const profile = await prisma.advisorProfile.findFirst({
    where: { userId: req.params.userId, isPublic: true },
  });
  if (!profile) {
    return sendError(res, {
      status: 404,
      code: "ADVISOR_NOT_FOUND",
      message: "Advisor profile not found",
    });
  }

  await prisma.advisorFollow.upsert({
    where: {
      followerId_advisorId: {
        followerId: req.user.id,
        advisorId: req.params.userId,
      },
    },
    create: {
      followerId: req.user.id,
      advisorId: req.params.userId,
    },
    update: {},
  });

  const followersCount = await prisma.advisorFollow.count({
    where: { advisorId: req.params.userId },
  });

  await prisma.advisorProfile.update({
    where: { userId: req.params.userId },
    data: { followersCount },
  });

  return res.status(201).json({ success: true, followersCount });
});

app.delete("/api/advisors/:userId/follow", authRequired, async (req, res) => {
  if (!FEATURE_ADVISOR_PROFILES) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Advisor profiles are disabled",
    });
  }

  await prisma.advisorFollow.deleteMany({
    where: {
      followerId: req.user.id,
      advisorId: req.params.userId,
    },
  });

  const followersCount = await prisma.advisorFollow.count({
    where: { advisorId: req.params.userId },
  });

  await prisma.advisorProfile.updateMany({
    where: { userId: req.params.userId },
    data: { followersCount },
  });

  return res.json({ success: true, followersCount });
});

app.get("/api/dashboard/summary", authRequired, async (req, res) => {
  const [questionsAsked, repliesReceived, savedAdvice, followedAdvisors, anonymousQuestions, publicQuestions] =
    await Promise.all([
    prisma.advice.count({ where: { authorId: req.user.id } }),
    prisma.adviceComment.count({
      where: {
        advice: { authorId: req.user.id },
        authorId: { not: req.user.id },
      },
    }),
    FEATURE_SAVED_ADVICE ? prisma.savedAdvice.count({ where: { userId: req.user.id } }) : 0,
    FEATURE_ADVISOR_PROFILES ? prisma.advisorFollow.count({ where: { followerId: req.user.id } }) : 0,
    prisma.advice.count({ where: { authorId: req.user.id, identityMode: ADVICE_IDENTITY_MODE.ANONYMOUS } }),
    prisma.advice.count({ where: { authorId: req.user.id, identityMode: ADVICE_IDENTITY_MODE.PUBLIC } }),
    ]);

  return res.json({
    stats: {
      questionsAsked,
      repliesReceived,
      savedAdvice,
      followedAdvisors,
      activityScore: questionsAsked * 2 + repliesReceived + followedAdvisors,
      anonymousQuestions,
      publicQuestions,
    },
  });
});

app.patch("/api/advice/:id/identity", authRequired, async (req, res) => {
  const parsed = updateAdviceIdentitySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid identity mode",
      details: parsed.error.issues,
    });
  }

  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    include: { author: adviceAuthorInclude(), category: true, group: true },
  });

  if (!advice) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  if (advice.authorId !== req.user.id) {
    return sendError(res, {
      status: 403,
      code: "FORBIDDEN",
      message: "Only the author can update identity",
    });
  }

  const currentMode = resolveAdviceIdentityMode(advice);
  if (currentMode === ADVICE_IDENTITY_MODE.PUBLIC) {
    return res.json({ advice: sanitizeAdvice(advice), converted: false });
  }

  const updated = await prisma.advice.update({
    where: { id: advice.id },
    data: {
      identityMode: ADVICE_IDENTITY_MODE.PUBLIC,
      body: stripLegacyAnonymousPrefix(advice.body),
    },
    include: { author: adviceAuthorInclude(), category: true, group: true },
  });

  return res.json({ advice: sanitizeAdvice({ ...updated, isOwner: true }), converted: true });
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

app.get("/api/advice/saved", authRequired, async (req, res) => {
  if (!FEATURE_SAVED_ADVICE) {
    return res.json({ advices: [] });
  }

  const saved = await prisma.savedAdvice.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      advice: {
        include: {
          author: adviceAuthorInclude(),
          category: true,
          group: true,
        },
      },
    },
  });

  return res.json({
    advices: saved.map((entry) => sanitizeAdvice(entry.advice)),
  });
});

app.post("/api/advice/:id/save", authRequired, async (req, res) => {
  if (!FEATURE_SAVED_ADVICE) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Saved advice is disabled",
    });
  }

  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });
  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Advice not found",
    });
  }

  await prisma.savedAdvice.upsert({
    where: {
      adviceId_userId: {
        adviceId: advice.id,
        userId: req.user.id,
      },
    },
    create: {
      adviceId: advice.id,
      userId: req.user.id,
    },
    update: {},
  });

  return res.status(201).json({ success: true });
});

app.delete("/api/advice/:id/save", authRequired, async (req, res) => {
  if (!FEATURE_SAVED_ADVICE) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Saved advice is disabled",
    });
  }

  await prisma.savedAdvice.deleteMany({
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
      include: { author: adviceAuthorInclude(), category: true, group: true },
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
        include: { author: adviceAuthorInclude(), category: true, group: true },
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
      author: adviceAuthorInclude(),
      category: true,
      group: true,
      comments: {
        include: {
          author: {
            include: {
              ...(FEATURE_ADVISOR_PROFILES ? { advisorProfile: true } : {}),
              badges: {
                where: { isVisible: true },
                include: { badge: true },
                orderBy: { awardedAt: "desc" },
                take: 8,
              },
            },
          },
        },
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
    advice: sanitizeAdvice({
      ...advice,
      followCount,
      isFollowing: followedByCurrentUser,
      isOwner: Boolean(viewer && viewer.id === advice.authorId),
    }),
    comments: advice.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      messageType: comment.messageType || ADVICE_COMMENT_TYPE.TEXT,
      audioUrl: comment.audioUrl || null,
      audioDurationSec: comment.audioDurationSec || null,
      transcript: comment.transcript || null,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        displayName: comment.author.advisorProfile?.displayName || comment.author.name,
        role: comment.author.role,
        roleLabel: roleLabelFromUser(comment.author),
        roleTone: roleToneFromUser(comment.author),
        advisorCategory: advisorCategoryFromUser(comment.author),
        badges: normalizeIdentityBadges(comment.author),
        advisorProfile: comment.author.advisorProfile
          ? {
              isVerified: Boolean(comment.author.advisorProfile.isVerified),
              level: String(comment.author.advisorProfile.level || "NEW"),
              helpfulCount: Number(comment.author.advisorProfile.helpfulCount || 0),
            }
          : null,
      },
    })),
  });
});

app.get("/api/public/q/:id", async (req, res) => {
  if (!PHASE1_SHARE_CARDS) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Share cards are disabled",
    });
  }

  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    include: {
      author: { select: { name: true } },
      category: true,
      _count: { select: { comments: true } },
    },
  });

  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Question not found",
    });
  }

  if (FEATURE_PUBLIC_FEED_V2 && advice.visibility !== ADVICE_VISIBILITY.PUBLIC) {
    return sendError(res, {
      status: 403,
      code: "ADVICE_NOT_PUBLIC",
      message: "Question is not public",
    });
  }

  const normalizedTitle = normalizeText(advice.title, 140) || "Anonymous question";
  const normalizedBody = normalizeText(advice.body, 260);

  return res.json({
    question: {
      id: advice.id,
      title: normalizedTitle,
      body: normalizedBody,
      identityMode: resolveAdviceIdentityMode(advice),
      category: advice.category ? { id: advice.category.id, name: advice.category.name } : null,
      replyCount: Number(advice._count?.comments || 0),
      createdAt: advice.createdAt,
      isUrgent: Boolean(advice.isUrgent),
      tags: parseJsonArray(advice.tags),
      author:
        resolveAdviceIdentityMode(advice) === ADVICE_IDENTITY_MODE.PUBLIC
          ? {
              name: advice.author?.name || "TellNab Member",
            }
          : null,
    },
    ctaUrl: `/advice/${advice.id}`,
    share: {
      pageUrl: `/q/${advice.id}`,
      ogImageUrl: `/api/public/q/${advice.id}/og-image`,
    },
  });
});

app.get("/api/questions/:id/share", async (req, res) => {
  if (!PHASE1_SHARE_CARDS) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Share cards are disabled",
    });
  }

  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true },
  });

  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Question not found",
    });
  }

  return res.json({
    id: advice.id,
    shareUrl: `/q/${advice.id}`,
    ogImageUrl: `/api/public/q/${advice.id}/og-image`,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`https://tellnab.com/q/${advice.id}`)}`,
  });
});

app.get("/api/public/q/:id/og-image", async (req, res) => {
  if (!PHASE1_SHARE_CARDS) {
    return sendError(res, {
      status: 404,
      code: "FEATURE_DISABLED",
      message: "Share cards are disabled",
    });
  }

  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    include: { category: true, _count: { select: { comments: true } } },
  });

  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return sendError(res, {
      status: 404,
      code: "ADVICE_NOT_FOUND",
      message: "Question not found",
    });
  }

  const escapeXml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const title = escapeXml(normalizeText(advice.title, 88));
  const subtitle = escapeXml(advice.category?.name || "Advice");
  const replies = Number(advice._count?.comments || 0);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="TellNab question share card">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <text x="72" y="102" fill="#c4b5fd" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700">TellNab • Anonymous Question</text>
  <text x="72" y="190" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="54" font-weight="800">${title}</text>
  <text x="72" y="500" fill="#a5b4fc" font-family="Inter,Arial,sans-serif" font-size="30">Category: ${subtitle}</text>
  <text x="72" y="548" fill="#93c5fd" font-family="Inter,Arial,sans-serif" font-size="30">Replies: ${replies}</text>
  <text x="72" y="590" fill="#f8fafc" font-family="Inter,Arial,sans-serif" font-size="30">Answer on tellnab.com</text>
</svg>`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("image/svg+xml");
  return res.send(svg);
});

app.post("/api/advice/:id/comments", authRequired, async (req, res) => {
  try {
    const data = commentSchema.parse(req.body);
    const messageType = data.messageType || ADVICE_COMMENT_TYPE.TEXT;
    if (messageType === ADVICE_COMMENT_TYPE.VOICE && !FEATURE_VOICE_REPLIES) {
      return sendError(res, {
        status: 403,
        code: "VOICE_REPLY_DISABLED",
        message: "Voice replies are disabled",
      });
    }

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

    const crisisMatches = FEATURE_CRISIS_DETECTION
      ? detectCrisisKeywords(`${data.body || ""}\n${data.transcript || ""}`)
      : [];

    const comment = await prisma.adviceComment.create({
      data: {
        body:
          messageType === ADVICE_COMMENT_TYPE.VOICE
            ? String(data.body || data.transcript || "[Voice reply]")
            : String(data.body || ""),
        parentId: data.parentId || null,
        adviceId: advice.id,
        authorId: req.user.id,
        ...(FEATURE_VOICE_REPLIES
          ? {
              messageType,
              audioUrl: messageType === ADVICE_COMMENT_TYPE.VOICE ? data.audioUrl || null : null,
              audioDurationSec:
                messageType === ADVICE_COMMENT_TYPE.VOICE ? data.audioDurationSec || null : null,
              transcript: messageType === ADVICE_COMMENT_TYPE.VOICE ? data.transcript || null : null,
            }
          : {}),
      },
      include: {
        author: {
          include: {
            ...(FEATURE_ADVISOR_PROFILES ? { advisorProfile: true } : {}),
            badges: {
              where: { isVisible: true },
              include: { badge: true },
              orderBy: { awardedAt: "desc" },
              take: 8,
            },
          },
        },
      },
    });

    await evaluateAutoBadges(req.user.id);
    if (PHASE1_ADVISOR_LEVELS) {
      scheduleAdvisorStatsRecalculation(req.user.id);
    }

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
        body:
          messageType === ADVICE_COMMENT_TYPE.VOICE
            ? `${req.user.name} sent a voice reply on your advice thread.`
            : `${req.user.name} commented on your advice thread.`,
        adviceId: advice.id,
        commentId: comment.id,
      });
    }

    if (FEATURE_ADVISOR_PROFILES && req.user.role !== ROLES.MEMBER) {
      const followers = await prisma.advisorFollow.findMany({
        where: { advisorId: req.user.id },
        select: { followerId: true },
      });

      await Promise.all(
        followers
          .filter((item) => item.followerId !== req.user.id)
          .map((item) =>
            createNotification({
              userId: item.followerId,
              type: NOTIFICATION_TYPES.ADVISOR_ACTIVITY,
              title: "Advisor you follow replied",
              body: `${req.user.name} replied to a thread.`,
              adviceId: advice.id,
              commentId: comment.id,
            }),
          ),
      );
    }

    if (crisisMatches.length) {
      await prisma.advice.update({
        where: { id: advice.id },
        data: {
          isCrisisFlagged: true,
          crisisKeywords: JSON.stringify(crisisMatches),
          priorityTier: ADVICE_PRIORITY_TIER.URGENT,
          priorityScore: 1200,
        },
      });

      await notifyCrisisModerationQueue({
        adviceId: advice.id,
        actorName: req.user.name,
        source: "a comment",
      });
    }

    return res.status(201).json({
      comment: {
        id: comment.id,
        body: comment.body,
        messageType: comment.messageType || ADVICE_COMMENT_TYPE.TEXT,
        audioUrl: comment.audioUrl || null,
        audioDurationSec: comment.audioDurationSec || null,
        transcript: comment.transcript || null,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        author: {
          id: comment.author.id,
          name: comment.author.name,
          displayName: comment.author.advisorProfile?.displayName || comment.author.name,
          role: comment.author.role,
          roleLabel: roleLabelFromUser(comment.author),
          roleTone: roleToneFromUser(comment.author),
          advisorCategory: advisorCategoryFromUser(comment.author),
          badges: normalizeIdentityBadges(comment.author),
          advisorProfile: comment.author.advisorProfile
            ? {
                isVerified: Boolean(comment.author.advisorProfile.isVerified),
                level: String(comment.author.advisorProfile.level || "NEW"),
                helpfulCount: Number(comment.author.advisorProfile.helpfulCount || 0),
              }
            : null,
        },
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

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

const activeUsers = new Map(); // userId -> WebSocket
const ticketRooms = new Map(); // ticketId -> Set<WebSocket>
const socketMeta = new WeakMap(); // socket -> { userId, name, role, tickets:Set<string> }

function sendSocket(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(payload));
}

function socketsForUser(userId) {
  const socket = activeUsers.get(String(userId));
  return socket ? [socket] : [];
}

function broadcastPresence() {
  const agents = [];
  for (const [userId, socket] of activeUsers.entries()) {
    const meta = socket ? socketMeta.get(socket) : null;
    if (!meta) continue;
    const role = String(meta.role || "").toUpperCase();
    if (![ROLES.SUPPORT_MEMBER, ROLES.MODERATOR, ROLES.ADMIN].includes(role)) continue;
    agents.push({ id: userId, name: meta.name || "Agent", role });
  }

  const payload = { type: "presence_update", agents };
  for (const socket of activeUsers.values()) {
    sendSocket(socket, payload);
    sendSocket(socket, { type: "presence", agents });
  }
}

function joinTicketRoom(ws, ticketId) {
  const roomId = String(ticketId || "").trim();
  if (!roomId) return;
  if (!ticketRooms.has(roomId)) {
    ticketRooms.set(roomId, new Set());
  }
  ticketRooms.get(roomId).add(ws);
  const meta = socketMeta.get(ws);
  if (meta) {
    meta.tickets.add(roomId);
  }
}

function leaveTicketRoom(ws, ticketId) {
  const roomId = String(ticketId || "").trim();
  if (!roomId) return;
  const room = ticketRooms.get(roomId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) ticketRooms.delete(roomId);
  const meta = socketMeta.get(ws);
  if (meta) meta.tickets.delete(roomId);
}

function emitTicketMessage(ticketId, message) {
  const roomId = String(ticketId || "").trim();
  const room = ticketRooms.get(roomId);
  if (!room) return;
  const payload = { type: "ticket_message_received", ...message, ticketId: roomId };
  room.forEach((socket) => sendSocket(socket, payload));
}

function emitPrivateMessage(targetUserId, message) {
  const sockets = socketsForUser(targetUserId);
  const payload = { type: "private_message_received", ...message };
  sockets.forEach((socket) => sendSocket(socket, payload));
}

function emitUserEvent(targetUserId, eventType, payload = {}) {
  const sockets = socketsForUser(targetUserId);
  const envelope = { type: eventType, ...payload };
  sockets.forEach((socket) => sendSocket(socket, envelope));
}

realtimeHub.emitTicketMessage = emitTicketMessage;
realtimeHub.emitPrivateMessage = emitPrivateMessage;
realtimeHub.emitUserEvent = emitUserEvent;
realtimeHub.notifyPresence = broadcastPresence;

wss.on("connection", (ws) => {
  socketMeta.set(ws, { userId: null, name: "", role: "", tickets: new Set() });

  ws.on("message", async (raw) => {
    let payload = null;
    try {
      payload = JSON.parse(String(raw || "{}"));
    } catch {
      return;
    }

    const type = String(payload?.type || "");

    if (type === "auth") {
      try {
        let user = null;
        if (payload.token) {
          const decoded = jwt.verify(String(payload.token), JWT_SECRET);
          user = await prisma.user.findUnique({ where: { id: decoded.sub } });
        } else if (payload.userId) {
          user = await prisma.user.findUnique({ where: { id: String(payload.userId) } });
        }

        if (!user || !user.isActive) {
          sendSocket(ws, { type: "auth_error", message: "Unauthorized" });
          ws.close();
          return;
        }

        const meta = socketMeta.get(ws);
        meta.userId = user.id;
        meta.name = user.name;
        meta.role = user.role;

        if (activeUsers.has(user.id)) {
          const prevSocket = activeUsers.get(user.id);
          if (prevSocket && prevSocket !== ws) {
            try {
              prevSocket.close();
            } catch {
              // ignore close error
            }
          }
        }

        activeUsers.set(user.id, ws);

        sendSocket(ws, { type: "agent_online", userId: user.id });
        broadcastPresence();
      } catch {
        sendSocket(ws, { type: "auth_error", message: "Unauthorized" });
        ws.close();
      }
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta?.userId) {
      sendSocket(ws, { type: "auth_error", message: "Unauthorized" });
      return;
    }

    if (type === "agent_online") {
      sendSocket(ws, { type: "agent_online", userId: meta.userId });
      broadcastPresence();
      return;
    }

    if (type === "join_ticket_room" || type === "ticket.join") {
      joinTicketRoom(ws, payload.ticketId);
      return;
    }

    if (type === "leave_ticket_room" || type === "ticket.leave") {
      leaveTicketRoom(ws, payload.ticketId);
      return;
    }

    if (type === "ticket_message_sent" || type === "ticket.message") {
      const msg = {
        id: payload.id || `ws-${Date.now()}`,
        ticketId: String(payload.ticketId || ""),
        senderId: meta.userId,
        senderRole: meta.role,
        body: String(payload.body || ""),
        createdAt: payload.createdAt || new Date().toISOString(),
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
      };
      emitTicketMessage(msg.ticketId, msg);
      return;
    }

    if (type === "private_message_sent" || type === "dm") {
      const to = String(payload.to || "").trim();
      const body = String(payload.body || "").trim();
      if (!to || !body) return;

      const dm = {
        id: payload.id || `dm-${Date.now()}`,
        from: meta.userId,
        to,
        body,
        at: payload.at || new Date().toISOString(),
      };
      emitPrivateMessage(dm.to, dm);
      sendSocket(ws, { type: "private_message_received", ...dm });
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (!meta) return;

    if (meta.tickets?.size) {
      for (const ticketId of meta.tickets) {
        leaveTicketRoom(ws, ticketId);
      }
    }

    if (meta.userId && activeUsers.has(meta.userId)) {
      const activeSocket = activeUsers.get(meta.userId);
      if (activeSocket === ws) {
        activeUsers.delete(meta.userId);
        for (const socket of activeUsers.values()) {
          sendSocket(socket, { type: "agent_offline", userId: meta.userId });
        }
      }
      broadcastPresence();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`TellNab API running on http://localhost:${PORT}`);
});
