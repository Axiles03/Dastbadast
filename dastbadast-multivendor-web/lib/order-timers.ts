// dastbadast-multivendor-web/lib/order-timers.ts
//
// Единое место настройки таймаута на клиенте.
// Должно совпадать с PENDING_TIMEOUT_SECONDS в API
// (см. dastbadast-multivendor-api/src/lib/order-timeouts.js).
//
// Чтобы изменить таймаут — правим эти две константы в одном месте.

import * as React from "react";

/** ⭐ Таймаут автоотмены PENDING-заказа (мс). Синхронизирован с API. */
export const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

/**
 * Форматирует оставшееся время в "MM:SS" или "HH:MM:SS".
 * Используется для обратного отсчёта.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Сколько осталось до автоотмены PENDING (мс).
 * 0 = уже истёк.
 */
export function getPendingRemainingMs(
  pendingAt: string | Date | null | undefined,
  now: number = Date.now(),
): number {
  if (!pendingAt) return PENDING_TIMEOUT_MS;
  const t = new Date(pendingAt).getTime();
  return Math.max(0, PENDING_TIMEOUT_MS - (now - t));
}

/**
 * Локальная проверка: PENDING-заказ истёк на клиенте.
 * Используется, чтобы моментально показать "Заказ отменён" UI,
 * не дожидаясь round-trip к API.
 */
export function isLocallyPendingExpired(
  pendingAt: string | Date | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!pendingAt) return false;
  return getPendingRemainingMs(pendingAt, now) <= 0;
}

/**
 * Сколько осталось до конца приготовления (мс).
 * endTime = acceptedAt + prepTime*60*1000.
 */
export function getPrepRemainingMs(
  acceptedAt: string | Date | null | undefined,
  prepTimeMin: number | null | undefined,
  now: number = Date.now(),
): number {
  if (!acceptedAt || !prepTimeMin) return 0;
  const end = new Date(acceptedAt).getTime() + prepTimeMin * 60 * 1000;
  return Math.max(0, end - now);
}

/**
 * Сколько секунд осталось до конца приготовления (0 = уже готово).
 */
export function getPrepRemainingSeconds(
  acceptedAt: string | Date | null | undefined,
  prepTimeMin: number | null | undefined,
  now: number = Date.now(),
): number {
  if (!acceptedAt || !prepTimeMin) return 0;
  const end = new Date(acceptedAt).getTime() + prepTimeMin * 60 * 1000;
  return Math.max(0, Math.floor((end - now) / 1000));
}

/** Общая длительность приготовления в секундах */
export function getPrepTotalSeconds(
  prepTimeMin: number | null | undefined,
): number {
  return (prepTimeMin ?? 0) * 60;
}

/**
 * React-хук: возвращает текущее значение Date.now() каждую секунду.
 * Используется для перерасчёта таймеров каждую секунду.
 *
 *   const now = useNow();
 *   const remaining = endTime - now;
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}
