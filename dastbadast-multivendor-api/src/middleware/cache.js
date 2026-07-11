// dastbadast-multivendor-api/src/middleware/cache.js
//
// ⭐ HTTP cache для read-only GraphQL queries.
//
// Стратегия:
//   1) In-memory LRU (быстрый, на каждый инстанс отдельно)
//   2) Cache-Control: max-age=N (клиенты/CDN могут кэшировать)
//   3) Инвалидация через pubsub-канал CACHE_INVALIDATE (см. константы в pubsub-legacy.js)
//
// Что кэшируем:
//   - configuration: TTL 5 мин (редко меняется)
//   - restaurants (список): TTL 1 мин (часто обновляется при создании)
//   - meRestaurant (для store app): TTL 30 сек
//   - user profile: TTL 1 мин
//
// Что НЕ кэшируем:
//   - orders, order (real-time data)
//   - chatMessages
//   - anything с auth-header, кроме public queries

import { LRUCache } from "lru-cache";
import { debugLog } from "../debug-log.js";
import { pubsub, TOPICS } from "../pubsub.js";

// ⭐ In-memory LRU
// Максимум 500 ключей, до 50KB на ключ — итого ~25MB максимум
const cache = new LRUCache({
  max: 500,
  // maxSize + sizeCalculation работают в паре — кэш сам считает размер каждого entry
  maxSize: 50 * 1024,
  sizeCalculation: (v) => {
    try {
      return JSON.stringify(v).length;
    } catch {
      return 1000;
    }
  },
  ttl: 1000 * 60 * 5, // 5 минут default
  ttlAutopurge: true,
});

const CACHE_TTLS = {
  configuration: 5 * 60, // 5 мин
  restaurants: 60, // 1 мин
  meRestaurant: 30, // 30 сек
  profile: 60, // 1 мин
  userAddresses: 30,
};

const CACHE_KEY_PREFIX = "gql:";

function buildCacheKey(query, variables, userId) {
  // Сортируем variables для стабильного ключа
  const v = variables
    ? JSON.stringify(variables, Object.keys(variables).sort())
    : "";
  return `${CACHE_KEY_PREFIX}${userId || "anon"}:${hashQuery(query)}:${v}`;
}

function hashQuery(query) {
  // Простой хеш: длина + первые 100 символов (не крипто, для дедупликации)
  let h = query.length;
  for (let i = 0; i < Math.min(query.length, 100); i++) {
    h = (h << 5) - h + query.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

const CACHEABLE_QUERIES = {
  configuration: { ttl: CACHE_TTLS.configuration, requireAuth: false },
  restaurants: { ttl: CACHE_TTLS.restaurants, requireAuth: false },
  meRestaurant: { ttl: CACHE_TTLS.meRestaurant, requireAuth: true },
  profile: { ttl: CACHE_TTLS.profile, requireAuth: true },
  addresses: { ttl: CACHE_TTLS.userAddresses, requireAuth: true },
};

/**
 * Извлекает имя первого query/mutation из GraphQL-документа.
 * Простая regex-парсилка (без полного парсера) — достаточно для кэширования.
 */
function extractOperationName(query) {
  if (!query) return null;
  // Ищем "query Foo { ... }" или "mutation Foo { ... }"
  const m = query.match(/(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return m ? m[1] : null;
}

/**
 * ⭐ Express-middleware для кэширования GraphQL POST-запросов.
 * Применяется ТОЛЬКО для read-only queries с кэшируемыми именами.
 * Cache-Control header добавляется в ответ через context-функцию apollo.
 */
export function cacheMiddleware() {
  return (req, res, next) => {
    if (req.method !== "POST") return next();
    if (req.path !== "/graphql") return next();

    const { query, variables, operationName } = req.body || {};

    // ⭐ Только для queries (не mutations)
    if (!query || !/^\s*query\b/.test(query)) return next();

    // Определяем какую операцию кэшируем
    const opName = operationName || extractOperationName(query);
    if (!opName || !CACHEABLE_QUERIES[opName]) return next();

    // ⭐ Проверка авторизации: для auth-required queries — учитываем userId
    const config = CACHEABLE_QUERIES[opName];
    const userId = req.headers["x-user-id"] || null;
    if (config.requireAuth && !userId) return next();

    // Формируем ключ
    const cacheKey = buildCacheKey(query, variables, userId);

    // Try cache
    const cached = cache.get(cacheKey);
    if (cached) {
      debugLog("cache", "HIT", { op: opName, key: cacheKey });
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", `public, max-age=${config.ttl}`);
      return res.json(cached);
    }

    // Cache miss — проксируем дальше, перехватываем res.json
    debugLog("cache", "MISS", { op: opName, key: cacheKey });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", `public, max-age=${config.ttl}`);

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // ⭐ Кэшируем ТОЛЬКО успешные ответы (нет GraphQL errors)
      if (
        body &&
        !body.errors &&
        body.data &&
        Object.keys(body.data).length > 0
      ) {
        cache.set(cacheKey, body, { ttl: config.ttl * 1000 });
        debugLog("cache", "STORED", {
          op: opName,
          key: cacheKey,
          ttl: config.ttl,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

/**
 * ⭐ Инвалидировать кэш по операции (вызывается из mutations).
 * Используется в `configuration.js` после `updateConfiguration`,
 * в `restaurant.js` после `createRestaurant` и т.д.
 */
export async function invalidateCache(operationName) {
  let count = 0;
  for (const key of cache.keys()) {
    // Простая эвристика: удаляем все ключи с этим operationName
    if (key.includes(`:${operationName}:`)) {
      cache.delete(key);
      count++;
    }
  }
  if (count > 0) {
    debugLog("cache", `invalidated ${operationName}`, { count });
  }
  // Бродкаст другим инстансам (для синхронизации)
  const channelMap = {
    configuration: TOPICS.CACHE_INVALIDATE_CONFIG,
    restaurants: TOPICS.CACHE_INVALIDATE_RESTAURANTS,
  };
  const channel = channelMap[operationName];
  if (channel) {
    try {
      await pubsub.publish(channel, { operationName, at: Date.now() });
    } catch (e) {
      debugLog("cache", "broadcast invalidate failed", e?.message);
    }
  }
}

/**
 * Подписка на cross-instance инвалидацию.
 * Запускается один раз в server.js.
 */
export function startCacheInvalidationSubscriber() {
  const channels = [
    TOPICS.CACHE_INVALIDATE_CONFIG,
    TOPICS.CACHE_INVALIDATE_RESTAURANTS,
  ];
  for (const ch of channels) {
    (async () => {
      try {
        const iter = await pubsub.asyncIterator(ch);
        for await (const data of iter) {
          // Другой инстанс сказал "инвалидируй" — чистим локальный LRU
          let count = 0;
          const opName = data?.operationName;
          for (const key of cache.keys()) {
            if (opName && key.includes(`:${opName}:`)) {
              cache.delete(key);
              count++;
            }
          }
          if (count > 0) {
            debugLog("cache", `cross-instance invalidation`, {
              ch,
              count,
            });
          }
        }
      } catch (e) {
        debugLog("cache", "invalidation subscriber error", e?.message);
      }
    })();
  }
}

/**
 * Экспортируем кэш для тестов (сброс, статистика).
 */
export function getCacheStats() {
  return {
    size: cache.size,
    max: cache.max,
    calculatedSize: cache.calculatedSize || 0,
  };
}

export function clearCache() {
  cache.clear();
}
