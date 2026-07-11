import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client/react";
import { MY_MENU, UPDATE_MY_RESTAURANT } from "../../lib/api/graphql/queries";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { data, loading, refetch } = useQuery<any>(MY_MENU);
  const [updateMyRestaurant] = useMutation(UPDATE_MY_RESTAURANT);
  const [busy, setBusy] = useState(false);

  const r = data?.meRestaurant;
  const [form, setForm] = useState({
    minimumOrder: "0",
    isAvailable: true,
    open: "09:00",
    close: "23:00",
    isAlwaysOpen: false,
  });

  useEffect(() => {
    if (!r) return;
    setForm({
      minimumOrder: String(r.minimumOrder ?? 0),
      isAvailable: r.isAvailable ?? true,
      open: r.workingHours?.open ?? "09:00",
      close: r.workingHours?.close ?? "23:00",
      isAlwaysOpen: r.workingHours?.isAlwaysOpen ?? false,
    });
  }, [r]);

  const save = async () => {
    const minimumOrder = parseFloat(form.minimumOrder.replace(",", "."));
    if (!Number.isFinite(minimumOrder) || minimumOrder < 0) {
      Alert.alert("Ошибка", "Некорректный минимальный заказ");
      return;
    }
    setBusy(true);
    try {
      await updateMyRestaurant({
        variables: {
          input: {
            minimumOrder,
            isAvailable: form.isAvailable,
            workingHours: {
              open: form.open,
              close: form.close,
              isAlwaysOpen: form.isAlwaysOpen,
            },
          },
        },
      });
      await refetch();
      Alert.alert("Сохранено", "Профиль ресторана обновлён");
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !r) {
    return (
      <View className="flex-1 items-center justify-center bg-soft-bg">
        <ActivityIndicator size="large" color="#F26A4A" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-2xl font-extrabold text-text mb-4">
          Профиль ресторана
        </Text>

        <View className="flex-row items-center justify-between mb-4 py-2 bg-soft-surface-2 rounded-xl px-3.5">
          <Text className="text-sm font-bold text-text">
            Принимаю заказы сейчас
          </Text>
          <Switch
            value={form.isAvailable}
            onValueChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))}
            trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text className="text-xs text-text-muted mb-4 px-1">
          Выключите, если нужно срочно приостановить приём заказов (закончились
          продукты, аврал на кухне и т.п.) — независимо от часов работы.
        </Text>

        <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
          Минимальный заказ (сом.)
        </Text>
        <TextInput
          className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text mb-4"
          value={form.minimumOrder}
          onChangeText={(t) => setForm((f) => ({ ...f, minimumOrder: t }))}
          keyboardType="decimal-pad"
        />

        <View className="flex-row items-center justify-between mb-3 py-1">
          <Text className="text-sm font-bold text-text">
            Работаю круглосуточно
          </Text>
          <Switch
            value={form.isAlwaysOpen}
            onValueChange={(v) => setForm((f) => ({ ...f, isAlwaysOpen: v }))}
            trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {!form.isAlwaysOpen && (
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
                Открытие
              </Text>
              <TextInput
                className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text"
                value={form.open}
                onChangeText={(t) => setForm((f) => ({ ...f, open: t }))}
                placeholder="09:00"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
                Закрытие
              </Text>
              <TextInput
                className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text"
                value={form.close}
                onChangeText={(t) => setForm((f) => ({ ...f, close: t }))}
                placeholder="23:00"
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={save}
          disabled={busy}
          className={`h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm ${busy ? "opacity-50" : "active:opacity-85"}`}
        >
          <Text className="text-text-inverse font-extrabold text-base">
            {busy ? "..." : "Сохранить"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
