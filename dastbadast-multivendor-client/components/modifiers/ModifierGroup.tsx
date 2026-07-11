// dastbadast-multivendor-client/components/modifiers/ModifierGroup.tsx
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/cn";

type FoodOption = {
  id: string;
  title: string;
  price: number;
  isAvailable: boolean;
};

export type ModifierGroupProps = {
  key?: React.Key;
  group: {
    id: string;
    title: string;
    required: boolean;
    multiple: boolean;
    minSelect: number;
    maxSelect: number;
    sortOrder?: number;
    options: FoodOption[];
  };
  selectedIds: Set<string>;
  onToggle: (optionId: string) => void;
  currencySymbol?: string;
};

export function ModifierGroup({
  group,
  selectedIds,
  onToggle,
  currencySymbol = "сом.",
}: ModifierGroupProps) {
  return (
    <View className="bg-soft-surface border border-border rounded-2xl p-4">
      {/* Заголовок */}
      <View className="flex-row items-baseline justify-between mb-3">
        <Text className="text-base font-extrabold text-text">
          {group.title}
          {group.required && (
            <Text className="text-accent text-xs font-bold ml-1.5">
              · обязательно
            </Text>
          )}
          {group.multiple && (
            <Text className="text-text-muted text-xs font-normal ml-1">
              · до {group.maxSelect}
            </Text>
          )}
        </Text>
      </View>

      {/* Список опций */}
      <View className="space-y-2">
        {group.options.map((opt) => {
          const isSelected = selectedIds.has(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => opt.isAvailable && onToggle(opt.id)}
              disabled={!opt.isAvailable}
              className={cn(
                "flex-row items-center gap-3 p-3 rounded-xl border-2",
                isSelected
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-soft-surface",
                !opt.isAvailable && "opacity-50",
              )}
            >
              {/* Checkbox / radio indicator */}
              <View
                className={cn(
                  "w-5 h-5 items-center justify-center border-2",
                  group.multiple ? "rounded-md" : "rounded-full",
                  isSelected ? "bg-accent border-accent" : "border-border",
                )}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={12} color="white" />
                )}
              </View>

              <Text
                className={cn(
                  "flex-1 text-sm font-bold",
                  isSelected ? "text-accent-dark" : "text-text",
                )}
              >
                {opt.title}
              </Text>

              <Text
                className={cn(
                  "text-sm font-extrabold",
                  opt.price === 0 ? "text-text-muted" : "text-accent",
                )}
              >
                {opt.price === 0
                  ? "Бесплатно"
                  : `+${opt.price} ${currencySymbol}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
