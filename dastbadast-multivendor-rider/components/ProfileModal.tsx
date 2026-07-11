// dastbadast-multivendor-rider/components/ProfileModal.tsx
import { Modal, Pressable, Switch, Text, View } from "react-native";
import { cn } from "../lib/cn";

type Props = {
  visible: boolean;
  onClose: () => void;
  available: boolean;
  onToggleAvailable: (v: boolean) => void | Promise<void>;
  riderName: string;
  username: string;
  onLogout: () => void | Promise<void>;
  onHistory: () => void;
};

export function ProfileModal({
  visible,
  onClose,
  available,
  onToggleAvailable,
  riderName,
  username,
  onLogout,
  onHistory,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Затемнение */}
      <Pressable
        className="flex-1 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Закрыть"
      />

      {/* Bottom-sheet */}
      <View className="bg-soft-surface rounded-t-3xl px-5 pt-3 pb-8">
        {/* Drag-handle */}
        <View className="items-center mb-3">
          <View className="w-12 h-1 bg-border rounded-full" />
        </View>

        {/* Аватар + Имя */}
        <View className="flex-row items-center gap-3.5 mb-5">
          <View className="w-14 h-14 rounded-full bg-accent-soft border border-accent/20 items-center justify-center">
            <Text className="text-2xl">🛵</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text
              className="text-lg font-extrabold text-text truncate"
              numberOfLines={1}
            >
              {riderName || "Курьер"}
            </Text>
            <Text className="text-xs text-text-soft" numberOfLines={1}>
              @{username}
            </Text>
          </View>
        </View>

        {/* ⭐ Тумблер «В сети / Оффлайн» — большой, удобный для мобильного */}
        <View className="bg-soft-surface-2 border border-border rounded-2xl p-4 mb-2 flex-row items-center gap-3">
          <View
            className={cn(
              "w-10 h-10 rounded-full items-center justify-center",
              available ? "bg-success-soft" : "bg-soft-bg",
            )}
          >
            <Text className="text-xl">{available ? "🟢" : "⚪"}</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-extrabold text-text">
              {available ? "В сети" : "Оффлайн"}
            </Text>
            <Text className="text-xs text-text-soft mt-0.5">
              {available
                ? "Заказы и пуши приходят"
                : "Заказы не приходят — переключите, чтобы получать новые"}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={onToggleAvailable}
            trackColor={{ false: "#ECE6DA", true: "#16A34A" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Ссылка на историю */}
        <Pressable
          onPress={onHistory}
          className="bg-soft-surface-2 border border-border rounded-2xl p-4 mb-2 flex-row items-center gap-3 active:bg-soft-bg"
        >
          <View className="w-10 h-10 rounded-full bg-info-soft items-center justify-center">
            <Text className="text-xl">📦</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-extrabold text-text">
              История доставок
            </Text>
            <Text className="text-xs text-text-soft mt-0.5">
              Заработано, выполнено, сегодня
            </Text>
          </View>
          <Text className="text-text-muted text-lg">›</Text>
        </Pressable>

        {/* Кнопка выйти */}
        <Pressable
          onPress={onLogout}
          className="bg-red-soft border border-red/20 rounded-2xl p-4 flex-row items-center gap-3 active:bg-red/20 mt-3"
        >
          <View className="w-10 h-10 rounded-full bg-red/10 items-center justify-center">
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
        </Pressable>

        <Text className="text-2xs text-text-muted text-center mt-4">
          Dastbadast · MVP v1.0
        </Text>
      </View>
    </Modal>
  );
}
