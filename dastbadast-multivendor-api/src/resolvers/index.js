// dastbadast-multivendor-api/src/resolvers/index.js
import { configuration, updateConfiguration } from "./configuration.js";
import { deliveryZone } from "./zone-public.js";
import {
  chatMessages,
  sendChatMessage,
  markChatRead,
  sendTypingStatus,
} from "./chat.js";
import {
  mySupportThreads,
  supportThread,
  supportMessages,
  supportThreads,
  startSupportThread,
  sendSupportMessage,
  assignSupportThread,
  closeSupportThread,
  reopenSupportThread,
  markSupportRead,
  supportThreadUnreadForStaff,
  supportThreadUnreadForParticipant,
} from "./support.js";
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
import { restaurantReviews as restaurantReviewsQuery } from "./restaurant-reviews.js";

import {
  calculateDeliveryPrice,
  calculateDeliveryPriceBreakdown,
  routeDistanceKm as calculateRouteDistanceKm,
  routeDistanceKmAsync as calculateRouteDistanceKmAsync,
} from "../utils/delivery-price.js";
import { Order } from "../models/Order.js";
import { etaForRiderToAddress } from "../utils/eta.js";
import { fetchRouteGeometry } from "../utils/geoapify.js";
import { Configuration } from "../models/Configuration.js";
import { Food } from "../models/Food.js";
import { Category } from "../models/Category.js";
import { FoodReview } from "../models/FoodReview.js";
import { GraphQLError } from "graphql";
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
  setPassword,
  updateAvatar,
  userLTV,
  userOrderFrequency,
  userCohorts,
  churnRate,
  demandForecast,
  NAME_CHANGE_LIMIT,
  NAME_CHANGE_WINDOW_MS,
  AVATAR_CHANGE_WINDOW_MS,
} from "./user.js";
import {
  requestEmailChange,
  confirmEmailChange,
  cancelEmailChange,
  requestPhoneChange,
  confirmPhoneChange,
  cancelPhoneChange,
} from "./contact-change.js";
import { requestEmailVerification, verifyEmail } from "./email-verification.js";
import {
  requestOtpMutation,
  registerWithPhone,
  loginWithOtp,
  loginWithPassword,
  resetPasswordWithOtp,
} from "./auth-otp.js";
import {
  orders,
  order,
  placeOrder,
  restaurantOrders,
  meRestaurant,
  restaurantLogin,
  confirmOrderReceived,
  refreshOrderStatus,
  kitchenLoad,
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
  stopRiderLocationStream,
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
  newSupportMessage,
  supportInboxUpdated,
} from "./subscriptions.js";
import { JSONScalar, DateTimeScalar } from "../utils/scalars.js";

import {
  vapidPublicKey,
  subscribeWebPush,
  unsubscribeWebPush,
  sendTestWebPush,
} from "./web-push.js";

import {
  registerPushToken,
  unregisterPushToken,
  myPushTokens,
} from "./notifications.js";

const mongoId = (parent) => parent?.id ?? parent?._id?.toString();

function pruneOld(dates, windowMs) {
  const cutoff = Date.now() - windowMs;
  return (dates || [])
    .map((d) => new Date(d))
    .filter((d) => d.getTime() > cutoff)
    .sort((a, b) => a.getTime() - b.getTime());
}

export const resolvers = {
  JSON: JSONScalar,
  DateTime: DateTimeScalar,
  User: {
    hasPassword: (parent) => !!parent.passwordHash,
    nameChangesLeft: (parent) => {
      const recent = pruneOld(parent.nameChangeHistory, NAME_CHANGE_WINDOW_MS);
      return Math.max(0, NAME_CHANGE_LIMIT - recent.length);
    },
    nameChangeUnlocksAt: (parent) => {
      const recent = pruneOld(parent.nameChangeHistory, NAME_CHANGE_WINDOW_MS);
      if (recent.length < NAME_CHANGE_LIMIT) return null;
      return new Date(recent[0].getTime() + NAME_CHANGE_WINDOW_MS);
    },
    avatarUnlocksAt: (parent) => {
      if (!parent.avatarChangedAt) return null;
      const unlocks =
        new Date(parent.avatarChangedAt).getTime() + AVATAR_CHANGE_WINDOW_MS;
      return unlocks > Date.now() ? new Date(unlocks) : null;
    },
  },
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
      if (!t?.acceptedAt || !t?.prepTime || t.prepTime <= 0) return null;
      if (
        order.orderStatus !== "ACCEPTED" &&
        order.orderStatus !== "PREPARING" &&
        order.orderStatus !== "READY_FOR_PICKUP"
      ) {
        return 0;
      }
      const elapsedMin =
        (Date.now() - new Date(t.acceptedAt).getTime()) / 60_000;
      const remaining = Math.max(0, Math.ceil(t.prepTime - elapsedMin));
      return remaining;
    },
    kitchenLoad,
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
    mySupportThreads,
    supportThread,
    supportMessages,
    supportThreads,
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
    currentRiderLocation: async (_p, { riderId }, ctx) => {
      if (!riderId) return null;
      if (!ctx.user && !ctx.rider && !ctx.owner) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const r = await Rider.findById(riderId)
        .select("location lastLocationAt")
        .lean();
      if (!r?.location?.coordinates) return null;
      const [lng, lat] = r.location.coordinates;
      if (lat === 0 && lng === 0) return null;
      return {
        riderId: String(riderId),
        lat,
        lng,
        updatedAt:
          r.lastLocationAt?.toISOString?.() ?? new Date().toISOString(),
      };
    },
    userLTV,
    userOrderFrequency,
    userCohorts,
    churnRate,
    demandForecast,
    restaurantReviews: restaurantReviewsQuery,
    vapidPublicKey,
    restaurantDistance: async (_p, { id, addressId }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const { Restaurant } = await import("../models/Restaurant.js");
      const { User } = await import("../models/User.js");
      const { haversineKm } = await import("../utils/geo.js");

      const rest = await Restaurant.findById(id).select("location").lean();
      const user = await User.findById(ctx.user._id);
      const addr = user?.addresses?.id(addressId);
      if (!rest?.location?.coordinates || !addr?.location?.coordinates)
        return null;
      return +haversineKm(
        rest.location.coordinates[1],
        rest.location.coordinates[0],
        addr.location.coordinates[1],
        addr.location.coordinates[0],
      ).toFixed(2);
    },

    restaurantDeliveryEta: async (_p, { id, addressId }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const { Order } = await import("../models/Order.js");
      const recent = await Order.find({
        restaurantId: id,
        orderStatus: "DELIVERED",
        "statusTimestamps.acceptedAt": { $ne: null },
        "statusTimestamps.readyAt": { $ne: null },
      })
        .sort({ "statusTimestamps.readyAt": -1 })
        .limit(30)
        .select("statusTimestamps")
        .lean();

      let estimatedPrepMinutes = 25;
      if (recent.length > 0) {
        const durations = recent
          .map((o) => {
            const a = o.statusTimestamps?.acceptedAt;
            const r = o.statusTimestamps?.readyAt;
            if (!a || !r) return null;
            return (new Date(r).getTime() - new Date(a).getTime()) / 60_000;
          })
          .filter((v) => typeof v === "number" && v > 0 && v < 240);
        if (durations.length > 0) {
          estimatedPrepMinutes = Math.round(
            durations.reduce((s, v) => s + v, 0) / durations.length,
          );
        }
      }

      const { Restaurant } = await import("../models/Restaurant.js");
      const { User } = await import("../models/User.js");
      const { haversineKm } = await import("../utils/geo.js");
      const rest = await Restaurant.findById(id).select("location").lean();
      const user = await User.findById(ctx.user._id);
      const addr = user?.addresses?.id(addressId);
      let distanceKm = null;
      if (rest?.location?.coordinates && addr?.location?.coordinates) {
        distanceKm = +haversineKm(
          rest.location.coordinates[1],
          rest.location.coordinates[0],
          addr.location.coordinates[1],
          addr.location.coordinates[0],
        ).toFixed(2);
      }

      const travel = distanceKm != null ? (distanceKm / 25) * 60 : 0;
      const handover = 5;
      const estimatedDeliveryMinutes = Math.round(
        estimatedPrepMinutes + travel + handover,
      );

      return {
        distanceKm,
        estimatedPrepMinutes,
        estimatedDeliveryMinutes,
      };
    },
  },
  Mutation: {
    createUser,
    login,
    requestOtp: requestOtpMutation,
    registerWithPhone,
    loginWithOtp,
    loginWithPassword,
    setPassword,
    updateAvatar,
    requestEmailChange,
    confirmEmailChange,
    cancelEmailChange,
    requestPhoneChange,
    confirmPhoneChange,
    cancelPhoneChange,
    requestEmailVerification,
    verifyEmail,
    subscribeWebPush,
    unsubscribeWebPush,
    sendTestWebPush,
    resetPasswordWithOtp,
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
    markChatRead,
    sendTypingStatus,
    // ⭐ NEW: чат поддержки
    startSupportThread,
    sendSupportMessage,
    assignSupportThread,
    closeSupportThread,
    reopenSupportThread,
    markSupportRead,
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
    markOrderPreparing,
    markOrderReady,
    acceptDelivery,
    pickupDelivery,
    arriveAtDropOff,
    markDelivered,
    refreshOrderStatus,
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
    newSupportMessage,
    supportInboxUpdated,
  },

  SupportThread: {
    id: mongoId,
    createdAt: (p) => new Date(p.createdAt).toISOString(),
    lastMessageAt: (p) =>
      p.lastMessageAt ? new Date(p.lastMessageAt).toISOString() : null,
    assignedOwnerEmail: async (p) => {},
    unreadForStaff: supportThreadUnreadForStaff,
    unreadForParticipant: supportThreadUnreadForParticipant,
    staffReadAt: (p) =>
      p.staffReadAt ? new Date(p.staffReadAt).toISOString() : null,
    participantReadAt: (p) =>
      p.participantReadAt ? new Date(p.participantReadAt).toISOString() : null,
    participantAvatar: async (p) => {
      if (p.participantType === "RIDER") {
        const { Rider } = await import("../models/Rider.js");
        const r = await Rider.findById(p.participantId).select("photo").lean();
        return r?.photo || null;
      }
      if (p.participantType === "RESTAURANT") {
        const { Restaurant } = await import("../models/Restaurant.js");
        const r = await Restaurant.findById(p.participantId)
          .select("image")
          .lean();
        return r?.image || null;
      }
      return null; // у User нет поля с фото
    },
  },
  SupportMessage: {
    id: mongoId,
    createdAt: (p) =>
      p.createdAt ? new Date(p.createdAt).toISOString() : null,
    readByStaff: async (p) => {
      const { SupportThread } = await import("../models/SupportThread.js");
      const t = await SupportThread.findById(p.threadId)
        .select("staffReadAt")
        .lean();
      return !!(
        t?.staffReadAt && new Date(t.staffReadAt) >= new Date(p.createdAt)
      );
    },
    readByParticipant: async (p) => {
      const { SupportThread } = await import("../models/SupportThread.js");
      const t = await SupportThread.findById(p.threadId)
        .select("participantReadAt")
        .lean();
      return !!(
        t?.participantReadAt &&
        new Date(t.participantReadAt) >= new Date(p.createdAt)
      );
    },
  },
  Restaurant: {
    id: mongoId,
    isOpenNow: isRestaurantOpenNow,
    distanceKm: async (parent, args, ctx) => {
      if (parent.distanceM != null) {
        return +(parent.distanceM / 1000).toFixed(2);
      }
      if (!args?.addressId) return null;
      const addr = await ctx.loaders?.addresses?.load?.(
        `${ctx.user?._id}:${args.addressId}`,
      );
      const address =
        addr ??
        (await (async () => {
          const { User } = await import("../models/User.js");
          const u = await User.findById(ctx.user._id);
          return u?.addresses?.id(args.addressId) ?? null;
        })());
      if (!address?.location?.coordinates) return null;
      const rest = await (parent._id
        ? Promise.resolve(parent)
        : import("../models/Restaurant.js").then((m) =>
            m.Restaurant.findById(parent.id),
          ));
      if (!rest?.location?.coordinates) return null;
      const { haversineKm } = await import("../utils/geo.js");
      return +haversineKm(
        rest.location.coordinates[1],
        rest.location.coordinates[0],
        address.location.coordinates[1],
        address.location.coordinates[0],
      ).toFixed(2);
    },
    estimatedPrepMinutes: async (parent) => {
      /* без изменений */
    },
    // ⭐ НОВОЕ: время доставки = среднее время готовки + дорога + 5 мин на
    // передачу. Использует существующий etaForRiderToAddress из utils/eta.js
    // (вместо простого 25 км/ч) — за счёт этого точность лучше.
    deliveryTime: async (parent) => {
      const prepMin = parent.estimatedPrepMinutes || 25;
      const distKm = parent.distanceKm;
      if (distKm == null || distKm === undefined) return prepMin;
      // та же формула, что и в delivery-price.service.js: 25 км/ч + handover
      return Math.round(prepMin + (distKm / 25) * 60 + 5);
    },
    // ⭐ НОВОЕ: оценка цены доставки — возвращаем базовую ставку.
    // Точная цена пересчитывается в cart-page через calculateDeliveryPrice,
    // когда у пользователя выбран адрес.
    deliveryPriceEstimate: async () => {
      const cfg = await Configuration.findById("singleton")
        .select("deliveryBasePrice")
        .lean();
      return cfg?.deliveryBasePrice ?? null;
    },
    categories: async (parent) => {
      const { Category } = await import("../models/Category.js");
      return Category.find({ restaurantId: parent._id });
    },
  },

  RestaurantReview: {
    id: mongoId,
    createdAt: (p) => p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
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
