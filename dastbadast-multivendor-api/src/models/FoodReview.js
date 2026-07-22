import mongoose from "mongoose";

const FoodReviewSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // опциональная ссылка на заказ.
    // Если указана — отзыв считается «верифицированным покупателем».
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    userName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);

// Один отзыв от пользователя на блюдо (вне зависимости от заказов)
FoodReviewSchema.index({ foodId: 1, userId: 1 }, { unique: true });

export const FoodReview = mongoose.model("FoodReview", FoodReviewSchema);
