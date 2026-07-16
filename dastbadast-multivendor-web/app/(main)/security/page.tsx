// dastbadast-multivendor-web/app/(main)/security/page.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import {
  GET_PROFILE,
  SET_PASSWORD,
  REQUEST_OTP,
  RESET_PASSWORD_WITH_OTP,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";

export default function SecurityPage() {
  return (
    <RequireAuth>
      <SecurityInner />
    </RequireAuth>
  );
}

function SecurityInner() {
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
          <ShieldCheck className="w-6 h-6 text-soft-accent" />
          Безопасность
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Пароль и способы входа в аккаунт
        </p>
      </div>

      <PasswordSection
        hasPassword={!!profile?.hasPassword}
        phone={profile?.phone}
      />
    </div>
  );
}

/* ================== ПАРОЛЬ ================== */

type PwMode = "idle" | "form" | "forgotRequest" | "forgotVerify";

function PasswordSection({
  hasPassword,
  phone,
}: {
  hasPassword: boolean;
  phone?: string;
}) {
  const { setAuth } = useAuth();

  const [mode, setMode] = useState<PwMode>("idle");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [setPasswordMutation, { loading: savingPassword }] = useMutation(
    SET_PASSWORD,
    { refetchQueries: [{ query: GET_PROFILE }] },
  );
  const [requestOtpMutation, { loading: sendingOtp }] =
    useMutation(REQUEST_OTP);
  const [resetPasswordWithOtp, { loading: resettingPassword }] = useMutation(
    RESET_PASSWORD_WITH_OTP,
    { refetchQueries: [{ query: GET_PROFILE }] },
  );

  function resetFields() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setError(null);
  }

  function closeAll() {
    setMode("idle");
    resetFields();
  }

  /* ── прямая установка/смена пароля ── */
  async function submitDirect() {
    setError(null);
    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (hasPassword && !oldPassword) {
      setError("Введите текущий пароль");
      return;
    }
    try {
      await setPasswordMutation({
        variables: {
          input: hasPassword ? { oldPassword, newPassword } : { newPassword },
        },
      });
      setSuccess(hasPassword ? "Пароль изменён" : "Пароль установлен");
      closeAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить пароль");
    }
  }

  /* ── сброс через OTP, если старый пароль забыт ── */
  async function sendForgotOtp() {
    setError(null);
    if (!phone) {
      setError("У аккаунта не указан телефон");
      return;
    }
    try {
      await requestOtpMutation({ variables: { phone, purpose: "RESET" } });
      setMode("forgotVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }

  async function submitForgotOtp() {
    setError(null);
    if (!otpCode || otpCode.length < 4) {
      setError("Введите код из SMS");
      return;
    }
    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    try {
      const res = await resetPasswordWithOtp({
        variables: { input: { phone, code: otpCode, newPassword } },
      });
      const payload = res.data?.resetPasswordWithOtp;
      if (payload?.token && payload?.user) {
        setAuth(payload.token, payload.user);
      }
      setSuccess("Пароль сброшен");
      closeAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сбросить пароль");
    }
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <Lock className="w-4 h-4 text-soft-text-muted" />
          Пароль
        </h3>
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("form")}
            className="text-sm font-bold text-soft-accent hover:underline"
          >
            {hasPassword ? "Изменить" : "Задать пароль"}
          </button>
        )}
      </div>

      <p className="text-xs text-soft-text-soft mb-1">
        {hasPassword
          ? "Пароль задан — можно входить по номеру телефона и паролю."
          : "Пароль не задан. Вход пока доступен только по коду из SMS."}
      </p>

      {success && (
        <p className="mt-2 text-sm font-semibold text-soft-success flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {success}
        </p>
      )}

      {error && mode !== "idle" && (
        <p className="mt-2 text-sm font-semibold text-soft-accent flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      {/* ── форма прямой установки/смены ── */}
      {mode === "form" && (
        <div className="space-y-3 mt-3">
          {hasPassword && (
            <input
              type="password"
              placeholder="Текущий пароль"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
            />
          )}
          <input
            type="password"
            placeholder="Новый пароль (минимум 6 символов)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <input
            type="password"
            placeholder="Повторите новый пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeAll}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submitDirect}
              disabled={savingPassword}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50"
            >
              {savingPassword ? "Сохраняем…" : "Сохранить пароль"}
            </button>
          </div>

          {hasPassword && (
            <button
              type="button"
              onClick={() => {
                resetFields();
                setMode("forgotRequest");
              }}
              className="text-xs font-bold text-soft-text-muted hover:text-soft-accent"
            >
              Забыли текущий пароль? Сбросить по коду из SMS
            </button>
          )}
        </div>
      )}

      {/* ── запрос OTP для сброса ── */}
      {mode === "forgotRequest" && (
        <div className="space-y-3 mt-3">
          <p className="text-sm text-soft-text-soft">
            Отправим код подтверждения на {phone}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeAll}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={sendForgotOtp}
              disabled={sendingOtp}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50"
            >
              {sendingOtp ? "Отправляем…" : "Отправить код"}
            </button>
          </div>
        </div>
      )}

      {/* ── ввод OTP + новый пароль ── */}
      {mode === "forgotVerify" && (
        <div className="space-y-3 mt-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Код из SMS"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <input
            type="password"
            placeholder="Новый пароль (минимум 6 символов)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <input
            type="password"
            placeholder="Повторите новый пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeAll}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-surface-2"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submitForgotOtp}
              disabled={resettingPassword}
              className="flex-1 px-6 py-2.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50"
            >
              {resettingPassword ? "Сохраняем…" : "Сбросить пароль"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
