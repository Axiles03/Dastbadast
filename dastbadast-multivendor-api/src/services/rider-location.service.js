// dastbadast-multivendor-api/src/services/rider-location.service.js
//
// ⭐⭐⭐ Hot path для GPS-координат курьеров.
//
// Архитектура:
//   1) setRiderLocationInRedis() — пишем в Redis с TTL 5 мин + GEOADD для geo-queries
//   2) getRiderLocationFromRedis() — читаем из Redis (НЕ из MongoDB)
//   3) runFlush() — cron каждые 5 мин сбрасывает агрегат в MongoDB
//   4) При недоступности Redis — fallback на Mongo (graceful degradation)
//
// Ключи Redis:
//   rider:loc:{riderId}              — hash { lat, lng, bearing, speedKmh, updatedAt }
//   rider:loc:index                  — SET всех riderId с активной гео
//   rider:loc:geo                    — GEO key с координатами (для GEORADIUS)
//
// GEOADD формат: GEOADD <key> <lng> <lat> <member>.
// Redis 6.2+ поддерживает GEOADD.

import { getRedis, tryRedis, isRedisReady } from "../utils/redis.js";
import { Rider } from "../models/Rider.js";
import { debugLog, debugWarn } from "../debug-log.js";

// TTL = 5 минут (как в задании Шага 1)
const TTL_SECONDS = 5 * 60;

function locKey(riderId) {
  return `rider:loc:${riderId}`;
}
const INDEX_KEY = "rider:loc:index";
const GEO_KEY = "rider:loc:geo";

/**
 * ⭐ Сохранение локации курьера в Redis.
 * Вызывается из updateRiderLocation resolver'а.
 *
 * @param {string} riderId
 * @param {Object} loc  - { lat, lng, bearing, speedKmh, updatedAt }
 * @returns {Promise<boolean>} true если записали, false если упали в fallback
 */
export async function setRiderLocationInRedis(riderId, loc) {
  return tryRedis(async (r) => {
    const key = locKey(riderId);
    // HSET + EXPIRE в одном pipeline (атомарно для одного ключа через MULTI)
    const pipeline = r.multi();
    pipeline.hset(key, {
      lat: String(loc.lat),
      lng: String(loc.lng),
      bearing: loc.bearing != null ? String(loc.bearing) : "",
      speedKmh: loc.speedKmh != null ? String(loc.speedKmh) : "",
      updatedAt: loc.updatedAt,
    });
    pipeline.expire(key, TTL_SECONDS);
    pipeline.sadd(INDEX_KEY, riderId);
    pipeline.expire(INDEX_KEY, TTL_SECONDS * 2);
    // ⭐⭐⭐ GEOADD для будущего поиска "ближайших курьеров к точке"
    pipeline.geoadd(GEO_KEY, loc.lng, loc.lat, riderId);
    await pipeline.exec();
    return true;
  }, false);
}

/**
 * ⭐ Чтение локации курьера (для broadcast/UI).
 * Fallback на Mongo, если Redis пуст.
 *
 * @param {string} riderId
 * @returns {Promise<{lat:number, lng:number, bearing:number|null, speedKmh:number|null, updatedAt:string}|null>}
 */
export async function getRiderLocationFromRedis(riderId) {
  // Сначала пробуем Redis
  const fromRedis = await tryRedis(async (r) => {
    const data = await r.hgetall(locKey(riderId));
    if (!data || !data.lat) return null;
    return {
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      bearing: data.bearing ? parseFloat(data.bearing) : null,
      speedKmh: data.speedKmh ? parseFloat(data.speedKmh) : null,
      updatedAt: data.updatedAt,
    };
  }, null);

  if (fromRedis) return fromRedis;

  // Fallback: читаем из Mongo
  try {
    const r = await Rider.findById(riderId)
      .select("location lastLocationAt bearing")
      .lean();
    if (!r || !r.location || !r.location.coordinates) return null;
    const [lng, lat] = r.location.coordinates;
    if (lat === 0 && lng === 0) return null;
    return {
      lat,
      lng,
      bearing: r.bearing != null ? r.bearing : null,
      speedKmh: null,
      updatedAt: r.lastLocationAt
        ? r.lastLocationAt.toISOString()
        : new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

/**
 * ⭐ Получить ВСЕХ активных курьеров с локациями (для cron-flush в Mongo).
 * Сканирует SET индекс, чтобы не перебирать всю БД.
 *
 * @returns {Promise<string[]>} массив riderId
 */
export async function getAllRiderIdsInRedis() {
  return tryRedis(async (r) => {
    return await r.smembers(INDEX_KEY);
  }, []);
}

/**
 * ⭐ Удалить из Redis после flush (чтобы не перезаписывать в следующий cron).
 * В cron вызывается ПОСЛЕ успешной записи в Mongo.
 *
 * @param {string} riderId
 * @returns {Promise<void>}
 */
export async function removeRiderFromRedis(riderId) {
  await tryRedis(async (r) => {
    const pipeline = r.multi();
    pipeline.del(locKey(riderId));
    pipeline.srem(INDEX_KEY, riderId);
    pipeline.zrem(GEO_KEY, riderId);
    await pipeline.exec();
    return undefined;
  }, undefined);
}
