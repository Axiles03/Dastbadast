import mongoose from "mongoose";

/**
 * ⭐⭐⭐ ШАГ 2: подсхема выбранной опции модификатора в корзине.
 *
 * Дубликат OrderItemOptionSchema из Order.js (Шаг 1) — намеренно,
 * чтобы избежать циклических импортов и не ломать существующий Order.js.
 * Структура 1:1 — в Шаге 5 (placeOrder refactor) можно вынести в shared.
 */
const CartItemOptionSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, required: true },
    groupTitle: { type: String, required: true }, // снапшот имени
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    optionTitle: { type: String, required: true }, // снапшот имени
    price: { type: Number, required: true, min: 0 }, // снапшот надбавки
  },
  { _id: false },
);

/**
 * ⭐⭐⭐ ШАГ 2: подсхема позиции корзины.
 *
 * Зеркало OrderItemSchema из Order.js (Шаг 1) — структура одинаковая,
 * чтобы placeOrder мог атомарно «перелить» корзину в Order без
 * трансформаций. Разница только в том, что у корзины нет deliveryAddress,
 * rider, статуса и timestamps.
 */
const CartItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    image: { type: String, default: "", maxlength: 1000 },
    description: { type: String, default: "", maxlength: 1000 },
    // ⭐ Снапшот цены на момент добавления (Шаг 1: base + options + total)
    basePrice: { type: Number, required: true, min: 0 },
    optionsTotal: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 99 },
    // ⭐ Выбранные модификаторы (Шаг 1) — снапшот с title и price
    selectedOptions: { type: [CartItemOptionSchema], default: [] },
  },
  { _id: false },
);

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // ⭐ unique → один пользователь = одна корзина. Не нужно искать по массиву.
      unique: true,
      index: true,
    },
    // ⭐ Ресторан, к которому относится корзина.
    // null допустим только для пустой корзины. Логика в resolver проверяет,
    // что при наличии items restaurantId обязателен.
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      index: true,
    },
    restaurantName: { type: String, default: "", maxlength: 120 },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true },
);

/**
 * ⭐⭐⭐ ШАГ 2: TTL-индекс.
 *
 * Удаляет неактивные корзины через 30 дней.
 * Решает задачу "забытых" корзин от неавторизованных / потерявших сессию юзеров.
 * Активная корзина (пользователь только что открыл приложение → saveCart обновляет
 * updatedAt) — НЕ удалится.
 */
CartSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 дней
    name: "cart_ttl_index",
  },
);

/**
 * ⭐ Виртуальное поле: итоговая сумма за позицию (без delivery fee).
 * Не хранится в БД, вычисляется на лету через toJSON.
 */
CartItemSchema.virtual("lineTotal").get(function () {
  return +((this.basePrice + this.optionsTotal) * this.quantity).toFixed(2);
});
CartItemSchema.set("toJSON", { virtuals: true });
CartItemSchema.set("toObject", { virtuals: true });

export const Cart = mongoose.model("Cart", CartSchema);
