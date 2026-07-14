import mongoose from "mongoose";

const RestaurantReviewSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ⭐ опциональная ссылка на заказ — для "verified review"
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    userName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);

// Один review от пользователя на ресторан (upsert)
RestaurantReviewSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });

export const RestaurantReview = mongoose.model(
  "RestaurantReview",
  RestaurantReviewSchema,
);

