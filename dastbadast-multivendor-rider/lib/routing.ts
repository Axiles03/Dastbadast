// dastbadast-multivendor-rider/lib/routing.ts
//
// ⭐ Шаг 4: утилиты для маршрута курьера.
// ⭐ Шаг 5: заменили прямую линию на реальный маршрут по дорогам (OSRM).
//
// Используем публичный демо-сервер OSRM (router.project-osrm.org) —
// без API-ключа, без биллинга, достаточно для MVP. Если понадобится
// production-грейд инстанс — просто поменять OSRM_BASE на свой хост
// (self-hosted OSRM/Valhalla), интерфейс остаётся тем же.
//
// Стратегия:
//   - fetchRoadRoute() запрашивает геометрию + длину + время по дорогам;
//   - таймаут 4с и graceful fallback на прямую линию (buildRoute), если
//     OSRM недоступен/долго отвечает — курьер не должен ждать карту;
//   - простой in-memory кеш (округление координат до ~11м), т.к. курьер
//     часто дёргает один и тот же маршрут (ресторан→клиент) при каждом
//     GPS-тике.

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

/**
 * Строит маршрут ресторан → клиент по ПРЯМОЙ линии.
 * ⚠️ Используется только как fallback, когда OSRM недоступен —
 * см. buildRoadRoute() ниже для реального маршрута по дорогам.
 */
export function buildRoute(
  pickupGeo: { location?: { coordinates?: number[] } | null } | null,
  deliveryGeo: { location?: { coordinates?: number[] } | null } | null,
): RoutePoint[] {
  const from = extractLatLng(pickupGeo);
  const to = extractLatLng(deliveryGeo);
  if (!from || !to) return [];
  return [from, to];
}

/* ============== ⭐ ШАГ 5: реальный маршрут по дорогам (OSRM) ============== */

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 4000;

export type RoadRoute = {
  points: RoutePoint[]; // [lat, lng] — для Polyline
  distanceKm: number; // фактическая длина по дорогам
  durationSec: number; // фактическое время в пути (OSRM-оценка по скорости трафика профиля driving)
  source: "osrm" | "fallback"; // "fallback" — если не удалось достучаться до OSRM
};

// ⭐ In-memory кеш: один и тот же (from, to) — один HTTP-запрос за TTL.
// Округление координат до 4 знаков (~11м) — курьер стоит на месте между
// GPS-тиками, не имеет смысла бить кеш из-за GPS-шума.
const ROAD_ROUTE_CACHE = new Map<string, { route: RoadRoute; at: number }>();
const ROAD_ROUTE_CACHE_TTL_MS = 60 * 1000; // 1 минута — маршрут почти не меняется, но допускаем дрейф

function roadRouteCacheKey(from: RoutePoint, to: RoutePoint): string {
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${round(from[0])},${round(from[1])}__${round(to[0])},${round(to[1])}`;
}

/**
 * ⭐ ШАГ 5: запрашивает у OSRM геометрию + метрики реального маршрута
 * по дорогам между двумя точками.
 *
 * @param from [lat, lng]
 * @param to   [lat, lng]
 * @returns RoadRoute или null при ошибке/таймауте (тогда вызывающий код
 *          должен сам сделать fallback на buildRoute()).
 */
export async function fetchRoadRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoadRoute | null> {
  const key = roadRouteCacheKey(from, to);
  const cached = ROAD_ROUTE_CACHE.get(key);
  if (cached && Date.now() - cached.at < ROAD_ROUTE_CACHE_TTL_MS) {
    return cached.route;
  }

  // OSRM ожидает "lng,lat;lng,lat" (GeoJSON-порядок, не [lat,lng])
  const url = `${OSRM_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords: [number, number][] | undefined = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coords) || coords.length < 2) return null;

    // OSRM возвращает [lng, lat] — переворачиваем в [lat, lng] для Polyline
    const points: RoutePoint[] = coords.map(([lng, lat]) => [lat, lng]);

    const result: RoadRoute = {
      points,
      distanceKm: (route.distance ?? 0) / 1000,
      durationSec: Math.round(route.duration ?? 0),
      source: "osrm",
    };

    ROAD_ROUTE_CACHE.set(key, { route: result, at: Date.now() });
    return result;
  } catch {
    // Таймаут, нет сети, невалидный ответ и т.п. — тихо fallback'аемся,
    // не должны блокировать/ломать экран карты курьера.
    return null;
  }
}

/**
 * ⭐ ШАГ 5: строит маршрут ресторан → клиент по дорогам, с fallback на
 * прямую линию, если OSRM недоступен. ВСЕГДА возвращает валидный
 * результат (никогда не бросает и не возвращает null).
 */
export async function buildRoadRoute(
  pickupGeo: { location?: { coordinates?: number[] } | null } | null,
  deliveryGeo: { location?: { coordinates?: number[] } | null } | null,
): Promise<RoadRoute> {
  const from = extractLatLng(pickupGeo);
  const to = extractLatLng(deliveryGeo);
  if (!from || !to) {
    return { points: [], distanceKm: 0, durationSec: 0, source: "fallback" };
  }

  const real = await fetchRoadRoute(from, to);
  if (real) return real;

  // Fallback: прямая линия + Haversine-оценка
  const points = [from, to];
  const distanceKm = routeLengthKm(points);
  return {
    points,
    distanceKm,
    durationSec: etaSeconds(distanceKm),
    source: "fallback",
  };
}

/** Формат: "1.2 км" / "850 м" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} км`;
}
