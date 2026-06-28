import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  { _id: false },
);

const RiderSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    available: { type: Boolean, default: true },
    location: {
      type: LocationSchema,
      default: () => ({ type: "Point", coordinates: [0, 0] }),
    },
    lastLocationAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

RiderSchema.index({ location: "2dsphere" });

export const Rider = mongoose.model("Rider", RiderSchema);
