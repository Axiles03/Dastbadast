// dastbadast-multivendor-web/lib/hooks/useHasMounted.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Возвращает false на сервере и при первом клиентском рендере,
 * затем true после монтирования компонента.
 *
 * Решает проблему React Hydration Mismatch: если SSR и первый клиентский
 * рендер выдают разный HTML, React падает с ошибкой
 * "Hydration failed because the initial UI does not match what was
 *  rendered on the server".
 *
 * Использование:
 *   const mounted = useHasMounted();
 *   if (!mounted) return <Skeleton />;     // стабильный SSR-вывод
 *   return <RealComponent data={localStorage.get("x")} />;
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
