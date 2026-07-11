import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { signRiderToken } from "../middleware/auth.js";
import { pubsub, TOPICS } from "../pubsub.js";
import {
  setRiderLocationInRedis,
  getRiderLocationFromRedis,
} from "../services/rider-location.service.js";

// ⭐⭐⭐ Константы для real-time трекинга
const RIDER_LOCATION_THROTTLE_MS = 10_000; // минимум между обновлениями (10 сек)
const NEAR_DROP_OFF_RADIUS_M = 500; // радиус geofence "рядом с клиентом"
const BEARING_CHANGE_THRESHOLD_DEG = 15; // минимальное изменение направления для бродкаста
const MIN_DISTANCE_FOR_BROADCAST_M = 25; // минимальное смещение для бродкаста

// Кэш последней позиции курьера для throttling
const lastRiderLocation = new Map(); // riderId -> { at: number, lat, lng, bearing }

// ⭐⭐⭐ Helper: фильтр публичных данных о курьере
function publicRiderProfile(rider) {
  if (!rider) return null;
  // Принудительно обнуляем GPS для не-админов и не-владельца
  rider.location = { type: "Point", coordinates: [0, 0] };
  rider.lastLocationAt = null;
  return rider;
}

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

export const updateRiderLocation = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const { lat, lng, bearing } = input;

  // 1) Валидация (без изменений)
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new GraphQLError("Некорректные координаты", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // 2) Throttling: 10 сек (без изменений)
  const now = Date.now();
  const prev = lastRiderLocation.get(r._id.toString());
  if (prev && now - prev.at < RIDER_LOCATION_THROTTLE_MS) {
    return r;
  }

  // ⭐⭐⭐ Вычисляем bearing (направление движения) и дистанцию
  const newBearing = prev ? bearingDeg(prev.lat, prev.lng, lat, lng) : null;
  const distanceFromPrev = prev
    ? haversineKm(prev.lat, prev.lng, lat, lng) * 1000 // метры
    : Infinity;

  // ⭐⭐⭐ Решаем, нужно ли бродкастить
  const shouldBroadcast =
    !prev || // первая точка
    distanceFromPrev >= MIN_DISTANCE_FOR_BROADCAST_M || // значительно сместился
    (newBearing !== null &&
      Math.abs(newBearing - (prev.bearing ?? 0)) >=
        BEARING_CHANGE_THRESHOLD_DEG); // резко повернул

  const speedKmh = prev
    ? (distanceFromPrev / ((now - prev.at) / 1000)) * 3.6
    : null;

  const updatedAt = new Date().toISOString();
  await setRiderLocationInRedis(r._id.toString(), {
    lat,
    lng,
    bearing: bearing ?? newBearing,
    speedKmh,
    updatedAt,
  });

  // Сохраняем в БД (всегда — для истории)
  r.location = { type: "Point", coordinates: [lng, lat] };
  r.lastLocationAt = new Date();
  if (typeof bearing === "number") r.bearing = bearing;
  await r.save();

  // Обновляем кэш
  lastRiderLocation.set(r._id.toString(), {
    at: now,
    lat,
    lng,
    bearing: newBearing ?? prev?.bearing ?? 0,
  });

  // ⭐ 6) ШАГ 5 (атомарный, раз в 5 мин) — но пока пишем в Mongo,
  //    если прошло > 5 мин с последней записи (cron не успел).
  //    Это fallback для случая, когда cron не работает.
  const lastMongoWriteAt = r.lastLocationAt?.getTime() ?? 0;
  const NEED_TO_PERSIST = now - lastMongoWriteAt > 4 * 60 * 1000; // 4 мин

  if (NEED_TO_PERSIST) {
    r.location = { type: "Point", coordinates: [lng, lat] };
    r.lastLocationAt = new Date();
    if (typeof bearing === "number") r.bearing = bearing;
    await r.save();
  }

  if (!shouldBroadcast) return r;

  // ⭐⭐⭐ Бродкаст курьерской локации
  const payload = {
    riderId: r._id.toString(),
    lat,
    lng,
    bearing: bearing ?? newBearing,
    speedKmh,
    updatedAt,
  };
  pubsub.publish(TOPICS.RIDER_LOCATION(r._id.toString()), {
    subscriptionRiderLocation: payload,
  });

  // ⭐⭐⭐ Geofence detection: проверяем каждый активный заказ курьера
  const activeOrders = await Order.find({
    riderId: r._id,
    orderStatus: { $in: ["ASSIGNED", "PICKED", "EN_ROUTE_TO_DROP_OFF"] },
  }).lean();

  for (const o of activeOrders) {
    const destCoords = o.deliveryAddress?.location?.coordinates;
    if (!destCoords || destCoords.length < 2) continue;
    const [destLng, destLat] = destCoords;
    const distanceToCustomer = haversineKm(lat, lng, destLat, destLng) * 1000;

    // ⭐ Курьер в радиусе 500 м от клиента → триггер уведомления
    if (distanceToCustomer <= NEAR_DROP_OFF_RADIUS_M) {
      const wasAlreadyNear = prev
        ? haversineKm(prev.lat, prev.lng, destLat, destLng) * 1000 <=
          NEAR_DROP_OFF_RADIUS_M
        : false;
      if (!wasAlreadyNear) {
        // Вход в geofence — публикуем событие (для Раздела 3)
        pubsub.publish(TOPICS.RIDER_NEAR_DROP_OFF(o._id.toString()), {
          riderNearDropOff: {
            orderId: o._id.toString(),
            riderId: r._id.toString(),
            distanceM: Math.round(distanceToCustomer),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }

  return r;
};

// ⭐⭐⭐ НОВАЯ мутация: остановка стриминга (при выходе из приложения)
export const stopRiderLocationStream = async (_p, _a, ctx) => {
  const r = requireRider(ctx);
  lastRiderLocation.delete(r._id.toString());
  // Сигнализируем клиентам, что стрим остановлен
  pubsub.publish(TOPICS.RIDER_LOCATION(r._id.toString()), {
    subscriptionRiderLocation: {
      riderId: r._id.toString(),
      stopped: true,
      updatedAt: new Date().toISOString(),
    },
  });
  return true;
};

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
    return publicRiderProfile(await Rider.findById(id));
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

import { registerRegistry } from "../cleanup-cron.js";
registerRegistry(
  "lastRiderLocation", // last GPS-точка каждого курьера (для throttling)
  lastRiderLocation, // Map<riderId, {at, lat, lng, bearing}>
  10 * 60 * 1000, // удалять старше 10 мин (rider вряд ли активен дольше без апдейта)
  5000, // максимум 5000 курьеров в памяти (≈ 2MB)
);
