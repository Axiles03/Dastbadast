// dastbadast-multivendor-client/app/(app)/support.tsx
//
// Экран поддержки: сначала бот с частыми вопросами (FAQ), при клике на
// "Позвать оператора" (или если пришли с orderId — сразу) создаётся
// реальный тред и открывается живой чат с сотрудником.
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  START_SUPPORT_THREAD,
  GET_SUPPORT_MESSAGES,
  SEND_SUPPORT_MESSAGE,
  SUB_SUPPORT_MESSAGE,
  MARK_SUPPORT_READ,
} from "../../lib/api/queries";

type Msg = {
  id: string;
  senderType: "USER" | "RIDER" | "RESTAURANT" | "OWNER";
  text: string;
  imageUrl?: string | null;
  readByStaff?: boolean;
  createdAt: string;
};

// ⭐ Список вопросов бота — поменяйте текст под себя, структура не трогается.
const FAQ_ITEMS: { id: string; q: string; a: string }[] = [
  {
    id: "late",
    q: "Заказ задерживается",
    a: "Приносим извинения за задержку! Курьеры иногда попадают в пробки или ждут заказ на кухне. Обычно доставка занимает до 60 минут с момента подтверждения. Если прошло больше — позовите оператора, поможем разобраться прямо сейчас.",
  },
  {
    id: "wrong",
    q: "Привезли не тот заказ / не хватает позиций",
    a: "Сожалеем об ошибке! Сфотографируйте, пожалуйста, то, что привезли — оператор оформит возврат или досылку недостающих позиций.",
  },
  {
    id: "payment",
    q: "Проблема с оплатой",
    a: "Если деньги списались, а заказ не оформился — не переживайте, средства автоматически возвращаются в течение 1-3 дней. Если нужна помощь прямо сейчас — позовите оператора.",
  },
  {
    id: "cancel",
    q: "Хочу отменить заказ",
    a: "Если заказ ещё не принят рестораном — отменить можно из истории заказов. Если ресторан уже начал готовить — позовите оператора, решим индивидуально.",
  },
  {
    id: "other",
    q: "Другой вопрос",
    a: "Опишите, пожалуйста, подробнее — позовите оператора, и мы поможем.",
  },
];

export default function SupportScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  // Если пришли по конкретному заказу — бот не нужен, сразу к оператору.
  const [mode, setMode] = useState<"bot" | "chat">(orderId ? "chat" : "bot");

  if (mode === "bot") {
    return <SupportBot onCallOperator={() => setMode("chat")} />;
  }
  return <LiveChat orderId={orderId} />;
}

/* ============================== Бот ============================== */

function SupportBot({ onCallOperator }: { onCallOperator: () => void }) {
  const router = useRouter();
  const [openedId, setOpenedId] = useState<string | null>(null);
  const opened = FAQ_ITEMS.find((f) => f.id === openedId) || null;

  return (
    <View className="flex-1 bg-soft-bg">
      <View className="bg-soft-surface border-b border-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="px-2">
          <Text className="text-accent text-base font-bold">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-text font-bold text-base">💬 Поддержка</Text>
          <Text className="text-text-muted text-xs">Помощник Dastbadast</Text>
        </View>
      </View>

      <View className="flex-1 p-4">
        {/* "Реплика" бота */}
        <View className="self-start max-w-[85%] bg-soft-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 mb-3">
          <Text className="text-text text-sm">
            Привет 👋 Выберите вопрос, который ближе всего к вашей ситуации —
            попробую помочь сразу. Если не поможет — соединю с оператором.
          </Text>
        </View>

        {!opened ? (
          <View className="gap-2">
            {FAQ_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setOpenedId(item.id)}
                className="bg-soft-surface border border-border rounded-2xl px-4 py-3 active:opacity-70"
              >
                <Text className="text-text text-sm font-semibold">
                  {item.q}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="gap-3">
            <View className="self-start max-w-[85%] bg-accent-soft border border-accent/20 rounded-2xl rounded-bl-sm px-4 py-3">
              <Text className="text-text text-sm">{opened.a}</Text>
            </View>

            <Pressable
              onPress={() => setOpenedId(null)}
              className="bg-soft-surface-2 rounded-2xl px-4 py-3 items-center active:opacity-70"
            >
              <Text className="text-text font-bold text-sm">
                Спасибо, помогло 🙌
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View className="p-4 border-t border-border">
        <Pressable
          onPress={onCallOperator}
          className="h-12 rounded-2xl bg-accent items-center justify-center active:opacity-90"
        >
          <Text className="text-text-inverse font-extrabold text-sm">
            {opened
              ? "Не помогло — позвать оператора"
              : "Сразу позвать оператора"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ============================ Живой чат ============================ */

function LiveChat({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [agent, setAgent] = useState<{
    name?: string | null;
    avatar?: string | null;
  } | null>(null);
  const [starting, setStarting] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const SafeFlatList = FlatList as any;

  const [startThread] = useMutation<{
    startSupportThread: {
      id: string;
      assignedOwnerName?: string | null;
      assignedOwnerAvatar?: string | null;
    };
  }>(START_SUPPORT_THREAD);
  const [sendMessage] = useMutation(SEND_SUPPORT_MESSAGE);
  const [markRead] = useMutation(MARK_SUPPORT_READ);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await startThread({
          variables: { orderId: orderId || null },
        });
        const t = data?.startSupportThread;
        if (!cancelled) {
          setThreadId(t?.id ?? null);
          setAgent(
            t?.assignedOwnerName
              ? { name: t.assignedOwnerName, avatar: t.assignedOwnerAvatar }
              : null,
          );
        }
      } catch (e: any) {
        Alert.alert(
          "Не удалось открыть чат поддержки",
          e?.message ?? "Попробуйте ещё раз",
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const { data, loading, refetch } = useQuery<{ supportMessages: Msg[] }>(
    GET_SUPPORT_MESSAGES,
    {
      variables: { threadId },
      skip: !threadId,
      fetchPolicy: "network-only",
    },
  );

  useSubscription(SUB_SUPPORT_MESSAGE, {
    variables: { threadId: threadId || "" },
    skip: !threadId,
    onData: () => {
      refetch();
      if (threadId) markRead({ variables: { threadId } }).catch(() => {});
    },
  });

  useEffect(() => {
    if (!threadId) return;
    markRead({ variables: { threadId } }).catch(() => {});
  }, [threadId, markRead]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || sending || !threadId) return;
    setSending(true);
    setText("");
    try {
      await sendMessage({ variables: { threadId, text: t } });
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось отправить сообщение");
      setText(t);
    } finally {
      setSending(false);
    }
  }, [text, sending, threadId, sendMessage, refetch]);

  const all = (data?.supportMessages ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  useEffect(() => {
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      100,
    );
    return () => clearTimeout(t);
  }, [all.length]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="bg-soft-surface border-b border-border px-3 py-2.5 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="px-1">
          <Text className="text-accent text-lg font-bold">←</Text>
        </Pressable>

        <View className="w-10 h-10 rounded-full bg-accent-soft items-center justify-center overflow-hidden">
          {agent?.avatar ? (
            <Image
              source={{ uri: agent.avatar }}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <Text className="text-accent font-extrabold text-base">
              {agent?.name ? agent.name[0].toUpperCase() : "D"}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-text font-bold text-base" numberOfLines={1}>
            {agent?.name || "Поддержка Dastbadast"}
          </Text>
          <Text className="text-text-muted text-xs">
            {agent?.name
              ? "обычно отвечает быстро"
              : orderId
                ? `По заказу #${String(orderId).slice(-6)}`
                : "мы онлайн"}
          </Text>
        </View>
      </View>

      {starting || (loading && all.length === 0) ? (
        <ActivityIndicator color="#F26A4A" className="mt-10" />
      ) : (
        <SafeFlatList<Msg>
          ref={listRef}
          data={all}
          keyExtractor={(m: Msg) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          ListEmptyComponent={
            <Text className="text-text-muted text-center mt-12 text-sm">
              Опишите свой вопрос — мы ответим как можно скорее 👋
            </Text>
          }
          renderItem={({ item }: { item: Msg }) => {
            const mine = item.senderType === "USER";
            return (
              <View
                className={`mb-2 flex-row ${mine ? "justify-end" : "justify-start"}`}
              >
                <View
                  className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${
                    mine
                      ? "bg-accent rounded-br-sm"
                      : "bg-soft-surface border border-border rounded-bl-sm"
                  }`}
                >
                  {!mine && (
                    <Text className="text-[10px] font-bold text-text-muted mb-0.5">
                      {item.senderType === "OWNER"
                        ? agent?.name || "Поддержка"
                        : item.senderType}
                    </Text>
                  )}
                  {item.text ? (
                    <Text
                      className={`text-sm ${mine ? "text-text-inverse" : "text-text"}`}
                    >
                      {item.text}
                    </Text>
                  ) : null}
                  <Text
                    className={`text-[10px] mt-0.5 ${mine ? "text-text-inverse/80" : "text-text-muted"}`}
                  >
                    {new Date(item.createdAt).toLocaleTimeString("ru", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine && (item.readByStaff ? " ✓✓" : " ✓")}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View className="bg-soft-surface border-t border-border p-3 flex-row gap-2 items-end">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Опишите проблему…"
          placeholderTextColor="#9A9388"
          multiline
          editable={!sending && !!threadId}
          className="flex-1 bg-soft-surface-2 border border-border text-text rounded-2xl px-3 py-2.5 text-sm max-h-24"
          maxLength={1000}
        />
        <Pressable
          onPress={submit}
          disabled={sending || !text.trim() || !threadId}
          className={`h-11 px-5 rounded-2xl items-center justify-center ${
            sending || !text.trim() || !threadId
              ? "bg-border opacity-50"
              : "bg-accent active:scale-95"
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-text-inverse font-bold text-sm">→</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
