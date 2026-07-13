import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    senderType: { type: String, enum: ["USER", "RIDER"], required: true },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    text: { type: String, trim: true, maxlength: 1000, default: "" },
    // ⭐ NEW: фото (например, фото у двери при бесконтактной доставке).
    imageUrl: { type: String, default: null },
    // ⭐ NEW: когда получатель (не отправитель) открыл/увидел чат ПОСЛЕ
    // этого сообщения — null, пока не прочитано.
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Новое = сверху
ChatMessageSchema.index({ orderId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
