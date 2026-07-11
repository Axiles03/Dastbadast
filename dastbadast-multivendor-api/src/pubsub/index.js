// dastbadast-multivendor-api/src/pubsub/index.js
//
// ⭐ Фабрика: выбирает реализацию PubSub по конфигурации.
// - REDIS_URL задан И ENABLE_REDIS_PUBSUB=1 → RedisPubSub (multi-instance)
// - иначе → InMemoryPubSub (dev / single-instance)
//
// Также экспортирует TOPICS и singleton-инстанс (используется во всех резолверах).

import { InMemoryPubSub } from "./in-memory.js";
import { RedisPubSub } from "./redis-pubsub.js";
import { debugLog } from "../debug-log.js";

const USE_REDIS = !!(
  process.env.REDIS_URL && process.env.ENABLE_REDIS_PUBSUB !== "0"
);

let _instance = null;
function getInstance() {
  if (_instance) return _instance;
  if (USE_REDIS) {
    _instance = new RedisPubSub();
    debugLog("pubsub", "using RedisPubSub (multi-instance)");
  } else {
    _instance = new InMemoryPubSub();
    debugLog("pubsub", "using InMemoryPubSub (single-instance)");
  }
  return _instance;
}

// ⭐ Lazy singleton — не создаём Redis-соединение на импорт.
// Инициализация (Redis pubsub subscribe) произойдёт при первом asyncIterator().
export const pubsub = new Proxy(
  {},
  {
    get(_, prop) {
      const inst = getInstance();
      const value = inst[prop];
      return typeof value === "function" ? value.bind(inst) : value;
    },
  },
);

// In-memory fallback для случая, когда Redis упал в момент publish
export const inMemoryFallback = new InMemoryPubSub();

// Топики — НЕ переносим в этот файл, оставляем в старом pubsub.js
// для обратной совместимости (резолверы импортируют {pubsub, TOPICS}).
// Экспортируем TOPICS реэкспортом.
export { TOPICS } from "../pubsub-legacy.js";
