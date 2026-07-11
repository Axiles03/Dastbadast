// dastbadast-multivendor-rider/components/MapboxOrdersMap.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import Mapbox from "@rnmapbox/maps";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

type AnyMarker = {
  id: string;
  kind: "restaurant" | "customer" | "urgent";
  coordinate: { latitude: number; longitude: number };
  label?: string;
  active?: boolean;
  onPress?: () => void;
};
type RiderPos = {
  latitude: number;
  longitude: number;
  bearing?: number | null;
} | null;
type OrderAddress = {
  name?: string | null;
  address?: string | null;
  location?: { coordinates?: number[] } | null;
};
type Props = {
  markers: AnyMarker[];
  rider?: RiderPos;
  pickupGeo?: OrderAddress | null;
  deliveryGeo?: OrderAddress | null;
  autoFit?: boolean;
  loading?: boolean;
  className?: string;
};

const DUSHANBE: [number, number] = [68.783, 38.574]; // [lng, lat] — Mapbox всегда lng,lat

const PointAnnotation = Mapbox.PointAnnotation as any;

const MARKER_STYLE: Record<string, { bg: string; emoji: string }> = {
  restaurant: { bg: "#FFFFFF", emoji: "🏪" },
  customer: { bg: "#FFFFFF", emoji: "📍" },
  urgent: { bg: "#FEE2E2", emoji: "⚡" },
};

export function MapboxOrdersMap({
  markers,
  rider = null,
  pickupGeo = null,
  deliveryGeo = null,
  autoFit = true,
  loading = false,
  className,
}: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Маршрут rider → pickup → delivery (прямые линии; для честного роутинга
  // по дорогам используйте lib/routing.ts + Geoapify/OSRM, как уже сделано
  // для расчёта ETA, и подставляйте сюда реальные точки полилинии)
  const routeGeoJSON = useMemo(() => {
    const coords: [number, number][] = [];
    if (rider) coords.push([rider.longitude, rider.latitude]);
    const pickupCoords = pickupGeo?.location?.coordinates;
    if (pickupCoords?.length === 2)
      coords.push([pickupCoords[0], pickupCoords[1]]);
    const deliveryCoords = deliveryGeo?.location?.coordinates;
    if (deliveryCoords?.length === 2)
      coords.push([deliveryCoords[0], deliveryCoords[1]]);
    if (coords.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: coords },
      properties: {},
    };
  }, [rider, pickupGeo, deliveryGeo]);

  useEffect(() => {
    if (!autoFit || !cameraRef.current) return;
    const pts: [number, number][] = [];
    if (rider) pts.push([rider.longitude, rider.latitude]);
    for (const m of markers)
      pts.push([m.coordinate.longitude, m.coordinate.latitude]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: pts[0],
        zoomLevel: 15,
        animationDuration: 600,
      });
      return;
    }
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    cameraRef.current.setCamera({
      bounds: {
        ne: [Math.max(...lngs), Math.max(...lats)],
        sw: [Math.min(...lngs), Math.min(...lats)],
      },
      padding: {
        paddingTop: 80,
        paddingBottom: 220,
        paddingLeft: 40,
        paddingRight: 40,
      },
      animationDuration: 600,
    });
  }, [autoFit, rider, markers]);

  return (
    <View style={styles.container} className={className}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/streets-v12"
        logoEnabled={false}
        attributionPosition={{ bottom: 6, right: 6 }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: DUSHANBE, zoomLevel: 13 }}
        />

        {routeGeoJSON && (
          <Mapbox.ShapeSource id="route-source" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="route-line"
              style={{
                lineColor: "#F26A4A",
                lineWidth: 4,
                lineOpacity: 0.85,
                lineDasharray: [2, 1.5],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {rider && (
          <PointAnnotation
            id="rider-marker"
            coordinate={[rider.longitude, rider.latitude]}
          >
            <View style={styles.riderMarker}>
              <Text style={{ fontSize: 20 }}>🛵</Text>
            </View>
          </PointAnnotation>
        )}

        {markers.map((m) => {
          const style = MARKER_STYLE[m.kind] ?? MARKER_STYLE.customer;
          return (
            <PointAnnotation
              key={m.id}
              id={m.id}
              coordinate={[m.coordinate.longitude, m.coordinate.latitude]}
              onSelected={m.onPress}
            >
              <View
                style={[
                  styles.pointMarker,
                  {
                    backgroundColor: style.bg,
                    borderColor: m.active ? "#F26A4A" : "#E5E5E5",
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{style.emoji}</Text>
              </View>
            </PointAnnotation>
          );
        })}
      </Mapbox.MapView>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#F26A4A" size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },
  riderMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F26A4A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  pointMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,247,242,0.4)",
  },
});
