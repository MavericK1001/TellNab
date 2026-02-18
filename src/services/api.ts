import axios from "axios";
import { mockFeed } from "../data/mockData";
import {
  AdminUser,
  AdviceComment,
  AdviceItem,
  AdvicePost,
  AdviceStatus,
  AuthResponse,
  AuthUser,
  ConversationSummary,
  HomeOverview,
  PrivateMessage,
  UserProfile,
  UserRole,
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
    if (!isNetworkError(error)) {
      throw error;
    }

    for (const base of FALLBACK_API_BASE_URLS) {
      try {
        const response = await api.post<T>(`${base}${path}`, payload);
        return response.data;
      } catch (fallbackError) {
        if (!isNetworkError(fallbackError)) {
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
      name: user.name,
      role: user.role,
      bio: "Complete your first thread to build your TellNab profile impact.",
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

export async function logoutAccount(): Promise<void> {
  await api.post("/auth/logout");
  setAuthToken(undefined);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<{ user: AuthUser }>("/auth/me");
  return response.data.user;
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

export async function createAdvice(payload: { title: string; body: string }): Promise<AdviceItem> {
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

export async function listAdvice(status?: AdviceStatus): Promise<AdviceItem[]> {
  const response = await api.get<{ advices: AdviceItem[] }>("/advice", {
    params: status ? { status } : undefined,
  });
  return response.data.advices;
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
  payload: { isLocked?: boolean; isFeatured?: boolean },
): Promise<AdviceItem> {
  const response = await api.patch<{ advice: AdviceItem }>(`/moderation/advice/${id}/flags`, payload);
  return response.data.advice;
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const response = await api.get<{ conversations: ConversationSummary[] }>("/messages/conversations");
  return response.data.conversations;
}

export async function createConversation(recipientId: string): Promise<{ id: string }> {
  const response = await api.post<{ conversation: { id: string } }>("/messages/conversations", { recipientId });
  return response.data.conversation;
}

export async function getConversationMessages(conversationId: string): Promise<PrivateMessage[]> {
  const response = await api.get<{ messages: PrivateMessage[] }>(`/messages/conversations/${conversationId}`);
  return response.data.messages;
}

export async function sendMessage(conversationId: string, body: string): Promise<PrivateMessage> {
  const response = await api.post<{ message: PrivateMessage }>(`/messages/conversations/${conversationId}`, { body });
  return response.data.message;
}
