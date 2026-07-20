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
import { haversineKm } from "../utils/geo.js";
import { getRiderLocationFromRedis } from "../services/rider-location.service.js";
import { debugWarn } from "../debug-log.js";

// ⭐⭐⭐ NEW: multi-stop dispatch — курьер, который УЖЕ везёт один заказ,
// может взять второй, только если он приблизился к клиенту первого заказа
// не дальше этого радиуса. До этого multi-stop был вообще запрещён —
// claimOrder/acceptDelivery блокировали любой второй заказ, пока не
// завершится первый (см. "active > 0" ниже).
const MULTI_STOP_PROXIMITY_KM = 2;
// Пока не поддерживаем "стек" из 3+ заказов одновременно — только 1+1.
const MAX_CONCURRENT_ORDERS = 2;

const ACTIVE_STATUSES = [
  "ASSIGNED",
  "PICKED",
  "EN_ROUTE_TO_DROP_OFF",
  "ARRIVED_AT_DROP_OFF",
];

/**
 * ⭐ NEW: проверяет, может ли курьер взять ЕЩЁ ОДИН заказ поверх уже
 * имеющихся активных. Правила:
 *  - 0 активных → можно (обычный кейс)
 *  - 1 активный → можно, ТОЛЬКО если курьер сейчас в радиусе
 *    MULTI_STOP_PROXIMITY_KM от точки доставки текущего заказа
 *    (т.е. уже почти закончил первый — есть смысл довесить второй по пути)
 *  - 2+ активных → нельзя (лимит MVP)
 * Бросает GraphQLError с понятной причиной, если взять нельзя.
 */
async function assertCanTakeAnotherOrder(rider) {
  const active = await Order.find({
    riderId: rider._id,
    orderStatus: { $in: ACTIVE_STATUSES },
  }).lean();

  if (active.length === 0) return;

  if (active.length >= MAX_CONCURRENT_ORDERS) {
    throw new GraphQLError(
      `Нельзя взять больше ${MAX_CONCURRENT_ORDERS} заказов одновременно`,
      { extensions: { code: "BAD_STATE" } },
    );
  }

  // Ровно 1 активный заказ — проверяем близость к его точке доставки.
  const current = active[0];
  const destCoords = current.deliveryAddress?.location?.coordinates;
  if (!destCoords || destCoords.length < 2) {
    // Нет координат — не можем проверить близость, безопаснее запретить.
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }

  // Берём самую свежую позицию курьера: сначала Redis (real-time), иначе
  // последняя сохранённая в Mongo (может отставать на минуты).
  const liveLoc = await getRiderLocationFromRedis(rider._id.toString());
  const riderLat = liveLoc?.lat ?? rider.location?.coordinates?.[1];
  const riderLng = liveLoc?.lng ?? rider.location?.coordinates?.[0];
  if (typeof riderLat !== "number" || typeof riderLng !== "number") {
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }

  const [destLng, destLat] = destCoords;
  const distanceKm = haversineKm(riderLat, riderLng, destLat, destLng);

  if (distanceKm > MULTI_STOP_PROXIMITY_KM) {
    throw new GraphQLError(
      `Второй заказ можно взять, только если вы в ${MULTI_STOP_PROXIMITY_KM} км ` +
        `от точки доставки текущего заказа (сейчас ${distanceKm.toFixed(1)} км)`,
      { extensions: { code: "TOO_FAR_FOR_MULTI_STOP" } },
    );
  }
}

// ⭐⭐⭐ Фаза 0 (аудит): markDelivered раньше не сверял позицию курьера с
// адресом доставки вообще — курьер мог закрыть заказ из другого района
// города. Не блокируем (законные причины бывают: оставил у ворот,
// погрешность GPS в высотке), а помечаем заказ флагом для ревью/аналитики.
// 250 м — заметно шире строгого авто-геофенса прибытия (60 м, см.
// resolvers/rider.js AUTO_ARRIVED_RADIUS_M): та проверка уже "заперла"
// большинство честных курьеров в узком радиусе на шаге ARRIVED_AT_DROP_OFF,
// здесь нужен запас на COD-кейсы вроде "поднялся в квартиру без телефона в руке".
const DELIVERY_MISMATCH_RADIUS_M = 250;

/**
 * ⭐ Сверяет последнюю известную позицию курьера (Redis, затем Mongo-fallback)
 * с координатами адреса доставки.
 * @returns {Promise<{mismatch: boolean, distanceM: number|null}>}
 */
async function checkDeliveryLocationMismatch(order, rider) {
  const destCoords = order.deliveryAddress?.location?.coordinates;
  if (!Array.isArray(destCoords) || destCoords.length < 2) {
    return { mismatch: false, distanceM: null };
  }

  const liveLoc = await getRiderLocationFromRedis(rider._id.toString());
  const riderLat = liveLoc?.lat ?? rider.location?.coordinates?.[1];
  const riderLng = liveLoc?.lng ?? rider.location?.coordinates?.[0];
  if (typeof riderLat !== "number" || typeof riderLng !== "number") {
    // Нет свежей позиции курьера — не можем проверить. Безопаснее НЕ
    // считать это мисматчем (иначе флаг сработает на каждый заказ, если
    // Redis/GPS временно недоступны, и потеряет диагностическую ценность).
    return { mismatch: false, distanceM: null };
  }

  const [destLng, destLat] = destCoords;
  const distanceM = haversineKm(riderLat, riderLng, destLat, destLng) * 1000;
  return {
    mismatch: distanceM > DELIVERY_MISMATCH_RADIUS_M,
    distanceM: Math.round(distanceM),
  };
}

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
  // ⭐ FIX: раньше отсюда был путь ТОЛЬКО в EN_ROUTE_TO_DROP_OFF, но ни одна
  // мутация никогда не выставляет EN_ROUTE_TO_DROP_OFF — в реальности курьер
  // едет сразу PICKED → (у двери клиента). Из-за этого arriveAtDropOff всегда
  // падал с BAD_STATE. Разрешаем PICKED → ARRIVED_AT_DROP_OFF напрямую —
  // это нужно и для ручной кнопки "Я на месте", и для нового авто-геофенса.
  PICKED: [
    "EN_ROUTE_TO_DROP_OFF",
    "ARRIVED_AT_DROP_OFF",
    "AWAITING_CONFIRMATION",
    "CANCELLED",
  ],
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

  // ⭐⭐⭐ CHANGED: раньше здесь была жёсткая проверка "активных заказов
  // не должно быть вообще" — multi-stop был полностью запрещён. Теперь
  // разрешаем второй заказ, если курьер уже близко к точке доставки первого
  // (см. assertCanTakeAnotherOrder / MULTI_STOP_PROXIMITY_KM).
  await assertCanTakeAnotherOrder(rider);

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

  // ⭐ CHANGED: r.available/rider.available больше НЕ трогаем здесь — это
  // переключатель "курьер онлайн/оффлайн" (toggleRider), не "занятость".
  // Раньше здесь стояло rider.available=false, из-за чего курьер не мог
  // пройти проверку `!rider.available` выше для второго заказа —
  // multi-stop был архитектурно невозможен. Занятость теперь считается
  // только через assertCanTakeAnotherOrder (кол-во активных + близость).

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
  order.statusTimestamps.arrivedAtDropOffSource = "MANUAL";
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

  // ⭐ Фаза 0 (аудит): антифрод-проверка позиции курьера, см. функцию выше.
  const { mismatch, distanceM } = await checkDeliveryLocationMismatch(
    order,
    rider,
  );
  order.deliveryLocationMismatch = mismatch;
  order.deliveryLocationMismatchDistanceM = distanceM;
  if (mismatch) {
    debugWarn("delivery", "markDelivered: rider location mismatch", {
      orderId: order._id.toString(),
      riderId: rider._id.toString(),
      distanceM,
    });
  }

  // Если COD — деньги сразу зафиксированы
  if (order.paymentMethod === "COD") {
    order.paid = true;
    if (!order.paidAt) order.paidAt = new Date();
  }

  await order.save();

  // ⭐ CHANGED: раньше здесь стояло rider.available=true — но это ломает
  // сценарий, когда курьер сам выключился ("не в сети") пока довозил заказ:
  // после доставки он снова становился "доступен" ПОМИМО своей воли.
  // available — это переключатель самого курьера (toggleRider), а не
  // производная от завершения доставки. Готовность брать новые заказы
  // теперь определяется только количеством активных заказов.

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
