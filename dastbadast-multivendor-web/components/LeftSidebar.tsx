// dastbadast-multivendor-web/components/LeftSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  User,
  UtensilsCrossed,
  History,
  MapPin,
  HelpCircle,
  Shield,
  LogOut,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useShell } from "@/lib/shell-context";
import { AuthButtons } from "./AuthButtons";

const MENU_ITEMS = [
  { id: "menu", label: "Меню", href: "/", icon: UtensilsCrossed },
  { id: "history", label: "История", href: "/orders", icon: History },
  { id: "address", label: "Адрес", href: "/address", icon: MapPin },
];

// ✅ NEW: реальные ссылки, активные, без «Избранного»
const GENERAL_ITEMS = [
  {
    id: "help",
    label: "Помощь",
    href: "/help",
    icon: HelpCircle,
  },
  {
    id: "privacy",
    label: "Политика конфиденциальности",
    href: "/privacy",
    icon: Shield,
  },
];

function ProfileAvatar({ name }: { name: string }) {
  const initials = (name || "Г")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-soft-rating to-soft-accent flex items-center justify-center text-white font-extrabold text-lg shrink-0 ring-2 ring-white shadow-soft">
      {initials}
    </div>
  );
}

export function LeftSidebar() {
  const { collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen } =
    useShell();
  const { user, logout, mounted } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Закрываем мобильное меню при смене маршрута
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  // Закрываем по Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // До гидратации считаем, что пользователя нет (стабильный SSR-вывод)
  const showUser = mounted && user;

  return (
    <>
      {/* ✅ Backdrop только на мобильных, когда меню открыто */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-soft-dark-2/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen
          bg-soft-surface border-r border-soft-border
          z-50 md:z-40
          flex flex-col
          transition-transform duration-300 ease-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          w-[280px]
          ${collapsed ? "md:w-[80px]" : "md:w-[256px]"}
        `}
        role={mobileMenuOpen ? "dialog" : undefined}
        aria-modal={mobileMenuOpen ? "true" : undefined}
        aria-label="Главное меню"
      >
        {/* Логотип + кнопка закрытия (мобилка) */}
        <div className="px-5 pt-7 pb-6 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 min-w-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-soft-accent to-soft-accent-dark flex items-center justify-center text-white font-extrabold text-lg shadow-soft shrink-0">
              D
            </div>
            <div className="hidden md:flex">
              {(!collapsed || mobileMenuOpen) && (
                <div className="font-extrabold text-lg tracking-tight whitespace-nowrap">
                  <span className="text-soft-text">Dast</span>
                  <span className="text-soft-accent">badast</span>
                </div>
              )}
            </div>
            {/* На мобильном логотип+название ВСЕГДА показаны */}
            <div className="md:hidden">
              <div className="font-extrabold text-lg tracking-tight whitespace-nowrap">
                <span className="text-soft-text">Dast</span>
                <span className="text-soft-accent">badast</span>
              </div>
            </div>
          </Link>

          {/* Кнопка закрытия (только мобилка) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden w-9 h-9 rounded-full bg-soft-surface-2 text-soft-text-soft hover:text-soft-text flex items-center justify-center active:scale-95 transition-all"
            aria-label="Закрыть меню"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* === Профиль / Авторизация === */}
        <div
          className={`px-3 mb-4 ${collapsed ? "md:flex md:justify-center" : ""}`}
        >
          {collapsed && !mobileMenuOpen ? (
            <div className="py-2">
              {showUser ? (
                <Link
                  href="/profile"
                  className="block"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ProfileAvatar name={user!.name} />
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="w-14 h-14 rounded-full bg-soft-surface-2 flex items-center justify-center text-soft-text-soft hover:text-soft-accent transition-colors"
                  aria-label="Войти"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="w-6 h-6" />
                </Link>
              )}
            </div>
          ) : showUser ? (
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-2xl hover:bg-soft-surface-2 transition-colors"
            >
              <ProfileAvatar name={user!.name} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-soft-text truncate">
                  {user!.name}
                </div>
                <div className="text-xs text-soft-text-muted underline">
                  View Profile
                </div>
              </div>
            </Link>
          ) : (
            <div className="p-2">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2 rounded-2xl hover:bg-soft-surface-2 transition-colors mb-2"
              >
                <div className="w-14 h-14 rounded-full bg-soft-surface-2 flex items-center justify-center text-soft-text-soft shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-soft-text">
                    Вы не вошли
                  </div>
                  <div className="text-xs text-soft-text-muted underline">
                    Войти / Регистрация
                  </div>
                </div>
              </Link>
              <AuthButtons />
            </div>
          )}
        </div>

        {/* === МЕНЮ === */}
        <div className="px-3 mb-2">
          {(!collapsed || mobileMenuOpen) && (
            <div className="text-[11px] font-extrabold text-soft-text-muted tracking-widest px-3 mb-2">
              МЕНЮ
            </div>
          )}
          <ul className="space-y-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm transition-colors ${
                      active
                        ? "text-soft-accent bg-soft-accent-soft"
                        : "text-soft-text-soft hover:text-soft-text hover:bg-soft-surface-2"
                    } ${
                      collapsed && !mobileMenuOpen ? "md:justify-center" : ""
                    }`}
                  >
                    {active && !collapsed && !mobileMenuOpen && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-soft-accent" />
                    )}
                    <Icon className="w-5 h-5 shrink-0" />
                    <span
                      className={`${
                        collapsed && !mobileMenuOpen ? "md:hidden" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* === ОБЩЕЕ (Помощь + Политика) === */}
        <div className="px-3 mt-4">
          {(!collapsed || mobileMenuOpen) && (
            <div className="text-[11px] font-extrabold text-soft-text-muted tracking-widest px-3 mb-2">
              ОБЩЕЕ
            </div>
          )}
          <ul className="space-y-1">
            {GENERAL_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm transition-colors ${
                      active
                        ? "text-soft-accent bg-soft-accent-soft"
                        : "text-soft-text-soft hover:text-soft-text hover:bg-soft-surface-2"
                    } ${
                      collapsed && !mobileMenuOpen ? "md:justify-center" : ""
                    }`}
                  >
                    {active && !collapsed && !mobileMenuOpen && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-soft-accent" />
                    )}
                    <Icon className="w-5 h-5 shrink-0" />
                    <span
                      className={`${
                        collapsed && !mobileMenuOpen ? "md:hidden" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex-1" />

        {/* === Выход (только залогиненным) === */}
        {showUser && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={async () => {
                await logout();
                setMobileMenuOpen(false);
                router.push("/");
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm text-soft-text-soft hover:text-soft-accent hover:bg-soft-surface-2 transition-colors ${
                collapsed && !mobileMenuOpen ? "md:justify-center" : ""
              }`}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span
                className={`${collapsed && !mobileMenuOpen ? "md:hidden" : ""}`}
              >
                Выйти
              </span>
            </button>
          </div>
        )}

        {/* === Кнопка сворачивания (только desktop) === */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className="hidden md:flex absolute -right-3 top-28 w-7 h-7 rounded-full bg-soft-text text-white items-center justify-center shadow-soft hover:bg-soft-accent transition-colors z-50"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>
    </>
  );
}
