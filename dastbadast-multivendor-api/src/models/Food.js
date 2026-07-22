import mongoose from "mongoose";

/**
 * модификаторы блюд (размеры, соусы, добавки).
 *
 * Структура — аналог UberEats:
 *   optionGroups: [
 *     {
 *       title: "Размер",
 *       required: true,
 *       multiple: false,
 *       minSelect: 1,
 *       maxSelect: 1,
 *       options: [
 *         { title: "Маленькая 25 см", price: 0 },
 *         { title: "Большая 40 см",   price: 120 }
 *       ]
 *     },
 *     {
 *       title: "Доп. начинка",
 *       required: false,
 *       multiple: true,
 *       minSelect: 0,
 *       maxSelect: 3,
 *       options: [
 *         { title: "Пепперони", price: 40 },
 *         { title: "Грибы",     price: 30 }
 *       ]
 *     }
 *   ]
 *
 * Цена блюда в заказе = food.price + Σ(option.price) на момент заказа.
 */
const FoodOptionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    // ⭐ Цена как НАДБАВКА к базовой цене блюда (не полная).
    // 0 = бесплатная опция (например, "без лука").
    price: { type: Number, required: true, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    unavailableUntil: { type: Date, default: null, index: true },
  },
  { _id: true }, // ⭐ id нужен: при заказе сохраняем ссылку на конкретную опцию
);

const OptionGroupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 60 },
    // ⭐ Обязательная группа — клиент ОБЯЗАН выбрать хотя бы одну опцию.
    // Валидация — на уровне GraphQL-резолвера (см. Шаг 5 в `placeOrder`).
    required: { type: Boolean, default: false },
    // ⭐ multiple: false = radio-button (single choice), true = checkbox.
    multiple: { type: Boolean, default: false },
    // ⭐ minSelect/maxSelect — только при multiple=true.
    minSelect: { type: Number, default: 0, min: 0 },
    maxSelect: { type: Number, default: 1, min: 1 },
    // ⭐ Сортировка опций внутри группы (для UI).
    sortOrder: { type: Number, default: 0 },
    options: { type: [FoodOptionSchema], default: [] },
  },
  { _id: true },
);

const FoodSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    image: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    // ⭐⭐новое поле — массив групп модификаторов
    optionGroups: { type: [OptionGroupSchema], default: [] },
    isVegetarian: { type: Boolean, default: false },
    isVegan: { type: Boolean, default: false },
    spiceLevel: { type: Number, default: 0, min: 0, max: 3 }, // 0=нет,1=слабо,2=средне,3=остро
    allergens: { type: [String], default: [] }, // напр. ["nuts","dairy","gluten","seafood"]
  },
  { timestamps: true },
);

// ⭐⭐составной индекс для типового запроса
// (блюда конкретного ресторана в категории, только активные)
FoodSchema.index({ restaurantId: 1, categoryId: 1, isActive: 1 });

// ⭐⭐⭐ ВАЛИДАЦИЯ НА УРОВНЕ СХЕМЫ: защита от кривых данных
// (бизнес-инвариант: maxSelect >= minSelect, multiple → min <= max <= options.length)
FoodSchema.pre("validate", function (next) {
  if (!this.optionGroups || this.optionGroups.length === 0) return next();

  for (const group of this.optionGroups) {
    if (group.maxSelect < group.minSelect) {
      return next(
        new Error(
          `OptionGroup "${group.title}": maxSelect (${group.maxSelect}) < minSelect (${group.minSelect})`,
        ),
      );
    }
    if (group.options.length > 0 && group.maxSelect > group.options.length) {
      return next(
        new Error(
          `OptionGroup "${group.title}": maxSelect (${group.maxSelect}) > options.length (${group.options.length})`,
        ),
      );
    }
  }
  next();
});

export const Food = mongoose.model("Food", FoodSchema);
