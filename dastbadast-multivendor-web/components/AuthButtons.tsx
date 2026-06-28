"use client";

import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { AuthModal } from "./AuthModal";

export function AuthButtons() {
  const [mode, setMode] = useState<"login" | "register" | null>(null);

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className="w-full flex items-center justify-center gap-2 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold text-sm py-3 rounded-2xl transition-colors"
        >
          <LogIn className="w-4 h-4" /> Войти
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className="w-full flex items-center justify-center gap-2 bg-soft-surface border border-soft-border text-soft-text font-extrabold text-sm py-3 rounded-2xl hover:border-soft-accent hover:text-soft-accent transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Регистрация
        </button>
      </div>
      <AuthModal
        open={mode !== null}
        onClose={() => setMode(null)}
        initialMode={mode ?? "login"}
      />
    </>
  );
}
