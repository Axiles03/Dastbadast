// dastbadast-multivendor-api/src/lib/notifications/pushService.js
//
// ⭐⭐⭐ РЕАЛЬНАЯ отправка push-уведомлений через Expo Server SDK.
// Раньше это был stub, который только логировал в консоль. Теперь:
//  - реально шлём чанками через Expo.chunkPushNotifications
//  - помечаем "битые" токены (DeviceNotRegistered) и удаляем их из БД
//  - даём человекочитаемые title/body для известных доменных событий
//    (используется, например, для пуша о новом сообщении в чате и об
//    авто-детекте "курьер приехал")

import { Expo } from "expo-server-sdk";
import { PushToken } from "../../models/PushToken.js";

let expoInstance = null;
function getExpo() {
  if (!expoInstance) {
    expoInstance = new Expo();
  }
  return expoInstance;
}

// ⭐ Шаблоны title/body для известных событий (RU). Событие без шаблона
// просто выводит event как title и JSON vars как body — совместимо со
// старым поведением, чтобы ничего не сломать для ещё не описанных событий.
const TEMPLATES = {
  NEW_CHAT_MESSAGE_TO_USER: () => ({
    title: "💬 Новое сообщение от курьера",
    body: null, // body подставляется вызывающей стороной (текст/фото)
  }),
  NEW_CHAT_MESSAGE_TO_RIDER: () => ({
    title: "💬 Новое сообщение от клиента",
    body: null,
  }),
  ORDER_ARRIVED_AT_DROP_OFF: () => ({
    title: "🛵 Курьер на месте",
    body: "Курьер прибыл и ждёт вас у двери",
  }),
};

/**
 * Отправка push всем верифицированным токенам владельца.
 * Возвращает массив "тикетов" Expo (для отладки/логов), либо [] если
 * отправлять некому или Expo недоступен.
 */
export async function sendPushToOwner({
  ownerType,
  ownerId,
  title,
  body,
  data = {},
  ttlSeconds = 3600,
  sound = "default",
  channelId = "default",
  priority = "high",
  badge,
}) {
  if (!ownerId) return [];

  try {
    const tokens = await PushToken.find({
      ownerType,
      ownerId,
      verified: true,
    }).lean();

    if (tokens.length === 0) return [];

    const expo = getExpo();
    const messages = [];
    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.token)) {
        // Токен не Expo-формата (например, "мусор" от старой версии SDK) — пропускаем.
        continue;
      }
      messages.push({
        to: t.token,
        sound,
        title,
        body: body ?? "",
        data,
        ttl: ttlSeconds,
        channelId,
        priority,
        ...(badge != null ? { badge } : {}),
      });
    }

    if (messages.length === 0) return [];

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    const invalidTokens = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        ticketChunk.forEach((ticket, i) => {
          if (
            ticket.status === "error" &&
            ticket.details?.error === "DeviceNotRegistered"
          ) {
            invalidTokens.push(chunk[i].to);
          }
        });
      } catch (chunkErr) {
        console.warn("[Push] chunk send error:", chunkErr?.message);
      }
    }

    // ⭐ Чистим токены, которые Expo пометил как "устройство больше не
    // зарегистрировано" (переустановка приложения, logout и т.п.) — иначе
    // они будут накапливаться и на каждый пуш возвращать ошибку впустую.
    if (invalidTokens.length > 0) {
      PushToken.deleteMany({ token: { $in: invalidTokens } }).catch(() => {});
    }

    return tickets;
  } catch (e) {
    console.warn("[Push] error:", e?.message);
    return [];
  }
}

export function localize(template, vars) {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    template,
  );
}

export function templateFor(event) {
  const fn = TEMPLATES[event];
  return fn ? fn() : null;
}
