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
};

export type HomeOverview = {
  metrics: {
    approvedThreads: number;
    featuredThreads: number;
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
  holdReason?: string | null;
  followCount?: number;
  isFollowing?: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
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
