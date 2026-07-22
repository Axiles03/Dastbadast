// dastbadast-multivendor-api/src/models/WalletTransaction.js
//
// ⭐ ФАЗА 2, пункт 6: раньше денег ресторана не существовало нигде, кроме
// on-the-fly агрегации по всей таблице Order на странице "Бухгалтерия"
// (см. resolvers/admin.js::accounting). Это не биллинг, это репортинг —
// нет истории, нет способа объяснить ресторану "откуда взялась именно
// эта цифра", нет защиты от двойного начисления.
//
// Это полноценный ledger: каждая запись — одна проводка. Текущий баланс
// ресторана (`Restaurant.balance`) — это ДЕНОРМАЛИЗОВАННЫЙ кэш суммы всех
// проводок, обновляется атомарно вместе с созданием проводки (см.
// lib/wallet.js::creditRestaurantForOrder), но источником правды остаётся
// эта коллекция — баланс всегда можно пересчитать заново как
// `sum(WalletTransaction.amount)` для сверки.

import mongoose from "mongoose";

const WalletTransactionSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      required: true,
      enum: ["RESTAURANT", "USER", "RIDER"],
      default: "RESTAURANT",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      index: true,
    },
    // ⭐ Idempotency key. Один заказ = максимум одна проводка типа
    // ORDER_PAYOUT/COMMISSION и максимум одна проводка типа
    // CANCELLATION_FEE. Уникальный индекс на (orderId, type) ниже —
    // защита от двойного начисления при retry/race в резолвере.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "ORDER_PAYOUT", // выручка ресторана за доставленный заказ (уже за вычетом комиссии)
        "COMMISSION", // комиссия платформы — отрицательная запись, для прозрачности отчёта
        "CANCELLATION_FEE", // компенсация ресторану за отменённый после ACCEPTED заказ
        "ADJUSTMENT", // ручная корректировка администратором (с обязательным note)
        "WITHDRAWAL",
        "TOPUP_STUB", // ⭐ NEW: пополнение-заглушка (клиент/курьер)
        "RIDER_DELIVERY_FEE", // ⭐ NEW: начисление курьеру за доставку
        "ORDER_HOLD", // ⭐ NEW: заморозка заказа (клиент/курьер)
        "ORDER_REFUND", // ⭐ NEW: возврат замороженных средств при отмене/автоистечении заказа
      ],
    },
    // ⭐ Знак задаёт направление: положительное — начисление, отрицательное —
    // списание. COMMISSION и WITHDRAWAL всегда <= 0, остальные обычно >= 0
    // (кроме ADJUSTMENT, который может быть любым).
    amount: { type: Number, required: true },
    // ⭐ Баланс СРАЗУ ПОСЛЕ применения этой проводки — денормализация ради
    // быстрого рендера истории без пересчёта на клиенте, источник правды
    // всё равно amount + restaurantId.
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: "", maxlength: 300 },
    // ⭐ Кто создал проводку — для ADJUSTMENT обязательно, иначе null
    // (проводка создана системой автоматически).
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

// ⭐ Ключевая защита от гонки/повторного вызова: один заказ не может
// породить два ORDER_PAYOUT (например, если confirmOrderReceived
// вызовется дважды подряд из-за retry на плохом Wi-Fi ресторана/клиента).
WalletTransactionSchema.index(
  { ownerType: 1, ownerId: 1, orderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { orderId: { $type: "objectId" } },
  },
);

WalletTransactionSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
// legacy-индекс оставляем на время миграции (используется старым кодом)
WalletTransactionSchema.index({ restaurantId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model(
  "WalletTransaction",
  WalletTransactionSchema,
);
