// dastbadast-multivendor-api/src/lib/order-timeouts.js
//
// Единое место настройки таймаута подтверждения заказа рестораном.
// Если ресторан не подтвердил заказ за PENDING_TIMEOUT_SECONDS,
// заказ автоматически переводится в CANCELLED с cancelReason = "AUTO_EXPIRED".
// Клиент видит это как «истёкший» заказ.

import { pubsub, TOPICS } from "../pubsub.js";

/**
 * ⭐ Константа: через сколько секунд PENDING-заказ автоотменяется.
 * Чтобы изменить на 7/10/15 минут — правим ТОЛЬКО эту переменную.
 */
export const PENDING_TIMEOUT_SECONDS = 5 * 60; // 5 минут

/**
 * Lazy-проверка заказа: если он висит в PENDING дольше лимита —
 * переводим в CANCELLED, публикуем событие в подписки, сохраняем в БД.
 *
 * Возвращает (возможно обновлённый) документ заказа.
 */
export async function expireIfPending(order) {
  if (!order) return order;
  if (order.orderStatus !== "PENDING") return order;

  // pendingAt может быть null на старых заказах — fallback на createdAt
  const pendingAt = order.statusTimestamps?.pendingAt || order.createdAt;
  if (!pendingAt) return order;

  const elapsedSec = (Date.now() - new Date(pendingAt).getTime()) / 1000;
  if (elapsedSec < PENDING_TIMEOUT_SECONDS) return order;

  // ── Помечаем как отменённый по таймауту ──
  order.orderStatus = "CANCELLED";
  order.cancelReason = "AUTO_EXPIRED";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.cancelledAt = new Date();

  try {
    await order.save();
  } catch (e) {
    // Если save упал (например, БД моргнула) — не блокируем UI.
    // Вернём обновлённый in-memory объект, клиент увидит EXPIRED,
    // а на следующий запрос БД вернёт актуальное состояние.
    console.warn(
      "[order-timeouts] save failed, but marking as EXPIRED in-memory:",
      e?.message,
    );
  }

  // ── Публикуем события для всех подписчиков (web + rider) ──
  try {
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
    console.warn("[order-timeouts] pubsub.publish failed:", e?.message);
  }

  console.log(
    `[order-timeouts] Order ${order._id} auto-cancelled (PENDING > ${PENDING_TIMEOUT_SECONDS}s)`,
  );
  return order;
}
