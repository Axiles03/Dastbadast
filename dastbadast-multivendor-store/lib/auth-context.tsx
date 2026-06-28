import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AuthState = {
  token: string | null;
  restaurant: { id: string; name: string } | null;
  setAuth: (token: string, restaurant: { id: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const Ctx = createContext<AuthState | null>(null);

type AuthProviderProps = { children: ReactNode };

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<AuthState["restaurant"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("dbd_store_token");
      const r = await AsyncStorage.getItem("dbd_store_rest");
      if (t) {
        setToken(t);
        (globalThis as any).__DBD_TOKEN__ = t;
      }
      if (r) {
        try {
          setRestaurant(JSON.parse(r));
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const setAuth = async (t: string, r: { id: string; name: string }) => {
    await AsyncStorage.setItem("dbd_store_token", t);
    await AsyncStorage.setItem("dbd_store_rest", JSON.stringify(r));
    (globalThis as any).__DBD_TOKEN__ = t;
    setToken(t);
    setRestaurant(r);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["dbd_store_token", "dbd_store_rest"]);
    (globalThis as any).__DBD_TOKEN__ = null;
    setToken(null);
    setRestaurant(null);
  };

  return (
    <Ctx.Provider value={{ token, restaurant, setAuth, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
