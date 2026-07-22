// dastbadast-multivendor-store/app/(tabs)/profile.tsx
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
import { useRouter } from "expo-router";
import {
  MY_MENU,
  UPDATE_MY_RESTAURANT,
  SET_RESTAURANT_BUSY_MODE,
  MY_BALANCE,
  WALLET_TRANSACTIONS,
} from "../../lib/api/graphql/queries";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { data, loading, refetch } = useQuery<any>(MY_MENU);
  const { data: balanceData } = useQuery<any>(MY_BALANCE);
  const balance = balanceData?.meRestaurant?.balance ?? 0;
  const [updateMyRestaurant] = useMutation(UPDATE_MY_RESTAURANT);
  const [setRestaurantBusyMode] = useMutation(SET_RESTAURANT_BUSY_MODE); // ⭐ ШАГ 5
  const [busy, setBusy] = useState(false);
  const [busyModeSaving, setBusyModeSaving] = useState(false); // ⭐ ШАГ 5

  const r = data?.meRestaurant;
  const [form, setForm] = useState({
    minimumOrder: "0",
    isAvailable: true,
    open: "09:00",
    close: "23:00",
    isAlwaysOpen: false,
  });

  // ⭐ ШАГ 5 (FIX): "Пятничный завал" — раньше единственным способом
  // повлиять на нагрузку было вручную выставлять prepTime на КАЖДЫЙ заказ.
  // Отдельная форма (не часть общего save()) — потому что это состояние,
  // которое включают/выключают за секунды прямо в разгар смены, а не
  // "настройка профиля", которую редактируют не спеша и сохраняют одной
  // кнопкой со всем остальным.
  const [busyForm, setBusyForm] = useState({
    enabled: false,
    extraPrepMinutes: 20,
    preOrdersOnly: false,
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
    if (r.busyMode) {
      setBusyForm({
        enabled: r.busyMode.enabled ?? false,
        extraPrepMinutes: r.busyMode.extraPrepMinutes || 20,
        preOrdersOnly: r.busyMode.preOrdersOnly ?? false,
      });
    }
  }, [r]);

  // ⭐ ШАГ 5: применяется сразу по нажатию тумблера/кнопки — без отдельного
  // "Сохранить", чтобы включить/выключить режим можно было одним касанием
  // прямо во время запары на кухне.
  const applyBusyMode = async (next: typeof busyForm) => {
    setBusyForm(next);
    setBusyModeSaving(true);
    try {
      await setRestaurantBusyMode({
        variables: {
          input: {
            enabled: next.enabled,
            extraPrepMinutes: next.extraPrepMinutes,
            preOrdersOnly: next.preOrdersOnly,
          },
        },
      });
      await refetch();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось изменить режим загрузки");
    } finally {
      setBusyModeSaving(false);
    }
  };

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

        {/* ⭐ ШАГ 5: "Пятничный завал" */}
        <View className="mb-4 py-3 bg-soft-surface-2 rounded-xl px-3.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-bold text-text">
                🔥 Пятничный завал
              </Text>
              <Text className="text-2xs text-text-muted mt-0.5">
                Кухня перегружена — увеличить время готовки для всех новых
                заказов
              </Text>
            </View>
            <Switch
              value={busyForm.enabled}
              onValueChange={(v) => applyBusyMode({ ...busyForm, enabled: v })}
              disabled={busyModeSaving}
              trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {busyForm.enabled && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-2xs text-text-muted font-bold mb-2 uppercase tracking-wider">
                Добавить к времени готовки, мин
              </Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() =>
                    applyBusyMode({
                      ...busyForm,
                      extraPrepMinutes: Math.max(
                        0,
                        busyForm.extraPrepMinutes - 5,
                      ),
                    })
                  }
                  disabled={busyModeSaving}
                  className="w-10 h-10 rounded-xl items-center justify-center bg-soft-surface border border-border"
                >
                  <Text className="text-lg font-extrabold text-text">−</Text>
                </TouchableOpacity>
                <Text className="text-xl font-black text-accent min-w-[48px] text-center">
                  +{busyForm.extraPrepMinutes}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    applyBusyMode({
                      ...busyForm,
                      extraPrepMinutes: Math.min(
                        60,
                        busyForm.extraPrepMinutes + 5,
                      ),
                    })
                  }
                  disabled={busyModeSaving}
                  className="w-10 h-10 rounded-xl items-center justify-center bg-soft-surface border border-border"
                >
                  <Text className="text-lg font-extrabold text-text">+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/wallet" as any)}
                  className="flex-row items-center justify-between mb-4 py-3 px-3.5 bg-accent rounded-xl"
                >
                  <View>
                    <Text className="text-text-inverse text-xs opacity-80">
                      Баланс
                    </Text>
                    <Text className="text-text-inverse text-xl font-extrabold mt-0.5">
                      {balance.toLocaleString("ru")} сом.
                    </Text>
                  </View>
                  <Text className="text-text-inverse text-xs opacity-80">
                    История →
                  </Text>
                </TouchableOpacity>
                {busyModeSaving && (
                  <ActivityIndicator size="small" color="#F26A4A" />
                )}
              </View>

              <View className="flex-row items-center justify-between mt-4">
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-bold text-text">
                    Только предзаказы
                  </Text>
                  <Text className="text-2xs text-text-muted mt-0.5">
                    Временно не принимать заказы "на сейчас"
                  </Text>
                </View>
                <Switch
                  value={busyForm.preOrdersOnly}
                  onValueChange={(v) =>
                    applyBusyMode({ ...busyForm, preOrdersOnly: v })
                  }
                  disabled={busyModeSaving}
                  trackColor={{ true: "#F26A4A", false: "#ECE6DA" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          )}
        </View>

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

        <TouchableOpacity
          onPress={() => router.push("/support" as any)}
          className="h-12 rounded-2xl items-center justify-center bg-soft-surface-2 border border-border mt-3"
        >
          <Text className="text-text font-extrabold text-base">
            💬 Написать в поддержку
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/settings/printer" as any)}
          className="h-12 rounded-2xl items-center justify-center bg-soft-surface-2 border border-border mt-3"
        >
          <Text className="text-text font-extrabold text-base">
            🖨️ Настройки принтера
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
