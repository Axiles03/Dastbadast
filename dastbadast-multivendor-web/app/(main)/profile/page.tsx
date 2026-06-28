"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_PROFILE } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Save,
  LogOut,
  Shield,
  Bell,
  CreditCard,
  MapPin,
  ChevronRight,
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const { data, refetch } = useQuery(GET_PROFILE, {
    skip: !user,
  });
  const profile = data?.profile ?? user;

  const [updateProfile, { loading: saving }] = useMutation(
    require("@/lib/queries").UPDATE_USER ?? require("@/lib/queries").LOGIN,
  );

  const save = async () => {
    try {
      const { UPDATE_USER } = await import("@/lib/queries");
      await updateProfile({ variables: { input: { name, phone, email } } });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    } catch (e) {
      /* noop */
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Настройки профиля
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Управляйте своими данными и предпочтениями
        </p>
      </div>

      {saved && (
        <div className="bg-soft-success-soft text-soft-success border border-soft-success/30 rounded-2xl px-4 py-3 text-sm font-semibold">
          ✅ Данные сохранены
        </div>
      )}

      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-soft-rating to-soft-accent flex items-center justify-center text-white text-2xl font-extrabold shrink-0 ring-4 ring-white shadow-soft">
            {(profile?.name || "Г")
              .split(" ")
              .map((p: string) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold text-soft-text truncate">
              {profile?.name || "Гость"}
            </h2>
            <p className="text-sm text-soft-text-soft truncate">
              {profile?.email || profile?.phone || "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-soft-text">Личная информация</h3>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-bold text-soft-accent hover:underline"
            >
              Редактировать
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(profile?.name || "");
                  setPhone(profile?.phone || "");
                  setEmail(profile?.email || "");
                }}
                className="text-sm font-semibold text-soft-text-soft hover:text-soft-text px-3 py-1.5 rounded-lg"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-sm font-extrabold text-white bg-soft-accent hover:bg-soft-accent-dark px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "…" : "Сохранить"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Field
            icon={<User className="w-4 h-4" />}
            label="Имя"
            value={editing ? name : profile?.name || ""}
            onChange={setName}
            disabled={!editing}
          />
          <Field
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            type="email"
            value={editing ? email : profile?.email || ""}
            onChange={setEmail}
            disabled={!editing}
          />
          <Field
            icon={<Phone className="w-4 h-4" />}
            label="Телефон"
            type="tel"
            value={editing ? phone : profile?.phone || ""}
            onChange={setPhone}
            disabled={!editing}
          />
        </div>
      </section>

      <section className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
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
          href="#"
          icon={<Bell className="w-5 h-5" />}
          title="Уведомления"
          subtitle="Скоро"
          disabled
        />
        <LinkItem
          href="#"
          icon={<Shield className="w-5 h-5" />}
          title="Безопасность"
          subtitle="Скоро"
          disabled
        />
      </section>

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

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-soft-text-soft px-1 flex items-center gap-1.5">
        <span className="text-soft-text-muted">{icon}</span>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent disabled:opacity-70 disabled:cursor-default transition-colors"
      />
    </div>
  );
}

function LinkItem({
  href,
  icon,
  title,
  subtitle,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const Comp: any = disabled ? "div" : "a";
  return (
    <Comp
      href={disabled ? undefined : href}
      className={`flex items-center gap-4 p-4 border-b border-soft-border last:border-0 ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-soft-surface-2 transition-colors cursor-pointer"
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-soft-surface-2 flex items-center justify-center text-soft-text-soft shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-soft-text">{title}</div>
        <div className="text-xs text-soft-text-muted">{subtitle}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-soft-text-muted shrink-0" />
    </Comp>
  );
}
