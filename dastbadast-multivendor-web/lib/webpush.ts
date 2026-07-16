// dastbadast-multivendor-web/lib/webpush.ts
//
// ⭐ Шаг 4: хелперы для регистрации Service Worker и подписки на Web Push (VAPID).

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Запрашивает разрешение на уведомления и создаёт подписку PushManager.
 * Возвращает null, если браузер не поддерживает push или пользователь отказал.
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

/** Приводит PushSubscription к форме входных данных GraphQL-мутации subscribeWebPush */
export function subscriptionToInput(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint as string,
    keys: {
      p256dh: json.keys?.p256dh as string,
      auth: json.keys?.auth as string,
    },
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}
