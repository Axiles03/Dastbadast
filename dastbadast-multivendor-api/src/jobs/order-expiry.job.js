// dastbadast-multivendor-api/src/jobs/order-expiry.job.js
//
// ⭐ ШАГ 2 (FIX): персистентная автоотмена "зависших" PENDING-заказов.
//
// Раньше единственным местом, где заказ переводился из PENDING в
// CANCELLED/AUTO_EXPIRED, была `expireIfPending()` (см. lib/order-timeouts.js) —
// но она вызывается ЛЕНИВО, только изнутри резолверов `order`/`orders`, то
// есть только когда КТО-ТО реально запрашивает заказ. Если ни клиент, ни
// ресторан не открывают приложение (например, пользователь оформил заказ
// и сразу закрыл вкладку, а ресторан не проверяет список) — заказ виснет
// в PENDING бессрочно, никто его не отменит.
//
// Это независимый cron-джоб, который раз в минуту проходит по ВСЕМ
// просроченным PENDING-заказам и переводит их в CANCELLED сам, без
// зависимости от чьих-либо запросов. `expireIfPending()` в резолверах
// остаётся — она даёт мгновенный UX-отклик, если клиент как раз в этот
// момент смотрит на заказ, а этот cron — гарантия на случай, что никто
// не смотрит.

import cron from "node-cron";
import { Order } from "../models/Order.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { PENDING_TIMEOUT_SECONDS } from "../lib/order-timeouts.js";
import { debugLog, debugError, debugWarn } from "../debug-log.js";

const JOB_NAME = "order-expiry-sweep";
const CRON_EXPR = "* * * * *"; // каждую минуту — тот же ритм, что у cleanup-cron
const BATCH_LIMIT = 200; // safety: не обрабатывать больше N заказов за один прогон

/**
 * Один прогон: находит просроченные PENDING-заказы, атомарно переводит
 * каждый в CANCELLED (с условием orderStatus=PENDING в фильтре — чтобы
 * не перезаписать заказ, который прямо сейчас принимает ресторан через
 * acceptOrder), публикует события для подписчиков.
 *
 * Обрабатывает заказы ПООЧЕРЁДНО через findOneAndUpdate (не bulkWrite),
 * потому что после каждого обновления нужно точечно паблишить в pubsub —
 * а bulkWrite не возвращает обновлённые документы.
 */
export async function runOrderExpirySweep() {
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_SECONDS * 1000);

  // ⭐ Ищем PENDING-заказы, у которых pendingAt (или createdAt как fallback
  // для старых записей без pendingAt) старше cutoff.
  // Используется существующий индекс
  // { orderStatus: 1, riderId: 1, "statusTimestamps.pendingAt": 1 }
  // (partial: riderId=null, orderStatus in [PENDING, ACCEPTED]).
  const candidates = await Order.find({
    orderStatus: "PENDING",
    $or: [
      { "statusTimestamps.pendingAt": { $lte: cutoff } },
      {
        "statusTimestamps.pendingAt": null,
        createdAt: { $lte: cutoff },
      },
    ],
  })
    .select("_id")
    .limit(BATCH_LIMIT)
    .lean();

  if (candidates.length === 0) {
    return { checked: 0, expired: 0 };
  }

  let expired = 0;
  const startedAt = Date.now();

  for (const { _id } of candidates) {
    try {
      // ⭐ Атомарно: условие orderStatus="PENDING" в фильтре защищает от
      // гонки с acceptOrder/cancelOrder (см. order-actions.js, ШАГ 1) —
      // если ресторан только что принял заказ, этот update просто не
      // сработает (вернёт null), и мы его пропустим.
      const order = await Order.findOneAndUpdate(
        { _id, orderStatus: "PENDING" },
        {
          $set: {
            orderStatus: "CANCELLED",
            cancelReason: "AUTO_EXPIRED",
            "statusTimestamps.cancelledAt": new Date(),
          },
        },
        { new: true },
      );

      if (!order) continue; // кто-то успел принять/отменить между find и update

      expired++;

      pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
        subscriptionOrder: order,
      });
      pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
        orderStatusChanged: order,
      });
      if (order.zoneId) {
        pubsub.publish(TOPICS.ZONE_ORDERS(order.zoneId.toString()), {
          subscriptionZoneOrders: order,
        });
      }
    } catch (e) {
      debugError(JOB_NAME, "expire failed for order", {
        orderId: String(_id),
        message: e?.message,
      });
      // продолжаем со следующим заказом — единичная ошибка не должна
      // останавливать весь прогон
    }
  }

  debugLog(JOB_NAME, "sweep done", {
    checked: candidates.length,
    expired,
    ms: Date.now() - startedAt,
  });

  return { checked: candidates.length, expired };
}

let task = null;

/**
 * Запустить cron-задачу. Безопасно вызывать многократно.
 * ENV: DISABLE_CRON=1 отключает cron (как и у остальных джобов в проекте).
 */
export function startOrderExpiryJob() {
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
      runOrderExpirySweep().catch((e) =>
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
export function stopOrderExpiryJob() {
  if (task) {
    task.stop();
    task = null;
    debugLog(JOB_NAME, "stopped");
  }
}
