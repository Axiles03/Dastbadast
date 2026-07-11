// dastbadast-multivendor-web/components/OrderTrackingMap.tsx
//
// Карта отслеживания заказа: курьер + маршрут ресторан → клиент + цена доставки.
//
// ⭐⭐⭐ ПЕРЕПИСАНО НА MAPLIBRE GL (векторный WebGL-движок) вместо react-leaflet:
//   1) Один экземпляр maplibregl.Map создаётся один раз (guard через ref) —
//      не пересоздаётся на каждый рендер и переживает двойной вызов эффекта
//      в React StrictMode (dev) без ошибок "Map container is already initialized".
//   2) Маршрут — GeoJSON source + line layer. Обновление позиции = вызов
//      source.setData(...), БЕЗ пересоздания слоя/DOM — отсюда плавность.
//   3) Маркеры (ресторан/клиент/курьер) переиспользуются между рендерами —
//      двигаем через marker.setLngLat(...), а не создаём заново.
//   4) ⭐ ФИКС БАГА из Leaflet-версии: там курьер рисовался как
//      `position={[riderPos[1], riderPos[0]]}` — это [lng, lat] вместо
//      [lat, lng], то есть маркер и flyTo уезжали в неверную точку.
//      Здесь коррдинаты всегда явные: riderLng/riderLat, без путаницы.
//
// ВАЖНО: MapLibre использует порядок [lng, lat] (GeoJSON-стандарт),
// а не [lat, lng] как Leaflet — весь код ниже это учитывает.

"use client";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/map-providers";

const ROUTE_SOURCE_ID = "otm-route";
const ROUTE_LAYER_ID = "otm-route-line";

function riderEl(bearing: number | null | undefined): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "42px";
  el.style.height = "42px";
  el.style.position = "relative";
  el.innerHTML = `
    <div style="position:absolute;inset:0;background:#F26A4A;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid #fff">
      🛵
    </div>
    ${
      bearing != null
        ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%) rotate(${bearing}deg);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid #DC5635"></div>`
        : ""
    }
  `;
  return el;
}

function pinEl(emoji: string, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.fontSize = `${size}px`;
  el.style.lineHeight = "1";
  el.textContent = emoji;
  return el;
}

export function OrderTrackingMap({
  deliveryLat,
  deliveryLng,
  pickupLat,
  pickupLng,
  riderLat,
  riderLng,
  riderBearing,
  deliveryPrice,
  etaMin,
}: {
  deliveryLat: number;
  deliveryLng: number;
  pickupLat: number | null;
  pickupLng: number | null;
  riderLat: number | null;
  riderLng: number | null;
  riderBearing?: number | null;
  deliveryPrice?: number | null;
  etaMin?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const boundsFittedRef = useRef(false);
  const lastRiderFocusRef = useRef<[number, number] | null>(null);

  // ⭐ Инициализация карты — ровно один раз за жизнь компонента.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [deliveryLng, deliveryLat],
      zoom: 14,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    mapRef.current = map;

    map.on("load", () => {
      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          },
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#F26A4A",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }
      syncMap();
    });

    return () => {
      pickupMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      riderMarkerRef.current?.remove();
      pickupMarkerRef.current = null;
      destMarkerRef.current = null;
      riderMarkerRef.current = null;
      boundsFittedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⭐ Синхронизация данных карты при изменении координат/бейджей.
  useEffect(() => {
    syncMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deliveryLat,
    deliveryLng,
    pickupLat,
    pickupLng,
    riderLat,
    riderLng,
    riderBearing,
  ]);

  function syncMap() {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      // --- Маршрут (ресторан → клиент, без курьера) ---
      const routeCoords: [number, number][] = [];
      if (pickupLat != null && pickupLng != null) {
        routeCoords.push([pickupLng, pickupLat]);
      }
      routeCoords.push([deliveryLng, deliveryLat]);
      const routeSource = map.getSource(ROUTE_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      routeSource?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: routeCoords },
      });

      // --- Маркер ресторана ---
      if (pickupLat != null && pickupLng != null) {
        if (!pickupMarkerRef.current) {
          pickupMarkerRef.current = new maplibregl.Marker({
            element: pinEl("🏪", 26),
            anchor: "center",
          })
            .setLngLat([pickupLng, pickupLat])
            .addTo(map);
        } else {
          pickupMarkerRef.current.setLngLat([pickupLng, pickupLat]);
        }
      }

      // --- Маркер точки доставки ---
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maplibregl.Marker({
          element: pinEl("📍", 28),
          anchor: "center",
        })
          .setLngLat([deliveryLng, deliveryLat])
          .addTo(map);
      } else {
        destMarkerRef.current.setLngLat([deliveryLng, deliveryLat]);
      }

      // --- Маркер курьера ---
      if (riderLat != null && riderLng != null) {
        if (!riderMarkerRef.current) {
          riderMarkerRef.current = new maplibregl.Marker({
            element: riderEl(riderBearing),
            anchor: "center",
          })
            .setLngLat([riderLng, riderLat])
            .addTo(map);
        } else {
          riderMarkerRef.current.setLngLat([riderLng, riderLat]);
          riderMarkerRef.current
            .getElement()
            .replaceWith(riderEl(riderBearing));
        }

        // Плавно следим за курьером после первого fitBounds
        if (boundsFittedRef.current) {
          const last = lastRiderFocusRef.current;
          const moved =
            !last ||
            Math.abs(last[0] - riderLat) > 0.00015 ||
            Math.abs(last[1] - riderLng) > 0.00015;
          if (moved) {
            lastRiderFocusRef.current = [riderLat, riderLng];
            map.flyTo({
              center: [riderLng, riderLat],
              zoom: 16,
              duration: 800,
            });
          }
        }
      } else if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
      }

      // --- Первичное позиционирование камеры (один раз) ---
      if (!boundsFittedRef.current) {
        boundsFittedRef.current = true;
        const points: [number, number][] = [[deliveryLng, deliveryLat]];
        if (pickupLat != null && pickupLng != null) {
          points.push([pickupLng, pickupLat]);
        }
        if (riderLat != null && riderLng != null) {
          points.push([riderLng, riderLat]);
        }
        if (points.length === 1) {
          map.jumpTo({ center: points[0], zoom: 15 });
        } else {
          const bounds = points.reduce(
            (b, p) => b.extend(p),
            new maplibregl.LngLatBounds(points[0], points[0]),
          );
          map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
        }
      }
    };

    if (map.isStyleLoaded() && map.getSource(ROUTE_SOURCE_ID)) {
      run();
    } else {
      map.once("load", run);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Бейдж стоимости доставки (top-right) */}
      {typeof deliveryPrice === "number" && (
        <div className="absolute top-3 right-3 bg-soft-accent-soft border border-soft-accent/30 rounded-2xl px-3 py-2 shadow-soft-sm z-10">
          <div className="text-2xs text-soft-accent font-bold uppercase tracking-wider">
            Доставка
          </div>
          <div className="text-base font-extrabold text-soft-accent">
            {deliveryPrice} сом
          </div>
        </div>
      )}

      {/* Бейдж ETA (bottom-left) */}
      {typeof etaMin === "number" && etaMin > 0 && (
        <div className="absolute bottom-3 left-3 bg-soft-success-soft border border-soft-success/30 rounded-2xl px-3 py-2 shadow-soft-sm z-10">
          <div className="text-2xs text-soft-success-dark font-bold uppercase tracking-wider">
            ETA
          </div>
          <div className="text-base font-extrabold text-soft-success-dark">
            ~{Math.round(etaMin)} мин
          </div>
        </div>
      )}
    </div>
  );
}
