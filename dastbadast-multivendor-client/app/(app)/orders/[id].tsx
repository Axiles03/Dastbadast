// dastbadast-multivendor-client/app/(app)/orders/[id].tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from "react-native";
import { useQuery, useSubscription, useMutation } from "@apollo/client/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  GET_ORDER,
  GET_CONFIGURATION,
  GET_CHAT_MESSAGES,
  SUB_ORDER,
  SUB_CHAT,
  SUB_RIDER_LOCATION,
  RIDER_LOCATION_QUERY,
  CONFIRM_ORDER_RECEIVED,
  SEND_CHAT_MESSAGE,
  MARK_CHAT_READ,
  REFRESH_ORDER_STATUS,
} from "../../../lib/api/queries";
import { getApolloClient } from "../../../lib/apollo-provider";
import { StatusPill } from "../../../components/StatusPill";
import { SafeAreaView } from "react-native-safe-area-context";
import { gql } from "@apollo/client";

// Безопасный импорт react-native-maps — если пакета нет, MapView === null
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require("react-native-maps");
  MapView = Maps.default ?? Maps.MapView;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch {
  // пакет не установлен — карта просто не покажется
}

type ChatMessage = {
  id: string;
  orderId: string;
  senderType: "USER" | "RIDER";
  text: string;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type RiderPos = {
  lat: number;
  lng: number;
  bearing?: number | null;
  at?: string;
} | null;

const STATUS_TIMES: Record<
  string,
  { minutes: number; title: string; sub: string; emoji: string }
> = {
  PENDING: {
    minutes: 3,
    title: "Заказ отправлен на кухню",
    sub: "Ресторан подтвердит приём в течение пары минуты",
    emoji: "⏱",
  },
  ACCEPTED: {
    minutes: 12,
    title: "Заказ принят в работу",
    sub: "Шеф-повар готовит ваш заказ",
    emoji: "👨‍🍳",
  },
  ASSIGNED: {
    minutes: 8,
    title: "Курьер выехал к ресторану",
    sub: "Курьер скоро заберёт ваш заказ",
    emoji: "🛵",
  },
  PICKED: {
    minutes: 6,
    title: "Курьер уже в пути к вам",
    sub: "Следите за курьером на карте",
    emoji: "🚴",
  },
  AWAITING_CONFIRMATION: {
    minutes: 0,
    title: "Подтвердите получение",
    sub: "Курьер доставил заказ — нажмите «Получил»",
    emoji: "📦",
  },
  DELIVERED: {
    minutes: 0,
    title: "Приятного аппетита!",
    sub: "Спасибо за заказ ☺",
    emoji: "🎉",
  },
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TrackingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [riderPos, setRiderPos] = useState<RiderPos>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const { data, loading, error, refetch, subscribeToMore } = useQuery<any>(
    GET_ORDER,
    {
      variables: { id },
      skip: !id,
      // pollInterval: 10000  // ⭐ УБРАНО
    },
  );

  useEffect(() => {
    if (!id || !subscribeToMore) return;
    const unsubscribe = subscribeToMore({
      document: SUB_ORDER, // ⭐ из lib/queries.ts
      variables: { orderId: id },
      updateQuery: (prev: any, { subscriptionData }: any) => {
        if (!subscriptionData?.data?.subscriptionOrder) return prev;
        const updated = subscriptionData.data.subscriptionOrder;
        return {
          order: {
            ...prev?.order,
            ...updated,
            items: updated.items ?? prev?.order?.items,
            amounts: updated.amounts ?? prev?.order?.amounts,
            deliveryAddress:
              updated.deliveryAddress ?? prev?.order?.deliveryAddress,
            pickupAddress: updated.pickupAddress ?? prev?.order?.pickupAddress,
          },
        };
      },
    });
    return () => unsubscribe();
  }, [id, subscribeToMore]);

  const { data: cfg } = useQuery<any>(GET_CONFIGURATION);
  const { data: chatData, refetch: refetchChat } = useQuery<any>(
    GET_CHAT_MESSAGES,
    {
      variables: { orderId: id },
      skip: !id,
    },
  );

  const [confirmReceived, { loading: confirming }] = useMutation(
    CONFIRM_ORDER_RECEIVED,
  );
  // ⭐ NEW: пометить чат прочитанным при открытии панели чата
  const [markChatRead] = useMutation(MARK_CHAT_READ);
  useEffect(() => {
    if (chatOpen && id) {
      markChatRead({ variables: { orderId: id } }).catch(() => {});
    }
  }, [chatOpen, id, markChatRead]);

  // ⭐ ШАГ 5: live countdown для статуса ACCEPTED (готовка на кухне)
  const { data: prepEtaData } = useQuery<{ restaurantPrepEta: number | null }>(
    gql`
      query PrepEta($orderId: ID!) {
        restaurantPrepEta(orderId: $orderId)
      }
    `,
    {
      variables: { orderId: id },
      skip: !id,
      pollInterval: 30_000, // ⭐ Обновлять каждые 30 сек
    },
  );
  const prepEtaMin = prepEtaData?.restaurantPrepEta ?? null;

  const o = data?.order;
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  useSubscription(SUB_CHAT, {
    variables: { orderId: id },
    skip: !id,
    onData: (options) => {
      const m = (
        options.data?.data as { newChatMessage?: ChatMessage } | undefined
      )?.newChatMessage;
      if (!m) return;
      setLiveMessages((prev) =>
        prev.some((p) => p.id === m.id) ? prev : [...prev, m],
      );
      setChatOpen(true);
    },
  });

  // ⭐⭐⭐ FIX 1: явно типизируем payload подписки через any (Apollo v4 generic сложный)
  const riderId: string | null = o?.riderId ?? null;
  const hasRider = !!riderId && riderId.length === 24;

  useSubscription<any>(SUB_RIDER_LOCATION, {
    variables: { riderId: riderId || "" },
    skip: !hasRider,
    onData: (options: any) => {
      const p: any = options?.data?.data?.subscriptionRiderLocation;
      if (!p) return;
      if (p.stopped) {
        setRiderPos(null);
        return;
      }
      if (p.lat && p.lng) {
        setRiderPos({
          lat: p.lat,
          lng: p.lng,
          bearing: p.bearing ?? null,
          at: p.updatedAt,
        });
      }
    },
  });

  // ⭐⭐⭐ FIX 2: используем useEffect для обработки polling-данных
  //    вместо onCompleted (которого нет в Apollo v4 useQuery)
  const { data: riderLocData } = useQuery<any>(RIDER_LOCATION_QUERY, {
    variables: { id: riderId! },
    skip: !hasRider,
    pollInterval: 10_000,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!riderLocData?.rider?.location?.coordinates) return;
    const coords = riderLocData.rider.location.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return;
    if (coords[0] === 0 && coords[1] === 0) return; // не обновляем если "нулевые"

    setRiderPos((prev) => {
      // Не перезаписываем если WS-событие свежее
      if (prev?.at) {
        const prevTime = new Date(prev.at).getTime();
        if (Date.now() - prevTime < 5000) return prev;
      }
      return {
        lat: coords[1],
        lng: coords[0],
        bearing: prev?.bearing ?? null,
        at: riderLocData.rider.lastLocationAt,
      };
    });
  }, [riderLocData]);

  useEffect(() => {
    if (!o || o.orderStatus !== "AWAITING_CONFIRMATION") return;
    const deliveredAt = o.statusTimestamps?.deliveredAt;
    if (!deliveredAt) return;
    const tick = () => {
      const elapsed = Date.now() - new Date(deliveredAt).getTime();
      setTimeLeftMs(Math.max(0, 30 * 60 * 1000 - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [o?.orderStatus, o?.statusTimestamps?.deliveredAt]);

  useEffect(() => {
    if (!o || o.orderStatus !== "AWAITING_CONFIRMATION") return;
    const interval = setInterval(async () => {
      try {
        const client = getApolloClient();
        if (!client) return;
        await client.mutate({
          mutation: REFRESH_ORDER_STATUS,
          variables: { id: o.id },
        });
        refetch();
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [o?.id, o?.orderStatus, refetch]);

  // ⭐ Расчёт ETA на клиенте
  useEffect(() => {
    if (!riderPos || !o) {
      setEtaMin(null);
      return;
    }
    const destLat = o?.deliveryAddress?.location?.coordinates?.[1];
    const destLng = o?.deliveryAddress?.location?.coordinates?.[0];
    if (typeof destLat === "number" && typeof destLng === "number") {
      const km = haversineKm(riderPos.lat, riderPos.lng, destLat, destLng);
      setEtaMin(Math.max(1, Math.round((km / 25) * 60)));
    }
  }, [riderPos, o]);

  const handleConfirm = useCallback(async () => {
    if (!o) return;
    try {
      await confirmReceived({ variables: { input: { orderId: o.id } } });
      refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
    }
  }, [o, confirmReceived, refetch]);

  const submitMessage = useCallback(async () => {
    const txt = draft.trim();
    if (!txt || !o) return;
    setDraft("");
    try {
      const client = getApolloClient();
      if (!client) throw new Error("Apollo-клиент не инициализирован");
      await client.mutate({
        mutation: SEND_CHAT_MESSAGE,
        variables: { orderId: o.id, text: txt },
      });
      refetchChat();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
      setDraft(txt);
    }
  }, [draft, o, refetchChat]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator color="#F26A4A" size="large" />
        <Text className="text-text-muted mt-3">Загрузка заказа…</Text>
      </View>
    );
  }

  if (error || !o) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg px-5">
        <Text className="text-2xl mb-2">🛑</Text>
        <Text className="text-base font-extrabold text-text text-center">
          {error?.message ?? "Заказ не найден"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-5 py-3 bg-soft-surface border border-border rounded-2xl"
        >
          <Text className="text-text font-bold">Назад</Text>
        </Pressable>
      </View>
    );
  }

  const stage = STATUS_TIMES[o.orderStatus] || STATUS_TIMES.PENDING;
  const allMessages = useMemo(
    () =>
      [...(chatData?.chatMessages ?? []), ...liveMessages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [chatData, liveMessages],
  );

  const chatEnabled = [
    "ASSIGNED",
    "PICKED",
    "AWAITING_CONFIRMATION",
    "DELIVERED",
  ].includes(o.orderStatus);

  // Все координаты вычисляем ОДИН РАЗ перед JSX
  const destCoords = o?.deliveryAddress?.location?.coordinates;
  const pickupCoords = o?.pickupAddress?.location?.coordinates;
  const deliveryLat: number | null =
    destCoords && destCoords.length >= 2 ? destCoords[1] : null;
  const deliveryLng: number | null =
    destCoords && destCoords.length >= 2 ? destCoords[0] : null;
  const pickupLat: number | null =
    pickupCoords && pickupCoords.length >= 2 ? pickupCoords[1] : null;
  const pickupLng: number | null =
    pickupCoords && pickupCoords.length >= 2 ? pickupCoords[0] : null;
  const canShowMap =
    hasRider && MapView !== null && deliveryLat != null && deliveryLng != null;
  const initialLat = deliveryLat ?? 38.574;
  const initialLng = deliveryLng ?? 68.783;

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:opacity-80 mr-3"
        >
          <Ionicons name="chevron-back" size={20} color="#1F1B16" />
        </Pressable>
        <Text className="text-lg font-extrabold text-text flex-1">
          Заказ #{o.orderId}
        </Text>
        <StatusPill status={o.orderStatus} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-soft-surface border border-border rounded-3xl p-8 items-center shadow-soft-sm mb-4">
          <Text className="text-sm text-text-soft">
            {o?.orderStatus === "ACCEPTED" &&
            prepEtaMin != null &&
            prepEtaMin > 0
              ? "⏱ Осталось готовить"
              : "Ваш заказ будет готов через"}
          </Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {/* ⭐ ШАГ 5: показываем live ETA для ACCEPTED, fallback на статику */}
            {o?.orderStatus === "ACCEPTED" && prepEtaMin != null
              ? `${prepEtaMin} ${minutesWord(prepEtaMin)}`
              : `${stage.minutes} ${minutesWord(stage.minutes)}`}
          </Text>
          {/* ⭐ ШАГ 5: для PICKED показываем ETA до клиента (если курьер есть) */}
          {(o?.orderStatus === "PICKED" || o?.orderStatus === "ASSIGNED") &&
            o?.riderId && (
              <View className="mt-2 bg-info-soft border border-info/30 rounded-2xl px-3 py-2">
                <Text className="text-xs text-info-dark font-bold">
                  🛵 Курьер в пути
                </Text>
              </View>
            )}

          <View className="w-48 h-48 rounded-full bg-accent-soft items-center justify-center mt-5">
            <Text className="text-7xl">{stage.emoji}</Text>
          </View>
          <Text className="text-xl font-extrabold text-text mt-6 text-center">
            {stage.title}
          </Text>
          <Text className="text-sm text-text-soft mt-1 text-center">
            {stage.sub}
          </Text>
        </View>

        {/* ⭐ Карта курьера — безопасный рендеринг */}
        {canShowMap && (
          <View className="bg-soft-surface border border-border rounded-2xl p-4 mb-4 shadow-soft-sm">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-extrabold text-text">
                🚴 Курьер в пути
              </Text>
              {etaMin !== null && (
                <View className="bg-success-soft px-2.5 py-1 rounded-full">
                  <Text className="text-2xs font-extrabold text-success">
                    ⏱ ~{etaMin} мин
                  </Text>
                </View>
              )}
            </View>
            <View
              className="rounded-xl overflow-hidden border border-border"
              style={{ height: 220 }}
            >
              <MapView
                style={{ flex: 1 }}
                provider={PROVIDER_GOOGLE ?? undefined}
                initialRegion={{
                  latitude: initialLat,
                  longitude: initialLng,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
              >
                {pickupLat != null && pickupLng != null && (
                  <Marker
                    coordinate={{
                      latitude: pickupLat,
                      longitude: pickupLng,
                    }}
                    title="Ресторан"
                  >
                    <View className="bg-soft-surface border border-border rounded-full px-2 py-1">
                      <Text className="text-sm">🏪</Text>
                    </View>
                  </Marker>
                )}
                <Marker
                  coordinate={{
                    latitude: initialLat,
                    longitude: initialLng,
                  }}
                  title="Точка доставки"
                  pinColor="#F26A4A"
                />
                {riderPos && (
                  <>
                    <Marker
                      coordinate={{
                        latitude: riderPos.lat,
                        longitude: riderPos.lng,
                      }}
                      title="Курьер"
                      rotation={riderPos.bearing ?? 0}
                    >
                      <View className="w-9 h-9 rounded-full bg-accent items-center justify-center border-2 border-white shadow-soft-sm">
                        <Text className="text-base">🛵</Text>
                      </View>
                    </Marker>
                    <Polyline
                      coordinates={[
                        { latitude: riderPos.lat, longitude: riderPos.lng },
                        { latitude: initialLat, longitude: initialLng },
                      ]}
                      strokeColor="#F26A4A"
                      strokeWidth={3}
                    />
                  </>
                )}
              </MapView>
            </View>
          </View>
        )}

        {!canShowMap && hasRider && MapView === null && (
          <View className="bg-soft-surface-2 border border-border rounded-2xl p-4 mb-4">
            <Text className="text-sm text-text-soft text-center">
              🗺 Установите{" "}
              <Text className="text-accent font-bold">react-native-maps</Text>{" "}
              для отображения курьера на карте
            </Text>
          </View>
        )}

        {o.orderStatus === "AWAITING_CONFIRMATION" && (
          <View className="bg-soft-surface border-2 border-accent rounded-2xl p-5 mb-4 shadow-soft-sm">
            <View className="flex-row items-center mb-3">
              <Text className="text-3xl mr-3">📦</Text>
              <View className="flex-1">
                <Text className="text-base font-extrabold text-text">
                  Завершите доставку
                </Text>
                <Text className="text-sm text-text-soft mt-0.5">
                  Проверьте заказ и подтвердите получение
                </Text>
              </View>
            </View>
            {timeLeftMs !== null && (
              <View className="self-start bg-soft-surface-2 border border-accent/30 px-3 py-1 rounded-full mb-3 flex-row items-center">
                <Ionicons name="time-outline" size={14} color="#F26A4A" />
                <Text className="text-2xs font-mono font-bold text-accent ml-1">
                  {formatCountdown(timeLeftMs)}
                </Text>
              </View>
            )}
            <Pressable
              onPress={handleConfirm}
              disabled={confirming}
              className="bg-success h-14 rounded-2xl items-center justify-center flex-row active:opacity-90 disabled:opacity-50"
            >
              {confirming ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-text-inverse font-extrabold text-base">
                  ✅ Получил заказ
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View className="bg-soft-surface border border-border rounded-2xl p-4 mb-4 shadow-soft-sm">
          <Text className="text-base font-extrabold text-text mb-2">
            Список заказа
          </Text>
          {o.items?.map((i: any) => (
            <View
              key={i.foodId}
              className="flex-row items-center gap-3 py-2 border-b border-border last:border-0"
            >
              <View className="w-10 h-10 rounded-full bg-soft-surface-2 items-center justify-center">
                <Text className="text-xl">🍽</Text>
              </View>
              <Text
                className="flex-1 text-sm font-bold text-text"
                numberOfLines={1}
              >
                {i.title}
              </Text>
              <Text className="text-sm text-text-soft">
                {i.quantity} ×{" "}
                <Text className="text-text font-bold">
                  {i.price} {sym}
                </Text>
              </Text>
            </View>
          ))}
          <View className="pt-2.5 mt-2.5 border-t border-border space-y-1">
            <Row label="Подытог" value={`${o.amounts?.subtotal ?? 0} ${sym}`} />
            <Row
              label="Доставка"
              value={`${typeof o?.deliveryPrice === "number" ? o.deliveryPrice : (o.amounts?.deliveryFee ?? 0)} ${sym}`}
            />
            <View className="pt-2 border-t border-border flex-row justify-between">
              <Text className="font-extrabold text-text">Итого</Text>
              <Text className="font-extrabold text-accent text-lg">
                {o.amounts?.total} {sym}
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm">
          <View className="flex-row items-center mb-1.5">
            <Ionicons name="location-outline" size={16} color="#F26A4A" />
            <Text className="text-sm font-extrabold text-text ml-1.5">
              Адрес доставки
            </Text>
          </View>
          <Text className="text-sm text-text-soft">
            {o.deliveryAddress?.city}, {o.deliveryAddress?.address}
          </Text>
        </View>
      </ScrollView>

      {chatEnabled && !chatOpen && (
        <Pressable
          onPress={() => setChatOpen(true)}
          className="absolute bottom-5 right-5 bg-accent flex-row items-center pl-4 pr-5 py-3 rounded-full shadow-soft-lg active:opacity-90"
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          <Text className="text-text-inverse font-bold text-sm ml-2">
            Чат ({allMessages.length})
          </Text>
        </Pressable>
      )}

      {chatOpen && chatEnabled && (
        <View className="absolute inset-0 z-50 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setChatOpen(false)} />
          <View className="bg-soft-surface rounded-t-3xl h-3/4">
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View>
                <Text className="text-base font-extrabold text-text">
                  💬 Чат по заказу
                </Text>
                <Text className="text-xs text-text-soft">
                  {allMessages.length} сообщений
                </Text>
              </View>
              <Pressable
                onPress={() => setChatOpen(false)}
                className="w-8 h-8 items-center justify-center"
              >
                <Ionicons name="close" size={24} color="#6B6358" />
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/(app)/support?orderId=${id}` as any)
                }
                className="flex-row items-center px-4 py-3 bg-soft-surface-2 rounded-2xl mb-2"
              >
                <Ionicons name="help-buoy-outline" size={18} color="#1F1B16" />
                <Text className="text-sm font-bold text-text ml-2">
                  Проблема с заказом? Написать в поддержку
                </Text>
              </Pressable>
            </View>
            <ScrollView
              className="flex-1 p-3"
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {allMessages.length === 0 ? (
                <Text className="text-center text-text-soft text-sm py-8">
                  Пока нет сообщений 👋
                </Text>
              ) : (
                allMessages.map((m) => {
                  const mine = m.senderType === "USER";
                  return (
                    <View
                      key={m.id}
                      className={`mb-1.5 flex-row ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <View
                        className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${
                          mine
                            ? "bg-accent rounded-br-sm"
                            : "bg-soft-surface-2 border border-border rounded-bl-sm"
                        } ${m.imageUrl ? "p-1.5" : ""}`}
                      >
                        {m.imageUrl ? (
                          <Image
                            source={{ uri: m.imageUrl }}
                            style={{
                              width: 180,
                              height: 180,
                              borderRadius: 14,
                            }}
                            resizeMode="cover"
                          />
                        ) : null}
                        {m.text ? (
                          <Text
                            className={`text-sm ${
                              m.imageUrl ? "mt-1.5 px-1.5" : ""
                            } ${mine ? "text-text-inverse" : "text-text"}`}
                          >
                            {m.text}
                          </Text>
                        ) : null}
                        <Text
                          className={`text-2xs mt-0.5 ${
                            m.imageUrl ? "px-1.5 pb-0.5" : ""
                          } ${mine ? "text-text-inverse/80" : "text-text-muted"}`}
                        >
                          {new Date(m.createdAt).toLocaleTimeString("ru", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {mine && m.readAt ? " · прочитано" : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View className="p-3 border-t border-border flex-row gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Сообщение…"
                placeholderTextColor="#9A9388"
                className="flex-1 bg-soft-surface-2 border border-border text-text rounded-xl px-3 py-2.5 text-sm"
                maxLength={1000}
              />
              <Pressable
                onPress={submitMessage}
                className="bg-accent w-12 items-center justify-center rounded-xl active:opacity-90"
              >
                <Ionicons name="send" size={18} color="white" />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function minutesWord(n: number) {
  if (n === 0) return "";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "минута";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "минуты";
  return "минут";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-text-soft">{label}</Text>
      <Text className="text-sm text-text font-bold">{value}</Text>
    </View>
  );
}
