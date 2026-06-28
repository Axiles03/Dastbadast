import { View, Text } from "react-native";

type Props = {
  emoji: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
};

export function EmptyState({ emoji, title, subtitle, compact = false }: Props) {
  return (
    <View className={compact ? "items-center px-7 py-8" : "items-center px-7 py-16"}>
      <Text className={compact ? "text-4xl mb-2" : "text-6xl mb-2"}>{emoji}</Text>
      <Text className="text-lg font-extrabold text-text">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-text-muted mt-1.5 text-center leading-5">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
