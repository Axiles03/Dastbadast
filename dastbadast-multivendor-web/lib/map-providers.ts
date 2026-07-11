// dastbadast-multivendor-web/lib/map-providers.ts
//
// ⭐ Единая конфигурация карт для всего проекта.
//
// ⭐⭐⭐ МИГРАЦИЯ НА MAPLIBRE GL (векторный WebGL-движок):
// Raster-тайлы (PNG {z}/{x}/{y}) через Leaflet — устаревший подход:
// тормозят на мобильных, дают пиксельный текст при масштабировании,
// и требуют полного ре-рендера DOM-слоя при каждом обновлении.
//
// MapLibre GL — open-source форк Mapbox GL (не требует токена Mapbox),
// рисует карту через WebGL, обновляет источники данных (маршрут, маркеры)
// без перерисовки тайлов — отсюда плавность и отсутствие "прыжков" при
// частых апдейтах координат курьера.
//
// Используем тот же Geoapify-ключ, что и раньше — он отдаёт полноценный
// MapLibre-совместимый style.json (спецификация Mapbox Style Spec).
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

// ⭐ Векторный стиль для MapLibre GL (основной, используется в новых картах)
export const MAP_STYLE_URL = `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${GEOAPIFY_KEY}`;

// Тёмная тема (для будущего dark-mode)
export const MAP_STYLE_URL_DARK = `https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=${GEOAPIFY_KEY}`;

// Атрибуция обязательна по лицензии Geoapify/OSM.
// MapLibre подтягивает attribution из самого style.json автоматически,
// но держим текстовую версию на случай кастомных контролов.
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, © <a href="https://geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>';

// ⭐ УСТАРЕВШЕЕ (raster, Leaflet) — оставлено только на переходный период,
// пока все компоненты не переведены на MapLibre. Новый код не должен
// импортировать эти константы.
/** @deprecated используйте MAP_STYLE_URL с MapLibre GL */
export const GEOAPIFY_TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;
/** @deprecated используйте MAP_STYLE_URL_DARK с MapLibre GL */
export const GEOAPIFY_TILE_DARK = `https://maps.geoapify.com/v1/tile/dark/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;
/** @deprecated используйте MAP_ATTRIBUTION */
export const GEOAPIFY_ATTRIBUTION = MAP_ATTRIBUTION;
