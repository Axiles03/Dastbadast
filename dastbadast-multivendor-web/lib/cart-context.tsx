// dastbadast-multivendor-web/lib/cart-context.tsx
"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { storage } from "./security";
import { debugLog, debugWarn } from "./debug-log";

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
};

const Ctx = createContext<CartState | null>(null);
const KEY = "db_cart_v4";
const LEGACY_KEYS = ["db_cart_v3", "db_cart_v2", "db_cart"];

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

function readStoredCart(): CartItem[] {
  let raw = storage.get(KEY);
  if (!raw) {
    for (const legacy of LEGACY_KEYS) {
      raw = storage.get(legacy);
      if (raw) {
        debugLog("Cart", "migrated legacy key", legacy);
        break;
      }
    }
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((i) => normalizeItem(i))
      .filter((i): i is CartItem => i !== null);
  } catch {
    return [];
  }
}

/**
 * ГИДРАЦИЯ В MVP:
 * - В браузере сразу читаем localStorage синхронно
 * - SSR тоже работает: на сервере вернётся [], клиент подхватит в useEffect
 * - ВАЖНО: hydrated ВСЕГДА true после первого рендера — это убирает race
 */
function getInitialItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  return readStoredCart();
}

export function CartProvider({ children }: { children: ReactNode }) {
  // 🔧 FIX B2: lazy useState — инициализируется синхронно на клиенте
  const [items, setItems] = useState<CartItem[]>(getInitialItems);
  // В dev React.StrictMode вызывает двойной рендер, но это OK — getInitialItems детерминирован
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    // Гарантируем, что флаг выставлен (для SSR-сценария)
    if (!hydrated) setHydrated(true);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.set(KEY, JSON.stringify(items));
    debugLog("Cart", "saved", {
      count: items.length,
      restaurantId: items[0]?.restaurantId ?? null,
    });
  }, [items, hydrated]);

  const restaurantId = items[0]?.restaurantId ?? null;
  const restaurantName = items[0]?.restaurantName ?? null;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const add = useCallback((i: CartItem): boolean => {
    const item = normalizeItem(i);
    if (!item) {
      debugWarn("Cart", "add rejected — invalid item", i);
      return false;
    }
    debugLog("Cart", "add item", {
      foodId: item.foodId,
      restaurantId: item.restaurantId,
      title: item.title,
    });
    setItems((prev) => {
      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        debugLog("Cart", "switched restaurant — cart replaced");
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
    setItems((prev) =>
      prev.map((p) =>
        p.foodId === foodId ? { ...p, quantity: Math.max(1, qty) } : p,
      ),
    );
  }, []);

  const clear = useCallback(() => {
    debugLog("Cart", "clear");
    setItems([]);
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
