import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { Food } from "../models/Food.js";
import { Restaurant } from "../models/Restaurant.js";
import { calculateServerDeliveryPrice } from "../services/delivery-price.service.js";

/**
 * ⭐⭐⭐ ШАГ 2: cart resolvers.
 *
 * Реализует «UberEats-стиль» корзины:
 *   1. Сервер — единственный источник истины по ценам и доступности.
 *   2. Один ресторан на корзину (мульти-ресторанные корзины НЕ поддерживаются).
 *   3. Merge-логика: при логине гостя его локальная корзина сливается с серверной
 *      по ключу (foodId + sortedOptionIds).
 *   4. TTL = 30 дней — авто-очистка «забытых» корзин.
 *
 * Клиентский flow (реализуется в Шаге 5):
 *   - Гость: работает локально (cart-context), saveCart вызывается ПОСЛЕ логина.
 *   - Юзер: при mount — getCart(); при изменении — saveCart(input);
 *   - Logout: clearCart (опционально, обычно — сохраняем для повторного входа).
 */

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.user;
}

/**
 * ⭐ Детерминированный ключ позиции для merge.
 * Один и тот же (foodId, options) → одна позиция, quantity суммируется.
 * Сортировка optionId гарантирует, что порядок опций в массиве
 * не влияет на ключ ([{a,b}] и [{b,a}] — это одна и та же позиция).
 */
function cartItemKey(item) {
  const optIds = (item.selectedOptions || [])
    .map((o) => String(o.optionId))
    .sort()
    .join(",");
  return `${item.foodId}:${optIds}`;
}

/**
 * ⭐⭐⭐ Серверная валидация и расчёт цены.
 *
 * КРИТИЧНО: сервер — единственный источник истины по ценам.
 * Клиент НЕ МОЖЕТ прислать `price: 0` — мы перезаписываем из БД.
 *
 * Проверяет:
 *   1. Ресторан существует и активен
 *   2. Каждое блюдо существует, активно, доступно и принадлежит ресторану
 *   3. Каждая выбранная опция существует и доступна
 *
 * Бросает GraphQLError с кодами, понятными клиенту.
 */
async function validateAndPriceItems(inputItems, restaurantId) {
  if (!Array.isArray(inputItems) || inputItems.length === 0) return [];

  // 1. Ресторан
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) {
    throw new GraphQLError(`Restaurant not found: ${restaurantId}`, {
      extensions: { code: "RESTAURANT_NOT_FOUND" },
    });
  }
  if (!restaurant.isAvailable) {
    throw new GraphQLError("Restaurant temporarily unavailable", {
      extensions: { code: "RESTAURANT_UNAVAILABLE" },
    });
  }

  // 2. Все блюда одним запросом (anti-N+1)
  const foodIds = inputItems.map((i) => i.foodId);
  const foods = await Food.find({
    _id: { $in: foodIds },
    restaurantId,
    isActive: true,
    isAvailable: true,
  }).lean();

  const foodMap = new Map(foods.map((f) => [String(f._id), f]));

  // 3. Сборка валидированных позиций с серверными ценами
  const validated = [];
  for (const input of inputItems) {
    const food = foodMap.get(String(input.foodId));
    if (!food) {
      throw new GraphQLError(
        `Food unavailable or doesn't belong to this restaurant: ${input.foodId}`,
        { extensions: { code: "FOOD_UNAVAILABLE" } },
      );
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new GraphQLError(`Invalid quantity for food: ${input.foodId}`, {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    // 4. Сбор опций → расчёт надбавки
    let optionsTotal = 0;
    const selectedOptionsResolved = [];
    for (const opt of input.selectedOptions || []) {
      const group = (food.optionGroups || []).find(
        (g) => String(g._id) === String(opt.groupId),
      );
      if (!group) {
        // Группа удалена — это критическая ошибка, корзина невалидна
        throw new GraphQLError(
          `Option group not found: ${opt.groupId} for food "${food.title}"`,
          { extensions: { code: "MODIFIER_UNAVAILABLE" } },
        );
      }
      const option = (group.options || []).find(
        (o) => String(o._id) === String(opt.optionId),
      );
      if (!option || option.isAvailable === false) {
        throw new GraphQLError(
          `Option not available: ${opt.optionId} in group "${group.title}"`,
          { extensions: { code: "MODIFIER_UNAVAILABLE" } },
        );
      }
      selectedOptionsResolved.push({
        groupId: group._id,
        groupTitle: group.title,
        optionId: option._id,
        optionTitle: option.title,
        price: option.price,
      });
      optionsTotal += option.price;
    }

    validated.push({
      foodId: food._id,
      title: food.title,
      image: food.image || "",
      description: food.description || "",
      basePrice: food.price,
      optionsTotal: +optionsTotal.toFixed(2),
      price: +(food.price + optionsTotal).toFixed(2),
      quantity: input.quantity,
      selectedOptions: selectedOptionsResolved,
    });
  }
  return validated;
}

/**
 * ⭐ Merge двух списков позиций по cartItemKey.
 * - Если ключ совпал → суммируем quantity
 * - Если нового ключа нет → добавляем как есть
 * - Исходный порядок не сохраняется (это OK для корзины)
 */
function mergeCartItems(existingItems, incomingItems) {
  const map = new Map();
  for (const item of existingItems) {
    map.set(cartItemKey(item), { ...item });
  }
  for (const item of incomingItems) {
    const key = cartItemKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

/* ================== QUERIES ================== */

/**
 * Query.getCart → Cart | null
 * Возвращает корзину авторизованного пользователя или null,
 * если пользователь ещё не создавал корзину.
 * Клиент сам решит, показать пустое состояние или нет.
 */
export const getCart = async (_p, _a, ctx) => {
  const user = requireUser(ctx);
  return await Cart.findOne({ userId: user._id });
};

/* ================== MUTATIONS ================== */

/**
 * Mutation.saveCart → Cart!
 *
 * Главный метод синхронизации. Вызывается:
 *   1. После логина гостя (merge его локальной корзины с серверной)
 *   2. При каждом изменении корзины (add/remove/qty change)
 *   3. При смене ресторана (replace)
 *
 * ВАЖНО: семантика — «полная замена + merge»:
 *   - Клиент шлёт ПОЛНУЮ желаемую корзину (не дельту)
 *   - Сервер валидирует, пересчитывает цены и сливает с существующей
 */
export const saveCart = async (_p, { input }, ctx) => {
  const user = requireUser(ctx);

  // 1. Валидация входа
  if (input.restaurantId && !mongoose.isValidObjectId(input.restaurantId)) {
    throw new GraphQLError("Invalid restaurantId", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // 2. Если есть items — restaurantId обязателен + валидация по серверу
  let validatedItems = [];
  if (Array.isArray(input.items) && input.items.length > 0) {
    if (!input.restaurantId) {
      throw new GraphQLError("restaurantId is required when cart has items", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    validatedItems = await validateAndPriceItems(
      input.items,
      input.restaurantId,
    );
  }

  // 3. Найти существующую корзину
  const existing = await Cart.findOne({ userId: user._id });

  // 4. Логика merge / replace
  let finalItems = [];
  let finalRestaurantId = input.restaurantId
    ? new mongoose.Types.ObjectId(input.restaurantId)
    : null;
  let finalRestaurantName = input.restaurantName || "";

  if (!existing) {
    // ⭐ Нет существующей — создаём с нуля
    finalItems = validatedItems;
  } else {
    const existingRestId = existing.restaurantId
      ? String(existing.restaurantId)
      : null;
    const incomingRestId = input.restaurantId
      ? String(input.restaurantId)
      : null;

    if (existingRestId && incomingRestId && existingRestId !== incomingRestId) {
      // ⭐⭐⭐ Другой ресторан — полная замена (UberEats правило).
      // Мульти-ресторанные корзины НЕ поддерживаем — это огромный tech-debt
      // (нужно разделять заказы, delivery fee, payment и т.д.).
      finalItems = validatedItems;
      finalRestaurantId = input.restaurantId
        ? new mongoose.Types.ObjectId(input.restaurantId)
        : null;
      finalRestaurantName =
        input.restaurantName || existing.restaurantName || "";
    } else {
      // ⭐⭐⭐ Тот же ресторан (или существующая была пустая) — merge.
      // Суммируем quantity по (foodId + sortedOptionIds).
      finalItems = mergeCartItems(existing.items || [], validatedItems);
      finalRestaurantId = incomingRestId
        ? new mongoose.Types.ObjectId(incomingRestId)
        : existing.restaurantId;
      finalRestaurantName =
        input.restaurantName || existing.restaurantName || "";
    }
  }

  // 5. Upsert (атомарно, без транзакции — конфликты маловероятны,
  //    cart у одного userId)
  const updated = await Cart.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        items: finalItems,
        // updatedAt — Mongoose обновит автоматически (timestamps: true)
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  return updated;
};

/**
 * ⭐⭐⭐ ШАГ 4: новый query для cart-ui.
 *
 * Клиент вызывает его при выборе адреса в корзине, чтобы отобразить
 * предварительную стоимость доставки. Не требует наличия корзины —
 * работает по restaurantId + addressId.
 *
 * ⭐ ОТЛИЧИЕ ОТ placeOrder: estimateDelivery НЕ сохраняет ничего, не проверяет
 * минимальную сумму, не публикует события. Только возвращает цену.
 */
export const estimateDelivery = async (
  _p,
  { restaurantId, addressId },
  ctx,
) => {
  // ⭐ НЕ требуем ctx.user, если указан userId в input — но в нашем случае
  // мы берём userId из auth-context (для безопасности).
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  try {
    const result = await calculateServerDeliveryPrice({
      restaurantId,
      addressId,
      userId: ctx.user._id,
    });
    return {
      available: true,
      deliveryPrice: result.deliveryPrice,
      breakdown: result.deliveryBreakdown,
      currency: result.currency,
      currencySymbol: result.currencySymbol,
      error: null,
    };
  } catch (e) {
    return {
      available: false,
      deliveryPrice: null,
      breakdown: null,
      currency: null,
      currencySymbol: null,
      error: e?.message || "Delivery unavailable",
    };
  }
};

export const clearCart = async (_p, _a, ctx) => {
  const u = requireUser(ctx);
  await Cart.deleteOne({ userId: u._id });
  return true;
};
