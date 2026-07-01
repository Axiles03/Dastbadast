import { useEffect, useMemo, useCallback, useState } from "react";
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
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import {
  RESTAURANT_ORDERS,
  ACCEPT_ORDER,
  CANCEL_ORDER,
  SUB_PLACE_ORDER,
} from "../../lib/api/graphql/queries";
import { useAuth } from "../../lib/auth-context";
import Toast from "react-native-toast-message";
import * as Haptics from "expo-haptics";
import { playNewOrderSignal } from "../../lib/sound";
import {
  formatTimeAgo,
  formatOrdersCount,
  formatItemsCount,
} from "../../lib/format";
import { EmptyState } from "../../components/EmptyState";
import { cn } from "../../lib/cn";
import { SafeAreaView } from "react-native-safe-area-context";

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

  useSubscription(SUB_PLACE_ORDER, {
    variables: { restaurantId: restaurant?.id },
    skip: !restaurant?.id,
    onData: ({ data: subData, client }: any) => {
      const order = subData?.data?.subscribePlaceOrder;
      if (!order) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      Toast.show({
        type: "success",
        text1: "🔔 Новый заказ!",
        text2: `Сумма: ${order.amounts?.total} сом.`,
        visibilityTime: 5000,
      });
      client.refetchQueries({ include: [RESTAURANT_ORDERS] });
    },
  });

  useEffect(() => {
    if (restaurant?.id) refetch();
  }, [restaurant?.id, refetch]);

  const [acceptOrder, { loading: acLoading }] = useMutation(ACCEPT_ORDER);
  const [cancelOrder, { loading: cancelLoading }] = useMutation(CANCEL_ORDER);

  // ⭐ Модалка выбора времени приготовления
  const [prepModal, setPrepModal] = useState<{
    orderId: string;
    order: any;
  } | null>(null);
  const [prepTime, setPrepTime] = useState<number>(DEFAULT_PREP_TIME);

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
    },
    [data],
  );

  const confirmAccept = async () => {
    if (!prepModal) return;
    try {
      await acceptOrder({
        variables: {
          input: { orderId: prepModal.orderId, prepTime },
        },
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

  const orders = data?.restaurantOrders ?? [];
  const busy = acLoading || cancelLoading;

  const stats = useMemo(() => {
    const total = orders.length;
    const totalAmount = orders.reduce(
      (s: number, o: any) => s + (o.amounts?.total ?? 0),
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
                    {item.amounts?.total} сом.
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
}: {
  visible: boolean;
  order: any;
  selected: number;
  onSelect: (m: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
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
                {order.amounts?.total} сом.
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
