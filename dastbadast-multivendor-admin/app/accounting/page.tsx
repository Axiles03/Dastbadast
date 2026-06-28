"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import { ADMIN_ACCOUNTING } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  Wallet,
  TrendingUp,
  Users,
  Bike,
  Store,
  Percent,
  RefreshCw,
  Loader2,
  Trophy,
  Receipt,
  ArrowDownToLine,
  Banknote,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS } from "@/lib/page-access";

export default function AccountingPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.accounting}>
      <AccountingInner />
    </RoleGate>
  );
}

function AccountingInner() {
  const { owner, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, loading, refetch } = useQuery(ADMIN_ACCOUNTING, {
    skip: !owner,
    pollInterval: 30000,
  });

  useEffect(() => {
    document.body.style.backgroundColor = "#FAF7F2";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authLoading && !owner) router.push("/login");
  }, [owner, authLoading, router]);

  if (!owner) return null;

  const acc = data?.adminAccounting;
  const sym = "сом.";

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-soft-accent" />
            Бухгалтерия
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Сводка по доставленным заказам (DELIVERED). Обновляется каждые 30с
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98] self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Обновить
        </button>
      </div>

      {loading && !acc ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-28 rounded-3xl animate-pulse"
            />
          ))}
        </div>
      ) : acc ? (
        <>
          {/* Метрики */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Оборот платформы"
              value={`${acc.totalRevenue.toLocaleString("ru")} ${sym}`}
              tint="bg-soft-accent-soft text-soft-accent border-soft-accent/20"
            />
            <KpiCard
              icon={<Receipt className="w-5 h-5" />}
              label="Доставлено заказов"
              value={String(acc.totalDelivered)}
              tint="bg-soft-info-soft text-soft-info border-soft-info/20"
            />
            <KpiCard
              icon={<Percent className="w-5 h-5" />}
              label="Комиссия платформы"
              value={`${acc.totalCommission.toLocaleString("ru")} ${sym}`}
              tint="bg-soft-success-soft text-soft-success border-soft-success/20"
            />
          </div>

          {/* Рестораны */}
          <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
            <div className="flex items-center justify-between gap-2 border-b border-soft-border pb-3 mb-3">
              <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
                <Store className="w-4 h-4 text-soft-accent" />
                Выработка ресторанов
              </h2>
              <span className="text-xs text-soft-text-muted font-bold">
                {acc.restaurants.length}{" "}
                {acc.restaurants.length === 1
                  ? "заведение"
                  : acc.restaurants.length < 5
                    ? "заведения"
                    : "заведений"}
              </span>
            </div>
            {acc.restaurants.length === 0 ? (
              <EmptyState
                emoji="🍽"
                title="Нет доставленных заказов"
                hint="После доставки заказов появится статистика по ресторанам"
              />
            ) : (
              <div className="overflow-x-auto -mx-5 px-5 scrollbar-thin">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-soft-text-muted text-[10px] uppercase tracking-wider">
                      <th className="py-2 pr-4 font-extrabold">Ресторан</th>
                      <th className="py-2 pr-4 text-right font-extrabold">
                        Заказов
                      </th>
                      <th className="py-2 pr-4 text-right font-extrabold">
                        Оборот
                      </th>
                      <th className="py-2 pr-4 text-right font-extrabold">
                        Комиссия
                      </th>
                      <th className="py-2 pl-4 text-right font-extrabold">
                        К выплате
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {acc.restaurants.map((r: any, idx: number) => (
                      <tr
                        key={r.restaurantId}
                        className="border-t border-soft-border hover:bg-soft-surface-2/40 transition-colors"
                      >
                        <td className="py-3 pr-4 font-extrabold text-soft-text">
                          <div className="flex items-center gap-2">
                            {idx === 0 && acc.restaurants.length > 1 && (
                              <Trophy className="w-3.5 h-3.5 text-soft-rating" />
                            )}
                            {r.restaurantName}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right text-soft-text-soft font-semibold">
                          {r.orderCount}
                        </td>
                        <td className="py-3 pr-4 text-right text-soft-text font-bold">
                          {r.revenue.toLocaleString("ru")} {sym}
                        </td>
                        <td className="py-3 pr-4 text-right text-soft-accent font-extrabold">
                          {r.commission.toLocaleString("ru")} {sym}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span className="inline-flex items-center gap-1 bg-soft-success-soft text-soft-success border border-soft-success/20 px-2 py-0.5 rounded-full font-extrabold text-xs">
                            <ArrowDownToLine className="w-3 h-3" />
                            {r.payout.toLocaleString("ru")} {sym}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Курьеры */}
          <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
            <div className="flex items-center justify-between gap-2 border-b border-soft-border pb-3 mb-3">
              <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
                <Bike className="w-4 h-4 text-soft-accent" />
                Курьерские выплаты
              </h2>
              <span className="text-xs text-soft-text-muted font-bold">
                {acc.riders.length}{" "}
                {acc.riders.length === 1
                  ? "курьер"
                  : acc.riders.length < 5
                    ? "курьера"
                    : "курьеров"}
              </span>
            </div>
            {acc.riders.length === 0 ? (
              <EmptyState
                emoji="🛵"
                title="Нет завершённых доставок"
                hint="Курьеры появятся в отчёте после доставки заказов"
              />
            ) : (
              <div className="overflow-x-auto -mx-5 px-5 scrollbar-thin">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-soft-text-muted text-[10px] uppercase tracking-wider">
                      <th className="py-2 pr-4 font-extrabold">Курьер</th>
                      <th className="py-2 pr-4 font-extrabold">Телефон</th>
                      <th className="py-2 pr-4 text-right font-extrabold">
                        Доставок
                      </th>
                      <th className="py-2 pl-4 text-right font-extrabold">
                        Начислено
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {acc.riders.map((r: any, idx: number) => (
                      <tr
                        key={r.riderId}
                        className="border-t border-soft-border hover:bg-soft-surface-2/40 transition-colors"
                      >
                        <td className="py-3 pr-4 font-extrabold text-soft-text">
                          <div className="flex items-center gap-2">
                            {idx === 0 && acc.riders.length > 1 && (
                              <Trophy className="w-3.5 h-3.5 text-soft-rating" />
                            )}
                            {r.riderName}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-soft-text-soft font-medium">
                          {r.phone || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right text-soft-text-soft font-semibold">
                          {r.deliveredCount}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span className="inline-flex items-center gap-1 bg-soft-success-soft text-soft-success border border-soft-success/20 px-2.5 py-0.5 rounded-full font-extrabold text-sm">
                            <Banknote className="w-3 h-3" />
                            {r.totalEarnings.toLocaleString("ru")} {sym}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center text-soft-text-soft">
          Нет данных
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm flex items-center gap-4 hover:shadow-soft transition-all">
      <div
        className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${tint}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-soft-text-muted font-extrabold">
          {label}
        </p>
        <p className="text-xl md:text-2xl font-black mt-1 text-soft-text truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="py-10 text-center space-y-1">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="text-sm font-extrabold text-soft-text">{title}</p>
      <p className="text-xs text-soft-text-soft">{hint}</p>
    </div>
  );
}
