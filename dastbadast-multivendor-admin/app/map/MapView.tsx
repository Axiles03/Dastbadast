"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type AnyRider = {
  id: string;
  username: string;
  name?: string;
  lat: number | null;
  lng: number | null;
  available: boolean;
  isActive?: boolean;
  bearing?: number | null;
  liveAt?: string | null;
};

type AnyOrder = {
  id: string;
  orderId: string;
  orderStatus: string;
  pickupAddress?: {
    name?: string;
    address?: string;
    location?: { coordinates?: number[] } | null;
  };
  deliveryAddress?: {
    address?: string;
    city?: string;
    location?: { coordinates?: number[] } | null;
  };
  riderId?: string;
};

type MapViewHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  riders: AnyRider[];
  orders: AnyOrder[];
  showRiders: boolean;
  showOrders: boolean;
  showRestaurants: boolean;
  selectedRiderId: string | null;
  selectedOrderId: string | null;
  onSelectRider: (id: string) => void;
  onSelectOrder: (id: string) => void;
};

const ROUTE_SOURCE_ID = "order-route";
const DUSHANBE: [number, number] = [68.783, 38.574];

// ═══════════════════════════════════════════════════════════════
// ⭐ OSRM-кеш (модуль-уровень, переживает unmount карты)
// ═══════════════════════════════════════════════════════════════
type RoutePoint = [number, number]; // [lng, lat]
const OSRM_CACHE = new Map<string, { coords: RoutePoint[]; at: number }>();
const OSRM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 мин
const OSRM_TIMEOUT_MS = 5000;

function makeRouteKey(from: RoutePoint, to: RoutePoint): string {
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${r(from[0])},${r(from[1])}__${r(to[0])},${r(to[1])}`;
}

async function fetchOSRMRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[] | null> {
  const key = makeRouteKey(from, to);
  const cached = OSRM_CACHE.get(key);
  if (cached && Date.now() - cached.at < OSRM_CACHE_TTL_MS) {
    return cached.coords;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords: [number, number][] | undefined = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const result: RoutePoint[] = coords.map(([lng, lat]) => [lng, lat]);
    OSRM_CACHE.set(key, { coords: result, at: Date.now() });
    return result;
  } catch {
    return null;
  }
}

async function getRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[]> {
  const fetched = await fetchOSRMRoute(from, to);
  return fetched || [from, to]; // fallback на прямую если OSRM недоступен
}

// ═══════════════════════════════════════════════════════════════

function pickColor(orderStatus: string): string {
  switch (orderStatus) {
    case "PENDING":
      return "#F5A623";
    case "ACCEPTED":
      return "#6E5BFF";
    case "ASSIGNED":
      return "#2D9CDB";
    case "PICKED":
      return "#16A34A";
    case "AWAITING_CONFIRMATION":
      return "#F26A4A";
    default:
      return "#9A9388";
  }
}

function makeRiderEl(rider: AnyRider, isSelected: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "44px";
  el.style.height = "44px";
  el.style.cursor = "pointer";
  el.style.transform = "translate(-50%, -50%)";

  const isOffline = !rider.available || rider.isActive === false;
  const bg = isOffline ? "#9A9388" : "#16A34A";

  el.innerHTML = `
    <div style="position:absolute;inset:0;background:${bg};transform:rotate(45deg);border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:3px solid white;${
      isSelected ? "outline:3px solid #F26A4A;outline-offset:2px;" : ""
    }"></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);font-size:20px;">🛵</div>
  `;
  return el;
}

function makeOrderEl(order: AnyOrder, isSelected: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.cursor = "pointer";
  el.style.transform = "translate(-50%, -50%)";

  const color = pickColor(order.orderStatus);

  el.innerHTML = `
    <div style="position:absolute;inset:0;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:14px;${
      isSelected ? "outline:3px solid #F26A4A;outline-offset:2px;" : ""
    }">
      ${order.orderStatus === "PENDING" ? "?" : ""}
    </div>
  `;
  return el;
}

function makeRestaurantEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.transform = "translate(-50%, -50%)";
  el.style.cursor = "default";
  el.innerHTML = `
    <div style="position:absolute;inset:0;background:white;border-radius:50%;border:2px solid #6E5BFF;box-shadow:0 1px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;">🏪</div>
  `;
  return el;
}

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  {
    riders,
    orders,
    showRiders,
    showOrders,
    showRestaurants,
    selectedRiderId,
    selectedOrderId,
    onSelectRider,
    onSelectOrder,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // ⭐ FIX: были Marker[] (массив), но вызывались методы Map (.set, .get, .delete).
  // Это и было причиной TypeError. Теперь правильно — Map.
  const riderMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const orderMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const restaurantMarkersRef = useRef<Map<string, maplibregl.Marker>>(
    new Map(),
  );

  // ⭐ NEW: кеш реальных OSRM-маршрутов { [orderId]: [lng, lat][] }
  const [routeData, setRouteData] = useState<Record<string, RoutePoint[]>>({});

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat, lng, zoom = 15) => {
        if (!mapRef.current) return;
        mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 800 });
      },
    }),
    [],
  );

  // ──────── Инициализация карты ────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: DUSHANBE,
      zoom: 12,
      attributionControl: { compact: true },
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
          data: { type: "FeatureCollection", features: [] },
        });
        // ⭐ FIX: убрана dasharray (была пунктирная), теперь линия сплошная.
        // Толщина и прозрачность зависят от свойства `selected` в feature —
        // выбранный заказ выделяется ярче и толще.
        map.addLayer({
          id: `${ROUTE_SOURCE_ID}-line`,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: {
            "line-color": "#F26A4A",
            "line-width": ["case", ["==", ["get", "selected"], true], 4.5, 2.5],
            "line-opacity": [
              "case",
              ["==", ["get", "selected"], true],
              0.95,
              0.5,
            ],
          },
        });
      }
    });

    return () => {
      riderMarkersRef.current.forEach((m) => m.remove());
      orderMarkersRef.current.forEach((m) => m.remove());
      restaurantMarkersRef.current.forEach((m) => m.remove());
      riderMarkersRef.current.clear();
      orderMarkersRef.current.clear();
      restaurantMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ──────── ⭐ NEW: загружаем OSRM-маршруты для всех заказов ────────
  // Последовательно, чтобы не нагружать OSRM. Кеш модуль-уровня
  // (5 мин TTL) — повторный показ тех же маршрутов мгновенный.
  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      for (const o of orders) {
        if (cancelled) return;

        const pickup = o.pickupAddress?.location?.coordinates;
        const dest = o.deliveryAddress?.location?.coordinates;
        if (!Array.isArray(pickup) || pickup.length !== 2) continue;
        if (!Array.isArray(dest) || dest.length !== 2) continue;

        const route = await getRoute(
          [pickup[0], pickup[1]],
          [dest[0], dest[1]],
        );
        if (cancelled) return;

        setRouteData((prev) => ({ ...prev, [o.id]: route }));
      }
    }

    loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  // ──────── Маркеры курьеров ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    riders.forEach((rider) => {
      seen.add(rider.id); // ⭐ FIX: было rider._id

      if (rider.lat == null || rider.lng == null) {
        const existing = riderMarkersRef.current.get(rider.id);
        if (existing) {
          existing.remove();
          riderMarkersRef.current.delete(rider.id);
        }
        return;
      }

      const isSelected = selectedRiderId === rider.id; // ⭐ FIX
      const existing = riderMarkersRef.current.get(rider.id);
      if (existing) {
        existing.setLngLat([rider.lng, rider.lat]);
        const el = existing.getElement();
        el.replaceWith(makeRiderEl(rider, isSelected));
      } else {
        const newMarker = new maplibregl.Marker({
          element: makeRiderEl(rider, isSelected),
          anchor: "center",
        })
          .setLngLat([rider.lng, rider.lat])
          .addTo(map);
        newMarker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRider?.(rider.id); // ⭐ FIX: было rider._id
        });
        riderMarkersRef.current.set(rider.id, newMarker); // ⭐ FIX
      }
    });

    riderMarkersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        riderMarkersRef.current.delete(id);
      }
    });
  }, [riders, selectedRiderId, onSelectRider]);

  // ──────── Маркеры заказов + линии маршрутов (ОБЪЕДИНЕНО) ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      const seen = new Set<string>();
      const routeFeatures: any[] = [];

      orders.forEach((o) => {
        seen.add(o.id); // ⭐ FIX: было o._id
        const dest = o.deliveryAddress?.location?.coordinates;
        if (Array.isArray(dest) && dest.length === 2) {
          const isSelected = selectedOrderId === o.id; // ⭐ FIX

          // ⭐ Marker (с click handler)
          const existing = orderMarkersRef.current.get(o.id);
          if (existing) {
            existing.setLngLat([dest[0], dest[1]]);
            const el = existing.getElement();
            el.replaceWith(makeOrderEl(o, isSelected));
          } else {
            const newMarker = new maplibregl.Marker({
              element: makeOrderEl(o, isSelected),
              anchor: "center",
            })
              .setLngLat([dest[0], dest[1]])
              .addTo(map);
            newMarker.getElement().addEventListener("click", (e) => {
              e.stopPropagation();
              onSelectOrder?.(o.id); // ⭐ FIX: было o._id
            });
            orderMarkersRef.current.set(o.id, newMarker); // ⭐ FIX
          }

          // ⭐ Route feature: используем OSRM-геометрию или fallback на прямую
          const pickup = o.pickupAddress?.location?.coordinates;
          if (Array.isArray(pickup) && pickup.length === 2) {
            const routeCoords =
              routeData[o.id] ||
              ([
                [pickup[0], pickup[1]],
                [dest[0], dest[1]],
              ] as RoutePoint[]);
            routeFeatures.push({
              type: "Feature",
              properties: {
                orderId: o.id, // ⭐ FIX: было o._id
                selected: isSelected, // ⭐ NEW: для подсветки в paint
              },
              geometry: {
                type: "LineString",
                coordinates: routeCoords,
              },
            });
          }
        } else {
          const existing = orderMarkersRef.current.get(o.id);
          if (existing) {
            existing.remove();
            orderMarkersRef.current.delete(o.id);
          }
        }
      });

      orderMarkersRef.current.forEach((marker, id) => {
        if (!seen.has(id)) {
          marker.remove();
          orderMarkersRef.current.delete(id);
        }
      });

      // ⭐ Обновляем source с фичами маршрутов
      const source = map.getSource(ROUTE_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: routeFeatures,
      });
    };

    if (map.isStyleLoaded() && map.getSource(ROUTE_SOURCE_ID)) {
      run();
    } else {
      map.once("load", run);
    }
  }, [orders, selectedOrderId, routeData, onSelectOrder]);

  // ──────── Маркеры ресторанов ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seenRests = new Set<string>();

    orders.forEach((o) => {
      const coords = o.pickupAddress?.location?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
        seenRests.add(key);
        const existing = restaurantMarkersRef.current.get(key);
        if (existing) {
          existing.setLngLat([coords[0], coords[1]]);
        } else {
          const newMarker = new maplibregl.Marker({
            element: makeRestaurantEl(),
            anchor: "center",
          })
            .setLngLat([coords[0], coords[1]])
            .addTo(map);
          restaurantMarkersRef.current.set(key, newMarker);
        }
      }
    });

    restaurantMarkersRef.current.forEach((marker, key) => {
      if (!seenRests.has(key)) {
        marker.remove();
        restaurantMarkersRef.current.delete(key);
      }
    });
  }, [orders]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});
