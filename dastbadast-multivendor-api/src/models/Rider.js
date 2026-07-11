import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  { _id: false },
);

/**
 * ⭐⭐⭐ ШАГ 1: подсхема для истории оценок курьера.
 * Хранит сырые числа 1..5 — это позволяет легко
 * пересчитывать averageRating без отдельной агрегации.
 */
const RiderRatingSchema = new mongoose.Schema(
  {
    score: { type: Number, required: true, min: 1, max: 5 },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    // ⭐ В MVP не храним комментарий, но поле зарезервировано.
    comment: { type: String, default: "", maxlength: 280 },
    ratedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const RiderSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "", maxlength: 80 },
    phone: { type: String, default: "", maxlength: 32 },
    photo: { type: String, default: "" }, // ⭐⭐⭐ ШАГ 1: аватарка курьера (для UI)

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    available: { type: Boolean, default: true },

    location: {
      type: LocationSchema,
      default: () => ({ type: "Point", coordinates: [0, 0] }),
    },
    lastLocationAt: { type: Date, default: null },
    bearing: { type: Number, default: null },

    isActive: { type: Boolean, default: true },

    // ⭐⭐⭐ ШАГ 1: финансовый баланс курьера.
    // Накапливается при DELIVERED (в `markDelivered` / `markOrderReceived`).
    // Списывается при выплате (вне MVP — админ-операция).
    balance: { type: Number, default: 0, min: 0 },

    // ⭐⭐⭐ ШАГ 1: история оценок.
    // Ограничиваем размер массива (pre-validate ниже), чтобы
    // не разрастаться бесконечно (типичный кейс: 1 оценка на заказ).
    ratings: { type: [RiderRatingSchema], default: [] },

    // ⭐⭐⭐ ШАГ 1: денормализованные агрегаты.
    // Обновляются при добавлении оценки (см. `addRating` ниже).
    // Нужны для быстрых запросов в админке и клиенте.
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0, min: 0 },
    totalDeliveries: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

RiderSchema.index({ location: "2dsphere" });
// ⭐⭐⭐ ШАГ 1: индексы для типовых запросов
RiderSchema.index({ available: 1, isActive: 1 });
RiderSchema.index({ averageRating: -1 }); // топ-курьеры

// ⭐⭐⭐ ШАГ 1: ограничиваем размер массива ratings (FIFO).
// Максимум 500 последних оценок. Старые — вытесняются.
const MAX_RATINGS_KEPT = 500;
RiderSchema.pre("save", function (next) {
  if (this.ratings && this.ratings.length > MAX_RATINGS_KEPT) {
    this.ratings = this.ratings.slice(-MAX_RATINGS_KEPT);
  }
  next();
});

/**
 * ⭐⭐⭐ ШАГ 1: метод добавления оценки с авто-пересчётом агрегатов.
 * Используется в `confirmOrderReceived` (Шаг 5) и в админ-импорте.
 */
RiderSchema.methods.addRating = function (score, orderId = null, comment = "") {
  if (typeof score !== "number" || score < 1 || score > 5) {
    throw new Error("score must be 1..5");
  }
  this.ratings.push({ score, orderId, comment });

  // Пересчёт среднего
  const sum = this.ratings.reduce((s, r) => s + r.score, 0);
  this.averageRating = +(sum / this.ratings.length).toFixed(2);
  this.totalRatings = this.ratings.length;
  return this.save();
};

export const Rider = mongoose.model("Rider", RiderSchema);
