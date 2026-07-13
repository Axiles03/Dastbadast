import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
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
  MARK_CHAT_READ,
  SEND_TYPING_STATUS,
  SUB_CHAT_TYPING,
  SUB_CHAT_READ,
} from "../../../lib/api/queries";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getApolloClient } from "../../../lib/apollo-provider";

type Msg = {
  id: string;
  senderType: "USER" | "RIDER";
  text: string;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

// ⭐ Debounce для индикатора "печатает" — не слать sendTypingStatus на каждую
// букву, а раз в TYPING_DEBOUNCE_MS, плюс авто-сброс, если пользователь
// перестал печатать (не отправляя) дольше TYPING_STOP_MS.
const TYPING_DEBOUNCE_MS = 600;
const TYPING_STOP_MS = 3000;

export default function ChatScreen() {
  const { orderId, orderCode } = useLocalSearchParams<{
    orderId: string;
    orderCode?: string;
  }>();
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTypingRef = useRef(false);

  // FIX: в React 19 + RN 0.85 у FlatList проп ref убран из типов.
  const listRef = useRef<FlatList>(null);
  const SafeFlatList = FlatList as any;
  // ============== 1. QUERY (история чата) ==============
  const { data, loading, refetch, error } = useQuery<{ chatMessages: Msg[] }>(
    CHAT_MESSAGES,
    {
      variables: { orderId },
      skip: !orderId,
      fetchPolicy: "network-only",
    },
  );

  const [markRead] = useMutation(MARK_CHAT_READ);
  const [sendTyping] = useMutation(SEND_TYPING_STATUS);

  // ============== 2. SUBSCRIPTIONS ==============
  useSubscription(SUB_CHAT, {
    variables: { orderId: orderId || "" },
    skip: !orderId,
    onData: () => {
      refetch();
      // ⭐ Новое сообщение пришло, пока экран чата открыт — сразу
      // помечаем прочитанным (мы же прямо сейчас смотрим в чат).
      if (orderId) markRead({ variables: { orderId } }).catch(() => {});
    },
  });

  // ⭐ NEW: индикатор "печатает" от собеседника
  useSubscription<{
    chatTypingStatus: {
      orderId: string;
      senderType: "USER" | "RIDER";
      isTyping: boolean;
    };
  }>(SUB_CHAT_TYPING, {
    variables: { orderId: orderId || "" },
    skip: !orderId,
    onData: ({ data: subData }) => {
      const ev = subData?.data?.chatTypingStatus;
      if (!ev) return;
      // Игнорируем свои же события (RIDER), интересует только USER
      if (ev.senderType === "USER") setPeerTyping(!!ev.isTyping);
    },
  });

  // ⭐ NEW: read receipts — когда клиент прочитал наши сообщения
  useSubscription(SUB_CHAT_READ, {
    variables: { orderId: orderId || "" },
    skip: !orderId,
    onData: () => {
      // Проще всего перезапросить историю — сообщений в чате немного (лимит 500)
      refetch();
    },
  });

  // ⭐ NEW: помечаем чат прочитанным при открытии экрана (presence-сигнал,
  // который также подавляет push на стороне сервера, пока чат открыт)
  useEffect(() => {
    if (!orderId) return;
    markRead({ variables: { orderId } }).catch(() => {});
  }, [orderId, markRead]);

  // ============== 3. CALLBACKS ==============
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

  const stopTyping = useCallback(() => {
    if (!orderId || !wasTypingRef.current) return;
    wasTypingRef.current = false;
    sendTyping({ variables: { orderId, isTyping: false } }).catch(() => {});
  }, [orderId, sendTyping]);

  // ⭐ NEW: вызывается на каждое изменение текста — шлёт "печатает" с
  // дебаунсом и планирует авто-сброс, если пользователь остановился
  const onChangeText = useCallback(
    (t: string) => {
      setText(t);
      if (!orderId) return;

      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      typingStopRef.current = setTimeout(stopTyping, TYPING_STOP_MS);

      if (t.trim().length === 0) {
        stopTyping();
        return;
      }
      if (typingDebounceRef.current) return; // уже недавно отправляли
      wasTypingRef.current = true;
      sendTyping({ variables: { orderId, isTyping: true } }).catch(() => {});
      typingDebounceRef.current = setTimeout(() => {
        typingDebounceRef.current = null;
      }, TYPING_DEBOUNCE_MS);
    },
    [orderId, sendTyping, stopTyping],
  );

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || sending || !orderId) return;
    setSending(true);
    setText("");
    stopTyping();
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
  }, [text, sending, orderId, refetch, stopTyping]);

  // ⭐ NEW: отправка фото (например, фото у двери при бесконтактной доставке).
  // ⚠️ MVP: фото кодируется в base64 data-URI и хранится в БД. Для прод
  // нужно загружать в объектное хранилище (S3/Cloudinary) и слать сюда
  // только готовую ссылку — см. тот же паттерн в edit-profile.tsx.
  const sendPhoto = useCallback(async () => {
    if (!orderId || pickingPhoto || sending) return;
    setPickingPhoto(true);
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert(
            "Нет доступа",
            "Разрешите доступ к камере или галерее, чтобы отправить фото.",
          );
          return;
        }
      }
      const result = perm.granted
        ? await ImagePicker.launchCameraAsync({
            quality: 0.5,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            base64: true,
          });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Ошибка", "Не удалось прочитать фото");
        return;
      }
      const mime = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;

      setSending(true);
      const client = getApolloClient();
      if (!client) throw new Error("Apollo-клиент ещё не инициализирован");
      await client.mutate({
        mutation: SEND_CHAT_MESSAGE,
        variables: { orderId, imageUrl: dataUri },
      });
      await refetch();
    } catch (e: any) {
      Alert.alert(
        "Не удалось отправить фото",
        e?.message ??
          "Выполните: npx expo install expo-image-picker, затем пересоберите приложение.",
      );
    } finally {
      setPickingPhoto(false);
      setSending(false);
    }
  }, [orderId, pickingPhoto, sending, refetch]);

  // ============== 4. DERIVED STATE ==============
  const all = (data?.chatMessages ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  // Последнее сообщение курьера — для отметки "прочитано"
  const lastMineIndex = [...all]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.senderType === "RIDER")
    .pop()?.i;

  // ============== 5. EFFECTS ==============
  useEffect(() => {
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      100,
    );
    return () => clearTimeout(t);
  }, [all.length]); // listRef из зависимостей можно убрать // Убрали listRef из зависимостей

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
              {/* ⭐ NEW: индикатор "печатает" */}
              {peerTyping ? " · печатает…" : ""}
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
        <SafeFlatList<Msg>
          ref={listRef}
          data={all}
          keyExtractor={(m: Msg) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          ListEmptyComponent={
            <Text className="text-text-muted text-center mt-12 text-sm">
              Начните диалог первым 👋
            </Text>
          }
          renderItem={({ item, index }: { item: Msg; index: number }) => {
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
                  } ${item.imageUrl ? "p-1.5" : ""}`}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 200, height: 200, borderRadius: 14 }}
                      resizeMode="cover"
                    />
                  ) : null}
                  {item.text ? (
                    <Text
                      className={`text-sm ${
                        item.imageUrl ? "mt-1.5 px-1.5" : ""
                      } ${mine ? "text-text-inverse" : "text-text"}`}
                    >
                      {item.text}
                    </Text>
                  ) : null}
                  <View
                    className={`flex-row items-center gap-1 mt-0.5 ${
                      item.imageUrl ? "px-1.5 pb-0.5" : ""
                    }`}
                  >
                    <Text
                      className={`text-[10px] ${
                        mine ? "text-text-inverse/80" : "text-text-muted"
                      }`}
                    >
                      {new Date(item.createdAt).toLocaleTimeString("ru", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    {/* ⭐ NEW: статус "прочитано" — только на своих последних сообщениях */}
                    {mine && index === lastMineIndex && (
                      <Text
                        className={`text-[10px] ${
                          item.readAt ? "text-blue-300" : "text-text-inverse/70"
                        }`}
                      >
                        {item.readAt ? "✓✓ прочитано" : "✓ отправлено"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input area */}
      <View className="bg-soft-surface border-t border-border p-3 flex-row gap-2 items-end">
        {/* ⭐ NEW: кнопка отправки фото (например, у двери при бесконтактной доставке) */}
        <Pressable
          onPress={sendPhoto}
          disabled={pickingPhoto || sending}
          className={`h-11 w-11 rounded-2xl items-center justify-center bg-soft-surface-2 border border-border ${
            pickingPhoto || sending ? "opacity-50" : "active:opacity-80"
          }`}
        >
          {pickingPhoto ? (
            <ActivityIndicator size="small" color="#F26A4A" />
          ) : (
            <Text className="text-lg">📷</Text>
          )}
        </Pressable>
        <TextInput
          value={text}
          onChangeText={onChangeText}
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
