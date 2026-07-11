// dastbadast-multivendor-web/lib/map-providers.ts
//
// ⭐ Единая конфигурация tile-сервера для всех карт в проекте.
// Заменяет OpenStreetMap (прямой tile.openstreetmap.org) на Geoapify.
//
// Зачем: у OSM прямого тайл-сервера жёсткие лимиты (нет production-нагрузок),
// у Geoapify есть бесплатный tier 3000 req/day, и он уже интегрирован в rider.
//
// Ключ берём из public env (видно и в браузере, и в WebView).
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

// Базовый стиль — светлый, нейтральный (похож на OSM, но без лимитов)
export const GEOAPIFY_TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;

// Альтернативный — тёмный (для будущих dark-тем)
export const GEOAPIFY_TILE_DARK = `https://maps.geoapify.com/v1/tile/dark/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;

// Атрибуция обязательна по лицензии Geoapify
export const GEOAPIFY_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://geoapify.com/">Geoapify</a>';
