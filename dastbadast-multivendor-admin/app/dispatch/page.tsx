// dastbadast-multivendor-admin/app/dispatch/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useSubscription, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  GET_MONITOR_ORDERS,
  GET_RIDERS,
  ASSIGN_RIDER,
  SUB_ZONE_ORDERS,
  ALL_DELIVERIES_SUB,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { ACTION_ACCESS, NAV_ACCESS } from "@/lib/page-access";
import {
  Loader2,
  RefreshCw,
  Bike,
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  Phone,
  MessageSquare,
  Wallet,
  Map as MapIcon,
  XCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleXIcon,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Новый заказ",
  ACCEPTED: "Принят · ожидание курьера",
  ASSIGNED: "Курьер назначен",
  PICKED: "В пути к клиенту",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

const STATUS_STYLES: Record<
  string,
  { label: string; style: string; icon: any }
> = {
  PENDING: {
    label: "Новый",
    style: "bg-soft-accent-soft text-soft-accent border-soft-accent/20",
    icon: Clock,
  },
  ACCEPTED: {
    label: "Ожидает курьера",
    style: "bg-soft-warning-soft text-soft-warning-dark border-soft-warning/20",
    icon: ChefHat,
  },
  ASSIGNED: {
    label: "Курьер назначен",
    style: "bg-soft-info-soft text-soft-info border-soft-info/20",
    icon: Bike,
  },
  PICKED: {
    label: "В пути",
    style: "bg-soft-success-soft text-soft-success border-soft-success/20",
    icon: Package,
  },
};

// ⭐ NEW: локализация причин отмены
const CANCEL_REASON_LABEL: Record<string, string> = {
  AUTO_EXPIRED: "⏰ Истёк срок (5 мин без подтверждения)",
};

// ⭐ NEW: форматирование относительного времени ("5 мин назад", "2 ч назад")
function timeAgo(dateString: string | Date | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "только что";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} дн назад`;
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function cancelReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Причина не указана";
  if (CANCEL_REASON_LABEL[reason]) return CANCEL_REASON_LABEL[reason];
  if (reason.length > 60) return reason.substring(0, 60) + "…";
  return reason;
}

function getCancelIcon(reason: string | null | undefined): string {
  if (reason === "AUTO_EXPIRED") return "⏰";
  if (reason?.toLowerCase().includes("нет продукт")) return "🚫";
  if (reason?.toLowerCase().includes("ресторан")) return "❌";
  if (reason?.toLowerCase().includes("курьер")) return "🛵";
  if (reason?.toLowerCase().includes("клиент")) return "👤";
  return "✕";
}

export default function DispatchPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.dispatch}>
      <DispatchInner />
    </RoleGate>
  );
}

function DispatchInner() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const { data, refetch } = useQuery(GET_MONITOR_ORDERS, {
    pollInterval: 10_000,
  });
  const { data: ridersData, refetch: refetchRiders } = useQuery(GET_RIDERS, {
    variables: { available: true },
  });
  const [assignRider, { loading: assigning }] = useMutation(ASSIGN_RIDER);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  // ⭐ NEW: состояние сворачиваемой секции "Отменённые заказы"
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = "#FAF7F2";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  // Подписка на изменения заказов в зоне (включая cancelOrder, expireIfPending)
  useSubscription(SUB_ZONE_ORDERS, {
    variables: { zoneId: null },
    onData: () => refetch(),
  });

  // ⭐ NEW: подписка на broadcast всех изменений заказов
  useSubscription(ALL_DELIVERIES_SUB, {
    onData: () => refetch(),
  });

  const canAssignRider = hasRole(ACTION_ACCESS.assignRider);

  const allOrders = (data?.allOrders || []) as any[];

  // Активные заказы — без CANCELLED, чтобы не путать диспетчера
  const orders = allOrders.filter(
    (o: any) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );

  // ⭐ NEW: Отменённые заказы — отдельный массив, отсортирован по дате отмены
  const cancelledOrders = useMemo(() => {
    return allOrders
      .filter((o: any) => o.orderStatus === "CANCELLED")
      .sort((a: any, b: any) => {
        const aTime =
          a?.statusTimestamps?.cancelledAt || a?.updatedAt || a?.createdAt;
        const bTime =
          b?.statusTimestamps?.cancelledAt || b?.updatedAt || b?.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
  }, [allOrders]);

  const availableRiders = ridersData?.riders ?? [];

  const doAssign = async (orderId: string, riderId: string) => {
    try {
      await assignRider({ variables: { input: { orderId, riderId } } });
      setAssignFor(null);
      refetch();
      refetchRiders();
    } catch (e: any) {
      alert(`Не удалось назначить: ${e.message}`);
    }
  };

  // ⭐ Обновлённые счётчики: добавлен `cancelled`
  const counts = {
    pending: orders.filter((o: any) => o.orderStatus === "PENDING").length,
    accepted: orders.filter((o: any) => o.orderStatus === "ACCEPTED").length,
    assigned: orders.filter((o: any) => o.orderStatus === "ASSIGNED").length,
    picked: orders.filter((o: any) => o.orderStatus === "PICKED").length,
    cancelled: cancelledOrders.length,
  };

  return (
    <div className="space-y-6">
      {/* ───────── Шапка с кнопкой перехода на карту ───────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Мониторинг заказов
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Курьеры берут заказы автоматически. Назначить вручную — ниже
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-soft-success-soft text-soft-success border border-soft-success/30 px-3 py-1.5 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-soft-success animate-pulse-soft" />
            Live · WebSocket
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-1.5 rounded-full transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить
          </button>
          <button
            onClick={() => router.push("/map")}
            className="inline-flex items-center gap-1.5 bg-soft-info-soft text-soft-info border border-soft-info/30 px-3.5 py-1.5 rounded-full text-xs font-extrabold hover:bg-soft-info hover:text-white transition-all active:scale-95"
          >
            <MapIcon className="w-3.5 h-3.5" />
            Карта
          </button>
        </div>
      </div>

      {/* ───────── Метрики (4 колонки: только АКТИВНЫЕ заказы) ───────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricPill
          icon={<Clock className="w-4 h-4" />}
          label="Новые"
          value={counts.pending}
          tint="bg-soft-accent-soft text-soft-accent border-soft-accent/20"
        />
        <MetricPill
          icon={<ChefHat className="w-4 h-4" />}
          label="Ожидают курьера"
          value={counts.accepted}
          tint="bg-soft-warning-soft text-soft-warning-dark border-soft-warning/20"
        />
        <MetricPill
          icon={<Bike className="w-4 h-4" />}
          label="Назначены"
          value={counts.assigned}
          tint="bg-soft-info-soft text-soft-info border-soft-info/20"
        />
        <MetricPill
          icon={<Package className="w-4 h-4" />}
          label="В пути"
          value={counts.picked}
          tint="bg-soft-success-soft text-soft-success border-soft-success/20"
        />
        {/* <MetricPill
          icon={<Circle className="w-4 h-4" />}
          label="Отменнено"
          value={counts.cancelled}
          tint="bg-soft-error-soft text-soft-error border-soft-error/20"
        /> */}
      </div>

      {/* ───────── Список АКТИВНЫХ заказов ───────── */}
      {orders.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center space-y-2 shadow-soft-sm">
          <div className="text-5xl mb-2">🎉</div>
          <p className="text-lg font-extrabold text-soft-text">
            Все заказы доставлены
          </p>
          <p className="text-sm text-soft-text-soft">
            На данный момент нет активных доставок
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o: any) => {
            const statusInfo =
              STATUS_STYLES[o.orderStatus] || STATUS_STYLES.PENDING;
            const StatusIcon = statusInfo.icon;
            const isPending = o.orderStatus === "PENDING";
            const needsManualAssign =
              o.orderStatus === "ACCEPTED" && !o.riderId;
            return (
              <li
                key={o.id}
                className={`bg-soft-surface border rounded-3xl p-5 shadow-soft-sm transition-all hover:shadow-soft ${
                  isPending
                    ? "border-soft-accent/40 ring-1 ring-soft-accent/10"
                    : "border-soft-border"
                }`}
              >
                <div className="flex justify-between items-start gap-4 flex-wrap border-b border-soft-border pb-3 mb-3">
                  <div className="space-y-1">
                    <div className="text-lg font-extrabold tracking-tight text-soft-text flex items-center gap-2">
                      Заказ #{o.orderId}
                      {isPending && (
                        <span className="w-2 h-2 rounded-full bg-soft-accent animate-pulse-soft" />
                      )}
                    </div>
                    <div className="text-xs text-soft-text-soft">
                      Оформлен:{" "}
                      {new Date(o.createdAt).toLocaleString("ru", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {o.riderId && (
                      <div className="text-xs text-soft-success font-bold mt-1 inline-flex items-center gap-1 bg-soft-success-soft px-2 py-0.5 rounded-full border border-soft-success/20">
                        <CheckCircle2 className="w-3 h-3" /> Курьер назначен
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      <span className="text-soft-text-muted">🍽 Ресторан:</span>
                      <span className="text-soft-text-soft font-bold">
                        {o.amounts?.subtotal ?? 0} сом.
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      <span className="text-soft-text-muted">🛵 Доставка:</span>
                      <span className="text-soft-text-soft font-bold">
                        {o.amounts?.deliveryFee ?? 0} сом.
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border ${statusInfo.style}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>

                    <div className="text-lg font-extrabold text-soft-accent tracking-tight">
                      {o.amounts?.total ?? 0} сом.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-soft-surface-2 p-4 rounded-2xl border border-soft-border">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-soft-text-muted uppercase tracking-wider">
                      🏪 Откуда
                    </div>
                    <p className="text-soft-text font-semibold leading-relaxed">
                      {o.pickupAddress?.name && (
                        <strong className="text-soft-accent">
                          {o.pickupAddress.name},{" "}
                        </strong>
                      )}
                      {o.pickupAddress?.address || "—"}
                    </p>
                  </div>
                  <div className="space-y-1 md:border-l md:border-soft-border md:pl-4 pt-2 md:pt-0 border-t border-soft-border">
                    <div className="text-[10px] font-bold text-soft-text-muted uppercase tracking-wider">
                      📍 Куда
                    </div>
                    <p className="text-soft-text font-semibold leading-relaxed">
                      {o.deliveryAddress?.city && (
                        <strong>{o.deliveryAddress.city}, </strong>
                      )}
                      {o.deliveryAddress?.address}
                    </p>
                  </div>
                </div>

                {o.note && (
                  <div className="mt-3 bg-soft-accent-soft border border-soft-accent/20 rounded-2xl p-3 text-sm text-soft-text flex gap-2">
                    <MessageSquare className="w-4 h-4 text-soft-accent shrink-0 mt-0.5" />
                    <span>«{o.note}»</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-soft-border flex items-center justify-between text-xs text-soft-text-soft flex-wrap gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-soft-text-muted">
                      Состав:
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {o.items.map((i: any, idx: number) => (
                        <span
                          key={idx}
                          className="bg-soft-surface-2 text-soft-text px-2 py-0.5 rounded-full border border-soft-border font-semibold"
                        >
                          {i.title}{" "}
                          <span className="text-soft-accent">
                            ×{i.quantity}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {needsManualAssign && canAssignRider && (
                    <button
                      onClick={() => setAssignFor(o.id)}
                      className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white px-3.5 py-2 rounded-full font-bold text-sm transition-all active:scale-[0.98] shadow-soft-sm"
                    >
                      <Bike className="w-4 h-4" />
                      Назначить курьера
                    </button>
                  )}
                  {needsManualAssign && !canAssignRider && (
                    <span className="text-[10px] text-soft-text-muted italic">
                      Требуется назначение (нет прав)
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ⭐ NEW: ───────── Секция "Отменённые заказы" (сворачиваемая) ───────── */}
      {cancelledOrders.length > 0 && (
        <section className="mt-8">
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className="w-full flex-row items-center justify-between bg-soft-surface border border-soft-border rounded-2xl px-4 py-3.5 hover:bg-soft-surface-2 transition-colors shadow-soft-sm"
            aria-label={
              showCancelled
                ? "Скрыть отменённые заказы"
                : "Показать отменённые заказы"
            }
            style={{ display: "flex" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-soft-accent-soft flex items-center justify-center">
                <XCircle className="w-5 h-5 text-soft-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm font-extrabold text-soft-text">
                  Отменённые заказы
                </p>
                <p className="text-2xs text-soft-text-soft mt-0.5">
                  {cancelledOrders.length}{" "}
                  {cancelledOrders.length === 1
                    ? "заказ"
                    : cancelledOrders.length < 5
                      ? "заказа"
                      : "заказов"}{" "}
                  · реалтайм через WebSocket
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-soft-accent-soft border border-soft-accent/20 px-2.5 py-1 rounded-full">
                <span className="text-xs font-extrabold text-soft-accent">
                  {counts.cancelled}
                </span>
              </div>
              {showCancelled ? (
                <ChevronUp className="w-5 h-5 text-soft-text-soft" />
              ) : (
                <ChevronDown className="w-5 h-5 text-soft-text-soft" />
              )}
            </div>
          </button>

          {showCancelled && (
            <div className="mt-3 space-y-2.5">
              {cancelledOrders.slice(0, 20).map((o: any) => (
                <CancelledOrderCard key={o.id} order={o} />
              ))}
              {cancelledOrders.length > 20 && (
                <p className="text-2xs text-soft-text-muted text-center mt-3 italic">
                  Показаны последние 20 из {cancelledOrders.length} отменённых
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {assignFor && (
        <RiderPickerModal
          orderId={assignFor}
          riders={availableRiders}
          assigning={assigning}
          onClose={() => setAssignFor(null)}
          onPick={doAssign}
        />
      )}
    </div>
  );
}

// ⭐ NEW: Компонент карточки отменённого заказа
function CancelledOrderCard({ order: o }: { order: any }) {
  const cancelledAt =
    o?.statusTimestamps?.cancelledAt || o?.updatedAt || o?.createdAt;
  const cancelEmoji = getCancelIcon(o.cancelReason);
  const reason = cancelReasonLabel(o.cancelReason);
  const isExpired = o.cancelReason === "AUTO_EXPIRED";

  return (
    <div className="bg-soft-surface border border-soft-accent/30 rounded-2xl p-3.5 shadow-soft-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-extrabold text-soft-text">
              Заказ #{o.orderId}
            </span>
            <span className="flex items-center gap-1 bg-soft-accent-soft border border-soft-accent/20 px-2 py-0.5 rounded-full">
              <span className="text-2xs font-extrabold text-soft-accent">
                ✕ Отменён
              </span>
            </span>
            {isExpired && (
              <span className="flex items-center gap-1 bg-soft-warning-soft border border-soft-warning/30 px-2 py-0.5 rounded-full">
                <span className="text-2xs font-extrabold text-soft-warning-dark">
                  ⏰ Авто
                </span>
              </span>
            )}
          </div>
          <p className="text-2xs text-soft-text-soft mb-1.5">
            {timeAgo(cancelledAt)}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{cancelEmoji}</span>
            <p
              className="text-xs text-soft-text-soft italic leading-4 flex-1"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {reason}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-extrabold text-soft-text-soft line-through">
            {o.amounts?.total ?? 0} сом.
          </p>
        </div>
      </div>

      {/* Краткая сводка: ресторан + клиент + (если был курьер) */}
      <div className="mt-2.5 pt-2.5 border-t border-soft-border space-y-1">
        {o.pickupAddress?.name && (
          <p
            className="text-2xs text-soft-text-soft"
            title={o.pickupAddress.name}
          >
            <span className="text-soft-text-muted">🏪 </span>
            {o.pickupAddress.name}
          </p>
        )}
        {o.deliveryAddress?.address && (
          <p
            className="text-2xs text-soft-text-soft"
            title={`${o.deliveryAddress.city ?? ""}, ${o.deliveryAddress.address}`}
          >
            <span className="text-soft-text-muted">📍 </span>
            {o.deliveryAddress.city ? `${o.deliveryAddress.city}, ` : ""}
            {o.deliveryAddress.address}
          </p>
        )}
        {o.riderId && (
          <p className="text-2xs text-soft-text-soft">
            <span className="text-soft-text-muted">🛵 </span>
            Курьер был назначен
          </p>
        )}
        {o.items && o.items.length > 0 && (
          <p
            className="text-2xs text-soft-text-soft mt-1"
            title={o.items
              .map((i: any) => `${i.title} ×${i.quantity}`)
              .join(", ")}
          >
            <span className="text-soft-text-muted">🍽 </span>
            {o.items
              .slice(0, 3)
              .map((i: any) => `${i.title} ×${i.quantity}`)
              .join(", ")}
            {o.items.length > 3 ? ` · +${o.items.length - 3}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="bg-soft-surface border border-soft-border rounded-2xl px-4 py-3 shadow-soft-sm flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tint}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-soft-text-muted font-bold">
          {label}
        </p>
        <p className="text-xl font-extrabold text-soft-text leading-none mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function RiderPickerModal({
  orderId,
  riders,
  assigning,
  onClose,
  onPick,
}: {
  orderId: string;
  riders: any[];
  assigning: boolean;
  onClose: () => void;
  onPick: (orderId: string, riderId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-soft-dark-2/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-soft-surface border border-soft-border rounded-3xl p-5 w-full max-w-md shadow-soft-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
            <Bike className="w-5 h-5 text-soft-accent" /> Выберите курьера
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-soft-surface-2 text-soft-text-soft flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {riders.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <div className="text-3xl">🛵</div>
            <p className="text-sm text-soft-text-soft">
              Нет доступных курьеров
            </p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {riders.map((r: any) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => onPick(orderId, r.id)}
                  className="w-full text-left bg-soft-surface-2 border border-soft-border hover:border-soft-accent hover:bg-soft-accent-soft rounded-2xl p-3 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-soft-surface border border-soft-border flex items-center justify-center text-soft-accent shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-sm text-soft-text truncate">
                        {r.name || r.username}
                      </div>
                      <div className="text-xs text-soft-text-soft truncate">
                        @{r.username}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </div>
                    </div>
                    {assigning && (
                      <Loader2 className="w-4 h-4 animate-spin text-soft-accent" />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
