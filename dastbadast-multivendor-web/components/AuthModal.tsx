// dastbadast-multivendor-web/components/AuthModal.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import {
  REQUEST_OTP,
  REGISTER_WITH_PHONE,
  LOGIN_WITH_OTP,
  LOGIN_WITH_PASSWORD,
  RESET_PASSWORD_WITH_OTP,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";

const PHONE_REGEX = /^\+992\d{9}$/;
const RESEND_COOLDOWN = 60; // секунд

type Mode = "login" | "register" | "forgot";
type LoginMethod = "password" | "otp";
type Step = "phone" | "code";

export function AuthModal({
  open,
  onClose,
  initialMode = "login",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}) {
  if (!open) return null;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen bg-soft-dark-2/60 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm">
      <div className="bg-soft-surface border border-soft-border rounded-3xl p-6 w-full max-w-[400px] relative shadow-soft-xl">
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 text-soft-text-soft hover:text-soft-text transition-colors text-lg z-10"
        >
          ✕
        </button>
        <Inner onClose={onClose} initialMode={initialMode} />
      </div>
    </div>
  );
}

const inputClass =
  "bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl focus:outline-none focus:border-soft-accent transition-colors";
const primaryBtnClass =
  "bg-soft-accent text-white font-extrabold w-full h-12 rounded-xl transition-all hover:bg-soft-accent-dark active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none mt-2 flex items-center justify-center";
const secondaryBtnClass =
  "text-soft-text-soft text-sm hover:text-soft-accent transition-colors";

function Inner({
  onClose,
  initialMode,
}: {
  onClose: () => void;
  initialMode: "login" | "register";
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("+992");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const { setAuth } = useAuth();

  const [doRequestOtp, { loading: lOtp }] = useMutation(REQUEST_OTP);
  const [doRegister, { loading: lReg }] = useMutation(REGISTER_WITH_PHONE);
  const [doLoginOtp, { loading: lLoginOtp }] = useMutation(LOGIN_WITH_OTP);
  const [doLoginPass, { loading: lLoginPass }] =
    useMutation(LOGIN_WITH_PASSWORD);
  const [doReset, { loading: lReset }] = useMutation(RESET_PASSWORD_WITH_OTP);

  const loading = lOtp || lReg || lLoginOtp || lLoginPass || lReset;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMode(initialMode);
    resetFlow();
  }, [initialMode]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function resetFlow() {
    setStep("phone");
    setCode("");
    setPassword("");
    setNewPassword("");
    setFormError(null);
    setCooldown(0);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setLoginMethod("password");
    resetFlow();
  }

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function purposeForMode(m: Mode): "REGISTER" | "LOGIN" | "RESET" {
    if (m === "register") return "REGISTER";
    if (m === "forgot") return "RESET";
    return "LOGIN";
  }

  function validatePhone(): boolean {
    if (!PHONE_REGEX.test(phone)) {
      setFormError(
        "Телефон должен быть в формате +992 и ровно 9 цифр, например +992901234567",
      );
      return false;
    }
    return true;
  }

  async function requestCode() {
    setFormError(null);
    if (!validatePhone()) return;
    try {
      await doRequestOtp({
        variables: { phone, purpose: purposeForMode(mode) },
      });
      setStep("code");
      startCooldown();
    } catch (e: any) {
      setFormError(e?.message || "Не удалось отправить код");
    }
  }

  async function submitLoginPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validatePhone()) return;
    try {
      const res = await doLoginPass({ variables: { phone, password } });
      const payload = res.data?.loginWithPassword;
      if (payload) {
        setAuth(payload.token, payload.user);
        onClose();
      }
    } catch (e: any) {
      setFormError(e?.message || "Ошибка входа");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === "register") {
        const res = await doRegister({ variables: { phone, code } });
        const payload = res.data?.registerWithPhone;
        if (payload) {
          setAuth(payload.token, payload.user);
          onClose();
        }
      } else if (mode === "login") {
        const res = await doLoginOtp({ variables: { phone, code } });
        const payload = res.data?.loginWithOtp;
        if (payload) {
          setAuth(payload.token, payload.user);
          onClose();
        }
      } else if (mode === "forgot") {
        if (newPassword.length < 6) {
          setFormError("Пароль должен содержать минимум 6 символов");
          return;
        }
        const res = await doReset({
          variables: { input: { phone, code, newPassword } },
        });
        const payload = res.data?.resetPasswordWithOtp;
        if (payload) {
          setAuth(payload.token, payload.user);
          onClose();
        }
      }
    } catch (e: any) {
      setFormError(e?.message || "Неверный код");
    }
  }

  const codeStepTitle =
    mode === "register"
      ? "Подтвердите номер"
      : mode === "forgot"
        ? "Новый пароль"
        : "Код из SMS";

  return (
    <div>
      {mode !== "forgot" && (
        <div className="flex gap-6 mb-8 border-b border-soft-border pb-2 text-lg font-medium">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`pb-2 relative transition-colors ${
              mode === "login"
                ? "text-soft-accent"
                : "text-soft-text-soft hover:text-soft-text"
            }`}
          >
            Вход
            {mode === "login" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-soft-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`pb-2 relative transition-colors ${
              mode === "register"
                ? "text-soft-accent"
                : "text-soft-text-soft hover:text-soft-text"
            }`}
          >
            Регистрация
            {mode === "register" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-soft-accent" />
            )}
          </button>
        </div>
      )}

      {mode === "forgot" && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="text-soft-text-soft hover:text-soft-text text-sm mb-3 inline-block"
          >
            ← Назад ко входу
          </button>
          <h2 className="text-lg font-medium">Восстановление пароля</h2>
        </div>
      )}

      {/* ===== ШАГ: ввод телефона ===== */}
      {step === "phone" && (
        <div className="space-y-4">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            placeholder="+992901234567"
            inputMode="tel"
            className={inputClass}
          />

          {mode === "login" && (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setLoginMethod("password")}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  loginMethod === "password"
                    ? "border-soft-accent text-soft-accent"
                    : "border-soft-border text-soft-text-soft"
                }`}
              >
                По паролю
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod("otp")}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  loginMethod === "otp"
                    ? "border-soft-accent text-soft-accent"
                    : "border-soft-border text-soft-text-soft"
                }`}
              >
                По коду из SMS
              </button>
            </div>
          )}

          {mode === "login" && loginMethod === "password" ? (
            <form onSubmit={submitLoginPassword} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className={inputClass}
                required
                minLength={6}
              />
              {formError && <ErrorBox text={formError} />}
              <button disabled={loading} className={primaryBtnClass}>
                {loading ? "Загрузка..." : "Войти"}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className={secondaryBtnClass}
                >
                  Забыли пароль?
                </button>
              </div>
            </form>
          ) : (
            <>
              {formError && <ErrorBox text={formError} />}
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className={primaryBtnClass}
              >
                {loading ? "Отправка..." : "Получить код"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== ШАГ: ввод кода ===== */}
      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-soft-text-soft text-sm">
            {codeStepTitle} — код отправлен на {phone}
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Код из SMS"
            inputMode="numeric"
            maxLength={4}
            className={inputClass}
            required
          />
          {mode === "forgot" && (
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className={inputClass}
              required
              minLength={6}
            />
          )}
          {formError && <ErrorBox text={formError} />}
          <button disabled={loading} className={primaryBtnClass}>
            {loading
              ? "Загрузка..."
              : mode === "register"
                ? "Создать аккаунт"
                : mode === "forgot"
                  ? "Сохранить пароль"
                  : "Войти"}
          </button>
          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => setStep("phone")}
              className={secondaryBtnClass}
            >
              ← Изменить номер
            </button>
            <button
              type="button"
              onClick={requestCode}
              disabled={cooldown > 0 || loading}
              className={`${secondaryBtnClass} disabled:opacity-40 disabled:pointer-events-none`}
            >
              {cooldown > 0
                ? `Повторить через ${cooldown}с`
                : "Отправить код ещё раз"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="text-soft-accent text-sm bg-soft-accent-soft p-2.5 rounded-lg border border-soft-accent/20">
      {text}
    </p>
  );
}
