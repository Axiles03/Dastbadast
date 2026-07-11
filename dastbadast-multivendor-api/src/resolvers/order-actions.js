import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { pubsub, TOPICS } from "../pubsub.js";
import {
  startCourierSearchEscalation1,
  scheduleJustInTimeDispatch,
} from "./order-search.js";

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

export const acceptOrder = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const order = await Order.findById(input.orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (order.restaurantId.toString() !== r._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  if (!ALLOWED_FROM.ACCEPTED.includes(order.orderStatus)) {
    throw new GraphQLError(
      `Невозможно принять заказ в статусе ${order.orderStatus}`,
      {
        extensions: { code: "BAD_STATE" },
      },
    );
  }
  order.orderStatus = "ACCEPTED";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.acceptedAt = new Date();
  if (typeof input.prepTime === "number" && input.prepTime > 0) {
    order.statusTimestamps.prepTime = input.prepTime;
  }

  // ⭐⭐⭐ НОВОЕ: сбрасываем метки пушей, чтобы Эшелон 1 стартовал заново после принятия
  order.statusTimestamps.courierSearchTimestamps = {
    initialPushedAt: null,
    escalationPushedAt: null,
  };
  await order.save();

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
};

export const cancelOrder = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const order = await Order.findById(input.orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (order.restaurantId.toString() !== r._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  if (!ALLOWED_FROM.CANCELLED.includes(order.orderStatus)) {
    throw new GraphQLError(
      `Невозможно отменить заказ в статусе ${order.orderStatus}`,
      {
        extensions: { code: "BAD_STATE" },
      },
    );
  }
  order.orderStatus = "CANCELLED";
  order.cancelReason = input.reason || "Отменено рестораном";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.cancelledAt = new Date();
  await order.save();

  if (order.riderId) {
    await Rider.findByIdAndUpdate(order.riderId, { available: true });
  }

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  scheduleJustInTimeDispatch(
    order._id.toString(),
    order.statusTimestamps.prepTime,
  );
  return order;
};
