// dastbadast-multivendor-api/src/resolvers/rider-subscriptions.js
import { GraphQLError } from "graphql";
import { pubsub, TOPICS } from "../pubsub.js";
import { Rider } from "../models/Rider.js";

/**
 * ⭐⭐⭐ Подписка на событие "курьер подъехал к клиенту".
 * Используется для триггера уведомления в Разделе 3.
 */
export const riderNearDropOff = {
  subscribe: async (_p, { orderId }, ctx) => {
    if (!orderId) {
      throw new GraphQLError("orderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    // Только владелец заказа или админ может подписаться
    if (ctx.user) {
      const { Order } = await import("../models/Order.js");
      const order = await Order.findById(orderId).select("userId").lean();
      if (!order || order.userId.toString() !== ctx.user._id.toString()) {
        throw new GraphQLError("Forbidden", {
          extensions: { code: "FORBIDDEN" },
        });
      }
    } else if (!ctx.owner) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return pubsub.asyncIterator(TOPICS.RIDER_NEAR_DROP_OFF(orderId));
  },
  resolve: (p) => p.riderNearDropOff,
};

/**
 * ⭐⭐⭐ Query: получить последнюю сохранённую локацию курьера.
 * Используется клиентом как fallback если WebSocket-стрим ещё не дошёл.
 */
export const currentRiderLocation = async (_p, { riderId }, ctx) => {
  if (!riderId) return null;
  // Только владелец активного заказа или админ
  if (ctx.user) {
    const { Order } = await import("../models/Order.js");
    const active = await Order.findOne({
      userId: ctx.user._id,
      riderId,
      orderStatus: { $in: ["ASSIGNED", "PICKED", "AWAITING_CONFIRMATION"] },
    }).lean();
    if (!active) {
      throw new GraphQLError("Нет доступа к локации этого курьера", {
        extensions: { code: "FORBIDDEN" },
      });
    }
  } else if (!ctx.rider || ctx.rider._id.toString() !== riderId) {
    if (!ctx.owner) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
  }
  const rider = await Rider.findById(riderId)
    .select("location lastLocationAt")
    .lean();
  if (!rider?.location?.coordinates) return null;
  const [lng, lat] = rider.location.coordinates;
  if (lat === 0 && lng === 0) return null;
  return {
    riderId,
    lat,
    lng,
    bearing: null,
    speedKmh: null,
    updatedAt: rider.lastLocationAt?.toISOString() ?? new Date().toISOString(),
  };
};
