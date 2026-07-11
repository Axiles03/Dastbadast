// dastbadast-multivendor-rider/components/MapTabContent.tsx
//
// ⭐ ШАГ 3: исправляем захардкоженный Geoapify ключ → берём из env.

import { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
// ⭐ ШАГ 3: импортируем НОВЫЙ MapView (на WebView), а не react-native-maps
import { MapLibreOrdersMap } from "./MapLibreOrdersMap";
import { OrderBottomSheet } from "./OrderBottomSheet";
import { extractLatLng } from "../lib/routing";
import { cn } from "../lib/cn";
import type { Order, OrderAddress } from "./OrderCard";
import dotenv from "dotenv";

type Props = {
  available: boolean;
  onTab: (tab: "pool" | "mine") => void;
  pool: Order[];
  myOrders: Order[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onClaim: (orderId: string) => void | Promise<void>;
  onPickUp: (orderId: string) => void | Promise<void>;
  onDeliver: (orderId: string) => void | Promise<void>;
  onOpenChat: (orderId: string) => void;
  riderPos: {
    latitude: number;
    longitude: number;
    bearing?: number | null;
  } | null;
  onSwitchToList: () => void;
};

export function MapTabContent(props: Props) {
  const GEOAPIFY_TILES_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_TILES_KEY ?? "";

  const {
    available,
    onTab,
    pool,
    myOrders,
    selectedId,
    setSelectedId,
    onClaim,
    onPickUp,
    onDeliver,
    onOpenChat,
    riderPos,
    onSwitchToList,
  } = props;

  const allOrders = useMemo(() => [...myOrders, ...pool], [myOrders, pool]);

  const markers = useMemo(() => {
    const out: Array<{
      id: string;
      kind: "restaurant" | "customer" | "urgent";
      coordinate: { latitude: number; longitude: number };
      label?: string;
      active?: boolean;
      onPress?: () => void;
    }> = [];
    for (const o of allOrders) {
      const rest = extractLatLng(o.pickupAddress);
      if (rest) {
        out.push({
          id: `${o.id}-rest`,
          kind: "restaurant",
          coordinate: { latitude: rest[0], longitude: rest[1] },
          label: o.pickupAddress?.name || "Ресторан",
          active: selectedId === o.id,
        });
      }
      const cust = extractLatLng(o.deliveryAddress);
      if (cust) {
        out.push({
          id: `${o.id}-cust`,
          kind: "customer",
          coordinate: { latitude: cust[0], longitude: cust[1] },
          label: o.deliveryAddress?.city || "Клиент",
          active: selectedId === o.id,
          onPress: () => setSelectedId(o.id),
        });
      }
    }
    return out;
  }, [allOrders, selectedId, setSelectedId]);

  const focused = selectedId
    ? (allOrders.find((o) => o.id === selectedId) ?? null)
    : null;

  // ⭐ ШАГ 3 FIX: используем НОВЫЙ MapView, ключ берётся из env (через buildMapHtml)
  return (
    <View className="flex-1 bg-soft-bg relative">
      <MapLibreOrdersMap
        markers={markers}
        rider={riderPos}
        pickupGeo={focused?.pickupAddress ?? null}
        deliveryGeo={focused?.deliveryAddress ?? null}
        autoFit
      />

      <Pressable
        onPress={onSwitchToList}
        className="absolute left-3 top-3 bg-soft-surface border border-border rounded-full px-3.5 py-2 flex-row items-center gap-1.5 shadow-soft-sm active:scale-95"
      >
        <Text className="text-base">📋</Text>
        <Text className="text-xs font-extrabold text-text">Список</Text>
      </Pressable>

      <View className="absolute left-3 right-3 bottom-24 flex-row gap-2">
        <Pressable
          onPress={() => onTab("pool")}
          className="flex-1 bg-accent-soft border border-accent/30 rounded-2xl p-3 shadow-soft-sm flex-row items-center gap-2 active:scale-95"
        >
          <Text className="text-lg">🛒</Text>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-extrabold text-accent-dark">
              Доступные
            </Text>
            <Text className="text-2xs text-text-soft">
              Нажмите чтобы открыть
            </Text>
          </View>
          <View className="bg-accent min-w-[28px] h-7 rounded-full items-center justify-center px-2">
            <Text className="text-text-inverse font-extrabold text-sm">
              {pool.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => onTab("mine")}
          className="flex-1 bg-info-soft border border-info/30 rounded-2xl p-3 shadow-soft-sm flex-row items-center gap-2 active:scale-95"
        >
          <Text className="text-lg">🛵</Text>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-extrabold text-info-dark">Мои</Text>
            <Text className="text-2xs text-text-soft">Активные доставки</Text>
          </View>
          <View className="bg-info min-w-[28px] h-7 rounded-full items-center justify-center px-2">
            <Text className="text-text-inverse font-extrabold text-sm">
              {myOrders.length}
            </Text>
          </View>
        </Pressable>
      </View>

      <OrderBottomSheet
        selectedId={selectedId}
        orders={allOrders}
        online={props.available}
        onClose={() => setSelectedId(null)}
        onClaim={onClaim}
        onPickUp={onPickUp}
        onDeliver={onDeliver}
        onOpenChat={onOpenChat}
      />
    </View>
  );
}
