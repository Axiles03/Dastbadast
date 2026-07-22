// dastbadast-multivendor-api/src/resolvers/order-actions.js
import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { scheduleJustInTimeDispatch } from "./order-search.js";
import {
  compensateRestaurantForCancellation,
  refundUserForOrder,
} from "../lib/wallet.js";

function requireRestaurant(ctx) {
  if (!ctx.restaurant)
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  return ctx.restaurant;
}

const ALLOWED_FROM = {
  ACCEPTED: ["PENDING"],
  CANCELLED: ["PENDING", "ACCEPTED", "ASSIGNED"],
};

/**
 * ⭐ ШАГ 1 (FIX): раньше здесь было `findById` → мутация в памяти → `.save()`.
 * Это TOCTOU race condition: между чтением и записью статус заказа мог
 * измениться (например, `expireIfPending()` параллельно перевёл заказ в
 * CANCELLED). `.save()` в Mongoose не проверяет исходный статус — он просто
 * перезапишет документ, и мы могли получить заказ, "принятый" рестораном
 * ПОСЛЕ того, как клиент уже увидел событие автоотмены.
 *
 * Исправление: `findOneAndUpdate` с условием `orderStatus: {$in: ALLOWED_FROM}`
 * прямо в фильтре — атомарно на уровне MongoDB. Если статус уже не тот,
 * `update` вернёт `null`, и мы отличаем это от "заказ не найден вообще"
 * отдельным (некритичным для гонки) `findById`-запросом только для сообщения
 * об ошибке. Тот же паттерн уже использовался в `delivery.js` (`acceptDelivery`).
 */
async function findOwnedOrder(orderId, restaurantId) {
  const order = await Order.findById(orderId).select(
    "restaurantId orderStatus",
  );
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (order.restaurantId.toString() !== restaurantId.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  return order;
}

export const acceptOrder = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);

  // Существование + владение проверяем отдельно — чтобы вернуть точную
  // причину отказа (404 / 403), а не общий конфликт статуса.
  await findOwnedOrder(input.orderId, r._id);

  const prepTime =
    typeof input.prepTime === "number" && input.prepTime > 0
      ? input.prepTime
      : undefined;

  // ⭐ Атомарное условное обновление: сработает только если заказ ВСЁ ЕЩЁ
  // в PENDING в момент записи в БД. Если параллельно (авто-таймаут,
  // повторный клик, другой менеджер) статус уже сменился — вернётся null.
  const order = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      restaurantId: r._id,
      orderStatus: { $in: ALLOWED_FROM.ACCEPTED },
    },
    {
      $set: {
        orderStatus: "ACCEPTED",
        "statusTimestamps.acceptedAt": new Date(),
        ...(prepTime !== undefined
          ? { "statusTimestamps.prepTime": prepTime }
          : {}),
        // ⭐ сбрасываем метки пушей, чтобы Эшелон 1 стартовал заново после принятия
        "statusTimestamps.courierSearchTimestamps": {
          initialPushedAt: null,
          escalationPushedAt: null,
        },
      },
    },
    { new: true },
  );

  const wasAlreadyAccepted = order.statusTimestamps?.acceptedAt != null;
  const cancelledByRestaurant = !!ctx.restaurant; // ресторан отменяет сам себя — компенсации нет

  if (wasAlreadyAccepted && !cancelledByRestaurant) {
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (restaurant) {
      // ⭐ Фиксированная политика компенсации на старте: 100% стоимости
      // блюд (без учёта комиссии платформы — потерянные продукты не
      // должны облагаться комиссией). Сделать конфигурируемым процентом
      // при необходимости — сейчас захардкожено для прозрачности.
      const compensation = order.amounts?.subtotal ?? 0;
      await compensateRestaurantForCancellation(
        order,
        restaurant,
        compensation,
        `Компенсация за отменённый заказ #${order._id.toString().slice(-6)} (принят в работу, отменён ${cancelledByRestaurant ? "рестораном" : "не рестораном"})`,
      );
    }
  }

  if (!order) {
    throw new GraphQLError(
      "Заказ уже был обработан (принят/отменён) — обновите список",
      { extensions: { code: "CONFLICT" } },
    );
  }

  // ⭐ ШАГ 3 (FIX, см. план): раньше JIT-диспетчинг курьера ошибочно
  // планировался в `cancelOrder`. Здесь — правильное место: ресторан только
  // что указал prepTime, и именно на основе него нужно спланировать, когда
  // начинать искать курьера (за COURIER_LEAD_TIME_MIN до готовности).
  scheduleJustInTimeDispatch(
    order._id.toString(),
    order.statusTimestamps.prepTime,
  );

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.PLACE_ORDER(order.restaurantId.toString()), {
    subscribePlaceOrder: order,
  });
  pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId?.toString()), {
    subscriptionAvailableOrders: order,
  });

  return order;
};

export const cancelOrder = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);

  await findOwnedOrder(input.orderId, r._id);

  // ⭐ Атомарное условное обновление — та же защита от гонки, что и в acceptOrder.
  const order = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      restaurantId: r._id,
      orderStatus: { $in: ALLOWED_FROM.CANCELLED },
    },
    {
      $set: {
        orderStatus: "CANCELLED",
        cancelReasonCode: input.reasonCode || "OTHER",
        cancelReasonNote: input.reason || "",
        "statusTimestamps.cancelledAt": new Date(),
      },
    },
    { new: true },
  );

  if (!order) {
    throw new GraphQLError(
      "Заказ уже был обработан (принят/отменён/доставлен) — обновите список",
      { extensions: { code: "CONFLICT" } },
    );
  }

  // ⭐ NEW: если заказ был оплачен с баланса — деньги уже заморожены
  // (см. resolvers/order.js::placeOrder), возвращаем их пользователю.
  // Не блокируем саму отмену, если возврат вдруг упадёт — заказ уже
  // отменён в БД атомарным findOneAndUpdate выше, откатывать это не нужно;
  // ошибку просто логируем для ручного разбора.
  if (order.paymentMethod === "BALANCE" && order.paid) {
    try {
      await refundUserForOrder(
        order,
        `Возврат за отменённый заказ #${order._id.toString().slice(-6)}`,
      );
    } catch (e) {
      console.warn("[order-actions] refundUserForOrder failed:", e?.message);
    }
  }

  if (order.riderId) {
    await Rider.findByIdAndUpdate(order.riderId, { available: true });
  }

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  // ⭐ ШАГ 3 (FIX): убран ошибочный вызов scheduleJustInTimeDispatch для
  // отменённого заказа — планировать поиск курьера при отмене не имеет смысла.

  return order;
};

/**
 * ⭐ ШАГ 4 (FIX): ACK-механизм — Store App вызывает эту мутацию в момент,
 * когда заказ реально отрендерен на экране "Новые заказы" и сыграл звук
 * (см. store/app/(tabs)/new.tsx). До этого сервер знал только, что событие
 * было ОТПРАВЛЕНО (pubsub.publish / push-тикет от Expo), но не имел ни
 * малейшего представления, дошло ли оно и увидел ли его человек.
 *
 * Идемпотентно: побеждает ПЕРВЫЙ вызов (условие
 * "statusTimestamps.restaurantAckedAt": null в фильтре). Если заказ уже
 * подтверждён — это НЕ ошибка (например, второй планшет того же ресторана
 * или повторный вызов после реконнекта WS): просто возвращаем текущее
 * состояние заказа без повторной записи, сохраняя самое раннее время ACK
 * для корректного расчёта SLA "увидел заказ за N секунд".
 *
 * Намеренно НЕ проверяем orderStatus — ACK является чисто observability-
 * сигналом о доставке уведомления и не должен зависеть от того, что успело
 * произойти с заказом (например, ресторан мог увидеть его на экране долю
 * секунды до автоотмены — это всё ещё валидный факт "заказ был показан").
 */
export const ackOrderReceived = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const via = input.via || "SUBSCRIPTION";

  const existing = await findOwnedOrder(input.orderId, r._id);

  const acked = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      restaurantId: r._id,
      "statusTimestamps.restaurantAckedAt": null,
    },
    {
      $set: {
        "statusTimestamps.restaurantAckedAt": new Date(),
        "statusTimestamps.restaurantAckedVia": via,
      },
    },
    { new: true },
  );

  if (acked) return acked;

  // Уже было подтверждено раньше — идемпотентный успех, не ошибка.
  return await Order.findById(existing._id);
};
