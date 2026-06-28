import { View, Text } from "react-native";
import { cn } from "../lib/cn";

const PALETTE: Record<
  string,
  { bg: string; text: string; border: string; emoji: string; label: string }
> = {
  PENDING: {
    bg: "bg-warning-soft",
    text: "text-warning-dark",
    border: "border-warning",
    emoji: "⏱",
    label: "Новый",
  },
  ACCEPTED: {
    bg: "bg-purple/15",
    text: "text-purple-dark",
    border: "border-purple/30",
    emoji: "👨‍🍳",
    label: "Готовится",
  },
  ASSIGNED: {
    bg: "bg-accent-soft",
    text: "text-accent-dark",
    border: "border-accent/40",
    emoji: "🛵",
    label: "Курьер едет",
  },
  PICKED: {
    bg: "bg-info-soft",
    text: "text-info-dark",
    border: "border-info/30",
    emoji: "🚴",
    label: "В пути",
  },
  DELIVERED: {
    bg: "bg-success-soft",
    text: "text-success-dark",
    border: "border-success/40",
    emoji: "✅",
    label: "Доставлен",
  },
  CANCELLED: {
    bg: "bg-red-soft",
    text: "text-red-dark",
    border: "border-red/30",
    emoji: "✕",
    label: "Отменён",
  },
  AWAITING_CONFIRMATION: {
    bg: "bg-warning-soft",
    text: "text-warning-dark",
    border: "border-warning",
    emoji: "📦",
    label: "Ждём подтверждения",
  },
};

const FALLBACK = {
  bg: "bg-soft-surface-2",
  text: "text-text-soft",
  border: "border-border",
  emoji: "",
  label: "",
};

export function StatusPill({ status }: { status: string }) {
  const p = PALETTE[status] ?? { ...FALLBACK, label: status };
  return (
    <View
      className={cn(
        "flex-row items-center self-start rounded-full border px-2.5 py-1",
        p.bg,
        p.border
      )}
    >
      <Text className={cn("text-2xs font-extrabold tracking-wide", p.text)}>
        {p.emoji ? `${p.emoji} ` : ""}
        {p.label}
      </Text>
    </View>
  );
}
