// dastbadast-multivendor-api/src/models/Order.js
import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    variation: { type: Object, default: null },
    addons: { type: Array, default: [] },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },

    items: { type: [OrderItemSchema], required: true },

    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "ASSIGNED",
        "PICKED",
        "EN_ROUTE_TO_DROP_OFF",
        "ARRIVED_AT_DROP_OFF",
        "DELIVERED",
        "CANCELLED",
        "AWAITING_CONFIRMATION",
      ],
      default: "PENDING",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "ALIF_MOBI", "DS_BANK"],
      default: "COD",
    },
    paid: { type: Boolean, default: false },

    deliveryAddress: {
      label: String,
      address: { type: String, required: true },
      city: String,
      details: String,
      location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true },
      },
    },

    amounts: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },

    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },

    statusTimestamps: {
      pendingAt: { type: Date, default: Date.now },
      acceptedAt: Date,
      preparingAt: Date,
      readyAt: Date,
      assignedAt: Date,
      pickedAt: Date,
      enRouteToDropOffAt: Date,
      arrivedAtDropOffAt: Date,
      deliveredAt: Date,
      cancelledAt: Date,
      prepTime: { type: Number, default: null },
      courierSearchTimestamps: {
        initialPushedAt: { type: Date, default: null },
        escalationPushedAt: { type: Date, default: null },
      },
    },

    fastAcceptBonus: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "AWAITING_PAYMENT", "PAID", "FAILED"],
      default: "NOT_REQUIRED",
    },
    providerRef: { type: String, default: null },
    paidAt: { type: Date, default: null },

    cancelReason: { type: String, default: "" },
    note: { type: String, default: "" },
    pickupAddress: {
      name: String,
      address: { type: String, default: "" },
      city: String,
      location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, orderStatus: 1, createdAt: -1 });
OrderSchema.index(
  { orderStatus: 1, riderId: 1, "statusTimestamps.pendingAt": 1 },
  {
    partialFilterExpression: {
      riderId: null,
      orderStatus: { $in: ["PENDING", "ACCEPTED"] },
    },
  },
);

export const Order = mongoose.model("Order", OrderSchema);
