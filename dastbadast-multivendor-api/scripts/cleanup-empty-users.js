// dastbadast-multivendor-api/scripts/cleanup-empty-users.js
//
// Одноразовый скрипт: находит и удаляет User-документы без name или email.
// Запускать ВРУЧНУЮ: node scripts/cleanup-empty-users.js
// Перед запуском сделайте backup коллекции!

import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("🔍 Поиск пользователей без name/email...");

  // Статистика ДО удаления
  const total = await User.countDocuments();
  const noName = await User.countDocuments({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  });
  const noEmail = await User.countDocuments({
    $or: [{ email: { $exists: false } }, { email: null }, { email: "" }],
  });
  const noBoth = await User.countDocuments({
    $and: [
      {
        $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
      },
      {
        $or: [{ email: { $exists: false } }, { email: null }, { email: "" }],
      },
    ],
  });

  console.log(`📊 Всего пользователей в БД: ${total}`);
  console.log(`   Без name:    ${noName}`);
  console.log(`   Без email:   ${noEmail}`);
  console.log(`   Без name+email: ${noBoth} (ЭТО ОНИ — удалить)`);

  // Защита от случайного запуска
  if (process.argv.includes("--yes")) {
    const deleted = await User.deleteMany({
      $and: [
        {
          $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
        },
        {
          $or: [{ email: { $exists: false } }, { email: null }, { email: "" }],
        },
      ],
    });
    console.log(`🗑 Удалено: ${deleted.deletedCount}`);
  } else {
    console.log("\n⚠️  Это был DRY-RUN. Для удаления добавьте флаг --yes:");
    console.log("   node scripts/cleanup-empty-users.js --yes");
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
