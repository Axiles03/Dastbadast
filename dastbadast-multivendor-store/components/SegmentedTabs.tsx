// dastbadast-multivendor-store/components/SegmentedTabs.tsx
import { Text, TouchableOpacity, View } from "react-native";
// ⭐ ИМПОРТ ТОЛЬКО ИЗ react-native — никаких @react-navigation/* проксирований

import { cn } from "../lib/cn";

type Tab<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon?: string;
};

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (v: T) => void;
};

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: Props<T>) {
  return (
    <View className="flex-row bg-soft-surface-2 border border-border rounded-2xl p-1 mx-4 mt-3">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <TouchableOpacity
            key={t.value}
            onPress={() => onChange(t.value)}
            activeOpacity={0.75}
            // 1. Убираем "bg-soft-surface shadow-soft-sm" из утилит Tailwind
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl"
            // 2. Безопасно передаем цвет фона и тень через стандартный инлайн-стиль React Native
            style={
              active
                ? {
                    backgroundColor: "#FFFFFF", // Укажите точный HEX-код вашего цвета bg-soft-surface
                    // Стандартные нативные свойства теней, которые НЕ вызывают сбой навигации:
                    shadowColor: "#000000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2, // Для Android
                  }
                : null
            }
          >
            {t.icon ? (
              <Text
                className={cn(
                  "text-sm mr-1.5",
                  active ? "text-accent" : "text-text-muted",
                )}
              >
                {t.icon}
              </Text>
            ) : null}
            <Text
              className={cn(
                "text-sm font-extrabold",
                active ? "text-accent" : "text-text-soft",
              )}
            >
              {t.label}
            </Text>
            {typeof t.count === "number" && (
              <View
                className={cn(
                  "ml-1.5 rounded-full px-1.5 min-w-[20px] items-center justify-center",
                  active ? "bg-accent" : "bg-soft-bg",
                )}
              >
                <Text
                  className={cn(
                    "text-2xs font-extrabold",
                    active ? "text-text-inverse" : "text-text-muted",
                  )}
                >
                  {t.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
