// dastbadast-multivendor-admin/app/dashboard/page.tsx
"use client";
import { useEffect } from "react";
import { useQuery, useSubscription } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_DASHBOARD, SUB_ZONE_ORDERS } from "@/lib/queries";
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
} from "lucide-react";

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
  // ⭐ Опросник: каждые 15 сек (было 60 — слишком редко)
  // + real-time через subscription allDeliveries (для SUPER_ADMIN)
  const { data, loading, error, refetch, subscribeToMore } = useQuery(
    ADMIN_DASHBOARD,
    {
      fetchPolicy: "cache-and-network",
      pollInterval: 15_000,
    },
  );

  // ⭐⭐⭐ РЕАЛЬНОЕ ВРЕМЯ: подписка на обновления заказов → инвалидируем кэш
  // дашборда мгновенно (не дожидаясь 15-сек poll).
  // allDeliveries — это admin-подписка, которая срабатывает на ЛЮБОЕ
  // изменение статуса заказа в системе.
  useEffect(() => {
    if (!subscribeToMore) return;
    const unsubscribe = subscribeToMore({
      document: SUB_ZONE_ORDERS,
      variables: { zoneId: null },
      updateQuery: () => {
        // На любое изменение заказа — форсируем refetch дашборда
        refetch();
        // Возвращаем тот же кэш, refetch обновит его на следующий тик
        return data ?? { adminDashboardMetrics: null };
      },
    });
    return () => unsubscribe?.();
  }, [subscribeToMore, refetch, data]);

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
      {/* Заголовок + real-time индикатор */}
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

      {/* ⭐ НОВОЕ: Новые пользователи сегодня (был пропущен в оригинале) */}
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

      {/* График за 7 дней */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
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
          {m.chart7Days.map((p: any, i: number) => {
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
                  className="w-full bg-soft-surface-2 rounded-lg relative"
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

      {/* Топы — ⭐ КЛИКАБЕЛЬНЫЕ (drill-down на /restaurants/[id] и /riders/[id]) */}
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

      {/* ⭐ НОВОЕ: CTA на карту диспетчера */}
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

      {/* Быстрые переходы */}
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

// ⭐ НОВОЕ: компонент для кликабельных топ-списков (drill-down)
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
        <p className="text-sm text-soft-text-soft">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <Link
          href={hrefBase}
          className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider hover:text-soft-accent"
        >
          Все →
        </Link>
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
        } rounded-2xl border flex items-center justify-center shrink-0 bg-soft-surface/40`}
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
      className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex items-center gap-3 hover:border-soft-accent hover:shadow-soft transition-all group"
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

function getFirstName() {
  try {
    const u = JSON.parse(localStorage.getItem("dbd_admin_owner") || "{}");
    return u?.email?.split("@")[0] || "Админ";
  } catch {
    return "Админ";
  }
}
