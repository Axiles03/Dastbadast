import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@apollo/client/react";
import { useRouter, useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  GET_RESTAURANTS,
  GET_CONFIGURATION,
  GET_RESTAURANT,
} from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { useCart } from "../../lib/cart-context";
import { FoodCard, coverFor, FoodCardItem } from "../../components/FoodCard";
import { EmptyState } from "../../components/EmptyState";
import { CartBar } from "../../components/CartBar";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "all" | "popular" | "salad" | "pizza" | "pasta";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "popular", label: "Популярные" },
  { id: "salad", label: "Салаты" },
  { id: "pizza", label: "Пицца" },
  { id: "pasta", label: "Паста" },
];

function isFoodMatch(title: string, filter: Tab): boolean {
  const t = title.toLowerCase();
  if (filter === "all") return true;
  if (filter === "popular") return true;
  if (filter === "salad") return t.includes("салат");
  if (filter === "pizza") return t.includes("пицц");
  if (filter === "pasta")
    return t.includes("паста") || t.includes("лапш") || t.includes("лагман");
  return true;
}

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { restaurantName } = useCart();

  // ⭐ useQuery<any> — фикс типов Apollo v4
  const { data: cfg } = useQuery<any>(GET_CONFIGURATION);
  const { data, loading, refetch } = useQuery<any>(GET_RESTAURANTS, {
    fetchPolicy: "cache-and-network",
  });

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [filters, setFilters] = useState({
    selectedCategories: [] as string[],
    selectedTypes: [] as string[],
    minRating: 0,
    minPrice: 0,
    maxPrice: 50,
  });

  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const restaurants = (data?.restaurants ?? []) as Array<{
    id: string;
    name: string;
    address?: string;
    image?: string;
    minimumOrder: number;
  }>;

  const featured = restaurants[0];
  const featuredId = featured?.id;

  // ⭐ FIX: реальный запрос блюд featured-ресторана
  const { data: featuredData, loading: featuredLoading } = useQuery<any>(
    GET_RESTAURANT,
    {
      variables: { id: featuredId || "" },
      skip: !featuredId,
      fetchPolicy: "cache-and-network",
    },
  );

  const featuredFoods = useMemo<FoodCardItem[]>(() => {
    if (!featuredData?.restaurant?.categories) return [];
    const rid = featuredData.restaurant.id;
    const rname = featuredData.restaurant.name;
    return featuredData.restaurant.categories
      .flatMap((c: any) => c.foods || [])
      .filter((f: any) => f && f.isAvailable !== false)
      .map((f: any) => ({
        id: String(f.id),
        title: f.title,
        price: Number(f.price ?? 0),
        image: f.image ?? null,
        description: f.description ?? null,
        averageRating:
          typeof f.averageRating === "number" ? f.averageRating : undefined,
        reviewCount:
          typeof f.reviewCount === "number" ? f.reviewCount : undefined,
        restaurantId: rid,
        restaurantName: rname,
      }));
  }, [featuredData]);

  const visibleFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return featuredFoods.filter(
      (f) =>
        isFoodMatch(f.title, tab) &&
        (!q ||
          f.title.toLowerCase().includes(q) ||
          (f.description || "").toLowerCase().includes(q)),
    );
  }, [featuredFoods, tab, search]);

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <View className="flex-row items-center gap-2 flex-1">
            <Ionicons name="location-outline" size={18} color="#F26A4A" />
            <View>
              <Text className="text-xs text-text-muted">Доставить</Text>
              <Pressable
                onPress={() => router.push("/(app)/address" as any)}
                className="flex-row items-center"
              >
                <Text className="text-base font-extrabold text-text">
                  {user?.name?.split(" ")[0] || "Душанбе"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color="#6B6358"
                  style={{ marginLeft: 4 }}
                />
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={() => setShowProfile(true)}
            className="w-9 h-9 rounded-full bg-soft-surface-2 items-center justify-center border border-border active:opacity-80"
          >
            <Ionicons name="person-outline" size={18} color="#1F1B16" />
          </Pressable>
        </View>

        <Text className="text-2xl font-extrabold text-text px-5 mb-4">
          Лучшие блюда для вас
        </Text>

        {/* Search + filter */}
        <View className="flex-row items-center gap-2.5 px-5 mb-5">
          <View className="flex-1 flex-row items-center bg-soft-surface border border-border rounded-2xl pl-4 pr-2 py-2 shadow-soft-sm">
            <Ionicons name="search-outline" size={18} color="#9A9388" />
            <TextInput
              className="flex-1 ml-2 text-base text-text"
              placeholder="Поиск блюд и ресторанов"
              placeholderTextColor="#9A9388"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable
            onPress={() => setShowFilters(true)}
            className="w-12 h-12 rounded-2xl bg-purple items-center justify-center active:opacity-80"
          >
            <Ionicons name="options-outline" size={20} color="white" />
          </Pressable>
        </View>

        {/* Loading */}
        {loading && restaurants.length === 0 && (
          <View className="px-5 py-10 items-center">
            <ActivityIndicator color="#F26A4A" size="large" />
            <Text className="text-text-muted text-sm mt-3">
              Загружаем рестораны…
            </Text>
          </View>
        )}

        {/* Empty */}
        {!loading && restaurants.length === 0 && (
          <EmptyState
            emoji="🍽"
            title="Ресторанов пока нет"
            subtitle="Заведения скоро появятся в вашем городе"
          />
        )}

        {/* Product of the day — featured restaurant */}
        {featured && (
          <Pressable
            onPress={() =>
              featuredId &&
              router.push(`/(app)/restaurant/${featuredId}` as any)
            }
            className="mx-5 mb-5 bg-soft-dark rounded-2xl p-5 flex-row items-center shadow-soft-lg active:opacity-95"
          >
            <View className="flex-1">
              <Text className="text-text-muted text-xs">Заведение дня</Text>
              <Text
                className="text-text-inverse text-lg font-extrabold mt-1"
                numberOfLines={1}
              >
                {featured.name}
              </Text>
              <Text className="text-accent text-base font-extrabold mt-1">
                от {featured.minimumOrder} {sym}
              </Text>
            </View>
            <View className="w-24 h-24 rounded-full bg-soft-surface-2 overflow-hidden ml-3 border-2 border-text-inverse">
              <FeaturedImage image={featured.image} name={featured.name} />
            </View>
          </Pressable>
        )}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 8,
            paddingBottom: 12,
          }}
          className="mb-2"
        >
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-full border ${
                tab === t.id
                  ? "bg-accent border-accent"
                  : "bg-soft-surface border-border"
              }`}
            >
              <Text
                className={`text-sm font-extrabold ${
                  tab === t.id ? "text-text-inverse" : "text-text-soft"
                }`}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Carousel of foods */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-lg font-extrabold text-text">
              {tab === "all"
                ? "Все блюда"
                : tab === "popular"
                  ? "Популярные блюда"
                  : tab === "salad"
                    ? "Салаты"
                    : tab === "pizza"
                      ? "Пицца"
                      : "Паста и супы"}
            </Text>
            {visibleFoods.length > 3 && featuredId && (
              <Pressable
                onPress={() =>
                  router.push(`/(app)/restaurant/${featuredId}` as any)
                }
              >
                <Text className="text-sm font-bold text-accent">Все</Text>
              </Pressable>
            )}
          </View>

          {featuredLoading && featuredFoods.length === 0 ? (
            <View className="px-5 py-6">
              <ActivityIndicator color="#F26A4A" />
            </View>
          ) : visibleFoods.length === 0 ? (
            <View className="px-5 py-6">
              <Text className="text-sm text-text-muted text-center">
                {featuredId
                  ? "Нет блюд в этой категории"
                  : "Загрузите блюда — перейдите в ресторан"}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {visibleFoods.map((food) => (
                <View key={food.id}>
                  <FoodCard
                    food={food}
                    currencySymbol={sym || ""}
                    onPress={() => {
                      if (featuredId)
                        router.push(`/(app)/restaurant/${featuredId}` as any);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Restaurants list */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-lg font-extrabold text-text">
              Все рестораны{" "}
              <Text className="text-text-muted font-medium">
                {restaurants.length}
              </Text>
            </Text>
          </View>
          <View className="px-5">
            {restaurants.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/(app)/restaurant/${r.id}` as any)}
                className="bg-soft-surface border border-border rounded-2xl mb-3 shadow-soft-sm active:border-accent overflow-hidden"
              >
                <View className="h-32 bg-soft-surface-2">
                  <FeaturedImage image={r.image} name={r.name} large />
                </View>
                <View className="p-3">
                  <Text
                    className="text-base font-extrabold text-text"
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  {r.address && (
                    <Text
                      className="text-xs text-text-muted mt-0.5"
                      numberOfLines={1}
                    >
                      {r.address}
                    </Text>
                  )}
                  <Text className="text-sm font-extrabold text-accent mt-1">
                    Мин. заказ · {r.minimumOrder} {sym}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <CartBar symbol={sym} />

      {/* Filters Modal */}
      <FiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Profile Sheet */}
      <ProfileSheet
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onLogout={async () => {
          await logout();
          setShowProfile(false);
        }}
        onOrders={() => {
          setShowProfile(false);
          router.push("/(app)/orders" as any);
        }}
        onAddress={() => {
          setShowProfile(false);
          router.push("/(app)/address" as any);
        }}
        onSupport={() => {
          setShowProfile(false);
          router.push("/(app)/support" as any);
        }}
      />
    </SafeAreaView>
  );
}

function FeaturedImage({
  image,
  name,
  large,
}: {
  image?: string | null;
  name: string;
  large?: boolean;
}) {
  if (image && image.trim()) {
    return (
      <View className="w-full h-full items-center justify-center">
        <Ionicons
          name="restaurant-outline"
          size={large ? 48 : 64}
          color="#9A9388"
        />
      </View>
    );
  }
  return (
    <View className="w-full h-full items-center justify-center">
      <Text className={large ? "text-6xl" : "text-7xl"}>🍽</Text>
    </View>
  );
}

function FiltersModal({
  visible,
  onClose,
  filters,
  setFilters,
}: {
  visible: boolean;
  onClose: () => void;
  filters: any;
  setFilters: any;
}) {
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-soft-surface rounded-t-3xl p-5 pb-8">
          <View className="items-center mb-4">
            <View className="w-12 h-1 bg-border rounded-full" />
          </View>
          <Text className="text-lg font-extrabold text-text mb-4">Фильтры</Text>

          <Text className="text-base text-text-muted mb-2.5">Категории</Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {["Основные блюда", "Напитки", "Десерты"].map((c) => (
              <Pressable
                key={c}
                onPress={() =>
                  setFilters((f: any) => ({
                    ...f,
                    selectedCategories: f.selectedCategories.includes(c)
                      ? f.selectedCategories.filter((x: string) => x !== c)
                      : [...f.selectedCategories, c],
                  }))
                }
                className={`px-4 py-2.5 rounded-full border ${
                  filters.selectedCategories.includes(c)
                    ? "bg-accent border-accent"
                    : "bg-soft-surface border-border"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    filters.selectedCategories.includes(c)
                      ? "text-text-inverse"
                      : "text-text-soft"
                  }`}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-base text-text-muted mb-2.5">Тип блюда</Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {["Плов", "Шашлык", "Манты", "Лагман", "Чай", "Суп", "Салат"].map(
              (c) => (
                <Pressable
                  key={c}
                  onPress={() =>
                    setFilters((f: any) => ({
                      ...f,
                      selectedTypes: f.selectedTypes.includes(c)
                        ? f.selectedTypes.filter((x: string) => x !== c)
                        : [...f.selectedTypes, c],
                    }))
                  }
                  className={`px-4 py-2.5 rounded-full border ${
                    filters.selectedTypes.includes(c)
                      ? "bg-accent border-accent"
                      : "bg-soft-surface border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      filters.selectedTypes.includes(c)
                        ? "text-text-inverse"
                        : "text-text-soft"
                    }`}
                  >
                    {c}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <Text className="text-base text-text-muted mb-2.5">Рейтинг</Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {[1, 2, 3, 4, 5].map((r) => (
              <Pressable
                key={r}
                onPress={() => setFilters((f: any) => ({ ...f, minRating: r }))}
                className={`px-3.5 py-2.5 rounded-full border ${
                  filters.minRating === r
                    ? "bg-accent border-accent"
                    : "bg-soft-surface border-border"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="star"
                    size={14}
                    color={filters.minRating === r ? "white" : "#F5A623"}
                  />
                  <Text
                    className={`text-sm font-bold ml-1 ${
                      filters.minRating === r
                        ? "text-text-inverse"
                        : "text-text-soft"
                    }`}
                  >
                    {r}+
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="bg-purple h-14 rounded-2xl items-center justify-center active:opacity-90"
          >
            <Text className="text-text-inverse font-extrabold text-lg">
              Применить
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ProfileSheet({
  visible,
  onClose,
  onLogout,
  onOrders,
  onAddress,
  onSupport,
}: {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onOrders: () => void;
  onAddress: () => void;
  onSupport: () => void;
}) {
  const { user } = useAuth();
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-soft-surface rounded-t-3xl p-5 pb-8">
          <View className="items-center mb-4">
            <View className="w-12 h-1 bg-border rounded-full" />
          </View>
          <View className="items-center mb-5">
            <View className="w-20 h-20 rounded-full bg-purple items-center justify-center mb-3">
              <Text className="text-text-inverse text-2xl font-extrabold">
                {(user?.name?.[0] || "Г").toUpperCase()}
              </Text>
            </View>
            <Text className="text-lg font-extrabold text-text">
              {user?.name || "Гость"}
            </Text>
            {user?.phone && (
              <Text className="text-sm text-text-muted mt-0.5">
                {user.phone}
              </Text>
            )}
            {user?.email && (
              <Text className="text-sm text-text-muted">{user.email}</Text>
            )}
          </View>
          <Pressable
            onPress={onOrders}
            className="flex-row items-center px-4 py-3.5 bg-soft-surface-2 rounded-2xl mb-2"
          >
            <Ionicons name="receipt-outline" size={20} color="#1F1B16" />
            <Text className="text-sm font-bold text-text ml-3 flex-1">
              История заказов
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9A9388" />
          </Pressable>
          <Pressable
            onPress={onAddress}
            className="flex-row items-center px-4 py-3.5 bg-soft-surface-2 rounded-2xl mb-2"
          >
            <Ionicons name="location-outline" size={20} color="#1F1B16" />
            <Text className="text-sm font-bold text-text ml-3 flex-1">
              Мои адреса
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9A9388" />
          </Pressable>
          <Pressable
            onPress={onSupport}
            className="flex-row items-center px-4 py-3.5 bg-soft-surface-2 rounded-2xl mb-2"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color="#1F1B16"
            />
            <Text className="text-sm font-bold text-text ml-3 flex-1">
              Поддержка
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9A9388" />
          </Pressable>
          <Pressable
            onPress={() => {
              onClose();
              router.push("/(app)/email-settings" as any);
            }}
            className="flex-row items-center px-4 py-3.5 bg-soft-surface-2 rounded-2xl mb-2"
          >
            <Ionicons name="mail-outline" size={20} color="#1F1B16" />
            <Text className="text-sm font-bold text-text ml-3 flex-1">
              Добавить email
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9A9388" />
          </Pressable>
          <Pressable
            onPress={onLogout}
            className="flex-row items-center px-4 py-3.5 bg-red-soft rounded-2xl"
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text className="text-sm font-bold text-red-dark ml-3 flex-1">
              Выйти
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
