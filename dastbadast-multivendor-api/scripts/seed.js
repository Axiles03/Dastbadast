import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { RestaurantReview } from "../src/models/RestaurantReview.js";
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

  // 1. CLEAR COLLECTIONS
  await Promise.all([
    Configuration.deleteMany({}),
    Zone.deleteMany({}),
    Restaurant.deleteMany({}),
    Category.deleteMany({}),
    Food.deleteMany({}),
    FoodReview.deleteMany({}),
    RestaurantReview.deleteMany({}),
    Owner.deleteMany({}),
    Rider.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
  ]);

  // 2. CREATE CONFIGURATION
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

  // 3. CREATE SUPER ADMIN
  const passwordHash = await bcrypt.hash("admin123", 10);
  await Owner.create({
    email: "admin@dastbadast.tj",
    passwordHash,
    userType: "SUPER_ADMIN",
  });

  // 4. CREATE ZONE
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

  // 5. CREATE 15 USERS
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
    {
      name: "Рустам",
      email: "rustam@dastbadast.tj",
      phone: "+992900006666",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Нигина",
      email: "nigina@dastbadast.tj",
      phone: "+992900007777",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Далер",
      email: "daler@dastbadast.tj",
      phone: "+992900008888",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Ситора",
      email: "sitora@dastbadast.tj",
      phone: "+992900009999",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Хуршед",
      email: "khurshed@dastbadast.tj",
      phone: "+992900010000",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Тахмина",
      email: "tahmina@dastbadast.tj",
      phone: "+992900011111",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Джамшед",
      email: "jamshed@dastbadast.tj",
      phone: "+992900022222",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Парвина",
      email: "parvina@dastbadast.tj",
      phone: "+992900033333",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Фирдавс",
      email: "firdavs@dastbadast.tj",
      phone: "+992900044444",
      passwordHash: demoUserHash,
      isActive: true,
    },
    {
      name: "Лайло",
      email: "laylo@dastbadast.tj",
      phone: "+992900055555",
      passwordHash: demoUserHash,
      isActive: true,
    },
  ];
  const createdUsers = await User.insertMany(usersData);

  // 6. CREATE 10 RIDERS
  const riderHash = await bcrypt.hash("rider123", 10);
  const ridersData = Array.from({ length: 10 }, (_, i) => {
    const num = i + 1;
    return {
      username: `courier${num}`,
      phone: `+992900111${String(num).padStart(3, "0")}`,
      passwordHash: riderHash,
      name: `Курьер №${num}`,
      zoneId: zone._id,
      available: true,
      isActive: true,
    };
  });
  await Rider.insertMany(ridersData);

  // 7. CREATE 10 RESTAURANTS, CATEGORIES, AND FOODS
  const restPasswordHash = await bcrypt.hash("store123", 10);

  // --- RESTAURANT 1: Чайхана №1 ---
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
      title: "Чай зелёный",
      description: "Свежий горячий чай",
      price: 12,
      image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
      categoryId: cat1Drinks._id,
      restaurantId: rest1._id,
    },
  ]);

  // --- RESTAURANT 2: Bella Italia ---
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
  ]);

  // --- RESTAURANT 3: Burger House ---
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
      categoryId: cat3Burgers._id,
      restaurantId: rest3._id,
    },
  ]);

  // --- RESTAURANT 4: Сакура Суши ---
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

  // --- RESTAURANT 5: Coffee & Bakery ---
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
    title: "Кофе и Выпечка",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
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
      categoryId: cat5Coffee._id,
      restaurantId: rest5._id,
    },
  ]);

  // --- RESTAURANT 6: Шашлычный Рай ---
  const rest6 = await Restaurant.create({
    name: "Шашлычный Рай",
    slug: "shashlyk-ray",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600",
    address: "ул. Карамова 45, Душанбе",
    location: { type: "Point", coordinates: [68.75, 38.6] },
    zoneId: zone._id,
    username: "shashlykray",
    passwordHash: restPasswordHash,
    tax: 7,
    minimumOrder: 55,
    isAvailable: true,
  });
  const cat6Grill = await Category.create({
    title: "Мясо на углях",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400",
    restaurantId: rest6._id,
  });
  await Food.insertMany([
    {
      title: "Люля-Кебаб",
      description: "Нежный фарш из говядины со специями",
      price: 40,
      image: "https://images.unsplash.com/photo-1560614382-33500b6c3241?w=400",
      categoryId: cat6Grill._id,
      restaurantId: rest6._id,
    },
    {
      title: "Шашлык из курицы",
      description: "Сочное куриное бедро в маринаде",
      price: 35,
      image:
        "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400",
      categoryId: cat6Grill._id,
      restaurantId: rest6._id,
    },
  ]);

  // --- RESTAURANT 7: Плов Центр ---
  const rest7 = await Restaurant.create({
    name: "Плов Центр",
    slug: "plov-center",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600",
    address: "ул. Негмата Карабаева 12, Душанбе",
    location: { type: "Point", coordinates: [68.76, 38.53] },
    zoneId: zone._id,
    username: "plovcenter",
    passwordHash: restPasswordHash,
    tax: 8,
    minimumOrder: 45,
    isAvailable: true,
  });
  const cat7Plov = await Category.create({
    title: "Национальные блюда",
    image: "https://images.unsplash.com/photo-1603133872875-684f208fbfa9?w=400",
    restaurantId: rest7._id,
  });
  await Food.insertMany([
    {
      title: "Плов Ош-Палов",
      description: "Традиционный таджикский плов",
      price: 60,
      image:
        "https://images.unsplash.com/photo-1603133872875-684f208fbfa9?w=400",
      categoryId: cat7Plov._id,
      restaurantId: rest7._id,
    },
    {
      title: "Шурпа",
      description: "Наваристый мясной суп с овощами",
      price: 40,
      image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400",
      categoryId: cat7Plov._id,
      restaurantId: rest7._id,
    },
  ]);

  // --- RESTAURANT 8: Wok & Roll ---
  const rest8 = await Restaurant.create({
    name: "Wok & Roll",
    slug: "wok-roll",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600",
    address: "пр. Рудаки 88, Душанбе",
    location: { type: "Point", coordinates: [68.78, 38.59] },
    zoneId: zone._id,
    username: "wokroll",
    passwordHash: restPasswordHash,
    tax: 9,
    minimumOrder: 65,
    isAvailable: true,
  });
  const cat8Wok = await Category.create({
    title: "Азиатская лапша",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400",
    restaurantId: rest8._id,
  });
  await Food.insertMany([
    {
      title: "Wok с Курицей",
      description: "Пшеничная лапша с овощами и соусом терияки",
      price: 50,
      image:
        "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400",
      categoryId: cat8Wok._id,
      restaurantId: rest8._id,
    },
    {
      title: "Спринг-роллы",
      description: "Хрустящие мини-рулетики с овощами",
      price: 30,
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400",
      categoryId: cat8Wok._id,
      restaurantId: rest8._id,
    },
  ]);

  // --- RESTAURANT 9: Кондитерская Sweet Life ---
  const rest9 = await Restaurant.create({
    name: "Sweet Life",
    slug: "sweet-life",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600",
    address: "ул. Шотэмур 32, Душанбе",
    location: { type: "Point", coordinates: [68.79, 38.57] },
    zoneId: zone._id,
    username: "sweetlife",
    passwordHash: restPasswordHash,
    tax: 5,
    minimumOrder: 40,
    isAvailable: true,
  });
  const cat9Desserts = await Category.create({
    title: "Десерты и Торты",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400",
    restaurantId: rest9._id,
  });
  await Food.insertMany([
    {
      title: "Торт Медовик",
      description: "Классический медовый торт со сметанным кремом",
      price: 35,
      image:
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400",
      categoryId: cat9Desserts._id,
      restaurantId: rest9._id,
    },
    {
      title: "Эклер",
      description: "Французский эклер с заварным кремом",
      price: 18,
      image:
        "https://images.unsplash.com/photo-1612203985729-70726954388c?w=400",
      categoryId: cat9Desserts._id,
      restaurantId: rest9._id,
    },
  ]);

  // --- RESTAURANT 10: Shawarma City ---
  const rest10 = await Restaurant.create({
    name: "Shawarma City",
    slug: "shawarma-city",
    image: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=600",
    address: "ул. Борбад 72, Душанбе",
    location: { type: "Point", coordinates: [68.74, 38.54] },
    zoneId: zone._id,
    username: "shawarmacity",
    passwordHash: restPasswordHash,
    tax: 6,
    minimumOrder: 35,
    isAvailable: true,
  });
  const cat10Fast = await Category.create({
    title: "Стрит-фуд",
    image: "https://images.unsplash.com/photo-1561651823-34fed022540d?w=400",
    restaurantId: rest10._id,
  });
  await Food.insertMany([
    {
      title: "Шаурма Классическая",
      description: "Куриное мясо, овощи, фирменный соус в лаваше",
      price: 32,
      image:
        "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=400",
      categoryId: cat10Fast._id,
      restaurantId: rest10._id,
    },
    {
      title: "Картофельные дольки",
      description: "Запеченный картофель со специями",
      price: 18,
      image:
        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
      categoryId: cat10Fast._id,
      restaurantId: rest10._id,
    },
  ]);

  // 8. CREATE RESTAURANT REVIEWS
  const reviews = [
    {
      r: 0,
      u: 0,
      rating: 5,
      comment: "Лучший плов в городе, рекомендую!",
      orderId: null,
    },
    { r: 0, u: 1, rating: 4, comment: "Хорошо, но ждали доставку 50 мин." },
    { r: 0, u: 2, rating: 5, comment: "Шашлык отменный, мясо сочное." },
    { r: 1, u: 3, rating: 5, comment: "Пицца Маргарита — лучшая в Душанбе!" },
    { r: 1, u: 4, rating: 4, comment: "Паста вкусная, но порция маленькая." },
    {
      r: 2,
      u: 5,
      rating: 3,
      comment: "Чизбургер средний, картофель фри пересолен.",
    },
    {
      r: 2,
      u: 6,
      rating: 5,
      comment: "Обожаю этот бургер! Хрустящий, сочный.",
    },
    { r: 3, u: 7, rating: 4, comment: "Филадельфия свежая, доставили быстро." },
    { r: 4, u: 8, rating: 5, comment: "Капучино как в Италии ☕" },
    {
      r: 6,
      u: 9,
      rating: 5,
      comment: "Шашлык-рай — название говорит само за себя!",
    },
    { r: 7, u: 10, rating: 4, comment: "Плов хороший, но доставка долгая." },
    { r: 8, u: 11, rating: 5, comment: "Wok с курицей — топ!" },
    { r: 9, u: 12, rating: 4, comment: "Медовик свежий и вкусный." },
  ];

  for (const r of reviews) {
    const restaurant = await Restaurant.findOne().skip(r.r);
    const user = createdUsers[r.u];
    if (!restaurant || !user) continue;
    await RestaurantReview.create({
      restaurantId: restaurant._id,
      userId: user._id,
      userName: user.name,
      rating: r.rating,
      comment: r.comment,
      orderId: r.orderId || null,
    });
  }

  // 9. UPDATE RESTAURANT AGGREGATES
  for (let i = 0; i < 10; i++) {
    const rest = (await Restaurant.find().lean())[i];
    if (!rest) continue;
    const stats = await RestaurantReview.aggregate([
      { $match: { restaurantId: rest._id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (stats[0]) {
      await Restaurant.findByIdAndUpdate(rest._id, {
        averageRating: +stats[0].avg.toFixed(2),
        totalRatings: stats[0].count,
      });
    }
  }

  // 10. CREATE DELIVERED ORDERS
  const deliveredOrders = [];
  for (let i = 0; i < 30; i++) {
    const r = await Restaurant.findOne().skip(i % 10);
    const u = createdUsers[i % createdUsers.length];
    const acceptedAt = new Date(Date.now() - (i + 1) * 2 * 60 * 60 * 1000);
    const readyAt = new Date(
      acceptedAt.getTime() + (15 + (i % 25)) * 60 * 1000,
    );
    const deliveredAt = new Date(readyAt.getTime() + 18 * 60 * 1000);
    const amt = 80 + (i % 10) * 10;
    const o = await Order.create({
      orderId: `DBD-${acceptedAt.getTime().toString(36).slice(-6).toUpperCase()}`,
      userId: u._id,
      restaurantId: r._id,
      items: [
        {
          foodId: r._id,
          title: "Случайное блюдо",
          basePrice: amt,
          optionsTotal: 0,
          price: amt,
          quantity: 1,
          image: "",
          description: "",
          selectedOptions: [],
        },
      ],
      orderStatus: "DELIVERED",
      paymentMethod: "COD",
      paid: true,
      paidAt: deliveredAt,
      deliveryAddress: {
        address: "Test Address 1",
        city: "Душанбе",
        location: { type: "Point", coordinates: [68.78, 38.57] },
      },
      pickupAddress: {
        name: r.name,
        address: r.address || "",
        location: r.location,
      },
      amounts: {
        subtotal: amt,
        tax: 0,
        deliveryFee: 15,
        total: amt + 15,
      },
      statusTimestamps: {
        pendingAt: acceptedAt,
        acceptedAt,
        readyAt,
        deliveredAt,
      },
    });
    deliveredOrders.push(o);
  }

  // 11. CREATE FOOD REVIEWS
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

  // 12. CREATE ADMINISTRATIVE ROLES
  const roles = ["DISPATCHER", "FINANCE", "OPERATIONS", "SUPPORT", "ANALYST"];
  for (const role of roles) {
    const rHash = await bcrypt.hash(`${role.toLowerCase()}123`, 10);
    await Owner.create({
      email: `${role.toLowerCase()}@dastbadast.tj`,
      passwordHash: rHash,
      userType: role,
      permissions: {
        canManageRestaurants: ["OPERATIONS"].includes(role),
        canManageRiders: ["DISPATCHER", "OPERATIONS"].includes(role),
        canManageZones: ["OPERATIONS"].includes(role),
        canManageConfiguration: ["FINANCE"].includes(role),
        canViewAccounting: ["FINANCE", "ANALYST"].includes(role),
        canAssignRiders: ["DISPATCHER", "OPERATIONS"].includes(role),
        canManageUsers: ["SUPPORT"].includes(role),
      },
      isActive: true,
    });
  }

  console.log("✅ Seed complete");
  console.log(
    `\n📱 КЛИЕНТСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (${createdUsers.length} Пользователей):`,
  );
  console.log(
    `   Создано 15 пользователей от alisher@dastbadast.tj до laylo@dastbadast.tj`,
  );
  console.log(`   Пароль для всех клиентов: user123`);

  console.log("\n🛵 КУРЬЕРСКИЕ МОБИЛЬНЫЕ ДАННЫЕ (10 Курьеров):");
  console.log(`   Логины: courier1 ... courier10`);
  console.log(`   Пароль для всех курьеров: rider123`);

  console.log("\n🖥 ПАНЕЛЬ РЕСТОРАНОВ (10 Ресторанов):");
  console.log("   Пароль для всех ресторанов: store123");
  console.log("   1. Chayhana1      6. Shashlykray");
  console.log("   2. Bellaitalia    7. Plovcenter");
  console.log("   3. Burgerhouse    8. Wokroll");
  console.log("   4. Sakurasushi    9. Sweetlife");
  console.log("   5. Coffeebakery   10. Shawarmacity");

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
