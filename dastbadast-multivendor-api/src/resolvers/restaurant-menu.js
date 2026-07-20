// dastbadast-multivendor-api/src/resolvers/restaurant-menu.js
import { GraphQLError } from "graphql";
import { Category } from "../models/Category.js";
import { Food } from "../models/Food.js";
import { Restaurant } from "../models/Restaurant.js"; // ⭐ ШАГ 5

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
  return food;
};

export const updateMyRestaurant = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
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
  return true;
};
