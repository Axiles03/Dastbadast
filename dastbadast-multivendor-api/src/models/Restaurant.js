// dastbadast-multivendor-api/src/models/Restaurant.js
import mongoose from "mongoose";

const RestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    image: { type: String, default: "" },
    address: { type: String, default: "" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    workingHours: {
      open: { type: String, default: "09:00" },
      close: { type: String, default: "23:00" },
      isAlwaysOpen: { type: Boolean, default: false },
    },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    tax: { type: Number, default: 0 },
    minimumOrder: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },

    // ⭐ ШАГ 5 (FIX): "Пятничный завал" — раньше ресторан мог влиять на
    // загрузку кухни только вручную указывая prepTime на КАЖДЫЙ заказ по
    // отдельности (см. acceptOrder). Не было способа сказать "сейчас у нас
    // общая перегрузка" одним переключателем — ни +N минут ко всем новым
    // заказам сразу, ни режима "принимаем только предзаказы".
    busyMode: {
      enabled: { type: Boolean, default: false },
      // Добавляется к suggestedPrepTime в kitchenLoad (см. resolvers/order.js)
      // — то есть влияет на РЕКОМЕНДАЦИЮ, которую видит менеджер в модалке
      // принятия заказа, а не жёстко навязывает время без его участия.
      extraPrepMinutes: { type: Number, default: 0, min: 0, max: 60 },
      // ⚠️ Пока не имеет полноценного flow "предзаказ на конкретное время"
      // (это отдельная фича — планирование заказов). На данном этапе
      // preOrdersOnly=true просто блокирует немедленные заказы (placeOrder)
      // с понятным сообщением клиенту — временная мера до полноценных
      // pre-orders.
      preOrdersOnly: { type: Boolean, default: false },
      enabledAt: { type: Date, default: null },
      // Опциональное сообщение для клиента в корзине/на странице ресторана,
      // например "Высокая загрузка, доставка может занять больше времени".
      note: { type: String, default: "", maxlength: 200 },
    },
  },

  { timestamps: true },
);

RestaurantSchema.index({ location: "2dsphere" });

export const Restaurant = mongoose.model("Restaurant", RestaurantSchema);
