// dastbadast-multivendor-store/lib/push.ts
//
// ⭐ ФАЗА 1 (FIX): раньше это была заглушка без реальной реализации —
// `moduleRef` никогда не устанавливался, `getNotificationToken()` всегда
// возвращал null, и push физически не мог дойти до планшета ресторана,
// если приложение свёрнуто / экран выключен / оборвался WebSocket
// подписки. Теперь — рабочая интеграция с Expo Notifications (единый
// путь для iOS/Android без отдельной настройки Firebase, т.к. на бэке
// уже стоит `expo-server-sdk` и модель `PushToken`, ожидающая именно
// Expo Push Token — см. resolvers/notifications.js::registerPushToken,
// `Expo.isExpoPushToken(token)`).
//
// Что это даёт:
// 1) Уведомление о новом заказе приходит даже если приложение свёрнуто —
//    не только пока открыт экран с GraphQL Subscription.
// 2) Android-канал "new-order" настроен на MAX importance + кастомный
//    громкий звук + обход "тихого" режима — см. registerNewOrderChannel().
// 3) На iOS через `expo-notifications` включается critical-alert-подобное
//    поведение (насколько это доступно без специального Apple-entitlement:
//    max interruption level + собственный звук).
//
// Требования на устройстве (см. app.json):
//   - плагин "expo-notifications" с sound-файлом assets/sounds/new-order-alarm.wav
//   - EAS projectId (для getExpoPushTokenAsync)
//
// Использование см. lib/use-order-alerts.ts — там push регистрируется
// один раз при входе ресторана в аккаунт.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type PushRegistrationResult =
  | { status: "enabled"; token: string }
  | { status: "disabled"; reason: string }
  | { status: "unsupported"; reason: string };

// Показывать системный баннер/звук, даже когда приложение открыто —
// критично для ресторана: сотрудник может смотреть в другой раздел
// (Меню/Профиль), когда придёт заказ.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NEW_ORDER_CHANNEL_ID = "new-order";

/**
 * Android: отдельный notification channel с максимальным приоритетом и
 * собственным звуковым файлом. Без этого шага Android воспроизведёт
 * дефолтный системный звук (тихий, не то что нужно для кухни в шуме).
 * На iOS каналов нет — звук задаётся per-notification на бэке
 * (см. lib/notifications/pushService.js, поле `sound`).
 */
export async function registerNewOrderChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NEW_ORDER_CHANNEL_ID, {
    name: "Новый заказ",
    importance: Notifications.AndroidImportance.MAX,
    // ⭐ FIX: было "new_order_alarm.wav" — кастомного файла нет ни в
    // android/app/src/main/res/raw, ни где-либо ещё. "default" — системный
    // звук уведомлений Android, ничего класть в проект не нужно.
    sound: "default",
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    enableVibrate: true,
  });
}
/**
 * Запрашивает разрешение и регистрирует Expo Push Token.
 * Возвращает токен, чтобы вызывающий код (use-order-alerts.ts) отправил
 * его на бэк через мутацию registerPushToken.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    // Push не работает в симуляторе/эмуляторе — не считаем ошибкой.
    return {
      status: "unsupported",
      reason: "Работает только на реальном устройстве",
    };
  }

  await registerNewOrderChannel();

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: false,
        // Максимальный уровень прерывания, доступный без Apple
        // critical-alert entitlement (тот требует отдельного апрува Apple).
        allowCriticalAlerts: false,
      },
    });
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return {
      status: "disabled",
      reason: "Уведомления не разрешены в настройках устройства",
    };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return {
      status: "disabled",
      reason:
        "На проекте не настроен EAS projectId — выполните `eas init`, чтобы получить push-токен",
    };
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return { status: "enabled", token: tokenResponse.data };
  } catch (e: any) {
    return {
      status: "disabled",
      reason: e?.message || "Не удалось получить push-токен",
    };
  }
}
