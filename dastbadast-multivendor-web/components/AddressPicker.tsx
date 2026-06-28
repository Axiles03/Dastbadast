'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { isInDeliveryZone } from '@/lib/zone';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({
  onPick,
  zonePolygon,
}: {
  onPick: (lat: number, lng: number, inZone: boolean) => void;
  zonePolygon?: number[][] | null;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const inZone = isInDeliveryZone(lng, lat, zonePolygon);
      onPick(lat, lng, inZone);
    },
  });
  return null;
}

function MapCenterSync({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
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
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<[number, number]>([center.lat, center.lng]);
  const [outOfZone, setOutOfZone] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPosition([center.lat, center.lng]);
    if (zonePolygon?.length) {
      setOutOfZone(!isInDeliveryZone(center.lng, center.lat, zonePolygon));
    }
  }, [center.lat, center.lng, zonePolygon]);

  const handlePick = (lat: number, lng: number, inZone = true) => {
    setPosition([lat, lng]);
    setOutOfZone(!inZone);
    onPick(lat, lng, inZone);
  };

  const zoneLatLngs =
    zonePolygon?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];

  if (!mounted) {
    return (
      <div
        className="rounded-2xl overflow-hidden border border-dbd-border bg-dbd-card flex items-center justify-center text-sm text-dbd-muted"
        style={{ height: 300 }}
      >
        Загрузка карты…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl overflow-hidden border border-dbd-border leaflet-map-wrap" style={{ height: 320 }}>
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {zoneLatLngs.length > 0 && (
            <Polygon
              positions={zoneLatLngs}
              pathOptions={{
                color: '#EA7369',
                fillColor: '#EA7369',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          )}
          <Marker position={position} icon={markerIcon} />
          <MapClickHandler onPick={handlePick} zonePolygon={zonePolygon} />
          <MapCenterSync center={position} />
        </MapContainer>
      </div>
      {outOfZone ? (
        <p className="text-sm text-red-400">
          Точка вне зоны доставки. Переместите маркер внутрь оранжевой области.
        </p>
      ) : (
        <p className="text-xs text-dbd-muted">
          Оранжевая область — зона доставки. Кликните по карте или используйте «Моё местоположение».
        </p>
      )}
    </div>
  );
}
