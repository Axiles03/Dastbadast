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
    // ⭐ Шаг 1: телефон — основной идентификатор, подтверждается через OTP.
    // Имя/email заполняются на странице профиля после регистрации.
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
    // ⭐ Пароль теперь необязателен: пользователь может входить только по OTP,
    // пока не задаст пароль сам (в профиле или через "Забыли пароль").
    passwordHash: { type: String, default: null },
    // ⭐ Момент, когда телефон был подтверждён кодом (регистрация или вход по OTP)
    phoneVerifiedAt: { type: Date, default: null },
    pendingPhone: { type: String, default: null },
    avatar: { type: String, default: null },
    avatarChangedAt: { type: Date, default: null },
    addresses: [AddressSchema],
    notificationToken: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.index({ "addresses.location": "2dsphere" });

export const User = mongoose.model("User", UserSchema);
