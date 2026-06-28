import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CartItem = {
  foodId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  description?: string;
  restaurantId: string;
  restaurantName: string;
};

type CartState = {
  items: CartItem[];
  hydrated: boolean;
  add: (i: CartItem) => boolean;
  remove: (foodId: string) => void;
  setQty: (foodId: string, qty: number) => void;
  clear: () => void;
  restaurantId: string | null;
  restaurantName: string | null;
  subtotal: number;
  itemCount: number;
};

const Ctx = createContext<CartState | null>(null);
const KEY = "dbd_client_cart_v1";

function normalizeItem(raw: Partial<CartItem>): CartItem | null {
  const foodId = raw.foodId ? String(raw.foodId) : "";
  const restaurantId = raw.restaurantId ? String(raw.restaurantId) : "";
  const title = raw.title ? String(raw.title) : "";
  const price = Number(raw.price);
  if (!foodId || !restaurantId || !title || Number.isNaN(price)) return null;
  return {
    foodId,
    restaurantId,
    restaurantName: String(raw.restaurantName || ""),
    title,
    price,
    quantity: Math.max(1, Number(raw.quantity) || 1),
    image: raw.image,
    description: raw.description,
  };
}

function getInitialItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  // SSR-safe чтение для Web. На RN читаем из AsyncStorage
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getInitialItems);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate из AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setItems(
              parsed
                .map((i) => normalizeItem(i))
                .filter((i): i is CartItem => i !== null),
            );
          }
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  const restaurantId = items[0]?.restaurantId ?? null;
  const restaurantName = items[0]?.restaurantName ?? null;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const add = useCallback((i: CartItem): boolean => {
    const item = normalizeItem(i);
    if (!item) return false;
    setItems((prev) => {
      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        return [item];
      }
      const found = prev.find((p) => p.foodId === item.foodId);
      if (found) {
        return prev.map((p) =>
          p.foodId === item.foodId
            ? { ...p, quantity: p.quantity + item.quantity }
            : p,
        );
      }
      return [...prev, item];
    });
    return true;
  }, []);

  const remove = useCallback((foodId: string) => {
    setItems((prev) => prev.filter((p) => p.foodId !== foodId));
  }, []);

  const setQty = useCallback((foodId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((p) => p.foodId !== foodId));
      return;
    }
    setItems((prev) =>
      prev.map((p) => (p.foodId === foodId ? { ...p, quantity: qty } : p)),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return (
    <Ctx.Provider
      value={{
        items,
        hydrated,
        add,
        remove,
        setQty,
        clear,
        restaurantId,
        restaurantName,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be inside CartProvider");
  return v;
}
