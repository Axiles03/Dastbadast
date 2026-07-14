// dastbadast-multivendor-rider/app/(app)/profile.tsx
//
// Полноценный экран профиля курьера с:
//  - Большим тогглером "В сети / Оффлайн"
//  - Карточкой со статистикой (сегодня / всего)
//  - Кнопкой "Выйти"
//
// Доступ: только авторизованным курьерам.

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useApolloClient } from "@apollo/client/react";
import { useAuth } from "../../lib/auth-context";
import { MY_HISTORY, TOGGLE, MY_ORDERS } from "../../lib/api/queries";
import { cn } from "../../lib/cn";

/* ============== Helpers ============== */

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ============== Main component ============== */

export default function ProfileScreen() {
  const router = useRouter();
  const client = useApolloClient();
  const { rider, token, logout } = useAuth();

  const [available, setAvailable] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ──────── Загрузка статистики ────────
  const {
    data: historyData,
    loading: histLoading,
    refetch: refetchHist,
  } = useQuery<any>(MY_HISTORY, {
    skip: !token,
    pollInterval: 30_000,
    fetchPolicy: "network-only",
  });

  const { data: activeData } = useQuery<any>(MY_ORDERS, {
    variables: { status: null },
    skip: !token,
    pollInterval: 15_000,
  });

  // ──────── Мутация тоггла ────────
  const [toggleRider, { loading: toggleMutating }] = useMutation(TOGGLE);

  // Синхронизируем локальный стейт с сервером (после рефреша данных)
  useEffect(() => {
    if (activeData?.riderOrders) {
      // Берём статус с любого активного заказа или из локального rider
      // Проще всего — держать state от тоггла, и при ошибке откатывать
    }
  }, [activeData]);

  // ──────── Подсчёт статистики ────────
  const stats = computeStats(historyData?.riderOrders ?? []);

  // ──────── Хендлеры ────────

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (toggling || toggleMutating) return;
      setToggling(true);
      const prev = available;
      setAvailable(value); // optimistic
      try {
        await toggleRider({ variables: { available: value } });
        // При включении "В сети" — подтянуть пул
        if (value) {
          try {
            await client.refetchQueries({
              include: ["AvailableOrders", "MyOrders"],
            });
          } catch {
            /* ignore */
          }
        }
      } catch (e: any) {
        setAvailable(prev); // откат
        Alert.alert("Ошибка", e?.message ?? "Не удалось обновить статус");
      } finally {
        setToggling(false);
      }
    },
    [available, toggling, toggleMutating, toggleRider, client],
  );

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Выйти из аккаунта?",
      "GPS-стрим будет остановлен. Новые заказы не будут приходить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Выйти",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace("/login");
            } catch (e: any) {
              Alert.alert("Ошибка", e?.message ?? "Не удалось выйти");
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  }, [logout, router]);

  // ──────── Render ────────

  if (!rider) {
    return (
      <SafeAreaView className="flex-1 bg-soft-bg items-center justify-center">
        <ActivityIndicator color="#F26A4A" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-bg" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ──── Header с кнопкой назад ──── */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:scale-95 active:opacity-80"
            accessibilityLabel="Назад"
          >
            <Text className="text-lg">‹</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-text">Профиль</Text>
          <View className="w-10" />
        </View>

        {/* ──── Аватар + имя + username ──── */}
        <View className="mx-5 mt-4 bg-soft-surface border border-border rounded-3xl p-5 shadow-soft-sm">
          <View className="flex-row items-center gap-4">
            <View
              className={cn(
                "w-16 h-16 rounded-full items-center justify-center overflow-hidden",
                available ? "bg-success-soft" : "bg-soft-surface-2",
              )}
            >
              {rider.photo ? (
                <Image source={{ uri: rider.photo }} className="w-16 h-16" />
              ) : (
                <Text className="text-3xl">🛵</Text>
              )}
            </View>
            <View className="flex-1 min-w-0">
              <Text
                className="text-xl font-extrabold text-text tracking-tight truncate"
                numberOfLines={1}
              >
                {rider.name || rider.username}
              </Text>
              <Text className="text-sm text-text-soft" numberOfLines={1}>
                @{rider.username}
              </Text>
            </View>
          </View>
        </View>

        {/* ──── ⭐ Главный тогглер «В сети / Оффлайн» ──── */}
        <View className="mx-5 mt-3 bg-soft-surface border-2 border-border rounded-3xl p-5 shadow-soft-sm">
          <View className="flex-row items-center gap-4">
            <View
              className={cn(
                "w-14 h-14 rounded-2xl items-center justify-center shrink-0",
                available ? "bg-success-soft" : "bg-soft-surface-2",
              )}
            >
              <Text className="text-3xl">{available ? "🟢" : "⚪"}</Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-base font-extrabold text-text">
                {available ? "В сети" : "Оффлайн"}
              </Text>
              <Text className="text-xs text-text-soft mt-0.5">
                {available ? "Заказы и пуши приходят" : "Заказы не приходят"}
              </Text>
            </View>
            <Switch
              value={available}
              onValueChange={handleToggle}
              disabled={toggling || toggleMutating}
              trackColor={{ false: "#ECE6DA", true: "#16A34A" }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Переключатель статуса доступности"
            />
          </View>
        </View>

        {/* ──── Карточка статистики ──── */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-3xl p-5 shadow-soft-sm">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-extrabold text-text">
              📊 Статистика
            </Text>
            <Pressable
              onPress={() => refetchHist()}
              className="px-2.5 h-7 rounded-full bg-soft-surface-2 border border-border items-center justify-center active:opacity-70"
              accessibilityLabel="Обновить статистику"
            >
              <Text className="text-2xs font-extrabold text-text-soft">
                🔄 Обновить
              </Text>
            </Pressable>
          </View>

          {histLoading && !historyData ? (
            <ActivityIndicator color="#F26A4A" size="small" />
          ) : (
            <View className="gap-3">
              <StatRow
                label="Сегодня доставлено"
                value={stats.todayCount}
                unit="заказов"
                tint="text-accent"
                bg="bg-accent-soft"
              />
              <StatRow
                label="Заработано сегодня"
                value={stats.todayEarnings}
                unit="сом."
                tint="text-success-dark"
                bg="bg-success-soft"
                isMoney
              />
              <StatRow
                label="Всего доставлено"
                value={stats.totalCount}
                unit="заказов"
                tint="text-text"
                bg="bg-soft-surface-2"
              />
              <StatRow
                label="Всего заработано"
                value={stats.totalEarnings}
                unit="сом."
                tint="text-success-dark"
                bg="bg-success-soft"
                isMoney
              />
            </View>
          )}
        </View>

        {/* ──── Навигация ──── */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-3xl shadow-soft-sm overflow-hidden">
          <NavRow
            icon="✏️"
            iconBg="bg-accent-soft"
            title="Редактировать профиль"
            subtitle="Фото, имя, телефон, email, пароль"
            onPress={() => router.push("/edit-profile")}
          />
          <NavRow
            icon="📦"
            iconBg="bg-info-soft"
            title="История доставок"
            subtitle="Заработано, выполнено, сегодня"
            onPress={() => router.push("/history")}
          />
          <NavRow
            icon="⚙️"
            iconBg="bg-soft-surface-2"
            title="Настройки уведомлений"
            subtitle="Скоро"
            onPress={() => Alert.alert("Скоро", "Раздел в разработке")}
            disabled
          />
          <NavRow
            icon="💬"
            iconBg="bg-purple-soft"
            title="Поддержка"
            subtitle="Написать в чат поддержки"
            onPress={() => router.push("/(app)/support" as any)}
          />
        </View>

        {/* ──── Кнопка выхода ──── */}
        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          className={cn(
            "mx-5 mt-4 bg-red-soft border border-red/30 rounded-2xl p-4",
            "flex-row items-center gap-3",
            loggingOut ? "opacity-50" : "active:bg-red/15",
          )}
          accessibilityLabel="Выйти из аккаунта"
        >
          <View className="w-10 h-10 rounded-full bg-red/10 items-center justify-center shrink-0">
            <Text className="text-xl">⏻</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-red-dark">
              Выйти из аккаунта
            </Text>
            <Text className="text-xs text-red/70 mt-0.5">
              GPS-стрим будет остановлен
            </Text>
          </View>
          {loggingOut ? (
            <ActivityIndicator color="#DC2626" size="small" />
          ) : (
            <Text className="text-red/60 text-lg">›</Text>
          )}
        </Pressable>

        {/* Версия */}
        <Text className="text-2xs text-text-muted text-center mt-6">
          Dastbadast · MVP v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============== Helpers: components ============== */

function StatRow({
  label,
  value,
  unit,
  tint,
  bg,
  isMoney,
}: {
  label: string;
  value: number;
  unit: string;
  tint: string;
  bg: string;
  isMoney?: boolean;
}) {
  return (
    <View className={cn("flex-row items-center gap-3 rounded-2xl p-3", bg)}>
      <View className="flex-1">
        <Text className="text-2xs text-text-soft font-bold uppercase tracking-wider">
          {label}
        </Text>
        <View className="flex-row items-baseline gap-1 mt-0.5">
          <Text className={cn("text-2xl font-black", tint)}>
            {isMoney ? value.toFixed(0) : value}
          </Text>
          <Text className="text-sm text-text-soft font-bold">{unit}</Text>
        </View>
      </View>
    </View>
  );
}

function NavRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center gap-3.5 p-4 border-b border-border last:border-0",
        disabled ? "opacity-50" : "active:bg-soft-surface-2",
      )}
    >
      <View
        className={cn(
          "w-10 h-10 rounded-xl items-center justify-center shrink-0",
          iconBg,
        )}
      >
        <Text className="text-xl">{icon}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-base font-extrabold text-text" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-xs text-text-soft mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text className="text-text-muted text-lg shrink-0">›</Text>
    </Pressable>
  );
}

function computeStats(allOrders: any[]) {
  const today = startOfToday();
  let todayCount = 0;
  let todayEarnings = 0;
  let totalCount = 0;
  let totalEarnings = 0;

  for (const o of allOrders) {
    if (o.orderStatus !== "DELIVERED") continue;
    totalCount++;
    totalEarnings += Number(o.amounts?.deliveryFee ?? 0);

    const deliveredAt = o.statusTimestamps?.deliveredAt;
    const t = deliveredAt
      ? new Date(deliveredAt).getTime()
      : new Date(o.createdAt).getTime();
    if (t >= today) {
      todayCount++;
      todayEarnings += Number(o.amounts?.deliveryFee ?? 0);
    }
  }

  return { todayCount, todayEarnings, totalCount, totalEarnings };
}
