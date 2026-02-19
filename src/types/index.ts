export type AdviceCategory =
  | "Career"
  | "Relationships"
  | "Money"
  | "Personal Growth"
  | "Health & Lifestyle";

export type AdvicePost = {
  id: string;
  title: string;
  body: string;
  category: AdviceCategory;
  author: string;
  anonymous: boolean;
  votes: number;
  replies: number;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  name: string;
  role: UserRole;
  bio: string;
  memberSince: string;
  asks: number;
  replies: number;
  featuredThreads: number;
  approvedThreads: number;
  pendingThreads: number;
  badgesCount?: number;
  wallet?: {
    paidCents: number;
    earnedCents: number;
    lifetimeEarnedCents: number;
  };
};

export type WalletTransaction = {
  id: string;
  amountCents: number;
  balanceType: "PAID" | "EARNED" | string;
  direction: "CREDIT" | "DEBIT" | string;
  reason: string;
  source: string;
  resultingPaidCents: number;
  resultingEarnedCents: number;
  createdAt: string;
  performedBy?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
};

export type WalletSnapshot = {
  paidCents: number;
  earnedCents: number;
  lifetimeEarnedCents: number;
  totalCents: number;
};

export type BadgeDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  awarded?: boolean;
  award?: UserBadge | null;
};

export type UserBadge = {
  id: string;
  source: string;
  reason?: string | null;
  isVisible: boolean;
  awardedAt: string;
  badge: BadgeDefinition | null;
  awardedBy?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
};

export type WalletOverview = {
  wallet: WalletSnapshot;
  transactions: WalletTransaction[];
  limits: {
    topupMode: string;
    topupMaxCents: number;
    dailyTopupCapCents: number;
  };
};

export type AdminAuditLog = {
  id: string;
  action: string;
  reason: string;
  metadata?: string | null;
  createdAt: string;
  admin?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
  targetUser?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
};

export type AdminOverview = {
  metrics: {
    pendingModeration: number;
    holdThreads: number;
    removedThreads: number;
    pendingGroupRequests: number;
    totalGroups: number;
    activeGroups: number;
    totalCategories: number;
    activeCategories: number;
    moderationActions24h: number;
  };
  adminOnly?: {
    totalUsers: number;
    activeUsers: number;
    adminAuditEntries24h: number;
  } | null;
};

export type AdminGroupItem = GroupSummary & {
  pendingJoinRequests: number;
  adviceCount: number;
};

export type ModerationGroupRequest = GroupJoinRequest & {
  group: GroupSummary;
};

export type ModerationActivityItem = {
  id: string;
  domain: "ADVICE" | "GROUP" | string;
  action: string;
  note?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
  target?: {
    id: string;
    title?: string;
    name?: string;
    slug?: string;
    status?: string;
  } | null;
};

export type HomeOverview = {
  metrics: {
    approvedThreads: number;
    featuredThreads: number;
    boostedThreads: number;
    totalComments: number;
    activeMembers: number;
    pendingReview: number;
  };
  highlights: AdviceItem[];
};

export type UserRole = "MEMBER" | "MODERATOR" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
};

export type AuthResponse = {
  user: AuthUser;
  token?: string;
};

export type AdminUser = AuthUser;

export type SearchUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AdviceStatus = "PENDING" | "APPROVED" | "HOLD" | "REMOVED";

export type AdviceItem = {
  id: string;
  title: string;
  body: string;
  status: AdviceStatus;
  isLocked: boolean;
  isFeatured: boolean;
  isBoostActive: boolean;
  boostExpiresAt?: string | null;
  holdReason?: string | null;
  followCount?: number;
  isFollowing?: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  group?: {
    id: string;
    slug: string;
    name: string;
    visibility: "PUBLIC" | "PRIVATE" | string;
  } | null;
  author?: {
    id: string;
    name: string;
    role?: UserRole;
  };
};

export type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type GroupVisibility = "PUBLIC" | "PRIVATE";

export type GroupSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility: GroupVisibility | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    isActive?: boolean;
  } | null;
  memberCount: number;
  membership?: {
    role: "OWNER" | "MODERATOR" | "MEMBER" | string;
    joinedAt?: string;
  } | null;
};

export type GroupMember = {
  id: string;
  role: "OWNER" | "MODERATOR" | "MEMBER" | string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    role?: UserRole;
  };
};

export type GroupJoinRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  message?: string | null;
  requestedAt: string;
  requester: {
    id: string;
    name: string;
    role?: UserRole;
  };
};

export type AdviceComment = {
  id: string;
  body: string;
  parentId?: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
};

export type ConversationSummary = {
  id: string;
  participants: Array<{ id: string; name: string }>;
  lastMessage?: {
    id: string;
    body: string;
    createdAt: string;
  } | null;
};

export type PrivateMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
  };
};

export type NotificationItem = {
  id: string;
  type: "REPLY" | "NEW_COMMENT" | "MODERATION" | string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  adviceId?: string | null;
  commentId?: string | null;
};

export type AdviceBoostCheckout = {
  order: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    provider: string;
    paidAt?: string | null;
    boostDays: number;
  };
  advice: AdviceItem;
  message: string;
};
