// dastbadast-multivendor-api/src/cleanup-cron.js
//
// ⭐ Cron-задача для очистки устаревших in-memory Map'ов.
// Без этого при долгой работе процесса (несколько дней) память течёт
// (отключённые курьеры, завершённые чаты, протухшие курьерские локации).
//
// Запускается каждую минуту (CRON: * * * * *).
// Удаляет записи старше TTL_SECONDS.

import cron from "node-cron";
import { debugLog, debugWarn } from "./debug-log.js";

const JOB_NAME = "memory-cleanup";
const CRON_EXPR = "* * * * *"; // каждую минуту

/**
 * @param {Array<{name: string, map: Map<any, {at: number}>, ttlMs: number, maxSize?: number}>} registries
 *   - name: имя для логов
 *   - map: Map, где у значений есть поле `at` (timestamp)
 *   - ttlMs: удалять записи старше ttlMs
 *   - maxSize: (опц.) если Map больше maxSize, удалять самые старые до N
 */
function cleanupRegistry({ name, map, ttlMs, maxSize }) {
  if (!map || map.size === 0) return 0;
  const now = Date.now();
  let removed = 0;

  // 1) По TTL
  for (const [key, value] of map.entries()) {
    if (value && value.at && now - value.at > ttlMs) {
      map.delete(key);
      removed++;
    }
  }

  // 2) По размеру (если задан)
  if (maxSize && map.size > maxSize) {
    // Удаляем самые старые (в порядке вставки Map сохраняет insertion order)
    const excess = map.size - maxSize;
    let i = 0;
    for (const key of map.keys()) {
      if (i >= excess) break;
      map.delete(key);
      removed++;
      i++;
    }
  }

  if (removed > 0) {
    debugLog(JOB_NAME, `cleaned ${name}`, {
      removed,
      remaining: map.size,
    });
  }
  return removed;
}

let task = null;
let registries = [];

export function registerRegistry(name, map, ttlMs, maxSize) {
  registries.push({ name, map, ttlMs, maxSize });
  debugLog(JOB_NAME, `registered ${name}`, { ttlMs, maxSize });
}

export function startMemoryCleanupJob() {
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
      for (const reg of registries) {
        try {
          cleanupRegistry(reg);
        } catch (e) {
          debugWarn(JOB_NAME, `cleanup ${reg.name} failed`, e?.message);
        }
      }
    },
    { scheduled: true, timezone: "Asia/Dushanbe" },
  );

  debugLog(JOB_NAME, "started", { expr: CRON_EXPR, count: registries.length });
}

export function stopMemoryCleanupJob() {
  if (task) {
    task.stop();
    task = null;
    debugLog(JOB_NAME, "stopped");
  }
}
