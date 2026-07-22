// scripts/migrate-cancel-reason.js — прогнать один раз перед раскаткой Фазы 2
import { Order } from "../src/models/Order.js";

const KNOWN_CODES = new Set([
  "OUT_OF_STOCK",
  "KITCHEN_OVERLOAD",
  "CUSTOMER_UNREACHABLE",
  "RIDER_NO_SHOW",
  "CUSTOMER_CANCELLED",
  "PAYMENT_FAILED",
  "AUTO_EXPIRED",
]);

const cursor = Order.find({
  orderStatus: "CANCELLED",
  cancelReason: { $exists: true, $ne: "" },
}).cursor();

for await (const o of cursor) {
  const raw = o.cancelReason;
  await Order.updateOne(
    { _id: o._id },
    {
      $set: {
        cancelReasonCode: KNOWN_CODES.has(raw) ? raw : "OTHER",
        cancelReasonNote: KNOWN_CODES.has(raw) ? "" : raw,
      },
      $unset: { cancelReason: "" },
    },
  );
}
