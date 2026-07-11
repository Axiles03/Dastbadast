// dastbadast-multivendor-api/src/utils/geo.js
//
// ⭐ Гео-утилиты: Haversine, bearing, circle hit-test, ETA, сортировка по дистанции.
// Используется в:
//   - delivery-price.js      (расчёт стоимости доставки — Шаг 1)
//   - order-search.js        (сортировка курьеров по близости к ресторану)
//   - rider.js               (geofence "рядом с клиентом" 500 м)
//   - order.js               (валидация адреса внутри зоны — pointInPolygon)
//
// Изменений в Шаге 1 НЕТ — только doc-комментарий сверху и re-export по желанию.

/**
 * Расстояние Haversine в КМ между двумя точками.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} km
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bearing (азимут) от точки 1 к точке 2, в градусах [0, 360).
 * 0° = север, 90° = восток.
 */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * ⭐ Точка внутри круга радиуса radiusM (в метрах) от центра.
 * Используется для быстрой проверки "рядом ли курьер" без полного Geofencing API.
 */
export function pointInCircle(
  pointLat,
  pointLng,
  centerLat,
  centerLng,
  radiusM,
) {
  const distanceM =
    haversineKm(pointLat, pointLng, centerLat, centerLng) * 1000;
  return distanceM <= radiusM;
}

/**
 * ⭐ ETA в секундах (средняя скорость курьера в городе).
 * @param {number} distanceKm
 * @param {number} [avgSpeedKmh=25]
 * @param {number} [bufferSec=180] - буфер на парковку/поиск
 */
export function etaSeconds(distanceKm, avgSpeedKmh = 25, bufferSec = 180) {
  const travelSec = (distanceKm / avgSpeedKmh) * 3600;
  return Math.round(travelSec + bufferSec);
}

/**
 * ⭐ Сортирует курьеров по расстоянию до точки (для Эшелона 1 поиска).
 * Если у курьера нет координат — distance = Infinity (в конец).
 */
export function sortByDistance(riderCoords, targetLat, targetLng) {
  return riderCoords
    .map((r) => {
      const coords = r.location?.coordinates || [null, null];
      const [lng, lat] = coords;
      const distance =
        lat != null && lng != null
          ? haversineKm(lat, lng, targetLat, targetLng)
          : Infinity;
      return { ...r, distance };
    })
    .sort((a, b) => {
      if (a.distance === Infinity && b.distance === Infinity) return 0;
      if (a.distance === Infinity) return 1;
      if (b.distance === Infinity) return -1;
      return a.distance - b.distance;
    });
}
