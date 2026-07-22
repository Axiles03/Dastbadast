"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useSubscription } from "@apollo/client/react";
import {
  GET_ORDER,
  GET_ORDERS,
  ORDER_LIST_ITEM,
  SUB_ORDER,
  SUB_USER_ORDERS,
} from "@/lib/queries";
import {
  PENDING_TIMEOUT_MS,
  formatCountdown,
  getPendingRemainingMs,
  getPrepRemainingMs,
  isLocallyPendingExpired,
} from "@/lib/order-timers";
import { RequireAuth } from "@/components/RequireAuth";
import {
  AlertCircle,
  ArrowLeft,
  ChefHat,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Store,
  XCircle,
} from "lucide-react";
import { gql } from "@apollo/client";
import { useAuth } from "@/lib/auth-context";

export default function WaitingPage() {
  return (
    <RequireAuth>
      <WaitingInner />
    </RequireAuth>
  );
}

function WaitingInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params?.id || "";

  const { user } = useAuth();
  // ⭐ Тикаем каждую секунду — для динамического обратного отсчёта.
  // Время НЕ сбрасывается при reload — оно вычисляется из серверных timestamps.
  const now = useNow(1000);

  const { data, loading, error, refetch } = useQuery(GET_ORDER, {
    variables: { id: orderId },
    skip: !orderId,
    fetchPolicy: "network-only", // ⭐ КЛЮЧЕВОЙ ФИКС
    notifyOnNetworkStatusChange: true,
  });

  const { subscribeToMore } = useQuery(GET_ORDER, {
    variables: { id: orderId },
    skip: !orderId,
  });

  useEffect(() => {
    if (!orderId || !subscribeToMore) return;
    const unsubscribe = subscribeToMore({
      document: SUB_ORDER,
      variables: { orderId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData?.data?.subscriptionOrder) return prev;
        const updated = subscriptionData.data.subscriptionOrder;
        const orders = prev?.orders ?? [];
        const idx = orders.findIndex((o: any) => o.id === updated.id);
        const next =
          idx >= 0
            ? orders.map((o: any, i: number) =>
                i === idx ? { ...o, ...updated } : o,
              )
            : [updated, ...orders];
        return { orders: next };
      },
    });
    return () => unsubscribe();
  }, [user?.id, subscribeToMore]);

  // ⭐ WebSocket-подписка для мгновенной синхронизации статуса
  useSubscription(SUB_ORDER, {
    variables: { orderId },
    skip: !orderId,
    onData: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (orderId) {
      refetch();
    }
  }, [orderId, refetch]);

  const o = data?.order;

  useEffect(() => {
    const status = o?.orderStatus;
    if (
      o?.id &&
      [
        "READY_FOR_PICKUP",
        "ASSIGNED",
        "PICKED",
        "EN_ROUTE_TO_DROP_OFF",
        "ARRIVED_AT_DROP_OFF",
        "AWAITING_CONFIRMATION",
        "DELIVERED",
      ].includes(status)
    ) {
      router.replace(`/order/${o.id}/tracking`);
    }
  }, [o?.id, o?.orderStatus, router]);

  if (loading) {
    return (
      <Centered>
        <Loader2 className="w-10 h-10 text-soft-accent animate-spin" />
        <p className="text-sm text-soft-text-soft mt-3">Загружаем заказ…</p>
      </Centered>
    );
  }

  if (error || !o) {
    return (
      <Centered>
        <XCircle className="w-12 h-12 text-soft-accent" />
        <h2 className="text-lg font-extrabold text-soft-text mt-3">
          Заказ не найден
        </h2>
        {error && (
          <p className="text-xs text-soft-text-muted mt-1">{error.message}</p>
        )}
        <Link
          href="/orders"
          className="mt-4 px-5 py-2.5 bg-soft-surface border border-soft-border rounded-2xl text-sm font-bold text-soft-text-soft hover:border-soft-accent"
        >
          К истории заказов
        </Link>
      </Centered>
    );
  }

  // ───── Времянки ─────
  const pendingAt = o.statusTimestamps?.pendingAt || o.createdAt;
  const acceptedAt = o.statusTimestamps?.acceptedAt;
  const prepTime = o.statusTimestamps?.prepTime;

  const pendingRemainingMs = getPendingRemainingMs(pendingAt, now);
  const prepRemainingMs = getPrepRemainingMs(acceptedAt, prepTime, now);

  // ⭐ Определяем фазу для отображения
  // 1. EXPIRED: бэкенд уже отменил ИЛИ локально 5 мин прошло и статус всё ещё PENDING
  const isCancelled = o.orderStatus === "CANCELLED";
  const isExpiredByReason = isCancelled && o.cancelReason === "AUTO_EXPIRED";
  const isExpiredLocally =
    o.orderStatus === "PENDING" && isLocallyPendingExpired(pendingAt, now);
  const isExpired = isExpiredByReason || isExpiredLocally;

  let view: "pending" | "accepted" | "expired" | "cancelled" = "pending";
  if (isExpired) view = "expired";
  else if (o.orderStatus === "CANCELLED") view = "cancelled";
  else if (o.orderStatus === "ACCEPTED" || o.orderStatus === "PREPARING")
    view = "accepted";
  else if (o.orderStatus === "PENDING") view = "pending";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ArrowLeft className="w-4 h-4" /> История заказов
      </Link>

      <header>
        <p className="text-soft-text-muted text-sm">Заказ #{o.orderId}</p>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-1 text-soft-text">
          {view === "pending" && "Ожидаем подтверждения ресторана"}
          {view === "accepted" && "Заказ принят в работу"}
          {view === "expired" && "Заказ отменён"}
          {view === "cancelled" && "Заказ отменён"}
        </h1>
      </header>

      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 sm:p-8 shadow-soft-sm">
        {/* ───────── PENDING VIEW ───────── */}
        {view === "pending" && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-soft-accent-soft flex items-center justify-center">
                <Store className="w-12 h-12 text-soft-accent" />
              </div>
              <p className="text-sm text-soft-text-soft mt-4">
                Ресторан получил ваш заказ. Обычно подтверждение занимает 1–2
                минуты.
              </p>
              <p className="text-2xs text-soft-text-muted mt-1 max-w-xs">
                Если ресторан не подтвердит в течение{" "}
                {PENDING_TIMEOUT_MS / 60000} минут, заказ будет отменён
                автоматически.
              </p>

              {/* ⭐ Динамический таймер обратного отсчёта */}
              <div className="mt-6 bg-soft-warning-soft border border-soft-warning/30 rounded-2xl px-5 py-4 inline-flex items-center gap-3">
                <Clock className="w-5 h-5 text-soft-warning-dark" />
                <div className="text-left">
                  <p className="text-xs text-soft-text-soft font-bold uppercase tracking-wider">
                    Автоотмена через
                  </p>
                  <p className="text-2xl font-extrabold font-mono text-soft-warning-dark tabular-nums">
                    {formatCountdown(pendingRemainingMs)}
                  </p>
                </div>
              </div>
            </div>

            <ProgressBar
              value={pendingRemainingMs}
              max={PENDING_TIMEOUT_MS}
              color="warning"
            />
          </>
        )}

        {/* ───────── ACCEPTED VIEW (готовка) ───────── */}
        {view === "accepted" && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-soft-success-soft flex items-center justify-center">
                <ChefHat className="w-12 h-12 text-soft-success" />
              </div>
              <p className="text-sm text-soft-text-soft mt-4">
                Ресторан принял ваш заказ и уже готовит.
              </p>

              {prepTime && prepTime > 0 && (
                <div className="mt-6 bg-soft-success-soft border border-soft-success/30 rounded-2xl px-5 py-4 inline-flex items-center gap-3">
                  <Clock className="w-5 h-5 text-soft-success" />
                  <div className="text-left">
                    <p className="text-xs text-soft-text-soft font-bold uppercase tracking-wider">
                      Осталось готовить · {prepTime} мин
                    </p>
                    <p className="text-2xl font-extrabold font-mono text-soft-success-dark tabular-nums">
                      {formatCountdown(prepRemainingMs)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <ProgressBar
              value={prepRemainingMs}
              max={(prepTime || 0) * 60 * 1000}
              color="success"
            />

            <Link
              href={`/order/${o.id}/tracking`}
              className="mt-6 w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-soft-sm"
            >
              Перейти к отслеживанию
              <ChevronRight className="w-4 h-4" />
            </Link>
          </>
        )}

        {/* ───────── EXPIRED VIEW ───────── */}
        {view === "expired" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-soft-accent-soft flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-soft-accent" />
            </div>
            <p className="text-base text-soft-text mt-4 leading-relaxed max-w-md">
              К сожалению, ресторан не успел обработать ваш заказ вовремя.
              <br />
              Пожалуйста, попробуйте сделать заказ в другом заведении.
            </p>

            <Link
              href="/"
              className="mt-6 w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-soft-sm"
            >
              Вернуться к выбору ресторанов
            </Link>
          </div>
        )}

        {/* ───────── CANCELLED VIEW (обычная отмена рестораном) ───────── */}
        {view === "cancelled" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-soft-accent-soft flex items-center justify-center">
              <XCircle className="w-12 h-12 text-soft-accent" />
            </div>
            <p className="text-base text-soft-text mt-4 leading-relaxed max-w-md">
              {o.cancelReason && o.cancelReason !== "AUTO_EXPIRED"
                ? `Заказ отменён. ${o.cancelReason}`
                : "Заказ был отменён."}
            </p>
            <Link
              href="/"
              className="mt-6 w-full h-12 bg-soft-surface border border-soft-border text-soft-text-soft font-bold rounded-2xl flex items-center justify-center gap-2 hover:border-soft-accent"
            >
              Вернуться к выбору ресторанов
            </Link>
          </div>
        )}

        {/* Кнопка обновления */}
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 w-full text-xs text-soft-text-muted hover:text-soft-accent flex items-center justify-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Обновить статус
        </button>
      </section>

      {/* Сводка заказа — всегда видна */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
        <details className="group">
          <summary className="cursor-pointer p-4 flex items-center justify-between text-sm font-bold text-soft-text-soft hover:bg-soft-surface-2 transition-colors list-none">
            <span>Детали заказа</span>
            <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="border-t border-soft-border p-4 space-y-3 text-sm">
            <div className="flex justify-between text-soft-text-soft">
              <span>Сумма</span>
              <span className="text-soft-text font-bold">
                {o.amounts?.total} сом.
              </span>
            </div>
            <div className="flex justify-between text-soft-text-soft gap-3">
              <span className="shrink-0">Адрес</span>
              <span className="text-soft-text truncate text-right">
                {o.deliveryAddress?.city}, {o.deliveryAddress?.address}
              </span>
            </div>
            {o.items && o.items.length > 0 && (
              <div className="pt-2 border-t border-soft-border">
                <p className="text-xs text-soft-text-muted mb-1.5">
                  Состав заказа:
                </p>
                <ul className="space-y-1">
                  {o.items.map((it: any) => (
                    <li
                      key={it.foodId}
                      className="flex justify-between text-soft-text"
                    >
                      <span className="truncate">
                        {it.title}{" "}
                        <span className="text-soft-text-muted">
                          ×{it.quantity}
                        </span>
                      </span>
                      <span className="font-bold shrink-0 ml-2">
                        {it.price * it.quantity} сом.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center space-y-2 py-10 max-w-md mx-auto">
      {children}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: "warning" | "success" | "accent";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const barColor =
    color === "success"
      ? "bg-soft-success"
      : color === "warning"
        ? "bg-soft-warning"
        : "bg-soft-accent";
  return (
    <div className="w-full h-2 bg-soft-surface-2 rounded-full mt-6 overflow-hidden">
      <div
        className={`${barColor} h-full transition-all duration-1000 ease-linear rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
