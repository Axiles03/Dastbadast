import mongoose from "mongoose";

const OwnerSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: null },
    userType: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "DISPATCHER",
        "FINANCE",
        "OPERATIONS",
        "SUPPORT",
        "ANALYST",
      ],
      default: "SUPER_ADMIN",
      index: true,
    },
    // Гранулярные права (для будущего расширения, пока не используются в резолверах)
    permissions: {
      canManageRestaurants: { type: Boolean, default: false },
      canManageRiders: { type: Boolean, default: false },
      canManageZones: { type: Boolean, default: false },
      canManageConfiguration: { type: Boolean, default: false },
      canViewAccounting: { type: Boolean, default: false },
      canAssignRiders: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null,
    },
  },
  { timestamps: true },
);

export const Owner = mongoose.model("Owner", OwnerSchema);
