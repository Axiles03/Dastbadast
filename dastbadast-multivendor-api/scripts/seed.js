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
    deliveryRate: 0,
    taxPercent: 10,
    deliveryBaseKm: 3,
    deliveryBasePrice: 10,
    deliveryPerKmPrice: 3,
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

  // ==========================================
  // 👥 5 ПОЛЬЗОВАТЕЛЕЙ (Users)
  // ==========================================
  const demoUserHash = await bcrypt.hash("user123", 10);

  const usersData = [
    {
      name: "Алишер",
      email: "alisher@dastbadast.tj",
      phone: "+992900001111",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Фаридун",
      email: "faridun@dastbadast.tj",
      phone: "+992900002222",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Мадина",
      email: "madina@dastbadast.tj",
      phone: "+992900003333",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Сомон",
      email: "somon@dastbadast.tj",
      phone: "+992900004444",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Зарина",
      email: "zarina@dastbadast.tj",
      phone: "+992900005555",
      passwordHash: demoUserHash,
      isActive: true,
    },
  ];

  const createdUsers = await User.insertMany(usersData);

  // ==========================================
  // 🛵 3 КУРЬЕРА (Riders)
  // ==========================================
  const riderHash = await bcrypt.hash("rider123", 10);

  await Rider.insertMany([
    {
      username: "courier1",
      phone: "+992900111222",
      passwordHash: riderHash,
      name: "Курьер Один",
      zoneId: zone._id,
      available: true,
      isActive: true,
    },
    {
      username: "courier2",
      phone: "+992900222333",
      passwordHash: riderHash,
      name: "Курьер Два",
      zoneId: zone._id,
      available: true,
      isActive: true,
    },
    {
      username: "courier3",
      phone: "+992900333444",
      passwordHash: riderHash,
      name: "Курьер Три",
      zoneId: zone._id,
      available: true,
      isActive: true,
    },
  ]);

  // ==========================================
  // 🏪 5 РЕСТОРАНОВ С КАТЕГОРИЯМИ И БЛЮДАМИ
  // ==========================================
  const restPasswordHash = await bcrypt.hash("store123", 10);

  // --- РЕСТОРАН 1: Чайхана №1 ---
  const rest1 = await Restaurant.create({
    name: "Чайхана №1",
    slug: "chayhana-1",
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600",
    address: "ул. Рудаки 1, Душанбе",
    location: { type: "Point", coordinates: [68.78, 38.57] },
    zoneId: zone._id,
    username: "chayhana1",
    passwordHash: restPasswordHash,
    tax: 8,
    minimumOrder: 50,
    isAvailable: true,
  });

  const cat1Main = await Category.create({
    title: "Основные блюда",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400",
    restaurantId: rest1._id,
  });
  const cat1Drinks = await Category.create({
    title: "Напитки",
    image: "https://images.unsplash.com/photo-1625937329935-287441889b6f?w=400",
    restaurantId: rest1._id,
  });

  const rest1Foods = await Food.insertMany([
    {
      title: "Плов",
      description: "Узбекский плов с бараниной",
      price: 65,
      image:
        "https://images.unsplash.com/photo-1603133872875-684f208fbfa9?w=400",
      categoryId: cat1Main._id,
      restaurantId: rest1._id,
    },
    {
      title: "Шашлык",
      description: "Мясной шашлык на углях",
      price: 80,
      image:
        "https://images.unsplash.com/photo-1529042410699-9d8aef129ccd?w=400",
      categoryId: cat1Main._id,
      restaurantId: rest1._id,
    },
    {
      title: "Манты",
      description: "Домашние манты с говядиной",
      price: 55,
      image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400",
      categoryId: cat1Main._id,
      restaurantId: rest1._id,
    },
    {
      title: "Лагман",
      description: "Густой лагман с лапшой",
      price: 50,
      image:
        "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400",
      categoryId: cat1Main._id,
      restaurantId: rest1._id,
    },
    {
      title: "Чай зелёный",
      description: "Свежий горячий чай",
      price: 12,
      image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
      categoryId: cat1Drinks._id,
      restaurantId: rest1._id,
    },
  ]);

  // --- РЕСТОРАН 2: Bella Italia ---
  const rest2 = await Restaurant.create({
    name: "Bella Italia",
    slug: "bella-italia",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600",
    address: "пр. Исмоила Сомони 15, Душанбе",
    location: { type: "Point", coordinates: [68.76, 38.58] },
    zoneId: zone._id,
    username: "bellaitalia",
    passwordHash: restPasswordHash,
    tax: 10,
    minimumOrder: 70,
    isAvailable: true,
  });

  const cat2Pizza = await Category.create({
    title: "Пицца и Паста",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
    restaurantId: rest2._id,
  });
  const cat2Desserts = await Category.create({
    title: "Десерты",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400",
    restaurantId: rest2._id,
  });

  await Food.insertMany([
    {
      title: "Пицца Маргарита",
      description: "Классическая пицца с моцареллой и томатами",
      price: 75,
      image:
        "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400",
      categoryId: cat2Pizza._id,
      restaurantId: rest2._id,
    },
    {
      title: "Паста Карбонара",
      description: "Итальянская паста со сливками и беконом",
      price: 85,
      image:
        "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400",
      categoryId: cat2Pizza._id,
      restaurantId: rest2._id,
    },
    {
      title: "Тирамису",
      description: "Нежный кофейный десерт",
      price: 45,
      image:
        "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400",
      categoryId: cat2Desserts._id,
      restaurantId: rest2._id,
    },
  ]);

  // --- РЕСТОРАН 3: Burger House ---
  const rest3 = await Restaurant.create({
    name: "Burger House",
    slug: "burger-house",
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600",
    address: "ул. Айни 23, Душанбе",
    location: { type: "Point", coordinates: [68.79, 38.56] },
    zoneId: zone._id,
    username: "burgerhouse",
    passwordHash: restPasswordHash,
    tax: 5,
    minimumOrder: 40,
    isAvailable: true,
  });

  const cat3Burgers = await Category.create({
    title: "Бургеры",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
    restaurantId: rest3._id,
  });
  const cat3Snacks = await Category.create({
    title: "Закуски",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
    restaurantId: rest3._id,
  });

  await Food.insertMany([
    {
      title: "Чизбургер",
      description: "Сочная котлета с сыром чеддер",
      price: 45,
      image:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
      categoryId: cat3Burgers._id,
      restaurantId: rest3._id,
    },
    {
      title: "Картофель фри",
      description: "Хрустящий картофель с солью",
      price: 20,
      image:
        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
      categoryId: cat3Snacks._id,
      restaurantId: rest3._id,
    },
    {
      title: "Наггетсы",
      description: "Куриные наггетсы в панировке",
      price: 30,
      image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400",
      categoryId: cat3Snacks._id,
      restaurantId: rest3._id,
    },
  ]);

  // --- РЕСТОРАН 4: Сакура Суши ---
  const rest4 = await Restaurant.create({
    name: "Сакура Суши",
    slug: "sakura-sushi",
    image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600",
    address: "ул. Бухоро 8, Душанбе",
    location: { type: "Point", coordinates: [68.77, 38.55] },
    zoneId: zone._id,
    username: "sakurasushi",
    passwordHash: restPasswordHash,
    tax: 9,
    minimumOrder: 60,
    isAvailable: true,
  });

  const cat4Rolls = await Category.create({
    title: "Роллы",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400",
    restaurantId: rest4._id,
  });

  await Food.insertMany([
    {
      title: "Ролл Филадельфия",
      description: "С лососем и сливочным сыром",
      price: 95,
      image:
        "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400",
      categoryId: cat4Rolls._id,
      restaurantId: rest4._id,
    },
    {
      title: "Ролл Калифорния",
      description: "С крабом и икрой тобико",
      price: 85,
      image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400",
      categoryId: cat4Rolls._id,
      restaurantId: rest4._id,
    },
  ]);

  // --- РЕСТОРАН 5: Coffee & Bakery ---
  const rest5 = await Restaurant.create({
    name: "Coffee & Bakery",
    slug: "coffee-bakery",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600",
    address: "ул. Хусейнзода 2, Душанбе",
    location: { type: "Point", coordinates: [68.79, 38.58] },
    zoneId: zone._id,
    username: "coffeebakery",
    passwordHash: restPasswordHash,
    tax: 6,
    minimumOrder: 30,
    isAvailable: true,
  });

  const cat5Coffee = await Category.create({
    title: "Кофе",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
    restaurantId: rest5._id,
  });
  const cat5Bakery = await Category.create({
    title: "Выпечка",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
    restaurantId: rest5._id,
  });

  await Food.insertMany([
    {
      title: "Капучино",
      description: "Классический кофейный напиток",
      price: 25,
      image:
        "https://images.unsplash.com/photo-1534778101976-62847782c213?w=400",
      categoryId: cat5Coffee._id,
      restaurantId: rest5._id,
    },
    {
      title: "Круассан",
      description: "Французский круассан на масле",
      price: 18,
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400",
      categoryId: cat5Bakery._id,
      restaurantId: rest5._id,
    },
  ]);

  // ==========================================
  // ⭐ ОТЗЫВЫ К БЛЮДАМ (Reviews)
  // ==========================================
  await FoodReview.insertMany([
    {
      foodId: rest1Foods[0]._id,
      userId: createdUsers[0]._id,
      userName: createdUsers[0].name,
      rating: 5,
      comment: "Лучший плов в городе!",
    },
    {
      foodId: rest1Foods[1]._id,
      userId: createdUsers[0]._id,
      userName: createdUsers[0].name,
      rating: 5,
      comment: "Сочный шашлык, рекомендую",
    },
  ]);

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
  console.log("\n📱 КЛИЕНТСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (5 Пользователей):");
  usersData.forEach((u) => {
    console.log(
      `   Имя: ${u.name.padEnd(8)} | Тел: ${u.phone} | Email: ${u.email} | Pass: user123`,
    );
  });

  console.log("\n🛵 КУРЬЕРСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (3 Курьера):");
  console.log(`   Username: courier1 / courier2 / courier3`);
  console.log(`   Phones:   +992900111222 / +992900222333 / +992900333444`);
  console.log(`   Password: rider123`);

  console.log("\n🖥 ПАНЕЛЬ РЕСТОРАНОВ (5 Ресторанов):");
  console.log("   Пароль для всех ресторанов: store123");
  console.log("   1. Чайхана №1     -> Логин: chayhana1");
  console.log("   2. Bella Italia   -> Логин: bellaitalia");
  console.log("   3. Burger House   -> Логин: burgerhouse");
  console.log("   4. Сакура Суши    -> Логин: sakurasushi");
  console.log("   5. Coffee & Bakery-> Логин: coffeebakery");

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
