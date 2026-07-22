// dastbadast-multivendor-api/src/resolvers/subscriptions.js
import { GraphQLError } from "graphql";
import { pubsub, TOPICS } from "../pubsub.js";
import { Order } from "../models/Order.js";
import { trackSubscription } from "../middleware/health.js";
import { SupportThread } from "../models/SupportThread.js";

export const orderStatusChanged = {
  subscribe: (_p, { userId }) =>
    pubsub.asyncIterator(TOPICS.ORDER_STATUS_CHANGED(userId)),
  resolve: (p) => p.orderStatusChanged,
};

// Обёртка: каждая подписка инкрементит счётчик
function wrapSubscribe(subscribeFn) {
  return async (...args) => {
    trackSubscription("open");
    const iter = await subscribeFn(...args);
    const originalReturn = iter.return?.bind(iter);
    if (originalReturn) {
      iter.return = async () => {
        trackSubscription("close");
        return originalReturn();
      };
    }
    return iter;
  };
}
export const subscriptionOrder = {
  subscribe: wrapSubscribe((_, { orderId }) =>
    pubsub.asyncIterator(TOPICS.ORDER_TRACK(orderId)),
  ),
  resolve: async (payload, { orderId }) => {
    try {
      // ⭐ Двойная страховка: если pubsub передал полный Order — берём его,
      // но всё равно ВАЛИДИРУЕМ через .toObject() и мерджим со свежим из БД.
      // Если в pubsub только обрезок — берём целиком из БД.
      let order = payload?.subscriptionOrder;
      if (!order || !order._id) {
        order = await Order.findById(orderId);
      } else {
        // Подтягиваем свежее состояние из БД (могли обновиться координаты, статусы, timestamps)
        const fresh = await Order.findById(orderId).lean();
        if (fresh) {
          // Мерджим: свежее из БД имеет приоритет
          order = { ...order, ...fresh };
        }
      }
      return order;
    } catch (e) {
      console.error("[subscriptionOrder] resolve error:", e?.message);
      return payload?.subscriptionOrder ?? null;
    }
  },
};
export const subscriptionMenuAvailability = {
  subscribe: (_p, { restaurantId }) =>
    pubsub.asyncIterator(TOPICS.MENU_AVAILABILITY_CHANGED(restaurantId)),
};

export const subscribePlaceOrder = {
  subscribe: (_p, { restaurantId }) =>
    pubsub.asyncIterator(TOPICS.PLACE_ORDER(restaurantId)),
  resolve: async (payload, { restaurantId }) => {
    // ⭐ ШАГ 4: аналогично — обновляем из БД
    let order = payload?.subscribePlaceOrder;
    if (!order || !order._id) {
      order = await Order.findById(restaurantId);
    } else {
      const fresh = await Order.findById(order._id).lean();
      if (fresh) order = { ...order, ...fresh };
    }
    return order;
  },
};
export const subscriptionAssignedRider = {
  subscribe: (_p, { riderId }) =>
    pubsub.asyncIterator(TOPICS.RIDER_ASSIGNED(riderId)),
  resolve: async (payload, { riderId }) => {
    let order = payload?.subscriptionAssignedRider;
    if (!order || !order._id) {
      order = await Order.findOne({ riderId }).sort({ createdAt: -1 });
    } else {
      const fresh = await Order.findById(order._id).lean();
      if (fresh) order = { ...order, ...fresh };
    }
    return order;
  },
};
export const subscriptionZoneOrders = {
  subscribe: (_p, { zoneId }) =>
    pubsub.asyncIterator(TOPICS.ZONE_ORDERS(zoneId)),
  resolve: (p) => p.subscriptionZoneOrders,
};
export const subscriptionAvailableOrders = {
  subscribe: (_p, { zoneId }) =>
    pubsub.asyncIterator(TOPICS.AVAILABLE_ORDERS(zoneId)),
  resolve: (p) => p.subscriptionAvailableOrders,
};
export const subscriptionRiderLocation = {
  subscribe: wrapSubscribe((_, { riderId }) => {
    if (!riderId) {
      throw new GraphQLError("riderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.RIDER_LOCATION(riderId));
  }),
  resolve: (p) => p.subscriptionRiderLocation,
};

export const subscriptionRiderOrderCompleted = {
  subscribe: (_p, { riderId }) => {
    if (!riderId) {
      throw new GraphQLError("riderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.RIDER_ORDER_COMPLETED(riderId));
  },
  resolve: (p) => p.subscriptionRiderOrderCompleted,
};

export const newChatMessage = {
  subscribe: (_p, { orderId }) => {
    if (!orderId) {
      throw new GraphQLError("orderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.CHAT(orderId));
  },
  resolve: (p) => p.newChatMessage,
};

// ⭐ NEW: typing indicator ("собеседник печатает…")
export const chatTypingStatus = {
  subscribe: (_p, { orderId }) => {
    if (!orderId) {
      throw new GraphQLError("orderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.CHAT_TYPING(orderId));
  },
  resolve: (p) => p.chatTypingStatus,
};

// ⭐ NEW: read receipts ("прочитано")
export const chatReadStatusChanged = {
  subscribe: (_p, { orderId }) => {
    if (!orderId) {
      throw new GraphQLError("orderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.CHAT_READ(orderId));
  },
  resolve: (p) => p.chatReadStatusChanged,
};

// ⭐⭐⭐ НОВОЕ: уведомления автопоиска курьера
// Курьер подписывается на этот канал и получает список заказов,
// которые были разосланы ему при автопоиске.
export const courierSearchNotify = {
  subscribe: (_p, _args) => {
    return pubsub.asyncIterator(TOPICS.COURIER_SEARCH_NOTIFY);
  },
  resolve: (p) => p.courierSearchNotify,
};

export const newSupportMessage = {
  subscribe: (_p, { threadId }) => {
    if (!threadId) {
      throw new GraphQLError("threadId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.SUPPORT_THREAD(threadId));
  },
  resolve: (p) => p.newSupportMessage,
};

// ⭐ NEW: живое обновление списка тредов в админке (новый тред / новое
// сообщение / переназначение / закрытие — публикуется отовсюду из support.js)
export const supportInboxUpdated = {
  subscribe: (_p, _args, ctx) => {
    // Доступ только сотрудникам поддержки — переиспользуем ту же проверку,
    // что и в остальных резолверах support.js (роль SUPPORT / SUPER_ADMIN).
    if (!ctx.owner) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return pubsub.asyncIterator(TOPICS.SUPPORT_INBOX);
  },
  resolve: (p) => p.supportInboxUpdated,
};
