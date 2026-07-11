// dastbadast-multivendor-rider/lib/routing.ts
//
// ⭐ Шаг 4: утилиты для маршрута курьера.

import { getLatLng, haversineKm } from "./mapConfig";

/** Точка маршрута [lat, lng] — формат для react-native-maps Polyline */
export type RoutePoint = [number, number];

/**
 * Извлечь координаты [lat, lng] из MongoDB-поля location.
 * Корректно обрабатывает null/undefined на всех уровнях.
 */
export function extractLatLng(
  geo: { location?: { coordinates?: number[] } | null } | null | undefined,
): RoutePoint | null {
  return getLatLng(geo?.location);
}

/** Длина маршрута в километрах (прямая через Haversine между точками) */
export function routeLengthKm(points: RoutePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1][0],
      points[i - 1][1],
      points[i][0],
      points[i][1],
    );
  }
  return total;
}

/** ETA в минутах. Дефолт 25 км/ч (город) */
export function etaMinutes(km: number, avgSpeedKmh: number = 25): number {
  if (km <= 0) return 0;
  return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
}

/** ETA в секундах (для обратного отсчёта) */
export function etaSeconds(km: number, avgSpeedKmh: number = 25): number {
  return Math.round((km / avgSpeedKmh) * 3600);
}

/** Оставшееся расстояние от позиции курьера до конечной точки */
export function remainingKm(
  points: RoutePoint[],
  riderPos: { latitude: number; longitude: number } | null,
): number {
  if (!riderPos || points.length < 2) return 0;
  const end = points[points.length - 1];
  return haversineKm(riderPos.latitude, riderPos.longitude, end[0], end[1]);
}

/** Строит маршрут ресторан → клиент (прямая линия для MVP) */
export function buildRoute(
  pickupGeo: { location?: { coordinates?: number[] } | null } | null,
  deliveryGeo: { location?: { coordinates?: number[] } | null } | null,
): RoutePoint[] {
  const from = extractLatLng(pickupGeo);
  const to = extractLatLng(deliveryGeo);
  if (!from || !to) return [];
  return [from, to];
}

/** Формат: "1.2 км" / "850 м" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} км`;
}
