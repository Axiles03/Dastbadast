import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { FoodReview } from '../models/FoodReview.js';
import { Food } from '../models/Food.js';

function requireUser(ctx) {
  if (!ctx.user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  return ctx.user;
}

export const foodReviews = async (_p, { foodId }) => {
  return FoodReview.find({ foodId }).sort({ createdAt: -1 }).limit(50);
};

export const addFoodReview = async (_p, { input }, ctx) => {
  const u = requireUser(ctx);
  const food = await Food.findById(input.foodId);
  if (!food || !food.isActive) {
    throw new GraphQLError('Блюдо не найдено', { extensions: { code: 'NOT_FOUND' } });
  }
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new GraphQLError('Рейтинг от 1 до 5', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const comment = (input.comment || '').trim();
  if (!comment) {
    throw new GraphQLError('Напишите комментарий к отзыву', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const User = (await import('../models/User.js')).User;
  const user = await User.findById(u._id);
  const existing = await FoodReview.findOne({ foodId: food._id, userId: u._id });
  if (existing) {
    existing.rating = rating;
    existing.comment = comment;
    existing.userName = user?.name || '';
    await existing.save();
    return existing;
  }
  return FoodReview.create({
    foodId: food._id,
    userId: u._id,
    userName: user?.name || '',
    rating,
    comment,
  });
};

export async function foodRatingStats(foodId) {
  const oid = typeof foodId === 'string' ? new mongoose.Types.ObjectId(foodId) : foodId;
  const rows = await FoodReview.aggregate([
    { $match: { foodId: oid } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (!rows.length) return { averageRating: 0, reviewCount: 0 };
  return {
    averageRating: +rows[0].avg.toFixed(1),
    reviewCount: rows[0].count,
  };
}
