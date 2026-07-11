// dastbadast-multivendor-api/src/index.js
//
// ⭐ Thin entry point: только listen + init/start cron + shutdown handler.
// Вся инициализация (Apollo, Express, WS) — в server.js (factory).
//
// Зачем выделено:
//   - server.js можно импортировать в тестах без listen
//   - index.js отвечает ТОЛЬКО за lifecycle (start cron, handle SIGTERM)

import { createServer } from "./server.js";
import { initRedis } from "./utils/redis.js";
import { startRiderLocationFlushJob } from "./jobs/rider-location-flush.job.js";
import { startMemoryCleanupJob } from "./cleanup-cron.js";
import { startCacheInvalidationSubscriber } from "./middleware/cache.js";
import { setupGracefulShutdown } from "./middleware/graceful-shutdown.js";
import { debugLog } from "./debug-log.js";

const PORT = parseInt(process.env.PORT, 10) || 8001;
const API_INSTANCES = parseInt(process.env.API_INSTANCES, 10) || 1;

async function bootstrap() {
  debugLog("boot", "starting", { instances: API_INSTANCES, pid: process.pid });

  // 1) Инициализируем Redis (lazy connect)
  await initRedis();

  // 2) Создаём app + httpServer + apollo (всё в server.js)
  const { app, httpServer, apollo, wsCleanup } = await createServer();

  // 3) Запускаем cron-задачи
  startRiderLocationFlushJob();
  startMemoryCleanupJob();
  startCacheInvalidationSubscriber();

  // 4) Graceful shutdown
  setupGracefulShutdown({ httpServer, wsCleanup, apolloServer: apollo });

  // 5) Listen
  httpServer.listen(PORT, "0.0.0.0", () => {
    debugLog("boot", `http listening on 0.0.0.0:${PORT}`, { pid: process.pid });
    console.log(
      `🚀 API instance #${API_INSTANCES} (pid=${process.pid}) ` +
        `http://0.0.0.0:${PORT}/graphql`,
    );
    console.log(`🔌 WS    ws://0.0.0.0:${PORT}/graphql`);
    console.log(`❤️  Health http://0.0.0.0:${PORT}/health/ready`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});
