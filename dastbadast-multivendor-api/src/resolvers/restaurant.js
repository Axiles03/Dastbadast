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

  // 1) Валидный ObjectId → ищем по _id (под try/catch от CastError)
  if (isObjectId(key)) {
    try {
      const byId = await Restaurant.findById(key);
      if (byId) return byId;
    } catch {
      /* упало — едем дальше к slug */
    }
  }

  // 2) Слаг (для URL вида /restaurant/chayhana-1)
  const bySlug = await Restaurant.findOne({ slug: key });
  if (bySlug) return bySlug;

  // 3) Ничего — null без выброса
  return null;
};
