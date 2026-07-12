// dastbadast-multivendor-api/src/resolvers/admin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Configuration } from "../models/Configuration.js";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Restaurant } from "../models/Restaurant.js";
import { Zone } from "../models/Zone.js";
import { User } from "../models/User.js";
import { Owner } from "../models/Owner.js";
import { signOwnerToken } from "../middleware/auth.js";
import { requireRole, requireOwner } from "../middleware/rbac.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { invalidateCache } from "../middleware/cache.js";

const VALID_OWNER_ROLES = [
  "SUPER_ADMIN",
  "DISPATCHER",
  "FINANCE",
  "OPERATIONS",
  "SUPPORT",
  "ANALYST",
];

// =================== AUTH ===================

export const ownerLogin = async (_p, { input }) => {
  const o = await Owner.findOne({ email: input.email.toLowerCase() });
  if (!o) {
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  if (!VALID_OWNER_ROLES.includes(o.userType)) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  if (!o.isActive) {
    throw new GraphQLError("Аккаунт деактивирован", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  const ok = await bcrypt.compare(input.password, o.passwordHash);
  if (!ok) {
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  o.lastLoginAt = new Date();
  await o.save();

  const token = signOwnerToken(o);
  return { token, owner: o };
};

export const meOwner = async (_p, _a, ctx) => requireOwner(ctx);

// =================== ORDERS / RIDERS (read) ===================

export const allOrders = async (_p, { status }, ctx) => {
  requireOwner(ctx);
  const filter = {};
  if (status) filter.orderStatus = status;
  return Order.find(filter).sort({ createdAt: -1 }).limit(200);
};

export const riders = async (_p, { available }, ctx) => {
  requireOwner(ctx);
  const filter = { isActive: true };
  if (typeof available === "boolean") filter.available = available;
  return Rider.find(filter).sort({ createdAt: -1 });
};

// =================== RIDER MANAGEMENT ===================

export const createRider = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER"])(ctx);
  const exists = await Rider.findOne({ username: input.username });
  if (exists) {
    throw new GraphQLError("Username уже занят", {
      extensions: { code: "CONFLICT" },
    });
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const r = await Rider.create({
    username: input.username,
    passwordHash,
    name: input.name || "",
    phone: input.phone || "",
    zoneId: input.zoneId || null,
    available: true,
  });
  return r;
};

// =================== RESTAURANT MANAGEMENT ===================

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `restaurant-${Date.now()}`
  );
}

export const createRestaurant = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);
  const existsUser = await Restaurant.findOne({ username: input.username });
  if (existsUser) {
    throw new GraphQLError("Username уже занят", {
      extensions: { code: "CONFLICT" },
    });
  }
  const slug = (input.slug || slugify(input.name)).toLowerCase();
  const slugTaken = await Restaurant.findOne({ slug });
  if (slugTaken) {
    throw new GraphQLError("Slug уже занят", {
      extensions: { code: "CONFLICT" },
    });
  }
  const zone = await Zone.findOne({ isActive: true });
  const passwordHash = await bcrypt.hash(input.password, 10);
  const r = await Restaurant.create({
    name: input.name,
    slug,
    address: input.address,
    username: input.username,
    passwordHash,
    tax: input.tax ?? 0,
    minimumOrder: input.minimumOrder ?? 0,
    zoneId: zone?._id || null,
    location: { type: "Point", coordinates: [input.lng, input.lat] },
    isAvailable: true,
  });
  await invalidateCache("restaurants");
  return r;
};

// =================== DISPATCH ===================

const ASSIGN_FROM = ["ACCEPTED", "READY_FOR_PICKUP"];
const NEXT_AFTER_ASSIGN = "ASSIGNED";

export const assignRider = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"])(ctx);
  const order = await Order.findById(input.orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!ASSIGN_FROM.includes(order.orderStatus)) {
    throw new GraphQLError(
      `Невозможно назначить курьера в статусе ${order.orderStatus}`,
      { extensions: { code: "BAD_STATE" } },
    );
  }
  const rider = await Rider.findById(input.riderId);
  if (!rider || !rider.isActive) {
    throw new GraphQLError("Курьер не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!rider.available) {
    throw new GraphQLError("Курьер недоступен", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  order.riderId = rider._id;
  order.orderStatus = NEXT_AFTER_ASSIGN;
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.assignedAt = new Date();
  rider.available = false;
  await Promise.all([order.save(), rider.save()]);

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.RIDER_ASSIGNED(rider._id.toString()), {
    subscriptionAssignedRider: order,
  });
  if (order.zoneId) {
    pubsub.publish(TOPICS.ZONE_ORDERS(order.zoneId.toString()), {
      subscriptionZoneOrders: order,
    });
  }
  return order;
};

// =================== ACCOUNTING (read) ===================

export const adminAccounting = async (_p, _a, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST"])(ctx);

  const cfgDoc = await Configuration.findById("singleton")
    .select("taxPercent")
    .lean();
  const taxPercent = Number(
    typeof cfgDoc?.taxPercent === "number" ? cfgDoc.taxPercent : 10,
  );

  const restaurantRows = await Order.aggregate([
    { $match: { orderStatus: "DELIVERED" } },
    {
      $group: {
        _id: "$restaurantId",
        orderCount: { $sum: 1 },
        // ⭐ ШАГ 2 FIX: было $amounts.total (с доставкой), стало $amounts.subtotal
        revenue: { $sum: "$amounts.subtotal" },
      },
    },
  ]);

  const restaurantIds = restaurantRows.map((r) => r._id).filter(Boolean);
  const restaurants = restaurantIds.length
    ? await Restaurant.find({ _id: { $in: restaurantIds } }).lean()
    : [];
  const restMap = new Map(restaurants.map((r) => [r._id.toString(), r]));

  const restaurantStats = restaurantRows.map((row) => {
    const revenue = +Number(row.revenue || 0).toFixed(2);
    const commission = +(revenue * (taxPercent / 100)).toFixed(2);
    return {
      restaurantId: row._id.toString(),
      restaurantName: restMap.get(row._id.toString())?.name ?? "Без названия",
      orderCount: row.orderCount,
      revenue, // ⭐ теперь это subtotal (выручка ресторана за еду)
      commission, // ⭐ комиссия платформы (НЕ видна клиенту)
      payout: +(revenue - commission).toFixed(2), // ⭐ к выплате ресторану
    };
  });

  const totalDelivered = restaurantStats.reduce((s, r) => s + r.orderCount, 0);
  const totalCommission = +restaurantStats
    .reduce((s, r) => s + r.commission, 0)
    .toFixed(2);

  const totalRevenueAgg = await Order.aggregate([
    { $match: { orderStatus: "DELIVERED" } },
    { $group: { _id: null, total: { $sum: "$amounts.total" } } },
  ]);
  const totalRevenue = +(totalRevenueAgg[0]?.total ?? 0).toFixed(2);

  const riderRows = await Order.aggregate([
    { $match: { orderStatus: "DELIVERED", riderId: { $ne: null } } },
    {
      $group: {
        _id: "$riderId",
        deliveredCount: { $sum: 1 },
        totalEarnings: { $sum: "$amounts.deliveryFee" },
      },
    },
  ]);

  const riderIds = riderRows.map((r) => r._id).filter(Boolean);
  const ridersDocs = riderIds.length
    ? await Rider.find({ _id: { $in: riderIds } }).lean()
    : [];
  const riderMap = new Map(ridersDocs.map((r) => [r._id.toString(), r]));

  const riderStats = riderRows.map((row) => {
    const r = riderMap.get(row._id.toString());
    return {
      riderId: row._id.toString(),
      riderName: r?.name || r?.username || "—",
      phone: r?.phone || null,
      deliveredCount: row.deliveredCount,
      totalEarnings: +Number(row.totalEarnings || 0).toFixed(2),
    };
  });

  return {
    totalRevenue, // Оборот (subtotal + deliveryFee по всем доставленным)
    totalDelivered,
    totalCommission, // Комиссия платформы = sum(subtotals) * taxPercent/100
    restaurants: restaurantStats.sort((a, b) => b.revenue - a.revenue),
    riders: riderStats.sort((a, b) => b.totalEarnings - a.totalEarnings),
  };
};

// =================== OWNER MANAGEMENT (только SUPER_ADMIN) ===================

export const owners = async (_p, _a, ctx) => {
  requireRole(["SUPER_ADMIN"])(ctx);
  return Owner.find({}).sort({ createdAt: -1 });
};

export const ownerOne = async (_p, { id }, ctx) => {
  requireRole(["SUPER_ADMIN"])(ctx);
  return Owner.findById(id);
};

export const createOwner = async (_p, { input }, ctx) => {
  const actor = requireRole(["SUPER_ADMIN"])(ctx);

  if (!VALID_OWNER_ROLES.includes(input.userType)) {
    throw new GraphQLError("Недопустимая роль", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const exists = await Owner.findOne({ email: input.email.toLowerCase() });
  if (exists) {
    throw new GraphQLError("Email уже зарегистрирован", {
      extensions: { code: "CONFLICT" },
    });
  }

  if (!input.password || input.password.length < 6) {
    throw new GraphQLError("Пароль должен быть не короче 6 символов", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const permissions = buildPermissionsForRole(
    input.userType,
    input.permissions,
  );

  const o = await Owner.create({
    email: input.email.toLowerCase(),
    passwordHash,
    userType: input.userType,
    permissions,
    isActive: true,
    createdBy: actor._id,
  });

  return o;
};

export const updateOwner = async (_p, { id, input }, ctx) => {
  const actor = requireRole(["SUPER_ADMIN"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const owner = await Owner.findById(id);
  if (!owner) {
    throw new GraphQLError("Админ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (input.email && input.email.toLowerCase() !== owner.email) {
    const exists = await Owner.findOne({ email: input.email.toLowerCase() });
    if (exists) {
      throw new GraphQLError("Email уже используется", {
        extensions: { code: "CONFLICT" },
      });
    }
    owner.email = input.email.toLowerCase();
  }

  if (input.userType) {
    if (!VALID_OWNER_ROLES.includes(input.userType)) {
      throw new GraphQLError("Недопустимая роль", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    owner.userType = input.userType;
    if (!input.permissions) {
      owner.permissions = buildPermissionsForRole(input.userType, null);
    }
  }

  if (input.permissions) {
    owner.permissions = {
      ...(owner.permissions?.toObject?.() || owner.permissions || {}),
      ...input.permissions,
    };
  }

  if (typeof input.isActive === "boolean") {
    if (
      input.isActive === false &&
      owner._id.toString() === actor._id.toString()
    ) {
      throw new GraphQLError("Нельзя деактивировать свой собственный аккаунт", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (
      input.isActive === false &&
      owner.userType === "SUPER_ADMIN" &&
      owner.isActive
    ) {
      const otherActiveSupers = await Owner.countDocuments({
        _id: { $ne: owner._id },
        userType: "SUPER_ADMIN",
        isActive: true,
      });
      if (otherActiveSupers === 0) {
        throw new GraphQLError(
          "Нельзя деактивировать последнего активного SUPER_ADMIN",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }
    }
    owner.isActive = input.isActive;
  }

  await owner.save();
  return owner;
};

export const deactivateOwner = async (_p, { id }, ctx) => {
  const actor = requireRole(["SUPER_ADMIN"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const owner = await Owner.findById(id);
  if (!owner) {
    throw new GraphQLError("Аккаунт не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (owner._id.toString() === actor._id.toString()) {
    throw new GraphQLError("Нельзя деактивировать свой собственный аккаунт", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (owner.userType === "SUPER_ADMIN" && owner.isActive) {
    const otherActiveSupers = await Owner.countDocuments({
      _id: { $ne: owner._id },
      userType: "SUPER_ADMIN",
      isActive: true,
    });
    if (otherActiveSupers === 0) {
      throw new GraphQLError(
        "Нельзя деактивировать последнего активного SUPER_ADMIN",
        { extensions: { code: "BAD_USER_INPUT" } },
      );
    }
  }

  owner.isActive = false;
  await owner.save();
  return true;
};

export const resetOwnerPassword = async (_p, { id, newPassword }, ctx) => {
  requireRole(["SUPER_ADMIN"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!newPassword || newPassword.length < 6) {
    throw new GraphQLError("Пароль должен быть не короче 6 символов", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const owner = await Owner.findById(id);
  if (!owner) {
    throw new GraphQLError("Аккаунт не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  owner.passwordHash = await bcrypt.hash(newPassword, 10);
  await owner.save();
  return true;
};

function buildPermissionsForRole(role, custom) {
  const defaults = {
    SUPER_ADMIN: {
      canManageRestaurants: true,
      canManageRiders: true,
      canManageZones: true,
      canManageConfiguration: true,
      canViewAccounting: true,
      canAssignRiders: true,
      canManageUsers: true,
    },
    DISPATCHER: {
      canManageRestaurants: false,
      canManageRiders: true,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: true,
      canManageUsers: false,
    },
    FINANCE: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: true,
      canViewAccounting: true,
      canAssignRiders: false,
      canManageUsers: false,
    },
    OPERATIONS: {
      canManageRestaurants: true,
      canManageRiders: true,
      canManageZones: true,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: true,
      canManageUsers: false,
    },
    SUPPORT: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: false,
      canManageUsers: true,
    },
    ANALYST: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: true,
      canAssignRiders: false,
      canManageUsers: false,
    },
  };

  const base = defaults[role] || defaults.SUPER_ADMIN;
  return { ...base, ...(custom || {}) };
}

// =================== ZONES (OPERATIONS) ====================

export const zones = async (_p, _a, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER", "SUPPORT"])(ctx);
  return Zone.find({}).sort({ createdAt: -1 });
};

export const zoneOne = async (_p, { id }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER", "SUPPORT"])(ctx);
  return Zone.findById(id);
};

export const createZone = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);

  if (!input.name || !input.name.trim()) {
    throw new GraphQLError("Название зоны обязательно", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!Array.isArray(input.polygon) || input.polygon.length < 3) {
    throw new GraphQLError("Полигон должен содержать минимум 3 точки", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const zone = await Zone.create({
    name: input.name.trim(),
    description: input.description?.trim() || "",
    location: {
      type: "Polygon",
      coordinates: [input.polygon],
    },
    isActive: input.isActive !== false,
  });

  await invalidateCache("restaurants"); // зоны входят в homepage
  return zone;
};

export const updateZone = async (_p, { id, input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const zone = await Zone.findById(id);
  if (!zone) {
    throw new GraphQLError("Зона не найдена", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (input.name !== undefined) zone.name = input.name.trim();
  if (input.description !== undefined)
    zone.description = input.description.trim();
  if (typeof input.isActive === "boolean") zone.isActive = input.isActive;
  if (Array.isArray(input.polygon) && input.polygon.length >= 3) {
    zone.location = {
      type: "Polygon",
      coordinates: [input.polygon],
    };
  }

  await zone.save();
  return zone;
};

export const deleteZone = async (_p, { id }, ctx) => {
  requireRole(["SUPER_ADMIN"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const zone = await Zone.findById(id);
  if (!zone) {
    throw new GraphQLError("Зона не найдена", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const restaurantCount = await Restaurant.countDocuments({ zoneId: id });
  if (restaurantCount > 0 && zone.isActive) {
    throw new GraphQLError(
      `Невозможно удалить зону: к ней привязано ${restaurantCount} ресторан(ов). Сначала деактивируйте или перепривяжите.`,
      { extensions: { code: "BAD_STATE" } },
    );
  }

  await Zone.findByIdAndDelete(id);
  return true;
};

// =================== DASHBOARD METRICS (ANALYST) ====================

export const adminDashboardMetrics = async (_p, _a, ctx) => {
  requireRole([
    "SUPER_ADMIN",
    "FINANCE",
    "ANALYST",
    "DISPATCHER",
    "OPERATIONS",
  ])(ctx);

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOf7DaysAgo = new Date(startOfToday);
  startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 6);
  const startOf30DaysAgo = new Date(startOfToday);
  startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 29);

  const [todayAgg] = await Order.aggregate([
    { $match: { createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0] },
        },
        revenue: {
          $sum: {
            $cond: [
              { $eq: ["$orderStatus", "DELIVERED"] },
              "$amounts.total",
              0,
            ],
          },
        },
      },
    },
  ]);

  const newUsersToday = await User.countDocuments({
    createdAt: { $gte: startOfToday },
  });

  const activeRiders = await Rider.countDocuments({
    isActive: true,
    available: true,
  });

  const activeOrders = await Order.countDocuments({
    orderStatus: { $nin: ["DELIVERED", "CANCELLED"] },
  });

  const restaurantsOnline = await Restaurant.countDocuments({
    isAvailable: true,
  });

  const last7Days = await Order.aggregate([
    { $match: { createdAt: { $gte: startOf7DaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [
              { $eq: ["$orderStatus", "DELIVERED"] },
              "$amounts.total",
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const chart7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOf7DaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const found = last7Days.find((x) => x._id === key);
    chart7Days.push({
      date: key,
      count: found?.count || 0,
      revenue: found?.revenue ? +Number(found.revenue).toFixed(2) : 0,
    });
  }

  const topRestaurants = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOf30DaysAgo },
        orderStatus: "DELIVERED",
      },
    },
    {
      $group: {
        _id: "$restaurantId",
        orderCount: { $sum: 1 },
        revenue: { $sum: "$amounts.total" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);
  const topRestIds = topRestaurants.map((r) => r._id);
  const topRestDocs = topRestIds.length
    ? await Restaurant.find({ _id: { $in: topRestIds } }).lean()
    : [];
  const topRestMap = new Map(topRestDocs.map((r) => [r._id.toString(), r]));
  const topRestaurantsFull = topRestaurants.map((r) => ({
    restaurantId: r._id.toString(),
    name: topRestMap.get(r._id.toString())?.name || "—",
    orderCount: r.orderCount,
    revenue: +Number(r.revenue).toFixed(2),
  }));

  const topRiders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOf30DaysAgo },
        orderStatus: "DELIVERED",
        riderId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$riderId",
        deliveredCount: { $sum: 1 },
        earnings: { $sum: "$amounts.deliveryFee" },
      },
    },
    { $sort: { earnings: -1 } },
    { $limit: 5 },
  ]);
  const topRiderIds = topRiders.map((r) => r._id);
  const topRiderDocs = topRiderIds.length
    ? await Rider.find({ _id: { $in: topRiderIds } }).lean()
    : [];
  const topRiderMap = new Map(topRiderDocs.map((r) => [r._id.toString(), r]));
  const topRidersFull = topRiders.map((r) => ({
    riderId: r._id.toString(),
    name:
      topRiderMap.get(r._id.toString())?.name ||
      topRiderMap.get(r._id.toString())?.username ||
      "—",
    deliveredCount: r.deliveredCount,
    earnings: +Number(r.earnings).toFixed(2),
  }));

  return {
    today: {
      orders: todayAgg?.total || 0,
      delivered: todayAgg?.delivered || 0,
      cancelled: todayAgg?.cancelled || 0,
      revenue: todayAgg?.revenue ? +Number(todayAgg.revenue).toFixed(2) : 0,
    },
    live: {
      activeOrders,
      activeRiders,
      restaurantsOnline,
    },
    newUsersToday,
    chart7Days,
    topRestaurants: topRestaurantsFull,
    topRiders: topRidersFull,
  };
};

// ⭐ Обновление ресторана
export const updateRestaurant = async (_p, { id, input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const r = await Restaurant.findById(id);
  if (!r) {
    throw new GraphQLError("Ресторан не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (input.name !== undefined) r.name = input.name.trim();
  if (input.address !== undefined) r.address = input.address;
  if (input.tax !== undefined) r.tax = input.tax;
  if (input.minimumOrder !== undefined) r.minimumOrder = input.minimumOrder;
  if (typeof input.isAvailable === "boolean") r.isAvailable = input.isAvailable;

  if (input.lat !== undefined && input.lng !== undefined) {
    r.location = { type: "Point", coordinates: [input.lng, input.lat] };
  }

  await r.save();
  await invalidateCache("restaurants");
  return r;
};

// ⭐ Обновление курьера
export const updateRider = async (_p, { id, input }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const r = await Rider.findById(id);
  if (!r) {
    throw new GraphQLError("Курьер не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (typeof input.name === "string") r.name = input.name.trim();
  if (typeof input.phone === "string") r.phone = input.phone.trim();
  if (typeof input.photo === "string") r.photo = input.photo;

  if (input.email !== undefined) {
    const trimmed = String(input.email).trim().toLowerCase();
    if (trimmed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new GraphQLError("Некорректный email", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const exists = await Rider.findOne({
        email: trimmed,
        _id: { $ne: r._id },
      });
      if (exists) {
        throw new GraphQLError("Этот email уже используется", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      r.email = trimmed;
    } else {
      r.email = "";
    }
  }

  if (typeof input.isActive === "boolean") r.isActive = input.isActive;
  if (input.zoneId !== undefined) r.zoneId = input.zoneId || null;

  await r.save();
  return r;
};

// ⭐ Блокировка/разблокировка курьера
export const toggleRiderActive = async (_p, { id, isActive }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const r = await Rider.findById(id);
  if (!r) {
    throw new GraphQLError("Курьер не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  r.isActive = !!isActive;
  await r.save();
  return r;
};

// ⭐ Финансы курьера (агрегация)
export const riderFinancials = async (_p, { riderId }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "OPERATIONS"])(ctx);

  if (!mongoose.isValidObjectId(riderId)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const r = await Rider.findById(riderId).select(
    "name balance totalDeliveries",
  );
  if (!r) {
    throw new GraphQLError("Курьер не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const stats = await Order.aggregate([
    {
      $match: {
        riderId: r._id,
        orderStatus: "DELIVERED",
      },
    },
    {
      $group: {
        _id: null,
        totalEarned: { $sum: "$amounts.deliveryFee" },
        totalDeliveries: { $sum: 1 },
      },
    },
  ]);

  const totalEarned = stats[0]?.totalEarned || 0;
  const totalDeliveries = stats[0]?.totalDeliveries || 0;
  const averageDeliveryFee =
    totalDeliveries > 0 ? totalEarned / totalDeliveries : 0;

  return {
    riderId: r._id.toString(),
    riderName: r.name || "—",
    balance: r.balance || 0,
    totalEarned: +Number(totalEarned).toFixed(2),
    totalDeliveries,
    averageDeliveryFee: +Number(averageDeliveryFee).toFixed(2),
  };
};

// ⭐ НОВОЕ: все курьеры с последней локацией (для карты диспетчера)
// Требует роли SUPER_ADMIN / OPERATIONS / DISPATCHER.
export const allRidersWithLocation = async (_p, _a, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER"])(ctx);
  // includeInactive: false — берём только активных и онлайн
  return Rider.find({ isActive: true })
    .select(
      "username name phone email photo available lastLocationAt location zoneId",
    )
    .sort({ available: -1, lastLocationAt: -1 })
    .lean();
};

// ⭐ НОВОЕ: активные заказы с координатами (для карты)
export const ordersForMap = async (_p, { status }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER"])(ctx);
  const filter = {
    orderStatus: {
      $in: [
        "PENDING",
        "ACCEPTED",
        "ASSIGNED",
        "PICKED",
        "AWAITING_CONFIRMATION",
      ],
    },
  };
  if (status) filter.orderStatus = status;
  return Order.find(filter)
    .select(
      "orderId orderStatus items amounts pickupAddress deliveryAddress riderId createdAt statusTimestamps",
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
};

// ⭐ НОВОЕ: текущая локация одного курьера (snapshot)
export const riderLocationOnMap = async (_p, { riderId }, ctx) => {
  requireRole(["SUPER_ADMIN", "OPERATIONS", "DISPATCHER"])(ctx);
  if (!mongoose.isValidObjectId(riderId)) return null;
  const r = await Rider.findById(riderId)
    .select("location lastLocationAt")
    .lean();
  if (!r?.location?.coordinates) return null;
  const [lng, lat] = r.location.coordinates;
  if (lat === 0 && lng === 0) return null;
  return {
    lat,
    lng,
    updatedAt: r.lastLocationAt?.toISOString?.() ?? new Date().toISOString(),
  };
};
