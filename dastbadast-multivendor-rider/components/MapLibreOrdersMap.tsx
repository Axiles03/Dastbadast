// dastbadast-multivendor-rider/components/MapLibreOrdersMap.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

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

const DUSHANBE: [number, number] = [68.783, 38.574]; // [lng, lat]

export function MapLibreOrdersMap({
  markers,
  rider = null,
  pickupGeo = null,
  deliveryGeo = null,
  autoFit = true,
  loading = false,
  className,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Генерируем GeoJSON для маршрута
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

  // Передаём обновлённые данные в WebView через инжекцию JS
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    const jsCode = `
      if (window.updateMapFeatures) {
        window.updateMapFeatures(
          ${JSON.stringify(markers)},
          ${JSON.stringify(rider)},
          ${JSON.stringify(routeGeoJSON)},
          ${autoFit}
        );
      }
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [isMapReady, markers, rider, routeGeoJSON, autoFit]);

  // Обработка кликов по маркерам из WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "MAP_READY") {
        setIsMapReady(true);
      } else if (data.type === "MARKER_PRESS") {
        const clickedMarker = markers.find((m) => m.id === data.id);
        if (clickedMarker && clickedMarker.onPress) {
          clickedMarker.onPress();
        }
      }
    } catch (e) {
      console.error("Ошибка парсинга сообщения из WebView:", e);
    }
  };

  // HTML-код для рендеринга MapLibre + OSM
  const mapHtml = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
      <script src="https://unpkg.com/maplibre-gl@4.1.3/dist/maplibre-gl.js"></script>
      <link href="https://unpkg.com/maplibre-gl@4.1.3/dist/maplibre-gl.css" rel="stylesheet" />
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        
        .rider-marker {
          width: 40px; height: 40px; border-radius: 50%;
          background-color: #F26A4A; display: flex; align-items: center;
          justify-content: center; border: 3px solid #FFFFFF;
          box-shadow: 0px 3px 6px rgba(0,0,0,0.3); font-size: 20px;
        }
        
        .point-marker {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border-width: 2px; border-style: solid;
          box-shadow: 0px 2px 4px rgba(0,0,0,0.15); font-size: 16px;
          transition: transform 0.2s ease;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = new maplibregl.Map({
          container: 'map',
          style: {
            version: 8,
            sources: {
              'osm-tiles': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap'
              }
            },
            layers: [{
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19
            }]
          },
          center: ${JSON.stringify(DUSHANBE)},
          zoom: 13,
          attributionControl: false
        });

        let currentMarkers = [];

        map.on('load', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        });

        window.updateMapFeatures = function(markers, rider, routeGeoJSON, autoFit) {
          // Очищаем старые маркеры
          currentMarkers.forEach(m => m.remove());
          currentMarkers = [];

          // Добавляем курьера
          if (rider) {
            const el = document.createElement('div');
            el.className = 'rider-marker';
            el.innerHTML = '🛵';
            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([rider.longitude, rider.latitude])
              .addTo(map);
            currentMarkers.push(marker);
          }

          // Добавляем точки (рестораны и клиенты)
          const MARKER_STYLE = {
            restaurant: { bg: "#FFFFFF", emoji: "🏪" },
            customer: { bg: "#FFFFFF", emoji: "📍" },
            urgent: { bg: "#FEE2E2", emoji: "⚡" }
          };

          markers.forEach(m => {
            const style = MARKER_STYLE[m.kind] || MARKER_STYLE.customer;
            const el = document.createElement('div');
            el.className = 'point-marker';
            el.style.backgroundColor = style.bg;
            el.style.borderColor = m.active ? "#F26A4A" : "#E5E5E5";
            el.innerHTML = style.emoji;

            el.addEventListener('click', () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_PRESS', id: m.id }));
            });

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([m.coordinate.longitude, m.coordinate.latitude])
              .addTo(map);
            currentMarkers.push(marker);
          });

          // Отрисовка линии маршрута
          if (routeGeoJSON) {
            if (map.getSource('route-source')) {
              map.getSource('route-source').setData(routeGeoJSON);
            } else {
              map.addSource('route-source', { type: 'geojson', data: routeGeoJSON });
              map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route-source',
                paint: {
                  'line-color': '#F26A4A',
                  'line-width': 4,
                  'line-opacity': 0.85,
                  'line-dasharray': [2, 1.5]
                }
              });
            }
          } else {
            if (map.getLayer('route-line')) map.removeLayer('route-line');
            if (map.getSource('route-source')) map.removeSource('route-source');
          }

          // Авто-фит камеры под все точки
          if (autoFit) {
            const pts = [];
            if (rider) pts.push([rider.longitude, rider.latitude]);
            markers.forEach(m => pts.push([m.coordinate.longitude, m.coordinate.latitude]));

            if (pts.length === 1) {
              map.flyTo({ center: pts[0], zoom: 15, duration: 600 });
            } else if (pts.length > 1) {
              const lngs = pts.map(p => p[0]);
              const lats = pts.map(p => p[1]);
              const bounds = [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)]
              ];
              map.fitBounds(bounds, {
                padding: { top: 60, bottom: 180, left: 40, right: 40 },
                duration: 600
              });
            }
          }
        };
      </script>
    </body>
    </html>
  `,
    [],
  );

  return (
    <View style={styles.container} className={className}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFill}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,247,242,0.4)",
  },
});
