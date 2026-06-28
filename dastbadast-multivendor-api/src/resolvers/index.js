import { configuration } from "./configuration.js";
import { deliveryZone } from "./zone-public.js";
import { chatMessages, sendChatMessage } from "./chat.js";
import { restaurants, restaurant } from "./restaurant.js";
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
  rider as riderOne,
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
} from "./subscriptions.js";
import { JSONScalar } from "../utils/scalars.js";

const mongoId = (parent) => parent?.id ?? parent?._id?.toString();

export const resolvers = {
  JSON: JSONScalar,
  Query: {
    configuration,
    deliveryZone,
    restaurants,
    restaurant,
    foodReviews,
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
    sendChatMessage,
    createOwner,
    updateOwner,
    deactivateOwner,
    resetOwnerPassword,
    toggleUserActive,
    createZone,
    updateZone,
    deleteZone,
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
  },
  Restaurant: {
    id: mongoId,
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
  },

  User: { id: mongoId },
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
};
