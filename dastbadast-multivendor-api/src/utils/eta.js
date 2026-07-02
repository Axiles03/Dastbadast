// dastbadast-multivendor-api/src/utils/eta.js
//
// Расчёт ETA (estimated time of arrival) курьера до точки.
//
// MVP-реализация: Haversine + средняя скорость курьера 25 км/ч по городу.
// В production: Google Distance Matrix API или OSRM.

/**
 * Расстояние Haversine между двумя точками в км.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} km
 */
function haversineKm(lat1, lng1, lat2, lng2) {
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
 * ⭐ Расчёт ETA в СЕКУНДАХ.
 * @param {number[]} fromCoords  - [lng, lat] (GeoJSON формат)
 * @param {number[]} toCoords    - [lng, lat]
 * @param {object} options
 * @param {number} options.avgSpeedKmh - средняя скорость (по умолчанию 25)
 * @param {number} options.bufferSec   - буфер на парковку/поиск (по умолчанию 180)
 * @returns {Promise<number|null>} ETA в секундах или null если нет координат
 */
export async function etaForRiderToAddress(fromCoords, toCoords, options = {}) {
  if (
    !Array.isArray(fromCoords) ||
    !Array.isArray(toCoords) ||
    fromCoords.length < 2 ||
    toCoords.length < 2
  ) {
    return null;
  }
  const [lng1, lat1] = fromCoords;
  const [lng2, lat2] = toCoords;
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  const { avgSpeedKmh = 25, bufferSec = 180 } = options;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  const travelSec = (km / avgSpeedKmh) * 3600;
  return Math.round(travelSec + bufferSec);
}
