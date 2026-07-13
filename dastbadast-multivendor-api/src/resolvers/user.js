// dastbadast-multivendor-api/src/resolvers/user.js
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Zone } from "../models/Zone.js";
import { Order } from "../models/Order.js";
import { signToken } from "../middleware/auth.js";
import { pointInPolygon } from "../utils/zone.js";
import { requireRole } from "../middleware/rbac.js";

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.user;
}

const TJ_PHONE_REGEX = /^\+992\d{9}$/;

async function findZoneForPoint(lng, lat) {
  const zone = await Zone.findOne({ isActive: true });
  if (!zone) return null;
  const poly = zone.location?.coordinates?.[0];
  if (!poly) return null;
  const inside = pointInPolygon([lng, lat], poly);
  return inside ? zone : null;
}

/* ============================================================
 *  profile / addresses / selectedAddress
 * ============================================================ */

export const profile = async (_p, _a, ctx) => {
  const u = requireUser(ctx);
  return User.findById(u._id);
};

export const addresses = async (_p, _a, ctx) => {
  const u = requireUser(ctx);
  return User.findById(u._id).then((doc) => doc?.addresses || []);
};

export const selectedAddress = async (_p, _a, ctx) => {
  const u = requireUser(ctx);
  const doc = await User.findById(u._id);
  return doc?.addresses?.find((a) => a.isSelected) || null;
};

/* ============================================================
 *  createUser / login  ⭐ FIX: блокируем заблокированных
 * ============================================================ */

export const createUser = async (_p, { input }) => {
  if (!input.email && !input.phone) {
    throw new GraphQLError("Нужен email или телефон", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const or = [];
  if (input.email) or.push({ email: input.email.toLowerCase() });
  if (input.phone) or.push({ phone: input.phone });
  const exists = await User.findOne({ $or: or });
  if (exists)
    throw new GraphQLError("Пользователь уже существует", {
      extensions: { code: "CONFLICT" },
    });

  const user = await User.create({
    name: input.name,
    email: input.email?.toLowerCase(),
    phone: input.phone,
    passwordHash,
  });
  const token = signToken(user);
  return { token, user };
};

export const login = async (_p, { input }) => {
  if (!input.email && !input.phone) {
    throw new GraphQLError("Нужен email или телефон", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const query = input.email
    ? { email: input.email.toLowerCase() }
    : { phone: input.phone };
  const user = await User.findOne(query);
  if (!user)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  // ⭐ FIX: блокируем вход заблокированным пользователям
  if (user.isActive === false) {
    throw new GraphQLError("Аккаунт заблокирован. Обратитесь в поддержку.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  const token = signToken(user);
  return { token, user };
};

/* ============================================================
 *  validatePoint / createAddress / editAddress / deleteAddress
 *  / selectAddress — без изменений
 * ============================================================ */

async function validatePoint(location) {
  const coords = location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) {
    throw new GraphQLError("Некорректные координаты", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const [lng, lat] = coords.map(Number);
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    throw new GraphQLError("Некорректные координаты", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new GraphQLError("Координаты вне диапазона", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (lng === 0 && lat === 0) {
    throw new GraphQLError(
      "Координаты не установлены (0,0). Выберите точку на карте.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  const zone = await Zone.findOne({ isActive: true });
  if (!zone) {
    throw new GraphQLError(
      "Зона доставки не настроена. Запустите npm run seed на API.",
      { extensions: { code: "ZONE_NOT_CONFIGURED" } },
    );
  }
  const poly = zone.location?.coordinates?.[0];
  if (!poly || !pointInPolygon([lng, lat], poly)) {
    throw new GraphQLError(
      "Адрес вне зоны доставки. Выберите точку внутри оранжевой области на карте (центр Душанбе).",
      { extensions: { code: "OUT_OF_ZONE" } },
    );
  }
  return { lng, lat };
}

export const createAddress = async (_p, { input }, ctx) => {
  const u = requireUser(ctx);
  const { lng, lat } = await validatePoint(input.location);
  const user = await User.findById(u._id);
  if ((user.addresses?.length || 0) >= 3) {
    throw new GraphQLError("Можно сохранить не более 3 адресов", {
      extensions: { code: "ADDRESS_LIMIT" },
    });
  }
  const makeSelected = !user.addresses || user.addresses.length === 0;
  if (makeSelected) {
    user.addresses.forEach((a) => (a.isSelected = false));
  }
  user.addresses.push({
    label: input.label || "Дом",
    address: input.address,
    city: input.city || "Душанбе",
    details: input.details || "",
    location: { type: "Point", coordinates: [lng, lat] },
    isSelected: makeSelected,
  });
  await user.save();
  return user.addresses[user.addresses.length - 1];
};

export const editAddress = async (_p, { id, input }, ctx) => {
  const u = requireUser(ctx);
  const { lng, lat } = await validatePoint(input.location);
  const user = await User.findById(u._id);
  const addr = user.addresses.id(id);
  if (!addr) throw new GraphQLError("Адрес не найден");
  addr.label = input.label || addr.label;
  addr.address = input.address;
  addr.city = input.city || addr.city;
  addr.details = input.details ?? addr.details;
  addr.location = { type: "Point", coordinates: [lng, lat] };
  await user.save();
  return addr;
};

export const deleteAddress = async (_p, { id }, ctx) => {
  const u = requireUser(ctx);
  const user = await User.findById(u._id);
  const addr = user.addresses.id(id);
  if (!addr) return false;
  const wasSelected = addr.isSelected;
  addr.deleteOne();
  if (wasSelected && user.addresses.length > 0) {
    user.addresses[0].isSelected = true;
  }
  await user.save();
  return true;
};

export const selectAddress = async (_p, { id }, ctx) => {
  const u = requireUser(ctx);
  const user = await User.findById(u._id);
  let found = null;
  user.addresses.forEach((a) => {
    a.isSelected = a._id.toString() === id;
    if (a.isSelected) found = a;
  });
  await user.save();
  return found;
};

/* ============================================================
 *  adminUsers — ИСПРАВЛЕННАЯ ВЕРСИЯ (count, не totalOrders)
 * ============================================================ */

export const adminUsers = async (_p, { filter }, ctx) => {
  requireRole(["SUPER_ADMIN", "SUPPORT"])(ctx);

  const q = (filter?.search || "").trim();
  const limit = Math.min(filter?.limit || 50, 200);
  const offset = filter?.offset || 0;

  const userFilter = {};
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    userFilter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  const total = await User.countDocuments(userFilter);

  const users = await User.find(userFilter)
    .select("name email phone isActive createdAt addresses")
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const userIds = users.map((u) => u._id);

  const orderStats = await Order.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: "$userId",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$amounts.total" },
        firstOrderAt: { $min: "$createdAt" },
        lastOrderAt: { $max: "$createdAt" },
        cancelled: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const statsMap = new Map(orderStats.map((s) => [String(s._id), s]));

  return {
    total,
    users: users.map((u) => {
      const stats = statsMap.get(String(u._id)) || {};
      const totalOrders = Number(stats.totalOrders) || 0;
      const totalSpent = Number(stats.totalSpent) || 0;
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        createdAt: u.createdAt,
        addressesCount: (u.addresses || []).length,
        totalOrders,
        totalSpent: +totalSpent.toFixed(2),
        lastOrderAt: stats.lastOrderAt || null,
      };
    }),
  };
};

export const adminUserDetail = async (_p, { id }, ctx) => {
  requireRole(["SUPER_ADMIN", "SUPPORT"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const user = await User.findById(id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const orders = await Order.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("restaurantId", "name")
    .lean();

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
    addresses: (user.addresses || []).map((a) => ({
      id: a._id.toString(),
      label: a.label,
      address: a.address,
      city: a.city,
      details: a.details,
      isSelected: a.isSelected,
    })),
    orders: orders.map((o) => ({
      id: o._id.toString(),
      orderId: o.orderId,
      orderStatus: o.orderStatus,
      total: o.amounts?.total || 0,
      restaurantName: o.restaurantId?.name || "—",
      createdAt: o.createdAt,
    })),
  };
};

export const toggleUserActive = async (_p, { id, isActive }, ctx) => {
  requireRole(["SUPER_ADMIN", "SUPPORT"])(ctx);

  if (!mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const user = await User.findById(id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  user.isActive = !!isActive;
  await user.save();

  return {
    id: user._id.toString(),
    isActive: user.isActive,
  };
};

export const updateUser = async (_p, { input }, ctx) => {
  const current = requireUser(ctx);

  if (input.phone !== undefined && input.phone !== null && input.phone !== "") {
    const cleaned = String(input.phone).replace(/[\s\-()]/g, "");
    if (!TJ_PHONE_REGEX.test(cleaned)) {
      throw new GraphQLError(
        "Телефон должен быть в формате +992 и ровно 9 цифр (например +992901234567)",
        { extensions: { code: "BAD_USER_INPUT" } },
      );
    }
    input.phone = cleaned;
  }

  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name.length < 2) {
      throw new GraphQLError("Имя должно содержать минимум 2 символа", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    user.name = name;
  }

  if (input.email !== undefined) {
    const email = String(input.email).trim().toLowerCase();
    if (email) {
      if (email !== (user.email || "").toLowerCase()) {
        const exists = await User.findOne({ email });
        if (exists && exists._id.toString() !== user._id.toString()) {
          throw new GraphQLError("Этот email уже используется", {
            extensions: { code: "CONFLICT" },
          });
        }
        user.email = email;
      }
    } else {
      user.email = undefined;
    }
  }

  if (input.phone !== undefined) {
    user.phone = input.phone || undefined;
  }

  await user.save();
  return user;
};

export const userLTV = async (_p, { userId }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST", "SUPPORT"])(ctx);

  if (!mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const stats = await Order.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $facet: {
        delivered: [
          { $match: { orderStatus: "DELIVERED" } },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$amounts.total" },
              count: { $sum: 1 },
              firstDelivered: { $min: "$statusTimestamps.deliveredAt" },
              lastDelivered: { $max: "$statusTimestamps.deliveredAt" },
            },
          },
        ],
        all: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              firstAt: { $min: "$createdAt" },
              lastAt: { $max: "$createdAt" },
              cancelledCount: {
                $sum: {
                  $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0],
                },
              },
            },
          },
        ],
      },
    },
  ]);

  const deliveredStats = (stats &&
    stats[0] &&
    stats[0].delivered &&
    stats[0].delivered[0]) || {
    totalSpent: 0,
    count: 0,
    firstDelivered: null,
    lastDelivered: null,
  };
  const allStats = (stats && stats[0] && stats[0].all && stats[0].all[0]) || {
    count: 0,
    firstAt: null,
    lastAt: null,
    cancelledCount: 0,
  };

  const orderCount = deliveredStats.count;
  const totalSpent = +(deliveredStats.totalSpent || 0).toFixed(2);
  const avgOrderValue =
    orderCount > 0 ? +(totalSpent / orderCount).toFixed(2) : 0;
  const cancelledCount = allStats.cancelledCount;

  const firstAt = allStats.firstAt ? new Date(allStats.firstAt) : null;
  const lastAt = allStats.lastAt ? new Date(allStats.lastAt) : null;
  const activeDays =
    firstAt && lastAt
      ? Math.max(
          1,
          Math.ceil(
            (lastAt.getTime() - firstAt.getTime()) / (24 * 60 * 60 * 1000),
          ) + 1,
        )
      : 0;

  const isPredictionReliable = activeDays >= 14 && orderCount >= 3;
  const dailyOrderRate = isPredictionReliable ? orderCount / activeDays : null;
  const predictedAnnualLTV = dailyOrderRate
    ? +(dailyOrderRate * 365 * avgOrderValue).toFixed(2)
    : null;

  return {
    userId,
    orderCount,
    totalSpent,
    avgOrderValue,
    cancelledCount,
    firstOrderAt: firstAt ? firstAt.toISOString() : null,
    lastOrderAt: lastAt ? lastAt.toISOString() : null,
    activeDays,
    predictedAnnualLTV,
    isPredictionReliable,
  };
};

export const userOrderFrequency = async (_p, { userId }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST", "SUPPORT"])(ctx);

  if (!mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Некорректный id", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const orders = await Order.find({ userId })
    .select("orderStatus createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (orders.length === 0) {
    return {
      userId,
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      avgIntervalDays: 0,
      medianIntervalDays: 0,
      ordersPerWeek: 0,
      ordersPerMonth: 0,
      longestGapDays: 0,
      status: "new",
      daysSinceLastOrder: null,
      cohortMonth: null,
    };
  }

  const intervalsDays = [];
  let longestGapDays = 0;
  for (let i = 1; i < orders.length; i++) {
    const days =
      (new Date(orders[i].createdAt).getTime() -
        new Date(orders[i - 1].createdAt).getTime()) /
      (24 * 60 * 60 * 1000);
    intervalsDays.push(days);
    if (days > longestGapDays) longestGapDays = days;
  }

  const avgIntervalDays =
    intervalsDays.length > 0
      ? +(
          intervalsDays.reduce((s, v) => s + v, 0) / intervalsDays.length
        ).toFixed(2)
      : 0;

  const sortedIntervals = [...intervalsDays].sort((a, b) => a - b);
  const medianIntervalDays =
    sortedIntervals.length > 0
      ? +(
          sortedIntervals.length % 2 === 0
            ? (sortedIntervals[sortedIntervals.length / 2 - 1] +
                sortedIntervals[sortedIntervals.length / 2]) /
              2
            : sortedIntervals[(sortedIntervals.length - 1) / 2]
        ).toFixed(2)
      : 0;

  const firstAt = new Date(orders[0].createdAt);
  const lastAt = new Date(orders[orders.length - 1].createdAt);
  const now = new Date();
  const activeDays = Math.max(
    1,
    Math.ceil((lastAt.getTime() - firstAt.getTime()) / (24 * 60 * 60 * 1000)) +
      1,
  );

  const ordersPerWeek = +(orders.length / (activeDays / 7)).toFixed(2);
  const ordersPerMonth = +(orders.length / (activeDays / 30)).toFixed(2);

  const daysSinceLastOrder = Math.floor(
    (now.getTime() - lastAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  let status = "active";
  if (daysSinceLastOrder > 60) {
    status = "churned";
  }
  if (orders.length === 1 && daysSinceLastOrder <= 30) {
    status = "new";
  }

  const cohortMonth = `${firstAt.getFullYear()}-${String(firstAt.getMonth() + 1).padStart(2, "0")}`;

  return {
    userId,
    totalOrders: orders.length,
    deliveredOrders: orders.filter((o) => o.orderStatus === "DELIVERED").length,
    cancelledOrders: orders.filter((o) => o.orderStatus === "CANCELLED").length,
    avgIntervalDays,
    medianIntervalDays,
    ordersPerWeek,
    ordersPerMonth,
    longestGapDays: +longestGapDays.toFixed(1),
    status,
    daysSinceLastOrder,
    cohortMonth,
  };
};

export const userCohorts = async (_p, { months: monthsArg }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST"])(ctx);

  const months = Math.max(1, Math.min(24, monthsArg || 6));

  const firstOrders = await Order.aggregate([
    { $sort: { userId: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$userId",
        cohortDate: { $min: "$createdAt" },
      },
    },
    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        cohortDate: 1,
      },
    },
  ]);

  if (firstOrders.length === 0) {
    return { cohorts: [], months };
  }

  const allOrdersByUser = await Order.aggregate([
    {
      $project: {
        userId: { $toString: "$userId" },
        yearMonth: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", yearMonth: "$yearMonth" },
      },
    },
  ]);

  const cohortMap = new Map();
  const userCohortMap = new Map();
  for (const f of firstOrders) {
    const d = new Date(f.cohortDate);
    const cm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!cohortMap.has(cm)) cohortMap.set(cm, new Set());
    cohortMap.get(cm).add(f.userId);
    userCohortMap.set(f.userId, d);
  }

  const userActivity = new Map();
  for (const row of allOrdersByUser) {
    const uid = row._id.userId;
    const ym = row._id.yearMonth;
    if (!userActivity.has(uid)) userActivity.set(uid, new Set());
    userActivity.get(uid).add(ym);
  }

  const sortedCohorts = Array.from(cohortMap.keys()).sort();
  const recentCohorts = sortedCohorts.slice(-months);

  const cohorts = recentCohorts.map((cm) => {
    const users = cohortMap.get(cm);
    const totalUsers = users.size;

    const [y, m] = cm.split("-").map(Number);
    const cohortStart = new Date(y, m - 1, 1);

    const now = new Date();
    const maxOffset = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));

    const retentionByMonth = [];
    for (let offset = 0; offset <= maxOffset; offset++) {
      const targetDate = new Date(cohortStart);
      targetDate.setMonth(targetDate.getMonth() + offset);
      const targetYM = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
      const activeInMonth = [...users].filter(
        (uid) => userActivity.get(uid) && userActivity.get(uid).has(targetYM),
      ).length;
      const retentionPct =
        offset === 0 ? 100 : +((activeInMonth / totalUsers) * 100).toFixed(1);
      retentionByMonth.push(retentionPct);
    }
    return {
      month: cm,
      totalUsers,
      retentionByMonth,
    };
  });

  return { cohorts, months };
};

export const churnRate = async (_p, { period: periodArg }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST"])(ctx);

  const period = Math.max(7, Math.min(180, periodArg || 30));

  const now = new Date();
  const observeEnd = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
  const measureStart = observeEnd;
  const measureEnd = now;

  const observeAgg = await Order.aggregate([
    {
      $match: {
        orderStatus: "DELIVERED",
        createdAt: { $gte: observeEnd, $lt: measureStart },
      },
    },
    {
      $group: {
        _id: "$userId",
        ordersInPeriod: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        userId: { $toString: "$_id" },
        ordersInPeriod: 1,
      },
    },
  ]);

  const activeAtStart = observeAgg.length;
  if (activeAtStart === 0) {
    return {
      period,
      activeAtStart: 0,
      churned: 0,
      retained: 0,
      churnRatePct: 0,
      retentionRatePct: 0,
      avgOrdersPerRetained: 0,
    };
  }

  const retainedUserIds = new Set();
  const orderCountsInMeasure = new Map();

  const measureAgg = await Order.aggregate([
    {
      $match: {
        orderStatus: "DELIVERED",
        createdAt: { $gte: measureStart, $lte: measureEnd },
      },
    },
    {
      $group: {
        _id: "$userId",
        ordersInMeasure: { $sum: 1 },
      },
    },
  ]);

  for (const row of measureAgg) {
    const uid = String(row._id);
    retainedUserIds.add(uid);
    orderCountsInMeasure.set(uid, row.ordersInMeasure);
  }

  const activeIds = new Set(observeAgg.map((r) => r.userId));
  let retained = 0;
  let totalOrdersForRetained = 0;
  for (const uid of activeIds) {
    if (retainedUserIds.has(uid)) {
      retained++;
      totalOrdersForRetained += orderCountsInMeasure.get(uid) || 0;
    }
  }
  const churned = activeAtStart - retained;
  const churnRatePct = +((churned / activeAtStart) * 100).toFixed(1);
  const retentionRatePct = +((retained / activeAtStart) * 100).toFixed(1);
  const avgOrdersPerRetained =
    retained > 0 ? +(totalOrdersForRetained / retained).toFixed(2) : 0;

  return {
    period,
    activeAtStart,
    churned,
    retained,
    churnRatePct,
    retentionRatePct,
    avgOrdersPerRetained,
  };
};

export const demandForecast = async (_p, { days: daysArg }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE", "ANALYST"])(ctx);

  const days = Math.max(1, Math.min(30, daysArg || 7));
  const historyDays = 60;

  const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const dailyStats = await Order.aggregate([
    {
      $match: {
        orderStatus: "DELIVERED",
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$amounts.total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const historyMap = new Map();
  for (let i = 0; i < historyDays; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!historyMap.has(k))
      historyMap.set(k, { date: k, revenue: 0, orders: 0 });
  }
  for (const row of dailyStats) {
    const existing = historyMap.get(row._id);
    if (existing) {
      existing.revenue = +row.revenue.toFixed(2);
      existing.orders = row.orders;
    } else {
      historyMap.set(row._id, {
        date: row._id,
        revenue: +row.revenue.toFixed(2),
        orders: row.orders,
      });
    }
  }
  const history = Array.from(historyMap.values());

  const n = history.length;
  let slope = 0;
  let intercept = 0;
  let avgRevenue = 0;
  let avgOrders = 0;

  if (n >= 3) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i].revenue;
      sumXY += i * history[i].revenue;
      sumXX += i * i;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    const denom = sumXX - n * meanX * meanX;
    if (denom !== 0) {
      slope = (sumXY - n * meanX * meanY) / denom;
      intercept = meanY - slope * meanX;
    } else {
      slope = 0;
      intercept = meanY;
    }
    if (slope + intercept < 0) {
      slope = 0;
      intercept = meanY;
    }
  }

  for (const d of history) {
    avgRevenue += d.revenue;
    avgOrders += d.orders;
  }
  avgRevenue = +(avgRevenue / n).toFixed(2);
  avgOrders = +(avgOrders / n).toFixed(2);

  const thirdSize = Math.max(1, Math.floor(n / 3));
  const firstThird = history.slice(0, thirdSize);
  const lastThird = history.slice(-thirdSize);
  const firstAvg =
    firstThird.reduce((s, d) => s + d.revenue, 0) / firstThird.length || 0;
  const lastAvg =
    lastThird.reduce((s, d) => s + d.revenue, 0) / lastThird.length || 0;
  const trendPct =
    firstAvg > 0 ? +(((lastAvg - firstAvg) / firstAvg) * 100).toFixed(1) : 0;

  const forecast = [];
  let totalForecastRevenue = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    d.setHours(0, 0, 0, 0);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const x = n + i;
    const predictedRevenue =
      n >= 3 ? +Math.max(0, slope * x + intercept).toFixed(2) : avgRevenue;
    const avgOrderValue = avgRevenue / Math.max(1, avgOrders);
    const predictedOrders =
      avgOrderValue > 0 && predictedRevenue > 0
        ? Math.round(predictedRevenue / avgOrderValue)
        : Math.round(avgOrders);
    totalForecastRevenue += predictedRevenue;
    forecast.push({
      date: k,
      predictedRevenue,
      predictedOrders,
      isForecast: true,
    });
  }

  return {
    history,
    forecast,
    totals: {
      avgDailyRevenue: avgRevenue,
      avgDailyOrders: avgOrders,
      totalForecastRevenue: +totalForecastRevenue.toFixed(2),
      trendPct,
    },
  };
};
