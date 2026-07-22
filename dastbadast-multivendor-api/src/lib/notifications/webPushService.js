// dastbadast-multivendor-api/src/lib/notifications/webPushService.js
//
//  отправка Web Push через VAPID (без сторонних провайдеров вроде Firebase).
// Работает через стандартный PushManager браузера — endpoint у Chrome ведёт
// на его собственный push-сервис (FCM под капотом у Google, но мы к нему
// не обращаемся напрямую, это делает браузер/библиотека web-push сама).

import webpush from "web-push";
import { WebPushSubscription } from "../../models/WebPushSubscription.js";
import { debugLog, debugWarn } from "../../debug-log.js";

let configured = false;
let configuredOk = false;

function ensureConfigured() {
  if (configured) return configuredOk;
  configured = true;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    debugWarn(
      "WebPush",
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы — web push отключён",
    );
    configuredOk = false;
    return false;
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configuredOk = true;
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Шлёт web push всем браузерным подпискам владельца (user/rider).
 * Невалидные/отозванные подписки (404/410 от push-службы) удаляются сами.
 */
export async function sendWebPushToOwner({
  ownerType,
  ownerId,
  title,
  body,
  data = {},
}) {
  if (!ownerId) return [];
  if (!ensureConfigured()) return [];

  const subs = await WebPushSubscription.find({ ownerType, ownerId }).lean();
  if (subs.length === 0) return [];

  const payload = JSON.stringify({ title, body, data });
  const results = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      );
      results.push({ endpoint: sub.endpoint, ok: true });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // подписка отозвана браузером/пользователем — чистим
        await WebPushSubscription.deleteOne({ endpoint: sub.endpoint });
        debugLog(
          "WebPush",
          "удалена невалидная подписка",
          sub.endpoint.slice(-24),
        );
      } else {
        debugWarn("WebPush", "ошибка отправки", err?.message);
      }
      results.push({ endpoint: sub.endpoint, ok: false });
    }
  }

  debugLog("WebPush", "отправлено", {
    ownerType,
    ownerId: String(ownerId),
    count: results.filter((r) => r.ok).length,
  });
  return results;
}
