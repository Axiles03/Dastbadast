// dastbadast-multivendor-web/lib/shell-context.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

type DeliveryBreakdown = {
  base: number;
  perKm: number;
  distanceKm: number;
  total: number;
  isOverBase: boolean;
};

type Ctx = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  cartExpanded: boolean;
  setCartExpanded: (v: boolean) => void;
  // ✅ NEW: мобильное меню-сайдбар
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  // ⭐ ШАГ 5: цена доставки (синхронизируется с cart-page → cart-drawer)
  deliveryFee: number;
  setDeliveryFee: (v: number) => void;
  deliveryBreakdown: DeliveryBreakdown | null;
  setDeliveryBreakdown: (v: DeliveryBreakdown | null) => void;
  restaurantFilters: RestaurantFilters;
  setRestaurantFilters: (v: RestaurantFilters) => void;
};

export type RestaurantFilters = {
  sortBy: "rating" | "deliveryTime" | "minimumOrder";
  maxMinimumOrder: number | null; // null = любой
  maxDeliveryTime: number | null; // в минутах, null = не важно
  nearest: boolean;
};

export const DEFAULT_RESTAURANT_FILTERS: RestaurantFilters = {
  sortBy: "rating",
  maxMinimumOrder: null,
  maxDeliveryTime: null,
  nearest: false,
};

const ShellCtx = createContext<Ctx | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(true);
  // ✅ NEW: state для мобильного меню
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // ⭐ ШАГ 5: цена доставки и разбивка (рассчитывается в cart-page, отображается в drawer)
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryBreakdown, setDeliveryBreakdown] =
    useState<DeliveryBreakdown | null>(null);
  const [restaurantFilters, setRestaurantFilters] = useState<RestaurantFilters>(
    DEFAULT_RESTAURANT_FILTERS,
  );
  const v = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      cartOpen,
      setCartOpen,
      filtersOpen,
      setFiltersOpen,
      cartExpanded,
      setCartExpanded,
      mobileMenuOpen,
      setMobileMenuOpen,
      deliveryFee,
      setDeliveryFee,
      deliveryBreakdown,
      setDeliveryBreakdown,
      restaurantFilters,
      setRestaurantFilters,
    }),
    [
      collapsed,
      cartOpen,
      filtersOpen,
      cartExpanded,
      mobileMenuOpen,
      deliveryFee,
      deliveryBreakdown,
      restaurantFilters,
    ],
  );

  return <ShellCtx.Provider value={v}>{children}</ShellCtx.Provider>;
}

export function useShell() {
  const c = useContext(ShellCtx);
  if (!c) throw new Error("useShell must be used inside ShellProvider");
  return c;
}
