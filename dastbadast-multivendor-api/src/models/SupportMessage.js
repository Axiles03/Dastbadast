// dastbadast-multivendor-api/src/models/SupportMessage.js
//
// ⭐ NEW: сообщение внутри треда поддержки (см. SupportThread.js).
// Структура намеренно похожа на ChatMessage.js (чат заказа) для
// консистентности, но это отдельная коллекция — support-чат не привязан
// к статусам заказа и в нём участвует четвёртая сторона (OWNER = поддержка).
import mongoose from "mongoose";

const SupportMessageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportThread",
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ["USER", "RIDER", "RESTAURANT", "OWNER"],
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Снапшот имени отправителя (имя клиента / курьера / ресторана / email агента)
    ssenderName: { type: String, default: "" },
    senderAvatar: { type: String, default: null },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, default: null },
  },
  { timestamps: true },
);

SupportMessageSchema.index({ threadId: 1, createdAt: 1 });

export const SupportMessage = mongoose.model(
  "SupportMessage",
  SupportMessageSchema,
);
