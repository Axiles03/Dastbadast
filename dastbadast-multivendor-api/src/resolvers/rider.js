import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { signRiderToken } from "../middleware/auth.js";
import { pubsub, TOPICS } from "../pubsub.js";

function requireRider(ctx) {
  if (!ctx.rider)
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  return ctx.rider;
}

// Distance helper (Haversine, km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const riderLogin = async (_p, { input }) => {
  const r = await Rider.findOne({ username: input.username, isActive: true });
  if (!r)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const ok = await bcrypt.compare(input.password, r.passwordHash);
  if (!ok)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const token = signRiderToken(r);
  return { token, rider: r };
};

export const meRider = async (_p, _a, ctx) => requireRider(ctx);

export const riderOrders = async (_p, { status }, ctx) => {
  const r = requireRider(ctx);
  const filter = { riderId: r._id };
  if (status) filter.orderStatus = status;
  return Order.find(filter).sort({ createdAt: -1 });
};

/**
 * FIX: добавлен zone-фильтр. Курьер видит только заказы своей зоны.
 * Если rider.zoneId не задан — видит всё (fallback).
 */
export const availableOrdersForRiders = async (_p, _a, ctx) => {
  const r = requireRider(ctx);
  const baseFilter = { orderStatus: "ACCEPTED", riderId: null };
  if (r.zoneId) {
    baseFilter.zoneId = r.zoneId;
  }
  return Order.find(baseFilter).sort({ createdAt: 1 }).limit(50);
};

export const claimOrder = async (_p, { orderId }, ctx) => {
  const r = requireRider(ctx);
  if (!r.available) {
    throw new GraphQLError("Включите статус «Доступен», чтобы брать заказы", {
      extensions: { code: "RIDER_UNAVAILABLE" },
    });
  }
  const active = await Order.countDocuments({
    riderId: r._id,
    orderStatus: { $in: ["ASSIGNED", "PICKED"] },
  });
  if (active > 0) {
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: "ACCEPTED", riderId: null },
    {
      $set: {
        riderId: r._id,
        orderStatus: "ASSIGNED",
        "statusTimestamps.assignedAt": new Date(),
      },
    },
    { new: true },
  );
  if (!order) {
    throw new GraphQLError("Заказ уже взял другой курьер или недоступен", {
      extensions: { code: "ALREADY_CLAIMED" },
    });
  }

  r.available = false;
  await r.save();

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.RIDER_ASSIGNED(r._id.toString()), {
    subscriptionAssignedRider: order,
  });
  pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId?.toString()), {
    subscriptionAvailableOrders: order,
  });
  return order;
};

const ALLOWED = {
  PICKED: ["ASSIGNED"],
  AWAITING_CONFIRMATION: ["PICKED"],
  DELIVERED: [],
};

export const updateOrderStatusRider = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const order = await Order.findById(input.orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (!order.riderId || order.riderId.toString() !== r._id.toString()) {
    throw new GraphQLError("Заказ не назначен вам", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  if (!["PICKED", "AWAITING_CONFIRMATION"].includes(input.status)) {
    throw new GraphQLError(
      "Курьер может выставить PICKED или AWAITING_CONFIRMATION. Финальный DELIVERED ставится только клиентом.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  if (!ALLOWED[input.status].includes(order.orderStatus)) {
    throw new GraphQLError(
      `Невозможно перевести в ${input.status} из ${order.orderStatus}`,
      { extensions: { code: "BAD_STATE" } },
    );
  }

  order.orderStatus = input.status;
  order.statusTimestamps = order.statusTimestamps || {};

  if (input.status === "PICKED") {
    order.statusTimestamps.pickedAt = new Date();
  }

  if (input.status === "AWAITING_CONFIRMATION") {
    order.statusTimestamps.deliveredAt = new Date();
  }

  await order.save();

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  return order;
};

export const updateRiderLocation = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  r.location = { type: "Point", coordinates: [input.lng, input.lat] };
  r.lastLocationAt = new Date();
  await r.save();

  pubsub.publish(TOPICS.RIDER_LOCATION(r._id.toString()), {
    subscriptionRiderLocation: {
      riderId: r._id.toString(),
      lat: input.lat,
      lng: input.lng,
      updatedAt: r.lastLocationAt?.toISOString?.() ?? new Date().toISOString(),
    },
  });

  return r;
};

export const toggleRider = async (_p, { available }, ctx) => {
  const r = requireRider(ctx);
  r.available = !!available;
  await r.save();
  return r;
};

/**
 * FIX: GPS privacy — координаты курьера видны только:
 *  - самому курьеру
 *  - владельцу заказа, в котором курьер сейчас ASSIGNED/PICKED/AWAITING_CONFIRMATION
 *  - админу
 * Остальные — получают null в location и lastLocationAt.
 */
export const rider = async (_p, { id }, ctx) => {
  if (!ctx.user && !ctx.rider && !ctx.owner) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  // 1) Сам курьер или админ — видят всё
  if (ctx.rider && ctx.rider._id.toString() === id) return Rider.findById(id);
  if (ctx.owner) return Rider.findById(id);

  // 2) User — только если этот курьер назначен на его активный заказ
  if (ctx.user) {
    const myActiveOrder = await Order.findOne({
      userId: ctx.user._id,
      riderId: id,
      orderStatus: { $in: ["ASSIGNED", "PICKED", "AWAITING_CONFIRMATION"] },
    });
    if (myActiveOrder) {
      return Rider.findById(id);
    }
  }

  // 3) Всем остальным — публичный профиль без координат
  const publicProfile = await Rider.findById(id).select(
    "username name phone available zoneId isActive createdAt updatedAt",
  );
  if (!publicProfile) return null;
  // Принудительно обнуляем location/lastLocationAt
  publicProfile.location = { type: "Point", coordinates: [0, 0] };
  publicProfile.lastLocationAt = null;
  return publicProfile;
};
