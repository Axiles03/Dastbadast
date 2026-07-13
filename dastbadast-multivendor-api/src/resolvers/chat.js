import { GraphQLError } from "graphql";
import { ChatMessage } from "../models/ChatMessage.js";
import { Order } from "../models/Order.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { notifyNewChatMessage } from "../lib/notifications/dispatcher.js";

const ALLOWED_STATUSES = [
  "ASSIGNED",
  "PICKED",
  "EN_ROUTE_TO_DROP_OFF",
  "ARRIVED_AT_DROP_OFF",
  "AWAITING_CONFIRMATION",
  "DELIVERED",
];

// ⭐ NEW: простой in-memory "presence" — фиксируем, когда каждая сторона
// последний раз открывала/фокусировала экран чата конкретного заказа.
// Используется, чтобы НЕ слать push, если получатель прямо сейчас и так
// смотрит в чат (см. markChatRead — вызывается клиентом при фокусе экрана).
// Это заглушка полноценного presence (например, через WS-heartbeat), но
// достаточно для типового кейса "пуш только когда экран чата не открыт".
const PRESENCE_TTL_MS = 20_000; // считаем "смотрит в чат", если открывал < 20с назад
const chatPresence = new Map(); // key: `${orderId}:${senderType}` -> timestamp

function markPresent(orderId, senderType) {
  chatPresence.set(`${orderId}:${senderType}`, Date.now());
}

function isRecentlyPresent(orderId, senderType) {
  const t = chatPresence.get(`${orderId}:${senderType}`);
  return !!t && Date.now() - t < PRESENCE_TTL_MS;
}

async function canAccessOrder(ctx, orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (ctx.user) {
    if (order.userId.toString() !== ctx.user._id.toString()) {
      throw new GraphQLError("Нет доступа к чату", {
        extensions: { code: "FORBIDDEN" },
      });
    }
    return { order, senderType: "USER", senderId: ctx.user._id.toString() };
  }
  if (ctx.rider) {
    if (
      !order.riderId ||
      order.riderId.toString() !== ctx.rider._id.toString()
    ) {
      throw new GraphQLError("Нет доступа к чату", {
        extensions: { code: "FORBIDDEN" },
      });
    }
    return { order, senderType: "RIDER", senderId: ctx.rider._id.toString() };
  }
  throw new GraphQLError("Не авторизован", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export const chatMessages = async (_p, { orderId }, ctx) => {
  await canAccessOrder(ctx, orderId);
  return ChatMessage.find({ orderId }).sort({ createdAt: 1 }).limit(500);
};

export const sendChatMessage = async (_p, { orderId, text, imageUrl }, ctx) => {
  const trimmed = (text || "").trim();
  const photo = (imageUrl || "").trim();
  if (!trimmed && !photo) {
    throw new GraphQLError("Пустое сообщение", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const { order, senderType, senderId } = await canAccessOrder(ctx, orderId);

  if (!ALLOWED_STATUSES.includes(order.orderStatus)) {
    throw new GraphQLError("Чат доступен только после назначения курьера", {
      extensions: { code: "BAD_STATE" },
    });
  }

  const msg = await ChatMessage.create({
    orderId,
    senderType,
    senderId,
    text: trimmed,
    imageUrl: photo || null,
  });
  const payload = { newChatMessage: msg };
  pubsub.publish(TOPICS.CHAT(orderId.toString()), payload);

  // ⭐ Отправитель больше не "печатает" — гасим индикатор сразу после отправки
  pubsub.publish(TOPICS.CHAT_TYPING(orderId.toString()), {
    chatTypingStatus: { orderId, senderType, isTyping: false },
  });

  // ⭐⭐⭐ NEW: push той стороне, которая сообщение НЕ отправляла — но только
  // если она не смотрит в чат прямо сейчас (см. presence выше).
  const recipientType = senderType === "USER" ? "RIDER" : "USER";
  if (!isRecentlyPresent(orderId.toString(), recipientType)) {
    const preview = photo && !trimmed ? "📷 Фото" : trimmed;
    notifyNewChatMessage({
      toType: senderType === "USER" ? "rider" : "user",
      toId: senderType === "USER" ? order.riderId : order.userId,
      orderId: orderId.toString(),
      preview,
    }).catch(() => {});
  }

  return msg;
};

// ⭐ NEW: пометить чат прочитанным (клиент вызывает при открытии/фокусе экрана).
// Также используется как presence-heartbeat для решения "слать ли push".
export const markChatRead = async (_p, { orderId }, ctx) => {
  const { senderType } = await canAccessOrder(ctx, orderId);
  markPresent(orderId.toString(), senderType);

  const now = new Date();
  // Помечаем прочитанными все сообщения ДРУГОЙ стороны, ещё не помеченные.
  const otherSide = senderType === "USER" ? "RIDER" : "USER";
  const res = await ChatMessage.updateMany(
    { orderId, senderType: otherSide, readAt: null },
    { $set: { readAt: now } },
  );

  if (res.modifiedCount > 0) {
    pubsub.publish(TOPICS.CHAT_READ(orderId.toString()), {
      chatReadStatusChanged: {
        orderId,
        readerType: senderType,
        readAt: now.toISOString(),
      },
    });
  }
  return true;
};

// ⭐ NEW: эфемерный typing indicator — ничего не пишем в БД, просто ретранслируем
export const sendTypingStatus = async (_p, { orderId, isTyping }, ctx) => {
  const { senderType } = await canAccessOrder(ctx, orderId);
  markPresent(orderId.toString(), senderType);
  pubsub.publish(TOPICS.CHAT_TYPING(orderId.toString()), {
    chatTypingStatus: { orderId, senderType, isTyping: !!isTyping },
  });
  return true;
};
