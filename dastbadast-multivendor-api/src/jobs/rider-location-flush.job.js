// dastbadast-multivendor-api/src/jobs/rider-location-flush.job.js
//
// ⭐⭐⭐ Cron-задача: каждые 5 минут сбрасывает координаты курьеров
// из Redis в MongoDB. Это снимает 90% нагрузки с Mongo (было 360 записей/час/курьер,
// стало 12 — раз в 5 минут).
//
// Стратегия:
//   1) Получаем всех riderId из SET rider:loc:index
//   2) Для каждого читаем HASH rider:loc:{riderId}
//   3) Делаем bulkWrite (upsert по _id) с location + lastLocationAt
//   4) Удаляем из Redis (cron зачистит и индекс)
//
// Использует bulkWrite, чтобы за O(1) round-trip сделать 1 запрос к Mongo.

import cron from "node-cron";
import { Rider } from "../models/Rider.js";
import {
  getAllRiderIdsInRedis,
  getRiderLocationFromRedis,
  removeRiderFromRedis,
} from "../services/rider-location.service.js";
import { debugLog, debugError, debugWarn } from "../debug-log.js";

const JOB_NAME = "rider-location-flush";
const CRON_EXPR = "*/5 * * * *"; // каждые 5 минут

/**
 * Один прогон flush: читает из Redis → пишет в Mongo bulk'ом → чистит Redis.
 * Вызывается как из cron, так и вручную (для тестов).
 */
async function runFlush() {
  const riderIds = await getAllRiderIdsInRedis();
  if (riderIds.length === 0) {
    debugLog(JOB_NAME, "no riders in redis, skip");
    return;
  }

  const startedAt = Date.now();
  const ops = [];

  for (const riderId of riderIds) {
    const loc = await getRiderLocationFromRedis(riderId);
    if (!loc) {
      // Данные протухли (TTL истёк между чтениями) — просто убираем из индекса
      await removeRiderFromRedis(riderId);
      continue;
    }

    ops.push({
      updateOne: {
        filter: { _id: riderId },
        update: {
          $set: {
            location: { type: "Point", coordinates: [loc.lng, loc.lat] },
            lastLocationAt: new Date(loc.updatedAt),
            bearing: loc.bearing,
          },
        },
      },
    });
  }

  if (ops.length === 0) return;

  try {
    const result = await Rider.bulkWrite(ops, { ordered: false });
    debugLog(JOB_NAME, "flush ok", {
      count: ops.length,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      ms: Date.now() - startedAt,
    });

    // ⭐ Зачищаем Redis ПОСЛЕ успешной записи в Mongo
    // (если Mongo упал — Redis остаётся, и в следующий cron повторим)
    await Promise.all(
      ops.map((op) => removeRiderFromRedis(op.updateOne.filter._id)),
    );
  } catch (e) {
    debugError(JOB_NAME, "bulkWrite failed", e?.message);
    // Не удаляем из Redis — повторим в следующий cron
  }
}

let task = null;

/**
 * Запустить cron-задачу. Безопасно вызывать многократно.
 *
 * ENV: DISABLE_CRON=1 отключает cron (удобно для dev-режима без Redis).
 */
export function startRiderLocationFlushJob() {
  if (task) {
    debugWarn(JOB_NAME, "already started");
    return;
  }
  if (process.env.DISABLE_CRON === "1") {
    debugLog(JOB_NAME, "disabled via env");
    return;
  }

  task = cron.schedule(
    CRON_EXPR,
    () => {
      runFlush().catch((e) =>
        debugError(JOB_NAME, "uncaught error", e?.message),
      );
    },
    { scheduled: true, timezone: "Asia/Dushanbe" },
  );

  debugLog(JOB_NAME, "started", { expr: CRON_EXPR });
}

/**
 * Остановить cron-задачу (graceful shutdown).
 */
export function stopRiderLocationFlushJob() {
  if (task) {
    task.stop();
    task = null;
    debugLog(JOB_NAME, "stopped");
  }
}

export { runFlush };
