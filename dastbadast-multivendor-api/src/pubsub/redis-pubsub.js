// dastbadast-multivendor-api/src/pubsub/redis-pubsub.js
//
// ⭐⭐⭐ Redis-based PubSub для multi-instance API.
// Каждое publish() транслирует payload во ВСЕ инстансы через Redis pub/sub.
//
// ⭐ Фаза 3 (аудит), п.10: раньше каждый инстанс подписывался на ВСЕ каналы
// системы через `PSUBSCRIBE "*"` и фильтровал локально в JS — то есть
// каждое событие (включая самый частый тип — GPS-пинги курьеров каждые
// 10 сек) сериализовалось и доставлялось на каждый инстанс, независимо от
// того, есть ли там реально заинтересованный WS-подписчик. Нагрузка на
// инстанс росла с ОБЩИМ трафиком системы, а не с числом его собственных
// подписчиков — то есть без предела при росте кластера.
//
// Теперь — точечная подписка: каждый инстанс подписывается ТОЛЬКО на те
// конкретные каналы, на которые у него ЕСТЬ хотя бы один локальный
// слушатель (реф-каунт), и отписывается, когда последний слушатель уходит
// (закрытие WS-соединения на клиенте → return() у AsyncIterator). Это
// возможно ровно потому, что в этом проекте КАЖДЫЙ триггер в TOPICS —
// уже конкретное имя канала с ID (см. pubsub-legacy.js: `ORDER_TRACK_${orderId}`
// и т.п.), а не паттерн — значит, wildcard-подписка вообще не была нужна
// по сути задачи, только по реализации.
//
// Преимущества над in-memory (не изменились):
//   - WebSocket-клиент на инстансе A получает события, опубликованные на инстансе B
//   - При перезапуске инстанса — клиенты автоматически переподключаются, и pubsub снова работает
//   - Можно запускать 2+ воркеров API за nginx/PM2 cluster
//
// ⚠️ Требования к Redis:
//   - Redis 5.0+ (pub/sub)
//   - Для at-least-once: Redis AOF persistence
//   - Пропускная способность: 1 канал = 1 key, payload сериализуется в JSON (~1KB на событие)
//
// ⚠️ Известный компромисс точечной подписки (честно, не скрываем): между
// моментом, когда `asyncIterator()` регистрирует локального слушателя, и
// моментом, когда SUBSCRIBE реально долетает до Redis (обычно единицы-
// десятки миллисекунд), есть окно, в которое publish с ДРУГОГО инстанса
// теоретически может быть пропущен для ЭТОГО КОНКРЕТНОГО канала — но
// только для его самого первого подписчика в рамках инстанса (реф-каунт
// 0→1). У прежней версии это окно тоже было, просто один раз при самом
// первом обращении к pubsub за всё время жизни процесса (после — уже
// подписаны на всё). На практике для событий с периодической природой
// (GPS-трекинг раз в 10 сек, статус заказа) это самовосстанавливается
// на следующем событии; для одноразовых событий это тот же класс риска,
// что уже принят в проекте для publish() ниже ("потеря события лучше,
// чем падение resolver'а").

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
    // ⭐ Фаза 3: реф-каунт активных ЛОКАЛЬНЫХ (в рамках этого инстанса)
    // слушателей на канал. 0→1 — реальный SUBSCRIBE в Redis; N→0 —
    // реальный UNSUBSCRIBE. Не путать с localListeners (Map канал→Set
    // резолверов) ниже — тот уже существовал, это новый, отдельный счётчик
    // именно для управления самой Redis-подпиской.
    this.channelRefCounts = new Map();
    this._messageHandlerAttached = false;
  }

  /**
   * ⭐ Фаза 3: подписаться на КОНКРЕТНЫЙ канал, если ещё не подписаны
   * (реф-каунт 0→1). Повторные вызовы для уже активного канала просто
   * увеличивают счётчик, не шлют лишний SUBSCRIBE в Redis.
   */
  async subscribeToChannel(channel) {
    this._ensureMessageHandler();

    const count = this.channelRefCounts.get(channel) || 0;
    this.channelRefCounts.set(channel, count + 1);
    if (count > 0) return; // уже подписаны — просто увеличили счётчик

    const sub = getSubscriberClient();
    await sub.subscribe(channel);
    debugLog("RedisPubSub", "subscribed", { channel, instance: INSTANCE_ID });
  }

  /**
   * ⭐ Фаза 3: снять ОДНУ ссылку на канал; когда счётчик доходит до 0 —
   * реальный UNSUBSCRIBE в Redis. Вызывается из cleanup() в asyncIterator
   * при закрытии WS-соединения клиента (return()/throw()).
   */
  async unsubscribeFromChannel(channel) {
    const count = this.channelRefCounts.get(channel) || 0;
    if (count <= 1) {
      this.channelRefCounts.delete(channel);
      try {
        const sub = getSubscriberClient();
        await sub.unsubscribe(channel);
        debugLog("RedisPubSub", "unsubscribed", {
          channel,
          instance: INSTANCE_ID,
        });
      } catch (e) {
        // Не критично — если соединение уже рвётся при шатдауне процесса,
        // сам факт "не отписались явно" не течёт (Redis сам закроет
        // подписку при разрыве TCP-соединения subscriber-клиента).
        debugWarn("RedisPubSub", "unsubscribe failed (non-fatal)", {
          channel,
          message: e?.message,
        });
      }
    } else {
      this.channelRefCounts.set(channel, count - 1);
    }
  }

  /**
   * ⭐ Фаза 3: один общий обработчик "message" на весь subscriber-клиент
   * (не per-channel — ioredis эмитит один и тот же event для ЛЮБОГО
   * канала, на который мы подписаны через subscribe()). Вешаем один раз.
   */
  _ensureMessageHandler() {
    if (this._messageHandlerAttached) return;
    this._messageHandlerAttached = true;

    const sub = getSubscriberClient();
    sub.on("message", (channel, message) => {
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
        debugError("RedisPubSub", "message parse error", e?.message);
      }
    });
  }

  /**
   * Стандартный graphql-subscriptions API.
   * Возвращает AsyncIterator, который резолвит новые payload'ы по триггерам.
   */
  asyncIterator(triggers) {
    const triggerList = Array.isArray(triggers) ? triggers : [triggers];

    // ⭐ Фаза 3: подписываемся ТОЛЬКО на запрошенные каналы (не на "*").
    // Fire-and-forget — не блокируем создание итератора ожиданием сети;
    // см. комментарий вверху файла про компромисс с окном гонки.
    for (const trigger of triggerList) {
      this.subscribeToChannel(trigger).catch((e) =>
        debugError("RedisPubSub", "subscribeToChannel failed", {
          trigger,
          message: e?.message,
        }),
      );
    }

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
        // ⭐ Фаза 3: снимаем реф-каунт и, если это был последний локальный
        // слушатель канала, реально отписываемся от него в Redis — это и
        // есть та часть, которой не было в версии с "*" (там отписываться
        // было не от чего, подписка одна на всё и на весь процесс).
        this.unsubscribeFromChannel(trigger).catch((e) =>
          debugError("RedisPubSub", "unsubscribeFromChannel failed", {
            trigger,
            message: e?.message,
          }),
        );
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
