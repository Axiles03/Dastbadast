// dastbadast-multivendor-rider/components/MapPlaceholder.tsx
//
// ⭐⭐⭐ ШАГ 2 FIX: компонент CustomMapView теперь сам обрабатывает
// отсутствие react-native-maps (Expo Go / частичная сборка) — рендерит fallback.
// Поэтому здесь НЕ делаем дополнительный try/catch.
//
// Структура Props остаётся 100% совместимой с тем, что вызывал orders.tsx до фикса.

import React, { useMemo, useState, useCallback } from "react";
import type { Order, OrderAddress } from "./OrderCard";
import { View, Text, Pressable } from "react-native";
import { CustomMapView, isMapsAvailable } from "./MapView";
import { OrderBottomSheet } from "./OrderBottomSheet";
import { cn } from "../lib/cn";

type FabAction = {
  label: string;
  icon: "bicycle-outline" | "basket-outline";
  onPress: () => void;
};

type Props = {
  poolCount: number;
  myCount: number;
  online: boolean;
  poolOrders: Order[];
  myOrders: Order[];

  rider?: {
    latitude: number;
    longitude: number;
    bearing: number | null;
  } | null;
  pickupGeo?: OrderAddress | null;
  deliveryGeo?: OrderAddress | null;
  fabActions?: FabAction[];

  onClaim: (orderId: string) => void | Promise<void>;
  onPickUp: (orderId: string) => void | Promise<void>;
  onDeliver: (orderId: string) => void | Promise<void>;
  onOpenChat: (orderId: string) => void;
  onSwitchTabAndList: (tab: "pool" | "mine") => void;

  loading?: {
    claim?: boolean;
    pickUp?: boolean;
    deliver?: boolean;
  };
};

export function MapPlaceholder({
  poolCount,
  myCount,
  online,
  poolOrders,
  myOrders,
  fabActions = [],
  rider = null,
  pickupGeo = null,
  deliveryGeo = null,
  onClaim,
  onPickUp,
  onDeliver,
  onOpenChat,
  onSwitchTabAndList,
  loading,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allOrders = useMemo<Order[]>(
    () => [...myOrders, ...poolOrders],
    [myOrders, poolOrders],
  );

  const markers = useMemo(() => {
    const out: Array<{
      id: string;
      kind: "restaurant" | "customer" | "urgent";
      coordinate: { latitude: number; longitude: number };
      label?: string;
      active?: boolean;
      onPress?: () => void;
    }> = [];

    const pushOrder = (o: Order) => {
      const restCoords = o.pickupAddress?.location;
      const custCoords = o.deliveryAddress?.location;

      if (
        Array.isArray(restCoords?.coordinates) &&
        restCoords.coordinates.length >= 2
      ) {
        out.push({
          id: `${o.id}-rest`,
          kind: "restaurant",
          coordinate: {
            latitude: restCoords.coordinates[1],
            longitude: restCoords.coordinates[0],
          },
          label: o.pickupAddress?.name || "Ресторан",
          active: selectedId === o.id,
        });
      }
      if (
        Array.isArray(custCoords?.coordinates) &&
        custCoords.coordinates.length >= 2
      ) {
        const isUrgent =
          o.orderStatus === "PENDING" &&
          Date.now() - new Date(o.createdAt).getTime() > 90_000;
        out.push({
          id: `${o.id}-cust`,
          kind: isUrgent ? "urgent" : "customer",
          coordinate: {
            latitude: custCoords.coordinates[1],
            longitude: custCoords.coordinates[0],
          },
          label: o.deliveryAddress?.city || "Клиент",
          active: selectedId === o.id,
          onPress: () => setSelectedId(o.id),
        });
      }
    };

    myOrders.forEach(pushOrder);
    poolOrders.forEach(pushOrder);
    return out;
  }, [poolOrders, myOrders, selectedId]);

  const handleClose = useCallback(() => setSelectedId(null), []);

  return (
    <View className="flex-1 bg-soft-bg relative">
      <CustomMapView
        markers={markers}
        rider={rider}
        pickupGeo={pickupGeo}
        deliveryGeo={deliveryGeo}
        autoFit
      />

      <View className="absolute left-4 right-4" style={{ top: 12 }}>
        {poolCount > 0 && (
          <Pressable
            onPress={() => onSwitchTabAndList("pool")}
            className="bg-soft-surface/95 backdrop-blur-sm border border-soft-accent/30 rounded-2xl px-4 py-3 mb-2 shadow-soft-sm flex-row items-center gap-3 active:scale-[0.99]"
          >
            <View className="w-10 h-10 rounded-xl bg-accent-soft items-center justify-center">
              <Text className="text-xl">🛒</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-text">
                Доступно заказов
              </Text>
              <Text className="text-xs text-text-soft">
                Нажмите, чтобы открыть список
              </Text>
            </View>
            <View className="bg-accent rounded-full min-w-[36px] h-9 px-3 items-center justify-center">
              <Text className="text-text-inverse font-extrabold">
                {poolCount}
              </Text>
            </View>
          </Pressable>
        )}

        {myCount > 0 && (
          <Pressable
            onPress={() => onSwitchTabAndList("mine")}
            className="bg-soft-surface/95 backdrop-blur-sm border border-info/30 rounded-2xl px-4 py-3 shadow-soft-sm flex-row items-center gap-3 active:scale-[0.99]"
          >
            <View className="w-10 h-10 rounded-xl bg-info-soft items-center justify-center">
              <Text className="text-xl">🛵</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-text">
                Активные доставки
              </Text>
              <Text className="text-xs text-text-soft">У вас в работе</Text>
            </View>
            <View className="bg-info rounded-full min-w-[36px] h-9 px-3 items-center justify-center">
              <Text className="text-text-inverse font-extrabold">
                {myCount}
              </Text>
            </View>
          </Pressable>
        )}

        {poolCount === 0 && myCount === 0 && (
          <View className="bg-soft-surface/95 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-soft-sm items-center">
            <Text className="text-2xl mb-1 text-center">🗺</Text>
            <Text className="text-sm font-extrabold text-text text-center">
              Режим карты активен
            </Text>
            <Text className="text-xs text-text-soft text-center mt-1">
              {isMapsAvailable()
                ? "Нажмите на синий пин клиента, чтобы открыть заказ"
                : "Карта недоступна — запустите dev build"}
            </Text>
          </View>
        )}
      </View>

      {fabActions.length > 0 && (
        <View className="absolute right-4" style={{ bottom: 80 }}>
          <View className="gap-2.5">
            {fabActions.map((a, i) => (
              <Pressable
                key={i}
                onPress={a.onPress}
                accessibilityLabel={a.label}
                className="w-12 h-12 rounded-full bg-soft-surface border border-border items-center justify-center shadow-soft active:scale-95"
              >
                <Text className="text-xl">
                  {a.icon === "bicycle-outline" ? "🛵" : "🛒"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <OrderBottomSheet
        selectedId={selectedId}
        orders={allOrders}
        online={online}
        onClose={handleClose}
        onClaim={onClaim}
        onPickUp={onPickUp}
        onDeliver={onDeliver}
        onOpenChat={onOpenChat}
        loading={loading}
      />
    </View>
  );
}
