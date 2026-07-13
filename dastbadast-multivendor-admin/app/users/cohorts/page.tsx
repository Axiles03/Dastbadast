// dastbadast-multivendor-admin/app/users/cohorts/page.tsx
"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { USER_COHORTS } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Info,
  Users,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS } from "@/lib/page-access";

export default function CohortsPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.users}>
      <CohortsInner />
    </RoleGate>
  );
}

function CohortsInner() {
  const { owner, loading: authLoading } = useAuth();
  const router = useRouter();

  // ⭐ Селектор кол-ва месяцев (3 / 6 / 12)
  const [months, setMonths] = useState<number>(6);

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

  const { data, loading, refetch } = useQuery(USER_COHORTS, {
    variables: { months },
    skip: !owner,
  });

  const cohorts = data?.userCohorts?.cohorts ?? [];
  const maxMonths = data?.userCohorts?.months ?? months;

  // ⭐ Цвет ячейки retention: 100% = тёмно-зелёный, 0% = бледно-красный
  // Используем linear interpolation между зелёным (16, 185, 129) и красным
  // (252, 165, 165) по шкале retention%.
  function colorForRetention(pct: number): string {
    // 0% → светло-красный (bg-red-200), 100% → тёмно-зелёный (bg-emerald-700)
    // Используем готовые Tailwind-классы, чтобы не задавать hex вручную.
    if (pct === 0) return "bg-soft-surface-2 text-soft-text-muted";
    if (pct >= 70) return "bg-emerald-700 text-white";
    if (pct >= 50) return "bg-emerald-500 text-white";
    if (pct >= 35) return "bg-emerald-300 text-emerald-900";
    if (pct >= 20) return "bg-amber-300 text-amber-900";
    if (pct >= 10) return "bg-orange-300 text-orange-900";
    if (pct > 0) return "bg-red-200 text-red-900";
    return "bg-soft-surface-2 text-soft-text-muted";
  }

  // ⭐ Средний retention по колонке (для подписи снизу heatmap)
  const columnAverages = useMemo(() => {
    if (cohorts.length === 0) return [];
    const maxCols = Math.max(
      ...cohorts.map((c: any) => c.retentionByMonth.length),
      0,
    );
    const averages: number[] = [];
    for (let i = 0; i < maxCols; i++) {
      const values = cohorts
        .map((c: any) => c.retentionByMonth[i])
        .filter((v: any) => typeof v === "number" && v > 0);
      if (values.length === 0) {
        averages.push(0);
      } else {
        averages.push(
          +(
            values.reduce((s: number, v: number) => s + v, 0) / values.length
          ).toFixed(1),
        );
      }
    }
    return averages;
  }, [cohorts]);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/users")}
            className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> К списку клиентов
          </button>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-soft-accent" />
            Когортный анализ retention
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Каждая строка — группа пользователей по месяцу первого заказа.
            Ячейка — % от них, вернувшихся через N месяцев.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 bg-soft-surface border border-soft-border rounded-full p-1">
            {[3, 6, 12].map((m) => {
              const active = months === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    active
                      ? "bg-soft-accent text-white"
                      : "text-soft-text-soft hover:text-soft-text"
                  }`}
                >
                  {m} мес
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-colors active:scale-[0.98]"
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Обновить
          </button>
        </div>
      </div>

      {/* Подсказка-легенда */}
      <div className="bg-soft-info-soft border border-soft-info/20 rounded-2xl p-3.5 flex items-start gap-2 text-sm text-soft-info">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p>
            <strong className="text-soft-text">Как читать:</strong> первая
            колонка всегда 100% (все юзеры когорты активны в месяц регистрации).
            Чем ярче ячейка — тем выше retention.
          </p>
          <p className="text-2xs">
            <strong>Аналитика:</strong> если retention 2-го месяца резко падает
            (ниже 15%) — клиенты не возвращаются. Ищите причины: плохое качество
            еды, высокие цены доставки, баги в приложении.
          </p>
        </div>
      </div>

      {loading && cohorts.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl h-64 animate-pulse" />
      ) : cohorts.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
          <div className="text-5xl mb-2">📉</div>
          <h3 className="text-base font-extrabold text-soft-text">
            Недостаточно данных для когортного анализа
          </h3>
          <p className="text-sm text-soft-text-soft mt-1">
            Когорты строятся, когда есть клиенты с заказами в разных календарных
            месяцах. Подождите, пока накопится история.
          </p>
        </div>
      ) : (
        <>
          {/* Метрики сверху */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricChip
              icon={<Users className="w-4 h-4" />}
              label="Всего клиентов"
              value={cohorts.reduce((s: number, c: any) => s + c.totalUsers, 0)}
              tint="bg-soft-accent-soft border-soft-accent/20 text-soft-accent"
            />
            <MetricChip
              icon={<Calendar className="w-4 h-4" />}
              label="Когорт"
              value={cohorts.length}
              tint="bg-soft-info-soft border-soft-info/20 text-soft-info"
            />
            <MetricChip
              icon={<TrendingUp className="w-4 h-4" />}
              label="Средний M1 retention"
              value={columnAverages[1] != null ? `${columnAverages[1]}%` : "—"}
              tint="bg-soft-success-soft border-soft-success/20 text-soft-success"
            />
            <MetricChip
              icon={<TrendingUp className="w-4 h-4" />}
              label="Средний M2 retention"
              value={columnAverages[2] != null ? `${columnAverages[2]}%` : "—"}
              tint="bg-soft-rating-soft border-soft-rating/20 text-soft-rating-dark"
            />
          </div>

          {/* Heatmap */}
          <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm overflow-x-auto">
            <h2 className="text-lg font-extrabold text-soft-text mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-soft-accent" />
              Когорты по месяцам
            </h2>
            <table className="w-full text-xs min-w-[640px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-soft-text-muted font-extrabold px-2 py-1 sticky left-0 bg-soft-surface z-10">
                    Когорта
                  </th>
                  <th className="text-right text-soft-text-muted font-extrabold px-2 py-1">
                    👥 Юзеров
                  </th>
                  {Array.from({ length: maxMonths + 1 }).map((_, idx) => (
                    <th
                      key={idx}
                      className="text-center text-soft-text-muted font-extrabold px-2 py-1 min-w-[60px]"
                      title={`Месяц ${idx} после первой покупки`}
                    >
                      M{idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c: any) => (
                  <tr key={c.month}>
                    <td className="font-extrabold text-soft-text whitespace-nowrap sticky left-0 bg-soft-surface z-10 px-2 py-1">
                      {c.month}
                    </td>
                    <td className="text-right font-extrabold text-soft-text px-2 py-1">
                      {c.totalUsers}
                    </td>
                    {c.retentionByMonth.map((pct: number, idx: number) => (
                      <td
                        key={idx}
                        className={`text-center font-extrabold rounded-lg px-2 py-1 ${colorForRetention(pct)}`}
                        title={`${pct}% (${c.month} → M${idx})`}
                      >
                        {pct > 0 ? `${pct}%` : "—"}
                      </td>
                    ))}
                    {/* Если реальная длина retentionByMonth меньше maxMonths,
                        дополняем пустыми ячейками для выравнивания таблицы */}
                    {Array.from({
                      length: Math.max(
                        0,
                        maxMonths - c.retentionByMonth.length,
                      ),
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
              <tfoot>
                <tr>
                  <td
                    colSpan={2}
                    className="text-right text-soft-text-muted font-extrabold px-2 py-2 sticky left-0 bg-soft-surface"
                  >
                    Средний retention
                  </td>
                  {columnAverages.map((avg: number, idx: number) => (
                    <td
                      key={idx}
                      className="text-center font-extrabold rounded-lg px-2 py-2 bg-soft-surface-2 text-soft-text"
                    >
                      {avg > 0 ? `${avg}%` : "—"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>

            {/* Легенда цветов */}
            <div className="mt-5 pt-4 border-t border-soft-border flex items-center gap-2 flex-wrap text-2xs text-soft-text-muted">
              <span className="font-bold mr-1">Легенда:</span>
              <span className="px-2 py-1 rounded bg-red-200 text-red-900 font-bold">
                0–9%
              </span>
              <span className="px-2 py-1 rounded bg-orange-300 text-orange-900 font-bold">
                10–19%
              </span>
              <span className="px-2 py-1 rounded bg-amber-300 text-amber-900 font-bold">
                20–34%
              </span>
              <span className="px-2 py-1 rounded bg-emerald-300 text-emerald-900 font-bold">
                35–49%
              </span>
              <span className="px-2 py-1 rounded bg-emerald-500 text-white font-bold">
                50–69%
              </span>
              <span className="px-2 py-1 rounded bg-emerald-700 text-white font-bold">
                70%+
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div className={`border rounded-2xl px-4 py-3 ${tint}`}>
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <span className="text-2xs uppercase tracking-wider opacity-70 font-bold">
          {label}
        </span>
      </div>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}
