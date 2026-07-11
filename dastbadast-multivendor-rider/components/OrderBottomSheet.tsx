// dastbadast-multivendor-rider/components/OrderBottomSheet.tsx
//
// ⭐ ШАГ 3: упрощённая заглушка BottomSheet для карты.
// Полноценный дизайн (Яндекс.Доставка стиль) появится в Шаге 4.
// Сейчас задача — просто чтобы MapPlaceholder.tsx скомпилировался.

import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "../lib/cn";
import { type Order, getUrgency } from "./OrderCard";

type ActionButtonProps = {
  label: string;
  variant: "primary" | "danger" | "info" | "success";
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function ActionButton({
  label,
  variant,
  loading,
  disabled,
  onPress,
}: ActionButtonProps) {
  const cls =
    variant === "success"
      ? "bg-success"
      : variant === "danger"
        ? "bg-red"
        : variant === "info"
          ? "bg-info"
          : "bg-accent";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        "h-14 rounded-2xl items-center justify-center flex-row shadow-soft-sm",
        cls,
        disabled ? "opacity-50" : "active:scale-[0.99]",
      )}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-text-inverse font-extrabold text-base">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type Props = {
  selectedId: string | null;
  orders: Order[];
  online: boolean;
  onClose: () => void;
  onClaim: (orderId: string) => void | Promise<void>;
  onPickUp: (orderId: string) => void | Promise<void>;
  onDeliver: (orderId: string) => void | Promise<void>;
  onOpenChat: (orderId: string) => void;
  loading?: {
    claim?: boolean;
    pickUp?: boolean;
    deliver?: boolean;
  };
};

export function OrderBottomSheet({
  selectedId,
  orders,
  online,
  onClose,
  onClaim,
  onPickUp,
  onDeliver,
  onOpenChat,
  loading,
}: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [selectedId]);

  const order = useMemo<Order | null>(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  // Если выбранный заказ пропал — закрываем
  useEffect(() => {
    if (selectedId && !order) onClose();
  }, [selectedId, order, onClose]);

  if (!order) return null;

  const urgency = getUrgency(order, now);
  const isAwaiting = order.orderStatus === "AWAITING_CONFIRMATION";
  const isAssigned = order.orderStatus === "ASSIGNED";
  const isDelivering = order.orderStatus === "PICKED";
  const isClaimable = ["PENDING", "ACCEPTED"].includes(order.orderStatus);

  return (
    <Modal
      visible={!!order}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/30">
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityLabel="Закрыть"
        />

        <View
          className="bg-soft-surface rounded-t-3xl max-h-[88%]"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {/* Drag-handle */}
          <View className="items-center pt-2 pb-1">
            <View className="w-12 h-1 bg-border rounded-full" />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 min-w-0">
                <Text
                  className="text-xl font-extrabold text-text"
                  numberOfLines={1}
                >
                  📦 Заказ #{String(order.orderId).substring(0, 8)}
                </Text>
                <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mt-0.5">
                  {order.orderStatus === "PENDING"
                    ? "Ждёт курьера"
                    : order.orderStatus === "ACCEPTED"
                      ? "Готовится"
                      : order.orderStatus === "ASSIGNED"
                        ? "Курьер едет в ресторан"
                        : order.orderStatus === "PICKED"
                          ? "Доставляется"
                          : order.orderStatus === "AWAITING_CONFIRMATION"
                            ? "Ждём подтверждения"
                            : order.orderStatus}
                </Text>
              </View>
              {urgency === "urgent" && (
                <View className="bg-red rounded-full px-2.5 py-1 ml-2">
                  <Text className="text-text-inverse text-2xs font-extrabold">
                    ⚡ Срочно
                  </Text>
                </View>
              )}
              <Pressable
                onPress={onClose}
                className="ml-2 w-8 h-8 rounded-full bg-soft-surface-2 items-center justify-center active:scale-95"
                hitSlop={8}
              >
                <Text className="text-text-soft text-lg">✕</Text>
              </Pressable>
            </View>

            {/* Addresses (placeholder — Шаг 4 сделаем красиво) */}
            <View className="bg-soft-surface-2 border border-border rounded-2xl p-3.5">
              <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider">
                Забрать
              </Text>
              <Text
                className="text-sm font-bold text-text mt-0.5"
                numberOfLines={2}
              >
                {order.pickupAddress?.name || "Ресторан"}
              </Text>
              <Text className="text-sm text-text-soft mt-1" numberOfLines={2}>
                {order.pickupAddress?.address}
              </Text>
              <View className="h-px bg-border my-2.5" />
              <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider">
                Доставить
              </Text>
              <Text
                className="text-sm font-bold text-text mt-0.5"
                numberOfLines={2}
              >
                {order.deliveryAddress?.city
                  ? `${order.deliveryAddress.city}, `
                  : ""}
                {order.deliveryAddress?.address}
              </Text>
            </View>

            {/* Items (placeholder) */}
            <View className="bg-soft-surface-2 border border-border rounded-2xl p-3.5 mt-3">
              <Text className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-1.5">
                🍽 Состав
              </Text>
              {order.items.map((it) => (
                <View
                  key={it.foodId}
                  className="flex-row items-center justify-between py-1 border-b border-border/40 last:border-b-0"
                >
                  <Text className="text-sm text-text flex-1" numberOfLines={1}>
                    {it.title}
                  </Text>
                  <Text className="text-sm text-text-soft font-bold ml-2">
                    ×{it.quantity}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View className="gap-2 mt-4">
              {isClaimable && (
                <ActionButton
                  label={
                    urgency === "urgent" ? "⚡ Взять срочно" : "✅ Взять заказ"
                  }
                  variant="primary"
                  loading={loading?.claim}
                  disabled={!online || loading?.claim}
                  onPress={() => onClaim(order.id)}
                />
              )}
              {isAssigned && (
                <ActionButton
                  label="🏪 Забрал из ресторана"
                  variant="info"
                  loading={loading?.pickUp}
                  onPress={() => onPickUp(order.id)}
                />
              )}
              {isDelivering && (
                <ActionButton
                  label="📦 Доставлен клиенту"
                  variant="success"
                  loading={loading?.deliver}
                  onPress={() => onDeliver(order.id)}
                />
              )}
              {isAwaiting && (
                <View className="bg-warning-soft border border-warning/30 rounded-2xl p-3 flex-row items-center">
                  <Text className="text-lg mr-2">⏳</Text>
                  <Text className="text-sm text-warning-dark font-bold flex-1">
                    Ждём подтверждения клиента
                  </Text>
                </View>
              )}

              {(isAssigned || isDelivering || isAwaiting) && (
                <Pressable
                  onPress={() => onOpenChat(order.id)}
                  className="bg-soft-surface-2 border border-border h-12 rounded-2xl items-center justify-center flex-row active:scale-[0.98]"
                >
                  <Text className="text-text font-bold text-sm">
                    💬 Открыть чат
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
