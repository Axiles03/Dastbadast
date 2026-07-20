import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Restaurant } from "../models/Restaurant.js";
// ⭐ FIX: placeOrder раньше проверял только restaurant.isAvailable (ручной
// тумблер владельца), но не часы работы — заказ можно было оформить, даже
// когда ресторан закрыт по расписанию. Переиспользуем ту же функцию, что
// уже используется для Restaurant.isOpenNow на клиенте.
import { isRestaurantOpenNow } from "./restaurant.js";
import { shortOrderId } from "../utils/ids.js";
import { pointInPolygon } from "../utils/zone.js";
import { Zone } from "../models/Zone.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { signToken, signRestaurantToken } from "../middleware/auth.js";
import { Rider } from "../models/Rider.js";
import { Order } from "../models/Order.js";
import { expireIfPending } from "../lib/order-timeouts.js";
import { calculateServerDeliveryPrice } from "../services/delivery-price.service.js";
import { checkRateLimit } from "../utils/redis.js";
import {
  startCourierSearchEscalation1,
  clearCourierExcludeList,
} from "./order-search.js";
import {
  calculateDeliveryPrice,
  calculateDeliveryPriceBreakdown,
} from "../utils/delivery-price.js";

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
  if (input.idempotencyKey) {
    const existing = await Order.findOne({
      userId: u._id,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) return existing; // повторный клик — вернуть уже созданный заказ
  }
  // ⭐⭐⭐ ШАГ 4: rate-limit (защита от спама / фарминга)
  const rate = await checkRateLimit({
    key: `placeOrder:${u._id.toString()}`,
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    throw new GraphQLError(
      `Too many orders. Try again in ${rate.resetInSec}s.`,
      { extensions: { code: "RATE_LIMITED" } },
    );
  }

  // ⭐⭐⭐ ШАГ 4: логируем попытки tampering (не падаем, но фиксируем).
  // В будущем — отправлять в Sentry / алерты.
  if (typeof input.deliveryPrice === "number") {
    console.warn(
      `[SECURITY] User ${u._id} tried to set deliveryPrice=${input.deliveryPrice} — IGNORED, server-side value used`,
    );
  }

  // --- ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ (без изменений, оставлено для контекста) ---

  if (input.paymentMethod !== "COD") {
    throw new GraphQLError("Only COD is available in MVP", {
      extensions: { code: "PAYMENT_NOT_AVAILABLE" },
    });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new GraphQLError("Cart is empty", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const User = (await import("../models/User.js")).User;
  const user = await User.findById(u._id);
  if (!user) {
    throw new GraphQLError("User not found", {
      extensions: { code: "USER_NOT_FOUND" },
    });
  }

  const addr = user?.addresses?.id(input.addressId);
  if (!addr) {
    throw new GraphQLError("Address not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const restaurant = await Restaurant.findById(input.restaurantId);
  if (!restaurant) {
    throw new GraphQLError(
      "Restaurant not found. Refresh cart and try again.",
      { extensions: { code: "RESTAURANT_NOT_FOUND" } },
    );
  }
  if (!restaurant.isAvailable) {
    throw new GraphQLError("Restaurant temporarily unavailable", {
      extensions: { code: "RESTAURANT_UNAVAILABLE" },
    });
  }
  // ⭐ FIX: раньше отсутствовало — ресторан, закрытый по часам работы
  // (workingHours), всё равно принимал заказы через API, даже если UI
  // корзины его блокировал (клиентскую проверку легко обойти).
  if (!isRestaurantOpenNow(restaurant)) {
    throw new GraphQLError(
      "Restaurant is closed now. Please order during working hours.",
      { extensions: { code: "RESTAURANT_CLOSED" } },
    );
  }

  // ⭐ ШАГ 5 (FIX): "Пятничный завал" — режим preOrdersOnly. Пока в системе
  // нет полноценных предзаказов (scheduledFor), поэтому честно отклоняем
  // немедленный заказ с понятной причиной, а не тихо принимаем его,
  // игнорируя явно выставленный ресторатором сигнал перегрузки.
  if (restaurant.busyMode?.enabled && restaurant.busyMode?.preOrdersOnly) {
    throw new GraphQLError(
      "Restaurant is currently accepting pre-orders only due to high load. Please try again later.",
      { extensions: { code: "RESTAURANT_BUSY_PREORDERS_ONLY" } },
    );
  }

  // ⭐⭐⭐ ШАГ 4: валидация и расчёт блюд (без изменений из Шага 1)
  const Food = (await import("../models/Food.js")).Food;
  const items = [];
  for (const it of input.items) {
    const food = await Food.findById(it.foodId);
    if (!food || !food.isAvailable) {
      throw new GraphQLError(`Food unavailable: ${it.foodId}`, {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (food.restaurantId.toString() !== restaurant._id.toString()) {
      throw new GraphQLError("Food doesn't belong to this restaurant", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);

    // ⭐ Расчёт модификаторов — новая логика из Шага 1
    let optionsTotal = 0;
    const selectedOptionsResolved = [];
    for (const opt of it.selectedOptions || []) {
      const group = (food.optionGroups || []).find(
        (g) => String(g._id) === String(opt.groupId),
      );
      if (!group) {
        throw new GraphQLError(`Option group not found: ${opt.groupId}`, {
          extensions: { code: "MODIFIER_UNAVAILABLE" },
        });
      }
      const option = (group.options || []).find(
        (o) => String(o._id) === String(opt.optionId),
      );
      if (!option || option.isAvailable === false) {
        throw new GraphQLError(`Option not available: ${opt.optionId}`, {
          extensions: { code: "MODIFIER_UNAVAILABLE" },
        });
      }
      selectedOptionsResolved.push({
        groupId: group._id,
        groupTitle: group.title,
        optionId: option._id,
        optionTitle: option.title,
        price: option.price,
      });
      optionsTotal += option.price;
    }

    items.push({
      foodId: food._id,
      title: food.title,
      price: +(food.price + optionsTotal).toFixed(2),
      basePrice: food.price,
      optionsTotal: +optionsTotal.toFixed(2),
      quantity: qty,
      image: food.image,
      description: food.description,
      selectedOptions: selectedOptionsResolved,
    });
  }
  const subtotal = items.reduce(
    (s, i) => s + (i.basePrice + i.optionsTotal) * i.quantity,
    0,
  );
  const tax = 0;

  // ⭐⭐⭐ ШАГ 4: серверная валидация координат + расчёт цены доставки
  // (Клиент НЕ МОЖЕТ прислать своё значение — оно игнорируется.)
  const { deliveryPrice, deliveryBreakdown } =
    await calculateServerDeliveryPrice({
      restaurantId: input.restaurantId,
      addressId: input.addressId,
      userId: u._id,
    });

  const total = +(subtotal + deliveryPrice).toFixed(2);

  // Минимальная сумма
  if (subtotal < (restaurant.minimumOrder || 0)) {
    throw new GraphQLError(`Minimum order is ${restaurant.minimumOrder} сом.`, {
      extensions: { code: "MIN_ORDER" },
    });
  }

  // --- СОЗДАНИЕ ЗАКАЗА (без изменений структуры) ---
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
    amounts: {
      subtotal: +subtotal.toFixed(2),
      tax,
      deliveryFee: deliveryPrice, // ⭐⭐⭐ ШАГ 4: ТОЛЬКО серверное значение
      total,
      // ⭐ Фаза 1 (аудит): фиксируем, какой surge реально применился к
      // ЭТОМУ заказу — Zone.surgeMultiplier может поменяться позже.
      surgeMultiplier: deliveryBreakdown?.surgeMultiplier ?? 1,
    },
    // ⭐⭐⭐ ШАГ 4: сохраняем разбивку для чека в UI
    statusTimestamps: { pendingAt: new Date() },
  });

  // ⭐⭐⭐ ШАГ 4: НЕ сохраняем input.deliveryPrice в какие-либо поля.
  // Если хотите разбивку в заказе — нужно расширить Order.js (Шаг 5).

  // Публикация событий (без изменений)
  pubsub.publish(TOPICS.PLACE_ORDER(restaurant._id.toString()), {
    subscribePlaceOrder: created,
  });
  pubsub.publish(TOPICS.ORDER_TRACK(created._id.toString()), {
    subscriptionOrder: created,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(user._id.toString()), {
    orderStatusChanged: created,
  });

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

// ⭐⭐⭐ NEW: загрузка кухни ресторана — для модалки выбора времени
// приготовления в приложении ресторана. Раньше модалка показывала
// статичный список 20..60 мин без какого-либо учёта реальной очереди.
// Здесь считаем: сколько заказов сейчас реально готовится/ждёт готовки,
// и на основе среднего фактического времени готовки за последние заказы
// даём рекомендованное время для НОВОГО заказа.
export const kitchenLoad = async (_p, _a, ctx) => {
  const restaurant = requireRestaurant(ctx);

  const activeStatuses = ["ACCEPTED", "PREPARING"];
  const activeOrders = await Order.find({
    restaurantId: restaurant._id,
    orderStatus: { $in: activeStatuses },
  })
    .select("statusTimestamps orderStatus")
    .lean();

  const queueLength = activeOrders.length;

  // Среднее фактическое время готовки последних 20 доставленных/готовых
  // заказов (acceptedAt → readyAt), как ориентир "сколько кухня
  // реально тратит времени", а не то, что ресторан когда-то выбрал вручную.
  const recentDone = await Order.find({
    restaurantId: restaurant._id,
    "statusTimestamps.acceptedAt": { $ne: null },
    "statusTimestamps.readyAt": { $ne: null },
  })
    .sort({ "statusTimestamps.readyAt": -1 })
    .limit(20)
    .select("statusTimestamps")
    .lean();

  let avgActualPrepMin = null;
  if (recentDone.length > 0) {
    const durations = recentDone
      .map((o) => {
        const a = o.statusTimestamps?.acceptedAt;
        const r = o.statusTimestamps?.readyAt;
        if (!a || !r) return null;
        return (new Date(r).getTime() - new Date(a).getTime()) / 60_000;
      })
      .filter((v) => typeof v === "number" && v > 0 && v < 180);
    if (durations.length > 0) {
      avgActualPrepMin =
        durations.reduce((s, v) => s + v, 0) / durations.length;
    }
  }

  const extraPrepMinutes = restaurant.busyMode?.enabled
    ? (restaurant.busyMode?.extraPrepMinutes ?? 0)
    : 0;

  // ⭐ Формула рекомендации: базовое время (среднее фактическое, либо 30
  // мин по умолчанию, если истории ещё нет) + запас за каждый заказ в
  // очереди сверх первого (кухня же не готовит все заказы параллельно
  // одинаково быстро). Округляем вверх до ближайших 5 минут, ограничиваем
  // диапазоном 20..60 (тот же диапазон, что был в старом статичном списке).
  const base = avgActualPrepMin ?? 30;
  const queuePenalty = Math.max(0, queueLength - 1) * 5;
  let suggested = Math.ceil((base + queuePenalty + extraPrepMinutes) / 5) * 5;
  suggested = Math.min(90, Math.max(20, suggested));

  return {
    queueLength,
    avgActualPrepMin: avgActualPrepMin ? Math.round(avgActualPrepMin) : null,
    suggestedPrepTime: suggested,
    isBusy: queueLength >= 3 || Boolean(restaurant.busyMode?.enabled), // ⭐ порог "кухня загружена" для UI-бейджа
  };
};
