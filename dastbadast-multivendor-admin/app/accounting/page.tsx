// dastbadast-multivendor-admin/app/accounting/page.tsx
"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
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
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS } from "@/lib/page-access";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Line,
  LineChart,
} from "recharts";

type PeriodPreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

const PERIOD_PRESETS: { id: PeriodPreset; label: string; days: number }[] = [
  { id: "today", label: "Сегодня", days: 0 },
  { id: "week", label: "Неделя", days: 7 },
  { id: "month", label: "Месяц", days: 30 },
  { id: "quarter", label: "Квартал", days: 90 },
  { id: "year", label: "Год", days: 365 },
];

const PIE_COLORS = [
  "#F26A4A",
  "#F5A623",
  "#6E5BFF",
  "#16A34A",
  "#2D9CDB",
  "#DC5635",
  "#15803D",
  "#5847E0",
];

function formatDateForInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ru");
}

function formatCurrency(n: number | null | undefined, symbol: string): string {
  if (n == null || Number.isNaN(n)) return `— ${symbol}`;
  return `${n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

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

  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState<string>(
    formatDateForInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [customTo, setCustomTo] = useState<string>(
    formatDateForInput(new Date()),
  );

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

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === "custom") {
      return { from: customFrom || null, to: customTo || null };
    }
    if (preset === "today") {
      return { from: formatDateForInput(now), to: formatDateForInput(now) };
    }
    const cfg = PERIOD_PRESETS.find((p) => p.id === preset);
    if (!cfg) return { from: null, to: null };
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - cfg.days);
    return { from: formatDateForInput(fromDate), to: formatDateForInput(now) };
  }, [preset, customFrom, customTo]);

  const { data, loading, error, refetch } = useQuery(ADMIN_ACCOUNTING, {
    variables: { from, to },
    skip: !owner,
    fetchPolicy: "cache-and-network",
  });

  const acc = data?.adminAccounting;
  const sym = "сом.";

  const chartData = useMemo(() => {
    if (!acc) return { revenueByRestaurant: [], earningsByRider: [] };

    const revenueByRestaurant = acc.restaurants.slice(0, 10).map((r: any) => ({
      name:
        r.restaurantName.length > 14
          ? r.restaurantName.slice(0, 12) + "…"
          : r.restaurantName,
      fullName: r.restaurantName,
      revenue: r.revenue,
      commission: r.commission,
      orderCount: r.orderCount,
    }));

    const earningsByRider = acc.riders.slice(0, 10).map((r: any) => ({
      name:
        r.riderName.length > 14 ? r.riderName.slice(0, 12) + "…" : r.riderName,
      fullName: r.riderName,
      earnings: r.totalEarnings,
      deliveredCount: r.deliveredCount,
    }));

    return { revenueByRestaurant, earningsByRider };
  }, [acc]);

  const avgOrderValue = useMemo(() => {
    if (!acc || acc.totalDelivered === 0) return 0;
    return acc.totalRevenue / acc.totalDelivered;
  }, [acc]);

  const shareData = useMemo(() => {
    if (!acc) return [];
    const totalPaidToRestaurants = acc.restaurants.reduce(
      (s: number, r: any) => s + r.payout,
      0,
    );
    const totalPaidToRiders = acc.riders.reduce(
      (s: number, r: any) => s + r.totalEarnings,
      0,
    );
    return [
      { name: "К выплате ресторанам", value: totalPaidToRestaurants },
      { name: "Курьерам", value: totalPaidToRiders },
      { name: "Комиссия платформы", value: acc.totalCommission },
    ].filter((d) => d.value > 0);
  }, [acc]);

  const exportCsvUrl = useCallback(() => {
    if (!owner || typeof window === "undefined") return null;
    const token = storage.get("dbd_admin_token");
    if (!token) return null;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return {
      url: `/api/admin/accounting/export.csv?${params.toString()}`,
      token,
    };
  }, [owner, from, to]);

  const handleExportCsv = useCallback(async () => {
    const url = await exportCsvUrl();
    if (!url) {
      alert("Не удалось сформировать ссылку для экспорта");
      return;
    }
    try {
      const res = await fetch(url.url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${url.token}`,
        },
      });
      if (!res.ok) {
        alert(`Ошибка экспорта: HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `accounting-${from ?? "all"}-to-${to ?? "now"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert(`Ошибка сети: ${e?.message ?? e}`);
    }
  }, [exportCsvUrl, from, to]);

  if (!owner) return null;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-soft-accent" />
            Бухгалтерия
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Сводка по доставленным заказам за выбранный период
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98] self-start"
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Обновить
          </button>
          <button
            onClick={handleExportCsv}
            disabled={loading || !acc}
            className="inline-flex items-center gap-1.5 bg-soft-success hover:bg-soft-success/90 text-white font-extrabold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-soft-sm self-start"
            title="Скачать выгрузку в формате CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт CSV
          </button>
        </div>
      </div>

      {/* Селектор периода */}
      <div className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-soft-text-muted" />
          <h2 className="text-sm font-extrabold text-soft-text">Период</h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {PERIOD_PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  active
                    ? "bg-soft-accent text-white shadow-soft-sm"
                    : "bg-soft-surface-2 text-soft-text-soft hover:bg-soft-accent-soft hover:text-soft-accent border border-soft-border"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            onClick={() => setPreset("custom")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              preset === "custom"
                ? "bg-soft-accent text-white shadow-soft-sm"
                : "bg-soft-surface-2 text-soft-text-soft hover:bg-soft-accent-soft hover:text-soft-accent border border-soft-border"
            }`}
          >
            Произвольный
          </button>
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-soft-border">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-soft-text-soft px-1">
                С даты
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo}
                className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-soft-text-soft px-1">
                По дату
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
              />
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-soft-border flex items-center gap-2 text-2xs text-soft-text-muted">
          <ChevronLeft className="w-3 h-3" />
          <span>
            {from && to
              ? `Период: ${new Date(from).toLocaleDateString("ru")} — ${new Date(to).toLocaleDateString("ru")}`
              : "Весь период"}
          </span>
          <ChevronRight className="w-3 h-3" />
        </div>
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
      ) : error ? (
        <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl p-4 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Ошибка загрузки: {error.message}</span>
        </div>
      ) : acc ? (
        <>
          {/* Метрики */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Оборот платформы"
              value={formatCurrency(acc.totalRevenue, sym)}
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
              value={formatCurrency(acc.totalCommission, sym)}
              tint="bg-soft-success-soft text-soft-success border-soft-success/20"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SecondaryMetric
              label="Средний чек"
              value={formatCurrency(avgOrderValue, sym)}
              tint="bg-soft-surface-2 text-soft-text border-soft-border"
            />
            <SecondaryMetric
              label="Ресторанов активно"
              value={String(acc.restaurants.length)}
              tint="bg-soft-surface-2 text-soft-text border-soft-border"
            />
            <SecondaryMetric
              label="Курьеров активно"
              value={String(acc.riders.length)}
              tint="bg-soft-surface-2 text-soft-text border-soft-border"
            />
            <SecondaryMetric
              label="Заказов на ресторан"
              value={
                acc.restaurants.length > 0
                  ? (acc.totalDelivered / acc.restaurants.length).toFixed(1)
                  : "—"
              }
              tint="bg-soft-surface-2 text-soft-text border-soft-border"
            />
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie */}
            <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
              <h2 className="font-extrabold text-lg text-soft-text mb-3 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-soft-accent" />
                Распределение выручки
              </h2>
              {shareData.length === 0 ? (
                <EmptyState
                  emoji="💰"
                  title="Нет данных за период"
                  hint="Выберите другой период или дождитесь доставленных заказов"
                />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={shareData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      // ⭐ FIX: percent может быть undefined в типах recharts
                      label={({ name, percent }) =>
                        `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {shareData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    {/* ⭐ FIX: value: number | undefined в типах recharts */}
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), sym)
                      }
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #ECE6DA",
                        borderRadius: 14,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Bar: рестораны */}
            <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
              <h2 className="font-extrabold text-lg text-soft-text mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-soft-accent" />
                Топ-10 ресторанов по выручке
              </h2>
              {chartData.revenueByRestaurant.length === 0 ? (
                <EmptyState
                  emoji="🍽"
                  title="Нет данных"
                  hint="В выбранном периоде нет доставленных заказов"
                />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={chartData.revenueByRestaurant}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#9A9388" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#6B6358" }}
                      width={80}
                    />
                    {/* ⭐ FIX: value: number | undefined */}
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), sym)
                      }
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as any;
                        return item?.fullName ?? "";
                      }}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #ECE6DA",
                        borderRadius: 14,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#F26A4A"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          {/* Таблица: рестораны */}
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
                          {formatCurrency(r.revenue, sym)}
                        </td>
                        <td className="py-3 pr-4 text-right text-soft-accent font-extrabold">
                          {formatCurrency(r.commission, sym)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span className="inline-flex items-center gap-1 bg-soft-success-soft text-soft-success border border-soft-success/20 px-2 py-0.5 rounded-full font-extrabold text-xs">
                            <ArrowDownToLine className="w-3 h-3" />
                            {formatCurrency(r.payout, sym)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Таблица: курьеры + график */}
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
              <>
                <div className="overflow-x-auto -mx-5 px-5 scrollbar-thin mb-4">
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
                              {formatCurrency(r.totalEarnings, sym)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {chartData.earningsByRider.length > 0 && (
                  <div className="pt-3 border-t border-soft-border">
                    <h3 className="text-sm font-extrabold text-soft-text mb-3">
                      Топ-10 курьеров по заработку
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={chartData.earningsByRider}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "#9A9388" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#6B6358" }}
                          width={80}
                        />
                        {/* ⭐ FIX: value: number | undefined */}
                        <Tooltip
                          formatter={(value) =>
                            formatCurrency(Number(value ?? 0), sym)
                          }
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload as any;
                            return `${item?.fullName ?? ""} (${item?.deliveredCount ?? 0} доставок)`;
                          }}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #ECE6DA",
                            borderRadius: 14,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="earnings"
                          fill="#16A34A"
                          radius={[0, 8, 8, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
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

function SecondaryMetric({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={`border rounded-2xl px-4 py-3 ${tint}`}>
      <p className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-extrabold text-soft-text mt-1 truncate">
        {value}
      </p>
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

const storage = {
  get(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
};
