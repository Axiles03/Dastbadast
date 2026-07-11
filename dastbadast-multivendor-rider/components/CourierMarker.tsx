// dastbadast-multivendor-rider/components/CourierMarker.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker, type MapMarkerProps } from "react-native-maps";

type Props = Omit<MapMarkerProps, "coordinate" | "identifier"> & {
  coordinate: { latitude: number; longitude: number };
  /** Курс в градусах (0-360). 0 = север, 90 = восток */
  bearing?: number | null;
  active?: boolean;
  zIndex?: number;
};

export function CourierMarker({
  coordinate,
  bearing,
  active = false,
  zIndex,
  ...rest
}: Props) {
  // Нормализуем bearing в 0..360
  const normBearing =
    typeof bearing === "number" && Number.isFinite(bearing)
      ? ((bearing % 360) + 360) % 360
      : null;

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={zIndex ?? 100}
      {...rest}
    >
      <View style={styles.wrap} pointerEvents="box-none">
        {/* Стрелка направления */}
        {normBearing !== null && (
          <View
            style={[
              styles.bearingArrow,
              {
                backgroundColor: active ? "#16A34A" : "#9A9388",
                transform: [{ rotate: `${normBearing}deg` }],
              },
            ]}
          />
        )}

        {/* Пузырь */}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: active ? "#DCFCE7" : "#FFEEE5",
              borderColor: active ? "#16A34A" : "#F26A4A",
              width: active ? 50 : 44,
              height: active ? 50 : 44,
              borderRadius: active ? 25 : 22,
            },
          ]}
        >
          <Text style={styles.emoji}>🛵</Text>
        </View>

        {/* Лейбл "В пути" */}
        {active && (
          <View style={[styles.label, { backgroundColor: "#16A34A" }]}>
            <Text className="text-text-inverse text-2xs font-extrabold">
              В ПУТИ
            </Text>
          </View>
        )}
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
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bearingArrow: {
    position: "absolute",
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  label: {
    position: "absolute",
    bottom: -16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emoji: { fontSize: 22, lineHeight: 26 },
});
