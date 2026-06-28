// dastbadast-multivendor-web/components/TopHeader.tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@apollo/client";
import { ChevronDown, MapPin, Menu, ShoppingBag, User, X } from "lucide-react";
import { GET_ADDRESSES } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useShell } from "@/lib/shell-context";

export function TopHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { setCartOpen, setFiltersOpen, mobileMenuOpen, setMobileMenuOpen } =
    useShell();
  const { user, mounted } = useAuth();
  const { items } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const [openAddr, setOpenAddr] = useState(false);

  // До гидратации skip-аем запрос, чтобы SSR и клиент рендерили одинаково
  const { data: addrData } = useQuery(GET_ADDRESSES, {
    skip: !mounted || !user,
  });
  const selected = addrData?.selectedAddress;
  const addrLabel = selected
    ? `${selected.label} · ${selected.address?.split(",")[0] ?? ""}`
    : "Душанбе";

  return (
    <header className="sticky top-0 z-30 bg-soft-bg/90 backdrop-blur-md">
      <div className="px-5 sm:px-8 py-4 flex items-center justify-between gap-3">
        {/* === ЛЕВАЯ ЧАСТЬ: бургер (мобилка) + заголовок === */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* ✅ БУРГЕР-МЕНЮ — только на мобильных */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-text hover:border-soft-accent flex items-center justify-center active:scale-95 transition-all shrink-0"
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="min-w-0">
            {subtitle && (
              <div className="text-xs text-soft-text-muted truncate">
                {subtitle}
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-extrabold text-soft-text tracking-tight truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* === ПРАВАЯ ЧАСТЬ: адрес + корзина === */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenAddr((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-soft-text-soft hover:text-soft-text px-2.5 sm:px-3 py-2 rounded-full hover:bg-soft-surface transition-colors"
            >
              <MapPin className="w-4 h-4 text-soft-accent" />
              <span className="hidden sm:inline max-w-[160px] truncate">
                {addrLabel}
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {openAddr && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpenAddr(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-soft-surface rounded-2xl border border-soft-border shadow-soft-lg p-2 z-50">
                  {addrData?.addresses?.length ? (
                    addrData.addresses.map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setOpenAddr(false)}
                        className="w-full text-left p-3 rounded-xl hover:bg-soft-surface-2"
                      >
                        <div className="text-sm font-bold text-soft-text">
                          {a.label}
                        </div>
                        <div className="text-xs text-soft-text-soft truncate">
                          {a.address}
                        </div>
                      </button>
                    ))
                  ) : (
                    <Link
                      href="/address"
                      onClick={() => setOpenAddr(false)}
                      className="block p-3 rounded-xl hover:bg-soft-surface-2 text-sm text-soft-accent font-semibold"
                    >
                      + Добавить адрес доставки
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>

          <span className="hidden sm:inline w-px h-6 bg-soft-border" />

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-soft-text-soft hover:text-soft-text px-2.5 sm:px-3 py-2 rounded-full hover:bg-soft-surface transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Моя корзина</span>
            {count > 0 && (
              <span className="bg-soft-accent text-white text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
