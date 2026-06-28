// dastbadast-multivendor-web/components/SoftShell.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ShellProvider, useShell } from "@/lib/shell-context";
import { LeftSidebar } from "./LeftSidebar";
import { TopHeader } from "./TopHeader";
import { CartDrawer } from "./CartDrawer";
import { FiltersDrawer } from "./FiltersDrawer";
import { getPageMeta } from "@/lib/page-titles";

export function SoftShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <ShellProvider>
      <ShellLayout title={title} subtitle={subtitle}>
        {children}
      </ShellLayout>
    </ShellProvider>
  );
}

function ShellLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const {
    collapsed,
    cartOpen,
    filtersOpen,
    setCartOpen,
    setFiltersOpen,
    setMobileMenuOpen,
  } = useShell();

  const pathname = usePathname();
  const meta = getPageMeta(pathname);
  const finalTitle = title ?? meta.title;
  const finalSubtitle = subtitle ?? meta.subtitle;

  useEffect(() => {
    setCartOpen(false);
    setFiltersOpen(false);
    setMobileMenuOpen(false); // ✅ закрываем мобильное меню при смене маршрута
  }, [pathname, setCartOpen, setFiltersOpen, setMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-soft-bg">
      <LeftSidebar />

      <div
        className={`transition-all duration-300 ${
          // ✅ На мобильных нет отступа (сайдбар выезжает поверх)
          // ✅ На md+ отступ для зафиксированного сайдбара
          collapsed ? "md:pl-[80px]" : "md:pl-[256px]"
        }`}
      >
        <TopHeader title={finalTitle} subtitle={finalSubtitle} />
        <main className="px-5 sm:px-8 py-6 sm:py-8 min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <FiltersDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
