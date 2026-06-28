import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = { id: string; name: string; email?: string; phone?: string };

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (t: string, u: User) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("dbd_client_token");
      const u = await AsyncStorage.getItem("dbd_client_user");
      if (t) {
        setToken(t);
        (globalThis as any).__DBD_CLIENT_TOKEN__ = t;
      }
      if (u) {
        try {
          setUser(JSON.parse(u));
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const setAuth = async (t: string, u: User) => {
    await AsyncStorage.setItem("dbd_client_token", t);
    await AsyncStorage.setItem("dbd_client_user", JSON.stringify(u));
    (globalThis as any).__DBD_CLIENT_TOKEN__ = t;
    setToken(t);
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["dbd_client_token", "dbd_client_user"]);
    (globalThis as any).__DBD_CLIENT_TOKEN__ = null;
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ token, user, setAuth, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
