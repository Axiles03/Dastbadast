// dastbadast-multivendor-api/src/lib/notifications/dispatcher.js
//
// Stub dispatcher: in-memory антиспам + логирование.
// Полная реализация шаблонов и триггеров — в следующем спринте.

import { sendPushToOwner } from "./pushService.js";

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

  await sendPushToOwner({
    ownerType: to,
    ownerId: toId,
    title: event,
    body: JSON.stringify(vars),
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
