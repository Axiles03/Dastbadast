// dastbadast-multivendor-rider/components/RiderTopBar.tsx
//
// ⭐ НОВОЕ: главная шапка экрана "Заказы".
// Заменяет старый ScreenHeader на этом экране: слева — аватар курьера с
// индикатором "в сети / оффлайн", имя; справа — тумблер доступности и
// кнопка настроек. Переключатель Список/Карта отсюда убран — он теперь
// внизу экрана (см. ListMapSwitcher.tsx).

import { View, Text, Pressable, Switch, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../lib/cn";

type Props = {
  name: string;
  photo?: string | null;
  online: boolean;
  onToggleOnline: (v: boolean) => void | Promise<void>;
  togglingOnline?: boolean;
  onOpenSettings: () => void;
};

export function RiderTopBar({
  name,
  photo,
  online,
  onToggleOnline,
  togglingOnline,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="bg-soft-surface border-b border-border"
    >
      <View className="px-4 pb-3 flex-row items-center gap-3">
        {/* Аватар + статус-точка */}
        <View className="relative">
          <View className="w-11 h-11 rounded-full bg-accent-soft border border-accent/20 items-center justify-center overflow-hidden">
            {photo ? (
              <Image source={{ uri: photo }} className="w-11 h-11" />
            ) : (
              <Text className="text-xl">🛵</Text>
            )}
          </View>
          <View
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-soft-surface",
              online ? "bg-success" : "bg-text-muted",
            )}
          />
        </View>

        {/* Имя + статус */}
        <View className="flex-1 min-w-0">
          <Text
            className="text-base font-extrabold text-text tracking-tight"
            numberOfLines={1}
          >
            {name || "Курьер"}
          </Text>
          <Text
            className={cn(
              "text-xs font-bold mt-0.5",
              online ? "text-success-dark" : "text-text-muted",
            )}
          >
            {online ? "🟢 В сети" : "⚪ Оффлайн"}
          </Text>
        </View>

        {/* Тумблер доступности */}
        <Switch
          value={online}
          onValueChange={onToggleOnline}
          disabled={togglingOnline}
          trackColor={{ false: "#ECE6DA", true: "#16A34A" }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Переключатель статуса доступности"
        />

        {/* Настройки */}
        <Pressable
          onPress={onOpenSettings}
          className="w-9 h-9 rounded-full bg-soft-surface-2 border border-border items-center justify-center active:scale-95"
          accessibilityLabel="Настройки профиля"
        >
          <Ionicons name="settings-outline" size={18} color="#1F1B16" />
        </Pressable>
      </View>
    </View>
  );
}
