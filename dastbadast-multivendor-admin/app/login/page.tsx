"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { OWNER_LOGIN } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Loader2, AlertCircle, Info } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@dastbadast.tj");
  const [password, setPassword] = useState("admin123");
  const [doLogin, { loading }] = useMutation(OWNER_LOGIN);
  const { setAuth } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await doLogin({
        variables: { input: { email, password } },
      });
      const { token, owner } = res.data.ownerLogin;
      setAuth(token, owner);
      router.push("/dispatch");
    } catch (e: any) {
      setError(e?.message ?? "Не удалось войти");
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center py-10">
      <div className="w-full max-w-md animate-fade-in">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-soft-accent to-soft-accent-dark text-white text-2xl font-extrabold mb-4 shadow-soft">
            D
          </div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Dastbadast <span className="text-soft-accent">·</span> Admin
          </h1>
          <p className="text-sm text-soft-text-soft mt-1.5">
            Панель управления платформой доставки
          </p>
        </div>

        {/* Карточка */}
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-7 shadow-soft-sm">
          <h2 className="text-lg font-extrabold text-soft-text mb-1">
            Вход в систему
          </h2>
          <p className="text-xs text-soft-text-soft mb-5">
            Введите данные администратора
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field
              icon={<Mail className="w-4 h-4" />}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="admin@dastbadast.tj"
            />
            <Field
              icon={<Lock className="w-4 h-4" />}
              label="Пароль"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <div className="flex items-start gap-2 bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-soft-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Входим…
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Войти в систему
                </>
              )}
            </button>
          </form>
        </div>

        {/* Подсказки с тестовыми доступами */}
        <div className="mt-5 space-y-2">
          <div className="bg-soft-info-soft border border-soft-info/20 rounded-2xl p-3 text-xs text-soft-info">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-soft-text">
                  Тестовые роли (после seed):
                </p>
                <p>
                  <span className="font-bold">SUPER_ADMIN:</span>{" "}
                  <code>admin@dastbadast.tj</code> / <code>admin123</code>
                </p>
                <p>
                  <span className="font-bold">DISPATCHER:</span>{" "}
                  <code>dispatch@dastbadast.tj</code> / <code>dispatch123</code>
                </p>
                <p>
                  <span className="font-bold">FINANCE:</span>{" "}
                  <code>finance@dastbadast.tj</code> / <code>finance123</code>
                </p>
                <p>
                  <span className="font-bold">OPERATIONS:</span>{" "}
                  <code>operations@dastbadast.tj</code> /{" "}
                  <code>operations123</code>
                </p>
                <p>
                  <span className="font-bold">SUPPORT:</span>{" "}
                  <code>support@dastbadast.tj</code> / <code>support123</code>
                </p>
                <p>
                  <span className="font-bold">ANALYST:</span>{" "}
                  <code>analyst@dastbadast.tj</code> / <code>analyst123</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-soft-text-soft px-1 flex items-center gap-1.5">
        <span className="text-soft-text-muted">{icon}</span>
        {label}
      </label>
      <input
        type={type}
        className="w-full px-4 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  );
}
