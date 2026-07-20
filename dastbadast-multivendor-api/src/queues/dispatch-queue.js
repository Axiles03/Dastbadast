// dastbadast-multivendor-api/src/queues/dispatch-queue.js
//
// ⭐ ШАГ 4 (FIX): персистентная очередь отложенных задач диспетчинга курьера.
//
// Раньше `startCourierSearchEscalation1()` и `scheduleJustInTimeDispatch()`
// (см. resolvers/order-search.js) планировали работу через голый
// `setTimeout()` в памяти процесса. Проблема: рестарт Node.js (деплой,
// PM2 reload, краш, OOM-kill) → все запланированные таймеры теряются
// БЕЗВОЗВРАТНО и без следа — ни эскалация через 90 сек, ни JIT-диспетчинг
// к моменту готовности заказа не произойдут, и никто об этом не узнает.
//
// Решение: BullMQ поверх Redis (Redis в проекте уже есть — utils/redis.js,
// используется под rate-limit и exclude-листы курьеров). BullMQ хранит
// отложенные задачи в Redis, а не в памяти процесса — при рестарте Worker
// просто продолжает разбирать очередь с того места, где остановился.
// Как бонус — это же убирает проблему "продублированного" таймера, если
// когда-нибудь API будет работать в нескольких инстансах (API_INSTANCES > 1,
// см. ecosystem.config.js): BullMQ гарантирует, что job с одним jobId
// возьмёт только один Worker.
//
// ⚠️ Требует РЕАЛЬНОГО Redis (не in-memory fallback). Если REDIS_URL не
// задан или Redis недоступен — очередь считается ОТКЛЮЧЁННОЙ, и вызывающий
// код (order-search.js) сам должен откатиться на старый setTimeout-путь
// (graceful degradation — тот же принцип, что уже применяется для
// exclude-листов и rate-limit в этом проекте).

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { debugLog, debugWarn, debugError } from "../debug-log.js";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = process.env.REDIS_URL || null;

export const DISPATCH_QUEUE_NAME = "courier-dispatch";

// ⭐ У BullMQ — свой, ОТДЕЛЬНЫЙ от utils/redis.js коннект. Причины:
//   1) BullMQ требует `maxRetriesPerRequest: null` (иначе блокирующие
//      команды воркера — BLPOP и т.п. — могут падать по таймауту retry).
//      Это конфликтует с настройками hot-path клиента в utils/redis.js
//      (enableOfflineQueue: false, maxRetriesPerRequest: 2 — там это
//      осознанный выбор для fail-fast, здесь он был бы багом).
//   2) Один Redis-connection не должен одновременно использоваться и как
//      обычный клиент, и как blocking-consumer BullMQ — это официальная
//      рекомендация авторов BullMQ.
let connection = null;
function getDispatchConnection() {
  if (connection) return connection;
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    // Нет явной конфигурации Redis — не создаём соединение вообще
    // (в dev/без Redis очередь должна быть просто выключена).
    return null;
  }
  const url = REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`;
  connection = new IORedis(url, {
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null, // ⭐ обязательно для BullMQ
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });
  connection.on("error", (err) => {
    debugWarn("dispatch-queue", "redis connection error", err.message);
  });
  return connection;
}

let queue = null;
let enabled = null; // null = ещё не проверяли, true/false = закешированный результат

/**
 * ⭐ Есть ли рабочий Redis для персистентной очереди?
 * Проверяется один раз (лениво, при первом обращении) и кешируется —
 * чтобы не делать PING на каждый placeOrder/acceptOrder.
 * Если Redis отвалится ПОСЛЕ старта — Queue.add() ниже упадёт сам,
 * и вызывающий код (order-search.js) поймает ошибку и откатится на setTimeout.
 */
export async function isDispatchQueueEnabled() {
  if (enabled !== null) return enabled;
  const conn = getDispatchConnection();
  if (!conn) {
    enabled = false;
    return false;
  }
  try {
    if (conn.status !== "ready" && conn.status !== "connecting") {
      await conn.connect();
    }
    await conn.ping();
    enabled = true;
    debugLog("dispatch-queue", "BullMQ persistent queue enabled");
  } catch (e) {
    enabled = false;
    debugWarn(
      "dispatch-queue",
      "Redis unavailable, falling back to in-memory setTimeout",
      e?.message,
    );
  }
  return enabled;
}

function getQueue() {
  if (queue) return queue;
  const conn = getDispatchConnection();
  if (!conn) return null;
  queue = new Queue(DISPATCH_QUEUE_NAME, { connection: conn });
  return queue;
}

/**
 * ⭐ Запланировать (или ПЕРЕПЛАНИРОВАТЬ) отложенную задачу диспетчинга.
 *
 * Идемпотентно по jobId: если задача с таким id уже стоит в очереди
 * (например, ресторан изменил prepTime и accept вызвался повторно) —
 * старая удаляется и создаётся новая с новой задержкой. Это тот же
 * идемпотентный контракт, что был у setTimeout-версии (там просто
 * стартовал новый таймер, но старый было НЕЧЕМ отменить — эта версия
 * лучше и в этом смысле тоже, см. cancelDispatchJob).
 *
 * @returns {Promise<boolean>} true если задача поставлена в персистентную
 *   очередь, false если нужно откатиться на setTimeout (Redis недоступен).
 */
export async function scheduleDispatchJob({ name, jobId, data, delayMs }) {
  if (!(await isDispatchQueueEnabled())) return false;
  const q = getQueue();
  if (!q) return false;

  try {
    await cancelDispatchJob(jobId);
    await q.add(name, data, {
      jobId,
      delay: Math.max(0, delayMs),
      removeOnComplete: 500,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    return true;
  } catch (e) {
    debugError("dispatch-queue", "scheduleDispatchJob failed", {
      jobId,
      message: e?.message,
    });
    return false;
  }
}

/**
 * ⭐ Отменить ранее запланированную задачу (если ещё не выполнилась).
 * Используется, например, если заказ отменили до того, как настало время
 * JIT-диспетчинга — раньше это было невозможно (setTimeout нечем было отменить
 * без хранения его ссылки, и она бы всё равно потерялась при рестарте).
 */
export async function cancelDispatchJob(jobId) {
  if (!(await isDispatchQueueEnabled())) return false;
  const q = getQueue();
  if (!q) return false;
  try {
    const job = await q.getJob(jobId);
    if (job) await job.remove();
    return true;
  } catch (e) {
    // Job уже выполняется/выполнен — remove() может упасть, это не ошибка
    debugWarn("dispatch-queue", "cancelDispatchJob no-op", {
      jobId,
      message: e?.message,
    });
    return false;
  }
}

export async function closeDispatchQueue() {
  try {
    if (queue) await queue.close();
  } catch (e) {
    debugWarn("dispatch-queue", "queue close error", e?.message);
  }
  try {
    if (connection) await connection.quit();
  } catch (e) {
    debugWarn("dispatch-queue", "connection close error", e?.message);
  }
  queue = null;
  connection = null;
  enabled = null;
}
