// dastbadast-multivendor-api/src/utils/geo.js

/**
 * Расстояние Haversine в КМ между двумя точками.
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
 */
export function etaSeconds(distanceKm, avgSpeedKmh = 25, bufferSec = 180) {
  const travelSec = (distanceKm / avgSpeedKmh) * 3600;
  return Math.round(travelSec + bufferSec);
}

/**
 * ⭐ Сортирует курьеров по расстоянию до точки (для Эшелона 1).
 */
export function sortByDistance(riderCoords, targetLat, targetLng) {
  return riderCoords
    .map((r) => ({
      ...r,
      distanceKm:
        r.lat != null && r.lng != null
          ? haversineKm(r.lat, r.lng, targetLat, targetLng)
          : Infinity,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
