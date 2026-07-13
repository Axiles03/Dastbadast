// dastbadast-multivendor-api/src/resolvers/index.js
import { configuration, updateConfiguration } from "./configuration.js";
import { deliveryZone } from "./zone-public.js";
import { chatMessages, sendChatMessage } from "./chat.js";
import { getCart, saveCart, estimateDelivery } from "./cart.js";
// ⭐ ФИКС: этот импорт отсутствовал вовсе — весь модуль delivery.js
// (флоу ресторан готовит -> курьер принял/забрал/приехал/доставил)
// был объявлен в schema.js, но ни разу не подключён к резолверам.
import {
  markOrderPreparing,
  markOrderReady,
  acceptDelivery,
  pickupDelivery,
  arriveAtDropOff,
  markDelivered,
} from "./delivery.js";
const calculateDeliveryPriceQuery = (
  _p,
  { fromCoords, toCoords, basePrice, baseKm, perKmPrice },
) => {
  if (!Array.isArray(fromCoords) || fromCoords.length < 2) return 0;
  if (!Array.isArray(toCoords) || toCoords.length < 2) return 0;
  return calculateDeliveryPriceBreakdown(fromCoords, toCoords, {
    basePrice,
    baseKm,
    perKmPrice,
  });
};

const calculateDeliveryPriceBreakdownQuery = (_p, { fromCoords, toCoords }) => {
  if (!Array.isArray(fromCoords) || fromCoords.length < 2) return null;
  if (!Array.isArray(toCoords) || toCoords.length < 2) return null;
  return calculateDeliveryPriceBreakdown(fromCoords, toCoords);
};
import { restaurants, restaurant, isRestaurantOpenNow } from "./restaurant.js";
import {
  calculateDeliveryPrice,
  calculateDeliveryPriceBreakdown,
  routeDistanceKm as calculateRouteDistanceKm,
  routeDistanceKmAsync as calculateRouteDistanceKmAsync, // ⭐ НОВОЕ
} from "../utils/delivery-price.js";
import { Order } from "../models/Order.js";
import { etaForRiderToAddress } from "../utils/eta.js";
import { fetchRouteGeometry } from "../utils/geoapify.js"; // ⭐ ШАГ 5
// ⭐ ШАГ 3 NEW: Rider model для резолвера etaToCustomer
import { Rider } from "../models/Rider.js";
import {
  profile,
  addresses,
  selectedAddress,
  createUser,
  login,
  createAddress,
  editAddress,
  deleteAddress,
  selectAddress,
  adminUsers,
  adminUserDetail,
  toggleUserActive,
  updateUser,
  userLTV,
  userOrderFrequency,
  userCohorts,
  churnRate,
  demandForecast,
} from "./user.js";
import {
  orders,
  order,
  placeOrder,
  restaurantOrders,
  meRestaurant,
  restaurantLogin,
  confirmOrderReceived,
  refreshOrderStatus,
} from "./order.js";
import { acceptOrder, cancelOrder } from "./order-actions.js";
import { foodReviews, addFoodReview, foodRatingStats } from "./food-review.js";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createFood,
  updateFood,
  deleteFood,
  updateMyRestaurant,
} from "./restaurant-menu.js";
import {
  allOrders,
  ownerLogin,
  meOwner,
  createRider,
  riders,
  assignRider,
  createRestaurant,
  adminAccounting,
  owners,
  ownerOne,
  createOwner,
  updateOwner,
  deactivateOwner,
  resetOwnerPassword,
  zones,
  zoneOne,
  createZone,
  updateZone,
  deleteZone,
  adminDashboardMetrics,
  updateRestaurant,
  updateRider,
  toggleRiderActive,
  riderFinancials,
  allRidersWithLocation,
  ordersForMap,
  riderLocationOnMap,
} from "./admin.js";
import {
  meRider,
  riderOrders,
  availableOrdersForRiders,
  riderLogin,
  claimOrder,
  updateOrderStatusRider,
  updateRiderLocation,
  toggleRider,
  updateRiderProfile,
  changeRiderPassword,
  stopRiderLocationStream, // ⭐ ФИКС: было в rider.js, но не импортировано
  rider as riderOne,
  riderLocationStream,
  allOrdersChanged,
} from "./rider.js";
import {
  orderStatusChanged,
  subscriptionOrder,
  subscribePlaceOrder,
  subscriptionAssignedRider,
  subscriptionZoneOrders,
  subscriptionAvailableOrders,
  subscriptionRiderLocation,
  subscriptionRiderOrderCompleted,
  newChatMessage,
  courierSearchNotify,
} from "./subscriptions.js";
import { JSONScalar, DateTimeScalar } from "../utils/scalars.js";

import {
  registerPushToken,
  unregisterPushToken,
  myPushTokens,
} from "./notifications.js";

const mongoId = (parent) => parent?.id ?? parent?._id?.toString();

export const resolvers = {
  JSON: JSONScalar,
  DateTime: DateTimeScalar,
  Query: {
    configuration,
    deliveryZone,
    // ⭐ ШАГ 5: ETA готовки (минуты, null если ещё не принят рестораном)
    restaurantPrepEta: async (_p, { orderId }) => {
      if (!orderId) return null;
      const order = await Order.findById(orderId)
        .select("statusTimestamps orderStatus")
        .lean();
      if (!order) return null;
      const t = order.statusTimestamps;
      // ⭐ Используем существующую формулу: оставшееся = prepTime - elapsed
      // prepTime и acceptedAt уже есть в statusTimestamps (см. models/Order.js)
      if (!t?.acceptedAt || !t?.prepTime || t.prepTime <= 0) return null;
      if (
        order.orderStatus !== "ACCEPTED" &&
        order.orderStatus !== "PREPARING" &&
        order.orderStatus !== "READY_FOR_PICKUP"
      ) {
        return 0; // заказ прошёл этап готовки
      }
      const elapsedMin =
        (Date.now() - new Date(t.acceptedAt).getTime()) / 60_000;
      const remaining = Math.max(0, Math.ceil(t.prepTime - elapsedMin));
      return remaining;
    },
    restaurants,
    restaurant,
    foodReviews,
    getCart,
    estimateDelivery,
    profile,
    addresses,
    selectedAddress,
    orders,
    order,
    restaurantOrders,
    meRestaurant,
    allOrders,
    riders,
    meOwner,
    meRider,
    riderOrders,
    availableOrdersForRiders,
    chatMessages,
    adminAccounting,
    rider: riderOne,
    owners,
    owner: ownerOne,
    adminUsers,
    adminUserDetail,
    zones,
    zone: zoneOne,
    adminDashboardMetrics,
    myPushTokens,
    calculateDeliveryPrice: calculateDeliveryPriceQuery,
    calculateDeliveryPriceBreakdown: calculateDeliveryPriceBreakdownQuery,
    riderFinancials,
    allRidersWithLocation,
    ordersForMap,
    riderLocationOnMap,
    userLTV,
    userOrderFrequency,
    userCohorts,
    churnRate,
    demandForecast,
  },
  Mutation: {
    createUser,
    login,
    createAddress,
    editAddress,
    deleteAddress,
    selectAddress,
    placeOrder,
    addFoodReview,
    restaurantLogin,
    acceptOrder,
    cancelOrder,
    createCategory,
    updateCategory,
    deleteCategory,
    createFood,
    updateFood,
    deleteFood,
    saveCart,
    ownerLogin,
    createRider,
    createRestaurant,
    assignRider,
    riderLogin,
    claimOrder,
    updateOrderStatusRider,
    confirmOrderReceived,
    updateRiderLocation,
    toggleRider,
    updateRiderProfile,
    changeRiderPassword,
    sendChatMessage,
    createOwner,
    updateOwner,
    deactivateOwner,
    resetOwnerPassword,
    toggleUserActive,
    createZone,
    updateZone,
    deleteZone,
    updateConfiguration,
    updateUser,
    registerPushToken,
    unregisterPushToken,
    // ⭐ ФИКС: объявлены в schema.js, но отсутствовали здесь — вызовы падали
    // с "Cannot return null for non-nullable field".
    markOrderPreparing,
    markOrderReady,
    acceptDelivery,
    pickupDelivery,
    arriveAtDropOff,
    markDelivered,
    refreshOrderStatus, // ⭐ был импортирован из order.js, но не подключён
    stopRiderLocationStream,
    updateMyRestaurant,
    updateRestaurant,
    updateRider,
    toggleRiderActive,
    refreshOrderStatus,
  },

  Subscription: {
    orderStatusChanged,
    subscriptionOrder,
    subscribePlaceOrder,
    subscriptionAssignedRider,
    subscriptionZoneOrders,
    subscriptionAvailableOrders,
    subscriptionRiderLocation,
    subscriptionRiderOrderCompleted,
    newChatMessage,
    courierSearchNotify,
    riderLocationStream,
    allOrdersChanged,
  },
  Restaurant: {
    id: mongoId,
    isOpenNow: isRestaurantOpenNow,
    categories: async (parent) => {
      const { Category } = await import("../models/Category.js");
      return Category.find({ restaurantId: parent._id });
    },
  },
  Category: {
    id: mongoId,
    foods: async (parent, _a, ctx) => {
      const { Food } = await import("../models/Food.js");
      const filter = { categoryId: parent._id };
      const isOwner =
        ctx.restaurant &&
        parent.restaurantId &&
        parent.restaurantId.toString() === ctx.restaurant._id.toString();
      if (!isOwner) {
        filter.isActive = true;
        filter.isAvailable = true;
      } else {
        filter.isActive = true;
      }
      return Food.find(filter).sort({ createdAt: 1 });
    },
  },
  Address: { id: mongoId },
  Order: {
    id: mongoId,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
    updatedAt: (p) => p.updatedAt?.toISOString?.() ?? String(p.updatedAt ?? ""),
    paidAt: (p) => p.paidAt?.toISOString?.() ?? null,

    statusTimestamps: (p) => {
      const t = p.statusTimestamps || {};
      return {
        pendingAt: t.pendingAt?.toISOString?.() ?? null,
        acceptedAt: t.acceptedAt?.toISOString?.() ?? null,
        assignedAt: t.assignedAt?.toISOString?.() ?? null,
        pickedAt: t.pickedAt?.toISOString?.() ?? null,
        deliveredAt: t.deliveredAt?.toISOString?.() ?? null,
        cancelledAt: t.cancelledAt?.toISOString?.() ?? null,
        prepTime: t.prepTime ?? null,
      };
    },
    // ⭐ Шаг 1: вычисляемая стоимость доставки (формула: 10 + 3*(km-3))
    deliveryPrice: (parent) => {
      const from = parent.pickupAddress?.location?.coordinates;
      const to = parent.deliveryAddress?.location?.coordinates;
      if (!Array.isArray(from) || !Array.isArray(to)) return null;
      return calculateDeliveryPrice(from, to);
    },

    // ⭐⭐⭐ ШАГ 3 NEW: расстояние маршрута в км (0 если не вычислимо).
    routeDistanceKm: (parent) =>
      calculateRouteDistanceKmAsync(
        parent.pickupAddress?.location?.coordinates,
        parent.deliveryAddress?.location?.coordinates,
      ),

    // ⭐⭐⭐ ШАГ 5: реальная геометрия маршрута ПО ДОРОГАМ (Geoapify Routing
    // API, тот же провайдер, что уже используется для стоимости доставки
    // в delivery-price.js — переиспользуем ключ/кеш/таймаут-инфраструктуру).
    // Раньше здесь была прямая линия (LineString из 2 точек) — теперь это
    // только fallback на случай, если Geoapify недоступен/не настроен
    // (нет GEOAPIFY_API_KEY, таймаут, HTTP-ошибка и т.п.), чтобы карта
    // никогда не оставалась без линии маршрута вовсе.
    routeGeometry: async (parent) => {
      const from = parent.pickupAddress?.location?.coordinates;
      const to = parent.deliveryAddress?.location?.coordinates;
      if (!Array.isArray(from) || from.length < 2) return null;
      if (!Array.isArray(to) || to.length < 2) return null;

      const geometry = await fetchRouteGeometry(from, to);
      if (geometry) {
        return {
          type: "LineString",
          coordinates: geometry.coordinates,
        };
      }

      // Fallback: прямая линия (как было раньше на Шаге 4)
      return {
        type: "LineString",
        coordinates: [from, to],
      };
    },

    // ⭐⭐⭐ ШАГ 3 NEW: ETA от курьера до клиента в СЕКУНДАХ.
    // Использует существующую функцию etaForRiderToAddress() (utils/eta.js).
    // Возвращает null если нет курьера, нет локации курьера, или нет destination.
    etaToCustomer: async (parent) => {
      if (!parent.riderId) return null;
      const rider = await Rider.findById(parent.riderId)
        .select("location")
        .lean();
      if (!rider?.location?.coordinates) return null;
      const dest = parent.deliveryAddress?.location?.coordinates;
      if (!Array.isArray(dest) || dest.length < 2) return null;
      return await etaForRiderToAddress(rider.location.coordinates, dest);
    },
    deliveryBreakdown: (parent) => {
      const from = parent.pickupAddress?.location?.coordinates;
      const to = parent.deliveryAddress?.location?.coordinates;
      if (!Array.isArray(from) || from.length < 2) return null;
      if (!Array.isArray(to) || to.length < 2) return null;
      return calculateDeliveryPriceBreakdown(from, to);
    },
    riderLocation: async (parent) => {
      if (!parent.riderId) return null;
      const rider = await Rider.findById(parent.riderId)
        .select("location lastLocationAt")
        .lean();
      if (!rider?.location?.coordinates) return null;
      const [lng, lat] = rider.location.coordinates;
      if (lat === 0 && lng === 0) return null; // "нулевые" координаты = нет данных
      return {
        lat,
        lng,
        updatedAt:
          rider.lastLocationAt?.toISOString?.() ?? new Date().toISOString(),
      };
    },
  },

  Cart: {
    // ⭐ Mongo ObjectId → строка
    id: mongoId,
    userId: (parent) => String(parent.userId),
    restaurantId: (parent) =>
      parent.restaurantId ? String(parent.restaurantId) : null,
    updatedAt: (parent) =>
      parent.updatedAt instanceof Date
        ? parent.updatedAt.toISOString()
        : parent.updatedAt,
    // ⭐ Производные поля (Шаг 2)
    subtotal: (parent) =>
      +parent.items
        .reduce((s, i) => s + (i.basePrice + i.optionsTotal) * i.quantity, 0)
        .toFixed(2),
    itemCount: (parent) => parent.items.reduce((s, i) => s + i.quantity, 0),
  },

  CartItem: {
    // ⭐ Sub-resolver: конвертируем ObjectId в строку для GraphQL ID
    foodId: (parent) => String(parent.foodId),
    // lineTotal — Mongoose virtual, но для безопасности дублируем в resolver
    lineTotal: (parent) =>
      +((parent.basePrice + parent.optionsTotal) * parent.quantity).toFixed(2),
  },

  // ⭐ Подрезолвер для опций в корзине (для консистентности с OrderItemOption)
  CartItemOption: {
    groupId: (parent) => String(parent.groupId),
    optionId: (parent) => String(parent.optionId),
  },

  User: { id: mongoId },
  Configuration: {
    taxPercent: (parent) =>
      typeof parent.taxPercent === "number" ? parent.taxPercent : 10,
  },
  Food: {
    id: mongoId,
    averageRating: async (parent) => {
      const s = await foodRatingStats(parent._id);
      return s.averageRating;
    },
    reviewCount: async (parent) => {
      const s = await foodRatingStats(parent._id);
      return s.reviewCount;
    },
    reviews: async (parent) => {
      const { FoodReview } = await import("../models/FoodReview.js");
      return FoodReview.find({ foodId: parent._id })
        .sort({ createdAt: -1 })
        .limit(10);
    },
  },
  FoodReview: {
    id: mongoId,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
  },
  Rider: { id: mongoId },
  Owner: {
    id: mongoId,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
    lastLoginAt: (p) => p.lastLoginAt?.toISOString?.() ?? null,
  },
  Zone: { id: mongoId },
  ChatMessage: {
    id: mongoId,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
  },
  PushToken: {
    id: (p) => p._id?.toString?.() ?? p.id,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
    lastUsedAt: (p) => p.lastUsedAt?.toISOString?.() ?? null,
  },
};
