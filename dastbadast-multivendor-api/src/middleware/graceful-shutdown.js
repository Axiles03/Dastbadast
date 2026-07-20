// dastbadast-multivendor-api/src/middleware/graceful-shutdown.js
//
// ⭐ Graceful shutdown: при SIGTERM/SIGINT:
//   1) Перестаём принимать новые HTTP/WS-соединения
//   2) Дренаж: ждём, пока активные запросы завершатся (max 30 сек)
//   3) Закрываем WS-сервер (с notify clients)
//   4) Останавливаем ApolloServer
//   5) Закрываем Redis/Mongo соединения
//   6) Останавливаем cron-задачи
//   7) process.exit(0) (или 1 по таймауту)
//
// ВАЖНО: kubernetes при rolling update шлёт SIGTERM и ждёт gracePeriod (default 30 сек).
// Если процесс не успел — шлёт SIGKILL (без возможности cleanup).

import { debugLog, debugWarn } from "../debug-log.js";
import { stopRiderLocationFlushJob } from "../jobs/rider-location-flush.job.js";
import { stopOrderExpiryJob } from "../jobs/order-expiry.job.js"; // ⭐ ШАГ 2
import { stopDispatchWorker } from "../queues/dispatch-worker.js"; // ⭐ ШАГ 4
import { closeDispatchQueue } from "../queues/dispatch-queue.js"; // ⭐ ШАГ 4
import { stopMemoryCleanupJob } from "../cleanup-cron.js";

const SHUTDOWN_TIMEOUT_MS = 25_000; // 25 сек (k8s default 30)
let isShuttingDown = false;

export function setupGracefulShutdown({
  httpServer,
  wsCleanup, // dispose() из graphql-ws useServer
  apolloServer, // ApolloServer instance (для stop())
}) {
  const onSignal = async (signal) => {
    if (isShuttingDown) {
      debugWarn("shutdown", `received ${signal} during shutdown, ignoring`);
      return;
    }
    isShuttingDown = true;
    debugLog("shutdown", `received ${signal}, starting graceful shutdown`);

    // ⭐ Hard timeout — если за 25 сек не завершились, выходим с ошибкой
    const hardKill = setTimeout(() => {
      console.error("❌ Graceful shutdown timeout, force exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    hardKill.unref();

    try {
      // 1) Прекращаем принимать новые соединения
      debugLog("shutdown", "step 1/6: closing http server");
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });

      // 2) Дренаж WS-подписок (graphql-ws шлёт close всем клиентам)
      debugLog("shutdown", "step 2/6: disposing WS server");
      if (wsCleanup && typeof wsCleanup.dispose === "function") {
        await wsCleanup.dispose();
      }

      // 3) Останавливаем ApolloServer (закрывает GraphQL context'ы)
      debugLog("shutdown", "step 3/6: stopping apollo");
      if (apolloServer) {
        // apolloServer.stop() очищает кэш и отменяет фоновые операции
        // (если поддерживается версией; в Apollo 5 — async)
        try {
          await apolloServer.stop();
        } catch (e) {
          debugWarn("shutdown", "apollo.stop error", e?.message);
        }
      }

      // 4) Останавливаем cron-задачи и воркеры очередей
      debugLog("shutdown", "step 4/7: stopping cron jobs and workers");
      try {
        stopRiderLocationFlushJob();
        stopOrderExpiryJob(); // ⭐ ШАГ 2
        stopMemoryCleanupJob();
        // ⭐ ШАГ 4: дожидаемся, пока воркер добьёт текущий job (BullMQ сам
        // не убьёт job в процессе — close() ждёт завершения активных),
        // затем закрываем очередь и её Redis-соединение.
        await stopDispatchWorker();
        await closeDispatchQueue();
      } catch (e) {
        debugWarn("shutdown", "cron/worker stop error", e?.message);
      }

      // 5) Закрываем Mongo (import dynamic, чтобы не тянуть mongoose сюда)
      debugLog("shutdown", "step 5/7: closing mongo");
      try {
        const mongoose = await import("mongoose");
        await mongoose.disconnect();
      } catch (e) {
        debugWarn("shutdown", "mongo disconnect error", e?.message);
      }

      // 6) Закрываем Redis
      debugLog("shutdown", "step 6/7: closing redis (hot-path client)");
      try {
        const { getRedis } = await import("../utils/redis.js");
        const client = getRedis();
        await client.quit();
      } catch (e) {
        debugWarn("shutdown", "redis quit error", e?.message);
      }

      debugLog("shutdown", "✓ graceful shutdown complete");
      clearTimeout(hardKill);
      process.exit(0);
    } catch (e) {
      console.error("❌ Shutdown error:", e);
      clearTimeout(hardKill);
      process.exit(1);
    }
  };

  // ⭐ k8s при rolling update шлёт SIGTERM, docker stop тоже SIGTERM
  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));

  // Необработанные ошибки — логируем и завершаем
  process.on("uncaughtException", (err) => {
    console.error("💥 uncaughtException:", err);
    onSignal("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("💥 unhandledRejection:", reason);
  });
}
