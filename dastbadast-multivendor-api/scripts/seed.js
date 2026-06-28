import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { Configuration } from "../src/models/Configuration.js";
import { Zone } from "../src/models/Zone.js";
import { Restaurant } from "../src/models/Restaurant.js";
import { Category } from "../src/models/Category.js";
import { Food } from "../src/models/Food.js";
import { FoodReview } from "../src/models/FoodReview.js";
import { Owner } from "../src/models/Owner.js";
import { Rider } from "../src/models/Rider.js";
import { User } from "../src/models/User.js";
import { Order } from "../src/models/Order.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected. Seeding...");

  await Promise.all([
    Configuration.deleteMany({}),
    Zone.deleteMany({}),
    Restaurant.deleteMany({}),
    Category.deleteMany({}),
    Food.deleteMany({}),
    FoodReview.deleteMany({}),
    Owner.deleteMany({}),
    Rider.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
  ]);

  await Configuration.create({
    _id: "singleton",
    currency: "TJS",
    currencySymbol: "сом.",
    deliveryRate: 15,
    skipEmailVerification: true,
    skipMobileVerification: true,
    testOtp: "123456",
  });

  const passwordHash = await bcrypt.hash("admin123", 10);
  await Owner.create({
    email: "admin@dastbadast.tj",
    passwordHash,
    userType: "SUPER_ADMIN",
  });

  const zone = await Zone.create({
    name: "Душанбе",
    description: "Центральная зона доставки",
    location: {
      type: "Polygon",
      coordinates: [
        [
          [68.62, 38.46],
          [68.98, 38.46],
          [68.98, 38.68],
          [68.62, 38.68],
          [68.62, 38.46],
        ],
      ],
    },
  });

  const restPasswordHash = await bcrypt.hash("store123", 10);
  const restaurant = await Restaurant.create({
    name: "Чайхана №1",
    slug: "chayhana-1",
    image: "https://placehold.co/600x400?text=Chayhana",
    address: "ул. Рудаки 1, Душанбе",
    location: { type: "Point", coordinates: [68.78, 38.57] },
    zoneId: zone._id,
    username: "chayhana1",
    passwordHash: restPasswordHash,
    tax: 8,
    minimumOrder: 50,
    isAvailable: true,
  });

  const catMain = await Category.create({
    title: "Основные блюда",
    image: "https://placehold.co/200?text=Main",
    restaurantId: restaurant._id,
  });
  const catDrinks = await Category.create({
    title: "Напитки",
    image: "https://placehold.co/200?text=Drinks",
    restaurantId: restaurant._id,
  });

  await Food.insertMany([
    {
      title: "Плов",
      description: "Узбекский плов с бараниной",
      price: 65,
      image:
        "https://images.unsplash.com/photo-1603133872875-684f208fbfa9?w=400",
      categoryId: catMain._id,
      restaurantId: restaurant._id,
    },
    {
      title: "Шашлык",
      description: "Мясной шашлык на углях",
      price: 80,
      image:
        "https://images.unsplash.com/photo-1529042410699-9d8aef129ccd?w=400",
      categoryId: catMain._id,
      restaurantId: restaurant._id,
    },
    {
      title: "Манты",
      description: "Домашние манты",
      price: 55,
      image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400",
      categoryId: catMain._id,
      restaurantId: restaurant._id,
    },
    {
      title: "Лагман",
      description: "Густой лагман с лапшой",
      price: 50,
      image:
        "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400",
      categoryId: catMain._id,
      restaurantId: restaurant._id,
    },
    {
      title: "Чай зелёный",
      description: "Свежий горячий чай",
      price: 12,
      image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
      categoryId: catDrinks._id,
      restaurantId: restaurant._id,
    },
  ]);

  const foods = await Food.find({ restaurantId: restaurant._id });
  const demoUserHash = await bcrypt.hash("user123", 10);

  // 🌟 Обновленный тестовый пользователь под ТЖ-номера для авторизации на фронте
  const demoUser = await User.create({
    name: "Алишер",
    email: "user@dastbadast.tj",
    phone: "+992900001111",
    passwordHash: demoUserHash,
    isActive: true,
  });

  await FoodReview.insertMany([
    {
      foodId: foods[0]._id,
      userId: demoUser._id,
      userName: "Алишер",
      rating: 5,
      comment: "Лучший плов в городе!",
    },
    {
      foodId: foods[1]._id,
      userId: demoUser._id,
      userName: "Алишер",
      rating: 5,
      comment: "Сочный шашлык, рекомендую",
    },
  ]);

  // 🌟 Четко размеченный тестовый курьер (Rider) для Rider App
  const riderHash = await bcrypt.hash("rider123", 10);
  await Rider.create({
    username: "courier1",
    phone: "+992900111222",
    passwordHash: riderHash,
    name: "Курьер Один",
    zoneId: zone._id,
    available: true,
    isActive: true,
  });

  // === Тестовые админы для проверки ролей ===
  const dispatchPasswordHash = await bcrypt.hash("dispatch123", 10);
  await Owner.create({
    email: "dispatch@dastbadast.tj",
    passwordHash: dispatchPasswordHash,
    userType: "DISPATCHER",
    permissions: {
      canManageRestaurants: false,
      canManageRiders: true,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: true,
      canManageUsers: false,
    },
    isActive: true,
  });

  const financePasswordHash = await bcrypt.hash("finance123", 10);
  await Owner.create({
    email: "finance@dastbadast.tj",
    passwordHash: financePasswordHash,
    userType: "FINANCE",
    permissions: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: true,
      canViewAccounting: true,
      canAssignRiders: false,
      canManageUsers: false,
    },
    isActive: true,
  });

  const operationsPasswordHash = await bcrypt.hash("operations123", 10);
  await Owner.create({
    email: "operations@dastbadast.tj",
    passwordHash: operationsPasswordHash,
    userType: "OPERATIONS",
    permissions: {
      canManageRestaurants: true,
      canManageRiders: true,
      canManageZones: true,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: true,
      canManageUsers: false,
    },
    isActive: true,
  });

  const supportPasswordHash = await bcrypt.hash("support123", 10);
  await Owner.create({
    email: "support@dastbadast.tj",
    passwordHash: supportPasswordHash,
    userType: "SUPPORT",
    permissions: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: false,
      canAssignRiders: false,
      canManageUsers: true,
    },
    isActive: true,
  });

  const analystPasswordHash = await bcrypt.hash("analyst123", 10);
  await Owner.create({
    email: "analyst@dastbadast.tj",
    passwordHash: analystPasswordHash,
    userType: "ANALYST",
    permissions: {
      canManageRestaurants: false,
      canManageRiders: false,
      canManageZones: false,
      canManageConfiguration: false,
      canViewAccounting: true,
      canAssignRiders: false,
      canManageUsers: false,
    },
    isActive: true,
  });

  console.log("✅ Seed complete");
  console.log("\n📱 КЛИЕНТСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (Client App):");
  console.log(`   Phone / Email:  +992900001111  /  user@dastbadast.tj`);
  console.log(`   Password:       user123`);

  console.log("\n🛵 КУРЬЕРСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (Rider App):");
  console.log(`   Username / Phone: courier1      /  +992900111222`);
  console.log(`   Password:         rider123`);

  console.log("\n🖥 ПАНЕЛЬ УПРАВЛЕНИЯ (Admin / Restaurant):");
  console.log(
    "   Super admin:  admin@dastbadast.tj      / admin123       (SUPER_ADMIN)",
  );
  console.log(
    "   Restaurant:   chayhana1                / store123       (Чайхана №1)",
  );
  console.log(
    "   Dispatcher:   dispatch@dastbadast.tj   / dispatch123    (DISPATCHER)",
  );
  console.log(
    "   Finance:      finance@dastbadast.tj    / finance123     (FINANCE)",
  );
  console.log(
    "   Operations:   operations@dastbadast.tj  / operations123  (OPERATIONS)",
  );
  console.log(
    "   Support:      support@dastbadast.tj    / support123     (SUPPORT)",
  );
  console.log(
    "   Analyst:      analyst@dastbadast.tj    / analyst123     (ANALYST)",
  );

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
