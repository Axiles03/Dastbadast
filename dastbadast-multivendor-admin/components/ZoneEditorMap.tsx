"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Pencil } from "lucide-react";
import { GEOAPIFY_TILE_URL, GEOAPIFY_ATTRIBUTION } from "@/lib/map-providers";

type ZoneRing = number[][]; // [[lng, lat], ...]
type Zone = { id: string; name: string; isActive: boolean; ring: ZoneRing };

// Фикс дефолтных иконок Leaflet (не подгружаются через bundler)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DRAFT_COLOR = "#F26A4A"; // soft-accent
const ACTIVE_COLOR = "#16A34A"; // soft-success
const INACTIVE_COLOR = "#92929D"; // soft-text-muted

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
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftLayerRef = useRef<L.Polyline | null>(null);
  const draftMarkersRef = useRef<L.Marker[]>([]);
  const existingLayersRef = useRef<L.Polygon[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [38.5598, 68.787], // Душанбе
      zoom: 12,
      scrollWheelZoom: true,
    });

    L.tileLayer(GEOAPIFY_TILE_URL, {
      attribution: GEOAPIFY_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    // Клик по карте — добавляем точку в полигон (только в режиме рисования)
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current) return;
      const newRing: ZoneRing = [
        ...draftPolygonRef.current,
        [e.latlng.lng, e.latlng.lat],
      ];
      onPolygonChangeRef.current(newRing);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // refs для callback'ов внутри useEffect
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

  // Рисуем существующие зоны
  useEffect(() => {
    if (!mapRef.current) return;
    existingLayersRef.current.forEach((l) => mapRef.current!.removeLayer(l));
    existingLayersRef.current = [];

    zones.forEach((z) => {
      if (z.ring.length < 3) return;
      const latlngs = z.ring.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      const color = z.isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
      const poly = L.polygon(latlngs, {
        color,
        fillColor: color,
        fillOpacity: z.isActive ? 0.12 : 0.05,
        weight: 2,
        dashArray: "6 4",
      }).addTo(mapRef.current!);
      poly.bindTooltip(z.name, {
        permanent: false,
        direction: "center",
        className: "leaflet-zone-tooltip",
      });
      existingLayersRef.current.push(poly);
    });
  }, [zones]);

  // Рисуем драфт (точки пользователя)
  useEffect(() => {
    if (!mapRef.current) return;

    // Удаляем старые
    if (draftLayerRef.current) {
      mapRef.current.removeLayer(draftLayerRef.current);
      draftLayerRef.current = null;
    }
    draftMarkersRef.current.forEach((m) => mapRef.current!.removeLayer(m));
    draftMarkersRef.current = [];

    if (draftPolygon.length === 0) return;

    // Линия/полигон
    if (draftPolygon.length >= 2) {
      const latlngs = draftPolygon.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      draftLayerRef.current = L.polygon(latlngs, {
        color: DRAFT_COLOR,
        fillColor: DRAFT_COLOR,
        fillOpacity: 0.2,
        weight: 2,
        dashArray: "4 4",
      }).addTo(mapRef.current) as any;
    }

    // Маркеры для каждой точки
    draftPolygon.forEach(([lng, lat], idx) => {
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${DRAFT_COLOR};border:2px solid #fff;box-shadow:0 0 0 1px ${DRAFT_COLOR};"></div>`,
        className: "leaflet-zone-draft-marker",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([lat, lng], { icon })
        .addTo(mapRef.current!)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          // Удаляем точку
          const newRing = draftPolygonRef.current.filter((_, i) => i !== idx);
          onPolygonChangeRef.current(newRing);
        });
      draftMarkersRef.current.push(marker);
    });
  }, [draftPolygon]);

  // Подгоняем zoom под драфт, когда он меняется
  useEffect(() => {
    if (!mapRef.current || draftPolygon.length < 2) return;
    const latlngs = draftPolygon.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    const bounds = L.latLngBounds(latlngs);
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [draftPolygon.length > 0]);

  if (!mounted) {
    return <div className="w-full h-full bg-soft-surface-2 rounded-2xl" />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Подсказка в углу */}
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
