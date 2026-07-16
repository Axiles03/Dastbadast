// dastbadast-multivendor-web/app/(main)/profile/page.tsx
"use client";

import { useQuery } from "@apollo/client";
import Link from "next/link";
import { GET_PROFILE } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Pencil,
  Shield,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data } = useQuery(GET_PROFILE, {
    skip: !user,
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Профиль
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Ваши данные и настройки аккаунта
        </p>
      </div>

      {/* ───── Уведомление: пароль не задан ───── */}
      {profile && profile.hasPassword === false && (
        <div className="bg-soft-info-soft text-soft-info border border-soft-info/30 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            Пароль не задан. Задайте пароль во вкладке{" "}
            <Link href="/security" className="underline font-extrabold">
              Безопасность
            </Link>
            , чтобы входить не только по коду из SMS.
          </span>
        </div>
      )}

      {/* ───── Карточка профиля (только просмотр) ───── */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-soft-rating to-soft-accent flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white shadow-soft shrink-0">
            {profile?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt="Аватар"
                className="w-full h-full object-cover"
              />
            ) : (
              (profile?.name || "Г")
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold text-soft-text truncate">
              {profile?.name || "Гость"}
            </h2>
            <p className="text-sm text-soft-text-soft truncate">
              {profile?.email || "Email не указан"}
            </p>
            <p className="text-sm text-soft-text-soft truncate">
              {profile?.phone || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* ───── Ссылки ───── */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
        <LinkItem
          href="/edit-profile"
          icon={<Pencil className="w-5 h-5" />}
          title="Редактировать профиль"
          subtitle="Имя, email, телефон, аватар"
        />
        <LinkItem
          href="/security"
          icon={<Lock className="w-5 h-5" />}
          title="Безопасность"
          subtitle="Пароль и вход в аккаунт"
        />
        <LinkItem
          href="/address"
          icon={<MapPin className="w-5 h-5" />}
          title="Мои адреса"
          subtitle="Управление адресами доставки"
        />
        <LinkItem
          href="/orders"
          icon={<CreditCard className="w-5 h-5" />}
          title="История заказов"
          subtitle="Все ваши заказы"
        />
        <LinkItem
          href="/notifications"
          icon={<Bell className="w-5 h-5" />}
          title="Уведомления"
          subtitle="Push-уведомления в браузере"
        />
        <LinkItem
          href="/help"
          icon={<HelpCircle className="w-5 h-5" />}
          title="Помощь"
          subtitle="FAQ и поддержка клиентов"
        />
        <LinkItem
          href="/privacy"
          icon={<Shield className="w-5 h-5" />}
          title="Политика конфиденциальности"
          subtitle="Как мы обрабатываем ваши данные"
        />
      </section>

      {/* ───── Выход ───── */}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="w-full bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Выйти из аккаунта
      </button>
    </div>
  );
}

function LinkItem({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 border-b border-soft-border last:border-0 hover:bg-soft-surface-2 transition-colors cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl bg-soft-surface-2 flex items-center justify-center text-soft-text-soft shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-soft-text">{title}</div>
        <div className="text-xs text-soft-text-muted">{subtitle}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-soft-text-muted shrink-0" />
    </Link>
  );
}
