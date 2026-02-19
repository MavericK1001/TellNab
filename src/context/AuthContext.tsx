import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  socialLoginGoogleCode,
  setAuthToken,
} from "../services/api";
import { AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  socialLogin: (
    provider: "google" | "apple",
    options?: { email?: string; name?: string; avatarUrl?: string },
  ) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google sign-in is not available in this environment."),
    );
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google sign-in script.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google sign-in script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function requestGoogleAuthorizationCode() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;
  if (!googleClientId) {
    throw new Error("Google sign-in is not configured for this app.");
  }

  await loadGoogleIdentityScript();

  const initCodeClient = window.google?.accounts?.oauth2?.initCodeClient;
  if (!initCodeClient) {
    throw new Error("Google sign-in is unavailable right now.");
  }

  return new Promise<string>((resolve, reject) => {
    const client = initCodeClient({
      client_id: googleClientId,
      scope: "openid email profile",
      ux_mode: "popup",
      select_account: true,
      callback: (response: { code?: string; error?: string }) => {
        if (response.code) {
          resolve(response.code);
          return;
        }

        reject(new Error(response.error || "Google sign-in was cancelled."));
      },
      error_callback: () => {
        reject(new Error("Google sign-in popup was closed or blocked."));
      },
    });

    client.requestCode();
  });
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient?: (config: {
            client_id: string;
            scope: string;
            ux_mode: "popup" | "redirect";
            select_account?: boolean;
            callback: (response: { code?: string; error?: string }) => void;
            error_callback?: () => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch {
      setAuthToken(undefined);
      setUser(null);
    }
  }

  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      setLoading(false);
      return;
    }

    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const response = await loginAccount({ email, password });
    setUser(response.user);
  }

  async function register(name: string, email: string, password: string) {
    const response = await registerAccount({ name, email, password });
    setUser(response.user);
  }

  async function socialLogin(
    provider: "google" | "apple",
    _options?: { email?: string; name?: string; avatarUrl?: string },
  ) {
    if (provider === "google") {
      const code = await requestGoogleAuthorizationCode();
      const response = await socialLoginGoogleCode({ code });
      setUser(response.user);
      return;
    }

    throw new Error(
      "Apple sign-in requires Apple OAuth configuration and is not yet enabled.",
    );
  }

  async function logout() {
    await logoutAccount();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, socialLogin, register, logout, refresh }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
