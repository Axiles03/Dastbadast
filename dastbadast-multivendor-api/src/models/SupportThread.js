// dastbadast-multivendor-api/src/models/SupportThread.js
//
// ⭐ NEW: чат поддержки. Один тред = одна переписка между участником
// (клиент / курьер / ресторан) и командой поддержки (Owner с ролью
// SUPPORT или SUPER_ADMIN).
//
// Два вида треда:
//   - orderId === null  → общий тред участника ("написать в поддержку")
//   - orderId !== null  → тред привязан к конкретному заказу (жалоба/вопрос
//     по заказу). У одного участника может быть несколько order-тредов +
//     один общий.
//
// Уникальность (участник, тип, заказ) обеспечивается на уровне резолвера
// (findOneAndUpdate upsert в startSupportThread), а не жёстким unique-индексом,
// т.к. orderId может быть null у нескольких документов одновременно.
import mongoose from "mongoose";

const SupportThreadSchema = new mongoose.Schema(
  {
    participantType: {
      type: String,
      enum: ["USER", "RIDER", "RESTAURANT"],
      required: true,
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Снапшот имени участника — чтобы список в админке не делал join на каждую строку
    participantName: { type: String, default: "" },

    // null = общий тред ("написать в поддержку"), иначе — тред по заказу
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    subject: { type: String, default: "", maxlength: 200 },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    closedByOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null,
    },
    closedByName: { type: String, default: null },

    // Сотрудник поддержки, который "забрал" тред. null = ещё никто не взял.
    assignedOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null,
      index: true,
    },
    assignedOwnerName: { type: String, default: null },
    assignedOwnerAvatar: { type: String, default: null },

    // Снапшот последнего сообщения — для быстрого рендера списка тредов в админке
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: "" },
    lastSenderType: {
      type: String,
      enum: ["USER", "RIDER", "RESTAURANT", "OWNER", null],
      default: null,
    },

    // ⭐ Упрощённые read-receipts на уровне треда (не на уровне сообщения):
    // "непрочитано", если lastMessageAt новее соответствующей метки.
    participantReadAt: { type: Date, default: null },
    staffReadAt: { type: Date, default: null },
  },

  { timestamps: true },
);

SupportThreadSchema.index({ participantType: 1, participantId: 1, orderId: 1 });
SupportThreadSchema.index({ status: 1, lastMessageAt: -1 });

export const SupportThread = mongoose.model(
  "SupportThread",
  SupportThreadSchema,
);
