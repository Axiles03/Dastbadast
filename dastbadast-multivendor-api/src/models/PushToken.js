// dastbadast-multivendor-api/src/models/PushToken.js
import mongoose from "mongoose";

const PushTokenSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: ["user", "rider"],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true, // ⭐ unique:true уже создаёт индекс; НЕ добавляем schema.index() вручную
      trim: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true,
    },
    locale: { type: String, default: "ru" },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    lastUsedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Составной индекс для быстрого поиска токенов по владельцу
// (ownerType + ownerId) — НЕ дубликат, не пересекается с {token:1} unique
PushTokenSchema.index({ ownerType: 1, ownerId: 1 });

export const PushToken = mongoose.model("PushToken", PushTokenSchema);
