// dastbadast-multivendor-api/src/resolvers/restaurant.js
import { Restaurant } from "../models/Restaurant.js";
import mongoose from "mongoose";

export const restaurants = async (_p, { zoneId, latitude, longitude }) => {
  // ⭐ ШАГ 1: если переданы координаты пользователя — используем
  // MongoDB $geoNear. Возвращает плоские объекты с дополнительным
  // полем distanceM (метры), которое читает resolver `distanceKm`
  // в resolvers/index.js. Индекс 2dsphere на Restaurant.location
  // уже создан (см. scripts/migrate-geo-index.js).
  if (latitude != null && longitude != null) {
    try {
      const pipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [longitude, latitude] },
            distanceField: "distanceM", // в метрах
            maxDistance: 50000, // 50 км потолок
            spherical: true,
            query: {
              isAvailable: true,
              ...(zoneId ? { zoneId } : {}),
            },
          },
        },
        { $limit: 100 },
      ];
      return await Restaurant.aggregate(pipeline);
    } catch (e) {
      // ⭐ Fallback: если 2dsphere-индекса нет или $geoNear упал — обычный
      // find, без сортировки по дистанции.
      console.warn(
        "restaurants: $geoNear failed, fallback to find",
        e?.message,
      );
    }
  }
  const filter = { isAvailable: true };
  if (zoneId) filter.zoneId = zoneId;
  return Restaurant.find(filter).sort({ createdAt: -1 });
};

function isObjectId(str) {
  return typeof str === "string" && /^[a-f0-9]{24}$/i.test(str);
}

/**
 * ⭐ FIX: на /restaurant/[id] страница вызывается с slug ("shawarma-city"),
 * а НЕ с ObjectId. Раньше код сначала пробовал findById(slug) (не находил,
 * это ОК), а затем findOne({slug}) — это правильный путь. НО проблема в
 * том, что на главной странице app/(main)/page.tsx (SSR) резолвит
 * restaurants и на каждом item вытаскивает ресторан по его id.
 * Когда id === slug, findById(slug) → null, fallthrough на findOne({slug}) → ok.
 * ВСЁ ЭТО работало для findOne. НО ошибка "Cast to ObjectId failed for
 * value 'shawarma-city'" возникает НЕ в `restaurant` resolver, а в
 * вложенном запросе `restaurantReviews` — он получает тот же slug и
 * пытается сделать find({restaurantId: "shawarma-city"}).
 *
 * Здесь нормализуем: если передан slug (не ObjectId), резолвим по slug,
 * и ВОЗВРАЩАЕМ РЕСТОРАН С ЕГО `_id` (ObjectId), чтобы дочерние
 * резолверы (включая restaurantReviews) работали по правильному id.
 */
function resolveRestaurantByIdOrSlug(id) {
  if (!id) return null;
  const key = String(id).trim();
  if (!key) return null;
  return Restaurant.findOne({
    $or: isObjectId(key) ? [{ _id: key }, { slug: key }] : [{ slug: key }],
  });
}

export const restaurant = async (_p, { id }) => {
  return resolveRestaurantByIdOrSlug(id);
};

// ⭐ NEW: Restaurant.isOpenNow уже вызывается из resolvers/index.js через
// type-resolver. Оставляем, но расширяем родителя — теперь parent может
// прийти сразу из БД (Mongoose doc) ИЛИ из JSON после sub-апдейта.
export function isRestaurantOpenNow(r) {
  if (!r) return false;
  if (r.isOpenNow === true) return true;
  if (r.isOpenNow === false) return false;
  if (r.workingHours?.isAlwaysOpen) return true;
  if (!r.workingHours?.open || !r.workingHours?.close) return true;
  const now = new Date();
  const [oh, om] = r.workingHours.open.split(":").map(Number);
  const [ch, cm] = r.workingHours.close.split(":").map(Number);
  if (Number.isNaN(oh) || Number.isNaN(ch)) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  return closeMin > openMin
    ? nowMin >= openMin && nowMin < closeMin
    : nowMin >= openMin || nowMin < closeMin; // ночная смена через полночь
}
