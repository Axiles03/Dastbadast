// dastbadast-multivendor-api/scripts/migrate-wallet-owner.js
//
// Проставляет ownerType="RESTAURANT" / ownerId=restaurantId всем старым
// проводкам WalletTransaction, у которых их ещё нет (созданы до Фазы 3).
// Безопасно запускать повторно — фильтр по ownerId: { $exists: false }.

import mongoose from "mongoose";
import { WalletTransaction } from "../src/models/WalletTransaction.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const res = await WalletTransaction.updateMany(
    { ownerId: { $exists: false }, restaurantId: { $ne: null } },
    [
      {
        $set: {
          ownerType: "RESTAURANT",
          ownerId: "$restaurantId",
        },
      },
    ],
  );

  console.log(`Обновлено проводок: ${res.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
