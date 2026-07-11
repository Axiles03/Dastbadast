// dastbadast-multivendor-web/lib/cart-context.tsx
"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { storage } from "./security";
import { debugLog } from "./debug-log";

export type CartItem = {
  foodId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  description?: string;
  restaurantId: string;
  restaurantName: string;

  basePrice?: number;
  optionsTotal?: number;
  selectedOptions?: Array<{
    groupId: string;
    groupTitle?: string;
    optionId: string;
    optionTitle?: string;
    price?: number;
  }>;
};

// ⭐ NEW: результат add() — чтобы UI мог показать разное сообщение
export type AddResult = "added" | "replaced" | "invalid";

type CartState = {
  items: CartItem[];
  hydrated: boolean;
  add: (i: CartItem) => AddResult;
  remove: (foodId: string) => void;
  setQty: (foodId: string, qty: number) => void;
  clear: () => void;
  restaurantId: string | null;
  restaurantName: string | null;
  subtotal: number;
};

function cartItemKey(item: {
  foodId: string;
  selectedOptions?: Array<{ optionId: string | number }>;
}) {
  const optIds = (item.selectedOptions || [])
    .map((o) => String(o.optionId))
    .sort()
    .join(",");
  return `${item.foodId}:${optIds}`;
}

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
    // ⭐ FIX: раньше эти поля терялись при нормализации — модификаторы
    // пропадали после перезагрузки страницы / чтения из localStorage
    basePrice: Number.isFinite(Number(raw.basePrice))
      ? Number(raw.basePrice)
      : undefined,
    optionsTotal: Number.isFinite(Number(raw.optionsTotal))
      ? Number(raw.optionsTotal)
      : undefined,
    selectedOptions: Array.isArray(raw.selectedOptions)
      ? raw.selectedOptions
      : undefined,
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

function getInitialItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  return readStoredCart();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getInitialItems);
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  useEffect(() => {
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

  const add = useCallback((i: CartItem): AddResult => {
    const item = normalizeItem(i);
    if (!item) return "invalid";

    let replaced = false;
    setItems((prev) => {
      const conflict =
        prev.length > 0 && prev[0].restaurantId !== item.restaurantId;
      if (conflict) replaced = true;
      const base = conflict ? [] : prev;

      const newKey = cartItemKey(item);
      const found = base.find((p) => cartItemKey(p) === newKey);
      if (found) {
        return base.map((p) =>
          cartItemKey(p) === newKey
            ? { ...p, quantity: p.quantity + item.quantity }
            : p,
        );
      }
      return [...base, item];
    });

    return replaced ? "replaced" : "added";
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
