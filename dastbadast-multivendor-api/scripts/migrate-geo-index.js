// dastbadast-multivendor-api/scripts/migrate-geo-index.js
//
// Гарантирует наличие 2dsphere-индекса для Rider.location
// (без него $geoNear и $nearSphere не работают эффективно).
//
// Совместимо с Mongoose 7.x и 8.x: не зависит от
// наличия .collection.stats() в native-драйвере.

import "dotenv/config";
import mongoose from "mongoose";
import { Rider } from "../src/models/Rider.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("🔗 Connected, ensuring 2dsphere index…");

  // Берём коллекцию через native driver — она всегда доступна,
  // даже если Mongoose-обёртка не успела инициализироваться.
  const collection = mongoose.connection.db.collection("riders");

  // Получаем список существующих индексов
  const indexes = await collection.indexes();
  const has2dsphere = indexes.some(
    (i) => i.key && i.key.location === "2dsphere",
  );

  if (has2dsphere) {
    console.log("✅ 2dsphere index already exists");
  } else {
    await collection.createIndex({ location: "2dsphere" });
    console.log("✅ Created 2dsphere index on Rider.location");
  }

  // Справочная информация — без .stats() (он недоступен в части драйверов)
  const docCount = await collection.countDocuments();
  const indexNames = indexes.map((i) => i.name).join(", ");
  console.log(`📊 Total riders: ${docCount}`);
  console.log(`📊 Indexes: ${indexNames}`);

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
