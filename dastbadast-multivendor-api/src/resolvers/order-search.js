// dastbadast-multivendor-api/src/resolvers/order-search.js
//
// Агрессивный автопоиск курьера (Эшелон 1).
// 3 пуши: при PENDING, при ACCEPTED, эскалация через 90 сек.

import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Restaurant } from "../models/Restaurant.js";
import { pubsub, TOPICS } from "../pubsub.js";
import {
  COURIER_SEARCH_RULES,
  buildPushList,
} from "../lib/order-search-rules.js";

/**
 * Пушит ближайшим курьерам, что появился заказ.
 * Не выбирает курьера — только рассылает уведомления.
 *
 * @param {Object} opts
 * @param {string} opts.orderId
 * @param {number} opts.radiusKm
 * @param {number} opts.count
 * @param {boolean} opts.escalation  — true при второй волне
 * @returns {Promise<string[]>} — список ID уведомлённых курьеров
 */
export async function dispatchCourierSearch({
  orderId,
  radiusKm = COURIER_SEARCH_RULES.INITIAL_PUSH_RADIUS_KM,
  count = COURIER_SEARCH_RULES.INITIAL_PUSH_COUNT,
  escalation = false,
  excludeIds = [],
}) {
  const order = await Order.findById(orderId);
  if (!order) return [];

  // Если курьер уже назначен — не дёргаем остальных
  if (order.riderId) return [];

  // Если заказ уже не ждёт курьера (DELIVERED / CANCELLED) — выходим
  if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return [];

  // Получаем координаты ресторана
  const restaurant = await Restaurant.findById(order.restaurantId).lean();
  const restaurantLocation = restaurant?.location?.coordinates || null;

  // Все доступные курьеры
  const allRiders = await Rider.find({
    available: true,
    isActive: true,
  }).lean();

  // Формируем список (с сортировкой по близости и лимитом)
  const targetRiders = buildPushList({
    riders: allRiders,
    restaurantLocation,
    count: escalation
      ? count + COURIER_SEARCH_RULES.ESCALATION_EXTRA_COUNT
      : count,
    excludeIds,
  });

  if (!targetRiders.length) {
    console.log(`[courier-search] no riders found for order ${orderId}`);
    return [];
  }

  // Фиксируем время пуша в документе
  const tsField = escalation
    ? "statusTimestamps.courierSearchTimestamps.escalationPushedAt"
    : "statusTimestamps.courierSearchTimestamps.initialPushedAt";
  await Order.updateOne({ _id: orderId }, { $set: { [tsField]: new Date() } });

  // Публикуем событие в шину pubsub — каждое rider-app слушает
  // subscriptionAvailableOrders(zoneId) и получает обновлённый заказ.
  // Также шлём целенаправленно в топик AVAILABLE_ORDERS для конкретной зоны.
  if (order.zoneId) {
    pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId.toString()), {
      subscriptionAvailableOrders: order.toObject ? order.toObject() : order,
    });
  }

  // In-app нотификация для конкретных курьеров
  // (используем отдельный топик — rider-app подписывается и проверяет,
  // входит ли он в список targetRiders)
  pubsub.publish(TOPICS.COURIER_SEARCH_NOTIFY, {
    courierSearchNotify: {
      orderId: order._id.toString(),
      orderIdStr: order.orderId,
      restaurantName: restaurant?.name || "Ресторан",
      restaurantLocation,
      riderIds: targetRiders.map((r) => r._id.toString()),
      radiusKm,
      escalation,
      fastAcceptBonus: order.fastAcceptBonus || 0,
      createdAt: new Date().toISOString(),
    },
  });

  console.log(
    `[courier-search] order=${orderId} escalation=${escalation} ` +
      `pushed=${targetRiders.length} riders`,
  );

  return targetRiders.map((r) => r._id.toString());
}

/**
 * Запустить Эшелон 1: первая волна + отложенная эскалация.
 * Вызывается сразу при placeOrder и при acceptOrder.
 */
export async function startCourierSearchEscalation1(orderId) {
  // 1) Мгновенная первая волна
  const firstWave = await dispatchCourierSearch({ orderId, escalation: false });

  // 2) Запланировать вторую волну через 90 сек (если заказ всё ещё ждёт)
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId);
      // Только если заказ всё ещё без курьера
      if (!order || order.riderId) return;
      if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return;

      await dispatchCourierSearch({
        orderId,
        escalation: true,
        excludeIds: firstWave, // чтобы не повторяться
      });
    } catch (e) {
      console.error(
        `[courier-search] escalation failed for ${orderId}:`,
        e?.message,
      );
    }
  }, COURIER_SEARCH_RULES.ESCALATION_DELAY_MS);
}
