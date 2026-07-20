// dastbadast-multivendor-api/src/queues/dispatch-worker.js
//
// ⭐ ШАГ 4 (FIX): Worker, разбирающий персистентную очередь курьерского
// диспетчинга (dispatch-queue.js). Запускается один раз при старте
// процесса (index.js) — точно так же, как остальные cron-джобы проекта.
//
// Job.name → что делаем:
//   "escalation"    → повторная (расширенная) волна поиска курьера,
//                      если заказ всё ещё не взят через ESCALATION_DELAY_MS
//                      после первой волны.
//   "just-in-time"  → первый старт поиска курьера за COURIER_LEAD_TIME_MIN
//                      минут до готовности заказа (по prepTime).
//
// Сама бизнес-логика (геопоиск, фильтрация курьеров и т.д.) не дублируется
// здесь — воркер лишь вызывает те же функции, что раньше вызывались из
// setTimeout-колбэков в resolvers/order-search.js.

import { Worker } from "bullmq";
import {
  DISPATCH_QUEUE_NAME,
  isDispatchQueueEnabled,
} from "./dispatch-queue.js";
import {
  runEscalationWave,
  runJustInTimeDispatch,
} from "../resolvers/order-search.js";
import { debugLog, debugError, debugWarn } from "../debug-log.js";

const JOB_NAME = "dispatch-worker";

const HANDLERS = {
  escalation: (data) => runEscalationWave(data.orderId),
  "just-in-time": (data) => runJustInTimeDispatch(data.orderId),
};

let worker = null;

export async function startDispatchWorker() {
  if (worker) {
    debugWarn(JOB_NAME, "already started");
    return;
  }
  if (!(await isDispatchQueueEnabled())) {
    debugLog(
      JOB_NAME,
      "Redis unavailable — persistent dispatch queue disabled, " +
        "order-search.js will fall back to in-memory setTimeout",
    );
    return;
  }

  // ⭐ Отдельное ioredis-соединение под воркер (тоже требует
  // maxRetriesPerRequest: null) — переиспользуем ту же фабрику
  // соединения, что и Queue, через приватный доступ не нужен: BullMQ
  // Worker принимает те же connection-опции, что и Queue.
  const { default: IORedis } = await import("ioredis");
  const REDIS_URL =
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || "127.0.0.1"}:${
      parseInt(process.env.REDIS_PORT, 10) || 6379
    }`;
  const workerConnection = new IORedis(REDIS_URL, {
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });

  worker = new Worker(
    DISPATCH_QUEUE_NAME,
    async (job) => {
      const handler = HANDLERS[job.name];
      if (!handler) {
        debugWarn(JOB_NAME, "unknown job name, skipping", { name: job.name });
        return;
      }
      await handler(job.data);
    },
    {
      connection: workerConnection,
      concurrency: 10,
    },
  );

  worker.on("completed", (job) => {
    debugLog(JOB_NAME, "job completed", { id: job.id, name: job.name });
  });
  worker.on("failed", (job, err) => {
    debugError(JOB_NAME, "job failed", {
      id: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      message: err?.message,
    });
  });

  debugLog(JOB_NAME, "started");
}

export async function stopDispatchWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    debugLog(JOB_NAME, "stopped");
  }
}
