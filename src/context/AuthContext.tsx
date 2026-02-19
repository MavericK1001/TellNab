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
  socialLoginAccount,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  function getSocialSubject(provider: "google" | "apple") {
    const key = `tellnab_social_subject_${provider}`;
    const fallback = `${provider}-${Math.random().toString(36).slice(2, 12)}`;

    if (typeof window === "undefined") return fallback;

    try {
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      window.localStorage.setItem(key, fallback);
      return fallback;
    } catch {
      return fallback;
    }
  }

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
    options?: { email?: string; name?: string; avatarUrl?: string },
  ) {
    const response = await socialLoginAccount({
      provider,
      providerSubject: getSocialSubject(provider),
      email: options?.email,
      name: options?.name,
      avatarUrl: options?.avatarUrl,
    });
    setUser(response.user);
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
