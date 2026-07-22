// dastbadast-multivendor-store/lib/sound.ts
//
// ⭐ FIX: раньше здесь использовался expo-audio с кастомным mp3-файлом,
// которого физически не было в assets/sounds/ — бандлер падал на
// require(). Теперь используем встроенный системный звук уведомлений
// через expo-notifications (та же библиотека, что уже используется для
// пушей в lib/push.ts) — никакого кастомного аудиофайла не нужно.
//
// "Зацикленность" сигнала имитируем повторной отправкой локального
// уведомления с интервалом — каждое проигрывает системный звук заново,
// пока менеджер явно не отреагирует (ackOrderReceived → stopNewOrderSignal).

import * as Notifications from "expo-notifications";

let intervalId: ReturnType<typeof setInterval> | null = null;

async function fireSignal() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Новый заказ",
      body: "Требуется подтверждение",
      sound: true, // системный звук уведомления ОС — не кастомный файл
    },
    trigger: null, // немедленно
  });
}

/**
 * Запускает повторяющийся сигнал нового заказа. Безопасно вызывать
 * повторно — если сигнал уже играет, просто ничего не делает.
 */
export async function playNewOrderSignal(): Promise<void> {
  if (intervalId) return;
  try {
    await fireSignal();
    intervalId = setInterval(() => {
      fireSignal().catch(() => {});
    }, 4000);
  } catch {
    // Тихо игнорируем — звук не должен ронять экран заказов.
    intervalId = null;
  }
}

/**
 * Останавливает сигнал. Вызывается после ackOrderReceived (менеджер
 * увидел заказ) или при ручном "Принять к сведению" на экране.
 */
export async function stopNewOrderSignal(): Promise<void> {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // no-op
  }
}
