import { GraphQLError } from "graphql";
import { pubsub, TOPICS } from "../pubsub.js";

export const orderStatusChanged = {
  subscribe: (_p, { userId }) =>
    pubsub.asyncIterator(TOPICS.ORDER_STATUS_CHANGED(userId)),
  resolve: (p) => p.orderStatusChanged,
};
export const subscriptionOrder = {
  subscribe: (_p, { orderId }) =>
    pubsub.asyncIterator(TOPICS.ORDER_TRACK(orderId)),
  resolve: (p) => p.subscriptionOrder,
};
export const subscribePlaceOrder = {
  subscribe: (_p, { restaurantId }) =>
    pubsub.asyncIterator(TOPICS.PLACE_ORDER(restaurantId)),
  resolve: (p) => p.subscribePlaceOrder,
};
export const subscriptionAssignedRider = {
  subscribe: (_p, { riderId }) =>
    pubsub.asyncIterator(TOPICS.RIDER_ASSIGNED(riderId)),
  resolve: (p) => p.subscriptionAssignedRider,
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
  subscribe: (_p, { riderId }) => {
    if (!riderId) {
      throw new GraphQLError("riderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.RIDER_LOCATION(riderId));
  },
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
