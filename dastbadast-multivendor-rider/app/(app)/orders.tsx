// dastbadast-multivendor-rider/app/(app)/orders.tsx

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Vibration,
  ToastAndroid,
  Platform,
  Linking,
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
  SUB_RIDER_LOCATION,
  COURIER_SEARCH_NOTIFY,
} from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { useRouter, useFocusEffect } from "expo-router";
import { startGpsLoop, stopGpsLoop, getPermissionStatus } from "../../lib/gps";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "../../lib/cn";
import { haversineKm } from "../../lib/mapConfig";
import { RiderTopBar } from "../../components/RiderTopBar";
import { ListMapSwitcher } from "../../components/ListMapSwitcher";
import { OrderCard, getUrgency, type Order } from "../../components/OrderCard";
import { MapTabContent } from "../../components/MapTabContent";

function showToast(msg: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    console.log("🍞", msg);
  }
}

export default function OrdersScreen() {
  // ===== ALL HOOKS AT TOP — RULES OF HOOKS =====
  const { rider, token } = useAuth();
  const router = useRouter();
  const client = useApolloClient();
  const [available, setAvailable] = useState(true);
  const [tab, setTab] = useState<"pool" | "mine">("pool");
  const [listMode, setListMode] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // ⭐⭐⭐ FIX: вынес на верхний уровень — был внутри useEffect в шаге 5
  const [latestRiderPos, setLatestRiderPos] = useState<{
    lat: number;
    lng: number;
    bearing?: number | null;
    at: string;
  } | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(i);
  }, []);

  // ===== QUERIES =====
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

  // ⭐⭐⭐ FIX: вынес на верхний уровень — был внутри useCallback/renderItem
  const myOrders = useMemo<Order[]>(
    () =>
      ((myData?.riderOrders ?? []) as any[]).filter(
        (o: any) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
      ) as Order[],
    [myData],
  );

  const pool = useMemo<Order[]>(
    () => (poolData?.availableOrdersForRiders ?? []) as Order[],
    [poolData],
  );

  // ⭐⭐⭐ FIX: вынес на верхний уровень, чтобы был до `renderPoolItem` и `renderMyItem`
  const myOrderWithEta = useMemo<{
    order: Order;
    etaMin: number;
    distanceKm: number;
    target: "pickup" | "delivery";
  } | null>(() => {
    if (!latestRiderPos) return null;
    const priority: Record<string, number> = {
      AWAITING_CONFIRMATION: 4,
      PICKED: 3,
      ASSIGNED: 2,
    };
    const sorted = [...myOrders].sort(
      (a, b) => (priority[b.orderStatus] ?? 0) - (priority[a.orderStatus] ?? 0),
    );
    for (const o of sorted) {
      const target: "pickup" | "delivery" =
        o.orderStatus === "PICKED" || o.orderStatus === "AWAITING_CONFIRMATION"
          ? "delivery"
          : "pickup";
      const targetCoords =
        target === "delivery"
          ? o.deliveryAddress?.location?.coordinates
          : o.pickupAddress?.location?.coordinates;
      if (
        !Array.isArray(targetCoords) ||
        targetCoords.length !== 2 ||
        typeof targetCoords[0] !== "number" ||
        typeof targetCoords[1] !== "number"
      ) {
        continue;
      }
      const [lng, lat] = targetCoords;
      // ✅ FIXED: Changed latestRiderPos.latitude to latestRiderPos.lat
      const km = haversineKm(latestRiderPos.lat, latestRiderPos.lng, lat, lng);
      const etaMin = Math.max(1, Math.round((km / 25) * 60));
      return { order: o, etaMin, distanceKm: km, target };
    }
    return null;
  }, [myOrders, latestRiderPos]);

  // ===== MUTATIONS =====
  const [claimOrder, { loading: claiming }] = useMutation(CLAIM_ORDER);
  const [updateStatus, { loading: updating }] = useMutation(UPDATE_STATUS);
  const [toggleRider] = useMutation(TOGGLE);

  // ===== EFFECTS (GPS, permission check) =====
  useEffect(() => {
    if (!token || !rider || !available) {
      void stopGpsLoop();
      return;
    }
    (async () => {
      const result = await startGpsLoop(client);
      if (!result.ok && result.reason === "denied") {
        setAvailable(false);
      }
    })();
    return () => {
      void stopGpsLoop();
    };
  }, [client, token, rider, available]);

  useEffect(() => {
    if (!rider) return;
    (async () => {
      const status = await getPermissionStatus();
      if (status.foreground === "denied") {
        setPermissionModalOpen(true);
      }
    })();
  }, [rider]);

  // ===== SUBSCRIPTIONS =====
  useSubscription(SUB_RIDER_LOCATION, {
    variables: { riderId: rider?.id },
    skip: !rider?.id,
    onData: ({ data }: any) => {
      const p = data?.data?.subscriptionRiderLocation;
      if (!p || p.stopped) return;
      setLatestRiderPos({
        lat: p.lat,
        lng: p.lng,
        bearing: p.bearing ?? null,
        at: p.updatedAt,
      });
    },
  });

  useSubscription(COURIER_SEARCH_NOTIFY, {
    onData: ({ data: subData }: any) => {
      const ev = subData?.courierSearchNotify;
      if (!ev || !rider?.id) return;
      if (ev.riderIds?.includes(String(rider.id))) {
        showToast(
          ev.escalation
            ? "⚡ Срочно: эскалация поиска"
            : "🔔 Новый заказ рядом",
        );
        try {
          Vibration.vibrate(ev.escalation ? [0, 200, 100, 200] : 100);
        } catch {
          /* ignore */
        }
        refetchPool();
      }
    },
  });

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
        showToast(
          `✅ Заказ #${payload.subscriptionRiderOrderCompleted.orderId.substring(0, 8)} подтверждён`,
        );
      }
    },
  });

  // ===== CALLBACKS (все useCallback — после всех useEffect/useState) =====
  const onClaim = useCallback(
    async (orderId: string) => {
      try {
        await claimOrder({ variables: { orderId } });
        setTab("mine");
        setListMode(true);
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

  const onAvailableChange = useCallback(
    async (v: boolean) => {
      setAvailable(v);
      try {
        await toggleRider({ variables: { available: v } });
        if (v) {
          refetchPool();
          const result = await startGpsLoop(client);
          if (!result.ok) {
            setAvailable(false);
            await toggleRider({ variables: { available: false } });
            if (result.reason === "denied") {
              setPermissionModalOpen(true);
            }
          }
        } else {
          await stopGpsLoop();
        }
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "");
        setAvailable(!v);
      }
    },
    [toggleRider, refetchPool, client],
  );

  const setStatus = useCallback(
    async (orderId: string, status: "PICKED" | "AWAITING_CONFIRMATION") => {
      try {
        await updateStatus({ variables: { input: { orderId, status } } });
        refetchMine();
        if (status === "AWAITING_CONFIRMATION") {
          Alert.alert(
            "✅ Отмечено как доставленное",
            "Заказ ожидает подтверждения клиентом.",
            [{ text: "Понятно" }],
          );
        }
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "");
      }
    },
    [updateStatus, refetchMine],
  );

  const onOpenChat = useCallback(
    (orderId: string) => {
      try {
        router.push(`/chat/${orderId}`);
      } catch {
        Alert.alert("Чат временно недоступен");
      }
    },
    [router],
  );

  // ===== RENDER HELPERS (useCallback — все хуки выше!) =====
  const isLoading = tab === "pool" ? poolLoading : myLoading;
  const busy = claiming || updating;

  const renderPoolItem = useCallback(
    ({ item }: { item: Order }) => {
      const urgency = getUrgency(item, now);
      return (
        <OrderCard
          order={item}
          mode="pool"
          urgency={urgency}
          primaryAction={{
            label: "✅ Взять заказ",
            loading: busy,
            disabled: !available || busy,
            onPress: () => onClaim(item.id),
          }}
        />
      );
    },
    [busy, available, now, onClaim],
  );

  const renderMyItem = useCallback(
    ({ item }: { item: Order }) => {
      const isAwaiting = item.orderStatus === "AWAITING_CONFIRMATION";
      const isDelivering = item.orderStatus === "PICKED";
      const isAssigned = item.orderStatus === "ASSIGNED";
      const canChat = isAssigned || isDelivering || isAwaiting;

      const eta =
        myOrderWithEta && myOrderWithEta.order.id === item.id
          ? myOrderWithEta
          : null;

      return (
        <OrderCard
          order={item}
          mode="mine"
          urgency={null}
          secondaryAction={
            canChat
              ? { label: "💬 Чат", onPress: () => onOpenChat(item.id) }
              : null
          }
          primaryAction={
            isAssigned
              ? {
                  label: "Забрал из ресторана",
                  loading: updating,
                  onPress: () => setStatus(item.id, "PICKED"),
                }
              : isDelivering
                ? {
                    label: "Доставлен ✓",
                    loading: updating,
                    onPress: () => setStatus(item.id, "AWAITING_CONFIRMATION"),
                  }
                : null
          }
          etaMin={eta?.etaMin ?? null}
          etaTarget={eta?.target ?? undefined}
        />
      );
    },
    [updating, onOpenChat, setStatus, myOrderWithEta],
  );

  return (
    <SafeAreaView className="flex-1 bg-soft-bg" edges={[]}>
      <RiderTopBar
        name={rider?.name || rider?.username || ""}
        photo={rider?.photo}
        online={available}
        onToggleOnline={onAvailableChange}
        onOpenSettings={() => router.push("/profile")}
      />

      {listMode && (
        <View className="flex-row bg-soft-surface border-b border-border">
          <Pressable
            onPress={() => setTab("pool")}
            className={cn(
              "flex-1 py-3.5 items-center border-b-2",
              tab === "pool" ? "border-accent" : "border-transparent",
            )}
          >
            <Text
              className={cn(
                "text-sm font-extrabold",
                tab === "pool" ? "text-accent" : "text-text-soft",
              )}
            >
              🔔 Доступные ({pool.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("mine")}
            className={cn(
              "flex-1 py-3.5 items-center border-b-2",
              tab === "mine" ? "border-accent" : "border-transparent",
            )}
          >
            <Text
              className={cn(
                "text-sm font-extrabold",
                tab === "mine" ? "text-accent" : "text-text-soft",
              )}
            >
              🛵 Мои ({myOrders.length})
            </Text>
          </Pressable>
        </View>
      )}

      {listMode ? (
        isLoading &&
        (tab === "pool" ? pool.length === 0 : myOrders.length === 0) ? (
          <ActivityIndicator color="#F26A4A" className="mt-6" />
        ) : (
          <FlatList
            data={tab === "pool" ? pool : myOrders}
            keyExtractor={(o: Order) => o.id}
            contentContainerStyle={{
              padding: 12,
              paddingBottom: 110,
            }}
            ListEmptyComponent={
              <View className="items-center py-12 px-6">
                <Text className="text-base font-bold text-text-soft text-center">
                  {tab === "pool"
                    ? "Нет доступных заказов"
                    : "У вас нет активных заказов"}
                </Text>
                <Text className="text-xs text-text-muted text-center mt-2.5 leading-5">
                  {tab === "pool"
                    ? "Новые заказы появятся автоматически. Включите тумблер «В сети»."
                    : "Перейдите во вкладку «Доступные», чтобы взять заказ."}
                </Text>
              </View>
            }
            renderItem={tab === "pool" ? renderPoolItem : renderMyItem}
          />
        )
      ) : (
        <MapTabContent
          available={available}
          onTab={setTab}
          pool={pool}
          myOrders={myOrders}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onClaim={onClaim}
          onPickUp={(orderId) => setStatus(orderId, "PICKED")}
          onDeliver={(orderId) => setStatus(orderId, "AWAITING_CONFIRMATION")}
          onOpenChat={onOpenChat}
          riderPos={
            latestRiderPos
              ? {
                  latitude: latestRiderPos.lat,
                  longitude: latestRiderPos.lng,
                  bearing: latestRiderPos.bearing ?? null,
                }
              : null
          }
        />
      )}

      {/* ⭐ Переключатель Список/Карта — плавающий, внизу, виден всегда */}
      <ListMapSwitcher listMode={listMode} onChange={setListMode} />

      {permissionModalOpen && (
        <View className="absolute inset-0 z-50 items-center justify-center px-5">
          <Pressable
            className="absolute inset-0 bg-soft-dark-2/60 backdrop-blur-sm"
            onPress={() => setPermissionModalOpen(false)}
          />
          <View className="bg-soft-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-soft-xl z-10">
            <Text className="text-2xl mb-2 text-center">📍</Text>
            <Text className="text-base font-extrabold text-text text-center mb-2">
              Доступ к геолокации закрыт
            </Text>
            <Text className="text-sm text-text-soft text-center leading-5 mb-5">
              Чтобы показывать заказчикам ваше положение и принимать новые
              заказы, разрешите доступ к геолокации в настройках устройства.
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setPermissionModalOpen(false)}
                className="flex-1 h-12 bg-soft-surface-2 border border-border rounded-2xl items-center justify-center active:opacity-90"
              >
                <Text className="text-text-soft font-bold text-sm">Позже</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setPermissionModalOpen(false);
                  try {
                    await Linking.openSettings();
                  } catch {
                    Alert.alert("Не удалось открыть настройки");
                  }
                }}
                className="flex-1 h-12 bg-accent rounded-2xl items-center justify-center active:opacity-90"
              >
                <Text className="text-text-inverse font-extrabold text-sm">
                  Открыть настройки
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
