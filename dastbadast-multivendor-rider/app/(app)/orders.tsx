import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import {
  useQuery,
  useMutation,
  useSubscription,
  useApolloClient,
} from "@apollo/client/react";
import {
  MY_ORDERS,
  AVAILABLE_ORDERS,
  CLAIM_ORDER,
  UPDATE_STATUS,
  TOGGLE,
  SUB_ASSIGNED,
  SUB_AVAILABLE,
  SUB_RIDER_ORDER_COMPLETED,
} from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import Toast from "react-native-toast-message";
import { useRouter, useFocusEffect } from "expo-router";
import { startGpsLoop, stopGpsLoop } from "../../lib/gps";
import { SafeAreaView } from "react-native-safe-area-context";

function AddressBlock({
  label,
  name,
  city,
  address,
}: {
  label: string;
  name?: string;
  city?: string;
  address?: string;
}) {
  const line = [city, address].filter(Boolean).join(", ");
  return (
    <View className="mt-2.5">
      <Text className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
        {label}
      </Text>
      {name ? (
        <Text className="text-sm font-bold text-text mt-0.5">{name}</Text>
      ) : null}
      <Text className="text-sm text-text-soft mt-0.5">{line || "—"}</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const { rider, token, logout } = useAuth();
  const router = useRouter();
  const client = useApolloClient();
  const [available, setAvailable] = useState(true);
  const [tab, setTab] = useState<"pool" | "mine">("pool");

  // GPS lifecycle
  useEffect(() => {
    if (!token || !rider) return;
    startGpsLoop(client);
    return () => stopGpsLoop();
  }, [client, token, rider]);

  const {
    data: poolData,
    loading: poolLoading,
    refetch: refetchPool,
  } = useQuery<any>(AVAILABLE_ORDERS, {
    pollInterval: 10_000,
    skip: !token,
  });

  const {
    data: myData,
    loading: myLoading,
    refetch: refetchMine,
  } = useQuery<any>(MY_ORDERS, {
    variables: { status: null },
    pollInterval: 8_000,
    skip: !token,
  });

  // Refetch только один раз при mount, дальше работают подписки
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      const t = setTimeout(() => {
        refetchPool();
        refetchMine();
      }, 100);
      return () => clearTimeout(t);
    }, [token, refetchPool, refetchMine]),
  );

  useSubscription(SUB_ASSIGNED, {
    variables: { riderId: rider?.id },
    skip: !rider?.id,
    onData: () => {
      refetchMine();
      refetchPool();
    },
  });

  useSubscription(SUB_AVAILABLE, {
    variables: { zoneId: null },
    skip: !token,
    onData: () => refetchPool(),
  });

  useSubscription(SUB_RIDER_ORDER_COMPLETED, {
    variables: { riderId: rider?.id },
    skip: !rider?.id,
    onData: (options) => {
      const payload = options.data?.data as
        | { subscriptionRiderOrderCompleted?: { id: string; orderId: string } }
        | undefined;
      if (payload?.subscriptionRiderOrderCompleted) {
        refetchMine();
        refetchPool();
        Toast.show({
          type: "success",
          text1: "✅ Заказ подтверждён клиентом",
          text2: `#${payload.subscriptionRiderOrderCompleted.orderId.substring(0, 8)} ушёл в историю`,
          visibilityTime: 4000,
        });
      }
    },
  });

  const [claimOrder, { loading: claiming }] = useMutation(CLAIM_ORDER);
  const [updateStatus, { loading: updating }] = useMutation(UPDATE_STATUS);
  const [toggleRider] = useMutation(TOGGLE);

  const onAvailableChange = useCallback(
    async (v: boolean) => {
      setAvailable(v);
      try {
        await toggleRider({ variables: { available: v } });
        if (v) refetchPool();
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "");
        setAvailable(!v);
      }
    },
    [toggleRider, refetchPool],
  );

  const onClaim = useCallback(
    async (orderId: string) => {
      try {
        await claimOrder({ variables: { orderId } });
        setTab("mine");
        refetchMine();
        refetchPool();
        Alert.alert("Готово", "Заказ ваш — заберите в ресторане");
      } catch (e: any) {
        Alert.alert("Не удалось", e?.message ?? "Заказ уже взяли");
        refetchPool();
      }
    },
    [claimOrder, refetchMine, refetchPool],
  );

  const setStatus = useCallback(
    async (orderId: string, status: "PICKED" | "AWAITING_CONFIRMATION") => {
      try {
        await updateStatus({ variables: { input: { orderId, status } } });
        refetchMine();
        if (status === "AWAITING_CONFIRMATION") {
          Alert.alert(
            "✅ Отмечено как доставленное",
            "Заказ ожидает подтверждения клиентом. Как только клиент подтвердит — он уйдёт в историю, и вы получите новые заказы.",
            [{ text: "Понятно" }],
          );
        }
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "");
      }
    },
    [updateStatus, refetchMine],
  );

  const pool = poolData?.availableOrdersForRiders || [];
  const myOrders = (myData?.riderOrders || []).filter(
    (o: any) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );

  const loading = tab === "pool" ? poolLoading : myLoading;

  const renderPoolItem = useCallback(
    ({ item }: any) => (
      <View className="bg-soft-surface border border-border rounded-2xl p-4 mb-3 shadow-soft-sm">
        <View className="flex-row justify-between items-center border-b border-border pb-2">
          <Text className="text-base font-extrabold text-text">
            📦 #{item.orderId.substring(0, 8)}
          </Text>
          <Text className="text-xs font-bold text-accent-dark bg-accent-soft px-2.5 py-1 rounded-lg">
            Ждёт курьера
          </Text>
        </View>

        <AddressBlock
          label="Откуда (Ресторан)"
          name={item.pickupAddress?.name}
          address={item.pickupAddress?.address}
        />
        <AddressBlock
          label="Куда (Клиент)"
          city={item.deliveryAddress?.city}
          address={item.deliveryAddress?.address}
        />

        {item.note ? (
          <View className="bg-soft-surface-2 p-2.5 rounded-xl mt-3 border border-border/40">
            <Text className="text-xs italic text-text-soft">
              💬 {item.note}
            </Text>
          </View>
        ) : null}

        <View className="mt-3 pt-2 border-t border-border/30 space-y-0.5">
          {item.items.map((i: any) => (
            <Text key={i.foodId} className="text-xs text-text-soft font-medium">
              • {i.title}{" "}
              <Text className="text-text font-bold">×{i.quantity}</Text>
            </Text>
          ))}
        </View>

        <View className="flex-row items-center justify-between mt-4 pt-2 border-t border-border">
          <Text className="text-lg font-black text-success">
            {item.amounts?.total} сом.
          </Text>
          <Pressable
            disabled={claiming || !available}
            onPress={() => onClaim(item.id)}
            className={`px-6 h-11 rounded-xl items-center justify-center active:scale-[0.98] ${
              available ? "bg-accent" : "bg-border opacity-40"
            }`}
          >
            <Text className="text-text-inverse font-bold text-sm">
              {claiming ? "..." : "Взять заказ"}
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [claiming, available, onClaim],
  );

  const renderMyItem = useCallback(
    ({ item }: any) => {
      const isAwaiting = item.orderStatus === "AWAITING_CONFIRMATION";
      const isDelivering = item.orderStatus === "PICKED";
      return (
        <View
          className={`bg-soft-surface border rounded-2xl p-4 mb-3 shadow-soft-sm ${
            isAwaiting
              ? "border-warning"
              : isDelivering
                ? "border-info"
                : "border-border"
          }`}
        >
          <View className="flex-row justify-between items-center border-b border-border pb-2">
            <Text className="text-base font-extrabold text-text">
              📦 #{item.orderId.substring(0, 8)}
            </Text>
            <Text
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                isDelivering
                  ? "bg-info-soft text-info-dark border-info/30"
                  : isAwaiting
                    ? "bg-warning-soft text-warning-dark border-warning/30"
                    : "bg-soft-surface-2 text-text-soft border-border"
              }`}
            >
              {isDelivering
                ? "🛵 Доставляется"
                : isAwaiting
                  ? "⏳ Ждём подтверждения"
                  : item.orderStatus}
            </Text>
          </View>

          <AddressBlock
            label="Откуда"
            name={item.pickupAddress?.name}
            address={item.pickupAddress?.address}
          />
          <AddressBlock
            label="Куда"
            city={item.deliveryAddress?.city}
            address={item.deliveryAddress?.address}
          />

          {item.note ? (
            <View className="bg-soft-surface-2 p-2.5 rounded-xl mt-3 border border-border/40">
              <Text className="text-xs italic text-text-soft">
                💬 {item.note}
              </Text>
            </View>
          ) : null}

          <View className="mt-3 pt-2 border-t border-border/30 space-y-0.5">
            {item.items.map((i: any) => (
              <Text
                key={i.foodId}
                className="text-xs text-text-soft font-medium"
              >
                • {i.title}{" "}
                <Text className="text-text font-bold">×{i.quantity}</Text>
              </Text>
            ))}
          </View>

          <View className="mt-4 pt-3 border-t border-border flex-row items-center justify-between gap-2 flex-wrap">
            <Text className="text-lg font-black text-success">
              {item.amounts?.total} сом.
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              {(item.orderStatus === "ASSIGNED" ||
                item.orderStatus === "PICKED" ||
                item.orderStatus === "AWAITING_CONFIRMATION") && (
                <Pressable
                  onPress={() => {
                    try {
                      router.push(`/chat/${item.id}?orderCode=${item.orderId}`);
                    } catch {
                      Alert.alert("Чат временно недоступен");
                    }
                  }}
                  className="bg-soft-surface-2 border border-text-muted/30 px-4 h-11 rounded-xl items-center justify-center active:scale-[0.98]"
                >
                  <Text className="text-text font-bold text-xs">💬 Чат</Text>
                </Pressable>
              )}

              {item.orderStatus === "ASSIGNED" && (
                <Pressable
                  disabled={updating}
                  onPress={() => setStatus(item.id, "PICKED")}
                  className="bg-info px-4 h-11 rounded-xl items-center justify-center active:scale-[0.98]"
                >
                  <Text className="text-text-inverse font-bold text-xs">
                    Забрал из ресторана
                  </Text>
                </Pressable>
              )}

              {item.orderStatus === "PICKED" && (
                <Pressable
                  disabled={updating}
                  onPress={() => setStatus(item.id, "AWAITING_CONFIRMATION")}
                  className="bg-success px-5 h-11 rounded-xl items-center justify-center active:scale-[0.98]"
                >
                  <Text className="text-text-inverse font-bold text-xs">
                    Доставлен ✓
                  </Text>
                </Pressable>
              )}

              {item.orderStatus === "AWAITING_CONFIRMATION" && (
                <View className="bg-warning-soft border border-warning/30 px-3 h-11 rounded-xl items-center justify-center">
                  <Text className="text-warning-dark text-xs font-bold">
                    ⏳ Ждём подтверждения
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      );
    },
    [updating, setStatus, router],
  );

  return (
    <SafeAreaView className="flex-1 bg-soft-bg pt-2">
      {/* Header */}
      <View className="bg-soft-surface border-b border-border px-4 py-3 flex-row justify-between items-center shadow-soft-sm">
        <View className="flex-row items-center gap-2">
          <View
            className={`w-2.5 h-2.5 rounded-full ${
              available ? "bg-success" : "bg-accent"
            }`}
          />
          <Text className="text-xl font-black text-text tracking-wide">
            Курьер
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <Text className="text-xs font-semibold text-text-soft">В сети</Text>
          <Switch
            value={available}
            onValueChange={onAvailableChange}
            trackColor={{ false: "#ECE6DA", true: "#16A34A" }}
            thumbColor={available ? "#FFFFFF" : "#9A9388"}
          />
          <Pressable
            onPress={() => router.push("/history")}
            className="bg-soft-surface-2 border border-border h-9 px-3 rounded-xl items-center justify-center active:opacity-80"
          >
            <Text className="text-text text-xs font-bold">📦 История</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
            className="bg-accent-soft border border-accent/20 h-9 px-3 rounded-xl items-center justify-center active:opacity-80"
          >
            <Text className="text-accent-dark text-xs font-bold">Выйти</Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-soft-surface border-b border-border">
        <Pressable
          onPress={() => setTab("pool")}
          className={`flex-1 py-3.5 items-center border-b-2 ${
            tab === "pool" ? "border-accent" : "border-transparent"
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              tab === "pool" ? "text-accent" : "text-text-soft"
            }`}
          >
            Доступные ({pool.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("mine")}
          className={`flex-1 py-3.5 items-center border-b-2 ${
            tab === "mine" ? "border-accent" : "border-transparent"
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              tab === "mine" ? "text-accent" : "text-text-soft"
            }`}
          >
            Мои заказы ({myOrders.length})
          </Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#F26A4A" className="mt-6" /> : null}

      {tab === "pool" ? (
        <FlatList
          data={pool}
          keyExtractor={(o: any) => o.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          ListEmptyComponent={
            !poolLoading ? (
              <View className="items-center py-12 px-6">
                <Text className="text-base font-bold text-text-soft text-center">
                  Нет доступных заказов
                </Text>
                <Text className="text-xs text-text-muted text-center mt-2.5 leading-5">
                  Новые заказы появятся сразу, как только их подтвердят
                  рестораны. Включите тумблер «В сети» для возможности подбора.
                </Text>
              </View>
            ) : null
          }
          renderItem={renderPoolItem}
        />
      ) : (
        <FlatList
          data={myOrders}
          keyExtractor={(o: any) => o.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          ListEmptyComponent={
            !myLoading ? (
              <View className="items-center py-12 px-6">
                <Text className="text-base font-bold text-text-soft text-center">
                  У вас нет активных заказов
                </Text>
                <Text className="text-xs text-text-muted text-center mt-2.5">
                  Перейдите во вкладку «Доступные», чтобы взять заказ в работу.
                </Text>
              </View>
            ) : null
          }
          renderItem={renderMyItem}
        />
      )}
    </SafeAreaView>
  );
}
