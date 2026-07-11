// dastbadast-multivendor-api/scripts/recommend-indexes.js
//
// ⭐ ШАГ 1: рекомендованные индексы для коллекций Orders и Users.
// Запустить ОДИН РАЗ после деплоя: `node scripts/recommend-indexes.js`
//
// Индексы добавляются идемпотентно (если уже есть — пропускаются).

import mongoose from "mongoose";
import { debugLog } from "../src/debug-log.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

const RECOMMENDED_INDEXES = [
  {
    collection: "orders",
    description: "История заказов клиента (с сортировкой по дате)",
    spec: { userId: 1, createdAt: -1 },
  },
  {
    collection: "orders",
    description: "Заказы ресторана, готовые к сборке (restaurant dashboard)",
    spec: { restaurantId: 1, orderStatus: 1, createdAt: -1 },
  },
  {
    collection: "orders",
    description: "Заказы курьера (rider app, активные заказы)",
    spec: { riderId: 1, orderStatus: 1 },
  },
  {
    collection: "orders",
    description: "TTL-индекс для автоудаления CANCELLED заказов старше 90 дней",
    spec: { updatedAt: 1 },
    options: {
      expireAfterSeconds: 90 * 24 * 3600,
      partialFilterExpression: { orderStatus: "CANCELLED" },
    },
  },
  {
    collection: "users",
    description: "Поиск клиента по email (auth/login)",
    spec: { email: 1 },
    options: { unique: true, sparse: true },
  },
  {
    collection: "users",
    description: "Поиск клиента по phone (auth/login)",
    spec: { phone: 1 },
    options: { unique: true, sparse: true },
  },
  {
    collection: "riders",
    description: "Свободные курьеры (поиск ближайшего)",
    spec: { available: 1, isActive: 1 },
  },
  {
    collection: "riders",
    description: "⭐ 2dsphere для geo-queries (если используется $geoNear)",
    spec: { location: "2dsphere" },
  },
  {
    collection: "riders",
    description: "TTL-индекс: автоудаление неактивных гостевых курьеров",
    spec: { lastLocationAt: 1 },
    options: { expireAfterSeconds: 30 * 24 * 3600, sparse: true },
  },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  for (const idx of RECOMMENDED_INDEXES) {
    try {
      const col = db.collection(idx.collection);
      const name = await col.createIndex(idx.spec, idx.options || {});
      debugLog("indexes", `created/verified: ${idx.collection}.${name}`, {
        description: idx.description,
      });
    } catch (e) {
      console.error(
        `❌ failed: ${idx.collection} ${JSON.stringify(idx.spec)}`,
        e?.message || String(e),
      );
    }
  }

  // Вывести итог
  const collections = ["orders", "users", "riders"];
  console.log("\n📊 Current indexes:");
  for (const c of collections) {
    const idx = await db.collection(c).indexes();
    console.log(`\n  ${c}:`);
    idx.forEach((i) =>
      console.log(
        `    ${i.name}: ${JSON.stringify(i.key)}${
          i.expireAfterSeconds ? ` (TTL=${i.expireAfterSeconds}s)` : ""
        }`,
      ),
    );
  }

  await mongoose.disconnect();
  console.log("\n✅ Migration complete");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌", e?.message || String(e));
  process.exit(1);
});
