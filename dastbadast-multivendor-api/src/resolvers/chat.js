import { GraphQLError } from "graphql";
import { ChatMessage } from "../models/ChatMessage.js";
import { Order } from "../models/Order.js";
import { pubsub, TOPICS } from "../pubsub.js";

const ALLOWED_STATUSES = [
  "ASSIGNED",
  "PICKED",
  "AWAITING_CONFIRMATION",
  "DELIVERED",
];

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

export const sendChatMessage = async (_p, { orderId, text }, ctx) => {
  const trimmed = (text || "").trim();
  if (!trimmed) {
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
  });
  const payload = { newChatMessage: msg };
  pubsub.publish(TOPICS.CHAT(orderId.toString()), payload);
  return msg;
};
