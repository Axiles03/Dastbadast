// dastbadast-multivendor-api/src/pubsub-legacy.js
//
// ⚠️ DEPRECATED: используйте src/pubsub/index.js.
// Этот файл оставлен только для экспорта констант TOPICS,
// чтобы не ломать существующие импорты в резолверах.


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
  // ⭐ NEW: typing indicator и read receipts для чата
  CHAT_TYPING: (orderId) => `CHAT_TYPING_${orderId}`,
  CHAT_READ: (orderId) => `CHAT_READ_${orderId}`,

  // ⭐ NEW: чат поддержки (клиент/курьер/ресторан ↔ Owner с ролью SUPPORT)
  SUPPORT_THREAD: (threadId) => `SUPPORT_THREAD_${threadId}`,
  // Один общий канал: список тредов в админке живёт от любого события
  // (новый тред, новое сообщение, assign, close) — фильтрация по
  // ролям/статусу происходит на клиенте через рефетч.
  SUPPORT_INBOX: "SUPPORT_INBOX",

  COURIER_SEARCH_NOTIFY: "COURIER_SEARCH_NOTIFY",
  ALL_DELIVERIES: "ALL_DELIVERIES",

  RIDER_NEAR_DROP_OFF: (orderId) => `RIDER_NEAR_DROP_OFF_${orderId}`,
  RIDER_NEAR_RESTAURANT: (orderId) => `RIDER_NEAR_RESTAURANT_${orderId}`,

  // каналы инвалидации кэша (для HTTP middleware)
  CACHE_INVALIDATE_CONFIG: "cache:invalidate:configuration",
  CACHE_INVALIDATE_RESTAURANTS: "cache:invalidate:restaurants",
  CACHE_INVALIDATE_USER_PROFILE: (userId) =>
    `cache:invalidate:user_profile_${userId}`,
  MENU_AVAILABILITY_CHANGED: (restaurantId) =>
    `MENU_AVAILABILITY_CHANGED_${restaurantId}`,
};
