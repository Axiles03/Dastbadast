// dastbadast-multivendor-api/src/resolvers/order-search.js
//
// ⭐⭐⭐ ШАГ 3: production-ready Geospatial Dispatch Engine.
// Полная замена наивной реализации из предыдущих версий.
//
// Ключевые отличия от MVP-прототипа:
//   1. Mongo $geoNear (а не N×M in-memory Haversine) — масштабируется.
//   2. TTL-фильтр по lastLocationAt — старые курьеры не получают пуши.
//   3. Лимит MAX_ACTIVE_ORDERS_PER_RIDER — защита от перегрузки.
//   4. Hot zone detection + автоматическое расширение радиуса.
//   5. Exclude-список в Redis (TTL 1 час) — идемпотентность эскалации.
//   6. Лимит MAX_PUSH_WAVES — после 3 волн заказ остаётся для ручного
//      назначения через админку.

import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Restaurant } from "../models/Restaurant.js";
import { pubsub, TOPICS } from "../pubsub.js";
import {
  COURIER_SEARCH_RULES,
  excludeKey,
  effectiveRadius,
  rankRidersByDistance,
} from "../lib/order-search-rules.js";
import { getRedis, isRedisReady, tryRedis } from "../utils/redis.js";
import { debugLog, debugWarn, debugError } from "../debug-log.js";

const JOB = "courier-search";

/* ============================================================
 * PUBLIC API (вызывается из order.js и order-actions.js)
 * ============================================================ */

/**
 * Главная функция автопоиска курьера.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {boolean} [params.escalation=false] - это эскалация или первая волна?
 * @param {string[]} [params.excludeIds=[]] - курьеры, которым уже слали (для anti-dup)
 * @returns {Promise<string[]>} - список riderId, которым отправлен пуш
 */
export async function dispatchCourierSearch({
  orderId,
  escalation = false,
  excludeIds = [],
}) {
  if (!orderId) return [];

  // 1) Ранние выходы: заказ нерелевантен
  const order = await Order.findById(orderId).lean();
  if (!order) return [];
  if (order.riderId) return [];
  if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return [];

  // 2) Лимит волн (защита от бесконечного поиска)
  const tsField = escalation
    ? "statusTimestamps.courierSearchTimestamps.escalationPushedAt"
    : "statusTimestamps.courierSearchTimestamps.initialPushedAt";
  if (!escalation) {
    const currentWave = await getCurrentWaveCount(orderId);
    if (currentWave >= COURIER_SEARCH_RULES.MAX_PUSH_WAVES) {
      debugLog(JOB, "max waves reached, manual assign only", { orderId });
      return [];
    }
  }

  // 3) Ресторан
  const restaurant = await Restaurant.findById(order.restaurantId).lean();
  if (!restaurant) return [];
  const restaurantCoords = restaurant.location?.coordinates;
  if (!Array.isArray(restaurantCoords) || restaurantCoords.length !== 2)
    return [];
  const [restaurantLng, restaurantLat] = restaurantCoords;

  // 4) Hot zone detection
  const isHot = await isRestaurantHot(order.restaurantId);
  const baseRadiusKm = effectiveRadius(isHot);
  const count = escalation
    ? COURIER_SEARCH_RULES.INITIAL_PUSH_COUNT +
      COURIER_SEARCH_RULES.ESCALATION_EXTRA_COUNT
    : COURIER_SEARCH_RULES.INITIAL_PUSH_COUNT;

  // 5) Получить ближайших курьеров через Mongo $geoNear (масштабируется)
  //    + вторичный ранкер в памяти (hot zone fallback).
  const candidates = await findCandidatesGeoNear(
    restaurantLat,
    restaurantLng,
    baseRadiusKm,
    count,
  );

  if (candidates.length === 0) {
    debugLog(JOB, "no candidates", { orderId, radius: baseRadiusKm });
    return [];
  }

  // 6) Фильтрация (TTL GPS, активные заказы, available, excludeIds)
  const ridersToPush = [];
  const newExcludeIds = [...excludeIds];
  const cutoffMs = Date.now() - COURIER_SEARCH_RULES.RIDER_LOCATION_TTL_MS;

  // Кэш курьеров с превышением лимита заказов (1 запрос, не на каждого)
  const overworkedRiders = await getOverworkedRiders();
  // Курьеры, которым УЖЕ отправили пуш по этому заказу (идемпотентность)
  const alreadyNotified = await getExcludeList(orderId);

  for (const { rider, distance } of candidates) {
    const riderId = String(rider._id);

    if (alreadyNotified.has(riderId)) continue; // уже слали
    if (newExcludeIds.includes(riderId)) continue; // явно excluded
    if (overworkedRiders.has(riderId)) continue; // перегруз

    // TTL GPS: lastLocationAt не старше 5 мин
    if (
      !rider.lastLocationAt ||
      new Date(rider.lastLocationAt).getTime() < cutoffMs
    ) {
      continue;
    }

    // ⭐⭐⭐ Защита от ботов/выключенных
    if (!rider.available || rider.isActive === false) continue;

    ridersToPush.push({ rider, distance });
    if (ridersToPush.length >= count) break;
  }

  if (ridersToPush.length === 0) {
    debugLog(JOB, "no riders after filtering", {
      orderId,
      candidatesCount: candidates.length,
    });
    return [];
  }

  // 7) Фиксируем волну в заказе
  await Order.updateOne({ _id: orderId }, { $set: { [tsField]: new Date() } });

  // 8) Сохраняем exclude-список (для следующих волн + ретраев)
  const pushedIds = ridersToPush.map((x) => String(x.rider._id));
  await addToExcludeList(orderId, pushedIds);

  // 9) Бродкаст — все подписчики (rider app + админка)
  pubsub.publish(TOPICS.COURIER_SEARCH_NOTIFY, {
    courierSearchNotify: {
      orderId: String(order._id),
      orderIdStr: order.orderId,
      restaurantName: restaurant.name || "Ресторан",
      restaurantLocation: [restaurantLng, restaurantLat],
      riderIds: pushedIds,
      radiusKm: baseRadiusKm,
      escalation,
      fastAcceptBonus: order.fastAcceptBonus || 0,
      createdAt: new Date().toISOString(),
    },
  });

  // 10) AVAILABLE_ORDERS — для "свободной ленты" в rider app
  if (order.zoneId) {
    pubsub.publish(TOPICS.AVAILABLE_ORDERS(String(order.zoneId)), {
      subscriptionAvailableOrders: order,
    });
  }

  debugLog(JOB, "dispatch ok", {
    orderId,
    wave: escalation ? 2 : 1,
    pushedCount: pushedIds.length,
    radiusKm: baseRadiusKm,
    hot: isHot,
  });

  return pushedIds;
}

/**
 * ⭐⭐⭐ Запустить полный цикл: первая волна + отложенная эскалация.
 * Эта функция — основная точка вызова из `placeOrder` и `acceptOrder`.
 */
export async function startCourierSearchEscalation1(orderId) {
  // 1. Сразу отправляем первую волну
  const firstWave = await dispatchCourierSearch({
    orderId,
    escalation: false,
  });
  if (firstWave.length === 0) {
    debugLog(JOB, "first wave empty, skip escalation", { orderId });
    return { firstWave: [], escalation: [] };
  }

  // 2. Планируем эскалацию через 90 сек (если курьер не был назначен)
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId).lean();
      if (!order) return;
      if (order.riderId) return; // уже взят — эскалация не нужна
      if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return;

      const secondWave = await dispatchCourierSearch({
        orderId,
        escalation: true,
        // excludeIds НЕ передаём — берём их из Redis внутри
      });
      debugLog(JOB, "escalation done", { orderId, secondWave });
    } catch (e) {
      debugError(JOB, "escalation failed", { orderId, message: e.message });
    }
  }, COURIER_SEARCH_RULES.ESCALATION_DELAY_MS);

  return { firstWave, escalation: "scheduled" };
}

/* ============================================================
 * HOT ZONE DETECTION
 * ============================================================ */

/**
 * ⭐ Hot zone: если у ресторана >=N заказов за последний час, расширяем радиус.
 * Это решает проблему "ресторан в обеденный пик — все курьеры заняты в этом же районе,
 * нужно подтянуть курьеров из соседних районов".
 *
 * @param {ObjectId|string} restaurantId
 * @returns {Promise<boolean>}
 */
export async function isRestaurantHot(restaurantId) {
  if (!restaurantId) return false;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await Order.countDocuments({
    restaurantId,
    createdAt: { $gte: oneHourAgo },
    orderStatus: { $nin: ["CANCELLED"] },
  });
  return count >= COURIER_SEARCH_RULES.HOT_ZONE_THRESHOLD;
}

/* ============================================================
 * CANDIDATE SELECTION (с $geoNear)
 * ============================================================ */

/**
 * ⭐⭐⭐ Поиск ближайших курьеров через Mongo $geoNear.
 *
 * Использует 2dsphere-индекс на Rider.location (см. scripts/migrate-geo-index.js).
 * Возвращает курьеров, отсортированных по дистанции, БЕЗ учёта available/isActive —
 * это делается на следующем шаге фильтрации (нам важно сначала получить N кандидатов
 * от Mongo, а потом отбросить ненужных).
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @param {number} limit
 * @returns {Promise<{rider: Rider, distance: number}[]>}
 */
async function findCandidatesGeoNear(lat, lng, radiusKm, limit) {
  // $geoNear требует, чтобы он был ПЕРВЫМ stage в aggregation pipeline.
  // Также требует 2dsphere-индекс.
  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceM", // результат в метрах
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: { isActive: true }, // ⭐ только активные (отписавшиеся — нет)
      },
    },
    { $limit: limit * 2 }, // ⭐ берём 2× лимит на случай, если часть отвалится на фильтрах
    {
      $project: {
        username: 1,
        name: 1,
        available: 1,
        isActive: 1,
        zoneId: 1,
        location: 1,
        lastLocationAt: 1,
        bearing: 1,
        distanceM: 1,
      },
    },
  ];

  try {
    const docs = await Rider.aggregate(pipeline).allowDiskUse(true);
    return docs.map((d) => ({
      rider: d,
      distance: (d.distanceM || 0) / 1000, // метры → км
    }));
  } catch (e) {
    // Fallback: если 2dsphere-индекс не создан или aggregate упал —
    // загружаем всех и считаем Haversine в памяти (как раньше).
    debugWarn(JOB, "geoNear failed, fallback to in-memory", {
      message: e.message,
    });
    return await findCandidatesInMemory(lat, lng, radiusKm, limit * 2);
  }
}

/**
 * ⭐ Fallback: in-memory Haversine (если 2dsphere-индекс не создан).
 * Использовать только как аварийный путь; в проде должен работать $geoNear.
 */
async function findCandidatesInMemory(lat, lng, radiusKm, limit) {
  const riders = await Rider.find({ isActive: true })
    .select(
      "username name available isActive zoneId location lastLocationAt bearing",
    )
    .limit(500) // safety
    .lean();
  const ranked = rankRidersByDistance(riders, lat, lng);
  return ranked
    .filter((x) => x.distance <= radiusKm)
    .slice(0, limit)
    .map((x) => ({ rider: x.rider, distance: x.distance }));
}

/* ============================================================
 * OVERWORKED RIDER FILTER
 * ============================================================ */

/**
 * ⭐⭐⭐ Возвращает Set<riderId> курьеров, у которых уже MAX активных заказов.
 * Один aggregation-запрос (не N запросов).
 */
async function getOverworkedRiders() {
  const overworked = new Set();
  const max = COURIER_SEARCH_RULES.MAX_ACTIVE_ORDERS_PER_RIDER;

  // Активные статусы = курьер всё ещё доставляет
  const ACTIVE_STATUSES = [
    "ASSIGNED",
    "PICKED",
    "EN_ROUTE_TO_DROP_OFF",
    "ARRIVED_AT_DROP_OFF",
    "AWAITING_CONFIRMATION",
  ];

  const pipeline = [
    {
      $match: { orderStatus: { $in: ACTIVE_STATUSES }, riderId: { $ne: null } },
    },
    {
      $group: {
        _id: "$riderId",
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: max } } },
  ];

  try {
    const docs = await Order.aggregate(pipeline).allowDiskUse(true);
    for (const d of docs) overworked.add(String(d._id));
  } catch (e) {
    debugError(JOB, "overworked check failed", { message: e.message });
  }
  return overworked;
}

/* ============================================================
 * WAVE COUNT
 * ============================================================ */

async function getCurrentWaveCount(orderId) {
  const order = await Order.findById(orderId)
    .select("statusTimestamps.courierSearchTimestamps")
    .lean();
  if (!order) return 0;
  const cs = order.statusTimestamps?.courierSearchTimestamps;
  if (!cs) return 0;
  return (cs.initialPushedAt ? 1 : 0) + (cs.escalationPushedAt ? 1 : 0);
}

/* ============================================================
 * EXCLUDE LIST (Redis) — идемпотентность эскалации
 * ============================================================ */

/**
 * ⭐ Добавить riderId в exclude-список заказа в Redis.
 * При эскалации или повторных попытках — мы НЕ шлём тем же курьерам повторно.
 */
async function addToExcludeList(orderId, riderIds) {
  if (!riderIds?.length) return;
  if (!(await isRedisReady())) return;
  const key = excludeKey(orderId);
  tryRedis(async (r) => {
    // Используем SADD + EXPIRE (если ключ новый — ставим TTL)
    const pipeline = r.multi();
    pipeline.sadd(key, ...riderIds);
    pipeline.expire(
      key,
      Math.floor(COURIER_SEARCH_RULES.RIDER_EXCLUDE_TTL_MS / 1000),
    );
    await pipeline.exec();
  }, false);
}

/**
 * ⭐ Получить Set<riderId> уже уведомлённых курьеров по заказу.
 */
async function getExcludeList(orderId) {
  const set = new Set();
  if (!(await isRedisReady())) return set;
  await tryRedis(async (r) => {
    const ids = await r.smembers(excludeKey(orderId));
    for (const id of ids) set.add(String(id));
  }, false);
  return set;
}

/**
 * ⭐ Очистить exclude-список заказа (вызывается из claimOrder).
 * Когда курьер взял заказ — остальные из exclude удалять необязательно,
 * но при отмене заказа — нужно вызвать этот метод, чтобы при повторной
 * попытке не было пустого списка.
 */
export async function clearCourierExcludeList(orderId) {
  if (!orderId) return;
  if (!(await isRedisReady())) return;
  await tryRedis(async (r) => {
    await r.del(excludeKey(orderId));
  }, false);
}


// ⭐ V2: за сколько минут до готовности начинать искать курьера
export const COURIER_LEAD_TIME_MIN = 7;

export function scheduleJustInTimeDispatch(orderId, prepTimeMinutes) {
  const prepMin = Number(prepTimeMinutes) || 0;
  const delayMin = Math.max(0, prepMin - COURIER_LEAD_TIME_MIN);
  const delayMs = delayMin * 60_000;

  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId).lean();
      if (!order) return;
      if (order.riderId) return;
      if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return;
      await startCourierSearchEscalation1(orderId);
    } catch (e) {
      debugError(JOB, "just-in-time dispatch failed", {
        orderId,
        message: e.message,
      });
    }
  }, delayMs);
}
