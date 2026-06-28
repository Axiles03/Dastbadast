import mongoose from "mongoose";

const ConfigurationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    currency: { type: String, default: "TJS" },
    currencySymbol: { type: String, default: "сом." },
    deliveryRate: { type: Number, default: 0 },
    skipEmailVerification: { type: Boolean, default: true },
    skipMobileVerification: { type: Boolean, default: true },
    testOtp: { type: String, default: "123456" },
  },
  { timestamps: true, _id: false },
);

export const Configuration = mongoose.model(
  "Configuration",
  ConfigurationSchema,
);
