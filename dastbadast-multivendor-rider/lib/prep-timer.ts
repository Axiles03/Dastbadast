// dastbadast-multivendor-rider/lib/prep-timer.ts
//
// ⭐ ШАГ 3 (NEW): курьер раньше вообще не видел, сколько ресторану осталось
// готовить заказ (statusTimestamps.prepTime запрашивался сервером, но не
// был в GraphQL-запросах rider-приложения — см. lib/api/queries.ts).
// Этот хук — аналог dastbadast-multivendor-store/lib/prep-timer.ts,
// используем тот же паттерн для единообразия между приложениями.

import { useEffect, useState } from "react";

/**
 * Возвращает оставшееся время (мс) до окончания приготовления,
 * обновляется каждые `intervalMs` миллисекунд.
 */
export function usePrepRemainingMs(
  acceptedAt: string | null | undefined,
  prepTimeMin: number | null | undefined,
  intervalMs: number = 1000,
): {
  remainingMs: number;
  elapsedMs: number;
  totalMs: number;
  isLate: boolean;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!acceptedAt || !prepTimeMin) return;
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [acceptedAt, prepTimeMin, intervalMs]);

  if (!acceptedAt || !prepTimeMin) {
    return { remainingMs: 0, elapsedMs: 0, totalMs: 0, isLate: false };
  }

  const totalMs = prepTimeMin * 60 * 1000;
  const acceptedT = new Date(acceptedAt).getTime();
  const elapsedMs = now - acceptedT;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const isLate = elapsedMs > totalMs;

  return { remainingMs, elapsedMs, totalMs, isLate };
}

export function formatPrepRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
