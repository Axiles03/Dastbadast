import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery } from "@apollo/client/react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../../lib/cart-context";
import {
  GET_ADDRESSES,
  GET_CONFIGURATION,
  GET_RESTAURANT_CHECK,
  PLACE_ORDER,
} from "../../lib/api/queries";
import { getApolloClient } from "../../lib/apollo-provider";
import { GRAPHQL_HTTP } from "../../lib/config/api";
import { EmptyState } from "../../components/EmptyState";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    hydrated,
    setQty,
    remove,
    clear,
    subtotal,
    restaurantId,
    restaurantName,
  } = useCart();

  // ⭐ useQuery<any> — фикс типов
  const { data: addrData } = useQuery<any>(GET_ADDRESSES);
  const { data: cfg } = useQuery<any>(GET_CONFIGURATION);
  const {
    data: restData,
    loading: restLoading,
    error: restError,
  } = useQuery<any>(GET_RESTAURANT_CHECK, {
    variables: { id: restaurantId },
    skip: !restaurantId || !hydrated,
    fetchPolicy: "network-only",
  });

  const [addressId, setAddressId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator color="#F26A4A" size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-soft-bg">
        <HeaderBar title="Корзина" onBack={() => router.back()} />
        <EmptyState
          emoji="🛒"
          title="Корзина пуста"
          subtitle="Добавьте блюда из меню ресторана"
          actionLabel="К выбору блюд"
          onAction={() => router.push("/(app)/home" as any)}
        />
      </View>
    );
  }

  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const deliveryFee = cfg?.configuration?.deliveryRate ?? 0;
  const minimumOrder = restData?.restaurant?.minimumOrder ?? 0;
  const total = +(subtotal + deliveryFee).toFixed(2);

  const blocks: string[] = [];
  if (!addressId) blocks.push("📍 Выберите адрес доставки");
  if (restLoading) blocks.push("⏳ Проверяем ресторан…");
  else if (restError)
    blocks.push(
      `🛑 API недоступен: ${restError.message}. Запущен ли бэкенд на ${GRAPHQL_HTTP}?`,
    );
  else if (!restData?.restaurant)
    blocks.push(
      "🚫 Ресторан из корзины больше не существует. Очистите корзину.",
    );
  else if (restData.restaurant.isAvailable === false)
    blocks.push("🚫 Ресторан временно не принимает заказы.");
  else if (minimumOrder > 0 && subtotal < minimumOrder)
    blocks.push(
      `💰 Минимальная сумма заказа: ${minimumOrder} ${sym}. Добавьте ещё на ${(minimumOrder - subtotal).toFixed(0)} ${sym}.`,
    );

  const canOrder = blocks.length === 0;

  const onPlaceOrder = async () => {
    if (!canOrder || placing) return;
    setPlacing(true);
    try {
      const client = getApolloClient();
      if (!client) throw new Error("Apollo-клиент не инициализирован");
      const res = await client.mutate({
        mutation: PLACE_ORDER,
        variables: {
          input: {
            restaurantId,
            addressId,
            paymentMethod: "COD",
            note: note.trim() || undefined,
            items: items.map((i) => ({
              foodId: i.foodId,
              quantity: i.quantity,
            })),
          },
        },
      });
      const orderId = (res.data as any)?.placeOrder?.id;
      if (!orderId) {
        Alert.alert("Заказ создан, но id не получен");
        return;
      }
      clear();
      router.push(`/(app)/orders/${orderId}` as any);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <HeaderBar title="Корзина" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2 pb-2">
          <Text className="text-2xl font-extrabold text-text">Корзина</Text>
          <Text className="text-sm text-text-muted mt-1">
            Ресторан:{" "}
            <Text className="text-text font-bold">
              {restData?.restaurant?.name || restaurantName}
            </Text>
          </Text>
        </View>

        {/* Items */}
        <View className="px-5 space-y-2">
          {items.map((i) => (
            <View
              key={i.foodId}
              className="bg-soft-surface border border-border rounded-2xl p-3.5 flex-row items-center shadow-soft-sm"
            >
              <View className="w-12 h-12 rounded-xl bg-soft-surface-2 overflow-hidden items-center justify-center">
                <Text className="text-2xl">🍽</Text>
              </View>
              <View className="flex-1 ml-3 min-w-0">
                <Text className="text-sm font-bold text-text" numberOfLines={1}>
                  {i.title}
                </Text>
                <Text className="text-accent text-sm font-extrabold mt-0.5">
                  {i.price} {sym}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Pressable
                  onPress={() => setQty(i.foodId, i.quantity - 1)}
                  className="w-8 h-8 items-center justify-center bg-soft-surface-2 border border-border rounded-xl active:border-accent"
                >
                  <Ionicons name="remove" size={14} color="#6B6358" />
                </Pressable>
                <Text className="font-bold text-sm w-6 text-center text-text">
                  {i.quantity}
                </Text>
                <Pressable
                  onPress={() => setQty(i.foodId, i.quantity + 1)}
                  className="w-8 h-8 items-center justify-center bg-soft-surface-2 border border-border rounded-xl active:border-accent"
                >
                  <Ionicons name="add" size={14} color="#6B6358" />
                </Pressable>
                <Pressable
                  onPress={() => remove(i.foodId)}
                  className="ml-1 w-8 h-8 items-center justify-center active:bg-red-soft rounded-xl"
                >
                  <Ionicons name="trash-outline" size={14} color="#9A9388" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Addresses */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm">
          <View className="flex-row items-center justify-between mb-2.5">
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={16} color="#F26A4A" />
              <Text className="font-extrabold text-text ml-1.5">
                Адрес доставки
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(app)/address" as any)}
              hitSlop={6}
            >
              <Text className="text-xs font-extrabold text-accent">
                Изменить
              </Text>
            </Pressable>
          </View>
          {addrData?.addresses?.length ? (
            <View className="space-y-2">
              {addrData.addresses.map((a: any) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAddressId(a.id)}
                  className={`p-3 rounded-2xl border ${
                    addressId === a.id
                      ? "bg-accent-soft border-accent"
                      : "bg-soft-surface-2 border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      addressId === a.id ? "text-accent" : "text-text"
                    }`}
                  >
                    {a.label}{" "}
                    <Text className="font-normal text-text-soft">
                      — {a.city}, {a.address}
                    </Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-text-soft">
              Нет сохранённых адресов.{" "}
              <Text
                onPress={() => router.push("/(app)/address" as any)}
                className="text-accent font-bold"
              >
                Добавить
              </Text>
            </Text>
          )}
        </View>

        {/* Note */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm">
          <Text className="font-extrabold text-text mb-2">
            Комментарий к заказу{" "}
            <Text className="text-xs text-text-soft font-normal">
              (необязательно)
            </Text>
          </Text>
          <TextInput
            className="bg-soft-surface-2 border border-border text-text rounded-xl p-3 text-sm min-h-[80px]"
            placeholder="Например: без лука, позвонить у двери"
            placeholderTextColor="#9A9388"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {/* Block reasons */}
        {!canOrder && (
          <View className="mx-5 mt-3 bg-accent-soft border border-accent/20 rounded-2xl p-4">
            <Text className="text-sm font-extrabold text-accent-dark mb-1">
              Невозможно оформить:
            </Text>
            {blocks.map((b, i) => (
              <Text key={i} className="text-sm text-accent-dark ml-1">
                • {b}
              </Text>
            ))}
          </View>
        )}

        {/* Totals */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm">
          <Row label="Подытог" value={`${subtotal} ${sym}`} />
          <Row label="Доставка" value={`${deliveryFee} ${sym}`} />
          <View className="border-t border-border pt-2 mt-2 flex-row justify-between">
            <Text className="font-extrabold text-text">Итого к оплате</Text>
            <Text className="font-extrabold text-accent text-lg">
              {total} {sym}
            </Text>
          </View>
          <Text className="text-2xs text-text-muted mt-1.5">
            Оплата наличными при получении.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-3 bg-soft-bg border-t border-border">
        <Pressable
          disabled={!canOrder || placing}
          onPress={onPlaceOrder}
          className={`h-14 rounded-2xl items-center justify-center flex-row ${
            canOrder && !placing
              ? "bg-accent active:opacity-90"
              : "bg-soft-surface-2"
          }`}
        >
          {placing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`font-extrabold text-base ${
                canOrder ? "text-text-inverse" : "text-text-muted"
              }`}
            >
              {canOrder
                ? `Заказать (наличными) — ${total} ${sym}`
                : "Сначала устраните блокировки"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function HeaderBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center px-5 pt-4 pb-3 bg-soft-bg">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:opacity-80 mr-3"
      >
        <Ionicons name="chevron-back" size={20} color="#1F1B16" />
      </Pressable>
      <Text className="text-lg font-extrabold text-text flex-1">{title}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-sm text-text-soft">{label}</Text>
      <Text className="text-sm text-text font-bold">{value}</Text>
    </View>
  );
}
