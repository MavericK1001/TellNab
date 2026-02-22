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
  email: string;
  name: string;
  role: UserRole;
  roleLabel?: string;
  roleTone?: string;
  authProvider?: "LOCAL" | "GOOGLE" | "APPLE" | string;
  hasPassword?: boolean;
  bio: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  memberSince: string;
  asks: number;
  replies: number;
  featuredThreads: number;
  approvedThreads: number;
  pendingThreads: number;
  badgesCount?: number;
  badges?: UserBadge[];
  totalAnswers?: number;
  helpfulAnswersCount?: number;
  expertiseCategories?: string[];
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

export type SupportTicketPriority = "URGENT" | "NORMAL" | "LOW";

export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type SupportTicket = {
  id: string;
  type: "INQUIRY" | "ISSUE" | "SUGGESTION" | string;
  priority: SupportTicketPriority | string;
  slaTargetHours: number;
  slaLabel: string;
  status: SupportTicketStatus | string;
  requesterName: string;
  requesterEmail: string;
  subject: string;
  message: string;
  pageUrl?: string | null;
  firstResponseDueAt?: string | null;
  firstResponseAt?: string | null;
  isSlaBreached?: boolean;
  internalNote?: string | null;
  resolutionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: {
    id: string;
    name: string;
    role?: UserRole;
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
    questionsAsked?: number;
    answersGiven?: number;
    activeAdvisors?: number;
  };
  highlights: AdviceItem[];
  latestQuestions?: AdviceItem[];
  trendingTopics?: Array<{
    id: string;
    slug: string;
    name: string;
    count: number;
  }>;
  recentlyAnswered?: AdviceItem[];
};

export type UserRole = "MEMBER" | "MODERATOR" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  authProvider?: "LOCAL" | "GOOGLE" | "APPLE" | string;
  hasPassword?: boolean;
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
  identityMode?: "ANONYMOUS" | "PUBLIC" | string;
  isAnonymous?: boolean;
  visibility?: "PUBLIC" | "PRIVATE" | string;
  isLocked: boolean;
  isFeatured: boolean;
  isSpam: boolean;
  isCrisisFlagged?: boolean;
  crisisKeywords?: string | null;
  isBoostActive: boolean;
  isUrgent?: boolean;
  tags?: string[] | null;
  targetAudience?: string | null;
  helpfulCount?: number;
  viewCount?: number;
  priorityTier?: "NORMAL" | "PRIORITY" | "URGENT" | string;
  priorityScore?: number;
  trendingScore?: number;
  boostExpiresAt?: string | null;
  holdReason?: string | null;
  followCount?: number;
  isFollowing?: boolean;
  isOwner?: boolean;
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
    id?: string;
    name: string;
    displayName?: string;
    role?: UserRole;
    roleLabel?: string;
    roleTone?: string;
    advisorCategory?: string | null;
    badges?: Array<{
      key: string;
      name: string;
      description?: string;
      icon?: string;
      tone?: string;
    }>;
    avatarUrl?: string | null;
    advisorProfile?: {
      displayName: string;
      isVerified: boolean;
      ratingAvg: number;
      totalReplies: number;
      helpfulCount?: number;
      responseTimeMins?: number;
      level?:
        | "NEW"
        | "ACTIVE"
        | "TOP_LISTENER"
        | "PRO_ADVISOR"
        | "ELITE_ADVISOR"
        | string;
    } | null;
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
  messageType?: "TEXT" | "VOICE" | string;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  transcript?: string | null;
  parentId?: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    displayName?: string;
    role?: UserRole;
    roleLabel?: string;
    roleTone?: string;
    advisorCategory?: string | null;
    badges?: Array<{
      key: string;
      name: string;
      description?: string;
      icon?: string;
      tone?: string;
    }>;
    advisorProfile?: {
      isVerified?: boolean;
      level?: string;
      helpfulCount?: number;
    } | null;
  };
};

export type AdminAdvisorUpdateResult = {
  advisor: AdvisorProfile;
};

export type PublicFeedResponse = {
  items: AdviceItem[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
    sort: "TRENDING" | "LATEST";
  };
};

export type AdvisorProfile = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  specialties: string[];
  isVerified: boolean;
  rating: number;
  ratingCount: number;
  totalReplies: number;
  helpfulCount?: number;
  responseTimeMins: number;
  level?:
    | "NEW"
    | "ACTIVE"
    | "TOP_LISTENER"
    | "PRO_ADVISOR"
    | "ELITE_ADVISOR"
    | string;
  levelScore?: number;
  adviceGiven?: number;
  expertiseCategories?: string[];
  followersCount: number;
  isFollowing: boolean;
  user?: {
    id: string;
    name: string;
    role?: UserRole;
  } | null;
};

export type PublicQuestionShare = {
  question: {
    id: string;
    title: string;
    body: string;
    identityMode?: "ANONYMOUS" | "PUBLIC" | string;
    author?: { name: string } | null;
    category?: { id: string; name: string } | null;
    replyCount: number;
    createdAt: string;
    isUrgent?: boolean;
    tags?: string[];
  };
  ctaUrl: string;
  share: {
    pageUrl: string;
    ogImageUrl: string;
  };
};

export type DashboardSummary = {
  stats: {
    questionsAsked: number;
    repliesReceived: number;
    savedAdvice: number;
    followedAdvisors: number;
    activityScore: number;
    anonymousQuestions?: number;
    publicQuestions?: number;
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

export type AdviceAiAssistResult = {
  draftTitle: string;
  draftBody: string;
  suggestions: string[];
  provider: "mock" | "openai" | string;
};

export type CommentAiAssistResult = {
  draftComment: string;
  suggestions: string[];
  provider: "mock" | "openai" | string;
};

export type ModerationAiHintResult = {
  recommendedAction: "APPROVED" | "HOLD" | "REMOVED" | "KEEP_STATUS";
  priority: "LOW" | "MEDIUM" | "HIGH";
  rationale: string;
  checks: string[];
  provider: "mock" | "openai" | string;
};
