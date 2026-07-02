// dastbadast-multivendor-api/src/resolvers/delivery.js
//
// ⭐⭐⭐ НОВЫЕ МУТАЦИИ ДЛЯ DELIVERY API (UberEats-стандарт)
//
// Применяются на бэкенде: ресторан -> курьер.
// Подписки публикуются в pubsub.js → клиенты получают в реальном времени.

import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Restaurant } from "../models/Restaurant.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { dispatchCourierSearch } from "./order-search.js";
import { etaForRiderToAddress } from "../utils/eta.js";

/* ================== HELPERS ================== */

function requireRestaurant(ctx) {
  if (!ctx.restaurant) {
    throw new GraphQLError("Not authenticated as restaurant", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.restaurant;
}

function requireRider(ctx) {
  if (!ctx.rider) {
    throw new GraphQLError("Not authenticated as rider", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.rider;
}

/**
 * State machine для переходов статуса.
 * Возвращает true, если переход из currentStatus → nextStatus разрешён.
 *
 * Граф:
 *   PENDING  → ACCEPTED, CANCELLED
 *   ACCEPTED → PREPARING, READY_FOR_PICKUP, CANCELLED
 *   PREPARING → READY_FOR_PICKUP, CANCELLED
 *   READY_FOR_PICKUP → ASSIGNED, CANCELLED  (ASSIGNED когда курьер взял)
 *   ASSIGNED → PICKED, CANCELLED
 *   PICKED   → EN_ROUTE_TO_DROP_OFF, AWAITING_CONFIRMATION, CANCELLED
 *   EN_ROUTE_TO_DROP_OFF → ARRIVED_AT_DROP_OFF
 *   ARRIVED_AT_DROP_OFF → AWAITING_CONFIRMATION
 *   AWAITING_CONFIRMATION → DELIVERED
 *   DELIVERED → (terminal)
 *   CANCELLED → (terminal)
 */
const ALLOWED_TRANSITIONS = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "READY_FOR_PICKUP", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED", "CANCELLED"],
  PICKED: ["EN_ROUTE_TO_DROP_OFF", "AWAITING_CONFIRMATION", "CANCELLED"],
  EN_ROUTE_TO_DROP_OFF: ["ARRIVED_AT_DROP_OFF", "AWAITING_CONFIRMATION"],
  ARRIVED_AT_DROP_OFF: ["AWAITING_CONFIRMATION"],
  AWAITING_CONFIRMATION: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

function assertCanTransition(order, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[order.orderStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new GraphQLError(
      `Недопустимый переход: ${order.orderStatus} → ${nextStatus}. ` +
        `Разрешено: ${allowed.join(", ") || "(terminal)"}`,
      { extensions: { code: "BAD_STATE" } },
    );
  }
}

/* ================== МУТАЦИИ ДЛЯ РЕСТОРАНА ================== */

/**
 * ⭐⭐⭐ NEW: ресторан переводит заказ в PREPARING
 * (семантический алиас для ACCEPTED — кухня начала готовить).
 *
 * GraphQL:
 *   markOrderPreparing(orderId: ID!): Order!
 */
export const markOrderPreparing = async (_p, { orderId }, ctx) => {
  const r = requireRestaurant(ctx);
  const order = await Order.findById(orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (order.restaurantId.toString() !== r._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  assertCanTransition(order, "PREPARING");

  order.orderStatus = "PREPARING";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.acceptedAt =
    order.statusTimestamps.acceptedAt || new Date();
  await order.save();

  // ⭐ Broadcast: всем подписантам (включая курьеров в pool, клиента, store UI)
  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  return order;
};

/**
 * ⭐⭐⭐ NEW: ресторан пометил заказ как готовый (еда в пакете, ждёт курьера).
 * Запускает Эшелон 2 поиска курьера с высоким приоритетом.
 *
 * GraphQL:
 *   markOrderReady(orderId: ID!): Order!
 */
export const markOrderReady = async (_p, { orderId }, ctx) => {
  const r = requireRestaurant(ctx);
  const order = await Order.findById(orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (order.restaurantId.toString() !== r._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  assertCanTransition(order, "READY_FOR_PICKUP");

  order.orderStatus = "READY_FOR_PICKUP";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.readyAt = new Date();
  await order.save();

  // Уведомляем клиента: еда готова, скоро курьер
  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  // ⭐ КРИТИЧНО: триггерим Эшелон 2 — расширенный поиск курьера
  // (все доступные в зоне, а не только первая волна)
  await dispatchCourierSearch({
    orderId: order._id.toString(),
    radiusKm: 8, // расширенный радиус
    count: 10, // больше кандидатов
    escalation: true, // помечаем как urgent
  });

  return order;
};

/* ================== МУТАЦИИ ДЛЯ КУРЬЕРА ================== */

/**
 * ⭐⭐⭐ NEW: курьер принял заказ (аналог существующего claimOrder,
 * но с поддержкой READY_FOR_PICKUP и расчётом ETA до ресторана).
 *
 * GraphQL:
 *   acceptDelivery(orderId: ID!): Order!
 */
export const acceptDelivery = async (_p, { orderId }, ctx) => {
  const rider = requireRider(ctx);

  if (!rider.available) {
    throw new GraphQLError("Включите статус «Доступен», чтобы брать заказы", {
      extensions: { code: "RIDER_UNAVAILABLE" },
    });
  }

  // Проверка: у курьера не должно быть активных заказов
  const active = await Order.countDocuments({
    riderId: rider._id,
    orderStatus: {
      $in: [
        "ASSIGNED",
        "PICKED",
        "EN_ROUTE_TO_DROP_OFF",
        "ARRIVED_AT_DROP_OFF",
      ],
    },
  });
  if (active > 0) {
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }

  // Race-condition safe: атомарное обновление
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: { $in: ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"] },
      riderId: null,
    },
    {
      $set: {
        riderId: rider._id,
        orderStatus: "ASSIGNED",
        "statusTimestamps.assignedAt": new Date(),
      },
    },
    { new: true },
  );
  if (!order) {
    throw new GraphQLError("Заказ уже взят другим курьером или недоступен", {
      extensions: { code: "ALREADY_CLAIMED" },
    });
  }

  // Резервируем курьера
  rider.available = false;
  await rider.save();

  // ⭐ Рассчитываем ETA до ресторана и публикуем в подписке
  const restaurant = await Restaurant.findById(order.restaurantId).lean();
  if (restaurant?.location?.coordinates) {
    const eta = await etaForRiderToAddress(
      rider.location?.coordinates,
      restaurant.location.coordinates,
    );
    pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
      subscriptionOrder: order,
      etaToRestaurant: eta, // ⭐ NEW: ETA в секундах
    });
  }

  // Broadcast
  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.RIDER_ASSIGNED(rider._id.toString()), {
    subscriptionAssignedRider: order,
  });
  if (order.zoneId) {
    pubsub.publish(TOPICS.ZONE_ORDERS(order.zoneId.toString()), {
      subscriptionZoneOrders: order,
    });
  }

  return order;
};

/**
 * ⭐⭐⭐ NEW: курьер забрал заказ из ресторана.
 *
 * GraphQL:
 *   pickupDelivery(orderId: ID!): Order!
 */
export const pickupDelivery = async (_p, { orderId }, ctx) => {
  const rider = requireRider(ctx);
  const order = await Order.findById(orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (!order.riderId || order.riderId.toString() !== rider._id.toString()) {
    throw new GraphQLError("Заказ не назначен вам", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  assertCanTransition(order, "PICKED");

  order.orderStatus = "PICKED";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.pickedAt = new Date();
  await order.save();

  // ⭐ Рассчитываем ETA до клиента
  const destCoords = order.deliveryAddress?.location?.coordinates;
  if (destCoords && rider.location?.coordinates) {
    const eta = await etaForRiderToAddress(
      rider.location.coordinates,
      destCoords,
    );
    pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
      subscriptionOrder: order,
      etaToCustomer: eta,
    });
  }

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  return order;
};

/**
 * ⭐⭐⭐ NEW: курьер прибыл к точке доставки (у двери клиента).
 *
 * GraphQL:
 *   arriveAtDropOff(orderId: ID!): Order!
 */
export const arriveAtDropOff = async (_p, { orderId }, ctx) => {
  const rider = requireRider(ctx);
  const order = await Order.findById(orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (!order.riderId || order.riderId.toString() !== rider._id.toString()) {
    throw new GraphQLError("Заказ не назначен вам", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  assertCanTransition(order, "ARRIVED_AT_DROP_OFF");

  order.orderStatus = "ARRIVED_AT_DROP_OFF";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.arrivedAtDropOffAt = new Date();
  await order.save();

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  return order;
};

/**
 * ⭐⭐⭐ NEW: курьер отметил доставку (ждём подтверждения клиента).
 *
 * GraphQL:
 *   markDelivered(orderId: ID!): Order!
 */
export const markDelivered = async (_p, { orderId }, ctx) => {
  const rider = requireRider(ctx);
  const order = await Order.findById(orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (!order.riderId || order.riderId.toString() !== rider._id.toString()) {
    throw new GraphQLError("Заказ не назначен вам", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  assertCanTransition(order, "AWAITING_CONFIRMATION");

  order.orderStatus = "AWAITING_CONFIRMATION";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.deliveredAt = new Date();

  // Если COD — деньги сразу зафиксированы
  if (order.paymentMethod === "COD") {
    order.paid = true;
    if (!order.paidAt) order.paidAt = new Date();
  }

  await order.save();

  // Освобождаем курьера: он снова доступен для новых заказов
  rider.available = true;
  await rider.save();

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.RIDER_ORDER_COMPLETED(rider._id.toString()), {
    subscriptionRiderOrderCompleted: order,
  });

  return order;
};
