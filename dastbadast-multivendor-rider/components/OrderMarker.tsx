// dastbadast-multivendor-rider/components/OrderMarker.tsx
//
// ⭐ ШАГ 3: кастомный маркер для карты — без Google API.
// Поддерживает 4 типа: ресторан, клиент, курьер, срочный заказ.
// Показывает emoji в кружке + опциональную подпись.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker, MapMarkerProps } from "react-native-maps";
import { cn } from "../lib/cn";

type MarkerKind = "restaurant" | "customer" | "rider" | "urgent";

type Props = Omit<MapMarkerProps, "coordinate" | "identifier"> & {
  coordinate: { latitude: number; longitude: number };
  kind: MarkerKind;
  label?: string;
  active?: boolean;
  zIndex?: number;
  onPress?: () => void;
};

const KIND_STYLE: Record<
  MarkerKind,
  { emoji: string; bg: string; border: string; size: number }
> = {
  restaurant: { emoji: "🏪", bg: "#FFEEE5", border: "#F26A4A", size: 40 },
  customer: { emoji: "🎯", bg: "#E0F2FE", border: "#2D9CDB", size: 44 },
  rider: { emoji: "🛵", bg: "#DCFCE7", border: "#16A34A", size: 44 },
  urgent: { emoji: "⚡", bg: "#FEE2E2", border: "#DC2626", size: 46 },
};

export function OrderMarker({
  kind,
  label,
  active = false,
  zIndex,
  onPress,
  coordinate,
  ...rest
}: Props) {
  const s = KIND_STYLE[kind];

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={zIndex}
      onPress={onPress}
      {...rest}
    >
      <View style={styles.wrap} pointerEvents="box-none">
        {/* "Хвостик" пина */}
        <View style={[styles.tail, { borderTopColor: s.border }]} />
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: s.bg,
              borderColor: s.border,
              width: s.size,
              height: s.size,
              borderRadius: s.size / 2,
            },
            active && {
              borderWidth: 3,
              transform: [{ scale: 1.1 }],
            },
          ]}
        >
          <Text style={styles.emoji}>{s.emoji}</Text>
        </View>
        {label ? (
          <View
            className={cn(
              "absolute -bottom-1 left-1/2 -ml-12 w-24 px-1.5 py-0.5 rounded-full border",
              active
                ? "bg-soft-text border-soft-text"
                : "bg-soft-surface border-border",
            )}
            style={{
              marginLeft: -48,
              width: 96,
            }}
          >
            <Text
              numberOfLines={1}
              className={cn(
                "text-2xs font-extrabold text-center",
                active ? "text-text-inverse" : "text-text",
              )}
            >
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  tail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    position: "absolute",
    bottom: -6,
  },
  emoji: { fontSize: 18, lineHeight: 22 },
});
