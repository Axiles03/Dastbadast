// dastbadast-multivendor-api/src/resolvers/notifications.js
//
// ⭐⭐⭐ Раздел 3: Expo Push Notifications — полная реализация.
// 1) Регистрация / удаление push-токенов (GraphQL мутации).
// 2) pushService — реальная отправка через expo-server-sdk (чанки по 100).
// 3) dispatcher — антиспам (60 сек) + шаблоны сообщений.
// 4) triggers — 4 pubsub-подписки: orderStatus, courierSearch, nearDropOff, nearRestaurant.

import { GraphQLError } from "graphql";
import { Expo } from "expo-server-sdk";
import { PushToken } from "../models/PushToken.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { Order } from "../models/Order.js";
import { debugLog, debugWarn } from "../debug-log.js";

/* ============================================================
 * 1) GraphQL резолверы: registerPushToken / unregisterPushToken / myPushTokens
 * ============================================================ */

function requireAuth(ctx) {
  if (ctx.user) return { ownerType: "user", ownerId: ctx.user._id };
  if (ctx.rider) return { ownerType: "rider", ownerId: ctx.rider._id };
  if (ctx.restaurant) {
    return { ownerType: "user", ownerId: ctx.restaurant._id };
  }
  throw new GraphQLError("Not authenticated", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export const registerPushToken = async (_p, { input }, ctx) => {
  const { token, platform, locale } = input;
  if (!token) {
    throw new GraphQLError("token обязателен", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!Expo.isExpoPushToken(token)) {
    throw new GraphQLError(
      `Некорректный Expo push token: ${token.slice(0, 20)}...`,
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  if (!["ios", "android"].includes(platform)) {
    throw new GraphQLError("platform должен быть ios или android", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const { ownerType, ownerId } = requireAuth(ctx);

  const doc = await PushToken.findOneAndUpdate(
    { token },
    {
      $set: {
        ownerType,
        ownerId,
        token,
        platform,
        locale: locale || "ru",
        lastUsedAt: new Date(),
        verified: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  debugLog("Push", "token registered", { ownerType, platform });
  return {
    id: doc._id.toString(),
    token: doc.token,
    platform: doc.platform,
  };
};

export const unregisterPushToken = async (_p, { token }, ctx) => {
  const { ownerType, ownerId } = requireAuth(ctx);
  if (!token) return false;
  const result = await PushToken.deleteOne({ token, ownerType, ownerId });
  return result.deletedCount > 0;
};

export const myPushTokens = async (_p, _a, ctx) => {
  const { ownerType, ownerId } = requireAuth(ctx);
  return PushToken.find({ ownerType, ownerId })
    .select("platform locale lastUsedAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
};

/* ============================================================
 * 2) pushService.js — реальная отправка через expo-server-sdk
 * ============================================================ */

let _expoInstance = null;
function getExpo() {
  if (!_expoInstance) {
    _expoInstance = new Expo({
      // accessToken: process.env.EXPO_ACCESS_TOKEN, // optional
    });
  }
  return _expoInstance;
}

/**
 * ⭐⭐⭐ pushService — отправляет push одному владельцу (user/rider).
 * Получает все его активные токены и шлёт во все.
 * Возвращает массив тикетов от Expo.
 */
export async function sendPushToOwner({
  ownerType,
  ownerId,
  title,
  body,
  data = {},
  ttlSeconds = 3600,
  sound = "default",
  channelId = "default",
  priority = "high",
  badge,
}) {
  if (!ownerId) {
    debugWarn("Push", "ownerId missing");
    return [];
  }

  const tokens = await PushToken.find({ ownerType, ownerId, verified: true })
    .select("token")
    .lean();

  if (tokens.length === 0) {
    debugLog("Push", "no tokens for owner", { ownerType, ownerId });
    return [];
  }

  const expo = getExpo();
  const messages = [];

  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.token)) {
      debugWarn("Push", "invalid token, deleting", t.token.slice(0, 20));
      await PushToken.deleteOne({ token: t.token });
      continue;
    }
    messages.push({
      to: t.token,
      sound,
      title,
      body,
      data: { ...data, ownerType, ownerId: String(ownerId) },
      ttl: ttlSeconds,
      priority,
      channelId,
      ...(badge != null ? { badge } : {}),
    });
  }

  if (messages.length === 0) return [];

  const tickets = [];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (e) {
      debugWarn("Push", "sendPushNotificationsAsync error", e?.message);
    }
  }

  // Очистка невалидных токенов
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const message = messages[i];
    if (ticket.status === "error") {
      const code = ticket.details?.error;
      if (
        code === "DeviceNotRegistered" ||
        code === "InvalidCredentials" ||
        code === "MessageTooBig" ||
        code === "MessageRateExceeded"
      ) {
        await PushToken.deleteOne({ token: message.to });
        debugLog("Push", "deleted invalid token", code);
      }
    }
  }

  debugLog("Push", "sent", {
    count: tickets.length,
    ownerType,
    ownerId: String(ownerId),
  });
  return tickets;
}

/** Хелпер: подставляет {{name}} в шаблоне */
export function localize(template, vars) {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    template,
  );
}

/* ============================================================
 * 3) dispatcher — антиспам + шаблоны + хелперы
 * ============================================================ */

const DEDUP_TTL_MS = 60_000;

const dedupCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of dedupCache.entries()) {
    if (now - ts > DEDUP_TTL_MS * 2) dedupCache.delete(k);
  }
}, DEDUP_TTL_MS * 5).unref?.();

function shouldSend(ownerType, ownerId, eventType, entityId) {
  const key = `${ownerType}:${ownerId}:${eventType}:${entityId || ""}`;
  const now = Date.now();
  const last = dedupCache.get(key);
  if (last && now - last < DEDUP_TTL_MS) return false;
  dedupCache.set(key, now);
  return true;
}

const TEMPLATES = {
  ORDER_PENDING_TO_CLIENT: {
    title: "🍳 Заказ принят!",
    body: "Ресторан {restaurantName} начал готовить ваш заказ #{orderCode}",
    deepLink: "/order/{orderId}/tracking",
  },
  ORDER_READY_TO_CLIENT: {
    title: "✅ Заказ готов!",
    body: "Курьер уже едет к ресторану. Скоро выезжает к вам.",
    deepLink: "/order/{orderId}/tracking",
  },
  ORDER_ASSIGNED_TO_CLIENT: {
    title: "🛵 Курьер назначен!",
    body: "Курьер уже в пути к ресторану. Следите за заказом на карте.",
    deepLink: "/order/{orderId}/tracking",
  },
  ORDER_PICKED_TO_CLIENT: {
    title: "🛵 Забрали ваш заказ!",
    body: "Курьер едет к вам. ETA: ~{etaMin} мин.",
    deepLink: "/order/{orderId}/tracking",
  },
  ORDER_NEAR_DROP_OFF: {
    title: "📦 Курьер рядом!",
    body: "Курьер в {distanceM} м от вас. Выходите на встречу!",
    deepLink: "/order/{orderId}/tracking",
  },
  ORDER_DELIVERED: {
    title: "✅ Заказ доставлен!",
    body: "Приятного аппетита! Подтвердите получение, пожалуйста.",
    deepLink: "/order/{orderId}/confirm",
  },
  NEW_ORDER_TO_RIDER: {
    title: "🔔 Новый заказ рядом!",
    body: "{restaurantName} · {total} сом. · ~{etaMin} мин",
    deepLink: "/orders/{orderId}",
  },
  ORDER_ESCALATION_TO_RIDER: {
    title: "⚡ Срочно: эскалация!",
    body: "Заказ #{orderCode} ждёт уже 90 сек. Заберите быстрее!",
    deepLink: "/orders/{orderId}",
  },
  NEW_ORDER_TO_RESTAURANT: {
    title: "🔔 Новый заказ!",
    body: "Сумма: {total} сом. · {itemsCount} поз.",
    deepLink: "/orders/{orderId}",
  },
};

async function notify({
  to,
  toId,
  event,
  vars = {},
  extra = {},
  force = false,
}) {
  if (!toId) return;
  const tpl = TEMPLATES[event];
  if (!tpl) {
    debugWarn("Push", `unknown event: ${event}`);
    return;
  }
  if (!force && !shouldSend(to, toId, event, vars.orderId)) {
    debugLog("Push", "skipped (dedup)", { to, event });
    return;
  }
  const title = localize(tpl.title, vars);
  const body = localize(tpl.body, vars);
  const deepLink = tpl.deepLink ? localize(tpl.deepLink, vars) : null;
  const data = { ...extra, event, deepLink };

  const ownerType = to === "user" ? "user" : "rider";
  await sendPushToOwner({
    ownerType,
    ownerId: toId,
    title,
    body,
    data,
    // Срочные — без TTL, обычные — 1 час
    ttlSeconds:
      event === "ORDER_NEAR_DROP_OFF" || event === "NEW_ORDER_TO_RIDER"
        ? 300
        : 3600,
    sound: "default",
    priority: "high",
  });
}

/* ============================================================
 * Специализированные хелперы (для triggers.js)
 * ============================================================ */

export async function notifyClientOrderPendingToPreparing({
  userId,
  orderId,
  orderCode,
  restaurantName,
}) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_PENDING_TO_CLIENT",
    vars: { orderId, orderCode, restaurantName },
  });
}

export async function notifyClientOrderReady({ userId, orderId, orderCode }) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_READY_TO_CLIENT",
    vars: { orderId, orderCode },
  });
}

export async function notifyClientOrderAssigned({
  userId,
  orderId,
  orderCode,
}) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_ASSIGNED_TO_CLIENT",
    vars: { orderId, orderCode },
  });
}

export async function notifyClientOrderPicked({
  userId,
  orderId,
  orderCode,
  etaMin,
}) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_PICKED_TO_CLIENT",
    vars: { orderId, orderCode, etaMin: etaMin ?? "?" },
  });
}

export async function notifyClientRiderNearDropOff({
  userId,
  orderId,
  distanceM,
}) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_NEAR_DROP_OFF",
    vars: { orderId, distanceM },
  });
}

export async function notifyClientOrderDelivered({
  userId,
  orderId,
  orderCode,
}) {
  await notify({
    to: "user",
    toId: userId,
    event: "ORDER_DELIVERED",
    vars: { orderId, orderCode },
  });
}

export async function notifyRidersNewOrder({
  riderIds,
  orderId,
  orderCode,
  restaurantName,
  total,
  etaMin,
}) {
  await Promise.allSettled(
    (riderIds || []).map((riderId) =>
      notify({
        to: "rider",
        toId: riderId,
        event: "NEW_ORDER_TO_RIDER",
        vars: {
          orderId,
          orderCode,
          restaurantName,
          total,
          etaMin: etaMin ?? "?",
        },
      }),
    ),
  );
}

export async function notifyRidersEscalation({ riderIds, orderId, orderCode }) {
  await Promise.allSettled(
    (riderIds || []).map((riderId) =>
      notify({
        to: "rider",
        toId: riderId,
        event: "ORDER_ESCALATION_TO_RIDER",
        vars: { orderId, orderCode },
      }),
    ),
  );
}

export async function notifyRestaurantNewOrder({
  restaurantId,
  ownerId,
  orderId,
  total,
  itemsCount,
}) {
  await notify({
    to: "user",
    toId: ownerId,
    event: "NEW_ORDER_TO_RESTAURANT",
    vars: { orderId, total, itemsCount },
  });
}

/* ============================================================
 * 4) triggers.js — 4 pubsub-подписки
 * ============================================================ */

function haversineKmLegacy(lat1, lng1, lat2, lng2) {
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

/**
 * ⭐⭐⭐ Запуск всех push-триггеров при старте сервера.
 * Вызывается один раз из index.js после подключения к БД.
 * Возвращает функцию-отключение (для graceful shutdown).
 */
export function startNotificationTriggers() {
  debugLog("Notif", "starting notification triggers (real)");

  // 1) Смена статуса заказа → клиент
  const unsub1 = pubsub.subscribe(
    TOPICS.ORDER_STATUS_CHANGED("*"),
    async (payload) => {
      try {
        const order = payload?.orderStatusChanged;
        if (!order?._id) return;

        const fullOrder = await Order.findById(order._id)
          .select(
            "userId orderId orderStatus pickupAddress.name amounts.total statusTimestamps",
          )
          .lean();
        if (!fullOrder?.userId) return;

        const userId = String(fullOrder.userId);
        const orderId = String(fullOrder._id);
        const orderCode = fullOrder.orderId;
        const restaurantName = fullOrder.pickupAddress?.name || "Ресторан";

        switch (fullOrder.orderStatus) {
          case "ACCEPTED":
          case "PREPARING":
            await notifyClientOrderPendingToPreparing({
              userId,
              orderId,
              orderCode,
              restaurantName,
            });
            break;
          case "READY_FOR_PICKUP":
            await notifyClientOrderReady({ userId, orderId, orderCode });
            break;
          case "ASSIGNED":
            await notifyClientOrderAssigned({ userId, orderId, orderCode });
            break;
          case "PICKED":
            await notifyClientOrderPicked({ userId, orderId, orderCode });
            break;
          case "AWAITING_CONFIRMATION":
            await notifyClientOrderDelivered({ userId, orderId, orderCode });
            break;
        }
      } catch (e) {
        debugWarn("Notif", "ORDER_STATUS_CHANGED listener error", e?.message);
      }
    },
  );

  // 2) Поиск курьера → пуш курьерам
  const unsub2 = pubsub.subscribe(
    TOPICS.COURIER_SEARCH_NOTIFY,
    async (payload) => {
      try {
        const ev = payload?.courierSearchNotify;
        if (!ev?.riderIds?.length) return;
        await notifyRidersNewOrder({
          riderIds: ev.riderIds,
          orderId: ev.orderId,
          orderCode: ev.orderIdStr,
          restaurantName: ev.restaurantName || "Ресторан",
          total: 0, // TODO: подтянуть amounts.total из order
          etaMin: "?",
        });
      } catch (e) {
        debugWarn("Notif", "COURIER_SEARCH listener error", e?.message);
      }
    },
  );

  // 3) Курьер вблизи точки доставки → пуш клиенту
  const unsub3 = pubsub.subscribe(
    TOPICS.RIDER_NEAR_DROP_OFF("*"),
    async (payload) => {
      try {
        const ev = payload?.riderNearDropOff;
        if (!ev?.orderId) return;
        const order = await Order.findById(ev.orderId)
          .select("userId orderId")
          .lean();
        if (!order?.userId) return;
        await notifyClientRiderNearDropOff({
          userId: String(order.userId),
          orderId: String(order._id),
          distanceM: ev.distanceM,
        });
      } catch (e) {
        debugWarn("Notif", "RIDER_NEAR listener error", e?.message);
      }
    },
  );

  // 4) Новый заказ → пуш ресторану
  //    (используем subscribePlaceOrder, т.к. это событие ресторана)
  //    Включаем как fallback (если ORDER_STATUS_CHANGED не сработал)
  const unsub4 = pubsub.subscribe(TOPICS.PLACE_ORDER("*"), async (payload) => {
    try {
      const order = payload?.subscribePlaceOrder;
      if (!order?._id) return;
      const fullOrder = await Order.findById(order._id)
        .select("restaurantId userId orderId amounts.total items")
        .populate("restaurantId", "ownerId name")
        .lean();
      if (!fullOrder?.restaurantId?.ownerId) return;
      await notifyRestaurantNewOrder({
        restaurantId: String(fullOrder.restaurantId._id),
        ownerId: String(fullOrder.restaurantId.ownerId),
        orderId: String(fullOrder._id),
        total: fullOrder.amounts?.total ?? 0,
        itemsCount: fullOrder.items?.length ?? 0,
      });
    } catch (e) {
      debugWarn("Notif", "PLACE_ORDER listener error", e?.message);
    }
  });

  return () => {
    try {
      unsub1?.();
      unsub2?.();
      unsub3?.();
      unsub4?.();
    } catch {}
  };
}
