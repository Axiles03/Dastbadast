// dastbadast-multivendor-admin/app/dashboard/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useSubscription } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ADMIN_DASHBOARD,
  SUB_ZONE_ORDERS,
  CHURN_RATE,
  DEMAND_FORECAST,
  USER_COHORTS,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  TrendingUp,
  Users,
  Receipt,
  Bike,
  Store,
  Wallet,
  Loader2,
  ChevronRight,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Activity,
  UserPlus,
  CheckCircle2,
  XCircle,
  MapPin,
  TrendingDown,
  TrendingUp as TrendUp,
  Sparkles,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  ComposedChart,
} from "recharts";

const ACCESS_FOR_DASHBOARD = [
  "SUPER_ADMIN",
  "FINANCE",
  "ANALYST",
  "DISPATCHER",
  "OPERATIONS",
];

export default function DashboardPage() {
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

  return (
    <div className="space-y-6">
      <DashboardInner />
    </div>
  );
}

function DashboardInner() {
  const { owner } = useAuth();
  const { data, loading, error, refetch, subscribeToMore } = useQuery(
    ADMIN_DASHBOARD,
    {
      fetchPolicy: "cache-and-network",
      pollInterval: 15_000,
    },
  );

  useEffect(() => {
    if (!subscribeToMore) return;
    const unsubscribe = subscribeToMore({
      document: SUB_ZONE_ORDERS,
      variables: { zoneId: null },
      updateQuery: () => {
        refetch();
        return data ?? { adminDashboardMetrics: null };
      },
    });
    return () => unsubscribe?.();
  }, [subscribeToMore, refetch, data]);

  // ⭐ NEW: 3 параллельных запроса для новых секций
  const [forecastDays, setForecastDays] = useState<number>(7);
  const [churnPeriod, setChurnPeriod] = useState<number>(30);

  const { data: churnData } = useQuery(CHURN_RATE, {
    variables: { period: churnPeriod },
    skip: !owner,
    fetchPolicy: "cache-and-network",
  });
  const { data: forecastData } = useQuery(DEMAND_FORECAST, {
    variables: { days: forecastDays },
    skip: !owner,
    fetchPolicy: "cache-and-network",
  });
  const { data: cohortsData } = useQuery(USER_COHORTS, {
    variables: { months: 3 },
    skip: !owner,
    fetchPolicy: "cache-and-network",
  });

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-28 rounded-3xl animate-pulse"
            />
          ))}
        </div>
        <div className="bg-soft-surface border border-soft-border h-64 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-soft-accent-soft border border-soft-accent/20 rounded-3xl p-6 text-soft-accent text-sm font-semibold flex gap-2">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        Не удалось загрузить дашборд: {error.message}
      </div>
    );
  }

  const m = data?.adminDashboardMetrics;
  if (!m) return null;
  const sym = "сом.";

  const maxCount = Math.max(...m.chart7Days.map((p: any) => p.count), 1);
  const maxRev = Math.max(...m.chart7Days.map((p: any) => p.revenue), 1);
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  return (
    <>
      {/* Шапка с real-time */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Добро пожаловать, {getFirstName()}
          </h1>
          <p className="text-sm text-soft-text-soft mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-soft-success animate-pulse-soft" />
            Сводка по платформе · обновляется в реальном времени
          </p>
        </div>
      </div>

      {/* Live-метрики */}
      <section>
        <h2 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Прямо сейчас
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            icon={<Receipt className="w-5 h-5" />}
            label="Активные заказы"
            value={m.live.activeOrders}
            tint="bg-soft-accent-soft text-soft-accent border-soft-accent/20"
            big
            href="/dispatch"
          />
          <KpiCard
            icon={<Bike className="w-5 h-5" />}
            label="Курьеры в сети"
            value={m.live.activeRiders}
            tint="bg-soft-info-soft text-soft-info border-soft-info/20"
            big
            href="/riders"
          />
          <KpiCard
            icon={<Store className="w-5 h-5" />}
            label="Рестораны открыты"
            value={m.live.restaurantsOnline}
            tint="bg-soft-purple/10 text-soft-purple border-soft-purple/20"
            big
            href="/restaurants"
          />
        </div>
      </section>

      {/* Сегодня */}
      <section>
        <h2 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
          📅 Сегодня
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Receipt className="w-4 h-4" />}
            label="Заказы"
            value={m.today.orders}
            tint="bg-soft-surface-2 text-soft-text border-soft-border"
          />
          <KpiCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Доставлено"
            value={m.today.delivered}
            tint="bg-soft-success-soft text-soft-success border-soft-success/20"
          />
          <KpiCard
            icon={<XCircle className="w-4 h-4" />}
            label="Отменено"
            value={m.today.cancelled}
            tint="bg-soft-accent-soft text-soft-accent border-soft-accent/20"
          />
          <KpiCard
            icon={<Wallet className="w-4 h-4" />}
            label="Выручка"
            value={`${m.today.revenue.toLocaleString("ru")}`}
            suffix={sym}
            tint="bg-soft-rating-soft text-soft-rating-dark border-soft-rating/20"
          />
        </div>
      </section>

      {/* Новые пользователи */}
      <section>
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-soft-accent-soft text-soft-accent flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xs text-soft-text-muted font-extrabold uppercase tracking-wider">
              Новых клиентов сегодня
            </p>
            <p className="text-3xl font-black text-soft-text mt-0.5">
              {m.newUsersToday ?? 0}
            </p>
          </div>
          <Link
            href="/users"
            className="text-xs font-extrabold text-soft-accent hover:underline flex items-center gap-1"
          >
            Все клиенты
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* График за 7 дней (был) */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-soft-accent" />
            Активность за 7 дней
          </h2>
          <Link
            href="/accounting"
            className="text-xs text-soft-accent hover:underline font-bold flex items-center gap-0.5"
          >
            Подробнее <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2 h-40 items-end">
          {m.chart7Days.map((p: any, i: any) => {
            const date = new Date(p.date);
            const dayName = dayNames[date.getDay()];
            const heightPct = maxCount > 0 ? (p.count / maxCount) * 100 : 0;
            return (
              <div
                key={p.date}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="text-[10px] text-soft-text-soft font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.count} · {p.revenue.toLocaleString("ru")}
                </div>
                <div
                  className="w-full h-full bg-soft-surface-2 rounded-lg relative"
                  style={{ height: "110px" }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-soft-accent to-soft-accent/70 rounded-lg transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <div className="text-xs font-extrabold text-soft-text-soft">
                  {dayName}
                </div>
                <div className="text-[10px] text-soft-text-muted">
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ⭐ NEW: 2-колоночная сетка — Churn + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Churn rate */}
        <ChurnCard
          data={churnData?.churnRate}
          period={churnPeriod}
          onPeriodChange={setChurnPeriod}
        />

        {/* Demand forecast */}
        <ForecastCard
          data={forecastData?.demandForecast}
          days={forecastDays}
          onDaysChange={setForecastDays}
        />
      </div>

      {/* ⭐ NEW: Retention heatmap (3 мес) — на всю ширину */}
      <CohortHeatmapCard data={cohortsData?.userCohorts} />
      {/* Топы — были, оставляем как есть */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DrillableSection
          title="Топ ресторанов (30 дней)"
          icon={<Store className="w-4 h-4 text-soft-accent" />}
          items={m.topRestaurants}
          valueKey="revenue"
          valueLabel="Выручка"
          secondaryKey="orderCount"
          secondaryLabel="заказов"
          hrefBase="/restaurants"
          emptyText="Нет данных"
        />
        <DrillableSection
          title="Топ курьеров (30 дней)"
          icon={<Bike className="w-4 h-4 text-soft-accent" />}
          items={m.topRiders}
          valueKey="earnings"
          valueLabel="Заработано"
          secondaryKey="deliveredCount"
          secondaryLabel="доставок"
          hrefBase="/riders"
          emptyText="Нет данных"
        />
      </div>

      {/* CTA на карту и быстрые переходы — оставляем как есть */}
      <section>
        <Link
          href="/map"
          className="block bg-soft-info text-white rounded-3xl p-5 shadow-soft-sm hover:shadow-soft transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <MapPin className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-extrabold uppercase tracking-wider opacity-80">
                Диспетчер
              </p>
              <p className="text-lg font-extrabold mt-0.5">
                Карта в реальном времени
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Курьеры · заказы · рестораны на одной карте
              </p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <section>
        <h2 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest mb-3">
          Быстрые переходы
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink
            href="/dispatch"
            icon={<Receipt className="w-5 h-5" />}
            label="Мониторинг"
            tint="bg-soft-accent-soft text-soft-accent"
          />
          <QuickLink
            href="/restaurants"
            icon={<Store className="w-5 h-5" />}
            label="Рестораны"
            tint="bg-soft-purple/10 text-soft-purple"
          />
          <QuickLink
            href="/riders"
            icon={<Bike className="w-5 h-5" />}
            label="Курьеры"
            tint="bg-soft-info-soft text-soft-info"
          />
          <QuickLink
            href="/accounting"
            icon={<Wallet className="w-5 h-5" />}
            label="Бухгалтерия"
            tint="bg-soft-success-soft text-soft-success"
          />
        </div>
      </section>
    </>
  );
}

// =============================================================
// ⭐ NEW: Компоненты спринта 1.3
// =============================================================

function ChurnCard({
  data,
  period,
  onPeriodChange,
}: {
  data: any;
  period: number;
  onPeriodChange: (p: number) => void;
}) {
  const pct = data?.churnRatePct ?? 0;
  // ⭐ Цвет: зелёный (< 20%), жёлтый (20-40%), красный (> 40%)
  const tone =
    pct < 20
      ? {
          color: "#16A34A",
          label: "🟢 Отличный retention",
          bg: "bg-soft-success-soft border-soft-success/30",
        }
      : pct < 40
        ? {
            color: "#F5A623",
            label: "🟡 Нормальный уровень",
            bg: "bg-soft-warning-soft border-soft-warning/30",
          }
        : {
            color: "#DC2626",
            label: "🔴 Высокий churn",
            bg: "bg-soft-accent-soft border-soft-accent/30",
          };

  return (
    <section
      className={`bg-soft-surface border ${tone.bg} rounded-3xl p-5 shadow-soft-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-soft-accent" />
          Churn rate
        </h2>
        <select
          value={period}
          onChange={(e) => onPeriodChange(parseInt(e.target.value, 10))}
          className="text-xs font-bold bg-soft-surface-2 border border-soft-border rounded-full px-3 py-1 text-soft-text focus:outline-none focus:border-soft-accent"
        >
          <option value={14}>14 дн</option>
          <option value={30}>30 дн</option>
          <option value={60}>60 дн</option>
          <option value={90}>90 дн</option>
        </select>
      </div>

      <div className="flex items-center gap-4">
        {/* Gauge-индикатор (большой круг) */}
        <div
          className="relative w-32 h-32 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: `conic-gradient(${tone.color} ${pct * 3.6}deg, #F4EFE7 0deg)`,
          }}
        >
          <div className="absolute inset-2 bg-soft-surface rounded-full flex flex-col items-center justify-center">
            <p className="text-2xl font-black" style={{ color: tone.color }}>
              {pct}%
            </p>
            <p className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
              churn
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-sm">
          <p className="font-extrabold text-base" style={{ color: tone.color }}>
            {tone.label}
          </p>
          <div className="space-y-1.5 text-xs">
            <Row
              label="Активных в начале"
              value={String(data?.activeAtStart ?? 0)}
            />
            <Row
              label="Ушли в отток"
              value={String(data?.churned ?? 0)}
              color="text-soft-accent"
            />
            <Row
              label="Остались активны"
              value={String(data?.retained ?? 0)}
              color="text-soft-success"
            />
            <Row
              label="Среднее заказов у retained"
              value={String(data?.avgOrdersPerRetained ?? 0)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ForecastCard({
  data,
  days,
  onDaysChange,
}: {
  data: any;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const totals = data?.totals;
  const forecast = data?.forecast ?? [];
  const history = data?.history ?? [];

  // ⭐ Объединяем историю + прогноз для единой линии графика
  const chartData = useMemo(() => {
    const series: Array<{
      date: string;
      history?: number;
      forecast?: number;
    }> = [];
    for (const h of history) {
      series.push({ date: h.date.slice(5), history: h.revenue });
    }
    for (const f of forecast) {
      series.push({ date: f.date.slice(5), forecast: f.predictedRevenue });
    }
    return series;
  }, [history, forecast]);

  const trendPct = totals?.trendPct ?? 0;
  const isUp = trendPct > 0;

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-soft-accent" />
          Прогноз спроса
        </h2>
        <select
          value={days}
          onChange={(e) => onDaysChange(parseInt(e.target.value, 10))}
          className="text-xs font-bold bg-soft-surface-2 border border-soft-border rounded-full px-3 py-1 text-soft-text focus:outline-none focus:border-soft-accent"
        >
          <option value={3}>3 дня</option>
          <option value={7}>7 дней</option>
          <option value={14}>14 дней</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <MetricChip
          label={`Прогноз на ${days} дн`}
          value={`${(totals?.totalForecastRevenue ?? 0).toLocaleString("ru")} ${"сом."}`}
        />
        <MetricChip
          label="Средн. в день"
          value={`${(totals?.avgDailyRevenue ?? 0).toLocaleString("ru")} ${"сом."}`}
        />
        <MetricChip
          label="Тренд"
          value={`${isUp ? "+" : ""}${trendPct}%`}
          tint={isUp ? "text-soft-success" : "text-soft-accent"}
        />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1ECE3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#9A9388" }}
            interval={Math.ceil(chartData.length / 8)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#9A9388" }}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={40}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = name === "history" ? "История" : "Прогноз";
              return [
                `${Math.round(Number(value || 0)).toLocaleString("ru")} сом.`,
                n,
              ];
            }}
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #ECE6DA",
              borderRadius: 14,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* ⭐ FIX: value: number | undefined (см. ошибки из прошлого спринта) */}
          <Area
            type="monotone"
            dataKey="history"
            stroke="#F26A4A"
            fill="#F26A4A"
            fillOpacity={0.2}
            name="История"
            strokeWidth={2}
            isAnimationActive={false}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#6E5BFF"
            strokeWidth={2}
            strokeDasharray="6 3"
            name="Прогноз"
            dot={{ r: 3, fill: "#6E5BFF" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

function CohortHeatmapCard({ data }: { data: any }) {
  const cohorts = data?.cohorts ?? [];
  const maxMonths = data?.months ?? 3;

  function colorForRetention(pct: number): string {
    if (pct === 0) return "bg-soft-surface-2 text-soft-text-muted";
    if (pct >= 70) return "bg-emerald-700 text-white";
    if (pct >= 50) return "bg-emerald-500 text-white";
    if (pct >= 35) return "bg-emerald-300 text-emerald-900";
    if (pct >= 20) return "bg-amber-300 text-amber-900";
    if (pct >= 10) return "bg-orange-300 text-orange-900";
    if (pct > 0) return "bg-red-200 text-red-900";
    return "bg-soft-surface-2 text-soft-text-muted";
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
          <Calendar className="w-4 h-4 text-soft-accent" />
          Retention по когортам (3 мес)
        </h2>
        <Link
          href="/users/cohorts"
          className="text-xs font-extrabold text-soft-accent hover:underline flex items-center gap-0.5"
        >
          Полная таблица <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {cohorts.length === 0 ? (
        <div className="text-center py-6 text-soft-text-soft text-sm">
          📉 Недостаточно данных для когорт
        </div>
      ) : (
        <table className="w-full text-xs min-w-[400px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-soft-text-muted font-extrabold px-2 py-1">
                Когорта
              </th>
              <th className="text-right text-soft-text-muted font-extrabold px-2 py-1">
                👥
              </th>
              {Array.from({ length: maxMonths + 1 }).map((_, idx) => (
                <th
                  key={idx}
                  className="text-center text-soft-text-muted font-extrabold px-2 py-1 min-w-[60px]"
                >
                  M{idx}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c: any) => (
              <tr key={c.month}>
                <td className="font-extrabold text-soft-text px-2 py-1">
                  {c.month}
                </td>
                <td className="text-right font-extrabold text-soft-text px-2 py-1">
                  {c.totalUsers}
                </td>
                {c.retentionByMonth.map((pct: number, idx: number) => (
                  <td
                    key={idx}
                    className={`text-center font-extrabold rounded-lg px-2 py-1 ${colorForRetention(pct)}`}
                  >
                    {pct > 0 ? `${pct}%` : "—"}
                  </td>
                ))}
                {Array.from({
                  length: Math.max(0, maxMonths - c.retentionByMonth.length),
                }).map((_, i) => (
                  <td
                    key={`empty-${i}`}
                    className="text-center text-soft-text-muted px-2 py-1"
                  >
                    —
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  color = "text-soft-text",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-soft-text-muted">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MetricChip({
  label,
  value,
  tint = "",
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="bg-soft-surface-2 border border-soft-border rounded-2xl px-3 py-2.5">
      <p className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-sm font-extrabold mt-0.5 ${tint || "text-soft-text"}`}
      >
        {value}
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  suffix,
  tint,
  big,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  tint: string;
  big?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`border rounded-3xl ${
        big ? "p-5" : "p-4"
      } shadow-soft-sm flex items-center gap-3 ${tint} ${
        href ? "hover:shadow-soft transition-all cursor-pointer" : ""
      }`}
    >
      <div
        className={`${
          big ? "w-12 h-12" : "w-10 h-10"
        } rounded-2xl border flex items-center justify-center bg-soft-surface/40 shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider opacity-70 font-extrabold">
          {label}
        </p>
        <p
          className={`${
            big ? "text-2xl" : "text-xl"
          } font-black mt-0.5 truncate`}
        >
          {value}
          {suffix && (
            <span className="text-xs ml-1 font-bold opacity-80">{suffix}</span>
          )}
        </p>
      </div>
      {href && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function QuickLink({
  href,
  icon,
  label,
  tint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tint: string;
}) {
  return (
    <Link
      href={href}
      className={`bg-soft-surface border border-soft-border rounded-2xl p-4 flex items-center gap-3 hover:border-soft-accent hover:shadow-soft transition-all group`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}
      >
        {icon}
      </div>
      <span className="text-sm font-extrabold text-soft-text flex-1">
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-soft-text-muted group-hover:text-soft-accent" />
    </Link>
  );
}

function DrillableSection({
  title,
  icon,
  items,
  valueKey,
  valueLabel,
  secondaryKey,
  secondaryLabel,
  hrefBase,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  valueKey: string;
  valueLabel: string;
  secondaryKey: string;
  secondaryLabel: string;
  hrefBase: string;
  emptyText: string;
}) {
  if (!items || items.length === 0) {
    return (
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
        <div className="text-4xl mb-2">📊</div>
        <h3 className="font-extrabold text-soft-text">{emptyText}</h3>
      </section>
    );
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
          {icon}
          {title}
        </h2>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((it: any, i: number) => {
          const id = it.restaurantId || it.riderId;
          const name = it.name;
          return (
            <li key={id || i}>
              <Link
                href={`${hrefBase}/${id}`}
                className="flex items-center gap-3 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5 hover:border-soft-accent hover:bg-soft-accent-soft/50 transition-all group"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                    i === 0
                      ? "bg-soft-rating text-white"
                      : "bg-soft-surface text-soft-text-muted border border-soft-border"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-soft-text truncate group-hover:text-soft-accent transition-colors">
                    {name}
                  </div>
                  <div className="text-xs text-soft-text-soft">
                    {it[secondaryKey]} {secondaryLabel}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-soft-accent">
                    {it[valueKey]?.toLocaleString?.("ru") || it[valueKey]} сом.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-soft-text-muted group-hover:text-soft-accent shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function getFirstName() {
  try {
    const u = JSON.parse(localStorage.getItem("dbd_admin_owner") || "{}");
    return u?.email?.split("@")[0] || "Админ";
  } catch {
    return "Админ";
  }
}
