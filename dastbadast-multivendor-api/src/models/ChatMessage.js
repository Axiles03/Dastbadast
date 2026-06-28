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
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// Новое = сверху
ChatMessageSchema.index({ orderId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
