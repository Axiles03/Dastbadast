import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client/react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  GET_ADDRESSES,
  CREATE_ADDRESS,
  SELECT_ADDRESS,
  DELETE_ADDRESS,
  GET_DELIVERY_ZONE,
} from "../../lib/api/queries";
import { EmptyState } from "../../components/EmptyState";
import * as Location from "expo-location";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddressPage() {
  const router = useRouter();

  // ⭐ useQuery<any>
  const { data, loading, refetch } = useQuery<any>(GET_ADDRESSES);
  const { data: zoneData } = useQuery<any>(GET_DELIVERY_ZONE);
  const [createAddress] = useMutation(CREATE_ADDRESS);
  const [selectAddress] = useMutation(SELECT_ADDRESS);
  const [deleteAddress] = useMutation(DELETE_ADDRESS);

  const [form, setForm] = useState({
    label: "Дом",
    address: "",
    city: "Душанбе",
  });
  const [busy, setBusy] = useState(false);

  const addresses = data?.addresses ?? [];
  const zone = zoneData?.deliveryZone?.polygon;

  const addCurrentLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Нужен доступ к геолокации");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await createAddress({
        variables: {
          input: {
            label: form.label,
            address: `Точка (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            city: form.city,
            location: { type: "Point", coordinates: [lng, lat] },
          },
        },
      });
      refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!form.address.trim()) {
      Alert.alert("Введите адрес");
      return;
    }
    setBusy(true);
    try {
      await createAddress({
        variables: {
          input: {
            label: form.label,
            address: form.address.trim(),
            city: form.city,
            location: { type: "Point", coordinates: [68.783, 38.574] },
          },
        },
      });
      setForm({ ...form, address: "" });
      refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <View className="flex-row items-center px-5 pt-4 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:opacity-80 mr-3"
        >
          <Ionicons name="chevron-back" size={20} color="#1F1B16" />
        </Pressable>
        <Text className="text-lg font-extrabold text-text flex-1">
          Мои адреса
        </Text>
      </View>

      <View className="px-5 mb-3">
        <Text className="text-2xl font-extrabold text-text">Адреса</Text>
        <Text className="text-sm text-text-muted mt-1">
          Управление адресами доставки
        </Text>
      </View>

      {/* Add form */}
      <View className="mx-5 mb-3 bg-soft-surface border border-border rounded-2xl p-4 shadow-soft-sm">
        <View className="flex-row gap-2 mb-2.5">
          {["Дом", "Работа"].map((l) => (
            <Pressable
              key={l}
              onPress={() => setForm({ ...form, label: l })}
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center border ${
                form.label === l
                  ? "bg-accent border-accent"
                  : "bg-soft-surface-2 border-border"
              }`}
            >
              <Ionicons
                name={l === "Дом" ? "home-outline" : "briefcase-outline"}
                size={16}
                color={form.label === l ? "white" : "#6B6358"}
              />
              <Text
                className={`text-sm font-bold ml-1.5 ${
                  form.label === l ? "text-text-inverse" : "text-text-soft"
                }`}
              >
                {l}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base mb-2.5"
          placeholder="Город"
          placeholderTextColor="#9A9388"
          value={form.city}
          onChangeText={(t) => setForm({ ...form, city: t })}
        />
        <TextInput
          className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base mb-2.5"
          placeholder="Адрес (ул. Рудаки, 14)"
          placeholderTextColor="#9A9388"
          value={form.address}
          onChangeText={(t) => setForm({ ...form, address: t })}
        />
        <View className="flex-row gap-2">
          <Pressable
            onPress={addCurrentLocation}
            disabled={busy}
            className="flex-1 h-12 bg-soft-surface-2 border border-border rounded-2xl flex-row items-center justify-center active:opacity-80"
          >
            <Ionicons name="navigate-outline" size={16} color="#6B6358" />
            <Text className="text-text-soft font-bold text-sm ml-1.5">GPS</Text>
          </Pressable>
          <Pressable
            onPress={addManual}
            disabled={busy}
            className="flex-1 h-12 bg-accent rounded-2xl items-center justify-center active:opacity-90"
          >
            <Text className="text-text-inverse font-extrabold text-sm">
              Добавить
            </Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#F26A4A" className="mt-6" />
      ) : addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="Адресов пока нет"
          subtitle="Добавьте первый, чтобы оформлять заказы"
        />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          renderItem={({ item }: any) => (
            <View
              key={item.id}
              className="bg-soft-surface border border-border rounded-2xl p-3.5 flex-row items-center mb-2.5 shadow-soft-sm"
            >
              <View
                className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                  item.isSelected ? "bg-accent-soft" : "bg-soft-surface-2"
                }`}
              >
                <Ionicons
                  name={
                    item.label?.toLowerCase().includes("дом")
                      ? "home-outline"
                      : "briefcase-outline"
                  }
                  size={20}
                  color={item.isSelected ? "#F26A4A" : "#6B6358"}
                />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center">
                  <Text
                    className="text-sm font-extrabold text-text"
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.isSelected && (
                    <View className="ml-1.5 bg-success-soft border border-success/30 px-2 py-0.5 rounded-full">
                      <Text className="text-2xs font-extrabold text-success">
                        Выбран
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  className="text-xs text-text-soft mt-0.5"
                  numberOfLines={1}
                >
                  {item.city}, {item.address}
                </Text>
              </View>
              <View className="flex-row gap-1">
                {!item.isSelected && (
                  <Pressable
                    onPress={() =>
                      selectAddress({ variables: { id: item.id } })
                    }
                    className="px-2.5 py-1.5 bg-accent-soft border border-accent/20 rounded-xl"
                  >
                    <Text className="text-2xs font-extrabold text-accent-dark">
                      Выбрать
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() =>
                    Alert.alert("Удалить адрес?", item.address, [
                      { text: "Отмена", style: "cancel" },
                      {
                        text: "Удалить",
                        style: "destructive",
                        onPress: () =>
                          deleteAddress({
                            variables: { id: item.id },
                          }).then(() => refetch()),
                      },
                    ])
                  }
                  className="w-8 h-8 items-center justify-center active:bg-red-soft rounded-xl"
                >
                  <Ionicons name="trash-outline" size={16} color="#9A9388" />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
