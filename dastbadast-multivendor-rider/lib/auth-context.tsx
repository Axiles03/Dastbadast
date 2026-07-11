import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Rider = {
  id: string;
  username: string;
  name?: string;
  phone?: string;
  email?: string;
  photo?: string;
};

type AuthState = {
  token: string | null;
  rider: Rider | null;
  setAuth: (t: string, r: Rider) => Promise<void>;
  // ⭐ НОВОЕ: точечное обновление профиля курьера в кэше (после редактирования)
  updateRider: (patch: Partial<Rider>) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("dbd_rider_token");
      const r = await AsyncStorage.getItem("dbd_rider");
      if (t) {
        setToken(t);
        (globalThis as any).__DBD_RIDER_TOKEN__ = t;
      }
      if (r) {
        try {
          setRider(JSON.parse(r));
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const setAuth = async (t: string, r: Rider) => {
    await AsyncStorage.setItem("dbd_rider_token", t);
    await AsyncStorage.setItem("dbd_rider", JSON.stringify(r));
    (globalThis as any).__DBD_RIDER_TOKEN__ = t;
    setToken(t);
    setRider(r);
  };
  // ⭐ НОВОЕ: используется экраном редактирования профиля — обновляет
  // локальный кэш (state + AsyncStorage) после успешного сохранения на сервере.
  const updateRider = async (patch: Partial<Rider>) => {
    setRider((prev) => {
      const next = prev ? { ...prev, ...patch } : (patch as Rider);
      AsyncStorage.setItem("dbd_rider", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const logout = async () => {
    await AsyncStorage.multiRemove(["dbd_rider_token", "dbd_rider"]);
    (globalThis as any).__DBD_RIDER_TOKEN__ = null;
    setToken(null);
    setRider(null);
  };

  return (
    <Ctx.Provider
      value={{ token, rider, setAuth, updateRider, logout, loading }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
