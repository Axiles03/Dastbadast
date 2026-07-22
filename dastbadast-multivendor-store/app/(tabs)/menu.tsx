// dastbadast-multivendor-store/app/(tabs)/menu.tsx
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from "react-native";
import { cn } from "../../lib/cn";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  MY_MENU,
  CREATE_CATEGORY,
  UPDATE_CATEGORY,
  DELETE_CATEGORY,
  CREATE_FOOD,
  UPDATE_FOOD,
  DELETE_FOOD,
  BULK_SET_FOOD_AVAILABILITY,
  SET_FOOD_UNAVAILABLE_UNTIL,
} from "../../lib/api/graphql/queries";
import { useAuth } from "../../lib/auth-context";
import { EmptyState } from "../../components/EmptyState";
import { pluralize } from "../../lib/format";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

type Food = {
  id: string;
  title: string;
  description?: string;
  price: number;
  image?: string;
  isAvailable: boolean;
};
type Category = {
  id: string;
  title: string;
  image?: string;
  foods: Food[];
};

function minutesUntilEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return Math.max(1, Math.round((endOfDay.getTime() - now.getTime()) / 60000));
}

export default function MenuScreen() {
  const { restaurant } = useAuth();
  const { data, loading, refetch } = useQuery<any>(MY_MENU, {
    skip: !restaurant?.id,
  });
  const [createCategory] = useMutation(CREATE_CATEGORY);
  const [updateCategory] = useMutation(UPDATE_CATEGORY);
  const [deleteCategory] = useMutation(DELETE_CATEGORY);
  const [createFood] = useMutation(CREATE_FOOD);
  const [updateFood] = useMutation(UPDATE_FOOD);
  const [deleteFood] = useMutation(DELETE_FOOD);

  const [bulkMutation] = useMutation(BULK_SET_FOOD_AVAILABILITY);
  const [ttlMutation] = useMutation(SET_FOOD_UNAVAILABLE_UNTIL);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFoodIds, setSelectedFoodIds] = useState<Set<string>>(
    new Set(),
  );
  const [ttlModalFoodId, setTtlModalFoodId] = useState<string | null>(null); // для одиночной TTL-заморозки

  const toggleSelected = (id: string) => {
    setSelectedFoodIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedFoodIds(new Set());
  };

  const applyBulk = async (isAvailable: boolean) => {
    if (selectedFoodIds.size === 0) return;
    try {
      await bulkMutation({
        variables: { foodIds: Array.from(selectedFoodIds), isAvailable },
      });
      Toast.show({
        type: "success",
        text1: isAvailable ? "Блюда включены" : "Блюда скрыты",
        text2: `${selectedFoodIds.size} шт.`,
      });
      exitSelectionMode();
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось изменить блюда");
    }
  };

  const applyTtl = async (foodId: string, minutes: number) => {
    try {
      await ttlMutation({ variables: { id: foodId, minutesFromNow: minutes } });
      Toast.show({
        type: "info",
        text1: `Скрыто на ${minutes < 60 ? `${minutes} мин` : `${Math.round(minutes / 60)} ч`}`,
      });
      setTtlModalFoodId(null);
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось скрыть блюдо");
    }
  };

  const [catModal, setCatModal] = useState<"add" | "edit" | null>(null);
  const [foodModal, setFoodModal] = useState<"add" | "edit" | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editFoodId, setEditFoodId] = useState<string | null>(null);
  const [catTitle, setCatTitle] = useState("");
  const [foodForm, setFoodForm] = useState({
    title: "",
    description: "",
    price: "",
    image: "",
    categoryId: "",
    isAvailable: true,
    isVegetarian: false,
    spiceLevel: 0,
    allergensText: "", // вводим через запятую, конвертим в массив при сохранении
    optionGroups: [] as Array<{
      title: string;
      required: boolean;
      multiple: boolean;
      minSelect: number;
      maxSelect: number;
      options: Array<{ title: string; price: string }>;
    }>,
  });
  const [busy, setBusy] = useState(false);

  const categories: Category[] = data?.meRestaurant?.categories ?? [];
  const totalFoods = categories.reduce((s, c) => s + (c.foods?.length || 0), 0);

  const openAddCategory = () => {
    setCatTitle("");
    setEditCatId(null);
    setCatModal("add");
  };
  const openEditCategory = (c: Category) => {
    setCatTitle(c.title);
    setEditCatId(c.id);
    setCatModal("edit");
  };

  const saveCategory = async () => {
    if (!catTitle.trim()) {
      Alert.alert("Ошибка", "Введите название категории");
      return;
    }
    setBusy(true);
    try {
      if (catModal === "add") {
        await createCategory({
          variables: { input: { title: catTitle.trim() } },
        });
      } else if (editCatId) {
        await updateCategory({
          variables: { id: editCatId, input: { title: catTitle.trim() } },
        });
      }
      setCatModal(null);
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = (c: Category) => {
    Alert.alert("Удалить категорию?", c.title, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCategory({ variables: { id: c.id } });
            await refetch();
          } catch (e: any) {
            Alert.alert("Ошибка", e?.message ?? "Не удалось удалить");
          }
        },
      },
    ]);
  };

  const openAddFood = (categoryId?: string) => {
    const defaultCat = categoryId || categories[0]?.id || "";
    if (!defaultCat) {
      Alert.alert("Сначала создайте категорию");
      return;
    }
    setFoodForm({
      title: "",
      description: "",
      price: "",
      image: "",
      categoryId: defaultCat,
      isAvailable: true,
      isVegetarian: false,
      spiceLevel: 0,
      allergensText: "",
      optionGroups: [],
    });
    setEditFoodId(null);
    setFoodModal("add");
  };

  const openEditFood = (food: Food, categoryId: string) => {
    setFoodForm({
      title: food.title,
      description: food.description || "",
      price: String(food.price),
      image: (food as any).image || "",
      categoryId,
      isAvailable: food.isAvailable,
      isVegetarian: !!(food as any).isVegetarian,
      spiceLevel: (food as any).spiceLevel ?? 0,
      allergensText: ((food as any).allergens || []).join(", "),
      optionGroups: ((food as any).optionGroups || []).map((g: any) => ({
        title: g.title,
        required: g.required,
        multiple: g.multiple,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: (g.options || []).map((o: any) => ({
          title: o.title,
          price: String(o.price),
        })),
      })),
    });
    setEditFoodId(food.id);
    setFoodModal("edit");
  };

  const saveFood = async () => {
    if (!foodForm.categoryId) {
      Alert.alert("Ошибка", "Выберите категорию");
      return;
    }
    if (!foodForm.title.trim()) {
      Alert.alert("Ошибка", "Введите название блюда");
      return;
    }
    const price = parseFloat(foodForm.price.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Ошибка", "Укажите корректную цену");
      return;
    }
    const optionGroupsPayload = foodForm.optionGroups
      .filter((g) => g.title.trim() && g.options.length > 0)
      .map((g) => ({
        title: g.title.trim(),
        required: g.required,
        multiple: g.multiple,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options
          .filter((o) => o.title.trim())
          .map((o) => ({
            title: o.title.trim(),
            price: parseFloat(o.price.replace(",", ".")) || 0,
          })),
      }));
    const allergensPayload = foodForm.allergensText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      if (foodModal === "add") {
        await createFood({
          variables: {
            input: {
              categoryId: foodForm.categoryId,
              title: foodForm.title.trim(),
              description: foodForm.description.trim(),
              image: foodForm.image.trim() || undefined,
              price,
              isVegetarian: foodForm.isVegetarian,
              spiceLevel: foodForm.spiceLevel,
              allergens: allergensPayload,
              optionGroups: optionGroupsPayload,
            },
          },
        });
      } else if (editFoodId) {
        await updateFood({
          variables: {
            id: editFoodId,
            input: {
              categoryId: foodForm.categoryId,
              title: foodForm.title.trim(),
              description: foodForm.description.trim(),
              image: foodForm.image.trim() || undefined,
              price,
              isAvailable: foodForm.isAvailable,
              isVegetarian: foodForm.isVegetarian,
              spiceLevel: foodForm.spiceLevel,
              allergens: allergensPayload,
              optionGroups: optionGroupsPayload,
            },
          },
        });
      }
      setFoodModal(null);
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const removeFood = (food: Food) => {
    Alert.alert("Удалить блюдо?", food.title, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFood({ variables: { id: food.id } });
            await refetch();
          } catch (e: any) {
            Alert.alert("Ошибка", e?.message ?? "Не удалось удалить");
          }
        },
      },
    ]);
  };

  if (loading && !categories.length) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator size="large" color="#F26A4A" />
        <Text className="text-text-muted text-sm mt-3">Загружаем меню…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-soft-bg">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Шапка */}
        <View className="mb-4">
          <Text className="text-2xl font-extrabold text-text tracking-tight">
            Моё меню
          </Text>
          <Text className="text-sm text-text-muted mt-0.5">
            {restaurant?.name ?? "Ресторан"} · {totalFoods}{" "}
            {pluralize(totalFoods, "блюдо", "блюда", "блюд")}
          </Text>
        </View>

        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text className="text-2xl font-extrabold text-text">Моё меню</Text>
          <TouchableOpacity
            onPress={() =>
              selectionMode ? exitSelectionMode() : setSelectionMode(true)
            }
            className="px-3 py-1.5 rounded-lg bg-soft-surface-2"
          >
            <Text className="text-xs font-bold text-text">
              {selectionMode ? "Отмена" : "Выбрать"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Кнопки действий */}
        <View className="flex-row gap-2.5 mb-5">
          <TouchableOpacity
            onPress={openAddCategory}
            className="flex-1 h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm active:opacity-85"
          >
            <Text className="text-text-inverse font-extrabold text-base">
              + Категория
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openAddFood()}
            className="flex-1 h-12 rounded-2xl items-center justify-center bg-soft-surface border border-accent active:opacity-85"
          >
            <Text className="text-accent font-extrabold text-base">
              + Блюдо
            </Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <View className="bg-soft-surface border border-border rounded-2xl p-7 items-center">
            <EmptyState
              emoji="🍽"
              title="Нет категорий"
              subtitle="Нажмите «+ Категория», чтобы добавить «Основные блюда», «Напитки», «Десерты»…"
              compact
            />
          </View>
        ) : (
          categories.map((cat) => (
            <View
              key={cat.id}
              className="bg-soft-surface border border-border rounded-2xl mb-3.5 overflow-hidden shadow-soft-sm"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-3.5 bg-soft-surface-2 border-b border-border">
                <Text className="text-base font-extrabold text-text tracking-tight flex-1">
                  {cat.title}
                </Text>
                <View className="flex-row gap-1">
                  <TouchableOpacity
                    onPress={() => openEditCategory(cat)}
                    className="px-2 py-1.5"
                    hitSlop={6}
                  >
                    <Text className="text-accent font-bold text-sm">
                      Изменить
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeCategory(cat)}
                    className="px-2 py-1.5"
                    hitSlop={6}
                  >
                    <Text className="text-red font-bold text-sm">Удалить</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {(cat.foods || []).length === 0 ? (
                <View className="py-5 items-center">
                  {selectionMode && (
                    <TouchableOpacity
                      onPress={() => toggleSelected(cat.id)}
                      className={cn(
                        "w-6 h-6 rounded-md border-2 items-center justify-center mr-2",
                        selectedFoodIds.has(cat.id)
                          ? "bg-accent border-accent"
                          : "border-border",
                      )}
                    >
                      {selectedFoodIds.has(cat.id) && (
                        <Text className="text-text-inverse text-xs font-bold">
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text className="text-sm text-text-muted">
                    В этой категории пока пусто
                  </Text>
                  <TouchableOpacity
                    onPress={() => openAddFood(cat.id)}
                    className="mt-2"
                  >
                    <Text className="text-accent font-bold text-sm">
                      + Добавить блюдо
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                (cat.foods || []).map((food, idx) => (
                  <View
                    key={food.id}
                    className={`flex-row items-center px-4 py-3.5 ${
                      idx === (cat.foods?.length ?? 0) - 1
                        ? ""
                        : "border-b border-border"
                    }`}
                  >
                    {food.image ? (
                      <Image
                        source={{ uri: food.image }}
                        className="w-[60px] h-[60px] rounded-2xl bg-soft-surface-2"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-[60px] h-[60px] rounded-2xl bg-soft-surface-2 items-center justify-center">
                        <Text className="text-2xl">🍽</Text>
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text className="text-sm font-extrabold text-text">
                        {food.title}
                      </Text>
                      {food.description && (
                        <Text
                          className="text-2xs text-text-muted mt-0.5 leading-4"
                          numberOfLines={2}
                        >
                          {food.description}
                        </Text>
                      )}
                      <Text className="text-sm font-extrabold text-accent mt-1">
                        {food.price} сом.
                      </Text>
                      {!food.isAvailable && (
                        <Text className="text-2xs text-warning-dark font-bold mt-0.5">
                          ⏸ Скрыто из меню
                        </Text>
                      )}
                    </View>
                    <View className="gap-1.5">
                      <TouchableOpacity
                        onPress={() => openEditFood(food, cat.id)}
                        className="px-3 py-1.5 rounded-lg bg-accent-soft active:opacity-70"
                        hitSlop={4}
                      >
                        <Text className="text-2xs font-bold text-accent-dark">
                          Изм.
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFood(food)}
                        className="px-3 py-1.5 rounded-lg bg-red-soft active:opacity-70"
                        hitSlop={4}
                      >
                        <Text className="text-2xs font-bold text-red-dark">
                          Удал.
                        </Text>
                      </TouchableOpacity>
                      {!selectionMode && food.isAvailable && (
                        <TouchableOpacity
                          onPress={() => setTtlModalFoodId(food.id)}
                          className="px-3 py-1.5 rounded-lg bg-warning-soft active:opacity-70"
                          hitSlop={4}
                        >
                          <Text className="text-2xs font-bold text-warning-dark">
                            ⏸ До...
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}

              {(cat.foods || []).length > 0 && (
                <TouchableOpacity
                  onPress={() => openAddFood(cat.id)}
                  className="py-3.5 items-center"
                >
                  <Text className="text-accent font-bold text-sm">
                    + Блюдо в «{cat.title}»
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        {selectionMode && selectedFoodIds.size > 0 && (
          <View className="absolute bottom-0 left-0 right-0 bg-soft-surface border-t border-border p-4 flex-row gap-2">
            <TouchableOpacity
              onPress={() => applyBulk(false)}
              className="flex-1 h-12 rounded-2xl items-center justify-center bg-red-soft"
            >
              <Text className="text-red-dark font-extrabold">
                Скрыть ({selectedFoodIds.size})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyBulk(true)}
              className="flex-1 h-12 rounded-2xl items-center justify-center bg-accent"
            >
              <Text className="text-text-inverse font-extrabold">
                Показать ({selectedFoodIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={ttlModalFoodId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTtlModalFoodId(null)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setTtlModalFoodId(null)}
        >
          <View
            className="bg-soft-surface rounded-2xl p-5 w-72"
            onStartShouldSetResponder={() => true}
          >
            <Text className="text-base font-extrabold text-text mb-4">
              Скрыть блюдо на...
            </Text>
            {[
              { label: "1 час", minutes: 60 },
              { label: "3 часа", minutes: 180 },
              { label: "До конца дня", minutes: minutesUntilEndOfDay() },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.label}
                onPress={() =>
                  ttlModalFoodId && applyTtl(ttlModalFoodId, opt.minutes)
                }
                className="py-3 border-b border-border"
              >
                <Text className="text-text font-semibold">{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Модалка категории */}
      <Modal
        visible={catModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCatModal(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-black/50 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            className="flex-1"
            onPress={() => setCatModal(null)}
          />
          <View className="bg-soft-surface rounded-t-3xl p-5 pb-8">
            <Text className="text-lg font-extrabold text-text mb-4 tracking-tight">
              {catModal === "add" ? "Новая категория" : "Изменить категорию"}
            </Text>
            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Название *
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
              value={catTitle}
              onChangeText={setCatTitle}
              placeholder="Напитки, Основные блюда…"
              placeholderTextColor="#9A9388"
              autoFocus
            />
            <View className="flex-row gap-2.5 mt-2">
              <TouchableOpacity
                onPress={() => setCatModal(null)}
                className="flex-1 h-12 rounded-2xl items-center justify-center border border-border bg-soft-surface"
              >
                <Text className="text-text-soft font-bold text-base">
                  Отмена
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveCategory}
                disabled={busy}
                className={`flex-1 h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm ${
                  busy ? "opacity-50" : "active:opacity-85"
                }`}
              >
                <Text className="text-text-inverse font-extrabold text-base">
                  {busy ? "..." : "Сохранить"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модалка блюда */}
      <Modal
        visible={foodModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFoodModal(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-black/50 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            className="flex-1"
            onPress={() => setFoodModal(null)}
          />
          <ScrollView
            style={{ maxHeight: "92%" }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              padding: 20,
              paddingBottom: 32,
            }}
          >
            <Text className="text-lg font-extrabold text-text mb-4 tracking-tight">
              {foodModal === "add" ? "Новое блюдо" : "Изменить блюдо"}
            </Text>

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Категория *
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3.5">
              {categories.map((c) => {
                const active = foodForm.categoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() =>
                      setFoodForm((f) => ({ ...f, categoryId: c.id }))
                    }
                    className={`px-3.5 py-2 rounded-full border ${
                      active
                        ? "bg-accent border-accent"
                        : "bg-soft-surface border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        active ? "text-text-inverse" : "text-text"
                      }`}
                    >
                      {c.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Название *
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
              value={foodForm.title}
              onChangeText={(t) => setFoodForm((f) => ({ ...f, title: t }))}
              placeholder="Плов, Лагман…"
              placeholderTextColor="#9A9388"
            />

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Описание
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5 min-h-[88px]"
              value={foodForm.description}
              onChangeText={(t) =>
                setFoodForm((f) => ({ ...f, description: t }))
              }
              multiline
              placeholder="Краткое описание"
              placeholderTextColor="#9A9388"
              style={{ textAlignVertical: "top", paddingTop: 12 }}
            />

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Фото (URL)
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
              value={foodForm.image}
              onChangeText={(t) => setFoodForm((f) => ({ ...f, image: t }))}
              placeholder="https://..."
              placeholderTextColor="#9A9388"
              autoCapitalize="none"
            />

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Цена (сом.) *
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
              value={foodForm.price}
              onChangeText={(t) => setFoodForm((f) => ({ ...f, price: t }))}
              keyboardType="decimal-pad"
              placeholder="65"
              placeholderTextColor="#9A9388"
            />
            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Вегетарианское
            </Text>
            <View className="flex-row items-center justify-between mb-3.5 py-1">
              <Text className="text-sm font-bold text-text">Без мяса</Text>
              <Switch
                value={foodForm.isVegetarian}
                onValueChange={(v) =>
                  setFoodForm((f) => ({ ...f, isVegetarian: v }))
                }
                trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Острота
            </Text>
            <View className="flex-row gap-2 mb-3.5">
              {[0, 1, 2, 3].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  onPress={() =>
                    setFoodForm((f) => ({ ...f, spiceLevel: lvl }))
                  }
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    foodForm.spiceLevel === lvl
                      ? "bg-accent border-accent"
                      : "bg-soft-surface border-border"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      foodForm.spiceLevel === lvl
                        ? "text-text-inverse"
                        : "text-text"
                    }`}
                  >
                    {lvl === 0 ? "Нет" : "🌶️".repeat(lvl)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Аллергены (через запятую)
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
              value={foodForm.allergensText}
              onChangeText={(t) =>
                setFoodForm((f) => ({ ...f, allergensText: t }))
              }
              placeholder="орехи, молоко, глютен"
              placeholderTextColor="#9A9388"
            />

            {/* ⭐ Модификаторы (группы опций) — простой редактор */}
            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Модификаторы
            </Text>
            {foodForm.optionGroups.map((g, gi) => (
              <View
                key={gi}
                className="border border-border rounded-xl p-3 mb-2.5 bg-soft-surface-2"
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <TextInput
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
                    value={g.title}
                    onChangeText={(t) =>
                      setFoodForm((f) => {
                        const groups = [...f.optionGroups];
                        groups[gi] = { ...groups[gi], title: t };
                        return { ...f, optionGroups: groups };
                      })
                    }
                    placeholder="Название группы (напр. Размер)"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setFoodForm((f) => ({
                        ...f,
                        optionGroups: f.optionGroups.filter((_, i) => i !== gi),
                      }))
                    }
                  >
                    <Text className="text-red-500 font-bold text-xs px-2">
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center gap-3 mb-2">
                  <Text className="text-xs text-text-muted">Обязательно</Text>
                  <Switch
                    value={g.required}
                    onValueChange={(v) =>
                      setFoodForm((f) => {
                        const groups = [...f.optionGroups];
                        groups[gi] = { ...groups[gi], required: v };
                        return { ...f, optionGroups: groups };
                      })
                    }
                  />
                  <Text className="text-xs text-text-muted ml-3">
                    Несколько вариантов
                  </Text>
                  <Switch
                    value={g.multiple}
                    onValueChange={(v) =>
                      setFoodForm((f) => {
                        const groups = [...f.optionGroups];
                        groups[gi] = { ...groups[gi], multiple: v };
                        return { ...f, optionGroups: groups };
                      })
                    }
                  />
                </View>

                {g.options.map((o, oi) => (
                  <View key={oi} className="flex-row items-center gap-2 mb-1.5">
                    <TextInput
                      className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-white text-text"
                      value={o.title}
                      onChangeText={(t) =>
                        setFoodForm((f) => {
                          const groups = [...f.optionGroups];
                          const options = [...groups[gi].options];
                          options[oi] = { ...options[oi], title: t };
                          groups[gi] = { ...groups[gi], options };
                          return { ...f, optionGroups: groups };
                        })
                      }
                      placeholder="Опция (напр. Большая)"
                    />
                    <TextInput
                      className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm bg-white text-text"
                      value={o.price}
                      onChangeText={(t) =>
                        setFoodForm((f) => {
                          const groups = [...f.optionGroups];
                          const options = [...groups[gi].options];
                          options[oi] = { ...options[oi], price: t };
                          groups[gi] = { ...groups[gi], options };
                          return { ...f, optionGroups: groups };
                        })
                      }
                      keyboardType="decimal-pad"
                      placeholder="+0"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setFoodForm((f) => {
                          const groups = [...f.optionGroups];
                          groups[gi] = {
                            ...groups[gi],
                            options: groups[gi].options.filter(
                              (_, i) => i !== oi,
                            ),
                          };
                          return { ...f, optionGroups: groups };
                        })
                      }
                    >
                      <Text className="text-red-500 text-xs px-1">✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() =>
                    setFoodForm((f) => {
                      const groups = [...f.optionGroups];
                      groups[gi] = {
                        ...groups[gi],
                        options: [
                          ...groups[gi].options,
                          { title: "", price: "0" },
                        ],
                      };
                      return { ...f, optionGroups: groups };
                    })
                  }
                  className="mt-1"
                >
                  <Text className="text-accent text-xs font-bold">
                    + Добавить опцию
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() =>
                setFoodForm((f) => ({
                  ...f,
                  optionGroups: [
                    ...f.optionGroups,
                    {
                      title: "",
                      required: false,
                      multiple: false,
                      minSelect: 0,
                      maxSelect: 1,
                      options: [],
                    },
                  ],
                }))
              }
              className="mb-3.5"
            >
              <Text className="text-accent text-sm font-bold">
                + Добавить группу модификаторов
              </Text>
            </TouchableOpacity>

            {foodModal === "edit" && (
              <View className="flex-row items-center justify-between mb-3.5 py-1">
                <Text className="text-sm font-bold text-text">
                  Доступно в меню
                </Text>
                <Switch
                  value={foodForm.isAvailable}
                  onValueChange={(v) =>
                    setFoodForm((f) => ({ ...f, isAvailable: v }))
                  }
                  trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            )}

            <View className="flex-row gap-2.5 mt-2">
              <TouchableOpacity
                onPress={() => setFoodModal(null)}
                className="flex-1 h-12 rounded-2xl items-center justify-center border border-border bg-soft-surface"
              >
                <Text className="text-text-soft font-bold text-base">
                  Отмена
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveFood}
                disabled={busy}
                className={`flex-1 h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm ${
                  busy ? "opacity-50" : "active:opacity-85"
                }`}
              >
                <Text className="text-text-inverse font-extrabold text-base">
                  {busy ? "..." : "Сохранить"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
