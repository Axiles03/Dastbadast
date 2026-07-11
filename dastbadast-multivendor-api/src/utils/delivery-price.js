// dastbadast-multivendor-api/src/utils/delivery-price.js
//
// Утилита расчёта стоимости доставки для MVP Dastbadast (TJS).
//
// Правила MVP (г. Душанбе):
//   - ≤  3 км         → 10 сомони
//   - >   3 км         → 10 + (distanceKm - 3) * 3 сомони
//
// Примеры (rounding='exact'):
//   0.00  km  → 10.0
//   2.99  km  → 10.0
//   3.00  km  → 10.0
//   3.50  km  → 11.5
//   5.00  km  → 16.0
//   7.20  km  → 23.6
//   10.00 km  → 31.0
//   12.00 km  → 37.0
//
// Заметка: расстояние считается по Haversine (прямая на сфере Земли).
// Это допустимая точность для MVP в пределах одного города.
// В следующих шагах заменим на OSRM-роутинг с учётом дорог.
//
// Чистая функция, не зависит от Mongoose/Apollo — её можно:
//   - юнит-тестировать;
//   - переиспользовать на frontend (через shared-пакет или copy-paste).

import { haversineKm } from "./geo.js";
import { getDistanceMeters } from "./geoapify.js";

/** Параметры тарифа по умолчанию (г. Душанбе, MVP). */
export const DELIVERY_PRICING = Object.freeze({
  baseKm: 3, // базовый радиус, км (включительно)
  basePrice: 10, // цена за базовый радиус, сомони
  perKmPrice: 3, // цена за каждый км сверх базы, сомони
  currency: "TJS",
  currencySymbol: "сом.",
});

/** Стратегии округления финальной цены. */
const ROUNDING_FN = Object.freeze({
  exact: (n) => n, // 11.5
  round: (n) => Math.round(n), // 12
  ceil: (n) => Math.ceil(n), // 12
  floor: (n) => Math.floor(n), // 11
});

function isValidCoord(v) {
  if (!Array.isArray(v) || v.length < 2) return false;
  const [lng, lat] = v;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * ⭐ ШАГ 3: расстояние между двумя GeoJSON Point-координатами.
 * Приоритет: Geoapify (по дорогам) → fallback Haversine.
 * @returns {number|null} расстояние в КМ, или null при невалидных координатах
 */
export function distanceKmSync(from, to) {
  if (!isValidCoord(from) || !isValidCoord(to)) return null;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  return haversineKm(lat1, lng1, lat2, lng2);
}

/**
 * ⭐ ШАГ 3 (sync fallback): быстрый Haversine для мест, где async
 * невозможен (например, в SSR rendering на Web). Используется ТОЛЬКО
 * в places, где async API не доступен (например, тесты).
 */
export async function distanceKm(from, to, mode = "scooter") {
  if (!isValidCoord(from) || !isValidCoord(to)) return null;
  const meters = await getDistanceMeters(from, to, mode);
  return meters / 1000;
}

/**
 * @typedef {Object} DeliveryPriceOptions
 * @property {number} [baseKm=3]         — базовый радиус (включительно)
 * @property {number} [basePrice=10]     — цена за базовый радиус, сомони
 * @property {number} [perKmPrice=3]     — цена за каждый км сверх базы, сомони
 * @property {'exact'|'round'|'ceil'|'floor'} [rounding='exact'] — округление
 */

/**
 * Рассчитывает стоимость доставки по формуле MVP.
 *
 * Чистая функция, без побочных эффектов.
 *
 * @param {[number, number]} from - [lng, lat] ресторана
 * @param {[number, number]} to   - [lng, lat] клиента
 * @param {DeliveryPriceOptions} [opts]
 * @returns {number} стоимость в сомони (всегда валидное число ≥ 0).
 *          При невалидных координатах возвращает basePrice как безопасный fallback.
 */
export function calculateDeliveryPrice(from, to, opts = {}) {
  const baseKm = Number.isFinite(opts.baseKm)
    ? opts.baseKm
    : DELIVERY_PRICING.baseKm;
  const basePrice = Number.isFinite(opts.basePrice)
    ? opts.basePrice
    : DELIVERY_PRICING.basePrice;
  const perKmPrice = Number.isFinite(opts.perKmPrice)
    ? opts.perKmPrice
    : DELIVERY_PRICING.perKmPrice;
  const rounding = ROUNDING_FN[opts.rounding] ? opts.rounding : "exact";
  const fn = ROUNDING_FN[rounding];

  const dist = distanceKmSync(from, to);
  if (dist === null) return basePrice;

  if (dist <= baseKm) return fn(basePrice);

  const extra = (dist - baseKm) * perKmPrice;
  return fn(basePrice + extra);
}

/**
 * Разбивка цены на базовую и переменную часть.
 * Удобно для UI-чека/детального отображения:
 *   "Доставка: 10 + 6 = 16 сомони (5.0 км)"
 *
 * @param {[number, number]} from
 * @param {[number, number]} to
 * @param {DeliveryPriceOptions} [opts]
 * @returns {{
 *   base: number,
 *   perKm: number,
 *   distanceKm: number|null,
 *   total: number,
 *   isOverBase: boolean
 * }}
 */
export function calculateDeliveryPriceBreakdown(from, to, opts = {}) {
  const baseKm = Number.isFinite(opts.baseKm)
    ? opts.baseKm
    : DELIVERY_PRICING.baseKm;
  const basePrice = Number.isFinite(opts.basePrice)
    ? opts.basePrice
    : DELIVERY_PRICING.basePrice;
  const perKmPrice = Number.isFinite(opts.perKmPrice)
    ? opts.perKmPrice
    : DELIVERY_PRICING.perKmPrice;
  const rounding = ROUNDING_FN[opts.rounding] ? opts.rounding : "exact";
  const fn = ROUNDING_FN[rounding];

  const dist = distanceKmSync(from, to);
  if (dist === null) {
    return {
      base: basePrice,
      perKm: 0,
      distanceKm: null,
      total: basePrice,
      isOverBase: false,
    };
  }

  const isOverBase = dist > baseKm;
  const perKm = isOverBase ? fn((dist - baseKm) * perKmPrice) : 0;
  const total = fn(basePrice + perKm);

  return {
    base: basePrice,
    perKm,
    distanceKm: +dist.toFixed(3),
    total,
    isOverBase,
  };
}

// ===== Пресеты стратегий округления =====
export const ROUNDING_EXACT = "exact";
export const ROUNDING_ROUND = "round";
export const ROUNDING_CEIL = "ceil";
export const ROUNDING_FLOOR = "floor";
export function routeDistanceKm(from, to) {
  const km = distanceKmSync(from, to);
  return km === null ? 0 : km;
}
export async function routeDistanceKmAsync(from, to) {
  const km = await distanceKm(from, to);
  return km === null ? 0 : km;
}

// ===== Примеры для ручной проверки в Node REPL =====
//
// ```bash
// $ cd dastbadast-multivendor-api
// $ node --input-type=module -e "
//   import('./src/utils/delivery-price.js').then(m => {
//     const r = [68.783, 38.574]; // Душанбе, центр
//     const c1 = [68.783, 38.574]; // тот же пункт
//     const c2 = [68.815, 38.605]; // ~5 км
//     const c3 = [68.870, 38.660]; // ~12 км
//     console.log('0 км  :', m.calculateDeliveryPrice(r, c1)); // 10
//     console.log('5 км  :', m.calculateDeliveryPrice(r, c2)); // 16
//     console.log('12 км :', m.calculateDeliveryPrice(r, c3)); // 37
//     console.log('breakdown 5км:', m.calculateDeliveryPriceBreakdown(r, c2));
//   });
// "
