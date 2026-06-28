import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useQuery } from "@apollo/client/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GET_RESTAURANT, GET_CONFIGURATION } from "../../../lib/api/queries";
import { useCart } from "../../../lib/cart-context";
import { EmptyState } from "../../../components/EmptyState";
import { CartBar } from "../../../components/CartBar";
import { coverFor } from "../../../components/FoodCard";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RestaurantPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { add, items } = useCart();

  // ⭐ useQuery<any> — фикс
  const { data: cfg } = useQuery<any>(GET_CONFIGURATION);
  const { data, loading, error } = useQuery<any>(GET_RESTAURANT, {
    variables: { id: id || "" },
    skip: !id,
  });

  const [search, setSearch] = useState("");
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  const r = data?.restaurant;
  const categories = r?.categories ?? [];
  const [activeCat, setActiveCat] = useState<string>("");

  const currentCat =
    categories.find((c: any) => c.id === activeCat) || categories[0];

  const filteredFoods = useMemo(() => {
    if (!currentCat) return [];
    const q = search.trim().toLowerCase();
    const list = currentCat.foods ?? [];
    if (!q) return list;
    return list.filter(
      (f: any) =>
        f.title.toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q),
    );
  }, [currentCat, search]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator color="#F26A4A" size="large" />
      </View>
    );
  }

  if (error || !r) {
    return (
      <View className="flex-1 bg-soft-bg">
        <EmptyState
          emoji="😕"
          title="Ресторан не найден"
          subtitle="Попробуйте вернуться на главную"
        />
        <Pressable
          onPress={() => router.back()}
          className="mx-5 mt-2 h-12 bg-soft-surface border border-border rounded-2xl items-center justify-center"
        >
          <Text className="text-text font-extrabold">Назад</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header bar */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:opacity-80"
          >
            <Ionicons name="chevron-back" size={20} color="#1F1B16" />
          </Pressable>
          <Text
            className="text-base font-extrabold text-text flex-1 text-center"
            numberOfLines={1}
          >
            {r.name}
          </Text>
          <View className="w-10 h-10" />
        </View>

        <View className="px-5 mb-3">
          <Text className="text-2xl font-extrabold text-text tracking-tight">
            {r.name}
          </Text>
          {r.address && (
            <Text className="text-sm text-text-soft mt-1">{r.address}</Text>
          )}
          <View className="flex-row gap-2 mt-2 flex-wrap">
            <View className="bg-soft-surface-2 border border-border rounded-full px-3 py-1">
              <Text className="text-2xs font-bold text-text-soft">
                Мин. заказ · {r.minimumOrder} {sym}
              </Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-soft-surface border border-border rounded-2xl px-4 mx-5 py-2 mb-3 shadow-soft-sm">
          <Ionicons name="search-outline" size={16} color="#9A9388" />
          <TextInput
            className="flex-1 ml-2 text-sm text-text"
            placeholder="Поиск блюда..."
            placeholderTextColor="#9A9388"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Categories chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 10,
            paddingBottom: 8,
          }}
        >
          {categories.map((c: any) => (
            <Pressable
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              className={`px-4 py-3 rounded-2xl border min-w-[88px] items-center ${
                currentCat?.id === c.id
                  ? "bg-accent-soft border-accent"
                  : "bg-soft-surface border-border"
              }`}
            >
              <Text className="text-2xl mb-1">{categoryEmoji(c.title)}</Text>
              <Text
                className={`text-xs font-extrabold text-center ${
                  currentCat?.id === c.id ? "text-accent" : "text-text"
                }`}
              >
                {c.title}
              </Text>
              <Text className="text-2xs text-text-muted mt-0.5">
                {c.foods?.length ?? 0} шт.
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Foods list */}
        <View className="px-5 mt-3">
          <Text className="text-lg font-extrabold text-text mb-2.5">
            {currentCat?.title || "Меню"}
          </Text>
          {filteredFoods.length === 0 ? (
            <Text className="text-text-soft text-sm py-4">
              Ничего не найдено
            </Text>
          ) : (
            filteredFoods.map((f: any) => {
              const inCart = items.find((i) => i.foodId === f.id);
              return (
                <View
                  key={f.id}
                  className="bg-soft-surface border border-border rounded-2xl p-3 flex-row gap-3 mb-3 shadow-soft-sm"
                >
                  <View className="w-20 h-20 rounded-2xl bg-soft-surface-2 overflow-hidden">
                    <View className="w-full h-full items-center justify-center">
                      <Text className="text-3xl">🍽</Text>
                    </View>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-sm font-extrabold text-text"
                      numberOfLines={1}
                    >
                      {f.title}
                    </Text>
                    {f.description && (
                      <Text
                        className="text-xs text-text-soft mt-0.5"
                        numberOfLines={2}
                      >
                        {f.description}
                      </Text>
                    )}
                    <View className="flex-row items-center justify-between mt-1.5">
                      <View>
                        <Text className="text-sm font-extrabold text-accent">
                          {f.price} {sym}
                        </Text>
                        {typeof f.averageRating === "number" &&
                          f.averageRating > 0 && (
                            <View className="flex-row items-center mt-0.5">
                              <Ionicons name="star" size={10} color="#F5A623" />
                              <Text className="text-2xs text-text-muted ml-0.5">
                                {f.averageRating.toFixed(1)} ·{" "}
                                {f.reviewCount ?? 0} отз.
                              </Text>
                            </View>
                          )}
                      </View>
                      {inCart ? (
                        <View className="flex-row items-center bg-accent-soft border border-accent rounded-full px-2.5 py-1">
                          <Pressable
                            onPress={() =>
                              add({
                                foodId: f.id,
                                title: f.title,
                                price: f.price,
                                image: coverFor(f.title, f.image),
                                description: f.description,
                                quantity: -1,
                                restaurantId: r.id,
                                restaurantName: r.name,
                              })
                            }
                            className="w-6 h-6 items-center justify-center"
                          >
                            <Ionicons name="remove" size={16} color="#DC5635" />
                          </Pressable>
                          <Text className="font-extrabold text-sm text-accent mx-2">
                            {inCart.quantity}
                          </Text>
                          <Pressable
                            onPress={() =>
                              add({
                                foodId: f.id,
                                title: f.title,
                                price: f.price,
                                image: coverFor(f.title, f.image),
                                description: f.description,
                                quantity: 1,
                                restaurantId: r.id,
                                restaurantName: r.name,
                              })
                            }
                            className="w-6 h-6 items-center justify-center"
                          >
                            <Ionicons name="add" size={16} color="#DC5635" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() =>
                            add({
                              foodId: f.id,
                              title: f.title,
                              price: f.price,
                              image: coverFor(f.title, f.image),
                              description: f.description,
                              quantity: 1,
                              restaurantId: r.id,
                              restaurantName: r.name,
                            })
                          }
                          className="bg-accent w-9 h-9 rounded-full items-center justify-center shadow-soft-sm active:scale-95"
                        >
                          <Ionicons name="add" size={20} color="white" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <CartBar symbol={sym} />
    </SafeAreaView>
  );
}

function categoryEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("бургер") || t.includes("burger")) return "🍔";
  if (
    t.includes("напит") ||
    t.includes("drink") ||
    t.includes("чай") ||
    t.includes("кофе")
  )
    return "🥤";
  if (t.includes("десерт") || t.includes("слад")) return "🧁";
  if (t.includes("суп") || t.includes("лапш") || t.includes("лагман"))
    return "🍜";
  if (t.includes("салат")) return "🥗";
  if (t.includes("пицц")) return "🍕";
  if (t.includes("основ") || t.includes("горяч")) return "🍽️";
  if (t.includes("шашлык") || t.includes("мяс")) return "🥩";
  return "🍴";
}
