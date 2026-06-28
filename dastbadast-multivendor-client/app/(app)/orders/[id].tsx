import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
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
  CONFIRM_ORDER_RECEIVED,
  SEND_CHAT_MESSAGE,
  REFRESH_ORDER_STATUS,
} from "../../../lib/api/queries";
import { getApolloClient } from "../../../lib/apollo-provider";
import { StatusPill } from "../../../components/StatusPill";
import { SafeAreaView } from "react-native-safe-area-context";

type ChatMessage = {
  id: string;
  orderId: string;
  senderType: "USER" | "RIDER";
  text: string;
  createdAt: string;
};

const STATUS_TIMES: Record<
  string,
  { minutes: number; title: string; sub: string; emoji: string }
> = {
  PENDING: {
    minutes: 3,
    title: "Заказ отправлен на кухню",
    sub: "Ресторан подтвердит приём в течение пары минут",
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

export default function TrackingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  // ⭐ useQuery<any>
  const { data, loading, error, refetch } = useQuery<any>(GET_ORDER, {
    variables: { id },
    skip: !id,
  });
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

  const o = data?.order;
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  useSubscription(SUB_ORDER, {
    variables: { orderId: id },
    skip: !id,
    onData: () => refetch(),
  });

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
            Ваш заказ будет готов через
          </Text>
          <Text className="text-4xl font-extrabold text-accent mt-1">
            {stage.minutes} {minutesWord(stage.minutes)}
          </Text>
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

        <View className="bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm mb-4">
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
            <Row label="Налог" value={`${o.amounts?.tax ?? 0} ${sym}`} />
            <Row
              label="Доставка"
              value={`${o.amounts?.deliveryFee ?? 0} ${sym}`}
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
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            mine ? "text-text-inverse" : "text-text"
                          }`}
                        >
                          {m.text}
                        </Text>
                        <Text
                          className={`text-2xs mt-0.5 ${
                            mine ? "text-text-inverse/80" : "text-text-muted"
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleTimeString("ru", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
