"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "./AuthModal";

/**
 * Защита страниц, требующих авторизации.
 * На сервере и до гидратации отдаёт одинаковую разметку (заглушку-скелетон),
 * а после mounted=true показывает либо children, либо гостевой CTA.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, mounted } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  // ⬇️ До гидратации — нейтральный стабильный вывод
  if (!mounted) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 bg-soft-surface rounded-lg" />
        <div className="h-4 w-72 bg-soft-surface rounded-lg" />
        <div className="h-32 bg-soft-surface border border-soft-border rounded-2xl mt-6" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-soft-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <GuestGate onOpen={(m) => setAuthMode(m)} />;
  }

  return (
    <>
      {children}
      <AuthModal
        open={authMode !== null}
        onClose={() => setAuthMode(null)}
        initialMode={authMode ?? "login"}
      />
    </>
  );
}

function GuestGate({ onOpen }: { onOpen: (m: "login" | "register") => void }) {
  return (
    <div className="max-w-md mx-auto py-12">
      <div className="bg-soft-surface border border-soft-border rounded-3xl p-8 sm:p-10 text-center shadow-soft-sm">
        <div className="text-6xl mb-4">🔐</div>
        <h2 className="text-2xl font-extrabold text-soft-text mb-2">
          Войдите, чтобы продолжить
        </h2>
        <p className="text-sm text-soft-text-soft mb-6 max-w-sm mx-auto">
          Эта страница доступна только авторизованным пользователям. Войдите в
          свой аккаунт или создайте новый — это займёт меньше минуты.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onOpen("login")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold py-3 rounded-2xl transition-colors"
          >
            <LogIn className="w-4 h-4" /> Войти
          </button>
          <button
            type="button"
            onClick={() => onOpen("register")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-soft-surface border border-soft-border text-soft-text hover:border-soft-accent hover:text-soft-accent font-extrabold py-3 rounded-2xl transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Регистрация
          </button>
        </div>
      </div>
    </div>
  );
}
