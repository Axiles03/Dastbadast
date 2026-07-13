"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X, MapPin, Pencil } from "lucide-react";

type ZoneRing = number[][]; // [[lng, lat], ...]
type Zone = { id: string; name: string; isActive: boolean; ring: ZoneRing };

const DRAFT_COLOR = "#F26A4A"; // soft-accent
const ACTIVE_COLOR = "#16A34A"; // soft-success
const INACTIVE_COLOR = "#92929D"; // soft-text-muted

const DUSHANBE: [number, number] = [68.787, 38.5598]; // [lng, lat]

const EXISTING_SRC = "zones-existing";
const EXISTING_FILL_LAYER = "zones-existing-fill";
const EXISTING_LINE_LAYER = "zones-existing-line";
const DRAFT_SRC = "zones-draft";
const DRAFT_FILL_LAYER = "zones-draft-fill";
const DRAFT_LINE_LAYER = "zones-draft-line";

// Замыкаем кольцо для валидного GeoJSON-полигона (первая точка == последняя)
function closeRing(ring: ZoneRing): ZoneRing {
  if (ring.length < 3) return ring;
  const [flng, flat] = ring[0];
  const [llng, llat] = ring[ring.length - 1];
  if (flng === llng && flat === llat) return ring;
  return [...ring, ring[0]];
}

function existingZonesToGeoJSON(zones: Zone[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones
      .filter((z) => z.ring.length >= 3)
      .map((z) => ({
        type: "Feature",
        properties: { id: z.id, name: z.name, isActive: z.isActive },
        geometry: {
          type: "Polygon",
          coordinates: [closeRing(z.ring)],
        },
      })),
  };
}

function draftToGeoJSON(ring: ZoneRing): GeoJSON.FeatureCollection {
  if (ring.length < 3) {
    // Меньше 3 точек — полигон невалиден, рисуем линию отдельно (см. ниже)
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [closeRing(ring)] },
      },
    ],
  };
}

export function ZoneEditorMap({
  zones,
  draftPolygon,
  isDrawing,
  onPolygonChange,
}: {
  zones: Zone[];
  draftPolygon: ZoneRing;
  isDrawing: boolean;
  onPolygonChange: (ring: ZoneRing) => void;
}) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mounted, setMounted] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // refs для колбэков внутри обработчиков событий карты
  const isDrawingRef = useRef(isDrawing);
  const draftPolygonRef = useRef(draftPolygon);
  const onPolygonChangeRef = useRef(onPolygonChange);
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);
  useEffect(() => {
    draftPolygonRef.current = draftPolygon;
  }, [draftPolygon]);
  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  // ──────── Инициализация карты ────────
  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

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

    map.on("click", (e) => {
      if (!isDrawingRef.current) return;
      const newRing: ZoneRing = [
        ...draftPolygonRef.current,
        [e.lngLat.lng, e.lngLat.lat],
      ];
      onPolygonChangeRef.current(newRing);
    });

    map.on("load", () => {
      map.addSource(EXISTING_SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: EXISTING_FILL_LAYER,
        type: "fill",
        source: EXISTING_SRC,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "isActive"], true],
            ACTIVE_COLOR,
            INACTIVE_COLOR,
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "isActive"], true],
            0.12,
            0.05,
          ],
        },
      });
      map.addLayer({
        id: EXISTING_LINE_LAYER,
        type: "line",
        source: EXISTING_SRC,
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "isActive"], true],
            ACTIVE_COLOR,
            INACTIVE_COLOR,
          ],
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });

      map.addSource(DRAFT_SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: DRAFT_FILL_LAYER,
        type: "fill",
        source: DRAFT_SRC,
        paint: { "fill-color": DRAFT_COLOR, "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: DRAFT_LINE_LAYER,
        type: "line",
        source: DRAFT_SRC,
        paint: {
          "line-color": DRAFT_COLOR,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      // Курсор-подсказка и попап с названием при наведении на существующую зону
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });
      map.on("mouseenter", EXISTING_FILL_LAYER, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const name = (f.properties as any)?.name ?? "";
        popup.setLngLat(e.lngLat).setText(name).addTo(map);
      });
      map.on("mousemove", EXISTING_FILL_LAYER, (e) => {
        popup.setLngLat(e.lngLat);
      });
      map.on("mouseleave", EXISTING_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      setStyleLoaded(true);
    });

    mapRef.current = map;

    return () => {
      draftMarkersRef.current.forEach((m) => m.remove());
      draftMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setStyleLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ──────── Существующие зоны ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(EXISTING_SRC) as maplibregl.GeoJSONSource;
    if (!src) return;
    src.setData(existingZonesToGeoJSON(zones));
  }, [zones, styleLoaded]);

  // ──────── Драфт: полигон/линия ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(DRAFT_SRC) as maplibregl.GeoJSONSource;
    if (!src) return;
    src.setData(draftToGeoJSON(draftPolygon));
  }, [draftPolygon, styleLoaded]);

  // ──────── Драфт: маркеры точек ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    draftMarkersRef.current.forEach((m) => m.remove());
    draftMarkersRef.current = [];

    draftPolygon.forEach(([lng, lat], idx) => {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = DRAFT_COLOR;
      el.style.border = "2px solid #fff";
      el.style.boxShadow = `0 0 0 1px ${DRAFT_COLOR}`;
      el.style.cursor = "pointer";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const newRing = draftPolygonRef.current.filter((_, i) => i !== idx);
        onPolygonChangeRef.current(newRing);
      });

      draftMarkersRef.current.push(marker);
    });
  }, [draftPolygon, styleLoaded]);

  // ──────── Подгоняем viewport под драфт ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded || draftPolygon.length < 2) return;
    const bounds = draftPolygon.reduce(
      (b, [lng, lat]) => b.extend([lng, lat]),
      new maplibregl.LngLatBounds(
        draftPolygon[0] as [number, number],
        draftPolygon[0] as [number, number],
      ),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPolygon.length > 0, styleLoaded]);

  if (!mounted) {
    return <div className="w-full h-full bg-soft-surface-2 rounded-2xl" />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isDrawing && (
        <div className="absolute top-3 left-3 z-[400] bg-soft-surface/95 backdrop-blur-sm border border-soft-accent/30 rounded-2xl px-3 py-2 text-xs font-semibold text-soft-text shadow-soft-sm flex items-center gap-2 max-w-[280px]">
          <Pencil className="w-3.5 h-3.5 text-soft-accent shrink-0" />
          <span>
            <strong className="text-soft-accent">Кликайте по карте</strong> для
            добавления точек. Клик по точке — удаление.
          </span>
        </div>
      )}
      {!isDrawing && zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-soft-surface/90 backdrop-blur-sm border border-soft-border rounded-2xl px-4 py-3 text-sm text-soft-text-soft text-center shadow-soft-sm max-w-xs">
            <MapPin className="w-5 h-5 text-soft-text-muted mx-auto mb-1" />
            Зон пока нет. Нажмите «Новая зона» справа.
          </div>
        </div>
      )}
    </div>
  );
}
