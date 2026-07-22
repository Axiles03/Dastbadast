// dastbadast-multivendor-api/src/jobs/food-availability-sweep.job.js
//
// ⭐ ФАЗА 2 (аудит, п.9): авто-возврат блюда в продажу по истечении
// unavailableUntil. Паттерн скопирован 1-в-1 с order-expiry.job.js —
// тот же ритм (раз в минуту), тот же принцип атомарного findOneAndUpdate
// с условием в фильтре, та же защита batch limit.

import cron from "node-cron";
import { Food } from "../models/Food.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { debugLog, debugError } from "../debug-log.js";

const JOB_NAME = "food-availability-sweep";
const CRON_EXPR = "* * * * *";
const BATCH_LIMIT = 500;

export async function runFoodAvailabilitySweep() {
  const now = new Date();

  const candidates = await Food.find({
    isAvailable: false,
    unavailableUntil: { $ne: null, $lte: now },
  })
    .select("_id restaurantId")
    .limit(BATCH_LIMIT)
    .lean();

  if (candidates.length === 0) return { checked: 0, restored: 0 };

  let restored = 0;

  for (const { _id, restaurantId } of candidates) {
    try {
      // ⭐ Условие isAvailable=false в фильтре — если менеджер уже вручную
      // включил блюдо раньше срока, этот update просто не сработает
      // (не перезатирает его решение обратно на false→true повторно,
      // it's idempotent no-op — nothing to restore).
      const food = await Food.findOneAndUpdate(
        { _id, isAvailable: false, unavailableUntil: { $ne: null, $lte: now } },
        { $set: { isAvailable: true, unavailableUntil: null } },
        { new: true },
      );

      if (food) {
        restored++;
        // ⭐ То же событие, что и ручной toggle (см. Фаза 1, п.4) — клиент
        // должен узнать про возврат в продажу так же мгновенно, как и про 86.
        pubsub.publish(
          TOPICS.MENU_AVAILABILITY_CHANGED(restaurantId.toString()),
          {
            subscriptionMenuAvailability: {
              foodId: food._id.toString(),
              restaurantId: restaurantId.toString(),
              isAvailable: true,
            },
          },
        );
      }
    } catch (e) {
      debugError(JOB_NAME, "failed to restore food availability", {
        foodId: _id.toString(),
        error: e.message,
      });
    }
  }

  return { checked: candidates.length, restored };
}

let scheduledTask = null;

export function startFoodAvailabilitySweepJob() {
  scheduledTask = cron.schedule(CRON_EXPR, async () => {
    try {
      const result = await runFoodAvailabilitySweep();
      if (result.restored > 0) {
        debugLog(
          JOB_NAME,
          `restored ${result.restored}/${result.checked} items`,
        );
      }
    } catch (e) {
      debugError(JOB_NAME, "sweep failed", { error: e.message });
    }
  });
  debugLog(JOB_NAME, `scheduled (${CRON_EXPR})`);
}

// ⭐ Симметрично startOrderExpiryJob/stopOrderExpiryJob — для graceful
// shutdown (см. src/index.js, обработчик SIGTERM).
export function stopFoodAvailabilitySweepJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Регистрация — src/index.js:
//   import { startFoodAvailabilitySweepJob, stopFoodAvailabilitySweepJob } from "./jobs/food-availability-sweep.job.js";
//   ...
//   startFoodAvailabilitySweepJob(); // рядом со startOrderExpiryJob()
//   ...
// и в обработчике SIGTERM/graceful shutdown рядом со stopOrderExpiryJob():
//   stopFoodAvailabilitySweepJob();
