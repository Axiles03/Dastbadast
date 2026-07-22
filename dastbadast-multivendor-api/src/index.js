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
import { startOrderExpiryJob } from "./jobs/order-expiry.job.js";
import { startDispatchWorker } from "./queues/dispatch-worker.js"; 
import { startMemoryCleanupJob } from "./cleanup-cron.js";
import { startCacheInvalidationSubscriber } from "./middleware/cache.js";
import { setupGracefulShutdown } from "./middleware/graceful-shutdown.js";
import { debugLog } from "./debug-log.js";

const PORT = parseInt(process.env.PORT, 10) || 8001;
const API_INSTANCES = parseInt(process.env.API_INSTANCES, 10) || 1;

function assertPubSubConfigOrThrow() {
  const usingRedisPubSub = !!(
    process.env.REDIS_URL && process.env.ENABLE_REDIS_PUBSUB !== "0"
  );

  if (API_INSTANCES > 1 && !usingRedisPubSub) {
    // Намеренно валим процесс на старте (а не логируем warning) — PM2
    // покажет "errored" статус вместо тихо работающего, но теряющего
    // события кластера. Лучше не подняться вообще, чем поднять кластер,
    // где ресторан на инстансе B не получает часть заказов.
    throw new Error(
      "[boot] API_INSTANCES > 1 требует REDIS_URL и ENABLE_REDIS_PUBSUB=1 " +
        "(иначе события pubsub не долетают между инстансами кластера). " +
        `Текущее: REDIS_URL=${process.env.REDIS_URL ? "set" : "MISSING"}, ` +
        `ENABLE_REDIS_PUBSUB=${process.env.ENABLE_REDIS_PUBSUB ?? "unset"}`,
    );
  }

  if (!usingRedisPubSub) {
    // Одноинстансный dev/staging — не фатально, но должно быть видно в логах.
    debugLog(
      "boot",
      "⚠️ PubSub работает в режиме InMemoryPubSub (single-instance only)",
    );
  }
}

async function bootstrap() {
  debugLog("boot", "starting", { instances: API_INSTANCES, pid: process.pid });

  // 1) Инициализируем Redis (lazy connect)
  await initRedis();

  // 2) Создаём app + httpServer + apollo (всё в server.js)
  const { app, httpServer, apollo, wsCleanup } = await createServer();

  app.get("/api/admin/accounting/export.csv", async (req, res) => {
    try {
      // ⭐ Авторизация: только SUPER_ADMIN / FINANCE / ANALYST
      // Парсим Bearer token из заголовка вручную — этот роут не GraphQL,
      // поэтому Apollo context не заполняется автоматически.
      const ctx = await resolveContextFromAuthHeader(req.headers.authorization);
      requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST"])(ctx);

      const { from, to } = req.query;
      let dateFilter = {};
      if (from || to) {
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        if (fromDate && toDate && fromDate > toDate) {
          return res.status(400).send("'from' должна быть раньше 'to'");
        }
        dateFilter = {
          ...(fromDate && { $gte: fromDate }),
          ...(toDate && {
            $lte: new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1),
          }),
        };
      }
      // ⭐ Стримим CSV в res (не держим всё в памяти).
      // CSV с разделителем `;` — корректно открывается в Excel на Windows
      // (запятая конфликтует с десятичными разделителями в TJS-локали).
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="accounting-${Date.now()}.csv"`,
      );
      // BOM для Excel — чтобы кириллица отображалась корректно
      res.write("\uFEFF");

      // Заголовки
      res.write(
        "ID заказа;Дата создания;Ресторан;Клиент;Телефон;Сумма;Доставка;Комиссия платформы;Курьер;Статус;Способ оплаты\n",
      );

      // ⭐ Cursor-based stream — НЕ грузим все заказы в память, а идём
      // курсором порциями по 1000. На проде с десятками тысяч заказов
      // это критично для RAM-сервера.
      const cursor = Order.find({
        orderStatus: "DELIVERED",
        ...dateFilter,
      })
        .populate("restaurantId", "name")
        .populate("riderId", "name username")
        .populate("userId", "name phone")
        .sort({ createdAt: -1 })
        .cursor();

      let count = 0;
      const cfgDoc = await Configuration.findById("singleton")
        .select("taxPercent")
        .lean();
      const taxPercent = Number(
        typeof cfgDoc?.taxPercent === "number" ? cfgDoc.taxPercent : 10,
      );

      for await (const order of cursor) {
        const subtotal = order.amounts?.subtotal ?? 0;
        const deliveryFee = order.amounts?.deliveryFee ?? 0;
        const commission = +(subtotal * (taxPercent / 100)).toFixed(2);

        // ⭐ Экранирование CSV-значений: если в поле есть `;` или `"` или
        // перенос строки — оборачиваем в кавычки и удваиваем внутренние
        // кавычки (стандарт RFC 4180).
        const csvEscape = (val) => {
          if (val == null) return "";
          const s = String(val);
          if (s.includes(";") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };

        res.write(
          [
            csvEscape(order.orderId),
            csvEscape(new Date(order.createdAt).toLocaleString("ru-RU")),
            csvEscape(order.restaurantId?.name ?? "—"),
            csvEscape(order.userId?.name ?? "—"),
            csvEscape(order.userId?.phone ?? ""),
            csvEscape(subtotal.toFixed(2)),
            csvEscape(deliveryFee.toFixed(2)),
            csvEscape(commission.toFixed(2)),
            csvEscape(
              order.riderId ? order.riderId.name || order.riderId.username : "",
            ),
            csvEscape(order.orderStatus),
            csvEscape(order.paymentMethod),
          ].join(";") + "\n",
        );
        count++;
      }

      res.end();
      debugLog("export", "csv exported", { count, from, to });
    } catch (e) {
      debugLog("export", "failed", { message: e?.message });
      if (!res.headersSent) {
        if (e.extensions?.code === "UNAUTHENTICATED") {
          res.status(401).send("Unauthorized");
        } else if (e.extensions?.code === "FORBIDDEN") {
          res.status(403).send("Forbidden");
        } else {
          res.status(500).send("Internal error");
        }
      } else {
        res.end();
      }
    }
  });

  // 3) Запускаем cron-задачи + воркеры очередей
  startRiderLocationFlushJob();
  startOrderExpiryJob(); // persistent-таймаут для PENDING-заказов
  await startDispatchWorker(); // persistent курьерский диспетчинг
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
