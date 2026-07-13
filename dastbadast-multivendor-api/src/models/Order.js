// dastbadast-multivendor-api/src/models/Order.js
import mongoose from "mongoose";

const OrderItemOptionSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, required: true },
    groupTitle: { type: String, required: true }, // снапшот
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    optionTitle: { type: String, required: true }, // снапшот
    price: { type: Number, required: true, min: 0 }, // снапшот надбавки
  },
  { _id: false },
);

const OrderItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    title: { type: String, required: true }, // снапшот имени
    basePrice: { type: Number, required: true, min: 0 }, // ⭐⭐⭐ ШАГ 1: было просто `price`
    optionsTotal: { type: Number, default: 0, min: 0 }, // ⭐⭐⭐ ШАГ 1: Σ(price) по выбранным опциям
    price: { type: Number, required: true, min: 0 }, // ⭐⭐⭐ ШАГ 1: ИТОГО за единицу = basePrice + optionsTotal (вычисляем перед записью)
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: "" }, // снапшот
    description: { type: String, default: "" }, // снапшот
    // ⭐⭐⭐ ШАГ 1: структурированный список выбранных опций.
    // Заменяет старые неструктурированные `variation` + `addons`.
    selectedOptions: {
      type: [OrderItemOptionSchema],
      default: [],
    },
  },
  { _id: false },
);

OrderItemSchema.virtual("lineTotal").get(function () {
  return this.price * this.quantity;
});

OrderItemSchema.set("toJSON", { virtuals: true });
OrderItemSchema.set("toObject", { virtuals: true });

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
      subtotal: { type: Number, required: true }, // ⭐⭐⭐ ШАГ 1: Σ(lineTotal) = Σ((basePrice + optionsTotal) * qty)
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
      // ⭐ NEW: "MANUAL" (кнопка "Я на месте") или "GEOFENCE_AUTO" (авто-детект
      // по геолокации курьера) — для аналитики и отладки.
      arrivedAtDropOffSource: {
        type: String,
        enum: ["MANUAL", "GEOFENCE_AUTO", null],
        default: null,
      },
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

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
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

OrderSchema.methods.recalcAmounts = function () {
  const subtotal = this.items.reduce(
    (s, i) => s + (i.basePrice + i.optionsTotal) * i.quantity,
    0,
  );
  this.amounts.subtotal = +subtotal.toFixed(2);
  this.amounts.total = +(
    this.amounts.subtotal +
    this.amounts.tax +
    this.amounts.deliveryFee
  ).toFixed(2);
};

export const Order = mongoose.model("Order", OrderSchema);
