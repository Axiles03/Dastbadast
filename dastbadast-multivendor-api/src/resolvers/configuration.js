import { Configuration } from "../models/Configuration.js";
import { GraphQLError } from "graphql";
import { requireRole } from "../middleware/rbac.js";
import { invalidateCache } from "../middleware/cache.js";

// ⭐ ШАГ 4: импортируем дефолтные значения ставок из существующего модуля
// (НЕ создаём новые — переиспользуем DELIVERY_PRICING)
import { DELIVERY_PRICING } from "../utils/delivery-price.js";

// FIX: защита от race при cold start через upsert
async function getOrCreateSingleton() {
  try {
    const cfg = await Configuration.findByIdAndUpdate(
      "singleton",
      {
        // ⭐ ШАГ 4: при первом создании singleton заполняем дефолтными значениями ставок
        $setOnInsert: {
          _id: "singleton",
          deliveryBaseKm: DELIVERY_PRICING.baseKm,
          deliveryBasePrice: DELIVERY_PRICING.basePrice,
          deliveryPerKmPrice: DELIVERY_PRICING.perKmPrice,
          deliveryRate: DELIVERY_PRICING.basePrice, // legacy поле = базовая ставка
          taxPercent: 10,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return cfg;
  } catch (e) {
    if (e.code === 11000) {
      return Configuration.findById("singleton");
    }
    throw e;
  }
}

export const configuration = async () => {
  return getOrCreateSingleton();
};

export const updateConfiguration = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE"])(ctx);

  const allowed = [
    "currency",
    "currencySymbol",
    "taxPercent",
    "deliveryBaseKm",
    "deliveryBasePrice",
    "deliveryPerKmPrice",
    "testOtp",
    "waitCompensationFreeMinutes",
    "waitCompensationPerMinute",
  ];
  const update = {};
  for (const key of allowed) {
    if (input[key] !== undefined) update[key] = input[key];
  }

  const result = await Configuration.findByIdAndUpdate("singleton", update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  await invalidateCache("configuration");

  return result;
};
