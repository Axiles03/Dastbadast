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
};

const ShellCtx = createContext<Ctx | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(true);
  // ✅ NEW: state для мобильного меню
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    }),
    [collapsed, cartOpen, filtersOpen, cartExpanded, mobileMenuOpen],
  );

  return <ShellCtx.Provider value={v}>{children}</ShellCtx.Provider>;
}

export function useShell() {
  const c = useContext(ShellCtx);
  if (!c) throw new Error("useShell must be used inside ShellProvider");
  return c;
}
