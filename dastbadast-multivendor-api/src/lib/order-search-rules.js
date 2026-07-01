// dastbadast-multivendor-api/src/lib/order-search-rules.js
//
// Единое место настройки правил агрессивного автопоиска курьера.
// Чтобы изменить — правим ТОЛЬКО эти константы.

export const COURIER_SEARCH_RULES = {
  /** Начальный радиус поиска курьеров (в км) */
  INITIAL_PUSH_RADIUS_KM: 5,

  /** Сколько ближайших курьеров уведомляем при первой волне */
  INITIAL_PUSH_COUNT: 5,

  /** Сколько дополнительных курьеров уведомляем при эскалации */
  ESCALATION_EXTRA_COUNT: 2,

  /** Через сколько секунд отправляем вторую волну пушей */
  ESCALATION_DELAY_MS: 90 * 1000, // 90 секунд

  /** Через сколько секунд после PENDING отправляем первую волну курьерам */
  PENDING_PUSH_DELAY_MS: 0, // сразу

  /** Бонус курьеру за быстрый прием заказа (% от deliveryRate) */
  FAST_ACCEPT_BONUS_PCT: 0.05, // +5%
};

/**
 * Вычислить список курьеров для пуша:
 * - находит всех доступных курьеров
 * - сортирует по близости к ресторану (если есть координаты)
 * - лимитирует top-N
 * - помечает "повторная" волна, чтобы не слать дубли тем же
 */
export function buildPushList({
  riders,
  restaurantLocation, // [lng, lat] | null
  count,
  excludeIds = [],
}) {
  if (!ridgers || !ridgers.length) return [];

  // Расчёт дистанции (Haversine, км)
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null)
      return Number.POSITIVE_INFINITY;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const [restLng, restLat] = restaurantLocation || [null, null];

  const filtered = riders.filter(
    (r) => r.available && r.isActive && !excludeIds.includes(String(r._id)),
  );

  const sorted = filtered
    .map((r) => {
      const coords = r.location?.coordinates || [null, null];
      const [lng, lat] = coords;
      const distance =
        restLat != null ? haversineKm(restLat, restLng, lat, lng) : null;
      return { rider: r, distance };
    })
    .sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    })
    .slice(0, count);

  return sorted.map((x) => x.rider);
}
