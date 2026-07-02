// dastbadast-multivendor-api/src/pubsub.js
import { PubSub } from "graphql-subscriptions";
export const pubsub = new PubSub();

export const TOPICS = {
  ORDER_STATUS_CHANGED: (userId) => `ORDER_STATUS_CHANGED_${userId}`,
  PLACE_ORDER: (restaurantId) => `PLACE_ORDER_${restaurantId}`,
  ORDER_TRACK: (orderId) => `ORDER_TRACK_${orderId}`,
  RIDER_ASSIGNED: (riderId) => `RIDER_ASSIGNED_${riderId}`,
  RIDER_LOCATION: (riderId) => `RIDER_LOCATION_${riderId}`,
  RIDER_ORDER_COMPLETED: (riderId) => `RIDER_ORDER_COMPLETED_${riderId}`,
  ZONE_ORDERS: (zoneId) => `ZONE_ORDERS_${zoneId || "all"}`,
  AVAILABLE_ORDERS: (zoneId) => `AVAILABLE_ORDERS_${zoneId || "all"}`,
  CHAT: (orderId) => `CHAT_${orderId}`,

  COURIER_SEARCH_NOTIFY: "COURIER_SEARCH_NOTIFY",
  ALL_DELIVERIES: "ALL_DELIVERIES",

  RIDER_NEAR_DROP_OFF: (orderId) => `RIDER_NEAR_DROP_OFF_${orderId}`,
  RIDER_NEAR_RESTAURANT: (orderId) => `RIDER_NEAR_RESTAURANT_${orderId}`,
};
