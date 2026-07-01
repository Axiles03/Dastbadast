import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Restaurant } from "../models/Restaurant.js";
import { Configuration } from "../models/Configuration.js";
import { shortOrderId } from "../utils/ids.js";
import { pointInPolygon } from "../utils/zone.js";
import { Zone } from "../models/Zone.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { signToken, signRestaurantToken } from "../middleware/auth.js";
import { Rider } from "../models/Rider.js";
import { Order } from "../models/Order.js";
import { expireIfPending } from "../lib/order-timeouts.js";
import { startCourierSearchEscalation1 } from "./order-search.js";

async function assertAddressInZone(addr) {
  const coords = addr?.location?.coordinates;
  if (!coords || coords.length < 2) {
    throw new GraphQLError("У адреса нет координат", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const [lng, lat] = coords;
  const zone = await Zone.findOne({ isActive: true });
  if (!zone) {
    throw new GraphQLError("Зона доставки не настроена", {
      extensions: { code: "ZONE_NOT_CONFIGURED" },
    });
  }
  const poly = zone.location?.coordinates?.[0];
  if (!poly || !pointInPolygon([lng, lat], poly)) {
    throw new GraphQLError(
      "Адрес вне зоны доставки. Выберите точку внутри зоны на карте (центр Душанбе).",
      { extensions: { code: "OUT_OF_ZONE" } },
    );
  }
}

function requireUser(ctx) {
  if (!ctx.user)
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  return ctx.user;
}
function requireRestaurant(ctx) {
  if (!ctx.restaurant)
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  return ctx.restaurant;
}

async function autoConfirmIfExpired(order) {
  if (order.orderStatus !== "AWAITING_CONFIRMATION") return;
  const deliveredAt = order.statusTimestamps?.deliveredAt;
  if (!deliveredAt) return;
  if (Date.now() - new Date(deliveredAt).getTime() <= 30 * 60 * 1000) return;

  order.orderStatus = "DELIVERED";
  order.statusTimestamps = order.statusTimestamps || {};
  order.statusTimestamps.deliveredAt = deliveredAt;
  order.paid = order.paymentMethod === "COD" ? true : order.paid;
  if (!order.paidAt) order.paidAt = new Date();
  await order.save();

  if (order.riderId) {
    await Rider.findByIdAndUpdate(order.riderId, { available: true });
    pubsub.publish(TOPICS.RIDER_ORDER_COMPLETED(order.riderId.toString()), {
      subscriptionRiderOrderCompleted: order,
    });
  }
  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
}

export const orders = async (_p, _a, ctx) => {
  const u = requireUser(ctx);
  const list = await Order.find({ userId: u._id }).sort({ createdAt: -1 });

  // ⭐ Lazy expire check для каждого PENDING-заказа
  const checked = [];
  for (const o of list) {
    checked.push(await expireIfPending(o));
  }
  return checked;
};

export const order = async (_p, { id }, ctx) => {
  const u = requireUser(ctx);
  if (!id || typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) {
    throw new GraphQLError("Некорректный id заказа", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const o = await Order.findById(id);
  if (!o)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (o.userId.toString() !== u._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }

  // ⭐ Lazy expire check
  return await expireIfPending(o);
};

export const placeOrder = async (_p, { input }, ctx) => {
  const u = requireUser(ctx);
  if (input.paymentMethod !== "COD") {
    throw new GraphQLError("В MVP доступна только оплата при получении (COD)", {
      extensions: { code: "PAYMENT_NOT_AVAILABLE" },
    });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new GraphQLError("Корзина пуста", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const User = (await import("../models/User.js")).User;
  const user = await User.findById(u._id);
  const addr = user?.addresses?.id(input.addressId);
  if (!addr)
    throw new GraphQLError("Адрес не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  await assertAddressInZone(addr);

  const restaurant = await Restaurant.findById(input.restaurantId);
  if (!restaurant) {
    throw new GraphQLError(
      "Ресторан не найден. Очистите корзину и выберите ресторан заново (данные могли обновиться после seed).",
      { extensions: { code: "RESTAURANT_NOT_FOUND" } },
    );
  }
  if (!restaurant.isAvailable) {
    throw new GraphQLError("Ресторан временно не принимает заказы", {
      extensions: { code: "RESTAURANT_UNAVAILABLE" },
    });
  }
  const cfg = await Configuration.findById("singleton");
  const Food = (await import("../models/Food.js")).Food;

  const items = [];
  for (const it of input.items) {
    const food = await Food.findById(it.foodId);
    if (!food || !food.isAvailable) {
      throw new GraphQLError(`Блюдо недоступно: ${it.foodId}`, {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (food.restaurantId.toString() !== restaurant._id.toString()) {
      throw new GraphQLError("Блюдо не из этого ресторана", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    items.push({
      foodId: food._id,
      title: food.title,
      price: food.price,
      quantity: qty,
      image: food.image,
      description: food.description,
      variation: it.variation || null,
      addons: it.addons || [],
    });
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = +(subtotal * ((restaurant.tax || 0) / 100)).toFixed(2);
  const deliveryFee = +(cfg?.deliveryRate || 0).toFixed(2);
  const total = +(subtotal + deliveryFee).toFixed(2);

  if (subtotal < (restaurant.minimumOrder || 0)) {
    throw new GraphQLError(
      `Минимальная сумма заказа ${restaurant.minimumOrder} сом.`,
      { extensions: { code: "MIN_ORDER" } },
    );
  }

  const created = await Order.create({
    orderId: shortOrderId(),
    userId: user._id,
    restaurantId: restaurant._id,
    zoneId: restaurant.zoneId,
    items,
    orderStatus: "PENDING",
    paymentMethod: "COD",
    paid: false,
    note: (input.note || "").trim(),
    deliveryAddress: {
      label: addr.label,
      address: addr.address,
      city: addr.city,
      details: addr.details,
      location: addr.location,
    },
    pickupAddress: {
      name: restaurant.name,
      address: restaurant.address || "",
      city: "",
      location: restaurant.location,
    },
    amounts: { subtotal: +subtotal.toFixed(2), tax, deliveryFee, total },
    statusTimestamps: { pendingAt: new Date() },
  });

  pubsub.publish(TOPICS.PLACE_ORDER(restaurant._id.toString()), {
    subscribePlaceOrder: created,
  });
  pubsub.publish(TOPICS.ORDER_TRACK(created._id.toString()), {
    subscriptionOrder: created,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(user._id.toString()), {
    orderStatusChanged: created,
  });

  startCourierSearchEscalation1(created._id).catch((e) =>
    console.error("[placeOrder] courier search error:", e?.message),
  );

  return created;
};

// === Store / restaurant ===

export const restaurantLogin = async (_p, { input }) => {
  const r = await Restaurant.findOne({ username: input.username });
  if (!r)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const ok = await bcrypt.compare(input.password, r.passwordHash);
  if (!ok)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const token = signRestaurantToken(r);
  return { token, restaurant: r };
};

export const meRestaurant = async (_p, _a, ctx) => {
  return requireRestaurant(ctx);
};

export const restaurantOrders = async (_p, { status }, ctx) => {
  const r = requireRestaurant(ctx);
  const filter = { restaurantId: r._id };
  if (status) filter.orderStatus = status;
  return Order.find(filter).sort({ createdAt: -1 }).limit(100);
};

export const confirmOrderReceived = async (_p, { input }, ctx) => {
  const u = requireUser(ctx);

  if (!input?.orderId) {
    throw new GraphQLError("orderId обязателен", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const order = await Order.findById(input.orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (order.userId.toString() !== u._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }

  // Идемпотентность: уже DELIVERED — вернём как есть
  if (order.orderStatus === "DELIVERED") {
    return order;
  }

  if (order.orderStatus !== "AWAITING_CONFIRMATION") {
    throw new GraphQLError(
      `Невозможно подтвердить заказ в статусе ${order.orderStatus}`,
      { extensions: { code: "BAD_STATE" } },
    );
  }

  order.orderStatus = "DELIVERED";
  order.statusTimestamps = order.statusTimestamps || {};
  if (order.paymentMethod === "COD") order.paid = true;
  if (!order.paidAt) order.paidAt = new Date();
  await order.save();

  if (order.riderId) {
    await Rider.findByIdAndUpdate(order.riderId, { available: true });
    pubsub.publish(TOPICS.RIDER_ORDER_COMPLETED(order.riderId.toString()), {
      subscriptionRiderOrderCompleted: order,
    });
  }

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.PLACE_ORDER(order.restaurantId.toString()), {
    subscribePlaceOrder: order,
  });

  return order;
};

export const refreshOrderStatus = async (_p, { id }, ctx) => {
  const u = requireUser(ctx);
  const o = await Order.findById(id);
  if (!o)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (o.userId.toString() !== u._id.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  await autoConfirmIfExpired(o);
  return Order.findById(id);
};
