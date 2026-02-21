import { ApiError, AuthUser, TicketMessage, TicketResponse, TicketRow } from "../app/types";

const SUPPORT_TOKEN_KEY = "tellnab_support_auth_token";

const PRIMARY_API_BASE =
  (window as any).SUPPORT_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api`;

const IS_LOCAL_HOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const IS_SUPPORT_HOST = /(^|\.)support\.tellnab\.com$/i.test(
  window.location.hostname,
);
const CONFIGURED_SUPPORT_API_BASE = String(
  (window as any).SUPPORT_API_BASE || "",
).trim();
const EFFECTIVE_SUPPORT_API_BASE =
  IS_SUPPORT_HOST &&
  CONFIGURED_SUPPORT_API_BASE &&
  !/(^https?:\/\/)?([a-z0-9-]+\.)?tellnab\.onrender\.com(\/|$)/i.test(
    CONFIGURED_SUPPORT_API_BASE,
  )
    ? ""
    : CONFIGURED_SUPPORT_API_BASE;

const API_BASE_CANDIDATES = Array.from(
  new Set(
    IS_LOCAL_HOST
      ? ["http://127.0.0.1:4000/api", "http://localhost:4000/api", PRIMARY_API_BASE, "/api"]
      : [
          ...(EFFECTIVE_SUPPORT_API_BASE ? [EFFECTIVE_SUPPORT_API_BASE] : []),
          ...(IS_SUPPORT_HOST
            ? ["https://tellnab.onrender.com/api"]
            : ["https://tellnab.com/api", "https://tellnab.onrender.com/api"]),
        ],
  ),
);

let preferredApiBase: string | null = null;

try {
  preferredApiBase = window.sessionStorage.getItem("tellnab_support_api_base");
  if (IS_SUPPORT_HOST && preferredApiBase?.includes("tellnab.com/api")) {
    preferredApiBase = null;
    window.sessionStorage.removeItem("tellnab_support_api_base");
  }
} catch {
  preferredApiBase = null;
}

function getErrorMessage(payload: ApiError | null, fallback: string) {
  if (!payload) return fallback;
  if (Array.isArray(payload.issues) && payload.issues[0]?.message) {
    return payload.issues[0].message;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return fallback;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return Boolean(
    typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.email === "string" &&
      typeof user.role === "string",
  );
}

function extractAuthUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as {
    user?: unknown;
    data?: { user?: unknown; me?: unknown };
    me?: unknown;
  };

  if (isAuthUser(root.user)) return root.user;
  if (isAuthUser(root.me)) return root.me;
  if (root.data && isAuthUser(root.data.user)) return root.data.user;
  if (root.data && isAuthUser(root.data.me)) return root.data.me;
  return null;
}

function extractAuthToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { token?: unknown; data?: { token?: unknown } };
  if (typeof root.token === "string" && root.token.trim()) return root.token;
  if (root.data && typeof root.data.token === "string" && root.data.token.trim()) {
    return root.data.token;
  }
  return null;
}

export function getStoredSupportToken() {
  try {
    return window.localStorage.getItem(SUPPORT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearStoredSupportToken() {
  try {
    window.localStorage.removeItem(SUPPORT_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function apiRequest<T>(path: string, init?: RequestInit, authToken?: string | null): Promise<T> {
  let response: Response | null = null;
  let payload: unknown = null;
  let lastError: unknown = null;
  let lastBase = "";

  const bases = Array.from(new Set([...(preferredApiBase ? [preferredApiBase] : []), ...API_BASE_CANDIDATES]));

  for (const base of bases) {
    try {
      lastBase = base;
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init?.headers || {}),
        },
        credentials: "include",
      });

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      const isJson = contentType.includes("application/json") || contentType.includes("application/problem+json");

      if (isJson) {
        payload = await response.json().catch(() => null);
      } else {
        payload = null;
      }

      if (response.ok && isJson) {
        preferredApiBase = base;
        try {
          window.sessionStorage.setItem("tellnab_support_api_base", base);
        } catch {
          // ignore
        }
        return payload as T;
      }

      if (response.ok && !isJson) {
        continue;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw new Error(
      `${lastError instanceof Error ? lastError.message : "Support API is not reachable."} (path: ${path})`,
    );
  }

  throw new Error(
    getErrorMessage(payload as ApiError | null, `Support request failed (${response.status}) via ${lastBase}${path}`),
  );
}

export async function loginSupport(email: string, password: string) {
  const payload = await apiRequest<unknown>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const token = extractAuthToken(payload);
  if (token) {
    try {
      window.localStorage.setItem(SUPPORT_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  return {
    user: extractAuthUser(payload),
    token: token || null,
  };
}

export async function getSessionUser(authToken?: string | null) {
  const payload = await apiRequest<unknown>("/auth/me", undefined, authToken || getStoredSupportToken());
  return extractAuthUser(payload);
}

export async function listTickets(authToken?: string | null) {
  return apiRequest<TicketResponse>("/tickets?page=1&page_size=50", undefined, authToken || getStoredSupportToken());
}

export async function createTicket(
  body: { subject: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" },
  authToken?: string | null,
) {
  return apiRequest<{ data: TicketRow }>(
    "/tickets",
    { method: "POST", body: JSON.stringify(body) },
    authToken || getStoredSupportToken(),
  );
}

export async function updateTicket(
  id: string,
  body: { status?: string; priority?: string; assignedAgentId?: string | null },
  authToken?: string | null,
) {
  return apiRequest<{ data: TicketRow }>(
    `/tickets/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
    authToken || getStoredSupportToken(),
  );
}

export async function sendTicketMessage(id: string, body: string, authToken?: string | null) {
  return apiRequest<{ data: TicketMessage }>(
    `/tickets/${encodeURIComponent(id)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
    authToken || getStoredSupportToken(),
  );
}

export async function sendTicketMessagePayload(
  id: string,
  payload: {
    body: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  },
  authToken?: string | null,
) {
  return apiRequest<{ data: TicketMessage }>(
    `/tickets/${encodeURIComponent(id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    authToken || getStoredSupportToken(),
  );
}

export async function listTicketMessages(id: string, authToken?: string | null) {
  return apiRequest<{ data: TicketMessage[] }>(
    `/tickets/${encodeURIComponent(id)}/messages`,
    undefined,
    authToken || getStoredSupportToken(),
  );
}

export async function uploadSupportAttachment(file: File, authToken?: string | null) {
  const endpointCandidates = Array.from(
    new Set([
      ...((window as any).SUPPORT_UPLOAD_ENDPOINT ? [String((window as any).SUPPORT_UPLOAD_ENDPOINT)] : []),
      "/uploads",
      "/support/uploads",
      "/support/attachments",
    ]),
  );

  let lastError: unknown = null;

  for (const endpoint of endpointCandidates) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const bases = Array.from(
        new Set([...(preferredApiBase ? [preferredApiBase] : []), ...API_BASE_CANDIDATES]),
      );

      for (const base of bases) {
        const response = await fetch(`${base}${endpoint}`, {
          method: "POST",
          body: formData,
          headers: {
            ...(authToken || getStoredSupportToken()
              ? { Authorization: `Bearer ${authToken || getStoredSupportToken()}` }
              : {}),
          },
          credentials: "include",
        });

        const contentType = response.headers.get("content-type")?.toLowerCase() || "";
        const isJson = contentType.includes("application/json");
        const json = isJson ? await response.json().catch(() => null) : null;

        if (response.ok && json) {
          const data = (json.data || json) as {
            fileUrl?: string;
            url?: string;
            fileName?: string;
            name?: string;
            fileType?: string;
            type?: string;
            fileSize?: number;
            size?: number;
          };

          const fileUrl = data.fileUrl || data.url;
          if (!fileUrl) continue;

          return {
            fileUrl,
            fileName: data.fileName || data.name || file.name,
            fileType: data.fileType || data.type || file.type || "application/octet-stream",
            fileSize: Number(data.fileSize || data.size || file.size || 0),
          };
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : "Attachment upload failed. Configure SUPPORT_UPLOAD_ENDPOINT to existing upload API.",
  );
}

export async function getRoles(authToken?: string | null) {
  return apiRequest<{ data?: Array<{ key: string; name: string }>; roles?: Array<{ key: string; name: string }> }>(
    "/roles",
    undefined,
    authToken || getStoredSupportToken(),
  );
}

export async function getAdminUsers(authToken?: string | null) {
  return apiRequest<{ users: Array<{ id: string; name: string; email: string; role: string; isActive?: boolean }> }>(
    "/admin/users",
    undefined,
    authToken || getStoredSupportToken(),
  );
}

export async function patchUserRole(userId: string, role: string, authToken?: string | null) {
  try {
    return await apiRequest<{ user: { id: string; role: string } }>(
      `/users/${encodeURIComponent(userId)}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) },
      authToken || getStoredSupportToken(),
    );
  } catch {
    return apiRequest<{ user: { id: string; role: string } }>(
      `/admin/users/${encodeURIComponent(userId)}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) },
      authToken || getStoredSupportToken(),
    );
  }
}
