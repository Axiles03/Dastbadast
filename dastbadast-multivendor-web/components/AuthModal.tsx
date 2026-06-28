"use client";
import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { LOGIN, CREATE_USER } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";

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

function Inner({
  onClose,
  initialMode,
}: {
  onClose: () => void;
  initialMode: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const { setAuth } = useAuth();
  const [doLogin, { loading: lLogin, error: eLogin }] = useMutation(LOGIN);
  const [doRegister, { loading: lReg, error: eReg }] = useMutation(CREATE_USER);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEmail = contact.includes("@");
      const variables = (
        mode === "login"
          ? { input: { [isEmail ? "email" : "phone"]: contact, password } }
          : {
              input: { name, [isEmail ? "email" : "phone"]: contact, password },
            }
      ) as any;
      const res =
        mode === "login"
          ? await doLogin({ variables })
          : await doRegister({ variables });
      const payload = res.data?.login ?? res.data?.createUser;
      if (payload) {
        setAuth(payload.token, payload.user);
        onClose();
      }
    } catch {
      /* error handled below */
    }
  };

  const loading = lLogin || lReg;
  const err = eLogin || eReg;

  return (
    <div>
      <div className="flex gap-6 mb-8 border-b border-soft-border pb-2 text-lg font-medium">
        <button
          type="button"
          onClick={() => setMode("login")}
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
          onClick={() => setMode("register")}
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

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl focus:outline-none focus:border-soft-accent transition-colors"
            required
          />
        )}
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email или телефон"
          className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl focus:outline-none focus:border-soft-accent transition-colors"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl focus:outline-none focus:border-soft-accent transition-colors"
          required
          minLength={6}
        />
        {err && (
          <p className="text-soft-accent text-sm bg-soft-accent-soft p-2.5 rounded-lg border border-soft-accent/20">
            {err.message}
          </p>
        )}
        <button
          disabled={loading}
          className="bg-soft-accent text-white font-extrabold w-full h-12 rounded-xl transition-all hover:bg-soft-accent-dark active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none mt-2 flex items-center justify-center"
        >
          {loading
            ? "Загрузка..."
            : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
        </button>
      </form>
    </div>
  );
}
