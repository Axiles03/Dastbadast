import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Order } from "../models/Order.js";
import { Rider } from "../models/Rider.js";
import { Configuration } from "../models/Configuration.js";
import { signRiderToken } from "../middleware/auth.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { bearingDeg } from "../utils/geo.js";
import {
  setRiderLocationInRedis,
  getRiderLocationFromRedis,
} from "../services/rider-location.service.js";
import { notify } from "../lib/notifications/dispatcher.js";
import {
  startCourierSearchEscalation1,
  excludeRiderFromSearch,
} from "./order-search.js";
import { debugWarn } from "../debug-log.js";

// ⭐⭐⭐ Константы для real-time трекинга
const RIDER_LOCATION_THROTTLE_MS = 10_000; // минимум между обновлениями (10 сек)
const NEAR_DROP_OFF_RADIUS_M = 500; // радиус geofence "рядом с клиентом"
// ⭐ NEW: отдельный, более узкий радиус для АВТОМАТИЧЕСКОГО перехода в
// ARRIVED_AT_DROP_OFF. 500м "рядом" — это только пуш "курьер уже близко",
// а не "он на месте". Для авто-детекта прибытия нужен более строгий радиус,
// иначе статус будет переключаться ещё на подъезде/соседнем доме.
const AUTO_ARRIVED_RADIUS_M = 60;
const BEARING_CHANGE_THRESHOLD_DEG = 15; // минимальное изменение направления для бродкаста
const MIN_DISTANCE_FOR_BROADCAST_M = 25; // минимальное смещение для бродкаста

// Статусы, из которых авто-геофенс может перевести заказ в ARRIVED_AT_DROP_OFF
const AUTO_ARRIVAL_FROM_STATUSES = ["PICKED", "EN_ROUTE_TO_DROP_OFF"];

// ⭐ Фаза 1 (аудит): авто-детект "курьер приехал в ресторан" — по аналогии
// с AUTO_ARRIVED_RADIUS_M на стороне клиента. Радиус чуть шире: рестораны
// часто в ТЦ/дворах с ограничениями на въезд, курьер паркуется дальше от
// самой точки, чем у частных домов на дропе.
const AUTO_ARRIVED_AT_PICKUP_RADIUS_M = 100;

// ⭐ Фаза 1 (аудит): базовая антифрод-эвристика по скорости. Сервер уже
// сам считает speedKmh из расстояния/времени между пингами (не доверяет
// клиентскому значению) — здесь просто отсекаем физически неправдоподобные
// скачки. 80 км/ч с большим запасом покрывает скутер/авто в городе; выше —
// вероятная телепортация (спуф координат) или GPS-глюк на старте сессии.
const MAX_PLAUSIBLE_SPEED_KMH = 80;

// Кэш последней позиции курьера для throttling
const lastRiderLocation = new Map(); // riderId -> { at: number, lat, lng, bearing }

// ⭐⭐⭐ Helper: фильтр публичных данных о курьере
function publicRiderProfile(rider) {
  if (!rider) return null;
  // Принудительно обнуляем GPS для не-админов и не-владельца
  rider.location = { type: "Point", coordinates: [0, 0] };
  rider.lastLocationAt = null;
  return rider;
}

function requireRider(ctx) {
  if (!ctx.rider)
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  return ctx.rider;
}

// Distance helper (Haversine, km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const updateRiderLocation = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const { lat, lng, bearing, mocked } = input;

  // 1) Валидация (без изменений)
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new GraphQLError("Некорректные координаты", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // 2) Throttling: 10 сек (без изменений)
  const now = Date.now();
  const prev = lastRiderLocation.get(r._id.toString());
  if (prev && now - prev.at < RIDER_LOCATION_THROTTLE_MS) {
    return r;
  }

  // ⭐⭐⭐ Вычисляем bearing (направление движения) и дистанцию
  const newBearing = prev ? bearingDeg(prev.lat, prev.lng, lat, lng) : null;
  const distanceFromPrev = prev
    ? haversineKm(prev.lat, prev.lng, lat, lng) * 1000 // метры
    : Infinity;

  // ⭐⭐⭐ Решаем, нужно ли бродкастить
  const shouldBroadcast =
    !prev || // первая точка
    distanceFromPrev >= MIN_DISTANCE_FOR_BROADCAST_M || // значительно сместился
    (newBearing !== null &&
      Math.abs(newBearing - (prev.bearing ?? 0)) >=
        BEARING_CHANGE_THRESHOLD_DEG); // резко повернул

  const speedKmh = prev
    ? (distanceFromPrev / ((now - prev.at) / 1000)) * 3.6
    : null;

  // ⭐ Фаза 1 (аудит): базовая антифрод-эвристика. Флаг, не блокировка —
  // ложные срабатывания возможны (GPS "прыжок" после туннеля/подземного
  // паркинга даёт временный аномальный speedKmh), поэтому мы НЕ отклоняем
  // точку и НЕ рвём трекинг, только считаем и, точечно, не даём такому
  // пингу триггернуть авто-геофенс (см. ниже) — статус заказа не должен
  // переключаться по вероятно бракованной координате.
  const isGpsAnomaly =
    (speedKmh !== null && speedKmh > MAX_PLAUSIBLE_SPEED_KMH) ||
    mocked === true;
  if (isGpsAnomaly) {
    debugWarn("updateRiderLocation", "GPS anomaly detected", {
      riderId: r._id.toString(),
      speedKmh: speedKmh !== null ? Math.round(speedKmh) : null,
      mocked: mocked === true,
    });
    Rider.findByIdAndUpdate(r._id, {
      $inc: { gpsAnomalyCount: 1 },
      $set: { lastGpsAnomalyAt: new Date() },
    }).catch(() => {});
  }

  const updatedAt = new Date().toISOString();
  await setRiderLocationInRedis(r._id.toString(), {
    lat,
    lng,
    bearing: bearing ?? newBearing,
    speedKmh,
    updatedAt,
  });

  // ⭐⭐⭐ FIX: раньше здесь был безусловный `r.save()` НА КАЖДЫЙ пинг
  // (каждые ~10 сек на курьера) — это полностью сводило на нет смысл
  // Redis-буфера и cron-flush'а (см. rider-location-flush.job.js): вместо
  // заявленных "12 записей/час/курьер" Mongo реально получал ~360.
  // Источник правды для "живой" позиции — Redis (уже записан выше).
  // В Mongo пишем редко, отдельным throttled-fallback'ом на случай, если
  // cron почему-то не успел отработать 5 минут подряд (Redis недоступен,
  // деплой, и т.п.) — это ограничивает Mongo снизу разумной частотой
  // независимо от того, работает cron или нет.
  const lastMongoWriteAt = r.lastLocationAt?.getTime() ?? 0;
  const NEED_TO_PERSIST_FALLBACK = now - lastMongoWriteAt > 4 * 60 * 1000; // 4 мин

  if (NEED_TO_PERSIST_FALLBACK) {
    r.location = { type: "Point", coordinates: [lng, lat] };
    r.lastLocationAt = new Date();
    if (typeof bearing === "number") r.bearing = bearing;
    await r.save();
  }

  // Обновляем in-memory кэш (используется для throttling/broadcast-решений)
  lastRiderLocation.set(r._id.toString(), {
    at: now,
    lat,
    lng,
    bearing: newBearing ?? prev?.bearing ?? 0,
  });

  if (!shouldBroadcast) return r;

  // ⭐⭐⭐ Бродкаст курьерской локации
  const payload = {
    riderId: r._id.toString(),
    lat,
    lng,
    bearing: bearing ?? newBearing,
    speedKmh,
    updatedAt,
  };
  pubsub.publish(TOPICS.RIDER_LOCATION(r._id.toString()), {
    subscriptionRiderLocation: payload,
  });

  // ⭐⭐⭐ Geofence detection: проверяем каждый активный заказ курьера
  const activeOrders = await Order.find({
    riderId: r._id,
    orderStatus: { $in: ["ASSIGNED", "PICKED", "EN_ROUTE_TO_DROP_OFF"] },
  }).lean();

  for (const o of activeOrders) {
    const destCoords = o.deliveryAddress?.location?.coordinates;
    if (!destCoords || destCoords.length < 2) continue;
    const [destLng, destLat] = destCoords;
    const distanceToCustomer = haversineKm(lat, lng, destLat, destLng) * 1000;

    // ⭐ Курьер в радиусе 500 м от клиента → триггер уведомления "уже близко"
    if (distanceToCustomer <= NEAR_DROP_OFF_RADIUS_M) {
      const wasAlreadyNear = prev
        ? haversineKm(prev.lat, prev.lng, destLat, destLng) * 1000 <=
          NEAR_DROP_OFF_RADIUS_M
        : false;
      if (!wasAlreadyNear) {
        // Вход в geofence — публикуем событие (для Раздела 3)
        pubsub.publish(TOPICS.RIDER_NEAR_DROP_OFF(o._id.toString()), {
          riderNearDropOff: {
            orderId: o._id.toString(),
            riderId: r._id.toString(),
            distanceM: Math.round(distanceToCustomer),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // ⭐⭐⭐ NEW: авто-детект "курьер приехал к клиенту" по геозоне.
    // Раньше переход в ARRIVED_AT_DROP_OFF был только ручной (кнопка в
    // приложении курьера). Теперь, как только курьер оказывается в узком
    // радиусе AUTO_ARRIVED_RADIUS_M от точки доставки, статус переключается
    // автоматически — курьеру не нужно нажимать кнопку самому.
    // Атомарный findOneAndUpdate с условием по orderStatus защищает от
    // повторных срабатываний на каждый следующий GPS-пинг и от гонки с
    // ручной кнопкой "Я на месте" (arriveAtDropOff), которая могла сработать
    // на долю секунды раньше.
    if (
      distanceToCustomer <= AUTO_ARRIVED_RADIUS_M &&
      AUTO_ARRIVAL_FROM_STATUSES.includes(o.orderStatus) &&
      !isGpsAnomaly // ⭐ Фаза 1: не даём вероятно бракованной/спуфленной точке переключить статус
    ) {
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: o._id,
          riderId: r._id,
          orderStatus: { $in: AUTO_ARRIVAL_FROM_STATUSES },
        },
        {
          $set: {
            orderStatus: "ARRIVED_AT_DROP_OFF",
            "statusTimestamps.arrivedAtDropOffAt": new Date(),
            "statusTimestamps.arrivedAtDropOffSource": "GEOFENCE_AUTO",
          },
        },
        { new: true },
      );

      if (updatedOrder) {
        pubsub.publish(TOPICS.ORDER_TRACK(updatedOrder._id.toString()), {
          subscriptionOrder: updatedOrder,
        });
        pubsub.publish(
          TOPICS.ORDER_STATUS_CHANGED(updatedOrder.userId.toString()),
          { orderStatusChanged: updatedOrder },
        );

        // Пуш клиенту: курьер на месте
        notify({
          to: "user",
          toId: updatedOrder.userId,
          event: "ORDER_ARRIVED_AT_DROP_OFF",
          vars: { orderId: updatedOrder._id.toString() },
        }).catch(() => {});
      }
    }

    // ⭐⭐⭐ Фаза 1 (аудит): авто-детект "курьер приехал в ресторан" —
    // симметрично блоку выше, но для точки pickup и статуса ASSIGNED.
    // Пишем arrivedAtPickupAt ОДИН раз ($set с условием "поле ещё не
    // стоит" через orderStatus:"ASSIGNED", т.к. из ASSIGNED курьер уходит
    // только через PICKED — второго попадания в этот if для того же
    // заказа после первого успеха не будет, статус уже сменится).
    // Не блокируем/не рвём поток при isGpsAnomaly полностью — просто не
    // засчитываем именно эту точку как момент прибытия.
    if (o.orderStatus === "ASSIGNED" && !isGpsAnomaly) {
      const pickupCoords = o.pickupAddress?.location?.coordinates;
      if (pickupCoords && pickupCoords.length >= 2) {
        const [pickupLng, pickupLat] = pickupCoords;
        const distanceToRestaurant =
          haversineKm(lat, lng, pickupLat, pickupLng) * 1000;
        if (distanceToRestaurant <= AUTO_ARRIVED_AT_PICKUP_RADIUS_M) {
          Order.findOneAndUpdate(
            {
              _id: o._id,
              riderId: r._id,
              orderStatus: "ASSIGNED",
              "statusTimestamps.arrivedAtPickupAt": null,
            },
            { $set: { "statusTimestamps.arrivedAtPickupAt": new Date() } },
          ).catch(() => {});
        }
      }
    }
  }

  return r;
};

// ⭐⭐⭐ НОВАЯ мутация: остановка стриминга (при выходе из приложения)
export const stopRiderLocationStream = async (_p, _a, ctx) => {
  const r = requireRider(ctx);
  lastRiderLocation.delete(r._id.toString());
  // Сигнализируем клиентам, что стрим остановлен
  pubsub.publish(TOPICS.RIDER_LOCATION(r._id.toString()), {
    subscriptionRiderLocation: {
      riderId: r._id.toString(),
      stopped: true,
      updatedAt: new Date().toISOString(),
    },
  });
  return true;
};

export const riderLogin = async (_p, { input }) => {
  const r = await Rider.findOne({ username: input.username, isActive: true });
  if (!r)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const ok = await bcrypt.compare(input.password, r.passwordHash);
  if (!ok)
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  const token = signRiderToken(r);
  return { token, rider: r };
};

export const meRider = async (_p, _a, ctx) => requireRider(ctx);

// ⭐⭐⭐ NEW: сводка заработка курьера — для экрана заказа (заказ + смена).
// Раньше на экране заказа показывался только amounts.deliveryFee одного
// заказа (и то не всегда — см. описанный баг), сводки за смену не было
// вовсе. Здесь считаем и то, и другое одним запросом.
export const riderEarningsSummary = async (_p, { orderId }, ctx) => {
  const r = requireRider(ctx);

  let orderEarnings = null;
  if (orderId) {
    const order = await Order.findById(orderId).lean();
    if (order && order.riderId?.toString() === r._id.toString()) {
      let distanceKm = null;
      const from = order.pickupAddress?.location?.coordinates;
      const to = order.deliveryAddress?.location?.coordinates;
      if (from?.length === 2 && to?.length === 2) {
        distanceKm = +haversineKm(from[1], from[0], to[1], to[0]).toFixed(2);
      }
      orderEarnings = {
        orderId: order._id.toString(),
        deliveryFee: order.amounts?.deliveryFee ?? 0,
        distanceKm,
        tip: null, // чаевые пока не реализованы в модели заказа
      };
    }
  }

  // ⭐ Смена: с момента последнего "В сети" (shiftStartedAt). Если курьер
  // сейчас offline (shiftStartedAt=null) — считаем сводку за сегодня,
  // чтобы экран не был пустым сразу после выхода из смены.
  const shiftStart =
    r.shiftStartedAt ??
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();

  const deliveredToday = await Order.find({
    riderId: r._id,
    orderStatus: "DELIVERED",
    "statusTimestamps.deliveredAt": { $gte: shiftStart },
  })
    .select("amounts.deliveryFee")
    .lean();

  const totalEarned = deliveredToday.reduce(
    (sum, o) => sum + (o.amounts?.deliveryFee ?? 0),
    0,
  );

  const onlineMinutes = r.shiftStartedAt
    ? Math.max(0, Math.round((Date.now() - r.shiftStartedAt.getTime()) / 60000))
    : 0;

  return {
    order: orderEarnings,
    shift: {
      shiftStartedAt: r.shiftStartedAt ? r.shiftStartedAt.toISOString() : null,
      deliveriesCount: deliveredToday.length,
      totalEarned: +totalEarned.toFixed(2),
      onlineMinutes,
    },
  };
};

export const riderOrders = async (_p, { status }, ctx) => {
  const r = requireRider(ctx);
  const filter = { riderId: r._id };
  if (status) filter.orderStatus = status;
  return Order.find(filter).sort({ createdAt: -1 });
};

/**
 * FIX: добавлен zone-фильтр. Курьер видит только заказы своей зоны.
 * Если rider.zoneId не задан — видит всё (fallback).
 */
export const availableOrdersForRiders = async (_p, _a, ctx) => {
  const r = requireRider(ctx);
  const baseFilter = { orderStatus: "ACCEPTED", riderId: null };
  if (r.zoneId) {
    baseFilter.zoneId = r.zoneId;
  }
  return Order.find(baseFilter).sort({ createdAt: 1 }).limit(50);
};

// ⭐⭐⭐ NEW: разрешаем взять ВТОРОЙ заказ через claimOrder, только если
// курьер сейчас в пределах 2 км от точки доставки уже имеющегося заказа
// (аналог проверки в acceptDelivery/delivery.js — держим оба места в синхроне).
const MULTI_STOP_PROXIMITY_KM = 2;
async function assertMultiStopProximity(rider) {
  const current = await Order.findOne({
    riderId: rider._id,
    orderStatus: { $in: ["ASSIGNED", "PICKED", "EN_ROUTE_TO_DROP_OFF"] },
  }).lean();
  const destCoords = current?.deliveryAddress?.location?.coordinates;
  if (!destCoords || destCoords.length < 2) {
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }
  const liveLoc = await getRiderLocationFromRedis(rider._id.toString());
  const riderLat = liveLoc?.lat ?? rider.location?.coordinates?.[1];
  const riderLng = liveLoc?.lng ?? rider.location?.coordinates?.[0];
  if (typeof riderLat !== "number" || typeof riderLng !== "number") {
    throw new GraphQLError("Сначала завершите текущий заказ", {
      extensions: { code: "BAD_STATE" },
    });
  }
  const [destLng, destLat] = destCoords;
  const distanceKm = haversineKm(riderLat, riderLng, destLat, destLng);
  if (distanceKm > MULTI_STOP_PROXIMITY_KM) {
    throw new GraphQLError(
      `Второй заказ можно взять, только если вы в ${MULTI_STOP_PROXIMITY_KM} км ` +
        `от точки доставки текущего заказа (сейчас ${distanceKm.toFixed(1)} км)`,
      { extensions: { code: "TOO_FAR_FOR_MULTI_STOP" } },
    );
  }
}

export const claimOrder = async (_p, { orderId }, ctx) => {
  const r = requireRider(ctx);
  if (!r.available) {
    throw new GraphQLError("Включите статус «Доступен», чтобы брать заказы", {
      extensions: { code: "RIDER_UNAVAILABLE" },
    });
  }
  const active = await Order.countDocuments({
    riderId: r._id,
    orderStatus: { $in: ["ASSIGNED", "PICKED", "EN_ROUTE_TO_DROP_OFF"] },
  });
  // ⭐⭐⭐ CHANGED: раньше 1+ активных заказов блокировали claim ПОЛНОСТЬЮ —
  // multi-stop был невозможен. Теперь второй заказ разрешён, если курьер
  // близко (≤2 км) к точке доставки текущего — см. проверку через
  // assertMultiStopProximity ниже. 2+ активных всё ещё блокируются.
  if (active >= 2) {
    throw new GraphQLError("Нельзя взять больше 2 заказов одновременно", {
      extensions: { code: "BAD_STATE" },
    });
  }
  if (active === 1) {
    await assertMultiStopProximity(r);
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: "ACCEPTED", riderId: null },
    {
      $set: {
        riderId: r._id,
        orderStatus: "ASSIGNED",
        "statusTimestamps.assignedAt": new Date(),
      },
    },
    { new: true },
  );
  if (!order) {
    throw new GraphQLError("Заказ уже взял другой курьер или недоступен", {
      extensions: { code: "ALREADY_CLAIMED" },
    });
  }

  // ⭐ CHANGED: r.available больше НЕ трогаем здесь — это переключатель
  // "курьер онлайн/оффлайн", который управляется только самим курьером
  // через toggleRider. Раньше claim выставлял available=false, из-за
  // чего курьер физически не мог пройти проверку "!r.available" выше
  // для второго заказа — multi-stop был архитектурно невозможен.

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.RIDER_ASSIGNED(r._id.toString()), {
    subscriptionAssignedRider: order,
  });
  pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId?.toString()), {
    subscriptionAvailableOrders: order,
  });
  return order;
};

/**
 * ⭐⭐⭐ Фаза 0 (аудит): курьер отказывается от УЖЕ назначенного (claimOrder)
 * заказа ДО того, как забрал его (orderStatus === "ASSIGNED").
 *
 * Раньше единственный путь "снять с себя заказ" не существовал в API вообще —
 * реальная ситуация рабочего дня курьера (поломка скутера, отказался ехать
 * далеко) была нечем обработать штатно. Возвращаем заказ в статус ACCEPTED
 * (симметрично тому, что делает claimOrder: ACCEPTED → ASSIGNED), снимаем
 * riderId и перезапускаем поиск курьера — без участия отказавшегося.
 *
 * Что сознательно НЕ делает эта мутация:
 *  - Не позволяет отказаться после PICKED (курьер уже забрал заказ у
 *    ресторана — это уже не "отказ от назначения", а разрыв доставки в
 *    процессе, для этого нужен отдельный флоу с поддержкой/компенсацией
 *    ресторану, вне рамок Фазы 0).
 *  - Не начисляет штраф автоматически — только считает declinedOrdersCount
 *    на Rider, чтобы Фаза 2 (acceptance rate/приоритезация) могла на это
 *    опереться, не переизобретая учёт с нуля.
 *
 * GraphQL:
 *   declineAssignedOrder(input: DeclineAssignedOrderInput!): Order!
 */
export const declineAssignedOrder = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const { orderId, reason } = input;

  // Атомарный переход: защищает от гонки с ресторанной/системной cancelOrder
  // и с тем, что курьер параллельно уже вызвал updateOrderStatusRider(PICKED).
  const order = await Order.findOneAndUpdate(
    { _id: orderId, riderId: r._id, orderStatus: "ASSIGNED" },
    {
      $set: {
        riderId: null,
        orderStatus: "ACCEPTED",
        lastDeclineReason: reason || "",
      },
      $unset: { "statusTimestamps.assignedAt": "" },
    },
    { new: true },
  );

  if (!order) {
    throw new GraphQLError(
      "Заказ нельзя отменить: он не назначен вам, либо вы уже забрали его",
      { extensions: { code: "BAD_STATE" } },
    );
  }

  Rider.findByIdAndUpdate(r._id, {
    $inc: { declinedOrdersCount: 1 },
    $set: { lastDeclinedAt: new Date() },
  }).catch((e) =>
    debugWarn("declineAssignedOrder", "rider stat update failed", {
      riderId: r._id.toString(),
      message: e?.message,
    }),
  );

  // Чтобы этот же курьер не получил тот же push повторно в следующей волне.
  excludeRiderFromSearch(orderId, r._id.toString()).catch(() => {});

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });
  pubsub.publish(TOPICS.AVAILABLE_ORDERS(order.zoneId?.toString()), {
    subscriptionAvailableOrders: order,
  });

  // Перезапускаем поиск курьера немедленно (fire-and-forget — сама мутация
  // не обязана ждать рассылку push, чтобы вернуть ответ курьеру быстро).
  startCourierSearchEscalation1(orderId.toString()).catch((e) =>
    debugWarn("declineAssignedOrder", "re-dispatch failed", {
      orderId: orderId.toString(),
      message: e?.message,
    }),
  );

  return order;
};

const ALLOWED = {
  PICKED: ["ASSIGNED"],
  AWAITING_CONFIRMATION: ["PICKED"],
  DELIVERED: [],
};

export const updateOrderStatusRider = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const order = await Order.findById(input.orderId);
  if (!order)
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  if (!order.riderId || order.riderId.toString() !== r._id.toString()) {
    throw new GraphQLError("Заказ не назначен вам", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  if (!["PICKED", "AWAITING_CONFIRMATION"].includes(input.status)) {
    throw new GraphQLError(
      "Курьер может выставить PICKED или AWAITING_CONFIRMATION. Финальный DELIVERED ставится только клиентом.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  if (!ALLOWED[input.status].includes(order.orderStatus)) {
    throw new GraphQLError(
      `Невозможно перевести в ${input.status} из ${order.orderStatus}`,
      { extensions: { code: "BAD_STATE" } },
    );
  }

  order.orderStatus = input.status;
  order.statusTimestamps = order.statusTimestamps || {};

  if (input.status === "PICKED") {
    order.statusTimestamps.pickedAt = new Date();

    // ⭐ Фаза 1 (аудит): компенсация за ожидание в ресторане. Считаем от
    // arrivedAtPickupAt (проставляется гео-фенсом в updateRiderLocation
    // выше) до момента PICKED. Если arrivedAtPickupAt почему-то не
    // проставился (курьер был вне GPS-покрытия у ресторана, авто-детект
    // не сработал) — компенсацию не начисляем: лучше недоплатить в
    // редком edge-case, чем начислить от неверной точки отсчёта.
    const arrivedAt = order.statusTimestamps.arrivedAtPickupAt;
    if (arrivedAt) {
      const waitMinutes = (Date.now() - arrivedAt.getTime()) / 60000;
      const cfg = await Configuration.findById("singleton")
        .select("waitCompensationFreeMinutes waitCompensationPerMinute")
        .lean();
      const freeMinutes = Number.isFinite(cfg?.waitCompensationFreeMinutes)
        ? cfg.waitCompensationFreeMinutes
        : 7;
      const perMinute = Number.isFinite(cfg?.waitCompensationPerMinute)
        ? cfg.waitCompensationPerMinute
        : 1;
      const billableMinutes = Math.max(0, waitMinutes - freeMinutes);
      if (billableMinutes > 0) {
        const compensation = +(billableMinutes * perMinute).toFixed(2);
        order.amounts.waitCompensation = compensation;
        // ⭐ Начисляется курьеру через deliveryFee — riderEarningsSummary и
        // клиентский профиль уже суммируют amounts.deliveryFee, отдельного
        // места менять не нужно. amounts.total клиенту НЕ трогаем — это
        // операционные издержки платформы за простой, не то, что видит
        // покупатель в чеке.
        order.amounts.deliveryFee = +(
          order.amounts.deliveryFee + compensation
        ).toFixed(2);
      }
    }
  }

  if (input.status === "AWAITING_CONFIRMATION") {
    order.statusTimestamps.deliveredAt = new Date();
  }

  await order.save();

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), {
    subscriptionOrder: order,
  });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), {
    orderStatusChanged: order,
  });

  return order;
};

export const toggleRider = async (_p, { available }, ctx) => {
  const r = requireRider(ctx);
  const goingOnline = !!available && !r.available;
  const goingOffline = !available && r.available;
  r.available = !!available;
  // ⭐ NEW: старт/конец смены — используется в riderEarningsSummary
  if (goingOnline) {
    r.shiftStartedAt = new Date();
  } else if (goingOffline) {
    r.shiftStartedAt = null;
  }
  await r.save();
  return r;
};

/**
 * ⭐⭐⭐ НОВОЕ: редактирование профиля курьера (имя, телефон, email, фото).
 * Пароль тут НЕ меняется — для этого отдельная мутация changeRiderPassword.
 *
 * ⚠️ MVP-ограничение: `photo` принимается как готовая строка (URL или
 * base64 data-URI из клиента). Для продакшена стоит заменить на загрузку
 * в объектное хранилище (S3/Cloudinary) и хранить здесь только ссылку —
 * base64 в MongoDB не масштабируется на много курьеров с фото.
 */
export const updateRiderProfile = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const { name, phone, email, photo } = input;

  if (typeof name === "string") r.name = name.trim().slice(0, 80);
  if (typeof phone === "string") r.phone = phone.trim().slice(0, 32);
  if (typeof photo === "string") r.photo = photo;

  if (typeof email === "string") {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new GraphQLError("Некорректный email", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (trimmed) {
      const exists = await Rider.findOne({
        email: trimmed,
        _id: { $ne: r._id },
      });
      if (exists) {
        throw new GraphQLError("Этот email уже используется", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }
    r.email = trimmed;
  }

  await r.save();
  return r;
};

/**
 * ⭐⭐⭐ НОВОЕ: смена пароля курьером (нужен текущий пароль).
 * Восстановление пароля через Google/номер телефона — пока не реализовано,
 * на клиенте это заглушка ("скоро").
 */
export const changeRiderPassword = async (_p, { input }, ctx) => {
  const r = requireRider(ctx);
  const { oldPassword, newPassword } = input;

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new GraphQLError("Новый пароль должен быть не короче 6 символов", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const ok = await bcrypt.compare(oldPassword ?? "", r.passwordHash);
  if (!ok) {
    throw new GraphQLError("Текущий пароль указан неверно", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  r.passwordHash = await bcrypt.hash(newPassword, 10);
  await r.save();
  return true;
};

/**
 * FIX: GPS privacy — координаты курьера видны только:
 *  - самому курьеру
 *  - владельцу заказа, в котором курьер сейчас ASSIGNED/PICKED/AWAITING_CONFIRMATION
 *  - админу
 * Остальные — получают null в location и lastLocationAt.
 */
export const rider = async (_p, { id }, ctx) => {
  if (!ctx.user && !ctx.rider && !ctx.owner) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  // 1) Сам курьер или админ — видят всё
  if (ctx.rider && ctx.rider._id.toString() === id) return Rider.findById(id);
  if (ctx.owner) return Rider.findById(id);

  // 2) User — только если этот курьер назначен на его активный заказ
  if (ctx.user) {
    const myActiveOrder = await Order.findOne({
      userId: ctx.user._id,
      riderId: id,
      orderStatus: { $in: ["ASSIGNED", "PICKED", "AWAITING_CONFIRMATION"] },
    });
    if (myActiveOrder) {
      return Rider.findById(id);
    }
    return publicRiderProfile(await Rider.findById(id));
  }

  // 3) Всем остальным — публичный профиль без координат
  const publicProfile = await Rider.findById(id).select(
    "username name phone available zoneId isActive createdAt updatedAt",
  );
  if (!publicProfile) return null;
  // Принудительно обнуляем location/lastLocationAt
  publicProfile.location = { type: "Point", coordinates: [0, 0] };
  publicProfile.lastLocationAt = null;
  return publicProfile;
};

export const riderLocationStream = {
  subscribe: async (_p, { riderId }) => {
    if (!riderId) {
      throw new GraphQLError("riderId обязателен", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    return pubsub.asyncIterator(TOPICS.RIDER_LOCATION(riderId));
  },
  resolve: async (payload, { riderId }) => {
    // payload.subscriptionRiderLocation — приходит из updateRiderLocation
    const data = payload?.subscriptionRiderLocation;
    if (data?.stopped) {
      return {
        riderId,
        stopped: true,
        lat: 0,
        lng: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    if (data && typeof data.lat === "number" && typeof data.lng === "number") {
      return {
        riderId,
        lat: data.lat,
        lng: data.lng,
        bearing: data.bearing ?? null,
        speedKmh: data.speedKmh ?? null,
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      };
    }
    // Fallback: если payload пустой — читаем из Redis
    const fromRedis = await getRiderLocationFromRedis(riderId);
    if (fromRedis) {
      return {
        riderId,
        lat: fromRedis.lat,
        lng: fromRedis.lng,
        bearing: fromRedis.bearing,
        speedKmh: fromRedis.speedKmh,
        updatedAt: fromRedis.updatedAt,
      };
    }
    return null;
  },
};

export const allOrdersChanged = {
  subscribe: (_p, _a) => _pubsub.asyncIterator(_TOPICS.ALL_DELIVERIES),
  resolve: (payload) => payload?.order ?? null,
};

import { registerRegistry } from "../cleanup-cron.js";
registerRegistry(
  "lastRiderLocation", // last GPS-точка каждого курьера (для throttling)
  lastRiderLocation, // Map<riderId, {at, lat, lng, bearing}>
  10 * 60 * 1000, // удалять старше 10 мин (rider вряд ли активен дольше без апдейта)
  5000, // максимум 5000 курьеров в памяти (≈ 2MB)
);
