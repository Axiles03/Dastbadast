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
  const token = signToken(user);
  return { token, user };
};

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
  const zone = await Zone.findOne({ isActive: true });
  if (!zone) {
    throw new GraphQLError(
      "Зона доставки не настроена. Запустите npm run seed на API.",
      {
        extensions: { code: "ZONE_NOT_CONFIGURED" },
      },
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

// ==================== ADMIN: USERS LIST ====================

export const adminUsers = async (_p, { filter }, ctx) => {
  requireRole(["SUPER_ADMIN", "SUPPORT"])(ctx);

  const q = filter?.search?.trim() || "";
  const limit = Math.min(filter?.limit || 50, 200);
  const offset = filter?.offset || 0;

  const mongoFilter = {};
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    mongoFilter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  const total = await User.countDocuments(mongoFilter);
  const users = await User.find(mongoFilter)
    .select("name email phone isActive createdAt addresses")
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  const userIds = users.map((u) => u._id);
  const orderStats = await Order.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: "$userId",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$amounts.total" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  const statsMap = new Map(orderStats.map((s) => [s._id.toString(), s]));

  return {
    total,
    users: users.map((u) => {
      const stats = statsMap.get(u._id.toString()) || {};
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        createdAt: u.createdAt,
        addressesCount: (u.addresses || []).length,
        totalOrders: stats.totalOrders || 0,
        totalSpent: stats.totalSpent ? +Number(stats.totalSpent).toFixed(2) : 0,
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

  // 1) Валидация телефона, если передан
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

  // 2) Применяем изменения
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
      // Проверяем уникальность email, если он сменился
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
