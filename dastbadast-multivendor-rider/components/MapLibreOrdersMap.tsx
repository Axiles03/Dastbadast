// dastbadast-multivendor-rider/components/MapLibreOrdersMap.tsx
//
// ⭐⭐⭐ ПОЛНАЯ ДОРАБОТКА: карта курьера на MapLibre GL JS (open-source,
// API-совместим с Mapbox GL JS) + OpenFreeMap (https://openfreemap.org).
//
// Почему OpenFreeMap, а не Mapbox / Geoapify:
//   - НЕ ТРЕБУЕТ никакого API-ключа/токена вообще (ни регистрации,
//     ни аккаунта) — то, что и было нужно.
//   - Полноценные векторные тайлы (не растровые PNG) — чёткий рендер на
//     любом зуме, плавнее, чем raster.
//   - Бесплатно и без лимита запросов на публичном инстансе
//     (https://tiles.openfreemap.org), в отличие от tile.openstreetmap.org,
//     который был здесь раньше: у него жёсткая usage policy для лёгкой
//     разработки, а НЕ для прод-трафика реального приложения — при
//     заметной нагрузке OSM банит IP.
//
// Что было исправлено по факту (это был реально используемый файл —
// MapPlaceholder.tsx/CustomMapView.tsx на Leaflet оказались мёртвым кодом,
// нигде не рендерятся):
//   1. `rider.bearing` приходил в пропсах, но нигде не использовался —
//      маркер курьера никогда не поворачивался по направлению движения.
//   2. На КАЖДОЕ обновление позиции курьера (может быть раз в несколько
//      секунд) все маркеры удалялись и создавались заново — это и есть
//      источник подтормаживания/мигания карты. Теперь маркеры маршрута
//      (ресторан/клиент) переиспользуются по id, двигается только то, что
//      реально изменилось.
//   3. `attributionControl: false` — нарушение лицензии OSM/OpenFreeMap
//      (атрибуция обязательна). Включена обратно.
//   4. Нет обработки ошибки загрузки WebView (нет сети и т.п.) — экран
//      просто оставался пустым. Добавлен fallback как в остальных картах
//      проекта.
//   5. Нет зум-контролов — добавлены (NavigationControl).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
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

// ⭐ Бесплатный, без ключа, векторный стиль. MapLibre сам добавляет
// обязательную атрибуцию OpenFreeMap/OSM при использовании этого style.json.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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

  // Генерируем GeoJSON для маршрута (курьер → ресторан → клиент)
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
      } else if (data.type === "MAP_ERROR" && __DEV__) {
        console.warn("[MapLibreOrdersMap]", data.message);
      }
    } catch (e) {
      console.error("Ошибка парсинга сообщения из WebView:", e);
    }
  };

  const mapHtml = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
      <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
      <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }

        .rider-marker {
          width: 42px; height: 42px; position: relative;
        }
        .rider-marker .rider-dot {
          position: absolute; inset: 0; border-radius: 50%;
          background-color: #F26A4A; display: flex; align-items: center;
          justify-content: center; border: 3px solid #FFFFFF;
          box-shadow: 0px 3px 6px rgba(0,0,0,0.3); font-size: 20px;
        }
        .rider-marker .rider-arrow {
          position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
          width: 0; height: 0; border-left: 6px solid transparent;
          border-right: 6px solid transparent; border-bottom: 9px solid #DC5635;
        }

        .point-marker {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border-width: 2px; border-style: solid;
          box-shadow: 0px 2px 4px rgba(0,0,0,0.15); font-size: 16px;
          transition: border-color 0.2s ease;
          background: #FFFFFF;
        }

        .maplibregl-ctrl-attrib { font-size: 10px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        function notifyError(message) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_ERROR', message: message }));
          } catch (e) {}
        }

        var map = null;
        try {
          map = new maplibregl.Map({
            container: 'map',
            style: '${MAP_STYLE_URL}',
            center: ${JSON.stringify(DUSHANBE)},
            zoom: 13,
            attributionControl: true,
          });
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          map.on('error', function (e) {
            notifyError((e && e.error && e.error.message) || 'unknown map error');
          });
        } catch (e) {
          notifyError('init failed: ' + e.message);
        }

        // ⭐ Персистентные маркеры точек заказа: id -> maplibregl.Marker.
        // Пересоздаём только те, чей id реально пропал/появился — не всё
        // подряд на каждый тик GPS курьера (раньше именно это вызывало
        // подмигивание/подтормаживание карты).
        var pointMarkers = {};
        var riderMarker = null;

        if (map) {
          map.on('load', function () {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
          });
        }

        var MARKER_STYLE = {
          restaurant: { emoji: '🏪' },
          customer: { emoji: '📍' },
          urgent: { emoji: '⚡' },
        };

        window.updateMapFeatures = function (markers, rider, routeGeoJSON, autoFit) {
          if (!map) return;
          try {
            // --- Курьер: один персистентный маркер, двигаем + вращаем ---
            if (rider) {
              if (!riderMarker) {
                var el = document.createElement('div');
                el.className = 'rider-marker';
                el.innerHTML =
                  '<div class="rider-arrow" style="display:none"></div>' +
                  '<div class="rider-dot">🛵</div>';
                riderMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
                  .setLngLat([rider.longitude, rider.latitude])
                  .addTo(map);
              } else {
                riderMarker.setLngLat([rider.longitude, rider.latitude]);
              }
              var arrowEl = riderMarker.getElement().querySelector('.rider-arrow');
              if (arrowEl) {
                if (typeof rider.bearing === 'number' && !isNaN(rider.bearing)) {
                  arrowEl.style.display = 'block';
                  arrowEl.style.transform =
                    'translateX(-50%) rotate(' + rider.bearing + 'deg)';
                } else {
                  arrowEl.style.display = 'none';
                }
              }
            } else if (riderMarker) {
              riderMarker.remove();
              riderMarker = null;
            }

            // --- Точки заказов: diff по id, без полного пересоздания ---
            var seenIds = {};
            markers.forEach(function (m) {
              seenIds[m.id] = true;
              var style = MARKER_STYLE[m.kind] || MARKER_STYLE.customer;
              var existing = pointMarkers[m.id];
              if (existing) {
                existing.marker.setLngLat([m.coordinate.longitude, m.coordinate.latitude]);
                if (existing.active !== !!m.active) {
                  existing.el.style.borderColor = m.active ? '#F26A4A' : '#E5E5E5';
                  existing.active = !!m.active;
                }
              } else {
                var el = document.createElement('div');
                el.className = 'point-marker';
                el.style.borderColor = m.active ? '#F26A4A' : '#E5E5E5';
                el.innerHTML = style.emoji;
                el.addEventListener('click', function () {
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: 'MARKER_PRESS', id: m.id }),
                  );
                });
                var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                  .setLngLat([m.coordinate.longitude, m.coordinate.latitude])
                  .addTo(map);
                pointMarkers[m.id] = { marker: marker, el: el, active: !!m.active };
              }
            });
            // убираем маркеры заказов, которых больше нет в списке
            Object.keys(pointMarkers).forEach(function (id) {
              if (!seenIds[id]) {
                pointMarkers[id].marker.remove();
                delete pointMarkers[id];
              }
            });

            // --- Линия маршрута ---
            if (routeGeoJSON) {
              if (map.getSource('route-source')) {
                map.getSource('route-source').setData(routeGeoJSON);
              } else {
                map.addSource('route-source', { type: 'geojson', data: routeGeoJSON });
                map.addLayer({
                  id: 'route-line',
                  type: 'line',
                  source: 'route-source',
                  layout: { 'line-cap': 'round', 'line-join': 'round' },
                  paint: {
                    'line-color': '#F26A4A',
                    'line-width': 4,
                    'line-opacity': 0.85,
                    'line-dasharray': [2, 1.5],
                  },
                });
              }
            } else {
              if (map.getLayer('route-line')) map.removeLayer('route-line');
              if (map.getSource('route-source')) map.removeSource('route-source');
            }

            // --- Авто-фит камеры под все точки ---
            if (autoFit) {
              var pts = [];
              if (rider) pts.push([rider.longitude, rider.latitude]);
              markers.forEach(function (m) {
                pts.push([m.coordinate.longitude, m.coordinate.latitude]);
              });

              if (pts.length === 1) {
                map.flyTo({ center: pts[0], zoom: 15, duration: 600 });
              } else if (pts.length > 1) {
                var lngs = pts.map(function (p) { return p[0]; });
                var lats = pts.map(function (p) { return p[1]; });
                var bounds = [
                  [Math.min.apply(null, lngs), Math.min.apply(null, lats)],
                  [Math.max.apply(null, lngs), Math.max.apply(null, lats)],
                ];
                map.fitBounds(bounds, {
                  padding: { top: 60, bottom: 180, left: 40, right: 40 },
                  duration: 600,
                });
              }
            }
          } catch (e) {
            notifyError('update failed: ' + e.message);
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
            <Text style={styles.fallbackSubtitle}>
              Проверьте интернет-соединение
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
