// dastbadast-multivendor-rider/components/OrderCard.tsx
//
// Универсальная карточка заказа для Rider App.
// Используется и в "Доступные" (pool), и в "Мои заказы".
//
// Стилистика полностью совпадает с dark-soft палитрой (см. tailwind.config.js).
//
// ⭐ Это "чистый" компонент без Apollo и subscriptions — чтобы легко тестировать
// и переиспользовать в Шаге 3 (для BottomSheet при клике на маркер).

import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../lib/cn";
import { usePrepRemainingMs, formatPrepRemaining } from "../lib/prep-timer";

/* ============== Локальный pluralize (без зависимости от lib/format) ============== */

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/* ============== Типы ============== */

export type OrderAddress = {
  label?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  details?: string | null;
  location?: { coordinates?: number[] } | null | undefined;
};

export type OrderItem = {
  foodId: string;
  title: string;
  quantity: number;
  price?: number;
};

export type OrderAmounts = {
  subtotal?: number;
  tax?: number;
  deliveryFee?: number;
  total: number;
};

export type OrderStatusTimestamps = {
  pendingAt?: string | null;
  acceptedAt?: string | null;
  prepTime?: number | null;
  courierSearchTimestamps?: {
    initialPushedAt?: string | null;
    escalationPushedAt?: string | null;
  };
};

export type Order = {
  id: string;
  orderId: string;
  orderStatus: string;
  createdAt: string;
  note?: string | null;
  pickupAddress?: OrderAddress | null;
  deliveryAddress?: OrderAddress | null;
  items: OrderItem[];
  amounts: OrderAmounts;
  statusTimestamps?: OrderStatusTimestamps | null;
  riderId?: string | null;
};

export type Urgency = "normal" | "warning" | "urgent" | null;

/* ============== Утилиты ============== */

const STATUS_LABEL: Record<string, { label: string; emoji: string }> = {
  PENDING: { label: "Ждёт курьера", emoji: "🛵" },
  ACCEPTED: { label: "Ждёт курьера", emoji: "🛵" },
  PREPARING: { label: "Готовится", emoji: "👨‍🍳" },
  READY_FOR_PICKUP: { label: "Готово, заберите", emoji: "✅" },
  ASSIGNED: { label: "Курьер едет в ресторан", emoji: "🏪" },
  PICKED: { label: "Доставляется", emoji: "🛵" },
  AWAITING_CONFIRMATION: { label: "Ждём подтверждения", emoji: "⏳" },
};

function PrepTimerInfo({ order }: { order: Order }) {
  const relevant = ["ACCEPTED", "PREPARING", "ASSIGNED"].includes(
    order.orderStatus,
  );
  const acceptedAt = relevant
    ? (order.statusTimestamps?.acceptedAt ?? null)
    : null;
  const prepTime = relevant ? (order.statusTimestamps?.prepTime ?? null) : null;
  const { remainingMs, isLate } = usePrepRemainingMs(acceptedAt, prepTime);

  if (order.orderStatus === "READY_FOR_PICKUP") {
    return (
      <View className="mt-2.5 bg-success-soft border border-success/30 rounded-xl px-3 py-2 flex-row items-center gap-2">
        <Text className="text-base">✅</Text>
        <Text className="text-sm font-extrabold text-success-dark">
          Готово — заберите в ресторане
        </Text>
      </View>
    );
  }

  if (!relevant || !acceptedAt || !prepTime) return null;

  return (
    <View
      className={cn(
        "mt-2.5 border rounded-xl px-3 py-2 flex-row items-center gap-2",
        isLate
          ? "bg-warning-soft border-warning/30"
          : "bg-info-soft border-info/30",
      )}
    >
      <Text className="text-base">👨‍🍳</Text>
      <View className="flex-1">
        <Text
          className={cn(
            "text-2xs font-bold uppercase tracking-wider",
            isLate ? "text-warning-dark" : "text-info-dark",
          )}
        >
          {isLate ? "Готовка задерживается" : "Готовка ресторана"}
        </Text>
        <Text
          className={cn(
            "text-sm font-extrabold",
            isLate ? "text-warning-dark" : "text-info-dark",
          )}
        >
          {isLate
            ? "Уже должно быть готово"
            : `${formatPrepRemaining(remainingMs)} до готовности`}
        </Text>
      </View>
    </View>
  );
}

/**
 * Подсчёт urgency по давности pendingAt + escalation-флагу.
 * Чистая функция (вынесена в helpers, чтобы переиспользовать
 * на карте в Шаге 3).
 */
export function getUrgency(
  order: Pick<Order, "orderStatus" | "statusTimestamps">,
  now: number,
): Urgency {
  if (!order || !order.statusTimestamps) return null;
  if (order.orderStatus !== "PENDING" && order.orderStatus !== "ACCEPTED")
    return null;
  const pendingAt = order.statusTimestamps?.pendingAt;
  if (!pendingAt) return null;
  const ageMs = now - new Date(pendingAt).getTime();
  const escalated =
    !!order.statusTimestamps?.courierSearchTimestamps?.escalationPushedAt;
  if (ageMs > 90 * 1000 || escalated) return "urgent";
  if (ageMs > 45 * 1000) return "warning";
  return "normal";
}

/* ============== Подкомпоненты ============== */

function AddressBlock({
  label,
  name,
  city,
  address,
}: {
  label: string;
  name?: string | null;
  city?: string | null;
  address?: string | null;
}) {
  const line = [city, address].filter(Boolean).join(", ");
  return (
    <View className="mt-2.5">
      <Text className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
        {label}
      </Text>
      {name ? (
        <Text className="text-sm font-bold text-text mt-0.5" numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      <Text className="text-sm text-text-soft mt-0.5" numberOfLines={2}>
        {line || "—"}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CANCELLED") return null;
  const info = STATUS_LABEL[status] ?? {
    label: status,
    emoji: "📦",
  };
  const isDelivering = status === "PICKED";
  const isAwaiting = status === "AWAITING_CONFIRMATION";
  return (
    <View
      className={cn(
        "rounded-full px-2.5 py-1 border",
        isDelivering
          ? "bg-info-soft border-info/30"
          : isAwaiting
            ? "bg-warning-soft border-warning/30"
            : "bg-soft-surface-2 border-border",
      )}
    >
      <Text
        className={cn(
          "text-xs font-bold",
          isDelivering
            ? "text-info-dark"
            : isAwaiting
              ? "text-warning-dark"
              : "text-text-soft",
        )}
      >
        {info.emoji} {info.label}
      </Text>
    </View>
  );
}

/* ============== Главный компонент ============== */

type OrderCardProps = {
  order: Order;
  mode: "pool" | "mine";
  /** Подсвечивать "срочно" (используется в pool, в mine — null) */
  urgency: Urgency;
  /** Кнопка снизу */
  primaryAction?: {
    label: string;
    loading?: boolean;
    disabled?: boolean;
    /** Доп. текст (например "~ 5 мин") */
    hint?: string;
    onPress: () => void;
    etaMin?: number | null;
    // target — pickup или delivery (для подписи)
    etaTarget?: "pickup" | "delivery";
  } | null;
  /** Доп. кнопка рядом (например "Чат") */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  } | null;
  /** ⭐ Колбэк клика по самой карточке (для будущего Шага 3) */
  onPress?: () => void;
  // ETA в минутах до цели (для курьера)
  etaMin?: number | null;
  // target — pickup или delivery (для подписи)
  etaTarget?: "pickup" | "delivery";
};

export function OrderCard({
  order,
  mode,
  urgency,
  primaryAction,
  secondaryAction,
  onPress,
  etaMin,
  etaTarget,
}: OrderCardProps) {
  const itemsCount = order.items?.length || 0;
  const showUrgent = mode === "pool" && urgency === "urgent";
  const showWarning = mode === "pool" && urgency === "warning";

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "bg-soft-surface border rounded-2xl p-4 mb-3 shadow-soft-sm",
        // Цвет рамки/фона в зависимости от срочности (только в pool)
        showUrgent
          ? "bg-red-soft border-red border-2"
          : showWarning
            ? "bg-warning-soft/30 border-warning border-2"
            : "border-border",
      )}
    >
      {/* ─── Header: номер + статус + (если pool) бейдж urgency ─── */}
      <View className="flex-row justify-between items-center border-b border-border pb-2">
        <Text className="text-base font-extrabold text-text">
          📦 #{String(order.orderId).substring(0, 8)}
        </Text>
        <View className="flex-row gap-1">
          {showUrgent && (
            <View className="bg-red rounded-full px-2 py-0.5">
              <Text className="text-text-inverse text-2xs font-extrabold">
                ⚡ Срочно
              </Text>
            </View>
          )}
          {showWarning && !showUrgent && (
            <View className="bg-warning-soft rounded-full px-2 py-0.5">
              <Text className="text-warning-dark text-2xs font-extrabold">
                ⏳ Ждёт
              </Text>
            </View>
          )}
          <StatusBadge status={order.orderStatus} />
        </View>
      </View>

      {/* ─── Адреса ─── */}
      <AddressBlock
        label="Откуда"
        name={order.pickupAddress?.name}
        address={order.pickupAddress?.address}
      />
      <AddressBlock
        label="Куда"
        city={order.deliveryAddress?.city}
        address={order.deliveryAddress?.address}
      />

      {/* ─── Note (комментарий клиента) ─── */}
      {order.note ? (
        <View className="bg-soft-surface-2 p-2.5 rounded-xl mt-3 border border-border/40">
          <Text className="text-xs italic text-text-soft">💬 {order.note}</Text>
        </View>
      ) : null}

      {/* ─── Состав заказа (блюда) ─── */}
      <View className="mt-3 pt-2 border-t border-border/30 space-y-0.5">
        {order.items.map((i) => (
          <Text key={i.foodId} className="text-xs text-text-soft font-medium">
            • {i.title}{" "}
            <Text className="text-text font-bold">×{i.quantity}</Text>
          </Text>
        ))}
        <Text className="text-2xs text-text-muted mt-1 font-medium">
          {pluralize(itemsCount, "блюдо", "блюда", "блюд")}
        </Text>
      </View>

      {/* сколько ресторану осталось готовить / уже готово */}
      <PrepTimerInfo order={order} />

      {/*  ETA-инфо для курьера — до pickup или до delivery */}
      {etaMin != null && etaTarget && (
        <View className="mt-2.5 bg-info-soft border border-info/30 rounded-xl px-3 py-2 flex-row items-center gap-2">
          <Text className="text-base">⏱</Text>
          <View className="flex-1">
            <Text className="text-2xs font-bold text-info-dark uppercase tracking-wider">
              {etaTarget === "pickup" ? "До ресторана" : "До клиента"}
            </Text>
            <Text className="text-sm font-extrabold text-info-dark">
              ~{etaMin} мин
            </Text>
          </View>
        </View>
      )}

      {/* ─── Footer: стоимость + кнопки ─── */}
      <View className="mt-3 pt-3 border-t border-border flex-row items-center justify-between gap-2 flex-wrap">
        <View>
          <Text className="text-2xs font-bold text-text-muted uppercase tracking-wider">
            Ваш доход
          </Text>
          <Text className="text-lg font-black text-success">
            {order.amounts?.deliveryFee ?? 0} сом.
          </Text>
        </View>
        <View className="flex-row gap-2 flex-wrap">
          {secondaryAction && (
            <Pressable
              onPress={secondaryAction.onPress}
              className="bg-soft-surface-2 border border-text-muted/30 px-3.5 h-11 rounded-xl items-center justify-center active:scale-[0.98]"
            >
              <Text className="text-text font-bold text-xs">
                {secondaryAction.label}
              </Text>
            </Pressable>
          )}
          {primaryAction && (
            <Pressable
              disabled={primaryAction.disabled || primaryAction.loading}
              onPress={primaryAction.onPress}
              className={cn(
                "px-4 h-11 rounded-xl items-center justify-center min-w-[140px] active:scale-[0.98]",
                primaryAction.disabled
                  ? "bg-border opacity-40"
                  : showUrgent
                    ? "bg-red shadow-soft-sm"
                    : "bg-accent shadow-soft-sm",
              )}
            >
              <Text className="text-text-inverse font-bold text-xs">
                {primaryAction.loading
                  ? "..."
                  : primaryAction.hint
                    ? `${primaryAction.label} · ${primaryAction.hint}`
                    : primaryAction.label}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
