"use client";

import { useEffect, useState } from "react";
import { useQuery, useSubscription } from "@apollo/client";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { GET_ORDERS, GET_CONFIGURATION, SUB_USER_ORDERS } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABELS, STATUS_STEPS } from "@/lib/order-status";
import { RequireAuth } from "@/components/RequireAuth";
import { useCart } from "@/lib/cart-context";
import { useRouter } from "next/navigation"; // ⭐ FIX: App Router, не Pages Router

type Tab = "active" | "history";

function StatusPills({ status }: { status: string }) {
  if (status === "CANCELLED") return null;
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  return (
    <div className="flex gap-1 mt-3 flex-wrap">
      {STATUS_STEPS.map((step, i) => {
        const passed = i <= idx;
        return (
          <span
            key={step}
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-bold border ${
              passed
                ? "bg-soft-accent-soft border-soft-accent/30 text-soft-accent"
                : "bg-soft-surface-2 border-soft-border text-soft-text-muted"
            }`}
          >
            {STATUS_LABELS[step]}
          </span>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return (
      <span className="inline-flex items-center gap-1 bg-soft-warning-soft text-soft-warning-dark border border-soft-warning/30 text-xs px-2.5 py-1 rounded-full font-bold">
        <Clock className="w-3 h-3" /> Ожидает
      </span>
    );
  if (status === "ACCEPTED")
    return (
      <span className="inline-flex items-center gap-1 bg-soft-purple/10 text-soft-purple border border-soft-purple/20 text-xs px-2.5 py-1 rounded-full font-bold">
        <Package className="w-3 h-3" /> Готовится
      </span>
    );
  if (["ASSIGNED", "PICKED", "AWAITING_CONFIRMATION"].includes(status))
    return (
      <span className="inline-flex items-center gap-1 bg-soft-accent-soft text-soft-accent border border-soft-accent/30 text-xs px-2.5 py-1 rounded-full font-bold">
        <Package className="w-3 h-3" /> В пути
      </span>
    );
  if (status === "DELIVERED")
    return (
      <span className="inline-flex items-center gap-1 bg-soft-success-soft text-soft-success border border-soft-success/30 text-xs px-2.5 py-1 rounded-full font-bold">
        <CheckCircle2 className="w-3 h-3" /> Доставлен
      </span>
    );
  if (status === "CANCELLED")
    return (
      <span className="inline-flex items-center gap-1 bg-red-soft text-red border border-red/30 text-xs px-2.5 py-1 rounded-full font-bold">
        <XCircle className="w-3 h-3" /> Отменён
      </span>
    );
  return null;
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}

function OrdersInner() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("active");

  const { data, loading, refetch } = useQuery(GET_ORDERS, { skip: !user });
  const { data: cfg } = useQuery(GET_CONFIGURATION);

  useSubscription(SUB_USER_ORDERS, {
    variables: { userId: user?.id },
    skip: !user?.id,
    onData: () => refetch(),
  });

  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const orders = data?.orders ?? [];
  const activeOrders = orders.filter(
    (o: any) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );
  const historyOrders = orders.filter((o: any) =>
    ["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );
  const visible = tab === "active" ? activeOrders : historyOrders;

  const { add, clear, restaurantId: cartRestaurantId } = useCart();
  const router = useRouter();

  function repeatOrder(o: any) {
    if (!o.items?.length) return;
    if (cartRestaurantId && cartRestaurantId !== o.restaurantId) {
      if (
        !confirm(
          "В корзине блюда из другого ресторана. Заменить корзину этим заказом?",
        )
      )
        return;
    }
    clear();
    o.items.forEach((i: any) =>
      add({
        foodId: i.foodId,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        restaurantId: o.restaurantId,
        restaurantName: o.restaurantName ?? "",
        selectedOptions: i.selectedOptions,
      }),
    );
    router.push("/cart");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ArrowLeft className="w-4 h-4" /> На главную
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            История заказов
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Статус обновляется автоматически через WebSocket
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Обновить"
          className="w-10 h-10 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-accent hover:border-soft-accent flex items-center justify-center active:scale-95 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex bg-soft-surface border border-soft-border rounded-full p-1.5 shadow-soft-sm">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2.5 rounded-full text-sm font-extrabold transition-all ${
            tab === "active"
              ? "bg-soft-text text-white shadow-soft"
              : "text-soft-text-soft hover:text-soft-text"
          }`}
        >
          🔥 Активные ({activeOrders.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2.5 rounded-full text-sm font-extrabold transition-all ${
            tab === "history"
              ? "bg-soft-text text-white shadow-soft"
              : "text-soft-text-soft hover:text-soft-text"
          }`}
        >
          📦 История ({historyOrders.length})
        </button>
      </div>

      {loading && !orders.length ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-32 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center space-y-3 shadow-soft-sm">
          <div className="text-5xl mb-2">📭</div>
          <h3 className="font-extrabold text-soft-text">
            {tab === "active"
              ? "Активных заказов пока нет"
              : "Истории заказов пока нет"}
          </h3>
          <p className="text-sm text-soft-text-soft">
            {tab === "active"
              ? "Сделайте свой первый заказ из главной страницы"
              : "Завершённые заказы появятся здесь"}
          </p>
          {tab === "active" && (
            <Link
              href="/"
              className="inline-block bg-soft-accent text-white px-5 py-2.5 rounded-2xl text-sm font-extrabold hover:bg-soft-accent-dark transition-colors"
            >
              Выбрать ресторан
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((o: any) => {
            const isPending = o.orderStatus === "PENDING";
            const detailHref = isPending
              ? `/orders/${o.id}/waiting`
              : `/order/${o.id}/tracking`;
            const detailLabel = isPending ? "Ожидание" : "Подробнее";

            return (
              <li
                key={o.id}
                className="bg-soft-surface border border-soft-border rounded-2xl p-5 shadow-soft-sm hover:border-soft-accent transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="font-extrabold text-soft-text text-base">
                      Заказ #{o.orderId}
                    </div>
                    <div className="text-xs text-soft-text-muted">
                      {new Date(o.createdAt).toLocaleString("ru", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm text-soft-text-soft pt-1 truncate">
                      📍 {o.deliveryAddress?.city}, {o.deliveryAddress?.address}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div className="font-extrabold text-soft-accent text-base">
                      {o.amounts?.total} {sym}
                    </div>
                    <Link
                      href={detailHref}
                      className="inline-flex items-center gap-1 bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all"
                    >
                      {detailLabel}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-soft-border flex items-center justify-between flex-wrap gap-2">
                  <StatusBadge status={o.orderStatus} />
                  {isPending && (
                    <span className="inline-flex items-center gap-1 bg-soft-warning-soft text-soft-warning-dark border border-soft-warning/30 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                      <Clock className="w-2.5 h-2.5" /> Ожидает подтверждения
                    </span>
                  )}
                </div>
                <StatusPills status={o.orderStatus} />

                {/* ⭐ NEW: «Заказать снова» — только для истории (доставлен/отменён) */}
                {tab === "history" && o.items?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => repeatOrder(o)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Заказать снова
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
