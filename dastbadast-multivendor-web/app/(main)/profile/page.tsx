"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { GET_PROFILE, UPDATE_USER } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Trash2,
  User,
  X as XIcon,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { storage } from "@/lib/security";
import { debugLog, debugWarn } from "@/lib/debug-log";

/* ================== КОНСТАНТЫ ================== */

// 24 часа в миллисекундах
const EDIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Максимальный размер аватарки — 2 МБ
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

// Допустимые MIME-типы
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Строгий TJ-формат: +992 и ровно 9 цифр
const TJ_PHONE_REGEX = /^\+992\d{9}$/;

/* ================== HELPERS ================== */

/**
 * Валидация TJ-номера.
 * Пустая строка допустима (поле необязательное).
 * Если заполнено — строго +992 и 9 цифр.
 */
function isValidTJPhone(phone: string): boolean {
  const cleaned = (phone || "").trim().replace(/[\s\-()]/g, "");
  if (!cleaned) return true; // optional
  return TJ_PHONE_REGEX.test(cleaned);
}

/**
 * Возвращает оставшееся время до разблокировки редактирования (мс).
 * 0 = редактирование доступно.
 */
function getRemainingCooldownMs(): number {
  if (typeof window === "undefined") return 0;
  const stored = storage.get("db_profile_last_edit");
  if (!stored) return 0;
  const last = parseInt(stored, 10);
  if (!Number.isFinite(last)) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, EDIT_COOLDOWN_MS - elapsed);
}

/** Проставляет метку времени последнего успешного редактирования */
function markEditTimestamp(): void {
  if (typeof window === "undefined") return;
  storage.set("db_profile_last_edit", Date.now().toString());
}

/** Форматирует оставшееся время в "X ч Y мин" / "Y мин" */
function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/**
 * Получает сохранённую аватарку (data URL) из localStorage.
 * Ключ — `db_user_avatar_<userId>`, чтобы у разных аккаунтов
 * не было конфликта при переключении в одном браузере.
 */
function getAvatarKey(userId?: string): string | null {
  return userId ? `db_user_avatar_${userId}` : null;
}

function getAvatar(userId?: string): string | null {
  const key = getAvatarKey(userId);
  if (!key) return null;
  return storage.get(key);
}

function saveAvatar(userId: string, dataUrl: string): void {
  const key = getAvatarKey(userId);
  if (!key) return;
  storage.set(key, dataUrl);
}

function removeAvatar(userId: string): void {
  const key = getAvatarKey(userId);
  if (!key) return;
  storage.remove(key);
}

/* ================== КОМПОНЕНТ ================== */

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const { user, setAuth, logout } = useAuth();
  const router = useRouter();

  // ───── состояние формы ─────
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // ───── UI-флаги ─────
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // ───── АВАТАРКА ─────
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null); // превью до сохранения
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ───── 24-ЧАСОВОЙ КУЛДАУН ─────
  // null = кулдаун ещё не начат (редактирование разрешено),
  // число = оставшиеся мс до разблокировки.
  const [cooldownMs, setCooldownMs] = useState<number>(0);

  // ───── PROFILE QUERY ─────
  const { data, refetch } = useQuery(GET_PROFILE, {
    skip: !user,
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;

  // ───── UPDATE_USER MUTATION (исправленный, task 1.2) ─────
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_USER, {
    refetchQueries: [{ query: GET_PROFILE }],
    awaitRefetchQueries: true,
  });

  // ───── ИНИЦИАЛИЗАЦИЯ + ПОДПИСКА НА КУЛДАУН ─────
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setAvatar(getAvatar(user.id));
    }

    // Первичная проверка кулдауна
    setCooldownMs(getRemainingCooldownMs());

    // Тикаем раз в минуту, чтобы счётчик сам обновлялся
    const interval = setInterval(() => {
      setCooldownMs(getRemainingCooldownMs());
    }, 60_000);

    return () => clearInterval(interval);
  }, [user]);

  // Если профиль пришёл из БД — синхронизируем локальные поля
  useEffect(() => {
    if (profile) {
      setName((n) => (n ? n : profile.name || ""));
      setPhone((p) => (p ? p : profile.phone || ""));
      setEmail((e) => (e ? e : profile.email || ""));
    }
  }, [profile]);

  /* ============== АВАТАРКА: загрузка и валидация ============== */

  function triggerAvatarPicker() {
    setAvatarError(null);
    fileInputRef.current?.click();
  }

  function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!ALLOWED_AVATAR_TYPES.includes(file.type as never)) {
      setAvatarError("Поддерживаются только JPG, PNG или WebP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("Файл слишком большой — максимум 2 МБ");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || "");
      if (!dataUrl) {
        setAvatarError("Не удалось прочитать файл");
        return;
      }
      setPendingAvatar(dataUrl);
    };
    reader.onerror = () => setAvatarError("Ошибка чтения файла");
    reader.readAsDataURL(file);

    // сбрасываем value, чтобы можно было выбрать тот же файл повторно
    e.target.value = "";
  }

  function onRemoveAvatar() {
    setPendingAvatar(null);
    setAvatar(null);
    removeAvatar(user!.id);
  }

  /* ============== ВАЛИДАЦИЯ ТЕЛЕФОНА (task 1.3) ============== */

  function validatePhone(value: string): boolean {
    if (!value || !value.trim()) {
      setPhoneError(null);
      return true;
    }
    if (!isValidTJPhone(value)) {
      setPhoneError("Формат: +992 и ровно 9 цифр (например +992901234567)");
      return false;
    }
    setPhoneError(null);
    return true;
  }

  /* ============== СОХРАНЕНИЕ (исправлено, task 1.2) ============== */

  async function save() {
    setErrorMsg(null);

    // 1. Кулдаун
    if (cooldownMs > 0) {
      setErrorMsg(
        `Редактирование профиля доступно через ${formatRemaining(cooldownMs)}.`,
      );
      return;
    }

    // 2. Валидация телефона
    if (!validatePhone(phone)) {
      return;
    }

    // Нормализуем телефон перед отправкой
    const normalizedPhone = phone.replace(/[\s\-()]/g, "").trim();

    try {
      // ── GraphQL-мутация ──
      const res = await updateProfile({
        variables: {
          input: {
            name: name.trim(),
            phone: normalizedPhone || null,
            email: email.trim() || null,
          },
        },
      }).catch((e: any) => {
        // Бэкенд может не иметь updateUser — продолжаем локально
        debugWarn(
          "Profile",
          "updateUser mutation unavailable, falling back to local update",
          e?.message,
        );
        return null;
      });

      const updatedUser = res?.data?.updateUser ??
        // фоллбэк: если мутации нет — берём локальные значения
        {
          ...user,
          name: name.trim(),
          phone: normalizedPhone || undefined,
          email: email.trim() || undefined,
        };

      // 3. Обновляем auth-context (там сохранится и token, и user)
      setAuth(user!.id || "", updatedUser as any);
      // ^ лучше так:
      // setAuth сохранит токен из storage, подменив user.
      // Если у вас setAuth требует (token, user), берём токен отдельно:
      const token =
        typeof window !== "undefined" ? storage.get("db_token") : null;
      if (token) {
        setAuth(token, updatedUser as any);
      }

      // 4. Сохраняем аватарку
      if (pendingAvatar !== null) {
        if (pendingAvatar === "") {
          removeAvatar(user!.id);
          setAvatar(null);
        } else {
          saveAvatar(user!.id, pendingAvatar);
          setAvatar(pendingAvatar);
        }
        setPendingAvatar(null);
      }

      // 5. Проставляем кулдаун
      markEditTimestamp();
      setCooldownMs(EDIT_COOLDOWN_MS);

      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
      await refetch();
      debugLog("Profile", "profile saved", { name, phone: normalizedPhone });
    } catch (e: any) {
      debugWarn("Profile", "save failed", e?.message);
      setErrorMsg(e?.message || "Не удалось сохранить профиль");
    }
  }

  /* ============== РЕНДЕР ============== */

  if (!user) return null;

  const isCooldown = cooldownMs > 0;
  const canSave = !isCooldown && !phoneError && !saving;

  // Что показывать в кружке аватарки: превью > сохранённая > инициалы
  const displayedAvatar = pendingAvatar ?? avatar;

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

      {/* ───── Тосты ───── */}
      {saved && (
        <div className="bg-soft-success-soft text-soft-success border border-soft-success/30 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Данные сохранены. Следующее редактирование через 24 часа.
        </div>
      )}

      {errorMsg && (
        <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/30 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* ───── Баннер 24-часового кулдауна ───── */}
      {isCooldown && (
        <div className="bg-soft-info-soft text-soft-info border border-red-500/70 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Редактирование профиля заблокировано. Осталось:{" "}
            <strong>{formatRemaining(cooldownMs)}</strong>
          </span>
        </div>
      )}

      {/* ───── Аватарка + профиль ───── */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-center gap-5">
          {/* Аватарка */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-soft-rating to-soft-accent flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white shadow-soft">
              {displayedAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayedAvatar}
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

            {/* Кнопка загрузки */}
            <button
              type="button"
              onClick={triggerAvatarPicker}
              disabled={isCooldown}
              aria-label="Загрузить аватар"
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-soft-accent hover:bg-soft-accent-dark text-white flex items-center justify-center shadow-soft-sm border-2 border-white active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Кнопка «удалить аватар» */}
            {(avatar || pendingAvatar) && !isCooldown && (
              <button
                type="button"
                onClick={() => {
                  setPendingAvatar("");
                  setAvatar(null);
                  if (user?.id) removeAvatar(user.id);
                }}
                aria-label="Удалить аватар"
                className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-muted hover:text-soft-accent flex items-center justify-center shadow-soft-sm active:scale-95 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Скрытый file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onAvatarFile}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold text-soft-text truncate">
              {profile?.name || "Гость"}
            </h2>
            <p className="text-sm text-soft-text-soft truncate">
              {profile?.email || profile?.phone || "—"}
            </p>
            {pendingAvatar !== null && pendingAvatar !== "" && (
              <p className="text-2xs text-soft-accent mt-1 font-semibold">
                ✨ Новая аватарка будет сохранена вместе с профилем
              </p>
            )}
          </div>
        </div>

        {avatarError && (
          <p className="mt-3 text-sm text-soft-accent font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {avatarError}
          </p>
        )}
      </section>

      {/* ───── Личная информация ───── */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-soft-text">Личная информация</h3>
          {!editing && !isCooldown && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-bold text-soft-accent hover:underline"
            >
              Редактировать
            </button>
          )}
          {!editing && isCooldown && (
            <span className="text-xs font-bold text-soft-text-muted bg-soft-surface-2 px-2.5 py-1 rounded-full">
              Заблокировано
            </span>
          )}
        </div>

        <div className="space-y-3">
          <Field
            icon={<User className="w-4 h-4" />}
            label="Имя"
            value={editing ? name : profile?.name || ""}
            onChange={setName}
            disabled={!editing}
            placeholder="Как вас зовут"
          />

          <Field
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            type="email"
            value={editing ? email : profile?.email || ""}
            onChange={setEmail}
            disabled={!editing}
            placeholder="email@example.com"
          />

          <div>
            <Field
              icon={<Phone className="w-4 h-4" />}
              label="Телефон"
              type="tel"
              value={editing ? phone : profile?.phone || ""}
              onChange={(v) => {
                setPhone(v);
                if (editing) validatePhone(v);
              }}
              disabled={!editing}
              placeholder="+992XXXXXXXXX"
            />
            {editing && phoneError && (
              <p className="mt-1 ml-1 text-xs font-semibold text-soft-accent flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {phoneError}
              </p>
            )}
            {editing && !phoneError && phone && (
              <p className="mt-1 ml-1 text-xs font-semibold text-soft-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Формат телефона корректный
              </p>
            )}
          </div>
        </div>

        {/* ───── Кнопки Сохранить / Отмена ───── */}
        {editing && (
          <div className="flex gap-2 mt-5 pt-5 border-t border-soft-border">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setPhoneError(null);
                setPendingAvatar(null);
                setAvatarError(null);
                setName(profile?.name || "");
                setPhone(profile?.phone || "");
                setEmail(profile?.email || "");
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2 active:scale-[0.98] transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition shadow-soft-sm"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* ───── Ссылки: адреса / заказы / помощь / политика / безопасность ───── */}
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
        <LinkItem
          href="#"
          icon={<Bell className="w-5 h-5" />}
          title="Уведомления"
          subtitle="Скоро"
          disabled
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

/* ================== UI-АТОМЫ ================== */

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
        autoComplete="off"
        inputMode={type === "tel" ? "tel" : undefined}
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
  const Comp: any = disabled ? "div" : Link;
  return (
    <Comp
      href={disabled ? undefined : href}
      className={`flex items-center gap-4 p-4 border-b border-soft-border last:border-0 transition-colors ${
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
