// dastbadast-multivendor-api/src/lib/wallet.js
//
// ⭐ ФАЗА 3: обобщённый леджер — раньше это была логика только для
// ресторана (см. историю ниже), теперь та же механика (атомарный $inc +
// идемпотентная проводка через уникальный индекс) работает для любого
// владельца: RESTAURANT / USER / RIDER.
//
// Идемпотентность достигается не через "проверить и потом вставить"
// (это race condition), а через уникальный индекс
// { ownerType: 1, ownerId: 1, orderId: 1, type: 1 } в WalletTransaction —
// просто ловим ошибку дубликата (code 11000) и трактуем её как
// "уже начислено, ничего не делаем".

import { Restaurant } from "../models/Restaurant.js";
import { User } from "../models/User.js";
import { Rider } from "../models/Rider.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { debugWarn } from "../debug-log.js";

const DUPLICATE_KEY_ERROR = 11000;

// ⭐ Владелец → модель Mongoose. Единственное место, которое знает про
// это соответствие — если появится новый тип владельца, менять только тут.
const OWNER_MODELS = {
  RESTAURANT: Restaurant,
  USER: User,
  RIDER: Rider,
};

function ownerModelFor(ownerType) {
  const Model = OWNER_MODELS[ownerType];
  if (!Model) {
    throw new Error(
      `postWalletTransaction: неизвестный ownerType "${ownerType}"`,
    );
  }
  return Model;
}

/**
 * Атомарно создаёт проводку и обновляет denormalized balance владельца.
 * Возвращает null, если проводка такого типа для этого (owner, orderId)
 * уже существует (повторный вызов — не ошибка, а ожидаемый идемпотентный кейс).
 */
async function postWalletTransaction({
  ownerType,
  ownerId,
  orderId = null,
  type,
  amount,
  note = "",
  createdByAdminId = null,
}) {
  const Model = ownerModelFor(ownerType);

  // ⭐ $inc атомарен на уровне MongoDB — два параллельных начисления не
  // затрут друг друга, в отличие от `owner.balance += amount; save()`.
  const owner = await Model.findByIdAndUpdate(
    ownerId,
    { $inc: { balance: amount } },
    { new: true },
  );
  if (!owner) {
    debugWarn("wallet", "postWalletTransaction: owner not found", {
      ownerType,
      ownerId,
    });
    return null;
  }

  try {
    const tx = await WalletTransaction.create({
      ownerType,
      ownerId,
      // ⭐ LEGACY: заполняем restaurantId, чтобы старый код
      // (admin.js::accounting и т.п.) продолжал работать без изменений,
      // пока не переведём его на ownerType/ownerId (см. TODO в admin.js).
      restaurantId: ownerType === "RESTAURANT" ? ownerId : null,
      orderId,
      type,
      amount,
      balanceAfter: owner.balance,
      note,
      createdByAdminId,
    });
    return tx;
  } catch (e) {
    if (e?.code === DUPLICATE_KEY_ERROR) {
      // ⭐ Уже была проводка этого типа для этого заказа — откатываем
      // только что сделанный $inc, чтобы не задвоить начисление.
      await Model.findByIdAndUpdate(ownerId, { $inc: { balance: -amount } });
      return null;
    }
    // Непредвиденная ошибка — тоже откатываем $inc, чтобы не оставить
    // баланс без соответствующей проводки в ledger.
    await Model.findByIdAndUpdate(ownerId, { $inc: { balance: -amount } });
    throw e;
  }
}

/**
 * Начисление ресторану за доставленный заказ: выручка минус комиссия.
 * Комиссия — персональная (Restaurant.commissionPercent), с fallback на
 * глобальный Configuration.taxPercent, если на ресторане не задана.
 *
 * Вызывать ОДИН раз, из confirmOrderReceived, сразу после
 * order.orderStatus = "DELIVERED".
 */
export async function creditRestaurantForOrder(
  order,
  restaurant,
  taxPercentFallback,
) {
  const revenue = order.amounts?.subtotal ?? 0;
  if (revenue <= 0) return; // защита от заказов с нулевой суммой (промо/тест)

  const commissionPercent =
    typeof restaurant.commissionPercent === "number"
      ? restaurant.commissionPercent
      : taxPercentFallback;

  const commission = +(revenue * (commissionPercent / 100)).toFixed(2);
  const payout = +(revenue - commission).toFixed(2);

  await postWalletTransaction({
    ownerType: "RESTAURANT",
    ownerId: restaurant._id,
    orderId: order._id,
    type: "ORDER_PAYOUT",
    amount: payout,
    note: `Заказ #${order._id.toString().slice(-6)}`,
  });

  if (commission > 0) {
    await postWalletTransaction({
      ownerType: "RESTAURANT",
      ownerId: restaurant._id,
      orderId: order._id,
      type: "COMMISSION",
      amount: -commission,
      note: `Комиссия платформы ${commissionPercent}% с заказа #${order._id.toString().slice(-6)}`,
    });
  }
}

/**
 * Компенсация ресторану за заказ, который он уже начал готовить
 * (ACCEPTED/PREPARING), но который отменил клиент или курьер.
 */
export async function compensateRestaurantForCancellation(
  order,
  restaurant,
  amount,
  note,
) {
  if (amount <= 0) return;
  await postWalletTransaction({
    ownerType: "RESTAURANT",
    ownerId: restaurant._id,
    orderId: order._id,
    type: "CANCELLATION_FEE",
    amount,
    note,
  });
}

/**
 * ⭐ NEW: начисление курьеру за доставленный заказ (deliveryFee).
 * сама функция, чтобы леджер уже поддерживал этот тип начислений.
 */
export async function creditRiderForDelivery(order, rider) {
  const fee = order.amounts?.deliveryFee ?? 0;
  if (fee <= 0) return;

  await postWalletTransaction({
    ownerType: "RIDER",
    ownerId: rider._id,
    orderId: order._id,
    type: "RIDER_DELIVERY_FEE",
    amount: fee,
    note: `Доставка заказа #${order._id.toString().slice(-6)}`,
  });
}

/**
 * ⭐ NEW: заморозка средств пользователя при оформлении заказа с оплатой
 * BALANCE. Атомарная проверка "хватает ли денег" + списание — ОДНИМ
 * запросом (findOneAndUpdate с условием balance >= amount в фильтре),
 * а не "прочитать баланс, проверить в коде, потом списать" — иначе два
 * параллельных заказа от одного пользователя могли бы оба пройти проверку
 * по устаревшему значению баланса и увести его в минус (race condition).
 *
 * Бросает Error с кодом INSUFFICIENT_BALANCE, если денег не хватает —
 * резолвер placeOrder должен поймать это и отменить только что созданный
 */
export async function holdUserBalanceForOrder(order, userId) {
  const amount = order.amounts?.total ?? 0;
  if (amount <= 0) return null;

  const user = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
  if (!user) {
    const err = new Error("Недостаточно средств на балансе");
    err.code = "INSUFFICIENT_BALANCE";
    throw err;
  }

  try {
    const tx = await WalletTransaction.create({
      ownerType: "USER",
      ownerId: userId,
      orderId: order._id,
      type: "ORDER_HOLD",
      amount: -amount,
      balanceAfter: user.balance,
      note: `Оплата заказа #${order._id.toString().slice(-6)}`,
    });
    return tx;
  } catch (e) {
    if (e?.code === DUPLICATE_KEY_ERROR) {
      // ⭐ Уже была заморозка для этого заказа (retry/повторный вызов) —
      // откатываем только что сделанный $inc, ничего не задваиваем.
      await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
      return null;
    }
    await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
    throw e;
  }
}

/**
 * ⭐ NEW: возврат замороженных средств пользователю — при отмене заказа
 * рестораном или автоистечении PENDING (см. order-actions.js,
 * lib/order-timeouts.js). Идемпотентно за счёт того же уникального индекса
 * (ownerType, ownerId, orderId, type) в WalletTransaction — повторный вызов
 * (например, если cancelOrder и expireIfPending случайно пересеклись бы
 * гонкой) просто ничего не сделает во второй раз, а не удвоит возврат.
 */
export async function refundUserForOrder(order, note) {
  const amount = order.amounts?.total ?? 0;
  if (amount <= 0) return null;

  return postWalletTransaction({
    ownerType: "USER",
    ownerId: order.userId,
    orderId: order._id,
    type: "ORDER_REFUND",
    amount,
    note:
      note ?? `Возврат за отменённый заказ #${order._id.toString().slice(-6)}`,
  });
}

/**
 * ⭐ NEW: пополнение баланса — ЗАГЛУШКА. Реального платёжного шлюза
 * (эквайринг/Alif/DC и т.п.) здесь нет — просто плюсуем баланс и пишем
 * проводку, чтобы фронт мог показать рабочий флоу "Пополнить".
 * Заменить на реальный платёж — отдельная задача (см. итоговый список
 * в конце), сюда только добавить проверку статуса платежа перед вызовом.
 */
export async function topUpBalanceStub(
  ownerType,
  ownerId,
  amount,
  note = "Пополнение баланса",
) {
  if (amount <= 0) {
    throw new Error("Сумма пополнения должна быть положительной");
  }
  if (ownerType !== "USER" && ownerType !== "RIDER") {
    throw new Error(
      `topUpBalanceStub: пополнение недоступно для ownerType "${ownerType}"`,
    );
  }
  return postWalletTransaction({
    ownerType,
    ownerId,
    orderId: null, // пополнение не привязано к заказу → идемпотентность тут не защищает от даблклика, см. примечание в резолвере
    type: "TOPUP_STUB",
    amount,
    note,
  });
}

/**
 * ⭐ NEW: история проводок владельца, для экрана "Баланс" на клиенте/курьере.
 */
export async function listWalletTransactions(
  ownerType,
  ownerId,
  { limit = 20, offset = 0 } = {},
) {
  return WalletTransaction.find({ ownerType, ownerId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
}
