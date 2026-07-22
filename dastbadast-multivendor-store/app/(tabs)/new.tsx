// dastbadast-multivendor-store/app/(tabs)/new.tsx
import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import {
  useQuery,
  useMutation,
  useSubscription,
  useLazyQuery,
} from "@apollo/client/react";
import {
  RESTAURANT_ORDERS,
  ACCEPT_ORDER,
  CANCEL_ORDER,
  SUB_PLACE_ORDER,
  MARK_ORDER_READY,
  KITCHEN_LOAD,
  ACK_ORDER_RECEIVED, // ⭐ ШАГ 4
} from "../../lib/api/graphql/queries";
import { useAuth } from "../../lib/auth-context";
import Toast from "react-native-toast-message";
import * as Haptics from "expo-haptics";
import {
  formatTimeAgo,
  formatOrdersCount,
  formatItemsCount,
} from "../../lib/format";
import { EmptyState } from "../../components/EmptyState";
import { cn } from "../../lib/cn";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrderAlerts } from "../../lib/use-order-alerts"; // Фаза 1
import { buildKitchenTicket } from "../../lib/printer/escpos"; // Фаза 3
import { printTicket } from "../../lib/printer/printer"; // Фаза 3

// Предустановленные опции времени приготовления (мин).
// Шаг 5, диапазон 20..60.
const PREP_TIME_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
const DEFAULT_PREP_TIME = 40;

export default function NewOrders() {
  const { restaurant } = useAuth();

  const {
    data,
    loading,
    refetch,
    error: queryError,
  } = useQuery(RESTAURANT_ORDERS, {
    variables: { status: "PENDING" },
    pollInterval: 15_000,
    skip: !restaurant?.id,
  }) as any;

  const pendingCount = (data?.restaurantOrders ?? []).length;
  const { activateSignal, silenceSignal } = useOrderAlerts(pendingCount);

  // ⭐ ШАГ 4 (FIX): раньше `playNewOrderSignal` импортировался, но НИГДЕ не
  // вызывался — звук при новом заказе физически не проигрывался ни разу, это
  // мёртвый импорт. Плюс: subscription — не единственный канал, по которому
  // ресторан узнаёт о заказе (см. Блок 1 аудита) — если WS-соединение
  // порвано (спящий планшет), заказ всё равно появится через `pollInterval`
  // polling. Раньше в этом случае НЕ было ни звука, ни хаптики, ни ACK —
  // заказ просто молча возникал в списке.
  //
  // `seenOrderIds` — какие PENDING-заказы уже были "объявлены" в этой сессии
  // экрана (звук + haptics + ACK), чтобы не дублировать при каждом опросе.
  // `initializedRef` — при первом рендере СУЩЕСТВУЮЩИЕ PENDING-заказы просто
  // помечаются как виденные, БЕЗ объявления — иначе при каждом открытии
  // вкладки будет играть звук на старые, уже висящие заказы.
  const seenOrderIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [ackOrderReceivedMutation] = useMutation(ACK_ORDER_RECEIVED);

  const announceNewOrder = useCallback(
    (order: any, via: "SUBSCRIPTION" | "POLL") => {
      if (!order?.id || seenOrderIds.current.has(order.id)) return;
      seenOrderIds.current.add(order.id);

      activateSignal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      Toast.show({
        type: "success",
        text1: "🔔 Новый заказ!",
        text2: order.amounts?.subtotal
          ? `Сумма: ${order.amounts.subtotal} сом.`
          : undefined,
        visibilityTime: 5000,
      });

      // ⭐ ACK: сообщаем серверу, что заказ реально отображён на экране и
      // сыграл звук. Fire-and-forget — не блокируем UI; если сеть моргнула,
      // ack просто не запишется, это не критично для UX (в отличие от
      // самого заказа) и переживать за retry здесь не нужно — сервер
      // получит ack при следующем успешном показе с любого устройства.
      ackOrderReceivedMutation({
        variables: { input: { orderId: order.id, via } },
      }).catch(() => {});
    },
    [ackOrderReceivedMutation, activateSignal],
  );

  useSubscription(SUB_PLACE_ORDER, {
    variables: { restaurantId: restaurant?.id },
    skip: !restaurant?.id,
    onData: ({ data: subData, client }: any) => {
      const order = subData?.data?.subscribePlaceOrder;
      if (!order) return;
      announceNewOrder(order, "SUBSCRIPTION");
      client.refetchQueries({ include: [RESTAURANT_ORDERS] });
    },
  });

  useEffect(() => {
    if (restaurant?.id) refetch();
  }, [restaurant?.id, refetch]);

  // ⭐ Резервный канал объявления: если заказ появился в списке через
  // polling (RESTAURANT_ORDERS), а не через WS-подписку — например, WS был
  // разорван (спящий планшет) — тоже проигрываем звук и шлём ACK.
  useEffect(() => {
    const list = data?.restaurantOrders ?? [];
    if (!initializedRef.current) {
      // Первая загрузка экрана: помечаем уже существующие заказы как
      // виденные молча, без звука/ACK.
      for (const o of list) seenOrderIds.current.add(o.id);
      initializedRef.current = true;
      return;
    }
    for (const o of list) {
      if (o.orderStatus === "PENDING") announceNewOrder(o, "POLL");
    }
  }, [data, announceNewOrder]);

  const [acceptOrder, { loading: acLoading }] = useMutation(ACCEPT_ORDER);
  const [cancelOrder, { loading: cancelLoading }] = useMutation(CANCEL_ORDER);

  // ⭐ Модалка выбора времени приготовления
  const [prepModal, setPrepModal] = useState<{
    orderId: string;
    order: any;
  } | null>(null);
  const [prepTime, setPrepTime] = useState<number>(DEFAULT_PREP_TIME);
  // ⭐ NEW: загрузка кухни — подтягиваем актуальные данные в момент открытия
  // модалки (а не статичный список), чтобы предложить реалистичное время.
  type KitchenLoadData = {
    kitchenLoad: {
      queueLength: number;
      avgActualPrepMin: number | null;
      suggestedPrepTime: number;
      isBusy: boolean;
    };
  };
  const [fetchKitchenLoad, { data: kitchenData }] =
    useLazyQuery<KitchenLoadData>(KITCHEN_LOAD, {
      fetchPolicy: "network-only",
    });

  // Просто открывает модалку — без Alert
  const onAccept = useCallback(
    (orderId: string) => {
      const order = (data?.restaurantOrders ?? []).find(
        (o: any) => o.id === orderId,
      );
      if (!order) {
        Alert.alert("Ошибка", "Заказ не найден в списке");
        return;
      }
      setPrepTime(DEFAULT_PREP_TIME);
      setPrepModal({ orderId, order });
      // ⭐ Тянем актуальную загрузку кухни и как только придёт — подставляем
      // рекомендованное время (если пользователь ещё не выбрал своё вручную).
      fetchKitchenLoad().then((res) => {
        const suggested = res.data?.kitchenLoad?.suggestedPrepTime;
        if (typeof suggested === "number") setPrepTime(suggested);
      });
    },
    [data, fetchKitchenLoad],
  );

  const confirmAccept = async () => {
    if (!prepModal) return;
    try {
      await acceptOrder({
        variables: {
          input: { orderId: prepModal.orderId, prepTime },
        },
      });

      silenceSignal(); // ⭐ Фаза 1: заказ принят — сигнал больше не нужен

      // ⭐ Фаза 3: печать кухонного чека — fire-and-forget, не блокирует UI
      // и не роняет принятие заказа, если принтер офлайн/не настроен.
      printTicket(
        buildKitchenTicket({
          shortId: prepModal.orderId.slice(-6),
          createdAt: prepModal.order.createdAt,
          paymentMethod: prepModal.order.paymentMethod,
          paid: prepModal.order.paid,
          note: prepModal.order.note,
          items: prepModal.order.items,
          deliveryAddress: prepModal.order.deliveryAddress,
        }),
      ).then((result) => {
        if (
          !result.ok &&
          result.reason !== "not-configured" &&
          result.reason !== "disabled"
        ) {
          Toast.show({
            type: "error",
            text1: "Не удалось напечатать чек",
            text2: "Заказ принят, но проверьте принтер на кухне",
          });
        }
      });

      Toast.show({
        type: "success",
        text1: "✅ Заказ принят",
        text2: `Время приготовления: ${prepTime} мин`,
      });
      setPrepModal(null);
      refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось принять");
    }
  };

  const handleAccept = async (order: any, prepTime: number) => {
    try {
      await acceptOrderMutation({
        variables: { input: { orderId: order.id, prepTime } },
      });
      silenceSignal(); // из Фазы 1

      // ⭐ ФАЗА 3, п.11: печать кухонного чека сразу при принятии заказа —
      // не блокирует UI (fire-and-forget), не должна ронять флоу принятия
      // заказа, если принтер офлайн/не настроен.
      printTicket(
        buildKitchenTicket({
          shortId: order.id.slice(-6),
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paid: order.paid,
          note: order.note,
          items: order.items,
          deliveryAddress: order.deliveryAddress,
        }),
      ).then((result) => {
        if (
          !result.ok &&
          result.reason !== "not-configured" &&
          result.reason !== "disabled"
        ) {
          // Принтер настроен, но печать не прошла — единственный случай,
          // когда стоит явно предупредить менеджера (если принтер просто
          // не настроен/выключен — это осознанный выбор, молчим).
          Toast.show({
            type: "error",
            text1: "Не удалось напечатать чек",
            text2: "Заказ принят, но проверьте принтер на кухне",
          });
        }
      });

      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось принять заказ");
    }
  };

  const onCancel = useCallback(
    (orderId: string) => {
      Alert.alert("Отменить заказ?", "Клиент получит уведомление", [
        { text: "Назад", style: "cancel" },
        {
          text: "Отменить",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelOrder({
                variables: { input: { orderId, reason: "Нет продуктов" } },
              });
              Toast.show({ type: "info", text1: "Заказ отменён" });
              refetch();
            } catch (e: any) {
              Alert.alert("Ошибка", e?.message ?? "Не удалось отменить");
            }
          },
        },
      ]);
    },
    [cancelOrder, refetch],
  );

  const [markReady, { loading: markingReady }] = useMutation(MARK_ORDER_READY);

  const orders = data?.restaurantOrders ?? [];
  const busy = acLoading || cancelLoading;

  const stats = useMemo(() => {
    const total = orders.length;
    const totalAmount = orders.reduce(
      (s: number, o: any) => s + (o.amounts?.subtotal ?? 0),
      0,
    );
    return { total, totalAmount };
  }, [orders]);

  if (loading && !orders.length) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator size="large" color="#F26A4A" />
        <Text className="text-text-muted text-sm mt-3">Загружаем заказы…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <View className="px-5 pb-2 flex-row items-end justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-text tracking-tight">
            Новые заказы
          </Text>
          <Text className="text-sm text-text-muted mt-0.5">
            Готовьте быстрее — клиент уже ждёт
          </Text>
        </View>
        {stats.total > 0 && (
          <View className="bg-accent rounded-2xl px-3.5 py-2 items-center min-w-[60px] shadow-soft-sm">
            <Text className="text-text-inverse text-xl font-black leading-none">
              {stats.total}
            </Text>
            <Text className="text-text-inverse/90 text-2xs font-bold mt-0.5">
              {formatOrdersCount(stats.total)}
            </Text>
          </View>
        )}
      </View>

      {queryError && (
        <View className="mx-5 my-2 bg-red-soft border border-red/30 rounded-xl px-3 py-2">
          <Text className="text-red text-sm font-semibold">
            ⚠️ {queryError.message}
          </Text>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(o: any) => o.id}
        contentContainerStyle={
          orders.length === 0
            ? { flexGrow: 1 }
            : { padding: 16, paddingBottom: 24 }
        }
        ListEmptyComponent={
          <EmptyState
            emoji="🎉"
            title="Нет новых заказов"
            subtitle="Здесь появятся заказы, как только клиенты их оформят"
          />
        }
        renderItem={({ item }: any) => {
          const minutesAgo = Math.floor(
            (Date.now() - new Date(item.createdAt).getTime()) / 60_000,
          );
          const isUrgent = minutesAgo >= 10;

          return (
            <View
              className={cn(
                "bg-soft-surface border rounded-2xl p-4 mb-3.5 shadow-soft-sm",
                isUrgent
                  ? "bg-accent-soft border-accent border-2"
                  : "border-border",
              )}
            >
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg font-extrabold text-text tracking-tight">
                      #{item.orderId}
                    </Text>
                    {isUrgent && (
                      <View className="bg-red rounded-full px-2 py-0.5">
                        <Text className="text-text-inverse text-2xs font-extrabold">
                          🔥 Срочно
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-text-muted font-medium">
                    ⏱ {formatTimeAgo(item.createdAt)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-extrabold text-accent tracking-tight">
                    {item.amounts?.subtotal} сом.
                  </Text>
                  <Text className="text-2xs text-text-muted font-bold mt-0.5">
                    {formatItemsCount(item.items?.length || 0)}
                  </Text>
                </View>
              </View>

              <View className="bg-soft-surface-2 rounded-xl p-3 mb-2.5">
                <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-0.5">
                  📍 Доставить
                </Text>
                <Text className="text-sm text-text font-semibold leading-5">
                  {item.deliveryAddress?.city
                    ? `${item.deliveryAddress.city}, `
                    : ""}
                  {item.deliveryAddress?.address}
                </Text>
              </View>

              <View className="pt-2.5 border-t border-border">
                {item.items?.map((it: any) => (
                  <Text
                    key={it.foodId}
                    className="text-sm text-text-soft leading-6"
                  >
                    • {it.title}{" "}
                    <Text className="text-accent font-extrabold">
                      ×{it.quantity}
                    </Text>
                  </Text>
                ))}
              </View>

              {item.note && (
                <View className="mt-2.5 bg-warning-soft rounded-xl p-2.5 border-l-[3px] border-warning">
                  <Text className="text-sm text-text italic">
                    💬 {item.note}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-2 mt-3.5">
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onAccept(item.id)}
                  className={cn(
                    "flex-1 h-12 rounded-xl items-center justify-center bg-success shadow-soft-sm",
                    busy ? "opacity-40" : "active:opacity-80",
                  )}
                >
                  <Text className="text-text-inverse font-extrabold text-base tracking-wide">
                    ✓ Принять
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onCancel(item.id)}
                  className={cn(
                    "flex-1 h-12 rounded-xl items-center justify-center bg-soft-surface border border-red",
                    busy ? "opacity-40" : "active:opacity-80",
                  )}
                >
                  <Text className="text-red font-extrabold text-base tracking-wide">
                    ✕ Отменить
                  </Text>
                </TouchableOpacity>
              </View>
              {(item.orderStatus === "ACCEPTED" ||
                item.orderStatus === "PREPARING") && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await markReady({ variables: { orderId: item.id } });
                      await refetch();
                    } catch (e: any) {
                      Alert.alert("Ошибка", e?.message ?? "Не удалось");
                    }
                  }}
                  disabled={markingReady}
                  className="mt-3 h-12 rounded-2xl bg-accent items-center justify-center active:opacity-85"
                >
                  <Text className="text-text-inverse font-extrabold text-base">
                    ✅ Готово — отдать курьеру
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* ⭐ Модалка выбора времени приготовления */}
      {prepModal && (
        <PrepTimeModal
          visible={!!prepModal}
          order={prepModal.order}
          selected={prepTime}
          onSelect={setPrepTime}
          onConfirm={confirmAccept}
          onClose={() => setPrepModal(null)}
          busy={acLoading}
          kitchenLoad={kitchenData?.kitchenLoad ?? null}
        />
      )}
    </SafeAreaView>
  );
}

/* ============== Модалка выбора времени ============== */

function PrepTimeModal({
  visible,
  order,
  selected,
  onSelect,
  onConfirm,
  onClose,
  busy,
  kitchenLoad,
}: {
  visible: boolean;
  order: any;
  selected: number;
  onSelect: (m: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
  kitchenLoad?: {
    queueLength: number;
    avgActualPrepMin: number | null;
    suggestedPrepTime: number;
    isBusy: boolean;
  } | null;
}) {
  if (!visible || !order) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable className="flex-1" onPress={onClose} />

        <View className="bg-soft-surface rounded-t-3xl p-5 pb-8">
          <View className="items-center mb-3">
            <View className="w-12 h-1 bg-border rounded-full" />
          </View>

          <Text className="text-lg font-extrabold text-text">
            Принять заказ
          </Text>

          {/* Информация о заказе */}
          <View className="mt-3 bg-soft-surface-2 border border-border rounded-2xl p-3.5">
            <Text className="text-sm font-bold text-text" numberOfLines={1}>
              Заказ #{String(order.orderId).substring(0, 8)}
            </Text>
            <View className="flex-row justify-between mt-1.5">
              <Text className="text-xs text-text-muted">Сумма</Text>
              <Text className="text-sm font-extrabold text-accent">
                {order.amounts?.subtotal} сом.
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-text-muted">Ожидает с</Text>
              <Text className="text-xs font-bold text-text-soft">
                {formatTimeAgo(order.createdAt)}
              </Text>
            </View>
            {order.deliveryAddress && (
              <View className="mt-2 pt-2 border-t border-border">
                <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-0.5">
                  📍 Доставить
                </Text>
                <Text className="text-xs text-text-soft leading-5">
                  {order.deliveryAddress.city
                    ? `${order.deliveryAddress.city}, `
                    : ""}
                  {order.deliveryAddress.address}
                </Text>
              </View>
            )}
            {order.items && order.items.length > 0 && (
              <View className="mt-2 pt-2 border-t border-border">
                <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-0.5">
                  🍽 Состав
                </Text>
                {order.items.map((it: any) => (
                  <Text key={it.foodId} className="text-xs text-text-soft">
                    • {it.title}{" "}
                    <Text className="text-text-muted">×{it.quantity}</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* ⭐ NEW: загрузка кухни — раньше тут был только статичный список без
              какого-либо учёта реальной очереди заказов */}
          {kitchenLoad && (
            <View
              className={cn(
                "mt-4 rounded-xl px-3 py-2.5 border",
                kitchenLoad.isBusy
                  ? "bg-red-soft border-red/30"
                  : "bg-soft-surface-2 border-border",
              )}
            >
              <Text className="text-xs font-bold text-text">
                {kitchenLoad.isBusy
                  ? "🔥 Кухня загружена"
                  : "🍳 Загрузка кухни"}
                {": "}
                {kitchenLoad.queueLength}{" "}
                {kitchenLoad.queueLength === 1
                  ? "активный заказ"
                  : "активных заказов"}
              </Text>
              <Text className="text-2xs text-text-muted mt-0.5">
                {kitchenLoad.avgActualPrepMin
                  ? `Обычно готовите за ~${kitchenLoad.avgActualPrepMin} мин · `
                  : ""}
                Рекомендуем {kitchenLoad.suggestedPrepTime} мин с учётом очереди
              </Text>
            </View>
          )}

          {/* Заголовок выбора */}
          <Text className="text-sm font-extrabold text-text mt-5">
            ⏱ Сколько времени на готовку?
          </Text>
          <Text className="text-2xs text-text-muted mt-0.5 mb-3">
            Минимум 20 минут · Максимум 60 минут · Шаг 5 минут
          </Text>

          {/* Сетка выбора 3×3 */}
          <View className="flex-row flex-wrap gap-2">
            {PREP_TIME_OPTIONS.map((min) => {
              const active = selected === min;
              return (
                <Pressable
                  key={min}
                  onPress={() => onSelect(min)}
                  className={cn(
                    "w-[31%] py-3.5 rounded-2xl items-center border-2",
                    active
                      ? "bg-accent border-accent"
                      : "bg-soft-surface border-border",
                  )}
                >
                  <Text
                    className={cn(
                      "text-lg font-extrabold",
                      active ? "text-text-inverse" : "text-text",
                    )}
                  >
                    {min}
                  </Text>
                  <Text
                    className={cn(
                      "text-2xs font-bold mt-0.5",
                      active ? "text-text-inverse/80" : "text-text-muted",
                    )}
                  >
                    мин
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Кнопки действий */}
          <View className="flex-row gap-2 mt-5">
            <Pressable
              onPress={onClose}
              className="flex-1 h-12 rounded-2xl items-center justify-center border border-border bg-soft-surface"
            >
              <Text className="text-text-soft font-bold text-base">Отмена</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              className={cn(
                "flex-[2] h-12 rounded-2xl items-center justify-center bg-success shadow-soft-sm",
                busy ? "opacity-40" : "active:opacity-80",
              )}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-text-inverse font-extrabold text-base">
                  ✓ Принять · {selected} мин
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
function acceptOrderMutation(arg0: {
  variables: { input: { orderId: any; prepTime: number } };
}) {
  throw new Error("Function not implemented.");
}
