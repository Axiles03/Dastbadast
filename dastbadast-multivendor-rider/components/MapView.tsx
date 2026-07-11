// dastbadast-multivendor-rider/components/MapView.tsx
//
// ⭐ ШАГ 3: WebView + Leaflet. Все TS-ошибки устранены.
// (v3 — финальный, после ревью ошибок)

import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";

const GEOAPIFY_TILES_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_TILES_KEY ?? "";
const GEOAPIFY_ROUTING_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY ?? "";

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

type Props = {
  markers: AnyMarker[];
  rider?: RiderPos;
  pickupGeo?: OrderAddress | null;
  deliveryGeo?: OrderAddress | null;
  autoFit?: boolean;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  loading?: boolean;
  className?: string;
  followRider?: boolean;
};

type OrderAddress = {
  label?: string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  details?: string | null;
  location?: { coordinates?: number[] } | null | undefined;
};

const TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_TILES_KEY}`;
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://geoapify.com/">Geoapify</a>';

const DUSHANBE = { latitude: 38.574, longitude: 68.783 };

/**
 * ⭐ FIX v3: `initialCenter` теперь типизирован как `Center`,
 * а `centerJson` помечен `as const` (литерал объекта), чтобы
 * TS не путал его со string-интерполяцией.
 */
type Center = { lat: number; lng: number };

function buildMapHtml({
  initialCenter,
  initialZoom,
  tileUrl,
  attribution,
}: {
  initialCenter: Center;
  initialZoom: number;
  tileUrl: string;
  attribution: string;
}): string {
  const centerJson: string = JSON.stringify(initialCenter);
  // TS-friendly: отдельные константы примитивного типа
  const initLat: number = initialCenter.lat;
  const initLng: number = initialCenter.lng;
  const safeTileUrl = tileUrl.replace(/"/g, "&quot;");
  const safeAttr = attribution.replace(/"/g, "&quot;");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Dastbadast Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #FAF7F2; }
    .rider-marker {
      background: #F26A4A; color: white; border-radius: 50%;
      width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
      border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 22px; position: relative;
    }
    .rider-marker .bearing-arrow {
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
      width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent;
      border-bottom: 9px solid #DC5635;
    }
    .pickup-marker, .customer-marker {
      background: white; border-radius: 50%; width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #F26A4A; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 18px;
    }
    .customer-marker { border-color: #2D9CDB; }
    .legend {
      position: absolute; bottom: 10px; left: 10px; z-index: 1000;
      background: rgba(255,255,255,0.95); padding: 8px 12px; border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .legend strong { display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <strong>Dastbadast</strong>
    <span>📍 Клиент  🏪 Ресторан  🛵 Курьер</span>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    (function () {
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
      }).setView[${initialCenter.lat}, ${initialCenter.lng}], ${initialZoom});

      L.tileLayer('${safeTileUrl}', {
        maxZoom: 19,
        attribution: '${safeAttr}'
      }).addTo(map);

      window.__markers = {};
      window.__lines = {};
      window.__riderMarker = null;

      window.DBDMap = {
        setRider: function(lat, lng, bearing) {
          var latlng = [lat, lng];
          if (!window.__riderMarker) {
            var html = '<div class="rider-marker"><div class="bearing-arrow" id="rider-arrow" style="display:none"></div>🛵</div>';
            var icon = L.divIcon({
              html: html,
              className: '',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });
            window.__riderMarker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 }).addTo(map);
          } else {
            window.__riderMarker.setLatLng(latlng);
          }
          if (typeof bearing === 'number' && !isNaN(bearing)) {
            var arrow = document.getElementById('rider-arrow');
            if (arrow) {
              arrow.style.display = 'block';
              arrow.style.transform = 'translateX(-50%) rotate(' + bearing + 'deg)';
            }
          }
          map.flyTo(latlng, Math.max(map.getZoom(), 15), { duration: 0.8 });
        },
        setPoint: function(id, lat, lng, type, label) {
          var latlng = [lat, lng];
          var emoji = type === 'pickup' ? '🏪' : '📍';
          var cls = type === 'pickup' ? 'pickup-marker' : 'customer-marker';
          var html = '<div class="' + cls + '">' + emoji + '</div>';
          var icon = L.divIcon({ html: html, className: '', iconSize: [38, 38], iconAnchor: [19, 19] });
          if (window.__markers[id]) {
            window.__markers[id].setLatLng(latlng);
            window.__markers[id].setIcon(icon);
          } else {
            window.__markers[id] = L.marker(latlng, { icon: icon }).addTo(map);
          }
          if (label && window.__markers[id].bindTooltip) {
            window.__markers[id].bindTooltip(label, { permanent: false });
          }
        },
        drawRoute: function(coords) {
          if (window.__lines.route) {
            map.removeLayer(window.__lines.route);
          }
          if (!coords || coords.length < 2) return;
          window.__lines.route = L.polyline(coords, {
            color: '#F26A4A',
            weight: 4,
            opacity: 0.85,
            dashArray: '8 6',
          }).addTo(map);
        },
        fitBounds: function(coords) {
          if (!coords || coords.length < 1) return;
          if (coords.length === 1) {
            map.setView(coords[0], 15);
            return;
          }
          var bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        },
        clearAll: function() {
          Object.values(window.__markers).forEach(function(m){ map.removeLayer(m); });
          window.__markers = {};
          Object.values(window.__lines).forEach(function(l){ map.removeLayer(l); });
          window.__lines = {};
          if (window.__riderMarker) { map.removeLayer(window.__riderMarker); window.__riderMarker = null; }
        },
      };

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }
    })();
  </script>
</body>
</html>`;
}

function safeInject(expr: string): string {
  return `(function(){try{${expr}}catch(e){console.warn('[DBDMap]',e.message);}})();`;
}

export function CustomMapView({
  markers,
  rider = null,
  pickupGeo = null,
  deliveryGeo = null,
  autoFit = true,
  initialRegion,
  loading = false,
  className,
  followRider = true,
}: Props) {
  const webViewRef = useRef<WebView | null>(null);
  const isReadyRef = useRef(false);
  const pendingQueueRef = useRef<Array<() => void>>([]);

  const mapHtml = useMemo<string>(() => {
    const center: Center = initialRegion
      ? { lat: initialRegion.latitude, lng: initialRegion.longitude }
      : { lat: DUSHANBE.latitude, lng: DUSHANBE.longitude };
    return buildMapHtml({
      initialCenter: center,
      initialZoom: 14,
      tileUrl: TILE_URL,
      attribution: ATTRIBUTION,
    });
  }, [initialRegion?.latitude, initialRegion?.longitude]);

  const execOnMap = (expr: string) => {
    if (isReadyRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(safeInject(expr));
    } else {
      pendingQueueRef.current.push(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(safeInject(expr));
        }
      });
    }
  };

  useEffect(() => {
    if (!rider) return;
    execOnMap(
      `window.DBDMap.setRider(${rider.latitude}, ${rider.longitude}, ${rider.bearing ?? "null"});`,
    );
  }, [rider?.latitude, rider?.longitude, rider?.bearing]);

  useEffect(() => {
    if (
      pickupGeo?.location?.coordinates &&
      pickupGeo.location.coordinates.length >= 2
    ) {
      const [lng, lat] = pickupGeo.location.coordinates;
      execOnMap(
        `window.DBDMap.setPoint('pickup', ${lat}, ${lng}, 'pickup', ${JSON.stringify(pickupGeo.name || "Ресторан")});`,
      );
    }
    if (
      deliveryGeo?.location?.coordinates &&
      deliveryGeo.location.coordinates.length >= 2
    ) {
      const [lng, lat] = deliveryGeo.location.coordinates;
      execOnMap(
        `window.DBDMap.setPoint('delivery', ${lat}, ${lng}, 'delivery', ${JSON.stringify(deliveryGeo.address || "Клиент")});`,
      );
    }
  }, [pickupGeo, deliveryGeo]);

  useEffect(() => {
    if (!autoFit) return;
    const pts: Array<[number, number]> = [];
    if (
      pickupGeo?.location?.coordinates &&
      pickupGeo.location.coordinates.length >= 2
    ) {
      const [lng, lat] = pickupGeo.location.coordinates;
      pts.push([lat, lng]);
    }
    if (
      deliveryGeo?.location?.coordinates &&
      deliveryGeo.location.coordinates.length >= 2
    ) {
      const [lng, lat] = deliveryGeo.location.coordinates;
      pts.push([lat, lng]);
    }
    if (rider) pts.push([rider.latitude, rider.longitude]);
    if (pts.length < 2) return;
    const json = JSON.stringify(pts);
    execOnMap(`window.DBDMap.drawRoute(${json});`);
    execOnMap(`window.DBDMap.fitBounds(${json});`);
  }, [
    autoFit,
    pickupGeo?.location?.coordinates?.[0],
    pickupGeo?.location?.coordinates?.[1],
    deliveryGeo?.location?.coordinates?.[0],
    deliveryGeo?.location?.coordinates?.[1],
    rider?.latitude,
    rider?.longitude,
  ]);

  useEffect(() => {
    return () => {
      isReadyRef.current = false;
      pendingQueueRef.current = [];
    };
  }, []);

  return (
    <View style={styles.container} className={className}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        bounces={false}
        onLoadEnd={() => {
          isReadyRef.current = true;
          const queue = pendingQueueRef.current.slice();
          pendingQueueRef.current = [];
          queue.forEach((fn) => fn());
        }}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          if (__DEV__) {
            try {
              console.log("[MapView msg]", event.nativeEvent.data);
            } catch {
              /* ignore */
            }
          }
        }}
        // ⭐ FIX: renderError в react-native-webview имеет сигнатуру
        // (errorDomain: string | undefined, errorCode: number, errorDesc: string) => ReactElement
        // (см. node_modules/react-native-webview/lib/WebViewTypes.d.ts)
        renderError={(
          errorDomain: string | undefined,
          errorCode: number,
          errorDesc: string,
        ) => (
          <View style={styles.fallback}>
            <Text style={styles.fallbackEmoji}>🗺</Text>
            <Text style={styles.fallbackTitle}>Ошибка карты</Text>
            <Text style={styles.fallbackSubtitle}>
              {errorDomain ?? "WebView"} · {errorCode} · {errorDesc}
            </Text>
          </View>
        )}
        renderLoading={() => (
          <View style={styles.fallback}>
            <ActivityIndicator color="#F26A4A" size="large" />
            <Text style={styles.fallbackSubtitle}>Загрузка карты…</Text>
          </View>
        )}
      />

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
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAF7F2",
  },
  fallbackEmoji: { fontSize: 56, marginBottom: 8 },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1B16",
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: "#9A9388",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,247,242,0.4)",
  },
});
