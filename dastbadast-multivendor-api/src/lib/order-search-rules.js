// dastbadast-multivendor-api/src/lib/order-search-rules.js
//
// ⭐⭐⭐ ШАГ 3: конфигурация алгоритма диспетчеризации курьеров.
// UberEats-style: первая волна ближайших + эскалация с задержкой +
// hot zone boost + TTL по локации + лимит активных заказов.
//
// Все параметры — ОДНО место. Не размазываем по resolvers.

export const COURIER_SEARCH_RULES = {
  /** Максимальный радиус первой волны (км) */
  INITIAL_PUSH_RADIUS_KM: 5,

  /** Сколько ближайших курьеров получают пуш в первой волне */
  INITIAL_PUSH_COUNT: 5,

  /** Дополнительно при эскалации */
  ESCALATION_EXTRA_COUNT: 2,

  /** Задержка до эскалации (мс). 90 сек = стандарт UberEats */
  ESCALATION_DELAY_MS: 90 * 1000,

  /** TTL для GPS-координат курьера (мс). Если lastLocationAt старше — исключаем. */
  RIDER_LOCATION_TTL_MS: 5 * 60 * 1000,

  /** Максимальное количество активных заказов у одного курьера. Больше — перегрузка. */
  MAX_ACTIVE_ORDERS_PER_RIDER: 2,

  /** Максимум волн поиска (включая эскалацию). После лимита → CANCELLED или ручной. */
  MAX_PUSH_WAVES: 3,

  /** Hot zone: если у ресторана >=N заказов за последний час, расширяем радиус */
  HOT_ZONE_THRESHOLD: 5,
  HOT_ZONE_RADIUS_BOOST: 1.5, // множитель
  HOT_ZONE_MAX_RADIUS_KM: 12,

  /** ⭐⭐⭐ TTL exclude-списка (для защиты от повторных пушей по эскалациям) */
  RIDER_EXCLUDE_TTL_MS: 60 * 60 * 1000, // 1 час
};

/**
 * Ключ exclude-списка для заказа: "cart:exclude:{orderId}"
 * @param {string} orderId
 */
export function excludeKey(orderId) {
  return `cart:exclude:${String(orderId)}`;
}

/**
 * ⭐ Helper: вычислить эффективный радиус с учётом hot zone.
 */
export function effectiveRadius(isHotZone) {
  if (!isHotZone) return COURIER_SEARCH_RULES.INITIAL_PUSH_RADIUS_KM;
  return Math.min(
    COURIER_SEARCH_RULES.INITIAL_PUSH_RADIUS_KM *
      COURIER_SEARCH_RULES.HOT_ZONE_RADIUS_BOOST,
    COURIER_SEARCH_RULES.HOT_ZONE_MAX_RADIUS_KM,
  );
}

/**
 * ⭐ Helper: отсортировать курьеров по дистанции до точки.
 * Использует Haversine (in-memory), потому что GeoJSON-точка
 * курьера может быть [0,0] (fallback) — такие сортируем в конец.
 */
export function rankRidersByDistance(riders, restaurantLat, restaurantLng) {
  const out = [];
  for (const r of riders) {
    const coords = r.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      out.push({ rider: r, distance: Infinity, stale: true });
      continue;
    }
    const [lng, lat] = coords;
    if (lat === 0 && lng === 0) {
      // "нулевые" координаты = нет реального GPS-сигнала
      out.push({ rider: r, distance: Infinity, stale: true });
      continue;
    }
    out.push({
      rider: r,
      distance: haversineKm(lat, lng, restaurantLat, restaurantLng),
      stale: false,
    });
  }
  out.sort((a, b) => {
    if (a.distance === Infinity && b.distance === Infinity) return 0;
    if (a.distance === Infinity) return 1;
    if (b.distance === Infinity) return -1;
    return a.distance - b.distance;
  });
  return out;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
