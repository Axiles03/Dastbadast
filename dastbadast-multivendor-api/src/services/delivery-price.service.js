// dastbadast-multivendor-api/src/services/delivery-price.service.js
//
// ⭐⭐⭐ ШАГ 4: единственный источник истины по цене доставки.
//
// Используется в:
//   - placeOrder (Шаг 4 fix — теперь ТОЛЬКО через сервер)
//   - estimateDeliveryPrice query (новый endpoint — превью для cart)
//   - admin force-recalc (будущий Шаг 5)
//
// Принцип:
//   1. Клиент НИКОГДА не присылает `deliveryPrice`. Сервер игнорирует это поле
//      и пересчитывает сам. Если в input пришло значение — логируем как попытку
//      tampering, но всё равно пересчитываем (т.е. для клиента — UX не меняется,
//      но фактическая цена = серверная).
//   2. Все параметры тарифа (basePrice, baseKm, perKmPrice) — из Configuration
//      или дефолты из DELIVERY_PRICING.
//   3. Зона доставки проверяется ОБЯЗАТЕЛЬНО (даже если клиент в неё верит).

import { GraphQLError } from "graphql";
import { Zone } from "../models/Zone.js";
import { Configuration } from "../models/Configuration.js";
import {
  DELIVERY_PRICING,
  calculateDeliveryPrice,
} from "../utils/delivery-price.js";
import { pointInPolygon } from "../utils/zone.js";
import { debugLog, debugWarn } from "../debug-log.js";

const SERVICE = "delivery-price";

/**
 * ⭐ Загрузить актуальные параметры тарифа.
 * Приоритет: Configuration.deliveryBasePrice > DELIVERY_PRICING дефолты.
 * При cold start (Configuration ещё не инициализирован) — fallback на дефолты.
 */
export async function getPricingConfig() {
  let cfg = null;
  try {
    cfg = await Configuration.findById("singleton")
      .select("deliveryBaseKm deliveryBasePrice deliveryPerKmPrice")
      .lean();
  } catch (e) {
    debugWarn(SERVICE, "config read failed, using defaults", {
      message: e?.message,
    });
  }

  return {
    basePrice: Number.isFinite(cfg?.deliveryBasePrice)
      ? cfg.deliveryBasePrice
      : DELIVERY_PRICING.basePrice,
    baseKm: Number.isFinite(cfg?.deliveryBaseKm)
      ? cfg.deliveryBaseKm
      : DELIVERY_PRICING.baseKm,
    perKmPrice: Number.isFinite(cfg?.deliveryPerKmPrice)
      ? cfg.deliveryPerKmPrice
      : DELIVERY_PRICING.perKmPrice,
    currency: DELIVERY_PRICING.currency,
    currencySymbol: DELIVERY_PRICING.currencySymbol,
  };
}

/**
 * ⭐ Валидация координат ресторана и адреса.
 * Возвращает нормализованные [lng, lat] или бросает GraphQLError.
 */
function validateCoordinates(coords, what) {
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new GraphQLError(`${what} has no coordinates`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const [lng, lat] = coords;
  if (typeof lng !== "number" || typeof lat !== "number") {
    throw new GraphQLError(`${what} coordinates are not numbers`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new GraphQLError(`${what} coordinates out of range`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (lng === 0 && lat === 0) {
    // "нулевые" координаты = не настроен ресторан / не выбран адрес
    throw new GraphQLError(
      `${what} has no real GPS coordinates (0,0). Select an address on the map.`,
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  return [lng, lat];
}

/**
 * ⭐ Проверить, что точка доставки внутри активной зоны.
 * Это предотвращает создание заказа, который курьер физически не доставит.
 */
async function assertPointInActiveZone(lng, lat) {
  const zone = await Zone.findOne({ isActive: true }).lean();
  if (!zone) {
    throw new GraphQLError(
      "Delivery zone is not configured. Run seed on API first.",
      { extensions: { code: "ZONE_NOT_CONFIGURED" } },
    );
  }
  const polygon = zone.location?.coordinates?.[0];
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new GraphQLError("Active zone has no valid polygon", {
      extensions: { code: "ZONE_INVALID" },
    });
  }
  if (!pointInPolygon([lng, lat], polygon)) {
    throw new GraphQLError(
      "Address is outside the delivery zone. Pick a point on the map inside the highlighted area.",
      { extensions: { code: "OUT_OF_ZONE" } },
    );
  }
}

/**
 * ⭐ Фаза 1 (аудит): множитель зоны для surge pricing. Намеренно читаем
 * ИМЕННО restaurant.zoneId, а не "любую активную зону, куда попадает
 * адрес" (как делает assertPointInActiveZone ниже) — это разные вещи:
 * там проверяется физическая доставляемость адреса, здесь — тариф
 * конкретного ресторана. Если у ресторана зона не задана — 1 (без surge),
 * без ошибки: отсутствие зоны не должно ломать оформление заказа.
 */
async function getZoneSurgeMultiplier(zoneId) {
  if (!zoneId) return 1;
  try {
    const zone = await Zone.findById(zoneId).select("surgeMultiplier").lean();
    return Number.isFinite(zone?.surgeMultiplier) ? zone.surgeMultiplier : 1;
  } catch (e) {
    debugWarn(SERVICE, "zone surge read failed, defaulting to 1", {
      zoneId: String(zoneId),
      message: e?.message,
    });
    return 1;
  }
}

/**
 * ⭐⭐⭐ ОСНОВНАЯ ФУНКЦИЯ: расчитать стоимость доставки для placeOrder.
 *
 * Клиент НИКОГДА не влияет на цену. Мы принимаем из input только
 * restaurantId + addressId; координаты и тарифы берём с сервера.
 *
 * @param {Object} params
 * @param {string} params.restaurantId
 * @param {string} params.addressId
 * @param {string} params.userId - для логирования (если кто-то abuse)
 * @returns {Promise<{
 *   deliveryPrice: number,
 *   deliveryBreakdown: {
 *     base: number, perKm: number, distanceKm: number, total: number, isOverBase: boolean
 *   }
 * }>}
 */
export async function calculateServerDeliveryPrice({
  restaurantId,
  addressId,
  userId = null,
}) {
  // 1. Загружаем сущности
  const [Restaurant, User] = await Promise.all([
    import("../models/Restaurant.js").then((m) => m.Restaurant),
    import("../models/User.js").then((m) => m.User),
  ]);

  const [restaurant, user] = await Promise.all([
    Restaurant.findById(restaurantId).lean(),
    User.findById(userId).lean(),
  ]);

  if (!restaurant) {
    throw new GraphQLError(`Restaurant not found: ${restaurantId}`, {
      extensions: { code: "RESTAURANT_NOT_FOUND" },
    });
  }
  if (!user) {
    throw new GraphQLError("User not found", {
      extensions: { code: "USER_NOT_FOUND" },
    });
  }
  if (!restaurant.isAvailable) {
    throw new GraphQLError("Restaurant temporarily unavailable", {
      extensions: { code: "RESTAURANT_UNAVAILABLE" },
    });
  }

  const address = (user.addresses || []).find(
    (a) => String(a._id) === String(addressId),
  );
  if (!address) {
    throw new GraphQLError(`Address not found in user profile: ${addressId}`, {
      extensions: { code: "ADDRESS_NOT_FOUND" },
    });
  }

  // 2. Валидация координат
  const [restaurantLng, restaurantLat] = validateCoordinates(
    restaurant.location?.coordinates,
    "Restaurant",
  );
  const [addressLng, addressLat] = validateCoordinates(
    address.location?.coordinates,
    "Delivery address",
  );

  // 3. Проверка: адрес в зоне доставки
  await assertPointInActiveZone(addressLng, addressLat);

  // 4. Загрузка тарифа
  const pricing = await getPricingConfig();

  // ⭐ Фаза 1 (аудит): surge зоны ресторана
  const surgeMultiplier = await getZoneSurgeMultiplier(restaurant.zoneId);

  // 5. Расчёт через единую утилиту (Шаг 1)
  const deliveryFee = calculateDeliveryPrice(
    [restaurantLng, restaurantLat],
    [addressLng, addressLat],
    {
      basePrice: pricing.basePrice,
      baseKm: pricing.baseKm,
      perKmPrice: pricing.perKmPrice,
      surgeMultiplier,
      rounding: "round",
    },
  );

  // 6. Breakdown — для UI-чека (Шаг 1 уже добавил)
  const { calculateDeliveryPriceBreakdown } =
    await import("../utils/delivery-price.js");
  const breakdown = calculateDeliveryPriceBreakdown(
    [restaurantLng, restaurantLat],
    [addressLng, addressLat],
    {
      basePrice: pricing.basePrice,
      baseKm: pricing.baseKm,
      perKmPrice: pricing.perKmPrice,
      surgeMultiplier,
      rounding: "round",
    },
  );

  // 7. Логируем (для аудита)
  debugLog(SERVICE, "price calculated", {
    userId,
    restaurantId,
    addressId,
    distanceKm: breakdown?.distanceKm,
    surgeMultiplier,
    deliveryFee,
  });

  return {
    deliveryPrice: deliveryFee,
    deliveryBreakdown: breakdown,
    currency: pricing.currency,
    currencySymbol: pricing.currencySymbol,
  };
}

/**
 * ⭐⭐⭐ Validation-only функция: возвращает `null` если delivery возможен,
 * иначе — `error` (для предварительной проверки в cart).
 *
 * Используется в UI чтобы показать "Доставка недоступна по этому адресу"
 * без попытки placeOrder.
 */
export async function validateDeliveryAvailability({
  restaurantId,
  addressId,
}) {
  try {
    await calculateServerDeliveryPrice({
      restaurantId,
      addressId,
      userId: null,
    });
    return { available: true, error: null };
  } catch (e) {
    return {
      available: false,
      error: e?.message || "Delivery unavailable",
      code: e?.extensions?.code || "UNKNOWN",
    };
  }
}
