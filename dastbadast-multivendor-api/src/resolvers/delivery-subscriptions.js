// dastbadast-multivendor-api/src/resolvers/delivery-subscriptions.js
//
// Подписки на жизненный цикл доставки.
// Это "обёртка" над subscriptionOrder, которая фильтрует события
// по заказу и возвращает расширенный payload с ETA.

import { GraphQLError } from "graphql";
import { pubsub, TOPICS } from "../pubsub.js";

/**
 * ⭐⭐⭐ NEW: подписка на все изменения статуса конкретного заказа.
 * Расширяет subscriptionOrder дополнительными полями ETA.
 *
 * Payload:
 *   {
 *     order: Order,
 *     etaToRestaurant: Int?,    // секунды
 *     etaToCustomer: Int?,      // секунды
 *     event: String              // 'STATUS_CHANGED' | 'ETA_UPDATED' | 'LOCATION_UPDATED'
 *   }
 *
 * GraphQL:
 *   subscription DeliveryStatusChanged($orderId: ID!) { ... }
 */
export const deliveryStatusChanged = {
  subscribe: async (_p, { orderId }) => {
    if (!orderId) {
      throw new GraphQLError("orderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    // Топик = ORDER_TRACK_<orderId>, формат payload расширен
    return pubsub.asyncIterator(TOPICS.ORDER_TRACK(orderId));
  },
  resolve: (payload) => {
    return {
      order: payload.subscriptionOrder,
      etaToRestaurant: payload.etaToRestaurant ?? null,
      etaToCustomer: payload.etaToCustomer ?? null,
      event: payload.event || "STATUS_CHANGED",
    };
  },
};

/**
 * ⭐⭐⭐ NEW: глобальный канал для админ-панели (мониторинг всех заказов).
 *
 * GraphQL:
 *   subscription AllDeliveries { ... }
 */
export const allDeliveries = {
  subscribe: () => pubsub.asyncIterator(TOPICS.ALL_DELIVERIES),
  resolve: (payload) => payload.order,
};
