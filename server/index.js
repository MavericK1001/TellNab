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
};

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.SERVER_PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https:";
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "12h";
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === "production" ? 20 : 200),
);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("Missing/weak JWT_SECRET. Use at least 32 characters.");
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

      if (origin === CORS_ORIGIN || LOCAL_ORIGIN_PATTERN.test(origin)) {
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

app.use("/api/auth", authLimiter);

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
    holdReason: advice.holdReason,
    followCount: Number(advice.followCount || 0),
    isFollowing: Boolean(advice.isFollowing),
    createdAt: advice.createdAt,
    updatedAt: advice.updatedAt,
    author: advice.author
      ? {
          id: advice.author.id,
          name: advice.author.name,
          role: advice.author.role,
        }
      : undefined,
  };
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

async function createNotification(data) {
  try {
    await prisma.notification.create({ data });
  } catch {
    // notifications should not break primary user action
  }
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

const roleUpdateSchema = z.object({
  role: z.enum([ROLES.MEMBER, ROLES.MODERATOR, ROLES.ADMIN]),
});

const statusUpdateSchema = z.object({
  isActive: z.boolean(),
});

const createAdviceSchema = z.object({
  title: z.string().min(5).max(140),
  body: z.string().min(10).max(5000),
});

const moderateAdviceSchema = z.object({
  action: z.enum([ADVICE_STATUS.APPROVED, ADVICE_STATUS.HOLD, ADVICE_STATUS.REMOVED]),
  note: z.string().max(500).optional(),
});

const adviceFlagsSchema = z
  .object({
    isLocked: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((v) => v.isLocked !== undefined || v.isFeatured !== undefined, {
    message: "At least one flag is required",
  });

const commentSchema = z.object({
  body: z.string().min(1).max(1000),
  parentId: z.string().optional(),
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
    const [asks, replies, featuredThreads, approvedThreads, pendingThreads] = await Promise.all([
      prisma.advice.count({ where: { authorId: req.user.id } }),
      prisma.adviceComment.count({ where: { authorId: req.user.id } }),
      prisma.advice.count({ where: { authorId: req.user.id, isFeatured: true } }),
      prisma.advice.count({ where: { authorId: req.user.id, status: ADVICE_STATUS.APPROVED } }),
      prisma.advice.count({ where: { authorId: req.user.id, status: ADVICE_STATUS.PENDING } }),
    ]);

    const roleLabel =
      req.user.role === ROLES.ADMIN
        ? "Admin"
        : req.user.role === ROLES.MODERATOR
          ? "Moderator"
          : "Member";

    return res.json({
      profile: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        bio: `${roleLabel} at TellNab • helping people make clear decisions with direct advice.`,
        memberSince: req.user.createdAt,
        asks,
        replies,
        featuredThreads,
        approvedThreads,
        pendingThreads,
      },
    });
  } catch {
    return res.status(500).json({ message: "Failed to load profile" });
  }
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
    const [approvedThreads, featuredThreads, totalComments, activeMembers, pendingReview, highlights] =
      await Promise.all([
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.APPROVED, isFeatured: true } }),
        prisma.adviceComment.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.advice.count({ where: { status: ADVICE_STATUS.PENDING } }),
        prisma.advice.findMany({
          where: { status: ADVICE_STATUS.APPROVED },
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
          take: 3,
          include: { author: true },
        }),
      ]);

    return res.json({
      metrics: {
        approvedThreads,
        featuredThreads,
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

app.post("/api/advice", authRequired, async (req, res) => {
  try {
    const data = createAdviceSchema.parse(req.body);

    const advice = await prisma.advice.create({
      data: {
        title: data.title,
        body: data.body,
        status: ADVICE_STATUS.PENDING,
        authorId: req.user.id,
      },
      include: { author: true },
    });

    return res.status(201).json({ advice: sanitizeAdvice(advice) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to create advice" });
  }
});

app.get("/api/advice", async (req, res) => {
  const status = String(req.query.status || ADVICE_STATUS.APPROVED);
  const allowAll = req.headers.authorization || req.cookies.tn_auth;

  let where = { status: ADVICE_STATUS.APPROVED };
  if (allowAll && Object.values(ADVICE_STATUS).includes(status)) {
    where = { status };
  }

  const list = await prisma.advice.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: { author: true },
  });

  return res.json({ advices: list.map(sanitizeAdvice) });
});

app.get("/api/advice/mine", authRequired, async (req, res) => {
  const list = await prisma.advice.findMany({
    where: { authorId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { author: true },
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
  const list = await prisma.advice.findMany({
    where: {
      status: ADVICE_STATUS.APPROVED,
      follows: { some: { userId: req.user.id } },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: { author: true },
  });

  const withFollow = list.map((advice) => ({ ...advice, isFollowing: true }));
  return res.json({ advices: withFollow.map(sanitizeAdvice) });
});

app.post("/api/advice/:id/follow", authRequired, async (req, res) => {
  const advice = await prisma.advice.findUnique({ where: { id: req.params.id } });

  if (!advice || advice.status !== ADVICE_STATUS.APPROVED) {
    return res.status(404).json({ message: "Advice not found" });
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

app.get("/api/advice/:id", async (req, res) => {
  const advice = await prisma.advice.findUnique({
    where: { id: req.params.id },
    include: {
      author: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!advice) {
    return res.status(404).json({ message: "Advice not found" });
  }

  if (advice.status !== ADVICE_STATUS.APPROVED) {
    return res.status(403).json({ message: "Advice not publicly available" });
  }

  const followCount = await prisma.adviceFollow.count({ where: { adviceId: advice.id } });

  let followedByCurrentUser = false;
  if (req.headers.authorization || req.cookies.tn_auth) {
    try {
      const header = req.headers.authorization;
      const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : null;
      const token = bearer || req.cookies.tn_auth;
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET);
        const follow = await prisma.adviceFollow.findUnique({
          where: {
            adviceId_userId: {
              adviceId: advice.id,
              userId: payload.sub,
            },
          },
        });
        followedByCurrentUser = Boolean(follow);
      }
    } catch {
      followedByCurrentUser = false;
    }
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
      return res.status(404).json({ message: "Advice not available for comments" });
    }

    if (advice.isLocked && req.user.role === ROLES.MEMBER) {
      return res.status(403).json({ message: "Comments are locked by moderators" });
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
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(500).json({ message: "Failed to add comment" });
  }
});

app.get("/api/moderation/advice", authRequired, moderatorOrAdminRequired, async (req, res) => {
  const status = String(req.query.status || ADVICE_STATUS.PENDING);
  const finalStatus = Object.values(ADVICE_STATUS).includes(status) ? status : ADVICE_STATUS.PENDING;

  const list = await prisma.advice.findMany({
    where: { status: finalStatus },
    orderBy: { createdAt: "desc" },
    include: { author: true },
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
        moderatedById: req.user.id,
        moderatedAt: new Date(),
      },
      include: { author: true },
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
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(404).json({ message: "Advice not found" });
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
        moderatedById: req.user.id,
        moderatedAt: new Date(),
      },
      include: { author: true },
    });

    await prisma.adviceModerationAction.create({
      data: {
        adviceId: advice.id,
        moderatorId: req.user.id,
        action: "FLAGS_UPDATED",
        note: `locked=${String(advice.isLocked)}, featured=${String(advice.isFeatured)}`,
      },
    });

    if (advice.authorId !== req.user.id) {
      await createNotification({
        userId: advice.authorId,
        type: NOTIFICATION_TYPES.MODERATION,
        title: "Advice moderation flags updated",
        body: `Thread flags changed: locked=${String(advice.isLocked)}, featured=${String(advice.isFeatured)}.`,
        adviceId: advice.id,
      });
    }

    return res.json({ advice: sanitizeAdvice(advice) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    return res.status(404).json({ message: "Advice not found" });
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
