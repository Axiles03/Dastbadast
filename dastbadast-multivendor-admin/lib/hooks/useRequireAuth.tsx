"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth, OwnerType } from "@/lib/auth-context";

/**
 * Хук для защиты страниц: редиректит на /login если не залогинен,
 * опционально проверяет роль/права.
 *
 * Возвращает { owner, loading, hasAccess } — компонент сам решает,
 * что показывать при hasAccess === false.
 */
export function useRequireAuth(allowedRoles?: OwnerType[]) {
  const { owner, token, hydrated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (loading) return;
    if (!owner || !token) router.push("/login");
  }, [hydrated, loading, owner, token, router]);

  const hasAccess =
    !!owner &&
    (!allowedRoles ||
      owner.userType === "SUPER_ADMIN" ||
      allowedRoles.includes(owner.userType));

  return { owner, token, loading, hydrated, hasAccess };
}

/**
 * Гейт-компонент. Использование:
 *
 *   <RoleGate allowedRoles={['SUPER_ADMIN', 'DISPATCHER']}>
 *     <DispatchInner />
 *   </RoleGate>
 */
export function RoleGate({
  children,
  allowedRoles,
  fallback,
}: {
  children: React.ReactNode;
  allowedRoles?: OwnerType[];
  fallback?: React.ReactNode;
}) {
  const { owner, token, loading, hydrated, hasAccess } =
    useRequireAuth(allowedRoles);

  if (!hydrated || loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 text-soft-accent animate-spin mx-auto" />
        <p className="text-sm text-soft-text-soft mt-3">Загрузка...</p>
      </div>
    );
  }

  if (!owner || !token) return null;

  if (!hasAccess) {
    return (
      <>
        {fallback ?? (
          <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center max-w-md mx-auto shadow-soft-sm">
            <div className="w-14 h-14 rounded-2xl bg-soft-accent-soft text-soft-accent flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-soft-text mb-2">
              Нет доступа
            </h2>
            <p className="text-sm text-soft-text-soft">
              У вашей роли «{owner.userType}» нет прав на эту страницу.
              <br />
              Обратитесь к суперадмину для изменения прав.
            </p>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
