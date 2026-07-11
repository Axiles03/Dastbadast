// dastbadast-multivendor-api/src/resolvers/restaurant.js
import { Restaurant } from "../models/Restaurant.js";

export const restaurants = async (_p, { zoneId }) => {
  const filter = { isAvailable: true };
  if (zoneId) filter.zoneId = zoneId;
  return Restaurant.find(filter).sort({ createdAt: -1 });
};

function isObjectId(str) {
  return typeof str === "string" && /^[a-f0-9]{24}$/i.test(str);
}

export const restaurant = async (_p, { id }) => {
  if (!id) return null;
  const key = String(id).trim();
  if (!key) return null;

  if (isObjectId(key)) {
    try {
      const byId = await Restaurant.findById(key);
      if (byId) return byId;
    } catch {
      /* упало — едем дальше к slug */
    }
  }

  const bySlug = await Restaurant.findOne({ slug: key });
  if (bySlug) return bySlug;

  return null;
};

// ⭐ NEW: чистая функция, переиспользуется в type-резолвере Restaurant.isOpenNow
// (подключается в resolvers/index.js, см. ниже)
export function isRestaurantOpenNow(r) {
  if (r.workingHours?.isAlwaysOpen) return true;
  if (!r.workingHours?.open || !r.workingHours?.close) return true;
  const now = new Date();
  const [oh, om] = r.workingHours.open.split(":").map(Number);
  const [ch, cm] = r.workingHours.close.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  return closeMin > openMin
    ? nowMin >= openMin && nowMin < closeMin
    : nowMin >= openMin || nowMin < closeMin; // ночная смена через полночь
}
