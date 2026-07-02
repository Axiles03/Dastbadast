// dastbadast-multivendor-web/components/OrderTrackingMap.tsx
"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const riderIcon = (bearing: number | null | undefined) =>
  L.divIcon({
    html: `<div style="position:relative;width:38px;height:38px;transform:translate(-50%,-50%)">
      <div style="position:absolute;inset:0;background:#F26A4A;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:20px">
        🚴
      </div>
      ${
        bearing != null
          ? `<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%) rotate(${bearing}deg);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #DC5635"></div>`
          : ""
      }
    </div>`,
    className: "rider-icon",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
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

/**
 * Плавно центрирует карту на курьере при его движении.
 * Первый fitBounds — на все точки, далее — flyTo на курьера.
 */
function CameraController({
  points,
  riderPos,
  focusRider,
}: {
  points: [number, number][];
  riderPos: [number, number] | null;
  focusRider?: boolean;
}) {
  const map = useMap();
  const lastFocus = useRef<[number, number] | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (points.length === 0) return;

    if (!initialized.current) {
      initialized.current = true;
      if (points.length === 1) {
        map.setView(points[0], 15);
      } else {
        const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
      return;
    }

    // После инициализации — плавно следим за курьером
    if (focusRider && riderPos) {
      const last = lastFocus.current;
      const moved =
        !last ||
        Math.abs(last[0] - riderPos[0]) > 0.00015 || // ~17 м
        Math.abs(last[1] - riderPos[1]) > 0.00015;
      if (moved) {
        lastFocus.current = riderPos;
        map.flyTo([riderPos[1], riderPos[0]], 16, {
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [points, riderPos, focusRider, map]);

  return null;
}

export function OrderTrackingMap({
  deliveryLat,
  deliveryLng,
  pickupLat,
  pickupLng,
  riderLat,
  riderLng,
  riderBearing,
}: {
  deliveryLat: number;
  deliveryLng: number;
  pickupLat: number | null;
  pickupLng: number | null;
  riderLat: number | null;
  riderLng: number | null;
  riderBearing?: number | null;
}) {
  const points: [number, number][] = [[deliveryLat, deliveryLng]];
  if (pickupLat != null && pickupLng != null)
    points.push([pickupLat, pickupLng]);
  const riderPos: [number, number] | null =
    riderLat != null && riderLng != null ? [riderLat, riderLng] : null;
  if (riderPos) points.push(riderPos);

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
      {riderPos && (
        <Marker
          position={[riderPos[1], riderPos[0]]}
          icon={riderIcon(riderBearing)}
        >
          <Popup>Курьер здесь</Popup>
        </Marker>
      )}
      <CameraController
        points={points}
        riderPos={riderPos}
        focusRider={riderPos != null}
      />
    </MapContainer>
  );
}
