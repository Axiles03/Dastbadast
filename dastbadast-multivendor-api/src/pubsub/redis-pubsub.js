// dastbadast-multivendor-api/src/pubsub/redis-pubsub.js
//
// ⭐⭐⭐ Redis-based PubSub для multi-instance API.
// Каждое publish() транслирует payload во ВСЕ инстансы через Redis pub/sub.
// Каждый инстанс подписывается на ВСЕ каналы и фильтрует локально (через AsyncIterator).
//
// Преимущества над in-memory:
//   - WebSocket-клиент на инстансе A получает события, опубликованные на инстансе B
//   - При перезапуске инстанса — клиенты автоматически переподключаются, и pubsub снова работает
//   - Можно запускать 2+ воркеров API за nginx/PM2 cluster
//
// ⚠️ Требования к Redis:
//   - Redis 5.0+ (pub/sub)
//   - Для at-least-once: Redis AOF persistence
//   - Пропускная способность: 1 канал = 1 key, payload сериализуется в JSON (~1KB на событие)

import { Redis } from "ioredis";
import { getRedis, isRedisReady } from "../utils/redis.js";
import { debugLog, debugWarn, debugError } from "../debug-log.js";

// Уникальный ID этого инстанса — для фильтрации собственных сообщений
// (чтобы не получить свой же publish обратно и задублировать подписку)
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

// ⭐ Два Redis-клиента: один для publish, второй для subscribe.
// (Один клиент нельзя использовать одновременно в обоих режимах — ioredis не позволяет.)
let publisherClient = null;
let subscriberClient = null;

// Локальный Map: trigger → Set<{resolve, reject}>
// (стандартный паттерн graphql-subscriptions)
const localListeners = new Map();
let subscriptionInitialized = false;

function localListenersKey(trigger) {
  if (!localListeners.has(trigger)) {
    localListeners.set(trigger, new Set());
  }
  return localListeners.get(trigger);
}

/**
 * Создать отдельный subscriber-клиент.
 * У subscriber-клиента есть особенность: после subscribe он не может
 * выполнять обычные команды (только subscribe/psubscribe/unsubscribe/ping).
 * Поэтому для publish используем основной client из getRedis().
 */
function getSubscriberClient() {
  if (subscriberClient) return subscriberClient;
  const main = getRedis();
  // Создаём дубликат (ioredis позволит, если main — обычный клиент)
  // Подключаемся к тому же хосту
  subscriberClient = main.duplicate();
  subscriberClient.on("error", (e) =>
    debugWarn("RedisSub", "sub error", e?.message),
  );
  return subscriberClient;
}

export class RedisPubSub {
  constructor() {
    this.subscribedChannels = new Set();
  }

  /**
   * Инициализировать подписку на все каналы (вызывается один раз при старте инстанса).
   * Внутренний handler диспатчит payload локальным слушателям.
   */
  async init() {
    if (subscriptionInitialized) return;
    subscriptionInitialized = true;

    const sub = getSubscriberClient();

    // ⭐ Subscribe на ВСЕ каналы через PSUBSCRIBE (паттерн *)
    // Это единственный способ: мы не знаем заранее, какие каналы появятся.
    // Каждое событие проходит через Redis → handler → проверка темы → resolve promise.
    await sub.psubscribe("*");
    debugLog("RedisPubSub", "psubscribed to all channels", {
      instance: INSTANCE_ID,
    });

    sub.on("pmessage", (pattern, channel, message) => {
      try {
        const payload = JSON.parse(message);
        // ⭐ Фильтруем собственные сообщения (не дубль-доставка)
        if (payload.__instanceId === INSTANCE_ID) return;
        // Делаем resolve для всех локальных слушателей этого канала
        const listeners = localListeners.get(channel);
        if (!listeners) return;
        const data = payload.data;
        for (const resolve of listeners) {
          try {
            resolve(data);
          } catch (e) {
            debugError("RedisPubSub", "listener error", e?.message);
          }
        }
      } catch (e) {
        debugError("RedisPubSub", "pmessage parse error", e?.message);
      }
    });
  }

  /**
   * Стандартный graphql-subscriptions API.
   * Возвращает AsyncIterator, который резолвит новые payload'ы по триггерам.
   */
  asyncIterator(triggers) {
    // ⭐ При первом вызове — инициализируем глобальную подписку
    if (!subscriptionInitialized) {
      // Неблокирующая инициализация (fire-and-forget, чтобы не задерживать resolver)
      this.init().catch((e) =>
        debugError("RedisPubSub", "init failed", e?.message),
      );
    }

    const triggerList = Array.isArray(triggers) ? triggers : [triggers];
    // ⭐ GraphQL Yoga / graphql-subscriptions ожидает именно AsyncIterable,
    // где resolve() подкидывает новые значения. Реализуем минимальный AsyncIterator.
    const queue = [];
    const pendingResolvers = [];

    const tryNext = () =>
      new Promise((resolve) => {
        if (queue.length > 0) {
          resolve({ value: queue.shift(), done: false });
        } else {
          pendingResolvers.push(resolve);
        }
      });

    // Подписываемся на каждый trigger — каждое событие пушим в queue
    const cleanups = [];
    for (const trigger of triggerList) {
      const set = localListenersKey(trigger);
      const resolver = (data) => {
        if (pendingResolvers.length > 0) {
          const r = pendingResolvers.shift();
          r({ value: data, done: false });
        } else {
          queue.push(data);
        }
      };
      set.add(resolver);
      cleanups.push(() => {
        set.delete(resolver);
      });
    }

    // Возвращаем AsyncIterator
    return {
      next: tryNext,
      return: () => {
        for (const c of cleanups) c();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw: (err) => {
        for (const c of cleanups) c();
        return Promise.reject(err);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  /**
   * Публикация события:
   *   1) Сериализуем payload в JSON
   *   2) Добавляем __instanceId для фильтрации на принимающей стороне
   *   3) PUBLISH в Redis
   *
   * ⚠️ Если Redis недоступен — событие теряется (graceful degradation: in-memory fallback).
   * Для at-least-once нужен Redis AOF + retry-queue (за рамками Шага 2).
   */
  async publish(trigger, payload) {
    if (!isRedisReady()) {
      // Fallback: если Redis ещё не подключился, пробуем in-memory pubsub
      // (для короткого окна на старте приложения)
      const { inMemoryFallback } = await import("./in-memory.js");
      return inMemoryFallback.publish(trigger, payload);
    }

    const client = getRedis();
    const message = JSON.stringify({
      __instanceId: INSTANCE_ID,
      data: payload,
    });
    try {
      await client.publish(trigger, message);
    } catch (e) {
      debugError("RedisPubSub", "publish failed", e?.message);
      // Не throw — потеря события лучше, чем падение resolver'а
    }
  }
}
