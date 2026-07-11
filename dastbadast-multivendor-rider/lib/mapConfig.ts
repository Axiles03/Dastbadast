// dastbadast-multivendor-rider/lib/mapConfig.ts
//
// ⭐ ШАГ 3 (revised): бесплатная карта без Google API key.
// Используем OpenStreetMap через react-native-maps UrlTile.
// — НЕ НУЖЕН API-ключ
// — НЕ НУЖЕН биллинг
// — Работает в Expo Go на iOS/Android
//
// ⭐ ШАГ 2 (FIX): MAP_PROVIDER изменён с "google" на undefined
// Причина: PROVIDER_GOOGLE без android.googleMaps.apiKey в app.json
// НЕ рендерит карту на Android. PROVIDER_DEFAULT работает:
//   iOS     → Apple Maps (работает без ключа)
//   Android → Google Maps (в dev работает без ключа, в прод нужна —
//             но мы ещё не в проде, оставим TODO для подключения)
//
// Когда в проде понадобится настоящий Google ключ — укажите его в app.json:
//   "android": { "googleMaps": { "apiKey": "AIza..." } }
// и поменяйте MAP_PROVIDER на "google" ниже.

import { Platform } from "react-native";

/* ============== Регион по умолчанию — Душанбе ============== */

export const DUSHANBE_REGION = {
  latitude: 38.574,
  longitude: 68.783,
  latitudeDelta: 0.07,
  longitudeDelta: 0.07,
};

/* ============== OpenStreetMap tile URL ============== */

export const OSM_TILE_URL =
  "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";

export const OSM_TILE_URL_FALLBACK =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/* ============== ⭐ ШАГ 2: PROVIDER ============== */

export const MAP_PROVIDER: "google" | undefined = undefined;

/* ============== Утилиты ============== */

export function isValidCoord(v: any): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export function getLngLat(geo: any): [number, number] | null {
  if (!isValidCoord(geo?.coordinates)) return null;
  return [geo.coordinates[0], geo.coordinates[1]];
}

export function getLatLng(geo: any): [number, number] | null {
  const ll = getLngLat(geo);
  if (!ll) return null;
  return [ll[1], ll[0]];
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} км`;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
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

/* ============== ⭐ ШАГ 4: типы для маршрута ============== */

export type RoutePoint = [number, number];

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

export function remainingKm(
  points: RoutePoint[],
  riderPos?: { latitude: number; longitude: number } | null,
): number {
  if (points.length < 2) return 0;
  if (!riderPos) return routeLengthKm(points);

  let minDist = Infinity;
  let nearestIdx = 0;
  points.forEach((p, i) => {
    const d = haversineKm(p[0], p[1], riderPos.latitude, riderPos.longitude);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  });

  if (nearestIdx >= points.length - 1) return 0;
  return routeLengthKm(points.slice(nearestIdx));
}
