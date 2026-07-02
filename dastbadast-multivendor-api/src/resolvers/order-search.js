// dastbadast-multivendor-api/src/resolvers/order-search.js
//
// ⭐⭐⭐ Эшелон 1: агрессивный автопоиск курьера.
// 3 пуши: при PENDING, при ACCEPTED, эскалация через 90 сек.
// Раздел 2: кэш расстояний + hot zone detection.

import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Restaurant } from "../models/Restaurant.js";
import { pubsub, TOPICS } from "../pubsub.js";
import {
  COURIER_SEARCH_RULES,
  buildPushList,
} from "../lib/order-search-rules.js";
import { haversineKm } from "../utils/geo.js";

// ⭐⭐⭐ Кэш последних координат курьеров (в памяти)
const riderLocationCache = new Map();
const CACHE_TTL_MS = 60_000;

export function getCachedRiderLocation(riderId) {
  const entry = riderLocationCache.get(riderId.toString());
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    riderLocationCache.delete(riderId.toString());
    return null;
  }
  return entry;
}

export function setCachedRiderLocation(riderId, lat, lng) {
  riderLocationCache.set(riderId.toString(), {
    lat,
    lng,
    at: Date.now(),
  });
}

// ⭐⭐⭐ Hot zone detection
const restaurantHeatMap = new Map();

export async function trackRestaurantActivity(restaurantId) {
  const key = restaurantId.toString();
  const now = Date.now();
  const entry = restaurantHeatMap.get(key) || { orderCount: 0, lastHour: [] };
  entry.orderCount += 1;
  entry.lastHour = entry.lastHour.filter((t) => now - t < 60 * 60 * 1000);
  entry.lastHour.push(now);
  restaurantHeatMap.set(key, entry);
}

export function isRestaurantHot(restaurantId) {
  const entry = restaurantHeatMap.get(restaurantId.toString());
  if (!entry) return false;
  return entry.lastHour.length >= 5;
}

/**
 * ⭐⭐⭐ Главная функция автопоиска курьера.
 * С кэшем расстояний и hot zone detection (Раздел 2).
 */
export async function dispatchCourierSearch({
  orderId,
  radiusKm = COURIER_SEARCH_RULES.INITIAL_PUSH_RADIUS_KM,
  count = COURIER_SEARCH_RULES.INITIAL_PUSH_COUNT,
  escalation = false,
  excludeIds = [],
}) {
  const order = await Order.findById(orderId);
  if (!order) return [];
  if (order.riderId) return [];
  if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return [];

  const restaurant = await Restaurant.findById(order.restaurantId).lean();
  const restaurantLocation = restaurant?.location?.coordinates || null;

  // Hot zone: расширяем радиус если ресторан горячий
  let effectiveRadiusKm = radiusKm;
  if (!escalation && isRestaurantHot(order.restaurantId)) {
    effectiveRadiusKm = Math.min(radiusKm * 1.5, 12);
  }

  // Получаем всех доступных курьеров
  const allRiders = await Rider.find({
    available: true,
    isActive: true,
  }).lean();

  // ⭐ Сортируем по расстоянию (используя кэш)
  const sorted = allRiders
    .map((r) => {
      const coords = r.location?.coordinates || [null, null];
      const [lng, lat] = coords;
      let distance = null;

      // Сначала проверяем кэш (быстрее, чем пересчитывать)
      const cached = getCachedRiderLocation(r._id);
      if (cached) {
        distance = haversineKm(
          cached.lat,
          cached.lng,
          restaurantLocation ? restaurantLocation[1] : 0,
          restaurantLocation ? restaurantLocation[0] : 0,
        );
      } else if (lat != null && lng != null && restaurantLocation) {
        distance = haversineKm(
          lat,
          lng,
          restaurantLocation[1],
          restaurantLocation[0],
        );
        setCachedRiderLocation(r._id, lat, lng);
      } else if (lat != null && lng != null) {
        // У курьера есть координаты, но у ресторана нет — оставляем distance = null
        distance = null;
      }

      return { rider: r, distance };
    })
    .filter(
      (x) =>
        x.rider.available &&
        x.rider.isActive &&
        !excludeIds.includes(String(x.rider._id)),
    )
    .sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    })
    .slice(
      0,
      escalation ? count + COURIER_SEARCH_RULES.ESCALATION_EXTRA_COUNT : count,
    );

  if (!sorted.length) {
    console.log(`[courier-search] no riders found for order ${orderId}`);
    return [];
  }

  // Фиксируем время пуша в документе
  const tsField = escalation
    ? "statusTimestamps.courierSearchTimestamps.escalationPushedAt"
    : "statusTimestamps.courierSearchTimestamps.initialPushedAt";
  await Order.updateOne({ _id: orderId }, { $set: { [tsField]: new Date() } });

  // Бродкаст в AVAILABLE_ORDERS
  if (order.zoneId) {
    pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId.toString()), {
      subscriptionAvailableOrders: order.toObject ? order.toObject() : order,
    });
  }

  // ⭐⭐⭐ ЕДИНСТВЕННОЕ объявление targetRiders (раньше дублировалось)
  const targetRiders = sorted.map((x) => x.rider);

  pubsub.publish(TOPICS.COURIER_SEARCH_NOTIFY, {
    courierSearchNotify: {
      orderId: order._id.toString(),
      orderIdStr: order.orderId,
      restaurantName: restaurant?.name || "Ресторан",
      restaurantLocation,
      riderIds: targetRiders.map((r) => r._id.toString()),
      radiusKm: effectiveRadiusKm,
      escalation,
      fastAcceptBonus: order.fastAcceptBonus || 0,
      createdAt: new Date().toISOString(),
    },
  });

  console.log(
    `[courier-search] order=${orderId} escalation=${escalation} pushed=${targetRiders.length} riders (radius=${effectiveRadiusKm}km)`,
  );

  return targetRiders.map((r) => r._id.toString());
}

/**
 * ⭐⭐⭐ Запустить Эшелон 1: первая волна + отложенная эскалация.
 */
export async function startCourierSearchEscalation1(orderId) {
  const firstWave = await dispatchCourierSearch({
    orderId,
    escalation: false,
  });
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId);
      if (!order || order.riderId) return;
      if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return;
      await dispatchCourierSearch({
        orderId,
        escalation: true,
        excludeIds: firstWave,
      });
    } catch (e) {
      console.error(
        `[courier-search] escalation failed for ${orderId}:`,
        e?.message,
      );
    }
  }, COURIER_SEARCH_RULES.ESCALATION_DELAY_MS);
}
