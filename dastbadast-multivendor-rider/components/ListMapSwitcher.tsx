// dastbadast-multivendor-rider/components/ListMapSwitcher.tsx
//
// ⭐ Нижний докнутый бар "Список / Карта" — на всю ширину экрана,
// приклеен к самому низу (не плавающая капсула по центру).
// Похоже на нижний таб-бар UberEats/Wolt courier-приложений.
// Виден всегда — и в режиме списка, и в режиме карты.

import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../lib/cn";

type Props = {
  listMode: boolean;
  onChange: (next: boolean) => void;
};

export function ListMapSwitcher({ listMode, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="absolute left-0 right-0 bottom-0 bg-soft-surface border-t border-border shadow-soft-lg"
    >
      <View className="flex-row px-3 pt-2 pb-1 gap-2">
        <Segment
          active={listMode}
          icon="list-outline"
          label="Список"
          onPress={() => onChange(true)}
        />
        <Segment
          active={!listMode}
          icon="map-outline"
          label="Карта"
          onPress={() => onChange(false)}
        />
      </View>
    </View>
  );
}

function Segment({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-1 flex-row items-center justify-center gap-1.5 h-12 rounded-2xl active:opacity-80",
        active ? "bg-soft-text" : "bg-soft-surface-2",
      )}
    >
      <Ionicons name={icon} size={17} color={active ? "#FFFFFF" : "#6B6358"} />
      <Text
        className={cn(
          "text-sm font-extrabold",
          active ? "text-text-inverse" : "text-text-soft",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
