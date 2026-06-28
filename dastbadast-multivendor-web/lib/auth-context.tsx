"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { storage } from "./security";

type User = { id: string; name: string; email?: string; phone?: string };

type AuthState = {
  token: string | null;
  user: User | null;
  mounted: boolean; // ← NEW
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // ← NEW

  useEffect(() => {
    setMounted(true);
    const t = storage.get("db_token");
    const u = storage.get("db_user");
    if (t) setToken(t);
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  const setAuth = (t: string, u: User) => {
    storage.set("db_token", t);
    storage.set("db_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    storage.remove("db_token");
    storage.remove("db_user");
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ token, user, mounted, setAuth, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
