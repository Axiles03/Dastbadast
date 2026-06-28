import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useQuery } from "@apollo/client/react";
import { MY_HISTORY } from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const TJS = "сом.";
type Period = "today" | "all";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function HistoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("today");

  const { data, loading, refetch } = useQuery<any>(MY_HISTORY, {
    skip: !token,
    pollInterval: 10000,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  // 🔧 FIX: refetch при каждом фокусе экрана — заказы появятся в истории сразу
  useFocusEffect(
    useCallback(() => {
      if (token) refetch();
    }, [token, refetch]),
  );

  const all: any[] = data?.riderOrders ?? [];

  // Заказы, ожидающие подтверждения клиентом
  const awaiting = useMemo(
    () => all.filter((o: any) => o.orderStatus === "AWAITING_CONFIRMATION"),
    [all],
  );

  const { visible, totalEarnings, totalDelivered, totalRevenue } =
    useMemo(() => {
      const todayStart = startOfToday();
      // В историю попадают только DELIVERED (AWAITING_CONFIRMATION отдельно)
      const filtered = all.filter((o: any) => {
        if (o.orderStatus !== "DELIVERED") return false;
        const t = o.statusTimestamps?.deliveredAt
          ? new Date(o.statusTimestamps.deliveredAt).getTime()
          : new Date(o.createdAt).getTime();
        return period === "all" || t >= todayStart;
      });
      return {
        visible: filtered,
        totalEarnings: filtered.reduce(
          (s, o) => s + (o.amounts?.deliveryFee ?? 0),
          0,
        ),
        totalDelivered: filtered.length,
        totalRevenue: filtered.reduce((s, o) => s + (o.amounts?.total ?? 0), 0),
      };
    }, [all, period]);

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      {/* Header */}
      <View className="bg-soft-surface border-b border-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="px-2">
          <Text className="text-accent text-base font-bold">←</Text>
        </Pressable>
        <Text className="text-text font-bold text-base flex-1">
          📦 История доставок
        </Text>
        <Pressable onPress={() => refetch()} className="px-2">
          <Text className="text-text-muted text-xs">🔄</Text>
        </Pressable>
      </View>

      {/* Переключатель периодов */}
      <View className="flex-row bg-soft-surface border-b border-border px-3 pt-3 gap-2">
        <PeriodTab
          active={period === "today"}
          onPress={() => setPeriod("today")}
          label="Сегодня"
        />
        <PeriodTab
          active={period === "all"}
          onPress={() => setPeriod("all")}
          label="За всё время"
        />
      </View>

      {/* Баннер о заказах, ожидающих подтверждения */}
      {awaiting.length > 0 && (
        <View className="bg-warning-soft border border-warning/30 mx-4 mt-4 rounded-2xl p-3.5">
          <Text className="text-warning-dark font-bold text-sm">
            ⏳ {awaiting.length}{" "}
            {awaiting.length === 1
              ? "заказ ожидает"
              : awaiting.length < 5
                ? "заказа ожидают"
                : "заказов ожидают"}{" "}
            подтверждения клиентом
          </Text>
          <Text className="text-text-soft text-xs mt-1">
            После подтверждения заказы автоматически перейдут в историю.
          </Text>
        </View>
      )}

      {/* Сводка */}
      <View className="bg-soft-surface border border-border mx-4 mt-4 rounded-2xl p-4 shadow-soft-sm">
        <View className="flex-row items-end gap-4 flex-wrap">
          <View>
            <Text className="text-text-muted text-[10px] uppercase tracking-wider font-bold">
              Заработано
            </Text>
            <Text className="text-3xl font-extrabold text-success mt-1">
              {totalEarnings.toFixed(0)} {TJS}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted text-[10px] uppercase tracking-wider font-bold">
              Доставок
            </Text>
            <Text className="text-2xl font-extrabold text-text mt-1">
              {totalDelivered}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted text-[10px] uppercase tracking-wider font-bold">
              Оборот
            </Text>
            <Text className="text-2xl font-extrabold text-text mt-1">
              {totalRevenue.toFixed(0)} {TJS}
            </Text>
          </View>
        </View>
      </View>

      {loading && all.length === 0 ? (
        <ActivityIndicator color="#F26A4A" className="mt-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o: any) => o.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center py-12 px-6">
              <Text className="text-base font-bold text-text-soft text-center">
                {period === "today"
                  ? "Сегодня доставок пока нет"
                  : "История пуста"}
              </Text>
              <Text className="text-xs text-text-muted text-center mt-2">
                Закройте заказ со статусом «Доставлен 🎉», и он появится здесь.
              </Text>
            </View>
          }
          renderItem={({ item }: any) => {
            const when = item.statusTimestamps?.deliveredAt
              ? new Date(item.statusTimestamps.deliveredAt)
              : new Date(item.createdAt);
            return (
              <View className="bg-soft-surface border border-border rounded-2xl p-4 mb-3 shadow-soft-sm">
                <View className="flex-row justify-between items-center border-b border-border pb-2">
                  <Text className="text-base font-extrabold text-text">
                    📦 #{String(item.orderId).substring(0, 8)}
                  </Text>
                  <Text className="text-success text-base font-extrabold">
                    +{item.amounts?.deliveryFee ?? 0} {TJS}
                  </Text>
                </View>
                <Text className="text-text-soft text-xs mt-2">
                  🕐{" "}
                  {when.toLocaleString("ru", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}Итого: {item.amounts?.total} {TJS}
                </Text>
                <View className="mt-2 space-y-0.5">
                  {item.items?.map((i: any) => (
                    <Text key={i.foodId} className="text-xs text-text-soft">
                      • {i.title} × {i.quantity}
                    </Text>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PeriodTab({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-2.5 items-center rounded-t-xl border-b-2 ${
        active
          ? "border-accent bg-accent-soft"
          : "border-transparent bg-transparent"
      }`}
    >
      <Text
        className={`text-sm font-bold ${
          active ? "text-accent" : "text-text-soft"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
