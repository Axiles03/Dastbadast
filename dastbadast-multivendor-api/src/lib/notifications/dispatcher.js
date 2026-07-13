// dastbadast-multivendor-api/src/lib/notifications/dispatcher.js
//
// Stub dispatcher: in-memory антиспам + логирование.
// Полная реализация шаблонов и триггеров — в следующем спринте.

import { sendPushToOwner, templateFor } from "./pushService.js";

const dedupCache = new Map();
const DEDUP_TTL_MS = 60_000;

function shouldSend(ownerType, ownerId, eventType, entityId) {
  const key = `${ownerType}:${ownerId}:${eventType}:${entityId || ""}`;
  const now = Date.now();
  const last = dedupCache.get(key);
  if (last && now - last < DEDUP_TTL_MS) return false;
  dedupCache.set(key, now);
  return true;
}

/**
 * Stub-нотификатор. В production заменится на полную диспетчеризацию.
 */
export async function notify({ to, toId, event, vars = {}, extra = {} }) {
  if (!toId) return;
  if (!shouldSend(to, toId, event, vars.orderId)) return;

  const template = templateFor(event);
  const title = template?.title ?? event;
  // ⭐ Если у шаблона body === null, значит вызывающая сторона должна была
  // передать готовый текст через extra.body (например, текст чат-сообщения
  // или подпись "📷 Фото"). Иначе fallback на старое поведение (JSON vars).
  const body =
    template && template.body !== null && template.body !== undefined
      ? template.body
      : (extra.body ?? JSON.stringify(vars));

  await sendPushToOwner({
    ownerType: to,
    ownerId: toId,
    title,
    body,
    data: { ...extra, event },
  });
}

// ⭐ Заглушки специализированных хелперов (для компиляции)
export const notifyClientOrderPendingToPreparing = (a) =>
  notify({
    to: "user",
    toId: a.userId,
    event: "ORDER_PENDING_TO_CLIENT",
    vars: a,
  });
export const notifyClientOrderReady = (a) =>
  notify({
    to: "user",
    toId: a.userId,
    event: "ORDER_READY_TO_CLIENT",
    vars: a,
  });
export const notifyClientOrderAssigned = (a) =>
  notify({
    to: "user",
    toId: a.userId,
    event: "ORDER_ASSIGNED_TO_CLIENT",
    vars: a,
  });
export const notifyClientOrderPicked = (a) =>
  notify({
    to: "user",
    toId: a.userId,
    event: "ORDER_PICKED_TO_CLIENT",
    vars: a,
  });
export const notifyClientRiderNearDropOff = (a) =>
  notify({ to: "user", toId: a.userId, event: "ORDER_NEAR_DROP_OFF", vars: a });
export const notifyClientOrderDelivered = (a) =>
  notify({ to: "user", toId: a.userId, event: "ORDER_DELIVERED", vars: a });
export const notifyRidersNewOrder = async ({ riderIds, ...rest }) => {
  await Promise.allSettled(
    (riderIds || []).map((riderId) =>
      notify({
        to: "rider",
        toId: riderId,
        event: "NEW_ORDER_TO_RIDER",
        vars: rest,
      }),
    ),
  );
};
export const notifyRidersEscalation = async ({ riderIds, ...rest }) => {
  await Promise.allSettled(
    (riderIds || []).map((riderId) =>
      notify({
        to: "rider",
        toId: riderId,
        event: "ORDER_ESCALATION_TO_RIDER",
        vars: rest,
      }),
    ),
  );
};
export const notifyRestaurantNewOrder = (a) =>
  notify({
    to: "user",
    toId: a.ownerId,
    event: "NEW_ORDER_TO_RESTAURANT",
    vars: a,
  });

// ⭐⭐⭐ NEW: пуш о новом сообщении в чате заказа — той стороне, которая
// сообщение НЕ отправляла (клиенту, если писал курьер, и наоборот).
// dedup (shouldSend) не даёт заспамить, если обе стороны активно строчат —
// не чаще 1 пуша на orderId раз в DEDUP_TTL_MS (см. выше).
export const notifyNewChatMessage = ({
  toType, // "user" | "rider"
  toId,
  orderId,
  preview, // короткий текст для тела пуша ("Привет!" или "📷 Фото")
}) =>
  notify({
    to: toType,
    toId,
    event:
      toType === "user"
        ? "NEW_CHAT_MESSAGE_TO_USER"
        : "NEW_CHAT_MESSAGE_TO_RIDER",
    vars: { orderId },
    extra: { orderId, body: preview },
  });

import { registerRegistry } from "../../cleanup-cron.js";
registerRegistry(
  "dedupCache", // антиспам: 1 push на owner+event на 60 сек
  dedupCache,
  5 * 60 * 1000, // удалять старше 5 мин
  10000,
);
