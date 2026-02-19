import axios from "axios";
import { mockFeed } from "../data/mockData";
import {
  AdminUser,
  AdminAuditLog,
  AdminGroupItem,
  AdminOverview,
  AdviceComment,
  AdviceBoostCheckout,
  AdviceAiAssistResult,
  CommentAiAssistResult,
  AdviceItem,
  AdvicePost,
  AdviceStatus,
  AuthResponse,
  AuthUser,
  BadgeDefinition,
  CategoryItem,
  ConversationSummary,
  GroupJoinRequest,
  GroupSummary,
  GroupMember,
  HomeOverview,
  NotificationItem,
  ModerationAiHintResult,
  ModerationActivityItem,
  ModerationGroupRequest,
  PrivateMessage,
  SearchUser,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
  UserBadge,
  UserProfile,
  UserRole,
  WalletOverview,
  WalletSnapshot,
} from "../types";

const DEFAULT_API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:4000/api"
      : "/api"
    : "/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

const FALLBACK_API_BASE_URLS =
  typeof window !== "undefined"
    ? Array.from(
        new Set([
          "/api",
          `${window.location.protocol}//${window.location.hostname}:4000/api`,
          "http://localhost:4000/api",
          "http://127.0.0.1:4000/api",
        ]),
      ).filter((base) => base !== API_BASE_URL)
    : [];

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  withCredentials: true,
});

const AUTH_TOKEN_KEY = "tellnab_auth_token";
let memoryAuthToken: string | null = null;

function getStoredToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;

  if (typeof window === "undefined") return null;

  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      memoryAuthToken = token;
    }
    return token;
  } catch {
    return null;
  }
}

export function setAuthToken(token?: string) {
  memoryAuthToken = token || null;

  if (typeof window === "undefined") return;

  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // localStorage can be blocked in strict privacy modes; memory fallback still works.
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function resolveApiUrl(base: string, path: string): string {
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}${path}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${base}${path}`;
  }

  return `${base}${path}`;
}

async function postWithFallback<T>(path: string, payload: unknown): Promise<T> {
  try {
    const response = await api.post<T>(path, payload);
    return response.data;
  } catch (error) {
    if (!isNetworkError(error) && !isNotFoundError(error)) {
      throw error;
    }

    for (const base of FALLBACK_API_BASE_URLS) {
      try {
        const response = await api.post<T>(`${base}${path}`, payload);
        return response.data;
      } catch (fallbackError) {
        if (!isNetworkError(fallbackError) && !isNotFoundError(fallbackError)) {
          throw fallbackError;
        }
      }
    }

    throw error;
  }
}

export async function getFeed(): Promise<AdvicePost[]> {
  try {
    const response = await api.get<AdvicePost[]>("/feed");
    return response.data;
  } catch {
    return mockFeed;
  }
}

export async function getProfile(): Promise<UserProfile> {
  try {
    const response = await api.get<{ profile: UserProfile }>("/profile");
    return response.data.profile;
  } catch {
    const user = await fetchCurrentUser();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      authProvider: user.authProvider,
      hasPassword: user.hasPassword,
      bio: "Complete your first thread to build your TellNab profile impact.",
      avatarUrl: user.avatarUrl || null,
      coverImageUrl: user.coverImageUrl || null,
      memberSince: user.createdAt || new Date().toISOString(),
      asks: 0,
      replies: 0,
      featuredThreads: 0,
      approvedThreads: 0,
      pendingThreads: 0,
    };
  }
}

export async function getHomeOverview(): Promise<HomeOverview> {
  const response = await api.get<HomeOverview>("/home/overview");
  return response.data;
}

export async function createQuestion(payload: {
  title: string;
  category: string;
  question: string;
  anonymous: boolean;
}) {
  try {
    const response = await api.post("/questions", payload);
    return response.data;
  } catch {
    return { success: true, localOnly: true };
  }
}

export async function registerAccount(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await postWithFallback<AuthResponse>("/auth/register", payload);
  setAuthToken(data.token);
  return data;
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await postWithFallback<AuthResponse>("/auth/login", payload);
  setAuthToken(data.token);
  return data;
}

export async function socialLoginAccount(payload: {
  provider: "google" | "apple";
  providerSubject: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}): Promise<AuthResponse> {
  const data = await postWithFallback<AuthResponse>("/auth/social", payload);
  setAuthToken(data.token);
  return data;
}

export async function socialLoginGoogleCode(payload: {
  code: string;
}): Promise<AuthResponse> {
  const data = await postWithFallback<AuthResponse>("/auth/social/google-code", payload);
  setAuthToken(data.token);
  return data;
}

export async function logoutAccount(): Promise<void> {
  await api.post("/auth/logout");
  setAuthToken(undefined);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<{ user: AuthUser }>("/auth/me");
  return response.data.user;
}

export async function updateProfileSettings(payload: {
  name?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
}): Promise<UserProfile> {
  const response = await api.patch<{ profile: UserProfile }>("/profile", payload);
  return response.data.profile;
}

export async function updateProfilePassword(payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const response = await api.patch<{ success: boolean; message: string }>("/profile/password", payload);
  return response.data;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await api.get<{ users: AdminUser[] }>("/admin/users");
  return response.data.users;
}

export async function updateAdminUserRole(id: string, role: UserRole): Promise<AdminUser> {
  const response = await api.patch<{ user: AdminUser }>(`/admin/users/${id}/role`, { role });
  return response.data.user;
}

export async function updateAdminUserStatus(id: string, isActive: boolean): Promise<AdminUser> {
  const response = await api.patch<{ user: AdminUser }>(`/admin/users/${id}/status`, { isActive });
  return response.data.user;
}

export async function getWalletOverview(): Promise<WalletOverview> {
  const response = await api.get<WalletOverview>("/wallet");
  return response.data;
}

export async function mockWalletTopup(amountCents: number): Promise<{
  wallet: WalletSnapshot;
  message: string;
}> {
  const response = await api.post<{ wallet: WalletSnapshot; message: string }>("/wallet/topup/mock", {
    amountCents,
  });
  return response.data;
}

export async function getMyBadges(): Promise<{ catalog: BadgeDefinition[]; awards: UserBadge[] }> {
  const response = await api.get<{ catalog: BadgeDefinition[]; awards: UserBadge[] }>("/badges");
  return response.data;
}

export async function getAdminBadges(): Promise<BadgeDefinition[]> {
  const response = await api.get<{ badges: BadgeDefinition[] }>("/admin/badges");
  return response.data.badges;
}

export async function adminAssignBadge(payload: {
  userId: string;
  badgeKey: string;
  reason: string;
}): Promise<UserBadge> {
  const response = await api.post<{ award: UserBadge }>("/admin/badges/assign", payload);
  return response.data.award;
}

export async function adminAdjustWallet(payload: {
  userId: string;
  balanceType: "PAID" | "EARNED";
  amountCents: number;
  reason: string;
}): Promise<{ wallet: WalletSnapshot }> {
  const response = await api.post<{ wallet: WalletSnapshot }>("/admin/wallet/adjustments", payload);
  return response.data;
}

export async function getAdminAuditLogs(limit = 60): Promise<AdminAuditLog[]> {
  const response = await api.get<{ logs: AdminAuditLog[] }>("/admin/audit-logs", {
    params: { limit },
  });
  return response.data.logs;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await api.get<AdminOverview>("/admin/overview");
  return response.data;
}

export async function listAdminSupportTickets(options?: {
  status?: SupportTicketStatus;
  type?: "INQUIRY" | "ISSUE" | "SUGGESTION";
  priority?: SupportTicketPriority;
  q?: string;
  limit?: number;
}): Promise<SupportTicket[]> {
  const response = await api.get<{ tickets: SupportTicket[] }>("/admin/support/tickets", {
    params: {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.priority ? { priority: options.priority } : {}),
      ...(options?.q ? { q: options.q } : {}),
      ...(options?.limit ? { limit: options.limit } : {}),
    },
  });
  return response.data.tickets;
}

export async function updateAdminSupportTicket(
  id: string,
  payload: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    internalNote?: string | null;
    resolutionSummary?: string | null;
  },
): Promise<SupportTicket> {
  const response = await api.patch<{ ticket: SupportTicket }>(`/admin/support/tickets/${id}`, payload);
  return response.data.ticket;
}

export async function listAdminCategories(): Promise<CategoryItem[]> {
  const response = await api.get<{ categories: CategoryItem[] }>("/admin/categories");
  return response.data.categories;
}

export async function createAdminCategory(payload: {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<CategoryItem> {
  const response = await api.post<{ category: CategoryItem }>("/admin/categories", payload);
  return response.data.category;
}

export async function updateAdminCategory(
  id: string,
  payload: {
    name?: string;
    slug?: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<CategoryItem> {
  const response = await api.patch<{ category: CategoryItem }>(`/admin/categories/${id}`, payload);
  return response.data.category;
}

export async function listAdminGroups(): Promise<AdminGroupItem[]> {
  const response = await api.get<{ groups: AdminGroupItem[] }>("/admin/groups");
  return response.data.groups;
}

export async function updateAdminGroup(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    ownerId?: string;
  },
): Promise<GroupSummary> {
  const response = await api.patch<{ group: GroupSummary }>(`/admin/groups/${id}`, payload);
  return response.data.group;
}

export async function listAdminGroupModerationActions(
  id: string,
  limit = 80,
): Promise<ModerationActivityItem[]> {
  const response = await api.get<{ actions: ModerationActivityItem[] }>(`/admin/groups/${id}/moderation-actions`, {
    params: { limit },
  });
  return response.data.actions;
}

export async function createAdvice(payload: {
  title: string;
  body: string;
  categoryId?: string;
  groupId?: string;
}): Promise<AdviceItem> {
  try {
    const data = await postWithFallback<{ advice: AdviceItem }>("/advice", payload);
    return data.advice;
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    const token = getStoredToken();
    const bases = [API_BASE_URL, ...FALLBACK_API_BASE_URLS];

    for (const base of bases) {
      try {
        const response = await fetch(resolveApiUrl(base, "/advice"), {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        let json: { advice?: AdviceItem; message?: string } = {};
        try {
          json = (await response.json()) as { advice?: AdviceItem; message?: string };
        } catch {
          // ignore non-json body
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}${json.message ? `: ${json.message}` : ""}`);
        }

        if (!json.advice) {
          throw new Error("Advice response missing payload");
        }

        return json.advice;
      } catch (fallbackError) {
        if (fallbackError instanceof Error && fallbackError.message.startsWith("HTTP ")) {
          throw fallbackError;
        }
      }
    }

    throw error;
  }
}

export async function generateAdviceDraftWithAi(payload: {
  title?: string;
  question: string;
  targetTone?: "balanced" | "direct" | "empathetic";
  outcome?: string;
  anonymous?: boolean;
}): Promise<AdviceAiAssistResult> {
  const response = await api.post<AdviceAiAssistResult>("/ai/advice-assist", payload);
  return response.data;
}

export async function generateCommentDraftWithAi(payload: {
  adviceTitle: string;
  adviceBody: string;
  parentComment?: string;
  draft?: string;
  targetTone?: "balanced" | "direct" | "empathetic";
}): Promise<CommentAiAssistResult> {
  const response = await api.post<CommentAiAssistResult>("/ai/comment-assist", payload);
  return response.data;
}

export async function generateModerationHintWithAi(payload: {
  title: string;
  body: string;
  status: AdviceStatus;
  isLocked: boolean;
  isFeatured: boolean;
  isSpam: boolean;
}): Promise<ModerationAiHintResult> {
  const response = await api.post<ModerationAiHintResult>("/ai/moderation-hint", payload);
  return response.data;
}

export async function listAdvice(
  status?: AdviceStatus,
  options?: { categoryId?: string; groupId?: string },
): Promise<AdviceItem[]> {
  const response = await api.get<{ advices: AdviceItem[] }>("/advice", {
    params: {
      ...(status ? { status } : {}),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options?.groupId ? { groupId: options.groupId } : {}),
    },
  });
  return response.data.advices;
}

export async function listCategories(): Promise<CategoryItem[]> {
  const response = await api.get<{ categories: CategoryItem[] }>("/categories");
  return response.data.categories;
}

export async function listGroups(): Promise<GroupSummary[]> {
  const response = await api.get<{ groups: GroupSummary[] }>("/groups");
  return response.data.groups;
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  visibility: "PUBLIC" | "PRIVATE";
}): Promise<GroupSummary> {
  const response = await api.post<{ group: GroupSummary }>("/groups", payload);
  return response.data.group;
}

export async function getGroupDetail(
  groupId: string,
): Promise<{ group: GroupSummary; members: GroupMember[]; pendingRequests: number }> {
  const response = await api.get<{ group: GroupSummary; members: GroupMember[]; pendingRequests: number }>(
    `/groups/${groupId}`,
  );
  return response.data;
}

export async function joinGroup(groupId: string, message?: string): Promise<{ status: string; requestId?: string }> {
  const response = await api.post<{ status: string; requestId?: string }>(`/groups/${groupId}/join`, {
    message,
  });
  return response.data;
}

export async function leaveGroup(groupId: string): Promise<void> {
  await api.post(`/groups/${groupId}/leave`);
}

export async function listGroupJoinRequests(groupId: string): Promise<GroupJoinRequest[]> {
  const response = await api.get<{ requests: GroupJoinRequest[] }>(`/groups/${groupId}/join-requests`);
  return response.data.requests;
}

export async function approveGroupJoinRequest(groupId: string, requestId: string, reason?: string): Promise<void> {
  await api.post(`/groups/${groupId}/join-requests/${requestId}/approve`, { reason });
}

export async function rejectGroupJoinRequest(groupId: string, requestId: string, reason?: string): Promise<void> {
  await api.post(`/groups/${groupId}/join-requests/${requestId}/reject`, { reason });
}

export async function listModerationGroupRequests(): Promise<ModerationGroupRequest[]> {
  const response = await api.get<{ requests: ModerationGroupRequest[] }>("/moderation/group-requests");
  return response.data.requests;
}

export async function listModerationActivity(limit = 80): Promise<ModerationActivityItem[]> {
  const response = await api.get<{ actions: ModerationActivityItem[] }>("/moderation/activity", {
    params: { limit },
  });
  return response.data.actions;
}

export async function listMyAdvice(): Promise<AdviceItem[]> {
  const response = await api.get<{ advices: AdviceItem[] }>("/advice/mine");
  return response.data.advices;
}

export async function getAdviceDetail(id: string): Promise<{ advice: AdviceItem; comments: AdviceComment[] }> {
  const response = await api.get<{ advice: AdviceItem; comments: AdviceComment[] }>(`/advice/${id}`);
  return response.data;
}

export async function addAdviceComment(
  adviceId: string,
  payload: { body: string; parentId?: string },
): Promise<AdviceComment> {
  const response = await api.post<{ comment: AdviceComment }>(`/advice/${adviceId}/comments`, payload);
  return response.data.comment;
}

export async function deleteMyAdviceComment(
  adviceId: string,
  commentId: string,
): Promise<{ success: boolean; removedCount: number }> {
  const response = await api.delete<{ success: boolean; removedCount: number }>(
    `/advice/${adviceId}/comments/${commentId}`,
  );
  return response.data;
}

export async function listFollowedAdviceIds(): Promise<string[]> {
  const response = await api.get<{ adviceIds: string[] }>("/advice/follows");
  return response.data.adviceIds;
}

export async function listFollowingAdvice(): Promise<AdviceItem[]> {
  const response = await api.get<{ advices: AdviceItem[] }>("/advice/following");
  return response.data.advices;
}

export async function followAdviceThread(adviceId: string): Promise<void> {
  await api.post(`/advice/${adviceId}/follow`);
}

export async function unfollowAdviceThread(adviceId: string): Promise<void> {
  await api.delete(`/advice/${adviceId}/follow`);
}

export async function createAdviceBoostCheckout(adviceId: string): Promise<AdviceBoostCheckout> {
  const response = await api.post<AdviceBoostCheckout>(`/advice/${adviceId}/boost/checkout`, {});
  return response.data;
}

export async function moderationQueue(status: AdviceStatus = "PENDING"): Promise<AdviceItem[]> {
  const response = await api.get<{ advices: AdviceItem[] }>("/moderation/advice", {
    params: { status },
  });
  return response.data.advices;
}

export async function moderateAdvice(
  id: string,
  payload: { action: Exclude<AdviceStatus, "PENDING">; note?: string },
): Promise<AdviceItem> {
  const response = await api.patch<{ advice: AdviceItem }>(`/moderation/advice/${id}`, payload);
  return response.data.advice;
}

export async function updateAdviceFlags(
  id: string,
  payload: { isLocked?: boolean; isFeatured?: boolean; isSpam?: boolean },
): Promise<AdviceItem> {
  const response = await api.patch<{ advice: AdviceItem }>(`/moderation/advice/${id}/flags`, payload);
  return response.data.advice;
}

export async function deleteAdviceCommentAsModerator(
  adviceId: string,
  commentId: string,
  reason?: string,
): Promise<{ success: boolean; removedCount: number }> {
  const response = await api.delete<{ success: boolean; removedCount: number }>(
    `/moderation/advice/${adviceId}/comments/${commentId}`,
    {
      data: reason ? { reason } : {},
    },
  );
  return response.data;
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const response = await api.get<{ conversations: ConversationSummary[] }>("/messages/conversations");
  return response.data.conversations;
}

export async function createConversation(recipientId: string): Promise<{ id: string }> {
  const response = await api.post<{ conversation: { id: string } }>("/messages/conversations", { recipientId });
  return response.data.conversation;
}

export async function searchUsers(query: string): Promise<SearchUser[]> {
  const response = await api.get<{ users: SearchUser[] }>("/users/search", {
    params: { q: query },
  });
  return response.data.users;
}

export async function getConversationMessages(conversationId: string): Promise<PrivateMessage[]> {
  const response = await api.get<{ messages: PrivateMessage[] }>(`/messages/conversations/${conversationId}`);
  return response.data.messages;
}

export async function sendMessage(conversationId: string, body: string): Promise<PrivateMessage> {
  const response = await api.post<{ message: PrivateMessage }>(`/messages/conversations/${conversationId}`, { body });
  return response.data.message;
}

export async function listNotifications(): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const response = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>("/notifications");
  return response.data;
}

export async function markNotificationRead(id: string, isRead: boolean): Promise<void> {
  await api.patch(`/notifications/${id}`, { isRead });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}
