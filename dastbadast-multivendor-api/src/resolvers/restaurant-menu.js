// dastbadast-multivendor-api/src/resolvers/restaurant-menu.js
import { GraphQLError } from "graphql";
import { Category } from "../models/Category.js";
import { Food } from "../models/Food.js";
import { Restaurant } from "../models/Restaurant.js"; // ⭐ ШАГ 5
import { pubsub, TOPICS } from "../pubsub.js";

function requireRestaurant(ctx) {
  if (!ctx.restaurant) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.restaurant;
}

async function assertCategoryOwned(categoryId, restaurantId) {
  const cat = await Category.findById(categoryId);
  if (!cat) {
    throw new GraphQLError("Категория не найдена", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (cat.restaurantId.toString() !== restaurantId.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  return cat;
}

async function assertFoodOwned(foodId, restaurantId) {
  const food = await Food.findById(foodId);
  if (!food) {
    throw new GraphQLError("Блюдо не найдено", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (food.restaurantId.toString() !== restaurantId.toString()) {
    throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
  }
  return food;
}

export const createCategory = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const title = (input.title || "").trim();
  if (!title) {
    throw new GraphQLError("Название категории обязательно", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return Category.create({
    title,
    image: input.image || "",
    restaurantId: r._id,
  });
};

export const updateCategory = async (_p, { id, input }, ctx) => {
  const r = requireRestaurant(ctx);
  const cat = await assertCategoryOwned(id, r._id);
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new GraphQLError("Название категории обязательно", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    cat.title = title;
  }
  if (input.image !== undefined) cat.image = input.image;
  await cat.save();
  return cat;
};

export const deleteCategory = async (_p, { id }, ctx) => {
  const r = requireRestaurant(ctx);
  await assertCategoryOwned(id, r._id);
  const count = await Food.countDocuments({ categoryId: id, isActive: true });
  if (count > 0) {
    throw new GraphQLError(
      "Сначала удалите или перенесите блюда из категории",
      {
        extensions: { code: "BAD_STATE" },
      },
    );
  }
  await Category.findByIdAndDelete(id);
  return true;
};

export const createFood = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  if (!input.categoryId) {
    throw new GraphQLError("Категория обязательна", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const title = (input.title || "").trim();
  if (!title) {
    throw new GraphQLError("Название блюда обязательно", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const price = parseFloat(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new GraphQLError("Укажите корректную цену", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  await assertCategoryOwned(input.categoryId, r._id);
  if (
    input.spiceLevel != null &&
    (input.spiceLevel < 0 || input.spiceLevel > 3)
  ) {
    throw new GraphQLError("spiceLevel должен быть от 0 до 3", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return Food.create({
    title,
    description: (input.description || "").trim(),
    image: input.image || "",
    price: +price.toFixed(2),
    categoryId: input.categoryId,
    restaurantId: r._id,
    isActive: true,
    isAvailable: true,
    isVegetarian: !!input.isVegetarian,
    isVegan: !!input.isVegan,
    spiceLevel: input.spiceLevel ?? 0,
    allergens: Array.isArray(input.allergens) ? input.allergens : [],
    optionGroups: Array.isArray(input.optionGroups) ? input.optionGroups : [],
  });
};

export const updateFood = async (_p, { id, input }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  const wasAvailable = food.isAvailable;
  if (input.categoryId) {
    await assertCategoryOwned(input.categoryId, r._id);
    food.categoryId = input.categoryId;
  }
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new GraphQLError("Название блюда обязательно", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    food.title = title;
  }
  if (input.description !== undefined) food.description = input.description;
  if (input.image !== undefined) food.image = input.image;
  if (input.price !== undefined) {
    const price = parseFloat(input.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new GraphQLError("Укажите корректную цену", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    food.price = +price.toFixed(2);
  }
  if (typeof input.isAvailable === "boolean")
    food.isAvailable = input.isAvailable;
  if (typeof input.isActive === "boolean") food.isActive = input.isActive;
  if (typeof input.isVegetarian === "boolean")
    food.isVegetarian = input.isVegetarian;
  if (typeof input.isVegan === "boolean") food.isVegan = input.isVegan;
  if (input.spiceLevel != null) {
    if (input.spiceLevel < 0 || input.spiceLevel > 3) {
      throw new GraphQLError("spiceLevel должен быть от 0 до 3", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    food.spiceLevel = input.spiceLevel;
  }
  if (Array.isArray(input.allergens)) food.allergens = input.allergens;
  if (Array.isArray(input.optionGroups)) food.optionGroups = input.optionGroups;
  await food.save();

  if (wasAvailable !== food.isAvailable) {
    pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
      subscriptionMenuAvailability: {
        foodId: food._id.toString(),
        restaurantId: r._id.toString(),
        isAvailable: food.isAvailable,
      },
    });
  }
  return food;
};

export const setFoodUnavailableUntil = async (
  _p,
  { id, minutesFromNow },
  ctx,
) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);

  if (!minutesFromNow || minutesFromNow <= 0) {
    throw new GraphQLError("minutesFromNow должен быть положительным", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  food.isAvailable = false;
  food.unavailableUntil = new Date(Date.now() + minutesFromNow * 60_000);
  await food.save();

  pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
    subscriptionMenuAvailability: {
      foodId: food._id.toString(),
      restaurantId: r._id.toString(),
      isAvailable: false,
    },
  });

  return food;
};

export const bulkSetFoodAvailability = async (
  _p,
  { foodIds, isAvailable },
  ctx,
) => {
  const r = requireRestaurant(ctx);

  if (!Array.isArray(foodIds) || foodIds.length === 0) {
    throw new GraphQLError("foodIds не может быть пустым", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (foodIds.length > 200) {
    throw new GraphQLError("Максимум 200 позиций за раз", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // ⭐ restaurantId в фильтре — защита от чужого меню (owner ресторана A
  // не может выключить блюда ресторана B, даже зная их id).
  const result = await Food.updateMany(
    { _id: { $in: foodIds }, restaurantId: r._id },
    { $set: { isAvailable, unavailableUntil: null } },
  );

  // ⭐ Одно событие на весь батч (не N событий на N блюд) — клиент,
  // слушающий MENU_AVAILABILITY_CHANGED, реагирует на batch-обновление
  // рефетчем меню целиком, а не точечным патчем состояния (это ок для
  // группового 86 — обычно происходит с частотой "раз в час", в отличие
  // от одиночного 86, где точечный патч важен для UX-скорости).
  pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
    subscriptionMenuAvailability: {
      foodId: null,
      restaurantId: r._id.toString(),
      isAvailable,
      bulk: true,
    },
  });

  return { modifiedCount: result.modifiedCount };
};

export const updateMyRestaurant = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const wasAvailable = r.isAvailable;
  if (input.minimumOrder != null) {
    if (input.minimumOrder < 0) {
      throw new GraphQLError("minimumOrder не может быть отрицательным", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    r.minimumOrder = input.minimumOrder;
  }
  if (typeof input.isAvailable === "boolean") r.isAvailable = input.isAvailable;
  if (input.workingHours) {
    r.workingHours = {
      open: input.workingHours.open ?? r.workingHours?.open ?? "09:00",
      close: input.workingHours.close ?? r.workingHours?.close ?? "23:00",
      isAlwaysOpen:
        input.workingHours.isAlwaysOpen ??
        r.workingHours?.isAlwaysOpen ??
        false,
    };
  }
  await r.save();

  if (wasAvailable !== r.isAvailable) {
    pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
      subscriptionMenuAvailability: {
        foodId: null,
        restaurantId: r._id.toString(),
        isAvailable: r.isAvailable,
      },
    });
  }
  return r;
};

/**
 * ⭐ ШАГ 5 (FIX): "Пятничный завал" — раньше ресторан мог влиять на общую
 * загрузку кухни только вручную, указывая prepTime на КАЖДЫЙ заказ отдельно
 * (см. acceptOrder в order-actions.js). Не было единого переключателя
 * "сейчас у нас перегрузка" — ни +N минут ко всем заказам разом, ни режима
 * "только предзаказы".
 *
 * extraPrepMinutes влияет на suggestedPrepTime в kitchenLoad (order.js) —
 * то есть на РЕКОМЕНДАЦИЮ в модалке принятия заказа, менеджер по-прежнему
 * выбирает финальное время сам. preOrdersOnly временно блокирует
 * немедленные заказы в placeOrder (order.js) — полноценный flow
 * "запланировать заказ на конкретное время" не входит в этот шаг и требует
 * отдельной фичи (поле scheduledFor в Order + отдельная очередь диспетчинга).
 */
export const setRestaurantBusyMode = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);

  if (
    input.extraPrepMinutes != null &&
    (input.extraPrepMinutes < 0 || input.extraPrepMinutes > 60)
  ) {
    throw new GraphQLError("extraPrepMinutes должно быть в диапазоне 0..60", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (typeof input.note === "string" && input.note.length > 200) {
    throw new GraphQLError("note не может быть длиннее 200 символов", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const updated = await Restaurant.findByIdAndUpdate(
    r._id,
    {
      $set: {
        "busyMode.enabled": input.enabled,
        "busyMode.extraPrepMinutes": input.enabled
          ? (input.extraPrepMinutes ?? 0)
          : 0,
        "busyMode.preOrdersOnly": input.enabled
          ? Boolean(input.preOrdersOnly)
          : false,
        "busyMode.note": input.enabled ? (input.note ?? "") : "",
        "busyMode.enabledAt": input.enabled ? new Date() : null,
      },
    },
    { new: true },
  );

  return updated;
};

export const deleteFood = async (_p, { id }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  food.isActive = false;
  food.isAvailable = false;
  await food.save();

  pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
    subscriptionMenuAvailability: {
      foodId: food._id.toString(),
      restaurantId: r._id.toString(),
      isAvailable: false,
    },
  });
  return true;
};
