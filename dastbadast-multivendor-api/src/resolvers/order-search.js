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
// ⭐ ШАГ 4 (FIX): персистентная очередь вместо голого setTimeout —
// см. queues/dispatch-queue.js для полного обоснования.
import { scheduleDispatchJob } from "../queues/dispatch-queue.js";
// ⭐ Фаза 2 (аудит): road-time re-ranking + batching/stacking
import {
  getOsrmDurationSeconds,
  getOsrmDurationsMatrix,
} from "../utils/osrm.js";
import { getRiderLocationFromRedis } from "../services/rider-location.service.js";
import { haversineKm } from "../utils/geo.js";

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
  // ⭐ ШАГ 1 (FIX): было `!["PENDING", "ACCEPTED"].includes(...)`.
  // `readyOrder` (delivery.js) вызывает dispatchCourierSearch({escalation:true})
  // СРАЗУ ПОСЛЕ того, как сам же перевёл заказ в READY_FOR_PICKUP — то есть
  // к моменту чтения заказа здесь его статус уже READY_FOR_PICKUP (а иногда
  // PREPARING, если ресторан отмечает готовку поэтапно). Старая проверка
  // считала такой заказ "нерелевантным" и тихо возвращала [] — расширенный
  // срочный поиск курьера («Эшелон 2») фактически НИКОГДА не отправлял пуши
  // в момент, когда еда уже готова и это наиболее критично.
  if (
    !["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"].includes(
      order.orderStatus,
    )
  )
    return [];

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
  const geoNearCandidates = await findCandidatesGeoNear(
    restaurantLat,
    restaurantLng,
    baseRadiusKm,
    count,
  );

  if (geoNearCandidates.length === 0) {
    debugLog(JOB, "no candidates", { orderId, radius: baseRadiusKm });
    return [];
  }

  // ⭐⭐ Фаза 2 (аудит), п.7: geoNear сортирует по прямой (Haversine) — не
  // учитывает дорожную сеть. Ре-ранжируем top-N реальным временем в пути
  // через OSRM /table (один batch-запрос, не N). При недоступности OSRM —
  // rerankByRoadTime сама вернёт исходный Haversine-порядок, дальше по коду
  // ничего не меняется (единый путь, без if/else на вызывающей стороне).
  const roadRankedCandidates = await rerankByRoadTime(
    [restaurantLat, restaurantLng],
    geoNearCandidates,
  );

  // ⭐⭐ Фаза 2 (аудит), п.8: батчинг/стекинг — курьеры, уже везущие другой
  // заказ (PICKED/EN_ROUTE_TO_DROP_OFF), чей маршрут проходит рядом с этим
  // рестораном, получают приоритет ПЕРЕД обычным geoNear-пулом, если детур
  // не превышает порог. Это не альтернативный путь диспетчинга, а слияние в
  // тот же список кандидатов — вся остальная логика (TTL, overworked,
  // exclude-лист, MAX_PUSH_WAVES) применяется к ним одинаково.
  const stackingCandidates = await findStackingCandidates(
    order,
    restaurantLat,
    restaurantLng,
  );
  const candidates = mergeCandidatesPreferStacking(
    stackingCandidates,
    roadRankedCandidates,
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

  for (const { rider, distance, stacked, detourMin } of candidates) {
    const riderId = String(rider._id);

    if (alreadyNotified.has(riderId)) continue; // уже слали
    if (newExcludeIds.includes(riderId)) continue; // явно excluded
    // ⭐ Фаза 2: стекинг-кандидат уже везёт заказ — это ОЖИДАЕМО, поэтому
    // намеренно НЕ проверяем overworkedRiders для него (иначе стекинг
    // никогда бы не сработал: у такого курьера всегда есть 1 активный
    // заказ). MAX_ACTIVE_ORDERS_PER_RIDER всё равно продолжает защищать
    // от >MAX одновременных заказов — просто не блокирует ровно 2-й,
    // который стекинг и должен предлагать.
    if (!stacked && overworkedRiders.has(riderId)) continue;

    // TTL GPS: lastLocationAt не старше 5 мин
    if (
      !rider.lastLocationAt ||
      new Date(rider.lastLocationAt).getTime() < cutoffMs
    ) {
      continue;
    }

    // ⭐⭐⭐ Защита от ботов/выключенных
    if (!rider.available || rider.isActive === false) continue;

    ridersToPush.push({ rider, distance, stacked: !!stacked, detourMin });
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

  // ⭐ Фаза 2: отдельно выделяем, кто из пушнутых — стекинг-кандидат, для
  // видимости в админке/логах (не влияет на логику доставки push).
  const stackedRiderIds = ridersToPush
    .filter((x) => x.stacked)
    .map((x) => String(x.rider._id));

  // 9) Бродкаст — все подписчики (rider app + админка)
  pubsub.publish(TOPICS.COURIER_SEARCH_NOTIFY, {
    courierSearchNotify: {
      orderId: String(order._id),
      orderIdStr: order.orderId,
      restaurantName: restaurant.name || "Ресторан",
      restaurantLocation: [restaurantLng, restaurantLat],
      riderIds: pushedIds,
      stackedRiderIds,
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
  //
  // ⭐ ШАГ 4 (FIX): раньше — голый setTimeout, терявшийся при рестарте
  // процесса. Теперь — сначала пробуем персистентную очередь (BullMQ/Redis,
  // переживает рестарт); если Redis недоступен — откатываемся на старый
  // setTimeout как graceful degradation (лучше сработавшая-но-неперсистентная
  // эскалация, чем вообще никакой).
  const queued = await scheduleDispatchJob({
    name: "escalation",
    jobId: `escalation:${orderId}`,
    data: { orderId },
    delayMs: COURIER_SEARCH_RULES.ESCALATION_DELAY_MS,
  });

  if (!queued) {
    debugWarn(JOB, "persistent queue unavailable, using setTimeout fallback", {
      orderId,
    });
    setTimeout(() => {
      runEscalationWave(orderId).catch((e) =>
        debugError(JOB, "escalation (fallback) failed", {
          orderId,
          message: e.message,
        }),
      );
    }, COURIER_SEARCH_RULES.ESCALATION_DELAY_MS);
  }

  return { firstWave, escalation: queued ? "queued" : "scheduled (fallback)" };
}

/**
 * ⭐ ШАГ 4 (FIX): вынесенное тело эскалации — раньше жило только внутри
 * анонимного колбэка `setTimeout`. Теперь это самостоятельная экспортируемая
 * функция, которую вызывает и BullMQ-воркер (queues/dispatch-worker.js),
 * и setTimeout-fallback выше (на случай недоступности Redis).
 */
export async function runEscalationWave(orderId) {
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
}

/* ============================================================
 * ⭐⭐⭐ Фаза 2 (аудит), п.7: ROAD-TIME RE-RANKING (OSRM)
 * ============================================================ */

// Не гоняем OSRM на весь список кандидатов — только на top-N по прямой.
// 12 — компромисс между качеством ранжирования и размером/латентностью
// одного /table запроса к публичному демо-серверу OSRM.
const ROAD_TIME_RERANK_CAP = 12;

/**
 * ⭐⭐⭐ Ре-ранжирует top-N кандидатов (уже отсортированных geoNear по
 * прямой) реальным временем в пути через OSRM /table (один batch-запрос).
 * "Хвост" за пределами ROAD_TIME_RERANK_CAP остаётся в исходном
 * Haversine-порядке и приклеивается после ре-ранжированной головы — они
 * и так маловероятные кандидаты (иначе не были бы в хвосте после geoNear),
 * платить за них ещё один OSRM-запрос не оправдано.
 *
 * При недоступности/таймауте OSRM возвращает candidates БЕЗ ИЗМЕНЕНИЙ —
 * весь остальной код дальше по dispatchCourierSearch работает одинаково
 * в обоих случаях, доп. ветвлений на вызывающей стороне не требуется.
 *
 * @param {[number, number]} origin [lat, lng] ресторана
 * @param {{rider: Rider, distance: number}[]} candidates
 * @returns {Promise<{rider: Rider, distance: number, roadTimeSec?: number|null}[]>}
 */
async function rerankByRoadTime(origin, candidates) {
  if (candidates.length <= 1) return candidates;

  const head = candidates.slice(0, ROAD_TIME_RERANK_CAP);
  const tail = candidates.slice(ROAD_TIME_RERANK_CAP);

  const destinations = [];
  const withCoords = [];
  for (const c of head) {
    const coords = c.rider.location?.coordinates; // [lng, lat]
    if (!Array.isArray(coords) || coords.length < 2) continue; // защита от битых данных
    destinations.push([coords[1], coords[0]]);
    withCoords.push(c);
  }
  if (withCoords.length === 0) return candidates;

  const durations = await getOsrmDurationsMatrix(origin, destinations);
  if (!durations) {
    debugWarn(JOB, "OSRM road-time rerank unavailable, using Haversine order");
    return candidates; // graceful fallback — исходный порядок как был
  }

  const ranked = withCoords.map((c, i) => ({
    ...c,
    roadTimeSec: durations[i],
  }));
  // Недостижимые по дорогам (OSRM вернул null для конкретной пары) — в
  // конец головы, не выбрасываем совсем: курьер физически существует,
  // просто не смогли посчитать маршрут (временный сбой матчинга к графу).
  ranked.sort((a, b) => {
    if (a.roadTimeSec === null && b.roadTimeSec === null) return 0;
    if (a.roadTimeSec === null) return 1;
    if (b.roadTimeSec === null) return -1;
    return a.roadTimeSec - b.roadTimeSec;
  });

  return [...ranked, ...tail];
}

/* ============================================================
 * ⭐⭐⭐ Фаза 2 (аудит), п.8: BATCHING / STACKING
 * ============================================================ */

const STACKING_ACTIVE_STATUSES = ["PICKED", "EN_ROUTE_TO_DROP_OFF"];
// Дешёвый Haversine-прескрин перед тем, как тратить OSRM-запросы —
// курьер физически не может быть выгодным стекинг-кандидатом, если он
// сейчас дальше этого от нового ресторана.
const STACKING_PREFILTER_RADIUS_KM = 3;
// Сколько кандидатов максимум проверяем через OSRM за одну волну
// диспетчинга — бережём rate-лимит публичного демо-сервера (см. osrm.js).
const STACKING_MAX_OSRM_CHECKS = 3;
// Порог "приемлемого" крюка: курьер заедет за новым заказом по пути к
// своей текущей точке доставки, если это добавляет не больше 5 минут.
const STACKING_MAX_DETOUR_MIN = 5;

/**
 * ⭐⭐⭐ Ищет курьеров, которые ПРЯМО СЕЙЧАС везут другой заказ
 * (PICKED/EN_ROUTE_TO_DROP_OFF), но чей маршрут проходит достаточно
 * близко к ресторану НОВОГО заказа, чтобы забрать его по пути — вместо
 * того, чтобы слать заказ отдельному свободному курьеру.
 *
 * Эвристика детура: (rider→новый_ресторан→текущий_dropoff) минус
 * (rider→текущий_dropoff напрямую). Если разница ≤ STACKING_MAX_DETOUR_MIN
 * — курьер сможет заехать за новым заказом почти не теряя времени на
 * текущей доставке.
 *
 * Намеренно НЕ реализовано в Фазе 2 (следующий шаг, не обязательно
 * логичное продолжение): вариант "сначала новый ресторан, потом текущий
 * dropoff" (когда это быстрее) — усложняет эвристику вдвое по OSRM-вызовам
 * ради случая, который на практике реже (курьер уже в пути к клиенту,
 * разворачивать его в обратную сторону — плохой UX для первого клиента).
 *
 * @returns {Promise<{rider: Rider, distance: number, stacked: true, detourMin: number}[]>}
 */
async function findStackingCandidates(order, restaurantLat, restaurantLng) {
  const activeOrders = await Order.find({
    _id: { $ne: order._id },
    orderStatus: { $in: STACKING_ACTIVE_STATUSES },
    riderId: { $ne: null },
  })
    .select("riderId deliveryAddress.location")
    .lean();

  if (activeOrders.length === 0) return [];

  const prefiltered = [];
  for (const o of activeOrders) {
    const dropoffCoords = o.deliveryAddress?.location?.coordinates;
    if (!Array.isArray(dropoffCoords) || dropoffCoords.length < 2) continue;

    const loc = await getRiderLocationFromRedis(String(o.riderId));
    if (!loc) continue; // курьер вне GPS-покрытия — не рискуем угадывать

    const distToRestaurant = haversineKm(
      loc.lat,
      loc.lng,
      restaurantLat,
      restaurantLng,
    );
    if (distToRestaurant > STACKING_PREFILTER_RADIUS_KM) continue;

    prefiltered.push({
      order: o,
      riderPos: loc,
      distToRestaurant,
      dropoffCoords,
    });
  }
  if (prefiltered.length === 0) return [];

  prefiltered.sort((a, b) => a.distToRestaurant - b.distToRestaurant);
  const toCheck = prefiltered.slice(0, STACKING_MAX_OSRM_CHECKS);

  const results = [];
  for (const c of toCheck) {
    const [dropLng, dropLat] = c.dropoffCoords;
    const riderLatLng = [c.riderPos.lat, c.riderPos.lng];
    const dropLatLng = [dropLat, dropLng];
    const restaurantLatLng = [restaurantLat, restaurantLng];

    const [directSec, toRestaurantSec] = await Promise.all([
      getOsrmDurationSeconds(riderLatLng, dropLatLng),
      getOsrmDurationSeconds(riderLatLng, restaurantLatLng),
    ]);
    if (directSec === null || toRestaurantSec === null) continue; // OSRM недоступен — пропускаем, не угадываем

    const restaurantToDropSec = await getOsrmDurationSeconds(
      restaurantLatLng,
      dropLatLng,
    );
    if (restaurantToDropSec === null) continue;

    const detourMin = (toRestaurantSec + restaurantToDropSec - directSec) / 60;
    if (detourMin > STACKING_MAX_DETOUR_MIN) continue;

    const rider = await Rider.findById(c.order.riderId)
      .select(
        "username name available isActive zoneId location lastLocationAt bearing",
      )
      .lean();
    if (!rider) continue;

    results.push({
      rider,
      distance: c.distToRestaurant,
      stacked: true,
      detourMin: +detourMin.toFixed(1),
    });
  }

  results.sort((a, b) => a.detourMin - b.detourMin);
  return results;
}

/**
 * ⭐ Склеивает стекинг-кандидатов (приоритет) с обычным пулом, убирая
 * дубликаты по riderId (курьер теоретически может попасть в оба списка —
 * например, его текущий dropoff далеко, но сам он физически рядом с новым
 * рестораном по другой причине). Стекинг-версия побеждает при дубликате,
 * т.к. несёт доп. данные (stacked/detourMin), нужные дальше для
 * "мягкого" обхода overworkedRiders в фильтрации.
 */
function mergeCandidatesPreferStacking(stackingCandidates, normalCandidates) {
  const seen = new Set(stackingCandidates.map((c) => String(c.rider._id)));
  const rest = normalCandidates.filter((c) => !seen.has(String(c.rider._id)));
  return [...stackingCandidates, ...rest];
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
/**
 * ⭐ Фаза 0 (аудит): точечно исключить ОДНОГО курьера из будущих волн
 * поиска по конкретному заказу — не путать с clearCourierExcludeList
 * (та очищает список целиком). Используется из declineAssignedOrder
 * (resolvers/rider.js), чтобы курьер, только что отказавшийся от
 * заказа, не получил тот же самый push повторно в следующей волне.
 */
export async function excludeRiderFromSearch(orderId, riderId) {
  return addToExcludeList(orderId, [riderId]);
}

export async function clearCourierExcludeList(orderId) {
  if (!orderId) return;
  if (!(await isRedisReady())) return;
  await tryRedis(async (r) => {
    await r.del(excludeKey(orderId));
  }, false);
}

// ⭐ V2: за сколько минут до готовности начинать искать курьера
export const COURIER_LEAD_TIME_MIN = 7;

/**
 * ⭐ ШАГ 4 (FIX): та же замена setTimeout → персистентная очередь + fallback,
 * что и в startCourierSearchEscalation1 выше.
 *
 * Функция теперь async (раньше была синхронной обёрткой над setTimeout) —
 * вызывающий код (order-actions.js) не обязан её ожидать (fire-and-forget
 * по-прежнему допустим), но может, если нужно узнать, ушла ли задача в
 * персистентную очередь или в fallback.
 */
export async function scheduleJustInTimeDispatch(orderId, prepTimeMinutes) {
  const prepMin = Number(prepTimeMinutes) || 0;
  const delayMin = Math.max(0, prepMin - COURIER_LEAD_TIME_MIN);
  const delayMs = delayMin * 60_000;

  const queued = await scheduleDispatchJob({
    name: "just-in-time",
    jobId: `jit:${orderId}`,
    data: { orderId },
    delayMs,
  });

  if (!queued) {
    debugWarn(JOB, "persistent queue unavailable, using setTimeout fallback", {
      orderId,
    });
    setTimeout(() => {
      runJustInTimeDispatch(orderId).catch((e) =>
        debugError(JOB, "just-in-time dispatch (fallback) failed", {
          orderId,
          message: e.message,
        }),
      );
    }, delayMs);
  }
}

/**
 * ⭐ ШАГ 4 (FIX): вынесенное тело JIT-диспетчинга — вызывается и
 * BullMQ-воркером, и setTimeout-fallback'ом выше.
 */
export async function runJustInTimeDispatch(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) return;
  if (order.riderId) return;
  if (!["PENDING", "ACCEPTED"].includes(order.orderStatus)) return;
  await startCourierSearchEscalation1(orderId);
}
