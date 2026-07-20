// dastbadast-multivendor-rider/components/MapTabContent.tsx
//
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
// ⭐ ШАГ 3: импортируем НОВЫЙ MapView (на WebView), а не react-native-maps
import {
  MapLibreOrdersMap,
  type MapLibreOrdersMapHandle,
} from "./MapLibreOrdersMap";
import { OrderBottomSheet } from "./OrderBottomSheet";
import { extractLatLng, fetchRoadRoute, type RoutePoint } from "../lib/routing";
import { cn } from "../lib/cn";
import { getCurrentDeviceLocation } from "../lib/gps";
import type { Order, OrderAddress } from "./OrderCard";
// ⭐ ФИКС: убран `import dotenv from "dotenv"` — это Node.js-пакет
// (использует `fs`), которого нет в React Native рантайме; он тут даже не
// вызывался (`dotenv.config()` нигде нет), просто мёртвый импорт, лишний
// риск для сборки Metro.

type Props = {
  available: boolean;
  onTab: (tab: "pool" | "mine") => void;
  pool: Order[];
  myOrders: Order[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onClaim: (orderId: string) => void | Promise<void>;
  onDecline: (orderId: string, reason?: string) => void | Promise<void>;
  onPickUp: (orderId: string) => void | Promise<void>;
  onDeliver: (orderId: string) => void | Promise<void>;
  onOpenChat: (orderId: string) => void;
  riderPos: {
    latitude: number;
    longitude: number;
    bearing?: number | null;
  } | null;
};

export function MapTabContent(props: Props) {
  // ⭐ ФИКС: `GEOAPIFY_TILES_KEY` был объявлен, но никуда не передавался —
  // остаток старой Geoapify/raster-реализации карты. Текущая карта
  // (MapLibreOrdersMap) использует OpenFreeMap и не требует никакого ключа.
  const {
    available,
    onTab,
    pool,
    myOrders,
    selectedId,
    setSelectedId,
    onClaim,
    onPickUp,
    onDeliver,
    onOpenChat,
    onDecline,
    riderPos,
  } = props;

  const allOrders = useMemo(() => [...myOrders, ...pool], [myOrders, pool]);

  // ⭐ ШАГ 5: "активная доставка" — заказ, который курьер сейчас везёт
  // (едет в ресторан или уже везёт клиенту). Именно для неё включаем
  // режим камеры "следовать за курьером" + реальный маршрут по дорогам.
  const activeDelivery = useMemo(
    () =>
      myOrders.find(
        (o) => o.orderStatus === "ASSIGNED" || o.orderStatus === "PICKED",
      ) ?? null,
    [myOrders],
  );

  // ⭐ ШАГ 5: цель текущего "плеча" маршрута — ресторан, пока не забрал
  // заказ (ASSIGNED), или клиент, если уже везёт (PICKED).
  const activeLegTarget: OrderAddress | null = activeDelivery
    ? activeDelivery.orderStatus === "PICKED"
      ? (activeDelivery.deliveryAddress ?? null)
      : (activeDelivery.pickupAddress ?? null)
    : null;

  // Ручной тумблер: курьер может временно выключить "следование", чтобы
  // осмотреть карту целиком (например свайпнуть в сторону, посмотреть
  // другие заказы в пуле), не теряя автоматическое включение при новой
  // активной доставке.
  const [followManuallyDisabled, setFollowManuallyDisabled] = useState(false);
  const followRider = !!activeDelivery && !followManuallyDisabled;

  // При появлении новой активной доставки (или её завершении) сбрасываем
  // ручной оффнутый тумблер, чтобы follow снова включался по умолчанию.
  useEffect(() => {
    setFollowManuallyDisabled(false);
  }, [activeDelivery?.id]);

  // ⭐ ШАГ 5: реальный маршрут по дорогам (OSRM) для активного плеча —
  // курьер → цель (ресторан/клиент). Перезапрашиваем при заметном сдвиге
  // позиции курьера (не на каждый GPS-тик — OSRM бесплатный демо-сервер,
  // не хотим его спамить/упереться в rate limit).
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);
  const lastRouteFetchRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!activeLegTarget || !riderPos) {
      setRoutePoints(null);
      lastRouteFetchRef.current = null;
      return;
    }
    const targetPoint = extractLatLng(activeLegTarget);
    if (!targetPoint) {
      setRoutePoints(null);
      return;
    }

    const last = lastRouteFetchRef.current;
    const movedEnoughM = last
      ? Math.hypot(
          (riderPos.latitude - last.lat) * 111_000,
          (riderPos.longitude - last.lng) *
            111_000 *
            Math.cos((riderPos.latitude * Math.PI) / 180),
        )
      : Infinity;

    // Перезапрашиваем маршрут не чаще, чем раз в ~30м смещения курьера —
    // достаточно для плавной линии, но не заваливает OSRM запросами.
    if (movedEnoughM < 30) return;

    let cancelled = false;
    lastRouteFetchRef.current = {
      lat: riderPos.latitude,
      lng: riderPos.longitude,
    };
    fetchRoadRoute([riderPos.latitude, riderPos.longitude], targetPoint).then(
      (route) => {
        if (cancelled) return;
        if (route) setRoutePoints(route.points);
        // если OSRM недоступен — оставляем предыдущий routePoints (не мигаем
        // прямой линией туда-обратно); MapLibreOrdersMap сам умеет упасть на
        // прямую линию, если routePoints вообще ещё не пришли.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    activeLegTarget?.location?.coordinates?.[0],
    activeLegTarget?.location?.coordinates?.[1],
    riderPos?.latitude,
    riderPos?.longitude,
  ]);

  const markers = useMemo(() => {
    const out: Array<{
      id: string;
      kind: "restaurant" | "customer" | "urgent";
      coordinate: { latitude: number; longitude: number };
      label?: string;
      active?: boolean;
      onPress?: () => void;
    }> = [];
    for (const o of allOrders) {
      const rest = extractLatLng(o.pickupAddress);
      if (rest) {
        out.push({
          id: `${o.id}-rest`,
          kind: "restaurant",
          coordinate: { latitude: rest[0], longitude: rest[1] },
          label: o.pickupAddress?.name || "Ресторан",
          active: selectedId === o.id,
        });
      }
      const cust = extractLatLng(o.deliveryAddress);
      if (cust) {
        out.push({
          id: `${o.id}-cust`,
          kind: "customer",
          coordinate: { latitude: cust[0], longitude: cust[1] },
          label: o.deliveryAddress?.city || "Клиент",
          active: selectedId === o.id,
          onPress: () => setSelectedId(o.id),
        });
      }
    }
    return out;
  }, [allOrders, selectedId, setSelectedId]);

  const focused = selectedId
    ? (allOrders.find((o) => o.id === selectedId) ?? null)
    : null;

  // ⭐⭐⭐ Кнопка "Моё местоположение": запрашивает текущую GPS-точку
  // устройства напрямую (не дожидаясь серверного broadcast/подписки)
  // и центрирует карту на ней.
  const mapRef = useRef<MapLibreOrdersMapHandle>(null);
  const [locating, setLocating] = useState(false);

  const onLocateMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await getCurrentDeviceLocation();
      if (pos) {
        mapRef.current?.flyTo(pos.lat, pos.lng, 16);
      } else if (riderPos) {
        // Фолбэк: последняя известная позиция из подписки, если свежий
        // GPS-запрос не удался (permission denied и т.п.)
        mapRef.current?.flyTo(riderPos.latitude, riderPos.longitude, 16);
      }
    } finally {
      setLocating(false);
    }
  }, [locating, riderPos]);

  return (
    <View className="flex-1 bg-soft-bg relative">
      <MapLibreOrdersMap
        ref={mapRef}
        markers={markers}
        rider={riderPos}
        pickupGeo={focused?.pickupAddress ?? null}
        deliveryGeo={focused?.deliveryAddress ?? null}
        autoFit
        routePoints={followRider ? routePoints : null}
        followRider={followRider}
      />

      {/* ⭐ ШАГ 5: тумблер "Следовать/Обзор" — виден только когда есть активная
          доставка (иначе нечему следовать, обычный autoFit и так работает). */}
      {activeDelivery && (
        <Pressable
          onPress={() => setFollowManuallyDisabled((v) => !v)}
          className="absolute left-3 bottom-52 bg-soft-surface border border-border rounded-full px-3 h-10 items-center justify-center shadow-soft-md active:opacity-80 flex-row gap-1.5"
        >
          <Text className="text-base">{followRider ? "🧭" : "🗺"}</Text>
          <Text className="text-xs font-extrabold text-text">
            {followRider ? "Слежу" : "Обзор"}
          </Text>
        </Pressable>
      )}

      {/* ⭐ Кнопка "Моё местоположение" — плавающая, справа над переключателями вкладок */}
      <Pressable
        onPress={onLocateMe}
        disabled={locating}
        className="absolute right-3 bottom-52 w-12 h-12 bg-soft-surface border border-border rounded-full items-center justify-center shadow-soft-md active:opacity-80"
      >
        {locating ? (
          <ActivityIndicator color="#F26A4A" size="small" />
        ) : (
          <Text className="text-xl">📍</Text>
        )}
      </Pressable>

      <View className="absolute left-3 right-3 bottom-36 flex-row gap-2">
        <Pressable
          onPress={() => onTab("pool")}
          className="flex-1 bg-accent-soft border border-accent/30 rounded-2xl p-3 shadow-soft-sm flex-row items-center gap-2 active:scale-95"
        >
          <Text className="text-lg">🛒</Text>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-extrabold text-accent-dark">
              Доступные
            </Text>
            <Text className="text-2xs text-text-soft">
              Нажмите чтобы открыть
            </Text>
          </View>
          <View className="bg-accent min-w-[28px] h-7 rounded-full items-center justify-center px-2">
            <Text className="text-text-inverse font-extrabold text-sm">
              {pool.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => onTab("mine")}
          className="flex-1 bg-info-soft border border-info/30 rounded-2xl p-3 shadow-soft-sm flex-row items-center gap-2 active:scale-95"
        >
          <Text className="text-lg">🛵</Text>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-extrabold text-info-dark">Мои</Text>
            <Text className="text-2xs text-text-soft">Активные доставки</Text>
          </View>
          <View className="bg-info min-w-[28px] h-7 rounded-full items-center justify-center px-2">
            <Text className="text-text-inverse font-extrabold text-sm">
              {myOrders.length}
            </Text>
          </View>
        </Pressable>
      </View>

      <OrderBottomSheet
        selectedId={selectedId}
        orders={allOrders}
        online={props.available}
        onClose={() => setSelectedId(null)}
        onClaim={onClaim}
        onPickUp={onPickUp}
        onDeliver={onDeliver}
        onOpenChat={onOpenChat}
        onDecline={onDecline}
      />
    </View>
  );
}
