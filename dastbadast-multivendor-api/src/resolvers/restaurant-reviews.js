import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { RestaurantReview } from "../models/RestaurantReview.js";
import { Restaurant } from "../models/Restaurant.js";

async function recalcRestaurantRating(restaurantId) {
  const stats = await RestaurantReview.aggregate([
    { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const row = stats[0];
  const averageRating = row ? +row.avg.toFixed(2) : 0;
  const totalRatings = row?.count || 0;
  await Restaurant.findByIdAndUpdate(restaurantId, {
    averageRating,
    totalRatings,
  });
  return { averageRating, totalRatings };
}

async function resolveRestaurantObjectId(idOrSlug) {
  if (!idOrSlug) return null;
  if (mongoose.isValidObjectId(idOrSlug)) {
    // это уже валидный ObjectId
    return idOrSlug;
  }
  const r = await Restaurant.findOne({ slug: idOrSlug }).select("_id").lean();
  return r?._id ?? null;
}

export const restaurantReviews = async (_p, { restaurantId }) => {
  const objectId = await resolveRestaurantObjectId(restaurantId);
  if (!objectId) return [];
  return RestaurantReview.find({ restaurantId: objectId })
    .sort({ createdAt: -1 })
    .limit(20);
};

export const addRestaurantReview = async (_p, { input }, ctx) => {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  const restaurant = await Restaurant.findById(input.restaurantId);
  if (!restaurant) {
    throw new GraphQLError("Restaurant not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new GraphQLError("Rating must be 1..5", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const comment = (input.comment || "").trim();
  if (!comment) {
    throw new GraphQLError("Comment is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // upsert: один review на пользователя
  const existing = await RestaurantReview.findOne({
    restaurantId: input.restaurantId,
    userId: ctx.user._id,
  });
  let review;
  if (existing) {
    existing.rating = rating;
    existing.comment = comment;
    review = await existing.save();
  } else {
    review = await RestaurantReview.create({
      restaurantId: input.restaurantId,
      userId: ctx.user._id,
      userName: ctx.user.name || "",
      rating,
      comment,
      orderId: input.orderId ?? null,
    });
  }
  const agg = await recalcRestaurantRating(input.restaurantId);
  return { review, ...agg };
};

export const foodRatingStats = (parent) => {
  // ⚠️ Этот helper уже определён в food-review.js — оставляем его там,
  // здесь только переэкспортируем для удобства. Если у вас он не
  // переэкспортирован, не дублируйте.
};
