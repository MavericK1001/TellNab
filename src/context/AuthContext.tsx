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
  setAuthToken,
} from "../services/api";
import { AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  async function logout() {
    await logoutAccount();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
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
