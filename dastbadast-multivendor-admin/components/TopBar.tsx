"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, ChevronRight } from "lucide-react";
import { NAV_ACCESS, NavKey } from "@/lib/page-access";

export function TopBar() {
  const { owner, logout, loading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Пункты меню в порядке отображения
  const NAV_ITEMS: { key: NavKey; href: string; label: string }[] = [
    { key: "dashboard", href: "/dashboard", label: "Главная" },
    { key: "dispatch", href: "/dispatch", label: "Мониторинг" },
    { key: "restaurants", href: "/restaurants", label: "Рестораны" },
    { key: "riders", href: "/riders", label: "Курьеры" },
    { key: "zones", href: "/zones", label: "Зоны" },
    { key: "users", href: "/users", label: "Пользователи" },
    { key: "configuration", href: "/configuration", label: "Настройки" },
    { key: "accounting", href: "/accounting", label: "Бухгалтерия" },
    { key: "admins", href: "/admins", label: "Команда" },
  ];

  // Фильтруем пункты меню по роли
  const visibleNav = owner
    ? NAV_ITEMS.filter((item) => hasRole(NAV_ACCESS[item.key]))
    : [];

  // Точное сравнение маршрута (без startsWith)
  const isActive = (href: string) => pathname === href;

  const linkClass = (href: string) => {
    const base =
      "text-sm font-bold px-3.5 py-2 rounded-full transition-colors whitespace-nowrap";
    return isActive(href)
      ? `${base} bg-soft-accent-soft text-soft-accent`
      : `${base} text-soft-text-soft hover:text-soft-text hover:bg-soft-surface-2`;
  };

  return (
    <header className="bg-soft-surface/80 backdrop-blur-md border-b border-soft-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Левая часть */}
        <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto scrollbar-hide">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 pr-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soft-accent to-soft-accent-dark flex items-center justify-center text-white font-extrabold text-sm shadow-soft-sm">
              D
            </div>
            <span className="font-extrabold text-base tracking-tight hidden sm:inline">
              <span className="text-soft-text">Dast</span>
              <span className="text-soft-accent">badast</span>
              <span className="text-soft-text-muted font-medium text-sm ml-1">
                · Admin
              </span>
            </span>
          </Link>

          {owner && visibleNav.length > 0 && (
            <nav className="flex items-center gap-1">
              {visibleNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Правая часть */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="w-28 h-9 bg-soft-surface-2 rounded-full animate-pulse" />
          ) : owner ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 bg-soft-surface-2 border border-soft-border px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-soft-success animate-pulse-soft" />
                <span className="text-xs text-soft-text font-semibold max-w-[200px] truncate">
                  {owner.email}
                </span>
                <RoleBadge role={owner.userType} />
              </div>

              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="inline-flex items-center gap-1.5 text-soft-accent bg-soft-accent-soft hover:bg-soft-accent hover:text-white border border-soft-accent/20 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Выйти
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-white bg-soft-accent hover:bg-soft-accent-dark px-4 py-1.5 rounded-full text-sm font-extrabold transition-colors shadow-soft-sm"
            >
              Войти
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPER_ADMIN: "bg-soft-accent text-white",
    DISPATCHER: "bg-soft-info text-white",
    FINANCE: "bg-soft-success text-white",
    OPERATIONS: "bg-soft-purple text-white",
    SUPPORT: "bg-soft-rating text-white",
    ANALYST: "bg-soft-text-muted text-white",
  };
  return (
    <span
      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
        styles[role] || styles.ANALYST
      }`}
    >
      {role.replace("_", " ")}
    </span>
  );
}
