// dastbadast-multivendor-api/src/resolvers/web-push.js
//
// ⭐ Шаг 4: подписка/отписка браузера на Web Push + тестовая отправка.

import { GraphQLError } from "graphql";
import { WebPushSubscription } from "../models/WebPushSubscription.js";
import {
  getVapidPublicKey,
  sendWebPushToOwner,
} from "../lib/notifications/webPushService.js";

function requireAuth(ctx) {
  if (ctx.user) return { ownerType: "user", ownerId: ctx.user._id };
  if (ctx.rider) return { ownerType: "rider", ownerId: ctx.rider._id };
  throw new GraphQLError("Not authenticated", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export const vapidPublicKey = () => getVapidPublicKey();

export const subscribeWebPush = async (_p, { input }, ctx) => {
  const { ownerType, ownerId } = requireAuth(ctx);
  const { endpoint, keys, userAgent } = input;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new GraphQLError("Некорректная подписка", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  await WebPushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        ownerType,
        ownerId,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: userAgent || "",
        lastUsedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return true;
};

export const unsubscribeWebPush = async (_p, { endpoint }, ctx) => {
  const { ownerType, ownerId } = requireAuth(ctx);
  if (!endpoint) return false;
  const result = await WebPushSubscription.deleteOne({
    endpoint,
    ownerType,
    ownerId,
  });
  return result.deletedCount > 0;
};

export const sendTestWebPush = async (_p, _a, ctx) => {
  const { ownerType, ownerId } = requireAuth(ctx);
  await sendWebPushToOwner({
    ownerType,
    ownerId,
    title: "🔔 Тестовое уведомление",
    body: "Если вы это видите — Web Push работает!",
    data: { deepLink: "/profile" },
  });
  return true;
};
