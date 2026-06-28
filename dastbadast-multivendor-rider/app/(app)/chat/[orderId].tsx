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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import {
  CHAT_MESSAGES,
  SEND_CHAT_MESSAGE,
  SUB_CHAT,
} from "../../../lib/api/queries";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getApolloClient } from "../../../lib/apollo-provider";

type Msg = {
  id: string;
  senderType: "USER" | "RIDER";
  text: string;
  createdAt: string;
};

export default function ChatScreen() {
  const { orderId, orderCode } = useLocalSearchParams<{
    orderId: string;
    orderCode?: string;
  }>();
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // FIX: в React 19 + RN 0.85 у FlatList проп ref убран из типов.
  // Используем callback-ref с типизацией через `any` (только для ref-коллбэка,
  // иммутабельная ссылка в Map не нужна, нужен лишь scrollToEnd).
  const [listRef, setListRef] = useState<FlatList<Msg> | null>(null);

  // ============== 1. QUERY (история чата) ==============
  const { data, loading, refetch, error } = useQuery<{ chatMessages: Msg[] }>(
    CHAT_MESSAGES,
    {
      variables: { orderId },
      skip: !orderId,
      fetchPolicy: "network-only",
    },
  );

  // ============== 2. SUBSCRIPTION (новые сообщения) ==============
  useSubscription(SUB_CHAT, {
    variables: { orderId: orderId || "" },
    skip: !orderId,
    onData: () => {
      refetch();
    },
  });

  // ============== 3. CALLBACKS (объявлены ДО useEffect) ==============
  const goBack = useCallback(() => {
    try {
      if (
        router &&
        typeof router.canGoBack === "function" &&
        router.canGoBack()
      ) {
        router.back();
      } else if (router && typeof router.replace === "function") {
        router.replace("/orders");
      }
    } catch {
      // Если router не доступен — игнорим
    }
  }, [router]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || sending || !orderId) return;
    setSending(true);
    setText("");
    try {
      const client = getApolloClient();
      if (!client) {
        throw new Error("Apollo-клиент ещё не инициализирован");
      }
      await client.mutate({
        mutation: SEND_CHAT_MESSAGE,
        variables: { orderId, text: t },
      });
      await refetch();
    } catch (e: any) {
      const msg = e?.graphQLErrors?.[0]?.message || e?.message || String(e);
      Alert.alert("Ошибка", msg);
      setText(t);
    } finally {
      setSending(false);
    }
  }, [text, sending, orderId, refetch]);

  // ============== 4. DERIVED STATE ==============
  const all = (data?.chatMessages ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  // ============== 5. EFFECTS ==============
  useEffect(() => {
    const t = setTimeout(() => listRef?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [all.length, listRef]);

  // ============== 6. РАННИЕ RETURN'ы — ПОСЛЕ ВСЕХ ХУКОВ ==============
  if (!orderId) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <Text className="text-text">Заказ не выбран</Text>
      </View>
    );
  }

  // ============== 7. RENDER ==============
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View className="bg-soft-surface border-b border-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={goBack} className="px-2">
          <Text className="text-accent text-base font-bold">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-text font-bold text-base">
            💬 Чат с клиентом
          </Text>
          {orderCode && (
            <Text className="text-text-muted text-xs">
              Заказ #{String(orderCode).substring(0, 8)}
            </Text>
          )}
        </View>
      </View>

      {error ? (
        <View className="p-6 items-center">
          <Text className="text-accent text-sm text-center mb-2">
            Не удалось загрузить чат
          </Text>
          <Text className="text-text-muted text-xs text-center">
            {error.message}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-3 bg-accent px-4 py-2 rounded-xl"
          >
            <Text className="text-text-inverse font-bold text-sm">
              Повторить
            </Text>
          </Pressable>
        </View>
      ) : loading && all.length === 0 ? (
        <ActivityIndicator color="#F26A4A" className="mt-10" />
      ) : (
        <FlatList<Msg>
          ref={setListRef}
          data={all}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          ListEmptyComponent={
            <Text className="text-text-muted text-center mt-12 text-sm">
              Начните диалог первым 👋
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderType === "RIDER";
            return (
              <View
                className={`mb-2 flex-row ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                <View
                  className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${
                    mine
                      ? "bg-accent rounded-br-sm"
                      : "bg-soft-surface border border-border rounded-bl-sm"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      mine ? "text-text-inverse" : "text-text"
                    }`}
                  >
                    {item.text}
                  </Text>
                  <Text
                    className={`text-[10px] mt-0.5 ${
                      mine ? "text-text-inverse/80" : "text-text-muted"
                    }`}
                  >
                    {new Date(item.createdAt).toLocaleTimeString("ru", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input area */}
      <View className="bg-soft-surface border-t border-border p-3 flex-row gap-2 items-end">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Сообщение клиенту…"
          placeholderTextColor="#9A9388"
          multiline
          editable={!sending}
          className="flex-1 bg-soft-surface-2 border border-border text-text rounded-2xl px-3 py-2.5 text-sm max-h-24"
          maxLength={1000}
        />
        <Pressable
          onPress={submit}
          disabled={sending || !text.trim()}
          className={`h-11 px-5 rounded-2xl items-center justify-center ${
            sending || !text.trim()
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
