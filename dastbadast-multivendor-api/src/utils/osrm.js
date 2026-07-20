// dastbadast-multivendor-api/src/utils/osrm.js
//
// ⭐ Фаза 2 (аудит): бэкенд-клиент для OSRM. До этого OSRM в проекте
// вызывался ТОЛЬКО с клиента (rider-app/lib/routing.ts) для отрисовки
// маршрута на карте — диспетчинг (order-search.js) ранжировал курьеров
// по прямой (Haversine), что не учитывает реальную дорожную сеть (реки,
// одностороннее движение, объезды).
//
// Используем тот же публичный демо-сервер OSRM (router.project-osrm.org),
// что и rider-app — без API-ключа, для MVP этого достаточно. ⚠️ ВАЖНО для
// продакшена: публичный демо-сервер имеет собственные rate-лимиты и не
// даёт SLA — при заметном объёме диспетчинга (сотни волн/мин) стоит поднять
// свой инстанс OSRM/Valhalla и просто поменять OSRM_BASE/OSRM_TABLE_BASE
// ниже, интерфейс этого модуля не изменится.
//
// Философия та же, что уже принята в проекте (см. routing.ts, pubsub.js
// graceful degradation): жёсткий таймаут + при любой ошибке/таймауте —
// возврат null, чтобы вызывающий код (order-search.js) откатился на
// Haversine-ранжирование, а не завис и не уронил волну диспетчинга.

import { debugWarn } from "../debug-log.js";

const OSRM_ROUTE_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TABLE_BASE = "https://router.project-osrm.org/table/v1/driving";
const OSRM_TIMEOUT_MS = 2500; // ⭐ короче, чем на клиенте (4с) — это hot path диспетчинга, не UI

const MODULE = "osrm";

/**
 * Длительность поездки по дорогам между двумя точками, в секундах.
 * @param {[number, number]} from [lat, lng]
 * @param {[number, number]} to [lat, lng]
 * @returns {Promise<number|null>} секунды, или null при недоступности/таймауте
 */
export async function getOsrmDurationSeconds(from, to) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const url = `${OSRM_ROUTE_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const duration = data?.routes?.[0]?.duration;
    return typeof duration === "number" ? duration : null;
  } catch (e) {
    debugWarn(MODULE, "route request failed", { message: e?.message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Матрица длительностей от ОДНОЙ точки-источника до N точек-назначений
 * (OSRM /table, значительно дешевле, чем N отдельных /route запросов).
 * Используется для ре-ранжирования кандидатов-курьеров по реальному
 * времени в пути вместо Haversine-расстояния — см. order-search.js.
 *
 * @param {[number, number]} origin [lat, lng] — например, координаты ресторана
 * @param {[number, number][]} destinations [[lat, lng], ...] — курьеры
 * @returns {Promise<number[]|null>} массив секунд той же длины и порядка,
 *   что destinations, или null целиком при недоступности/таймауте (не
 *   частичный результат — вызывающий код рассчитывает на "всё или откат").
 */
export async function getOsrmDurationsMatrix(origin, destinations) {
  if (!Array.isArray(destinations) || destinations.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    // Источник — точка 0, назначения — точки 1..N. sources=0 явно указывает
    // OSRM считать длительности только ОТ источника (не полную N×N матрицу).
    const coords = [origin, ...destinations]
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(";");
    const destIndices = destinations.map((_, i) => i + 1).join(";");
    const url = `${OSRM_TABLE_BASE}/${coords}?sources=0&destinations=${destIndices}&annotations=duration`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const durations = data?.durations?.[0]; // [0] — единственный источник
    if (!Array.isArray(durations) || durations.length !== destinations.length) {
      return null;
    }
    // OSRM отдаёт null для недостижимых точек (например, остров без моста) —
    // это ВАЛИДНЫЙ результат для конкретного курьера, не повод откатывать
    // всю матрицу; такого курьера просто не сможем ранжировать по времени.
    return durations;
  } catch (e) {
    debugWarn(MODULE, "table request failed", { message: e?.message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
