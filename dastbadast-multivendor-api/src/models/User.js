// dastbadast-multivendor-api/src/models/User.js
import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Дом" },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    city: { type: String, default: "Душанбе" },
    details: { type: String, default: "" },
    isSelected: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Клиент" },
    nameChangeHistory: { type: [Date], default: [] },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    pendingEmail: { type: String, default: null },
    phone: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    pendingPhone: { type: String, default: null },
    avatar: { type: String, default: null },
    avatarChangedAt: { type: Date, default: null },
    addresses: [AddressSchema],
    notificationToken: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    favoriteRestaurantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],
      default: [],
    },
    favoriteFoodIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Food" }],
      default: [],
    },
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

UserSchema.index({ "addresses.location": "2dsphere" });

export const User = mongoose.model("User", UserSchema);
