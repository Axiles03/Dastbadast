import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  RESTAURANT_ORDERS,
  MARK_ORDER_READY,
} from "../../lib/api/graphql/queries";
import { useAuth } from "../../lib/auth-context";
import { SegmentedTabs } from "../../components/SegmentedTabs";
import { EmptyState } from "../../components/EmptyState";
import { StatusPill } from "../../components/StatusPill";
import { cn } from "../../lib/cn";
import { usePrepRemainingMs, formatPrepRemaining } from "../../lib/prep-timer";
import {
  formatDateTime,
  formatOrdersCount,
  formatItemsCount,
  pluralize,
} from "../../lib/format";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "cooking" | "history";

const PREP_TIME = 20;

export default function Processing() {
  const { restaurant } = useAuth();
  const [tab, setTab] = useState<Tab>("cooking");

  const { data, loading, refetch } = useQuery(RESTAURANT_ORDERS, {
    variables: { status: "ACCEPTED" },
    pollInterval: 15_000,
    skip: !restaurant?.id,
  }) as any;

  const [markOrderReady, { loading: markingReady }] =
    useMutation(MARK_ORDER_READY);

  const handleMarkReady = async (orderId: string) => {
    try {
      await markOrderReady({ variables: { orderId } });
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось отметить заказ готовым");
    }
  };

  const {
    data: histAll,
    loading: histLoading,
    refetch: refetchHist,
  } = useQuery(RESTAURANT_ORDERS, {
    variables: { status: "DELIVERED" },
    pollInterval: 30_000,
    skip: !restaurant?.id || tab !== "history",
  }) as any;

  const {
    data: cancAll,
    loading: cancLoading,
    refetch: refetchCanc,
  } = useQuery(RESTAURANT_ORDERS, {
    variables: { status: "CANCELLED" },
    skip: !restaurant?.id || tab !== "history",
  }) as any;

  useEffect(() => {
    if (restaurant?.id) refetch();
  }, [restaurant?.id, refetch]);

  useEffect(() => {
    if (tab === "history") {
      refetchHist();
      refetchCanc();
    }
  }, [tab, refetchHist, refetchCanc]);

  const orders: any[] = data?.restaurantOrders ?? [];
  const histOrders: any[] = histAll?.restaurantOrders ?? [];
  const cancOrders: any[] = cancAll?.restaurantOrders ?? [];

  const history = useMemo(() => {
    return [...histOrders, ...cancOrders].sort(
      (a, b) =>
        new Date(
          b.statusTimestamps?.deliveredAt ||
            b.statusTimestamps?.cancelledAt ||
            b.createdAt,
        ).getTime() -
        new Date(
          a.statusTimestamps?.deliveredAt ||
            a.statusTimestamps?.cancelledAt ||
            a.createdAt,
        ).getTime(),
    );
  }, [histOrders, cancOrders]);

  const tabs = [
    {
      value: "cooking" as const,
      label: "Готовятся",
      count: orders.length,
      icon: "👨‍🍳",
    },
    {
      value: "history" as const,
      label: "История",
      count: history.length,
      icon: "📦",
    },
  ];

  function PrepCountdown({
    acceptedAt,
    prepTime,
  }: {
    acceptedAt?: string | null;
    prepTime?: number | null;
  }) {
    const { remainingMs, isLate, elapsedMs, totalMs } = usePrepRemainingMs(
      acceptedAt,
      prepTime,
    );

    if (!acceptedAt || !prepTime) return null;

    // Прогресс-бар (0–100%)
    const pct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;

    return (
      <View className="mt-2">
        <View className="flex-row items-center justify-between mb-1.5">
          {isLate ? (
            <View className="flex-row items-center">
              <Text className="text-xs font-bold text-red">
                ⚠️ Задержка {Math.floor((elapsedMs - totalMs) / 60000)} мин
              </Text>
            </View>
          ) : (
            <Text className="text-xs font-bold text-text-soft">
              ⏱ Осталось готовить
            </Text>
          )}
          <Text
            className={cn(
              "text-base font-extrabold font-mono tabular-nums",
              isLate ? "text-red" : "text-accent",
            )}
          >
            {formatPrepRemaining(remainingMs)}
          </Text>
        </View>
        <View className="w-full h-1.5 bg-soft-surface-2 rounded-full overflow-hidden">
          <View
            className={cn(
              "h-full rounded-full transition-all",
              isLate ? "bg-red" : pct > 80 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </View>
      </View>
    );
  }

  const isLoading = tab === "cooking" ? loading : histLoading || cancLoading;

  const renderCookingItem = ({ item }: any) => {
    const elapsed = Math.floor(
      (Date.now() - new Date(item.createdAt).getTime()) / 60_000,
    );
    const isLate = elapsed > PREP_TIME + 5;

    return (
      <View
        className={cn(
          "bg-soft-surface border rounded-2xl p-4 mb-3.5 shadow-soft-sm",
          isLate ? "border-warning border-2" : "border-border",
        )}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-lg font-extrabold text-text tracking-tight">
                #{item.orderId}
              </Text>
              {isLate && (
                <View className="bg-warning-soft rounded-full px-2 py-0.5 border border-warning">
                  <Text className="text-warning-dark text-2xs font-extrabold">
                    ⚠️ Задержка
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-text-muted font-medium">
              ⏱ готовится {elapsed}{" "}
              {pluralize(elapsed, "минуту", "минуты", "минут")}
            </Text>
          </View>
          <Text className="text-lg font-extrabold text-accent tracking-tight">
            {item.amounts?.subtotal} сом.
          </Text>
        </View>

        <View className="bg-soft-surface-2 rounded-xl p-3 mb-2.5">
          <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-0.5">
            📍 Доставить
          </Text>
          <Text className="text-sm text-text font-semibold leading-5">
            {item.deliveryAddress?.city ? `${item.deliveryAddress.city}, ` : ""}
            {item.deliveryAddress?.address}
          </Text>
        </View>

        <View className="pt-2.5 border-t border-border">
          {item.items?.map((it: any) => (
            <Text key={it.foodId} className="text-sm text-text-soft leading-6">
              • {it.title}{" "}
              <Text className="text-accent font-extrabold">×{it.quantity}</Text>
            </Text>
          ))}
        </View>

        <PrepCountdown
          acceptedAt={item.statusTimestamps?.acceptedAt}
          prepTime={item.statusTimestamps?.prepTime}
        />

        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-xs text-text-muted italic leading-4">
            💡 Курьер увидит заказ и сам приедет в ресторан
          </Text>
        </View>

        {(item.orderStatus === "ACCEPTED" ||
          item.orderStatus === "PREPARING") && (
          <TouchableOpacity
            onPress={() => handleMarkReady(item.id)}
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
  };

  const renderHistoryItem = ({ item }: any) => {
    const isDelivered = item.orderStatus === "DELIVERED";
    const ts =
      item.statusTimestamps?.deliveredAt ||
      item.statusTimestamps?.cancelledAt ||
      item.createdAt;
    const itemsCount = item.items?.length || 0;
    const dishesSummary = item.items
      ?.slice(0, 3)
      .map((it: any) => `${it.title} ×${it.quantity}`)
      .join(", ");

    // ⭐ ФИКС: раньше здесь (внутри renderHistoryItem — обычной функции,
    // вызываемой FlatList на каждую строку списка) был отдельный
    // `useMutation(MARK_ORDER_READY)`. Хуки нельзя вызывать внутри функций,
    // которые не являются React-компонентом и вызываются переменное число
    // раз (по одному на элемент списка) — это и давало
    // "Invalid hook call" / "Rendered more hooks than during the previous
    // render". Внизу использую единственный `markOrderReady` из тела
    // компонента Processing (уже объявлен выше, у renderCookingItem).
    //
    // ⭐ ШАГ 5: для заказов в PREPARING/READY_FOR_PICKUP показываем ETA
    const isPrep =
      item.orderStatus === "ACCEPTED" ||
      item.orderStatus === "PREPARING" ||
      item.orderStatus === "READY_FOR_PICKUP";
    let prepRemaining: number | null = null;
    if (
      isPrep &&
      item.statusTimestamps?.acceptedAt &&
      item.statusTimestamps?.prepTime
    ) {
      const elapsedMin =
        (Date.now() - new Date(item.statusTimestamps.acceptedAt).getTime()) /
        60_000;
      prepRemaining = Math.max(
        0,
        Math.ceil(item.statusTimestamps.prepTime - elapsedMin),
      );
    }

    return (
      <View
        className={cn(
          "bg-soft-surface border rounded-2xl p-4 mb-3 shadow-soft-sm",
          isDelivered ? "border-border" : "border-red/30 bg-red-soft/30",
        )}
      >
        <View className="flex-row justify-between items-start mb-2.5">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-base font-extrabold text-text tracking-tight">
                #{item.orderId}
              </Text>
              <StatusPill status={item.orderStatus} />
            </View>
            <Text className="text-xs text-text-muted">
              {isDelivered
                ? `✅ ${formatDateTime(ts)}`
                : `✕ ${formatDateTime(ts)}`}
            </Text>
          </View>
          <Text
            className={cn(
              "text-base font-extrabold tracking-tight",
              isDelivered ? "text-text" : "text-text-muted line-through",
            )}
          >
            {item.amounts?.subtotal} сом.
          </Text>
        </View>
        <View className="bg-soft-surface-2 rounded-xl p-2.5 mb-2.5">
          <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-0.5">
            📍 Доставлено
          </Text>
          <Text className="text-sm text-text-soft leading-5" numberOfLines={2}>
            {item.deliveryAddress?.city ? `${item.deliveryAddress.city}, ` : ""}
            {item.deliveryAddress?.address}
          </Text>
        </View>
        {/* ⭐ ШАГ 5: live ETA countdown для готовящихся заказов */}
        {prepRemaining != null && prepRemaining > 0 && (
          <View className="mt-2 bg-warning-soft border border-warning/30 rounded-lg px-2.5 py-1.5 flex-row items-center gap-1.5">
            <Text className="text-sm">⏱</Text>
            <Text className="text-xs text-warning-dark font-extrabold">
              Осталось готовить: {prepRemaining} мин
            </Text>
          </View>
        )}
        {dishesSummary && (
          <View className="pt-2 border-t border-border">
            <Text
              className="text-sm text-text-soft leading-5"
              numberOfLines={2}
            >
              {dishesSummary}
              {itemsCount > 3 ? ` · + ещё ${itemsCount - 3}` : ""}
            </Text>
            <Text className="text-2xs text-text-muted mt-1 font-medium">
              {formatItemsCount(itemsCount)}
            </Text>
          </View>
        )}
        {!isDelivered && item.cancelReason && (
          <View className="mt-2 bg-red-soft rounded-lg px-2.5 py-1.5">
            <Text className="text-2xs text-red-dark font-semibold">
              Причина: {item.cancelReason}
            </Text>
          </View>
        )}
        {isDelivered && item.riderId && (
          <View className="mt-2 flex-row items-center gap-1.5">
            <Text className="text-2xs text-text-muted">🛵 Курьер выполнил</Text>
          </View>
        )}
      </View>
    );
  };

  if (tab === "cooking") {
    return (
      <View className="flex-1 bg-soft-bg">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />
        {loading && !orders.length ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F26A4A" />
            <Text className="text-text-muted text-sm mt-3">
              Загружаем заказы…
            </Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o: any) => o.id}
            renderItem={renderCookingItem}
            contentContainerStyle={
              orders.length === 0
                ? { flexGrow: 1 }
                : { padding: 16, paddingBottom: 24 }
            }
            ListEmptyComponent={
              <EmptyState
                emoji="👨‍🍳"
                title="Пока тихо"
                subtitle="Принятые заказы появятся здесь — удобно следить за очередью"
              />
            }
          />
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-soft-bg">
      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

      {history.length > 0 && (
        <View className="mx-5 mt-4 bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm flex-row items-end gap-5 flex-wrap">
          <View>
            <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider">
              Выручка (доставлено)
            </Text>
            <Text className="text-2xl font-black text-success mt-0.5">
              {history
                .filter((o: any) => o.orderStatus === "DELIVERED")
                .reduce(
                  (s: number, o: any) => s + (o.amounts?.subtotal ?? 0),
                  0,
                )
                .toLocaleString("ru")}{" "}
              сом.
            </Text>
          </View>
          <View>
            <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider">
              Заказов
            </Text>
            <Text className="text-xl font-extrabold text-text mt-0.5">
              {history.length}
            </Text>
          </View>
          <View>
            <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider">
              Отменено
            </Text>
            <Text className="text-xl font-extrabold text-red mt-0.5">
              {history.filter((o: any) => o.orderStatus === "CANCELLED").length}
            </Text>
          </View>
        </View>
      )}

      {isLoading && !history.length ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F26A4A" />
          <Text className="text-text-muted text-sm mt-3">
            Загружаем историю…
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(o: any) => o.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={
            history.length === 0
              ? { flexGrow: 1 }
              : { padding: 16, paddingBottom: 24 }
          }
          ListEmptyComponent={
            <EmptyState
              emoji="📦"
              title="История пуста"
              subtitle="Завершённые и отменённые заказы появятся здесь"
            />
          }
        />
      )}
    </View>
  );
}
