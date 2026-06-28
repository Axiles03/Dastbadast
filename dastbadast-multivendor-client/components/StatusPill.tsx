import { View, Text } from "react-native";

const PALETTE: Record<
  string,
  { bg: string; text: string; emoji: string; label: string }
> = {
  PENDING: {
    bg: "bg-warning-soft",
    text: "text-warning-dark",
    emoji: "⏱",
    label: "Новый",
  },
  ACCEPTED: {
    bg: "bg-purple-soft",
    text: "text-purple-dark",
    emoji: "👨‍🍳",
    label: "Готовится",
  },
  ASSIGNED: {
    bg: "bg-accent-soft",
    text: "text-accent-dark",
    emoji: "🛵",
    label: "Курьер едет",
  },
  PICKED: {
    bg: "bg-info-soft",
    text: "text-info-dark",
    emoji: "🚴",
    label: "В пути",
  },
  AWAITING_CONFIRMATION: {
    bg: "bg-warning-soft",
    text: "text-warning-dark",
    emoji: "📦",
    label: "Ждём подтверждения",
  },
  DELIVERED: {
    bg: "bg-success-soft",
    text: "text-success-dark",
    emoji: "✅",
    label: "Доставлен",
  },
  CANCELLED: {
    bg: "bg-red-soft",
    text: "text-red-dark",
    emoji: "✕",
    label: "Отменён",
  },
};

export function StatusPill({ status }: { status: string }) {
  const p = PALETTE[status] ?? {
    bg: "bg-soft-surface-2",
    text: "text-text-soft",
    emoji: "",
    label: status,
  };
  return (
    <View
      className={`self-start rounded-full px-2.5 py-1 flex-row items-center ${p.bg}`}
    >
      <Text className={`text-2xs font-extrabold tracking-wide ${p.text}`}>
        {p.emoji ? `${p.emoji} ` : ""}
        {p.label}
      </Text>
    </View>
  );
}
