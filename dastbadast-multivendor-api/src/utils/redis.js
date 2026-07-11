// dastbadast-multivendor-api/src/utils/redis.js
//
// ⭐ Singleton Redis-клиент для hot path (GPS-координат курьеров).
//
// Архитектура (Шаг 1):
//   Курьер → mutation updateRiderLocation
//      ↓
//   Redis: SETEX + GEOADD (TTL 5 мин)
//      ↓
//   PubSub broadcast (для клиента/админа)        ← читаем из Redis, НЕ из Mongo
//      ↓
//   каждые 5 мин cron сбрасывает агрегат в MongoDB
//
// Преимущества:
//   - MongoDB получает 12 записей/час/курьер (5 мин интервал),
//     а не 360 (раз в 10 сек) — нагрузка падает в 30 раз.
//   - Rider → User broadcast остаётся real-time (читаем из Redis).
//   - При падении Redis — graceful degradation: пишем в Mongo как раньше.

import IORedis from "ioredis";
import { debugLog, debugWarn } from "../debug-log.js";

// ⭐ Конфигурация через env (с безопасными дефолтами)
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = process.env.REDIS_URL || null;

let client = null;
let connected = false;

export function getRedis() {
  if (client) return client;
  const url = REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`;
  client = new IORedis(url, {
    password: REDIS_PASSWORD,
    // ⭐ Retry strategy: экспоненциальный backoff
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
    // ⭐ Lazy connect — не блокируем startup, если Redis недоступен
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false, // ⭐ не накапливать команды при отключении
  });

  client.on("connect", () => {
    connected = true;
    debugLog("Redis", "connected", {
      host: REDIS_HOST,
      port: REDIS_PORT,
    });
  });
  client.on("error", (err) => {
    connected = false;
    debugWarn("Redis", "error (graceful degradation to Mongo)", err.message);
  });
  client.on("end", () => {
    connected = false;
    debugLog("Redis", "disconnected");
  });
  return client;
}

export function isRedisReady() {
  return connected;
}

/**
 * Безопасный wrapper: если Redis недоступен — возвращает fallback.
 * Используем в hot path, чтобы падение Redis НЕ роняло API.
 *
 * op — async-функция, получающая Redis client. Должна вернуть результат.
 * fallback — что вернуть, если Redis недоступен.
 */
export async function tryRedis(op, fallback) {
  try {
    if (!connected) {
      const c = getRedis();
      try {
        await c.connect();
      } catch (e) {
        // не взлетел — уходим в fallback
        return fallback;
      }
      if (!isRedisReady()) return fallback;
    }
    // ⭐ К этому моменту client гарантированно инициализирован (или упали в fallback выше)
    return await op(client);
  } catch (e) {
    debugWarn("Redis", "op failed, fallback", e?.message || String(e));
    return fallback;
  }
}

/**
 * Lazy connect на старте приложения (не блокирует startup).
 * Вызывать из index.js после MongoDB.
 */
export async function initRedis() {
  const c = getRedis();
  try {
    await c.connect();
  } catch (e) {
    debugWarn("Redis", "init failed (continuing without cache)", e?.message);
  }
}

// Добавьте в существующий /utils/redis.js (если нет — патч внизу файла):

/**
 * ⭐⭐⭐ Простой rate limiter через Redis: maxRequests за windowSeconds.
 * Используется для защиты placeOrder (10 заказов/мин) и других abuse-узлов.
 *
 * Возвращает { allowed: boolean, remaining: number, resetInSec: number }
 */
export async function checkRateLimit({ key, maxRequests, windowSeconds }) {
  const fallback = { allowed: true, remaining: maxRequests, resetInSec: 0 };
  if (!(await isRedisReady())) return fallback;

  return await tryRedis(async (r) => {
    const fullKey = `rl:${key}`;
    // INCR + EXPIRE (атомарно через pipeline)
    const pipeline = r.multi();
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, windowSeconds, "NX"); // только если ключ новый
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] ?? 0;
    const ttl = await r.ttl(fullKey);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetInSec: Math.max(0, ttl),
    };
  }, fallback);
}
