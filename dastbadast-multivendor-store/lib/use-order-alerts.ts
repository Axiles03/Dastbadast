// dastbadast-multivendor-store/lib/use-order-alerts.ts
//
// ⭐ ФАЗА 1: единая точка интеграции для трёх фиксов аудита:
//   1) Реальная регистрация push-токена (lib/push.ts) при входе ресторана.
//   2) Wake Lock, пока есть непрочитанные PENDING-заказы — экран
//      планшета не должен гаснуть в момент, когда играет сигнал.
//   3) Уже существующий playNewOrderSignal/stopNewOrderSignal (lib/sound.ts),
//      теперь дающий зацикленный сигнал, а не одну вибрацию.
//
// Использование в app/(tabs)/new.tsx — минимальный дифф:
//
//   import { useOrderAlerts } from "../../lib/use-order-alerts";
//   ...
//   const { activateSignal, silenceSignal } = useOrderAlerts(pendingCount);
//
//   // вместо прежнего:
//   //   playNewOrderSignal().catch(() => {});
//   // теперь:
//   activateSignal();
//
//   // при ackOrderReceivedMutation.then(...) или при уходе с экрана:
//   silenceSignal();

import { useCallback, useEffect, useRef } from "react";
import * as KeepAwake from "expo-keep-awake";
import { registerForPushNotificationsAsync } from "./push";
import { playNewOrderSignal, stopNewOrderSignal } from "./sound";
import { REGISTER_PUSH_TOKEN } from "./api/graphql/queries";
import { Platform } from "react-native";
import { useMutation } from "@apollo/client/react";

const KEEP_AWAKE_TAG = "dastbadast-new-orders";

export function useOrderAlerts(pendingOrdersCount: number) {
  const [registerPushToken] = useMutation(REGISTER_PUSH_TOKEN);
  const pushRegisteredRef = useRef(false);

  // Регистрируем push один раз за сессию входа. Молча пропускаем
  // ошибки/отказы — это не должно блокировать работу с заказами,
  // подписка на subscription остаётся основным каналом, push —
  // дополнительная гарантия доставки при свёрнутом приложении.
  useEffect(() => {
    if (pushRegisteredRef.current) return;
    pushRegisteredRef.current = true;

    (async () => {
      const result = await registerForPushNotificationsAsync();
      if (result.status !== "enabled") return;
      try {
        await registerPushToken({
          variables: {
            input: {
              token: result.token,
              platform: Platform.OS === "ios" ? "ios" : "android",
              locale: "ru",
            },
          },
        });
      } catch {
        // Не критично — при следующем открытии приложения попробуем снова.
      }
    })();
  }, [registerPushToken]);

  // Wake Lock, пока есть хотя бы один непрочитанный PENDING-заказ —
  // экран не должен уснуть в момент, когда играет зацикленный сигнал.
  useEffect(() => {
    if (pendingOrdersCount > 0) {
      KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    } else {
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    }
    return () => {
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [pendingOrdersCount > 0]);

  const activateSignal = useCallback(() => {
    playNewOrderSignal().catch(() => {});
  }, []);

  const silenceSignal = useCallback(() => {
    stopNewOrderSignal().catch(() => {});
  }, []);

  return { activateSignal, silenceSignal };
}
