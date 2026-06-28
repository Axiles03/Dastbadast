"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Иконка курьера — мопед 🚴 как emoji внутри divIcon
const riderIcon = L.divIcon({
  html: `<div style="font-size:34px;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))">🚴</div>`,
  className: "rider-icon",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#EA7369;border:3px solid #fff;box-shadow:0 0 0 3px rgba(234,115,105,0.3);transform:translate(-50%,-50%)"></div>`,
  className: "dest-icon",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pickupIcon = L.divIcon({
  html: `<div style="font-size:24px;transform:translate(-50%,-50%)">🏪</div>`,
  className: "pickup-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/** Плавно подгоняет границы карты, когда меняется набор точек. */
function FitBounds({
  points,
  focusRider,
}: {
  points: [number, number][];
  focusRider?: boolean;
}) {
  const map = useMap();
  const prevKey = useRef("");
  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map((p) => p.join(",")).join("|");
    if (key === prevKey.current) {
      // Если только rider-маркер обновился — flyTo к нему для плавности
      if (focusRider) {
        const last = points[points.length - 1];
        map.flyTo(last, Math.max(map.getZoom(), 15), {
          animate: true,
          duration: 1.2,
        });
      }
      return;
    }
    prevKey.current = key;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map, focusRider]);
  return null;
}

export function OrderTrackingMap({
  deliveryLat,
  deliveryLng,
  pickupLat,
  pickupLng,
  riderLat,
  riderLng,
}: {
  deliveryLat: number;
  deliveryLng: number;
  pickupLat: number | null;
  pickupLng: number | null;
  riderLat: number | null;
  riderLng: number | null;
}) {
  const points: [number, number][] = [[deliveryLat, deliveryLng]];
  if (pickupLat != null && pickupLng != null)
    points.push([pickupLat, pickupLng]);
  if (riderLat != null && riderLng != null) points.push([riderLat, riderLng]);

  return (
    <MapContainer
      center={points[0]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pickupLat != null && pickupLng != null && (
        <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
          <Popup>Ресторан</Popup>
        </Marker>
      )}
      <Marker position={[deliveryLat, deliveryLng]} icon={destIcon}>
        <Popup>Точка доставки</Popup>
      </Marker>
      {riderLat != null && riderLng != null && (
        <Marker position={[riderLat, riderLng]} icon={riderIcon}>
          <Popup>Курьер здесь</Popup>
        </Marker>
      )}
      <FitBounds
        points={points}
        focusRider={riderLat != null && riderLng != null}
      />
    </MapContainer>
  );
}
