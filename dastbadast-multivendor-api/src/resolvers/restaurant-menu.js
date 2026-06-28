import { GraphQLError } from 'graphql';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';

function requireRestaurant(ctx) {
  if (!ctx.restaurant) {
    throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return ctx.restaurant;
}

async function assertCategoryOwned(categoryId, restaurantId) {
  const cat = await Category.findById(categoryId);
  if (!cat) {
    throw new GraphQLError('Категория не найдена', { extensions: { code: 'NOT_FOUND' } });
  }
  if (cat.restaurantId.toString() !== restaurantId.toString()) {
    throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
  }
  return cat;
}

async function assertFoodOwned(foodId, restaurantId) {
  const food = await Food.findById(foodId);
  if (!food) {
    throw new GraphQLError('Блюдо не найдено', { extensions: { code: 'NOT_FOUND' } });
  }
  if (food.restaurantId.toString() !== restaurantId.toString()) {
    throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
  }
  return food;
}

export const createCategory = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const title = (input.title || '').trim();
  if (!title) {
    throw new GraphQLError('Название категории обязательно', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return Category.create({
    title,
    image: input.image || '',
    restaurantId: r._id,
  });
};

export const updateCategory = async (_p, { id, input }, ctx) => {
  const r = requireRestaurant(ctx);
  const cat = await assertCategoryOwned(id, r._id);
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new GraphQLError('Название категории обязательно', { extensions: { code: 'BAD_USER_INPUT' } });
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
    throw new GraphQLError('Сначала удалите или перенесите блюда из категории', {
      extensions: { code: 'BAD_STATE' },
    });
  }
  await Category.findByIdAndDelete(id);
  return true;
};

export const createFood = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  if (!input.categoryId) {
    throw new GraphQLError('Категория обязательна', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const title = (input.title || '').trim();
  if (!title) {
    throw new GraphQLError('Название блюда обязательно', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const price = parseFloat(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new GraphQLError('Укажите корректную цену', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  await assertCategoryOwned(input.categoryId, r._id);
  return Food.create({
    title,
    description: (input.description || '').trim(),
    image: input.image || '',
    price: +price.toFixed(2),
    categoryId: input.categoryId,
    restaurantId: r._id,
    isActive: true,
    isAvailable: true,
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
      throw new GraphQLError('Название блюда обязательно', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    food.title = title;
  }
  if (input.description !== undefined) food.description = input.description;
  if (input.image !== undefined) food.image = input.image;
  if (input.price !== undefined) {
    const price = parseFloat(input.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new GraphQLError('Укажите корректную цену', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    food.price = +price.toFixed(2);
  }
  if (typeof input.isAvailable === 'boolean') food.isAvailable = input.isAvailable;
  if (typeof input.isActive === 'boolean') food.isActive = input.isActive;
  await food.save();
  return food;
};

export const deleteFood = async (_p, { id }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  food.isActive = false;
  food.isAvailable = false;
  await food.save();
  return true;
};
