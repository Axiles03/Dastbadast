"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthRequired({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-soft-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
