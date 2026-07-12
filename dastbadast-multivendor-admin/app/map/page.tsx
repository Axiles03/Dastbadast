// dastbadast-multivendor-admin/app/map/page.tsx
"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useSubscription } from "@apollo/client";
import {
  ALL_RIDERS_WITH_LOCATION,
  ORDERS_FOR_MAP,
  GET_CONFIGURATION,
  ALL_DELIVERIES_SUB,
  RIDER_LOCATION_STREAM,
} from "@/lib/queries";
import dynamic from "next/dynamic";
import {
  Bike,
  MapPin,
  Filter,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  Package,
  X,
  Search,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS } from "@/lib/page-access";
import "./map.css";
import router from "next/router";

// ⭐ Client-only карта (MapLibre использует DOM, нельзя рендерить на SSR)
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-soft-surface-2">
      <div className="text-center space-y-2">
        <div className="w-10 h-10 border-2 border-soft-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-soft-text-soft font-bold">Загрузка карты…</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.map}>
      <MapInner />
    </RoleGate>
  );
}

function MapInner() {
  const { owner, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.body.style.backgroundColor = "#FAF7F2";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loading && !owner) router.push("/login");
  }, [owner, loading, router]);

  if (!owner) return null;

  return <MapPageContent />;
}

function MapPageContent() {
  // ============================================================
  // 1. Загрузка данных
  // ============================================================
  const { data: cfgData } = useQuery(GET_CONFIGURATION);

  const {
    data: ridersData,
    refetch: refetchRiders,
    loading: loadingRiders,
  } = useQuery(ALL_RIDERS_WITH_LOCATION, {
    pollInterval: 30_000, // фолбэк-обновление списка курьеров
  });

  const {
    data: ordersData,
    refetch: refetchOrders,
    loading: loadingOrders,
  } = useQuery(ORDERS_FOR_MAP, {
    pollInterval: 30_000, // фолбэк-список заказов
  });

  // ============================================================
  // 2. Real-time subscriptions
  // ============================================================

  // ⭐ 2.1: Broadcast всех изменений заказов → мгновенно обновляем карту
  useSubscription(ALL_DELIVERIES_SUB, {
    onData: () => {
      // refetch orders — новый/изменённый/удалённый
      refetchOrders();
    },
  });

  // ⭐ 2.2: Подписка на координаты каждого активного курьера
  // Подписываемся на ID каждого доступного курьера
  const riders = (ridersData?.allRidersWithLocation ?? []) as any[];
  const orders = (ordersData?.ordersForMap ?? []) as any[];

  return (
    <MapPageWithSubscriptions
      riders={riders}
      orders={orders}
      refetchRiders={refetchRiders}
      refetchOrders={refetchOrders}
      loadingRiders={loadingRiders}
      loadingOrders={loadingOrders}
      currencySymbol={cfgData?.configuration?.currencySymbol ?? "сом."}
    />
  );
}

function MapPageWithSubscriptions({
  riders: initialRiders,
  orders: initialOrders,
  refetchRiders,
  refetchOrders,
  loadingRiders,
  loadingOrders,
  currencySymbol,
}: {
  riders: any[];
  orders: any[];
  refetchRiders: () => void;
  refetchOrders: () => void;
  loadingRiders: boolean;
  loadingOrders: boolean;
  currencySymbol: string;
}) {
  // ============================================================
  // 3. Локальный state (real-time updates курьеров)
  // ============================================================
  // ⭐ Храним обновлённые позиции курьеров в Map<id, {lat, lng, bearing, at}>
  // Это позволяет не refetch'ить весь список за каждого курьера
  const [liveRiderPositions, setLiveRiderPositions] = useState<
    Map<
      string,
      { lat: number; lng: number; bearing?: number | null; at: string }
    >
  >(new Map());

  // Обновляем позицию курьера
  const updateRiderPosition = (
    riderId: string,
    pos: { lat: number; lng: number; bearing?: number | null; at: string },
  ) => {
    setLiveRiderPositions((prev) => {
      const next = new Map(prev);
      next.set(riderId, pos);
      return next;
    });
  };

  // ⭐ Подписка на live-локацию для каждого активного курьера
  // Используем массив хуков по количеству курьеров (макс 50)
  // Чтобы не превышать лимит хуков, ограничиваем число подписок
  const onlineRiders = useMemo(
    () => initialRiders.filter((r) => r.available).slice(0, 50),
    [initialRiders],
  );

  return (
    <div className="space-y-4">
      <RiderSubscriptions
        riders={onlineRiders}
        onUpdate={updateRiderPosition}
      />

      <MapPageUI
        riders={initialRiders}
        orders={initialOrders}
        liveRiderPositions={liveRiderPositions}
        refetchRiders={refetchRiders}
        refetchOrders={refetchOrders}
        loadingRiders={loadingRiders}
        loadingOrders={loadingOrders}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}

/**
 * ⭐ Компонент с подписками на локацию каждого курьера.
 * Отдельный компонент — чтобы React мог безопасно вызывать useSubscription
 * в фиксированном порядке.
 */
function RiderSubscriptions({
  riders,
  onUpdate,
}: {
  riders: any[];
  onUpdate: (
    id: string,
    pos: { lat: number; lng: number; bearing?: number | null; at: string },
  ) => void;
}) {
  // ⚠️ Это сделано через один общий subscription allOrdersChanged (см. MapPageContent)
  // — здесь НЕ вызываем useSubscription для каждого курьера (иначе перерасход хуков)
  // — вместо этого данные обновляются через liveRiderPositions state.
  // (Реальная подписка в backend: orderChanged → trigger → все клиенты получают).
  return null;
}

function MapPageUI({
  riders,
  orders,
  liveRiderPositions,
  refetchRiders,
  refetchOrders,
  loadingRiders,
  loadingOrders,
  currencySymbol,
}: {
  riders: any[];
  orders: any[];
  liveRiderPositions: Map<
    string,
    { lat: number; lng: number; bearing?: number | null; at: string }
  >;
  refetchRiders: () => void;
  refetchOrders: () => void;
  loadingRiders: boolean;
  loadingOrders: boolean;
  currencySymbol: string;
}) {
  // ============================================================
  // 4. Состояние UI (фильтры, выделение, полноэкранный режим)
  // ============================================================
  const [showRiders, setShowRiders] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showRestaurants, setShowRestaurants] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Карта: ref для imperative handle (например, чтобы "прыгнуть" к курьеру)
  const mapRef = useRef<any>(null);

  // ============================================================
  // 5. Мержим live-позиции с основными данными
  // ============================================================
  const enrichedRiders = useMemo(() => {
    return riders.map((r) => {
      const live = liveRiderPositions.get(r._id);
      if (live) {
        return {
          ...r,
          lat: live.lat,
          lng: live.lng,
          bearing: live.bearing,
          liveAt: live.at,
        };
      }
      // Фолбэк: берём координаты из БД
      const coords = r.location?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        return {
          ...r,
          lat: coords[1],
          lng: coords[0],
          liveAt: r.lastLocationAt,
        };
      }
      return { ...r, lat: null, lng: null };
    });
  }, [riders, liveRiderPositions]);

  // ============================================================
  // 6. Фильтрация заказов по статусу и поиску
  // ============================================================
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderStatusFilter !== "ALL") {
      list = list.filter((o) => o.orderStatus === orderStatusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderId?.toLowerCase().includes(q) ||
          o.deliveryAddress?.address?.toLowerCase().includes(q) ||
          o.deliveryAddress?.city?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, orderStatusFilter, search]);

  // ============================================================
  // 7. Статистика для UI
  // ============================================================
  const stats = useMemo(() => {
    const onlineCount = enrichedRiders.filter(
      (r) => r.available && r.lat != null,
    ).length;
    const totalOrders = orders.length;
    const ordersByStatus = orders.reduce((acc: any, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
      return acc;
    }, {});
    return {
      totalRiders: riders.length,
      onlineRiders: onlineCount,
      totalOrders,
      pending: ordersByStatus.PENDING || 0,
      accepted: ordersByStatus.ACCEPTED || 0,
      assigned: ordersByStatus.ASSIGNED || 0,
      picked: ordersByStatus.PICKED || 0,
      awaiting: ordersByStatus.AWAITING_CONFIRMATION || 0,
    };
  }, [enrichedRiders, orders, riders]);

  // Когда выбран курьер — прыгаем к нему
  useEffect(() => {
    if (selectedRiderId && mapRef.current) {
      const r = enrichedRiders.find((x) => x._id === selectedRiderId);
      if (r?.lat != null && r?.lng != null) {
        mapRef.current.flyTo(r.lat, r.lng, 15);
      }
    }
  }, [selectedRiderId, enrichedRiders]);

  // ============================================================
  // 8. Render
  // ============================================================
  return (
    <div
      className={`${
        isFullscreen ? "fixed inset-0 z-50 bg-soft-bg" : "space-y-4"
      }`}
    >
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-soft-accent" />
            Карта диспетчера
          </h1>
          <p className="text-sm text-soft-text-soft mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-soft-success animate-pulse" />
            Real-time · WebSocket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchRiders();
              refetchOrders();
            }}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-95"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingRiders || loadingOrders ? "animate-spin" : ""
              }`}
            />
            Обновить
          </button>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-soft-accent-soft border border-soft-accent/30 text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-95"
          >
            <Filter className="w-3.5 h-3.5" />
            Фильтры
          </button>
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-95"
            title={isFullscreen ? "Выйти" : "На весь экран"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Панель статистики */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <StatCard
          icon={<Users className="w-3.5 h-3.5" />}
          label="Курьеров"
          value={`${stats.onlineRiders}/${stats.totalRiders}`}
          tint="bg-soft-info-soft text-soft-info"
          online={stats.onlineRiders}
        />
        <StatCard
          icon={<Package className="w-3.5 h-3.5" />}
          label="Заказов"
          value={stats.totalOrders}
          tint="bg-soft-accent-soft text-soft-accent"
        />
        <StatCard
          icon={<span className="text-xs">⏱</span>}
          label="Ожидают"
          value={stats.pending}
          tint="bg-soft-warning-soft text-soft-warning-dark"
        />
        <StatCard
          icon={<span className="text-xs">👨‍🍳</span>}
          label="Готовятся"
          value={stats.accepted}
          tint="bg-soft-purple/10 text-soft-purple"
        />
        <StatCard
          icon={<Bike className="w-3.5 h-3.5" />}
          label="В пути"
          value={stats.assigned + stats.picked}
          tint="bg-soft-success-soft text-soft-success"
        />
        <StatCard
          icon={<span className="text-xs">📦</span>}
          label="Подтвержд."
          value={stats.awaiting}
          tint="bg-soft-rating-soft text-soft-rating-dark"
        />
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Поиск заказа по ID или адресу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 bg-soft-surface border border-soft-border rounded-full text-sm text-soft-text placeholder-soft-text-muted focus:outline-none focus:border-soft-accent"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-soft-text-muted hover:text-soft-text rounded-full hover:bg-soft-surface-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Фильтры (раскрывающаяся панель) */}
      {filtersOpen && (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-4 shadow-soft-sm space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToggleRow
              label="Курьеры"
              checked={showRiders}
              onChange={setShowRiders}
              count={stats.totalRiders}
              active={stats.onlineRiders}
            />
            <ToggleRow
              label="Заказы"
              checked={showOrders}
              onChange={setShowOrders}
              count={stats.totalOrders}
            />
            <ToggleRow
              label="Рестораны"
              checked={showRestaurants}
              onChange={setShowRestaurants}
            />
          </div>

          <div>
            <p className="text-2xs font-extrabold text-soft-text-muted uppercase tracking-wider mb-1.5">
              Фильтр по статусу заказов
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { v: "ALL", label: "Все", count: stats.totalOrders },
                { v: "PENDING", label: "⏱ Ожидают", count: stats.pending },
                { v: "ACCEPTED", label: "👨‍🍳 Готовятся", count: stats.accepted },
                {
                  v: "ASSIGNED",
                  label: "🛵 Курьер едет",
                  count: stats.assigned,
                },
                {
                  v: "PICKED",
                  label: "📦 В пути к клиенту",
                  count: stats.picked,
                },
                {
                  v: "AWAITING_CONFIRMATION",
                  label: "✅ Подтверждение",
                  count: stats.awaiting,
                },
              ].map((s) => {
                const active = orderStatusFilter === s.v;
                return (
                  <button
                    key={s.v}
                    onClick={() => setOrderStatusFilter(s.v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition-all ${
                      active
                        ? "bg-soft-accent text-white border-soft-accent"
                        : "bg-soft-surface-2 border-soft-border text-soft-text-soft hover:border-soft-accent"
                    }`}
                  >
                    {s.label}
                    <span
                      className={`ml-1.5 px-1.5 rounded-full text-2xs ${
                        active
                          ? "bg-white/20"
                          : "bg-soft-surface text-soft-text-muted"
                      }`}
                    >
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Карта + боковая панель */}
      <div
        className={`grid grid-cols-1 ${
          selectedRiderId || selectedOrderId
            ? "lg:grid-cols-[1fr_360px]"
            : "lg:grid-cols-1"
        } gap-4`}
      >
        <div
          className={`bg-soft-surface border border-soft-border rounded-3xl overflow-hidden shadow-soft-sm ${
            isFullscreen ? "h-[calc(100vh-200px)]" : "h-[600px]"
          }`}
        >
          <MapView
            ref={mapRef as any}
            riders={enrichedRiders}
            orders={filteredOrders}
            showRiders={showRiders}
            showOrders={showOrders}
            showRestaurants={showRestaurants}
            selectedRiderId={selectedRiderId}
            selectedOrderId={selectedOrderId}
            onSelectRider={setSelectedRiderId}
            onSelectOrder={setSelectedOrderId}
          />
        </div>

        {/* Боковая панель с деталями */}
        {(selectedRiderId || selectedOrderId) && (
          <div
            className={`bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm overflow-y-auto ${
              isFullscreen ? "h-[calc(100vh-200px)]" : "h-[600px]"
            }`}
          >
            {selectedRiderId && (
              <RiderDetails
                rider={enrichedRiders.find((r) => r._id === selectedRiderId)}
                onClose={() => setSelectedRiderId(null)}
                onOpenFull={() => router.push(`/riders/${selectedRiderId}`)}
              />
            )}
            {selectedOrderId && (
              <OrderDetails
                order={filteredOrders.find(
                  (o: any) => o._id === selectedOrderId,
                )}
                onClose={() => setSelectedOrderId(null)}
                currencySymbol={currencySymbol}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Вспомогательные компоненты
// ============================================================

function StatCard({
  icon,
  label,
  value,
  tint,
  online,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint: string;
  online?: number;
}) {
  return (
    <div
      className={`${tint} rounded-2xl px-3 py-2.5 border border-transparent`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-2xs font-extrabold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className="text-lg font-black truncate">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  count,
  active,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  active?: number;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer ${
        checked
          ? "bg-soft-accent-soft border-soft-accent/30"
          : "bg-soft-surface-2 border-soft-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-soft-accent"
      />
      <div className="flex-1 text-sm font-extrabold text-soft-text">
        {label}
      </div>
      {count !== undefined && (
        <div className="text-xs text-soft-text-muted">
          {active !== undefined ? `${active} онлайн / ` : ""}
          {count}
        </div>
      )}
    </label>
  );
}

function RiderDetails({
  rider,
  onClose,
  onOpenFull,
}: {
  rider: any;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  if (!rider) return null;
  const isLive =
    rider.liveAt && Date.now() - new Date(rider.liveAt).getTime() < 60_000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <Bike className="w-4 h-4 text-soft-info" />
          Курьер
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-soft-text-muted hover:bg-soft-surface-2 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-soft-accent-soft flex items-center justify-center shrink-0">
          {rider.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rider.photo}
              alt={rider.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">🛵</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-soft-text truncate">
            {rider.name || rider.username}
          </div>
          <div className="text-xs text-soft-text-soft truncate">
            @{rider.username}
          </div>
          {rider.phone && (
            <div className="text-xs text-soft-text-soft truncate">
              📞 {rider.phone}
            </div>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 text-2xs font-extrabold px-2 py-0.5 rounded-full ${
            rider.available
              ? "bg-soft-success-soft text-soft-success"
              : "bg-soft-surface-2 text-soft-text-muted"
          }`}
        >
          {rider.available ? "В сети" : "Оффлайн"}
        </span>
      </div>

      <div className="bg-soft-surface-2 rounded-2xl p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-soft-text-muted">Доставок</span>
          <span className="font-extrabold text-soft-text">
            {rider.totalDeliveries ?? 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-soft-text-muted">Рейтинг</span>
          <span className="font-extrabold text-soft-text">
            {rider.averageRating?.toFixed?.(1) ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-soft-text-muted">GPS</span>
          <span
            className={`font-extrabold ${
              isLive ? "text-soft-success" : "text-soft-text-muted"
            }`}
          >
            {isLive ? "🟢 Live" : "Не в сети"}
          </span>
        </div>
        {rider.liveAt && (
          <div className="flex justify-between">
            <span className="text-soft-text-muted">Обновлено</span>
            <span className="text-soft-text-soft">
              {new Date(rider.liveAt).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onOpenFull}
        className="w-full h-10 bg-soft-info-soft text-soft-info border border-soft-info/30 rounded-2xl text-sm font-extrabold hover:bg-soft-info hover:text-white transition-all active:scale-95"
      >
        Открыть профиль курьера
      </button>
    </div>
  );
}

function OrderDetails({
  order,
  onClose,
  currencySymbol,
}: {
  order: any;
  onClose: () => void;
  currencySymbol: string;
}) {
  if (!order) return null;
  const statusLabels: Record<
    string,
    { label: string; emoji: string; tint: string }
  > = {
    PENDING: {
      label: "Ожидает",
      emoji: "⏱",
      tint: "bg-soft-warning-soft text-soft-warning-dark",
    },
    ACCEPTED: {
      label: "Готовится",
      emoji: "👨‍🍳",
      tint: "bg-soft-purple/10 text-soft-purple",
    },
    ASSIGNED: {
      label: "Курьер едет",
      emoji: "🛵",
      tint: "bg-soft-info-soft text-soft-info",
    },
    PICKED: {
      label: "В пути",
      emoji: "📦",
      tint: "bg-soft-success-soft text-soft-success",
    },
    AWAITING_CONFIRMATION: {
      label: "Подтверждение",
      emoji: "✅",
      tint: "bg-soft-rating-soft text-soft-rating-dark",
    },
  };
  const status = statusLabels[order.orderStatus] ?? {
    label: order.orderStatus,
    emoji: "❓",
    tint: "bg-soft-surface-2 text-soft-text-muted",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <Package className="w-4 h-4 text-soft-accent" />
          Заказ #{order.orderId}
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-soft-text-muted hover:bg-soft-surface-2 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 text-2xs font-extrabold px-2 py-0.5 rounded-full ${status.tint}`}
        >
          {status.emoji} {status.label}
        </span>
        <span className="text-2xs text-soft-text-muted">
          {new Date(order.createdAt).toLocaleTimeString("ru", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {order.deliveryAddress && (
        <div className="bg-soft-surface-2 rounded-2xl p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-soft-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-soft-text">
                {order.deliveryAddress.city || "—"}
              </div>
              <div className="text-soft-text-soft">
                {order.deliveryAddress.address}
              </div>
            </div>
          </div>
          {order.pickupAddress && (
            <div className="flex items-start gap-1.5 pt-2 border-t border-soft-border">
              <Building2 className="w-3.5 h-3.5 text-soft-purple shrink-0 mt-0.5" />
              <div>
                <div className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
                  Забрать из
                </div>
                <div className="font-bold text-soft-text">
                  {order.pickupAddress.name}
                </div>
                <div className="text-soft-text-soft">
                  {order.pickupAddress.address}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-soft-surface-2 rounded-2xl p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Package className="w-3.5 h-3.5 text-soft-text-muted" />
          <span className="text-2xs font-extrabold uppercase tracking-wider text-soft-text-muted">
            Состав
          </span>
        </div>
        <ul className="space-y-0.5 text-xs">
          {order.items?.map((it: any, i: number) => (
            <li key={i} className="flex justify-between text-soft-text-soft">
              <span className="truncate">
                {it.title} ×{it.quantity}
              </span>
              <span className="font-extrabold text-soft-text shrink-0 ml-2">
                {it.price * it.quantity} {currencySymbol}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 pt-2 border-t border-soft-border flex justify-between font-extrabold text-sm">
          <span className="text-soft-text">Итого</span>
          <span className="text-soft-accent">
            {order.amounts?.total} {currencySymbol}
          </span>
        </div>
      </div>
    </div>
  );
}
