import mongoose from "mongoose";

const ConfigurationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    currency: { type: String, default: "TJS" },
    currencySymbol: { type: String, default: "сом." },
    // обратной совместимости со старыми заказами/конфигами).
    deliveryRate: { type: Number, default: 0 },
    // Удерживается из выплат ресторану: payout = subtotal - (subtotal * taxPercent/100).
    // Клиент видит в чеке только: subtotal + deliveryFee. Налога сверху нет.
    taxPercent: { type: Number, default: 10 },
    // Динамические параметры цены доставки (Шаг 1):
    deliveryBaseKm: { type: Number, default: null },
    deliveryBasePrice: { type: Number, default: null },
    deliveryPerKmPrice: { type: Number, default: null },
    skipEmailVerification: { type: Boolean, default: true },
    skipMobileVerification: { type: Boolean, default: true },
    testOtp: { type: String, default: "123456" },

    // ⭐ Фаза 1 (аудит): компенсация курьеру за ожидание в ресторане.
    // Первые waitCompensationFreeMinutes — бесплатно (это нормальная часть
    // работы), сверх — waitCompensationPerMinute сомони/мин добавляется к
    // deliveryFee при переходе в PICKED. См. resolvers/rider.js.
    waitCompensationFreeMinutes: { type: Number, default: 7 },
    waitCompensationPerMinute: { type: Number, default: 1 },
  },
  { timestamps: true, _id: false },
);

export const Configuration = mongoose.model(
  "Configuration",
  ConfigurationSchema,
);
