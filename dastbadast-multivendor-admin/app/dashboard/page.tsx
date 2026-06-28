"use client";
import { useEffect } from "react";
import { useQuery } from "@apollo/client";
import Link from "next/link"; 
import { ADMIN_DASHBOARD } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { NAV_ACCESS } from "@/lib/page-access";
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
} from "lucide-react";

const ACCESS_FOR_DASHBOARD = [
  "SUPER_ADMIN",
  "FINANCE",
  "ANALYST",
  "DISPATCHER",
  "OPERATIONS",
  "SUPPORT",
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

  // Все роли (включая SUPPORT) могут видеть дашборд
  return (
    <div className="space-y-6">
      <DashboardInner />
    </div>
  );
}

function DashboardInner() {
  const { data, loading, error } = useQuery(ADMIN_DASHBOARD, {
    fetchPolicy: "cache-and-network",
    pollInterval: 60000, // обновлять раз в минуту
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

  // Расчёт процентов для графика
  const maxCount = Math.max(...m.chart7Days.map((p: any) => p.count), 1);
  const maxRev = Math.max(...m.chart7Days.map((p: any) => p.revenue), 1);

  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  return (
    <>
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Добро пожаловать, {getFirstName()}
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Сводка по платформе · обновлено только что
          </p>
        </div>
      </div>

      {/* Live-метрики (обновляются часто) */}
      <section>
        <h2 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-soft-success animate-pulse-soft" />
          Прямо сейчас
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            icon={<Receipt className="w-5 h-5" />}
            label="Активные заказы"
            value={m.live.activeOrders}
            tint="bg-soft-accent-soft text-soft-accent border-soft-accent/20"
            big
          />
          <KpiCard
            icon={<Bike className="w-5 h-5" />}
            label="Курьеры в сети"
            value={m.live.activeRiders}
            tint="bg-soft-info-soft text-soft-info border-soft-info/20"
            big
          />
          <KpiCard
            icon={<Store className="w-5 h-5" />}
            label="Рестораны открыты"
            value={m.live.restaurantsOnline}
            tint="bg-soft-purple/10 text-soft-purple border-soft-purple/20"
            big
          />
        </div>
      </section>

      {/* Сегодня */}
      <section>
        <h2 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest mb-3">
          Сегодня
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Receipt className="w-4 h-4" />}
            label="Заказы"
            value={m.today.orders}
            tint="bg-soft-surface-2 text-soft-text border-soft-border"
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Доставлено"
            value={m.today.delivered}
            tint="bg-soft-success-soft text-soft-success border-soft-success/20"
          />
          <KpiCard
            icon={<AlertCircle className="w-4 h-4" />}
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

      {/* Топы */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Топ ресторанов */}
        <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
          <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-soft-accent" />
            Топ ресторанов (30 дней)
          </h2>
          {m.topRestaurants.length === 0 ? (
            <p className="text-sm text-soft-text-soft text-center py-6">
              Нет данных
            </p>
          ) : (
            <ul className="space-y-1.5">
              {m.topRestaurants.map((r: any, i: number) => (
                <li
                  key={r.restaurantId}
                  className="flex items-center gap-3 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5"
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
                    <div className="text-sm font-extrabold text-soft-text truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-soft-text-soft">
                      {r.orderCount} заказов
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-soft-accent shrink-0">
                    {r.revenue.toLocaleString("ru")} {sym}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Топ курьеров */}
        <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
          <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2 mb-3">
            <Bike className="w-4 h-4 text-soft-accent" />
            Топ курьеров (30 дней)
          </h2>
          {m.topRiders.length === 0 ? (
            <p className="text-sm text-soft-text-soft text-center py-6">
              Нет данных
            </p>
          ) : (
            <ul className="space-y-1.5">
              {m.topRiders.map((r: any, i: number) => (
                <li
                  key={r.riderId}
                  className="flex items-center gap-3 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5"
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
                    <div className="text-sm font-extrabold text-soft-text truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-soft-text-soft">
                      {r.deliveredCount} доставок
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-soft-success shrink-0">
                    {r.earnings.toLocaleString("ru")} {sym}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Низ — быстрые ссылки */}
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

function KpiCard({
  icon,
  label,
  value,
  suffix,
  tint,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  tint: string;
  big?: boolean;
}) {
  return (
    <div
      className={`border rounded-3xl ${big ? "p-5" : "p-4"} shadow-soft-sm flex items-center gap-3 ${tint}`}
    >
      <div
        className={`${big ? "w-12 h-12" : "w-10 h-10"} rounded-2xl border flex items-center justify-center shrink-0 bg-soft-surface/40`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider opacity-70 font-extrabold">
          {label}
        </p>
        <p
          className={`${big ? "text-2xl" : "text-xl"} font-black mt-0.5 truncate`}
        >
          {value}
          {suffix && (
            <span className="text-xs ml-1 font-bold opacity-80">{suffix}</span>
          )}
        </p>
      </div>
    </div>
  );
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

