// dastbadast-multivendor-api/src/models/WebPushSubscription.js
//
// ⭐ Шаг 4: Web Push (браузер), VAPID. Хранит подписку PushSubscription
// (endpoint + ключи шифрования p256dh/auth), полученную от браузера через
// PushManager.subscribe() на фронте.

import mongoose from "mongoose";

const WebPushSubscriptionSchema = new mongoose.Schema(
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
    endpoint: {
      type: String,
      required: true,
      unique: true, // одна подписка браузера — один endpoint
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

WebPushSubscriptionSchema.index({ ownerType: 1, ownerId: 1 });

export const WebPushSubscription = mongoose.model(
  "WebPushSubscription",
  WebPushSubscriptionSchema,
);
