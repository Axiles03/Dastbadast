// Одноразовая миграция: добавить timestamps в существующие документы Order.
// Запускать вручную: `node scripts/migrate-order-status.js`

import "dotenv/config";
import mongoose from "mongoose";
import { Order } from "../src/models/Order.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("🔗 Connected, migrating orders…");

  const orders = await Order.find({
    "statusTimestamps.readyAt": { $exists: false },
  });

  console.log(`📦 Found ${orders.length} orders to migrate`);

  for (const o of orders) {
    o.statusTimestamps = o.statusTimestamps || {};

    // Если есть READY_FOR_PICKUP, готовAt = acceptedAt (для обратной совместимости)
    if (o.orderStatus === "READY_FOR_PICKUP" && !o.statusTimestamps.readyAt) {
      o.statusTimestamps.readyAt = o.statusTimestamps.acceptedAt || o.updatedAt;
    }

    // Если есть EN_ROUTE_TO_DROP_OFF, timestamp = pickedAt
    if (
      [
        "EN_ROUTE_TO_DROP_OFF",
        "ARRIVED_AT_DROP_OFF",
        "AWAITING_CONFIRMATION",
        "DELIVERED",
      ].includes(o.orderStatus) &&
      !o.statusTimestamps.enRouteToDropOffAt
    ) {
      o.statusTimestamps.enRouteToDropOffAt =
        o.statusTimestamps.pickedAt || o.updatedAt;
    }

    if (
      ["ARRIVED_AT_DROP_OFF", "AWAITING_CONFIRMATION", "DELIVERED"].includes(
        o.orderStatus,
      ) &&
      !o.statusTimestamps.arrivedAtDropOffAt
    ) {
      o.statusTimestamps.arrivedAtDropOffAt =
        o.statusTimestamps.deliveredAt || o.updatedAt;
    }

    await o.save();
  }

  console.log("✅ Migration complete");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
