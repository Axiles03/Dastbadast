// dastbadast-multivendor-api/src/utils/geoapify.js
//
// ⭐ ШАГ 3: HTTP-клиент к Geoapify Routing API.
//
// Используется в delivery-price.js для расчёта расстояния ПО ДОРОГАМ (mode=scooter),
// а не по прямой (Haversine). Это даёт более точные километры для цены доставки.
//
// Особенности:
//   - In-memory LRU-кеш на 1 час: один и тот же (from, to) — один HTTP-запрос.
//   - Fallback на Haversine при недоступности API (503, 401, timeout).
//   - Таймаут 5 сек (если долго — fallback, цена доставки не должна задерживать оформление).
//   - Логируем медленные запросы для мониторинга.
//
// ENV: GEOAPIFY_API_KEY должен быть установлен на сервере.
// В .env.example уже добавлен: GEOAPIFY_API_KEY=...
//
// На ШАГЕ 5 подключим Redis (вместо in-memory) для shared cache между инстансами.

import { haversineKm } from "./geo.js";
import { debugLog, debugWarn } from "../debug-log.js";

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || "";
const GEOAPIFY_BASE = "https://api.geoapify.com/v1/routing";
const GEOAPIFY_TIMEOUT_MS = 5000;

// ⭐ In-memory LRU-кеш: Map не имеет LRU, но для MVP достаточно.
// Ключ: `${lng1},${lat1}__${lng2},${lat2}` (с округлением до 5 знаков = ~1м точность)
const ROUTE_CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час
const CACHE_MAX_SIZE = 5000; // ⭐ не более 5000 записей (≈12kб × 5000 = 60МБ max)

/**
 * ⭐ Симметричный ключ: (A→B) == (B→A) — иначе дубликаты кеша.
 * Округляем координаты до 5 знаков (~1.1м), чтобы кеш срабатывал на соседние запросы.
 */
function makeKey(from, to) {
  const round = (n) => Math.round(n * 1e5) / 1e5;
  const a = `${round(from[1])},${round(from[0])}`;
  const b = `${round(to[1])},${round(to[0])}`;
  // Всегда сортируем, чтобы A→B == B→A
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function getCached(key) {
  const entry = ROUTE_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    ROUTE_CACHE.delete(key);
    return null;
  }
  return entry;
}

function setCached(key, distanceM) {
  // ⭐ LRU eviction: если кеш переполнен — удаляем самые старые записи
  if (ROUTE_CACHE.size >= CACHE_MAX_SIZE) {
    // Удаляем 10% самых старых (в порядке Map insertion order)
    const toDelete = Math.floor(CACHE_MAX_SIZE * 0.1);
    const iter = ROUTE_CACHE.keys();
    for (let i = 0; i < toDelete; i++) {
      const k = iter.next().value;
      if (k) ROUTE_CACHE.delete(k);
    }
  }
  ROUTE_CACHE.set(key, { distanceM, at: Date.now() });
}

/**
 * ⭐ ШАГ 3: Запрос к Geoapify Routing API.
 *
 * @param {number[]} from  - [lng, lat]
 * @param {number[]} to    - [lng, lat]
 * @param {string} mode    - 'scooter' | 'car' | 'walk' (для курьеров: scooter)
 * @returns {Promise<number|null>} расстояние в МЕТРАХ, или null при ошибке
 */
export async function fetchRouteDistance(from, to, mode = "scooter") {
  if (!GEOAPIFY_API_KEY) {
    debugWarn("Geoapify", "API key missing — fallback to Haversine");
    return null;
  }
  if (!Array.isArray(from) || from.length < 2) return null;
  if (!Array.isArray(to) || to.length < 2) return null;

  const key = makeKey(from, to);
  const cached = getCached(key);
  if (cached) {
    debugLog("Geoapify", "cache hit", {
      km: (cached.distanceM / 1000).toFixed(2),
    });
    return cached.distanceM;
  }

  const start = Date.now();
  const url = new URL(GEOAPIFY_BASE);
  url.searchParams.set("waypoints", `${from[0]},${from[1]}|${to[0]},${to[1]}`);
  url.searchParams.set("mode", mode);
  url.searchParams.set("apiKey", GEOAPIFY_API_KEY);
  url.searchParams.set("geometry", "false"); // ⭐ нам не нужен polyline, только distance
  url.searchParams.set("units", "meters");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEOAPIFY_TIMEOUT_MS);
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      debugWarn("Geoapify", `HTTP ${res.status} — fallback to Haversine`);
      return null;
    }

    const data = await res.json();
    // Geoapify response: { features: [{ properties: { distance: 1234, ... } }, ...] }
    const distanceM = data?.features?.[0]?.properties?.distance;
    if (typeof distanceM !== "number" || distanceM < 0) {
      debugWarn("Geoapify", "invalid response shape — fallback to Haversine");
      return null;
    }

    const ms = Date.now() - start;
    debugLog("Geoapify", "ok", { km: (distanceM / 1000).toFixed(2), ms });
    if (ms > 2000) {
      debugWarn("Geoapify", "slow response", { ms });
    }

    setCached(key, distanceM);
    return distanceM;
  } catch (e) {
    const ms = Date.now() - start;
    if (e?.name === "AbortError") {
      debugWarn("Geoapify", `timeout after ${ms}ms — fallback to Haversine`);
    } else {
      debugWarn(
        "Geoapify",
        `fetch error (${ms}ms) — fallback to Haversine`,
        e?.message,
      );
    }
    return null;
  }
}

/**
 * ⭐ ШАГ 3: Получить расстояние между двумя точками.
 * Приоритет: кеш → Geoapify API → Haversine fallback.
 * Возвращает ВСЕГДА число (в метрах).
 */
export async function getDistanceMeters(from, to, mode = "scooter") {
  // Сначала проверяем кеш (быстрее всего)
  const key = makeKey(from, to);
  const cached = getCached(key);
  if (cached) return cached.distanceM;

  // Пытаемся через Geoapify
  const fromApi = await fetchRouteDistance(from, to, mode);
  if (typeof fromApi === "number") return fromApi;

  // Fallback на Haversine
  debugLog("Geoapify", "using Haversine fallback");
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  return haversineKm(lat1, lng1, lat2, lng1) * 1000; // → meters
}

/**
 * ⭐ ШАГ 5: аналог fetchRouteDistance(), но с geometry=true — возвращает
 * GeoJSON LineString координат по дорогам (для отображения реального
 * маршрута на карте, а не прямой линии).
 *
 * Отдельный кеш от fetchRouteDistance() (geometry весит намного больше
 * одного числа distance, поэтому TTL/размер держим скромнее — не хотим
 * раздувать память процесса координатами каждого запрошенного маршрута).
 *
 * @param {number[]} from  - [lng, lat]
 * @param {number[]} to    - [lng, lat]
 * @param {string} mode    - 'scooter' | 'car' | 'walk'
 * @returns {Promise<{coordinates: number[][], distanceM: number}|null>}
 *          coordinates — массив [lng, lat] точек маршрута, или null при ошибке.
 */
const GEOMETRY_CACHE = new Map();
const GEOMETRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const GEOMETRY_CACHE_MAX_SIZE = 500;

export async function fetchRouteGeometry(from, to, mode = "scooter") {
  if (!GEOAPIFY_API_KEY) return null;
  if (!Array.isArray(from) || from.length < 2) return null;
  if (!Array.isArray(to) || to.length < 2) return null;

  const key = makeKey(from, to);
  const cached = GEOMETRY_CACHE.get(key);
  if (cached && Date.now() - cached.at < GEOMETRY_CACHE_TTL_MS) {
    return cached.value;
  }

  const url = new URL(GEOAPIFY_BASE);
  url.searchParams.set("waypoints", `${from[0]},${from[1]}|${to[0]},${to[1]}`);
  url.searchParams.set("mode", mode);
  url.searchParams.set("apiKey", GEOAPIFY_API_KEY);
  url.searchParams.set("geometry", "geojson"); // ⭐ на этот раз нужна геометрия
  url.searchParams.set("units", "meters");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEOAPIFY_TIMEOUT_MS);
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      debugWarn(
        "Geoapify",
        `geometry HTTP ${res.status} — fallback to straight line`,
      );
      return null;
    }

    const data = await res.json();
    const feature = data?.features?.[0];
    const distanceM = feature?.properties?.distance;
    // geometry может прийти как LineString или MultiLineString в зависимости
    // от того, был ли маршрут разбит на сегменты у Geoapify.
    const geom = feature?.geometry;
    let coordinates = null;
    if (geom?.type === "LineString" && Array.isArray(geom.coordinates)) {
      coordinates = geom.coordinates;
    } else if (
      geom?.type === "MultiLineString" &&
      Array.isArray(geom.coordinates)
    ) {
      coordinates = geom.coordinates.flat();
    }

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      debugWarn("Geoapify", "geometry: invalid response shape — fallback");
      return null;
    }

    const value = { coordinates, distanceM: distanceM ?? null };

    if (GEOMETRY_CACHE.size >= GEOMETRY_CACHE_MAX_SIZE) {
      const iter = GEOMETRY_CACHE.keys();
      const oldest = iter.next().value;
      if (oldest) GEOMETRY_CACHE.delete(oldest);
    }
    GEOMETRY_CACHE.set(key, { value, at: Date.now() });

    return value;
  } catch (e) {
    if (e?.name === "AbortError") {
      debugWarn("Geoapify", "geometry timeout — fallback to straight line");
    } else {
      debugWarn("Geoapify", "geometry fetch error — fallback", e?.message);
    }
    return null;
  }
}

/**
 * ⭐ ШАГ 3: Статистика кеша (для отладки в логах или админке в будущем).
 */
export function getCacheStats() {
  return {
    size: ROUTE_CACHE.size,
    maxSize: CACHE_MAX_SIZE,
    ttlMs: CACHE_TTL_MS,
    apiKeySet: !!GEOAPIFY_API_KEY,
  };
}

/**
 * ⭐ ШАГ 3: Очистить кеш (для тестов и hot-reload в dev).
 */
export function clearRouteCache() {
  ROUTE_CACHE.clear();
}
