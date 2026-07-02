// dastbadast-multivendor-api/src/lib/notifications/pushService.js
//
// Stub отправки push-уведомлений через Expo Server SDK.
// Реальная интеграция — в следующем спринте Раздела 3.

import { Expo } from "expo-server-sdk";
import { PushToken } from "../../models/PushToken.js";

let expoInstance = null;
function getExpo() {
  if (!expoInstance) {
    expoInstance = new Expo();
  }
  return expoInstance;
}

/**
 * Stub: реальная отправка будет реализована в Разделе 3.
 * Сейчас только логируем.
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

    // ⭐ Stub: в production будет реальный push через Expo SDK
    console.log(
      `[PushStub] ${ownerType}:${ownerId} → ${tokens.length} device(s): "${title}" — "${body}"`,
      { data },
    );

    return [];
  } catch (e) {
    console.warn("[PushStub] error:", e?.message);
    return [];
  }
}

export function localize(template, vars) {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    template,
  );
}
