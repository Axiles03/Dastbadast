import { View, Text, Pressable } from "react-native";

type Props = {
  emoji: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View className="items-center px-7 py-16">
      <Text className="text-6xl mb-2">{emoji}</Text>
      <Text className="text-lg font-extrabold text-text">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-text-muted mt-1.5 text-center leading-5">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="mt-5 bg-accent h-12 px-6 rounded-2xl items-center justify-center active:opacity-90"
        >
          <Text className="text-text-inverse font-extrabold text-sm">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
