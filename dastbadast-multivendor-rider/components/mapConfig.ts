// dastbadast-multivendor-rider/lib/mapConfig.ts
//
// ⭐ ШАГ 3 (revised): бесплатная карта без Google API.
// Используем OpenStreetMap через react-native-maps UrlTile.
// — НЕ НУЖЕН API-ключ
// — НЕ НУЖЕН биллинг
// — Работает в Expo Go на iOS/Android

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

/* ============== PROVIDER ============== */

export const MAP_PROVIDER = Platform.OS === "android" ? "google" : undefined;

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
  if (!geo || !isValidCoord(geo.coordinates)) return null;
  return [geo.coordinates[1], geo.coordinates[0]];
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
