// dastbadast-multivendor-api/src/lib/notifications/triggers.js
//
// Stub: подписки на доменные события, которые шлют push'и клиентам/курьерам.
// Полная реализация — в следующем спринте.

import { pubsub, TOPICS } from "../../pubsub.js";

export function startNotificationTriggers() {
  console.log("[Notif] starting notification triggers (stub)");
  return () => {
    console.log("[Notif] notification triggers stopped");
  };
}
