// dastbadast-multivendor-web/components/AddressPicker.tsx
//
// ⭐⭐⭐ ПЕРЕПИСАНО НА MAPLIBRE GL вместо react-leaflet.
// Тот же публичный интерфейс (center / zonePolygon / onPick), чтобы
// вызывающий код (app/(main)/address/page.tsx) не менять.
//
// Зона доставки рисуется как fill+outline layer поверх GeoJSON-полигона —
// обновляется через source.setData(...), без пересоздания слоя.
// Маркер — перетаскиваемый (drag), плюс клик по карте тоже переставляет точку.

"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { isInDeliveryZone } from "@/lib/zone";
import { MAP_STYLE_URL } from "@/lib/map-providers";

const ZONE_SOURCE_ID = "addr-zone";
const ZONE_FILL_LAYER_ID = "addr-zone-fill";
const ZONE_LINE_LAYER_ID = "addr-zone-line";

function markerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.fontSize = "34px";
  el.style.lineHeight = "1";
  el.style.cursor = "grab";
  el.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.35))";
  el.textContent = "📍";
  return el;
}

function zoneFeature(zonePolygon?: number[][] | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      // zonePolygon приходит как [[lng, lat], ...] — уже в порядке MapLibre.
      coordinates: zonePolygon?.length ? [zonePolygon] : [],
    },
  };
}

export function AddressPicker({
  center,
  zonePolygon,
  onPick,
}: {
  center: { lat: number; lng: number };
  zonePolygon?: number[][] | null;
  onPick: (lat: number, lng: number, inZone?: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const zonePolygonRef = useRef(zonePolygon);
  const [mounted, setMounted] = useState(false);
  const [outOfZone, setOutOfZone] = useState(false);

  zonePolygonRef.current = zonePolygon;

  const applyPick = (lat: number, lng: number) => {
    const inZone = isInDeliveryZone(lng, lat, zonePolygonRef.current);
    setOutOfZone(!inZone);
    onPick(lat, lng, inZone);
  };

  // ⭐ Инициализация карты — один раз.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 13,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    mapRef.current = map;

    const marker = new maplibregl.Marker({
      element: markerEl(),
      anchor: "bottom",
      draggable: true,
    })
      .setLngLat([center.lng, center.lat])
      .addTo(map);
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      applyPick(lat, lng);
    });
    markerRef.current = marker;

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      applyPick(e.lngLat.lat, e.lngLat.lng);
    });

    map.on("load", () => {
      map.addSource(ZONE_SOURCE_ID, {
        type: "geojson",
        data: zoneFeature(zonePolygonRef.current),
      });
      map.addLayer({
        id: ZONE_FILL_LAYER_ID,
        type: "fill",
        source: ZONE_SOURCE_ID,
        paint: { "fill-color": "#EA7369", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: ZONE_LINE_LAYER_ID,
        type: "line",
        source: ZONE_SOURCE_ID,
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#EA7369",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      setOutOfZone(
        !isInDeliveryZone(center.lng, center.lat, zonePolygonRef.current),
      );
      setMounted(true);
    });

    return () => {
      marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMounted(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⭐ Внешний center поменялся (например, выбрали адрес из поиска) — двигаем карту и маркер.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([center.lng, center.lat]);
    map.easeTo({ center: [center.lng, center.lat], duration: 400 });
    setOutOfZone(
      !isInDeliveryZone(center.lng, center.lat, zonePolygonRef.current),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  // ⭐ Полигон зоны поменялся — обновляем source без пересоздания слоя.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(ZONE_SOURCE_ID)) return;
    (map.getSource(ZONE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(
      zoneFeature(zonePolygon),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonePolygon]);

  return (
    <div className="space-y-2">
      <div
        className="rounded-2xl overflow-hidden border border-dbd-border relative"
        style={{ height: 320 }}
      >
        <div ref={containerRef} className="w-full h-full" />
        {!mounted && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-dbd-muted bg-dbd-card">
            Загрузка карты…
          </div>
        )}
      </div>
      {outOfZone ? (
        <p className="text-sm text-red-400">
          Точка вне зоны доставки. Переместите маркер внутрь оранжевой области.
        </p>
      ) : (
        <p className="text-xs text-dbd-muted">
          Оранжевая область — зона доставки. Кликните по карте, перетащите
          маркер или используйте «Моё местоположение».
        </p>
      )}
    </div>
  );
}
