import { GraphQLError } from "graphql";
import { Category } from "../models/Category.js";
import { Food } from "../models/Food.js";

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

export const deleteFood = async (_p, { id }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  food.isActive = false;
  food.isAvailable = false;
  await food.save();
  return true;
};
