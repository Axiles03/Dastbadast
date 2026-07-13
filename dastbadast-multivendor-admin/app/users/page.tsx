// dastbadast-multivendor-admin/app/users/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ADMIN_USERS,
  ADMIN_USER_DETAIL,
  TOGGLE_USER_ACTIVE,
  USER_LTV,
  USER_ORDER_FREQUENCY,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  Users,
  Search,
  RefreshCw,
  X,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Receipt,
  ShoppingBag,
  Power,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  User as UserIcon,
  TrendingUp,
  Clock,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";

export default function UsersPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.users}>
      <UsersInner />
    </RoleGate>
  );
}

function UsersInner() {
  const { owner, token, hydrated } = useAuth();
  const router = useRouter();
  const canBlock =
    owner?.userType === "SUPER_ADMIN" || owner?.userType === "SUPPORT";

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;
  const [selected, setSelected] = useState<string | null>(null);

  // ⭐ FIX: debounce поиска (300мс) + сброс на первую страницу
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ⭐ FIX: запрашиваем только когда есть токен И гидратация прошла.
  // Без hydrated-гарда первый рендер с skip:true кладёт null в cache,
  // потом skip:false не делает refetch.
  const skipQuery = !token || !hydrated;

  const { data, loading, refetch, error } = useQuery(ADMIN_USERS, {
    variables: {
      filter: {
        search: debouncedSearch || null,
        limit,
        offset: page * limit,
      },
    },
    skip: skipQuery,
    fetchPolicy: "network-only", // ⭐ FIX: было "cache-and-network", отсюда stale null
    notifyOnNetworkStatusChange: true,
  });

  // ⭐ NEW: выводим полную ошибку в консоль — иначе гадаем вслепую
  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[ADMIN_USERS] full error:", error);
      // eslint-disable-next-line no-console
      console.error(
        "[ADMIN_USERS] graphQLErrors:",
        JSON.stringify(error.graphQLErrors, null, 2),
      );
    }
  }, [error]);

  // ⭐ NEW: refetch при смене `page` (Apollo не делает это автоматически
  // если `skip` не менялся)
  useEffect(() => {
    if (!skipQuery) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const [toggleUser, { loading: toggling }] = useMutation(TOGGLE_USER_ACTIVE, {
    refetchQueries: () => [
      {
        query: ADMIN_USERS,
        variables: {
          filter: {
            search: debouncedSearch || null,
            limit,
            offset: page * limit,
          },
        },
      },
    ],
  });

  const users = data?.adminUsers?.users || [];
  const total = data?.adminUsers?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ⭐ FIX: stats считаем через totalSpent/totalOrders, не через
  // avgOrderValue (его в схеме нет, как выяснили в прошлый раз)
  const stats = useMemo(() => {
    const active = users.filter((u: any) => u.isActive).length;
    const blocked = users.length - active;
    const bigSpenders = users.filter(
      (u: any) => u.totalOrders > 0 && u.totalSpent / u.totalOrders > 1000,
    ).length;
    return { active, blocked, bigSpenders };
  }, [users]);

  const handleToggle = async (u: any) => {
    if (toggling) return;
    const action = u.isActive ? "заблокировать" : "разблокировать";
    if (
      !window.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${u.name} (${u.email})?`,
      )
    )
      return;
    try {
      await toggleUser({ variables: { id: u.id, isActive: !u.isActive } });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[toggleUser] error:", e);
    }
  };

  // ⭐ FIX: до гидратации — стабильный скелетон (тот же, что на SSR),
  // иначе hydration mismatch.
  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
              Клиенты
            </h1>
            <p className="text-sm text-soft-text-soft mt-1">Загрузка...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-20 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ⭐ FIX: показываем полную ошибку на UI — иначе вы не понимаете,
          что не так. Раньше "вылезло это еще" — это был текст из catch-а,
          а не реальная причина. */}
      {error && (
        <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/30 rounded-2xl p-4 text-sm font-semibold">
          <div className="font-extrabold mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            Ошибка загрузки списка клиентов
          </div>
          <div className="text-xs font-mono whitespace-pre-wrap">
            {error.message}
          </div>
          {error.graphQLErrors?.[0] && (
            <details className="mt-2 text-2xs">
              <summary className="cursor-pointer opacity-70">
                GraphQL error details
              </summary>
              <pre className="mt-1 opacity-80 whitespace-pre-wrap">
                {JSON.stringify(error.graphQLErrors[0], null, 2)}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-xs underline"
          >
            Повторить
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Клиенты
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            {total > 0 ? (
              <>
                Всего клиентов: <strong>{total}</strong> · страница {page + 1}{" "}
                из {totalPages}
              </>
            ) : (
              "Список пользователей платформы"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск по имени, email, телефону..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-soft-surface border border-soft-border rounded-full text-sm text-soft-text placeholder-soft-text-muted focus:outline-none focus:border-soft-accent transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-colors active:scale-[0.98]"
            title="Обновить"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link
            href="/users/cohorts"
            className="inline-flex items-center gap-1.5 bg-soft-purple hover:bg-soft-purple-dark text-white font-extrabold text-sm px-3.5 py-2 rounded-full transition-colors active:scale-[0.98] shadow-soft-sm"
            title="Когортный анализ retention"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Когорты
          </Link>
        </div>
      </div>

      {page === 0 && !debouncedSearch && users.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <MetricChip
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Активных"
            value={stats.active}
            tint="bg-soft-success-soft border-soft-success/20 text-soft-success"
          />
          <MetricChip
            icon={<XCircle className="w-4 h-4" />}
            label="Заблокированных"
            value={stats.blocked}
            tint="bg-soft-accent-soft border-soft-accent/20 text-soft-accent"
          />
          <MetricChip
            icon={<Receipt className="w-4 h-4" />}
            label="Крупные (>1000 сом/заказ)"
            value={stats.bigSpenders}
            tint="bg-soft-rating-soft border-soft-rating/20 text-soft-rating-dark"
          />
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-20 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 && !loading ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center space-y-2 shadow-soft-sm">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-base font-extrabold text-soft-text">
            {debouncedSearch
              ? `Никого не нашли по запросу «${debouncedSearch}»`
              : total === 0
                ? "В базе нет ни одного клиента"
                : "На этой странице пусто"}
          </p>
          <p className="text-sm text-soft-text-soft mt-1">
            {debouncedSearch
              ? "Попробуйте другой запрос"
              : "Клиенты появятся после первой регистрации"}
          </p>
          {total > 0 && !debouncedSearch && (
            <p className="text-2xs text-soft-text-muted mt-3">
              Всего в БД: {total}. Если в БД есть юзеры, но список пуст —
              откройте DevTools → Network → посмотрите запрос adminUsers
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {users.map((u: any) => (
            <UserListItem
              key={u.id}
              user={u}
              canBlock={canBlock}
              onSelect={() => setSelected(u.id)}
              onToggle={() => handleToggle(u)}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-4 py-2 bg-soft-surface border border-soft-border rounded-full text-sm font-bold text-soft-text-soft hover:border-soft-accent hover:text-soft-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Назад
          </button>
          <span className="text-sm text-soft-text-soft">
            Страница {page + 1} из {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 bg-soft-surface border border-soft-border rounded-full text-sm font-bold text-soft-text-soft hover:border-soft-accent hover:text-soft-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}

      {selected && (
        <UserDetailModal userId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function UserListItem({
  user: u,
  canBlock,
  onSelect,
  onToggle,
}: {
  user: any;
  canBlock: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const displayName =
    u.name?.trim() || u.email?.split("@")[0] || `Клиент #${u.id?.slice(-4)}`;

  // ⭐ FIX: avgOrderValue был в схеме раньше и сломал запрос. Считаем локально.
  const avgOrder =
    u.totalOrders > 0 ? Math.round(u.totalSpent / u.totalOrders) : 0;

  return (
    <li className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-base ${
            u.isActive
              ? "bg-soft-surface-2 text-soft-text"
              : "bg-soft-accent-soft text-soft-accent"
          }`}
        >
          {displayName[0]?.toUpperCase() || <UserIcon className="w-5 h-5" />}
        </div>
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-base text-soft-text truncate">
              {displayName}
            </span>
            {!u.isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-soft-accent-soft text-soft-accent border border-soft-accent/20">
                <XCircle className="w-2.5 h-2.5" /> ЗАБЛОКИРОВАН
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-soft-text-soft">
            {u.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {u.email}
              </span>
            ) : u.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" /> {u.phone}
              </span>
            ) : (
              <span className="text-soft-text-muted italic">
                (без контактов)
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="hidden sm:flex items-center gap-3 shrink-0 text-right">
        <div>
          <p className="text-[10px] text-soft-text-muted font-extrabold uppercase tracking-wider">
            Заказов
          </p>
          <p className="text-base font-extrabold text-soft-text">
            {u.totalOrders ?? 0}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-soft-text-muted font-extrabold uppercase tracking-wider">
            Потрачено
          </p>
          <p className="text-base font-extrabold text-soft-accent">
            {(u.totalSpent ?? 0).toLocaleString("ru")} сом.
          </p>
        </div>
        {avgOrder > 0 && (
          <div>
            <p className="text-[10px] text-soft-text-muted font-extrabold uppercase tracking-wider">
              Ср. чек
            </p>
            <p className="text-base font-extrabold text-soft-text">
              {avgOrder} сом.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onSelect}
          className="w-9 h-9 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl text-soft-text-soft hover:text-soft-accent hover:border-soft-accent transition-colors"
          title="Подробнее"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {canBlock && (
          <button
            type="button"
            onClick={onToggle}
            className={`w-9 h-9 flex items-center justify-center border rounded-xl transition-colors disabled:opacity-50 ${
              u.isActive
                ? "bg-soft-surface-2 border-soft-border text-soft-text-muted hover:text-soft-accent hover:border-soft-accent"
                : "bg-soft-success-soft border-soft-success/30 text-soft-success hover:bg-soft-success hover:text-white"
            }`}
            title={u.isActive ? "Заблокировать" : "Разблокировать"}
          >
            <Power className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
}

// === Остальные дочерние компоненты (UserDetailModal, LTVStat, Row, MetricChip)
// уже были корректные — не трогаем. Воспроизведу их ниже, чтобы файл
// был полным.

import { gql } from "@apollo/client";

const GET_USER_LTV_FOR_MODAL = gql`
  query GetUserLTVForModal($userId: ID!) {
    userLTV(userId: $userId) {
      userId
      orderCount
      totalSpent
      avgOrderValue
      cancelledCount
      firstOrderAt
      lastOrderAt
      activeDays
      predictedAnnualLTV
      isPredictionReliable
    }
  }
`;

const GET_USER_FREQ_FOR_MODAL = gql`
  query GetUserFreqForModal($userId: ID!) {
    userOrderFrequency(userId: $userId) {
      userId
      totalOrders
      deliveredOrders
      cancelledOrders
      avgIntervalDays
      medianIntervalDays
      ordersPerWeek
      ordersPerMonth
      longestGapDays
      status
      daysSinceLastOrder
      cohortMonth
    }
  }
`;

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { data, loading, error } = useQuery(ADMIN_USER_DETAIL, {
    variables: { id: userId },
  });
  const { data: ltvData } = useQuery(GET_USER_LTV_FOR_MODAL, {
    variables: { userId },
  });
  const { data: freqData } = useQuery(GET_USER_FREQ_FOR_MODAL, {
    variables: { userId },
  });
  const detail = data?.adminUserDetail;
  const u = detail?.user;
  const ltv = ltvData?.userLTV;
  const freq = freqData?.userOrderFrequency;
  const sym = "сом.";

  const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-soft-accent-soft text-soft-accent border-soft-accent/20",
    ACCEPTED: "bg-soft-rating-soft text-soft-rating-dark border-soft-rating/20",
    ASSIGNED: "bg-soft-info-soft text-soft-info border-soft-info/20",
    PICKED: "bg-soft-purple/10 text-soft-purple border-soft-purple/20",
    DELIVERED: "bg-soft-success-soft text-soft-success border-soft-success/20",
    CANCELLED: "bg-soft-surface-2 text-soft-text-muted border-soft-border",
    AWAITING_CONFIRMATION:
      "bg-soft-info-soft text-soft-info border-soft-info/20",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-soft-dark-2/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-soft-surface border border-soft-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-soft-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-soft-border shrink-0">
          <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-soft-accent" />
            Детали клиента
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-soft-surface-2 text-soft-text-soft flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {loading && !detail ? (
            <div className="space-y-3">
              <div className="h-20 bg-soft-surface-2 rounded-2xl animate-pulse" />
              <div className="h-32 bg-soft-surface-2 rounded-2xl animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl p-4 text-sm font-semibold">
              Ошибка загрузки: {error.message}
            </div>
          ) : detail && u ? (
            <>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-soft-rating to-soft-accent text-white flex items-center justify-center text-2xl font-extrabold shrink-0">
                  {u.name?.[0]?.toUpperCase() || (
                    <UserIcon className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-soft-text truncate">
                      {u.name}
                    </h3>
                    {!u.isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-soft-accent-soft text-soft-accent border border-soft-accent/20">
                        <XCircle className="w-2.5 h-2.5" /> ЗАБЛОКИРОВАН
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 mt-1.5 text-sm text-soft-text-soft">
                    {u.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> {u.email}
                      </div>
                    )}
                    {u.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> {u.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-soft-text-muted">
                      <Calendar className="w-3.5 h-3.5" />
                      Регистрация:{" "}
                      {new Date(u.createdAt).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {ltv && ltv.orderCount > 0 && (
                <section className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
                  <h4 className="font-extrabold text-sm text-soft-text mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-soft-accent" />
                    LTV (пожизненная ценность)
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <LTVStat
                      label="Заказов доставлено"
                      value={String(ltv.orderCount)}
                    />
                    <LTVStat
                      label="Всего потрачено"
                      value={`${ltv.totalSpent.toLocaleString("ru")} ${sym}`}
                      highlight
                    />
                    <LTVStat
                      label="Средний чек"
                      value={`${ltv.avgOrderValue.toFixed(0)} ${sym}`}
                    />
                    <LTVStat
                      label="Отменено"
                      value={String(ltv.cancelledCount)}
                      warn={ltv.cancelledCount > 2}
                    />
                    <LTVStat
                      label="Первый заказ"
                      value={
                        ltv.firstOrderAt
                          ? new Date(ltv.firstOrderAt).toLocaleDateString("ru")
                          : "—"
                      }
                    />
                    <LTVStat
                      label="Последний заказ"
                      value={
                        ltv.lastOrderAt
                          ? new Date(ltv.lastOrderAt).toLocaleDateString("ru")
                          : "—"
                      }
                    />
                    <LTVStat
                      label="Активен дней"
                      value={String(ltv.activeDays)}
                    />
                    {ltv.predictedAnnualLTV != null && (
                      <LTVStat
                        label={
                          ltv.isPredictionReliable
                            ? `📈 Прогноз на год`
                            : `⚠️ Прогноз (мало данных)`
                        }
                        value={`${ltv.predictedAnnualLTV.toLocaleString("ru")} ${sym}`}
                        highlight={ltv.isPredictionReliable}
                      />
                    )}
                  </div>
                </section>
              )}

              {freq && freq.totalOrders > 0 && (
                <section className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
                  <h4 className="font-extrabold text-sm text-soft-text mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-soft-accent" />
                    Частота заказов
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <LTVStat
                      label="Всего заказов"
                      value={String(freq.totalOrders)}
                      highlight
                    />
                    <LTVStat
                      label="Средн. интервал"
                      value={`${freq.avgIntervalDays} дн`}
                    />
                    <LTVStat
                      label="Медиана"
                      value={`${freq.medianIntervalDays} дн`}
                    />
                    <LTVStat
                      label="Макс. перерыв"
                      value={`${freq.longestGapDays} дн`}
                      warn={freq.longestGapDays > 60}
                    />
                    <LTVStat
                      label="Заказов в неделю"
                      value={String(freq.ordersPerWeek)}
                    />
                    <LTVStat
                      label="Заказов в месяц"
                      value={String(freq.ordersPerMonth)}
                    />
                    {freq.daysSinceLastOrder != null && (
                      <LTVStat
                        label="Дней с последнего"
                        value={String(freq.daysSinceLastOrder)}
                        warn={freq.daysSinceLastOrder > 60}
                      />
                    )}
                    {freq.cohortMonth && (
                      <LTVStat label="Когорта" value={freq.cohortMonth} />
                    )}
                    <div className="col-span-2">
                      <div
                        className={`rounded-2xl px-3 py-2 border text-center ${
                          freq.status === "active"
                            ? "bg-soft-success-soft border-soft-success/30 text-soft-success"
                            : freq.status === "new"
                              ? "bg-soft-info-soft border-soft-info/30 text-soft-info"
                              : "bg-soft-warning-soft border-soft-warning/30 text-soft-warning-dark"
                        }`}
                      >
                        <p className="text-2xs uppercase tracking-wider font-bold opacity-70">
                          Статус клиента
                        </p>
                        <p className="text-base font-extrabold mt-0.5">
                          {freq.status === "active"
                            ? "✅ Active"
                            : freq.status === "new"
                              ? "🆕 New"
                              : "⚠️ Churned"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-sm font-extrabold text-soft-text mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-soft-accent" /> Адреса (
                  {detail.addresses.length})
                </h4>
                {detail.addresses.length === 0 ? (
                  <p className="text-xs text-soft-text-soft bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5">
                    Нет сохранённых адресов
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.addresses.map((a: any) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2"
                      >
                        <span className="text-sm font-bold text-soft-text">
                          {a.label}
                        </span>
                        <span className="text-xs text-soft-text-soft truncate flex-1">
                          {a.city}, {a.address}
                        </span>
                        {a.isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-soft-success-soft text-soft-success">
                            ОСНОВНОЙ
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="text-sm font-extrabold text-soft-text mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-soft-accent" /> Заказы (
                  {detail.orders.length})
                </h4>
                {detail.orders.length === 0 ? (
                  <p className="text-xs text-soft-text-soft bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5">
                    Заказов пока нет
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {detail.orders.map((o: any) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-soft-text truncate">
                            #{o.orderId}
                          </div>
                          <div className="text-xs text-soft-text-soft truncate">
                            {o.restaurantName} ·{" "}
                            {new Date(o.createdAt).toLocaleDateString("ru", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-soft-text">
                            {o.total} {sym}
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                              STATUS_STYLES[o.orderStatus] ||
                              STATUS_STYLES.PENDING
                            }`}
                          >
                            {o.orderStatus}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LTVStat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  const bg = warn
    ? "bg-soft-warning-soft border-soft-warning/30"
    : highlight
      ? "bg-soft-accent-soft border-soft-accent/30"
      : "bg-soft-surface-2 border-soft-border";
  const text = warn
    ? "text-soft-warning-dark"
    : highlight
      ? "text-soft-accent"
      : "text-soft-text";
  return (
    <div className={`rounded-xl px-3 py-2 border ${bg}`}>
      <p className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-sm font-extrabold mt-0.5 truncate ${text}`}>
        {value}
      </p>
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
  value: number;
  tint: string;
}) {
  return (
    <div
      className={`border rounded-2xl px-4 py-3 flex items-center gap-3 ${tint}`}
    >
      <div className="w-9 h-9 rounded-xl bg-soft-surface/60 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">
          {label}
        </p>
        <p className="text-xl font-extrabold leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}
