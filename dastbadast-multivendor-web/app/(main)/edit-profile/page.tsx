// dastbadast-multivendor-web/app/(main)/edit-profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import {
  GET_PROFILE,
  UPDATE_USER,
  UPDATE_AVATAR,
  REQUEST_EMAIL_VERIFICATION,
  VERIFY_EMAIL,
  REQUEST_EMAIL_CHANGE,
  CONFIRM_EMAIL_CHANGE,
  CANCEL_EMAIL_CHANGE,
  REQUEST_PHONE_CHANGE,
  CONFIRM_PHONE_CHANGE,
  CANCEL_PHONE_CHANGE,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  Save,
  Trash2,
  User,
  UserCog,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { storage } from "@/lib/security";

/* ================== КОНСТАНТЫ ================== */

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const TJ_PHONE_REGEX = /^\+992\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ================== HELPERS ================== */

function formatRemaining(untilIso?: string | null): string {
  if (!untilIso) return "";
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "";
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} мин`;
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) {
    const m = totalMin % 60;
    return m === 0 ? `${totalHours} ч` : `${totalHours} ч ${m} мин`;
  }
  const days = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h === 0 ? `${days} дн` : `${days} дн ${h} ч`;
}

/* ================== СТРАНИЦА ================== */

export default function EditProfilePage() {
  return (
    <RequireAuth>
      <EditProfileInner />
    </RequireAuth>
  );
}

function EditProfileInner() {
  const { user } = useAuth();
  const { data } = useQuery(GET_PROFILE, {
    skip: !user,
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-soft-text-muted hover:text-soft-accent mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад в профиль
        </Link>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
          <UserCog className="w-6 h-6 text-soft-accent" />
          Редактировать профиль
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Имя, email, телефон и аватар
        </p>
      </div>

      <AvatarSection
        name={profile?.name}
        avatar={profile?.avatar}
        avatarUnlocksAt={profile?.avatarUnlocksAt}
      />

      <NameSection
        name={profile?.name || ""}
        changesLeft={profile?.nameChangesLeft ?? 2}
        unlocksAt={profile?.nameChangeUnlocksAt}
      />

      <EmailSection
        email={profile?.email}
        verified={!!profile?.emailVerifiedAt}
        pendingEmail={profile?.pendingEmail}
      />

      <PhoneSection
        phone={profile?.phone}
        pendingPhone={profile?.pendingPhone}
      />
    </div>
  );
}

/* ================== АВАТАР — лимит 1 раз / 14 дней ================== */

function AvatarSection({
  name,
  avatar,
  avatarUnlocksAt,
}: {
  name?: string | null;
  avatar?: string | null;
  avatarUnlocksAt?: string | null;
}) {
  const { user, setAuth } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [updateAvatarMutation] = useMutation(UPDATE_AVATAR, {
    refetchQueries: [{ query: GET_PROFILE }],
  });

  const displayedAvatar = avatarPreview ?? avatar ?? null;
  const locked = !!avatarUnlocksAt;

  function triggerPicker() {
    setAvatarError(null);
    document.getElementById("avatar-file-input")?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
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
    reader.onload = async (ev) => {
      const dataUrl = String(ev.target?.result || "");
      if (!dataUrl) {
        setAvatarError("Не удалось прочитать файл");
        return;
      }
      setAvatarPreview(dataUrl);
      setAvatarSaving(true);
      try {
        await updateAvatarMutation({ variables: { avatar: dataUrl } });
        const token =
          typeof window !== "undefined" ? storage.get("db_token") : null;
        if (token && user) {
          setAuth(token, { ...(user as any), avatar: dataUrl });
        }
      } catch (err: any) {
        setAvatarError(err?.message || "Не удалось сохранить аватар");
        setAvatarPreview(null);
      } finally {
        setAvatarSaving(false);
      }
    };
    reader.onerror = () => setAvatarError("Ошибка чтения файла");
    reader.readAsDataURL(file);
  }

  async function onRemove() {
    setAvatarError(null);
    setAvatarPreview(null);
    setAvatarSaving(true);
    try {
      await updateAvatarMutation({ variables: { avatar: null } });
      const token =
        typeof window !== "undefined" ? storage.get("db_token") : null;
      if (token && user) {
        setAuth(token, { ...(user as any), avatar: null });
      }
    } catch (err: any) {
      setAvatarError(err?.message || "Не удалось удалить аватар");
    } finally {
      setAvatarSaving(false);
    }
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
      <h3 className="font-extrabold text-soft-text mb-4">Аватар</h3>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-soft-rating to-soft-accent flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white shadow-soft">
            {displayedAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedAvatar}
                alt="Аватар"
                className={`w-full h-full object-cover ${avatarSaving ? "opacity-50" : ""}`}
              />
            ) : (
              (name || "Г")
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            )}
            {avatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={triggerPicker}
            disabled={avatarSaving || locked}
            aria-label="Загрузить аватар"
            title={
              locked
                ? `Следующая смена доступна через ${formatRemaining(avatarUnlocksAt)}`
                : "Загрузить аватар"
            }
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-soft-accent hover:bg-soft-accent-dark text-white flex items-center justify-center shadow-soft-sm border-2 border-white active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
          </button>

          {displayedAvatar && !avatarSaving && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить аватар"
              className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-muted hover:text-soft-accent flex items-center justify-center shadow-soft-sm active:scale-95 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <input
            id="avatar-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFile}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 min-w-0">
          {avatarSaving && (
            <p className="text-xs text-soft-accent font-semibold">
              Сохраняем аватар…
            </p>
          )}
          {!avatarSaving && locked && (
            <p className="text-xs text-soft-text-muted font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Смена аватара — через {formatRemaining(avatarUnlocksAt)}
            </p>
          )}
          {!avatarSaving && !locked && (
            <p className="text-xs text-soft-text-muted">
              JPG, PNG или WebP, до 2 МБ. Менять можно раз в 14 дней.
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
  );
}

/* ================== ИМЯ — лимит 2 раза / 14 дней ================== */

function NameSection({
  name,
  changesLeft,
  unlocksAt,
}: {
  name: string;
  changesLeft: number;
  unlocksAt?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  const [updateProfile, { loading: saving }] = useMutation(UPDATE_USER, {
    refetchQueries: [{ query: GET_PROFILE }],
    awaitRefetchQueries: true,
  });

  const locked = changesLeft <= 0 && !!unlocksAt;

  async function save() {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Имя не может быть пустым");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    try {
      await updateProfile({ variables: { input: { name: trimmed } } });
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить имя");
    }
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <User className="w-4 h-4 text-soft-text-muted" />
          Имя
        </h3>
        {!editing && !locked && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-bold text-soft-accent hover:underline"
          >
            Изменить
          </button>
        )}
      </div>

      {!editing ? (
        <div>
          <p className="text-sm font-semibold text-soft-text">{name || "—"}</p>
          <p className="text-xs text-soft-text-muted mt-1">
            {locked
              ? `Лимит смен исчерпан. Доступно снова через ${formatRemaining(unlocksAt)}`
              : `Осталось смен: ${changesLeft} из 2 (окно 14 дней)`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Как вас зовут"
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(name);
                setError(null);
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                "Сохраняем…"
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm font-semibold text-soft-success flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Имя изменено
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-semibold text-soft-accent flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </section>
  );
}

/* ================== EMAIL — смена всегда, с подтверждением нового адреса ================== */

type EmailMode = "idle" | "verifyCurrent" | "changeInput" | "changeVerify";

function EmailSection({
  email,
  verified,
  pendingEmail,
}: {
  email?: string | null;
  verified: boolean;
  pendingEmail?: string | null;
}) {
  const [mode, setMode] = useState<EmailMode>(
    pendingEmail ? "changeVerify" : "idle",
  );
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requestVerification, { loading: sendingVerify }] = useMutation(
    REQUEST_EMAIL_VERIFICATION,
  );
  const [verifyEmailMutation, { loading: verifyingCurrent }] = useMutation(
    VERIFY_EMAIL,
    { refetchQueries: [{ query: GET_PROFILE }] },
  );
  const [requestChange, { loading: sendingChange }] =
    useMutation(REQUEST_EMAIL_CHANGE);
  const [confirmChange, { loading: confirming }] = useMutation(
    CONFIRM_EMAIL_CHANGE,
    { refetchQueries: [{ query: GET_PROFILE }] },
  );
  const [cancelChange] = useMutation(CANCEL_EMAIL_CHANGE, {
    refetchQueries: [{ query: GET_PROFILE }],
  });

  function reset() {
    setMode(pendingEmail ? "changeVerify" : "idle");
    setNewEmail("");
    setCode("");
    setError(null);
  }

  async function verifyCurrentSend() {
    setError(null);
    try {
      await requestVerification();
      setMode("verifyCurrent");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }

  async function verifyCurrentSubmit() {
    setError(null);
    if (!code) {
      setError("Введите код из письма");
      return;
    }
    try {
      await verifyEmailMutation({ variables: { code } });
      setSuccess("Email подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить");
    }
  }

  async function submitNewEmail() {
    setError(null);
    if (!EMAIL_REGEX.test(newEmail.trim())) {
      setError("Некорректный email");
      return;
    }
    try {
      await requestChange({ variables: { newEmail: newEmail.trim() } });
      setMode("changeVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }

  async function submitChangeCode() {
    setError(null);
    if (!code) {
      setError("Введите код из письма");
      return;
    }
    try {
      await confirmChange({ variables: { code } });
      setSuccess("Email изменён и подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить email");
    }
  }

  async function cancel() {
    setError(null);
    try {
      await cancelChange();
      reset();
    } catch (e: any) {
      setError(e?.message || "Не удалось отменить заявку");
    }
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <Mail className="w-4 h-4 text-soft-text-muted" />
          Email
        </h3>
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("changeInput")}
            className="text-sm font-bold text-soft-accent hover:underline"
          >
            Изменить
          </button>
        )}
      </div>

      <p className="text-sm font-semibold text-soft-text">
        {email || "Не указан"}
      </p>

      {email &&
        mode === "idle" &&
        (verified ? (
          <p className="mt-1 text-xs font-semibold text-soft-success flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Подтверждён
          </p>
        ) : (
          <button
            type="button"
            onClick={verifyCurrentSend}
            disabled={sendingVerify}
            className="mt-1 text-xs font-bold text-soft-accent hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {sendingVerify ? "Отправляем…" : "Не подтверждён — отправить код"}
          </button>
        ))}

      {pendingEmail && mode === "changeVerify" && (
        <p className="mt-2 text-xs text-soft-text-soft">
          Ожидает подтверждения: <strong>{pendingEmail}</strong>
        </p>
      )}

      {mode === "verifyCurrent" && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Код из письма"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="px-3 py-2 bg-soft-surface-2 border border-soft-border rounded-xl text-sm w-32 focus:outline-none focus:border-soft-accent"
          />
          <button
            type="button"
            onClick={verifyCurrentSubmit}
            disabled={verifyingCurrent}
            className="px-4 py-2 bg-soft-accent hover:bg-soft-accent-dark text-white font-bold rounded-xl text-xs disabled:opacity-50"
          >
            {verifyingCurrent ? "…" : "Подтвердить"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-bold text-soft-text-muted"
          >
            Отмена
          </button>
        </div>
      )}

      {mode === "changeInput" && (
        <div className="space-y-3 mt-3">
          <input
            type="email"
            placeholder="Новый email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submitNewEmail}
              disabled={sendingChange}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50"
            >
              {sendingChange
                ? "Отправляем код…"
                : "Отправить код на новый email"}
            </button>
          </div>
        </div>
      )}

      {mode === "changeVerify" && (
        <div className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Код из письма"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="px-3 py-2 bg-soft-surface-2 border border-soft-border rounded-xl text-sm w-32 focus:outline-none focus:border-soft-accent"
            />
            <button
              type="button"
              onClick={submitChangeCode}
              disabled={confirming}
              className="px-4 py-2 bg-soft-accent hover:bg-soft-accent-dark text-white font-bold rounded-xl text-xs disabled:opacity-50"
            >
              {confirming ? "…" : "Подтвердить"}
            </button>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="text-xs font-bold text-soft-text-muted hover:text-soft-accent"
          >
            Отменить смену email
          </button>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm font-semibold text-soft-success flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {success}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-semibold text-soft-accent flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </section>
  );
}

/* ================== ТЕЛЕФОН — смена всегда, с подтверждением OTP ================== */

type PhoneMode = "idle" | "changeInput" | "changeVerify";

function PhoneSection({
  phone,
  pendingPhone,
}: {
  phone?: string | null;
  pendingPhone?: string | null;
}) {
  const [mode, setMode] = useState<PhoneMode>(
    pendingPhone ? "changeVerify" : "idle",
  );
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requestChange, { loading: sending }] =
    useMutation(REQUEST_PHONE_CHANGE);
  const [confirmChange, { loading: confirming }] = useMutation(
    CONFIRM_PHONE_CHANGE,
    { refetchQueries: [{ query: GET_PROFILE }] },
  );
  const [cancelChange] = useMutation(CANCEL_PHONE_CHANGE, {
    refetchQueries: [{ query: GET_PROFILE }],
  });

  function reset() {
    setMode(pendingPhone ? "changeVerify" : "idle");
    setNewPhone("");
    setCode("");
    setError(null);
  }

  async function submitNewPhone() {
    setError(null);
    const cleaned = newPhone.replace(/[\s\-()]/g, "").trim();
    if (!TJ_PHONE_REGEX.test(cleaned)) {
      setError("Формат: +992 и ровно 9 цифр (например +992901234567)");
      return;
    }
    try {
      await requestChange({ variables: { newPhone: cleaned } });
      setMode("changeVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }

  async function submitCode() {
    setError(null);
    if (!code) {
      setError("Введите код из SMS");
      return;
    }
    try {
      await confirmChange({ variables: { code } });
      setSuccess("Номер изменён и подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить номер");
    }
  }

  async function cancel() {
    setError(null);
    try {
      await cancelChange();
      reset();
    } catch (e: any) {
      setError(e?.message || "Не удалось отменить заявку");
    }
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <Phone className="w-4 h-4 text-soft-text-muted" />
          Телефон
        </h3>
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("changeInput")}
            className="text-sm font-bold text-soft-accent hover:underline"
          >
            Изменить
          </button>
        )}
      </div>

      <p className="text-sm font-semibold text-soft-text">{phone || "—"}</p>

      {pendingPhone && mode === "changeVerify" && (
        <p className="mt-2 text-xs text-soft-text-soft">
          Ожидает подтверждения: <strong>{pendingPhone}</strong>
        </p>
      )}

      {mode === "changeInput" && (
        <div className="space-y-3 mt-3">
          <input
            type="tel"
            placeholder="+992XXXXXXXXX"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submitNewPhone}
              disabled={sending}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50"
            >
              {sending ? "Отправляем код…" : "Отправить код на новый номер"}
            </button>
          </div>
        </div>
      )}

      {mode === "changeVerify" && (
        <div className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Код из SMS"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="px-3 py-2 bg-soft-surface-2 border border-soft-border rounded-xl text-sm w-32 focus:outline-none focus:border-soft-accent"
            />
            <button
              type="button"
              onClick={submitCode}
              disabled={confirming}
              className="px-4 py-2 bg-soft-accent hover:bg-soft-accent-dark text-white font-bold rounded-xl text-xs disabled:opacity-50"
            >
              {confirming ? "…" : "Подтвердить"}
            </button>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="text-xs font-bold text-soft-text-muted hover:text-soft-accent"
          >
            Отменить смену номера
          </button>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm font-semibold text-soft-success flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {success}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-semibold text-soft-accent flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </section>
  );
}
