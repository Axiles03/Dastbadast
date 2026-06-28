"use client";
import { useEffect, useState } from "react";
import { useQuery, useSubscription, useMutation } from "@apollo/client";
import {
  GET_MONITOR_ORDERS,
  GET_RIDERS,
  ASSIGN_RIDER,
  SUB_ZONE_ORDERS,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { ACTION_ACCESS, NAV_ACCESS } from "@/lib/page-access";
import { useRouter } from "next/navigation";
// ... остальные импорты как в существующей странице
import {
  Loader2,
  RefreshCw,
  Bike,
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  PackageCheck,
  Phone,
  MessageSquare,
  Wallet,
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
    style: "bg-soft-rating-soft text-soft-rating-dark border-soft-rating/20",
    icon: ChefHat,
  },
  ASSIGNED: {
    label: "Курьер назначен",
    style: "bg-soft-info-soft text-soft-info border-soft-info/20",
    icon: Bike,
  },
  PICKED: {
    label: "В пути",
    style: "bg-soft-purple/10 text-soft-purple border-soft-purple/20",
    icon: PackageCheck,
  },
};

export default function DispatchPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.dispatch}>
      <DispatchInner />
    </RoleGate>
  );
}

function DispatchInner() {
  const { hasRole } = useAuth();
  const { data, refetch } = useQuery(GET_MONITOR_ORDERS, {
    pollInterval: 10000,
  });
  const { data: ridersData, refetch: refetchRiders } = useQuery(GET_RIDERS, {
    variables: { available: true },
  });
  const [assignRider, { loading: assigning }] = useMutation(ASSIGN_RIDER);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  useSubscription(SUB_ZONE_ORDERS, {
    variables: { zoneId: null },
    onData: () => refetch(),
  });

  // Право на назначение курьера
  const canAssignRider = hasRole(ACTION_ACCESS.assignRider);

  const orders = (data?.allOrders || []).filter(
    (o: any) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );
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

  const counts = {
    pending: orders.filter((o: any) => o.orderStatus === "PENDING").length,
    accepted: orders.filter((o: any) => o.orderStatus === "ACCEPTED").length,
    assigned: orders.filter((o: any) => o.orderStatus === "ASSIGNED").length,
    picked: orders.filter((o: any) => o.orderStatus === "PICKED").length,
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
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
        </div>
      </div>

      {/* Метрики */}
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
          tint="bg-soft-rating-soft text-soft-rating-dark border-soft-rating/20"
        />
        <MetricPill
          icon={<Bike className="w-4 h-4" />}
          label="Назначены"
          value={counts.assigned}
          tint="bg-soft-info-soft text-soft-info border-soft-info/20"
        />
        <MetricPill
          icon={<PackageCheck className="w-4 h-4" />}
          label="В пути"
          value={counts.picked}
          tint="bg-soft-purple/10 text-soft-purple border-soft-purple/20"
        />
      </div>

      {/* Список заказов */}
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

                  <div className="text-right space-y-1.5">
                    <div className="text-lg font-black text-soft-accent">
                      {o.amounts?.total} сом.
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border ${statusInfo.style}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
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
                  {/* Кнопка видна только если есть право на назначение */}
                  {needsManualAssign && canAssignRider && (
                    <button
                      onClick={() => setAssignFor(o.id)}
                      className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white px-3.5 py-2 rounded-full font-bold text-sm transition-all active:scale-[0.98] shadow-soft-sm"
                    >
                      <Bike className="w-4 h-4" />
                      Назначить курьера
                    </button>
                  )}
                  {/* Если нет права — показать подсказку */}
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
            className="w-8 h-8 flex items-center justify-center text-soft-text-muted hover:text-soft-text hover:bg-soft-surface-2 rounded-xl transition-colors"
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
