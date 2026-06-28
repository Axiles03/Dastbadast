"use client";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  ADMIN_USERS,
  ADMIN_USER_DETAIL,
  TOGGLE_USER_ACTIVE,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";
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
  Loader2,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";

export default function UsersPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.users}>
      <UsersInner />
    </RoleGate>
  );
}

function UsersInner() {
  const { hasRole } = useAuth();
  const canBlock = hasRole(ACTION_ACCESS.blockUser);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Debounce для поиска (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const { data, loading, refetch } = useQuery(ADMIN_USERS, {
    variables: {
      filter: { search: debouncedSearch || null, limit, offset: page * limit },
    },
    fetchPolicy: "cache-and-network",
  });

  const [toggleUser, { loading: toggling }] = useMutation(TOGGLE_USER_ACTIVE, {
    refetchQueries: [
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
  const totalPages = Math.ceil(total / limit);

  const stats = useMemo(() => {
    const active = users.filter((u: any) => u.isActive).length;
    const blocked = users.length - active;
    const bigSpenders = users.filter((u: any) => u.totalSpent > 1000).length;
    return { active, blocked, bigSpenders };
  }, [users]);

  const handleToggle = async (u: any) => {
    if (toggling) return;
    const action = u.isActive ? "заблокировать" : "разблокировать";
    if (
      !confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${u.name} (${u.email})?`,
      )
    )
      return;
    try {
      await toggleUser({ variables: { id: u.id, isActive: !u.isActive } });
      showToast(
        "success",
        `${u.name} ${u.isActive ? "заблокирован" : "разблокирован"}`,
      );
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl shadow-soft-lg flex items-center gap-2 text-sm font-bold animate-fade-in ${
            toast.type === "success"
              ? "bg-soft-success text-white"
              : "bg-soft-accent text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-soft-accent" />
            Клиенты
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Пользователи платформы (отображается страница {page + 1} из{" "}
            {Math.max(totalPages, 1)})
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
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Метрики (только на первой странице) */}
      {page === 0 && !debouncedSearch && (
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
            label="Крупные (>1000 сом)"
            value={stats.bigSpenders}
            tint="bg-soft-rating-soft border-soft-rating/20 text-soft-rating-dark"
          />
        </div>
      )}

      {/* Список */}
      {loading && !data ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-soft-surface border border-soft-border h-20 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-base font-extrabold text-soft-text">
            {debouncedSearch ? "Никого не нашли" : "Пользователей пока нет"}
          </p>
          <p className="text-sm text-soft-text-soft mt-1">
            {debouncedSearch
              ? "Попробуйте другой запрос"
              : "Клиенты появятся после первой регистрации"}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {users.map((u: any) => (
            <li
              key={u.id}
              className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-base ${
                    u.isActive
                      ? "bg-soft-surface-2 text-soft-text"
                      : "bg-soft-accent-soft text-soft-accent"
                  }`}
                >
                  {u.name?.[0]?.toUpperCase() || (
                    <UserIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-base text-soft-text truncate">
                      {u.name}
                    </span>
                    {!u.isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-soft-accent-soft text-soft-accent border border-soft-accent/20">
                        <XCircle className="w-2.5 h-2.5" /> ЗАБЛОКИРОВАН
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-soft-text-soft">
                    {u.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {u.email}
                      </span>
                    )}
                    {u.phone && (
                      <>
                        <span className="text-soft-border">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {u.phone}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Статистика */}
              <div className="hidden sm:flex items-center gap-3 shrink-0 text-right">
                <div>
                  <p className="text-[10px] text-soft-text-muted font-bold uppercase tracking-wider">
                    Заказов
                  </p>
                  <p className="text-base font-extrabold text-soft-text">
                    {u.totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-soft-text-muted font-bold uppercase tracking-wider">
                    Потрачено
                  </p>
                  <p className="text-base font-extrabold text-soft-accent">
                    {u.totalSpent.toLocaleString("ru")} сом.
                  </p>
                </div>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelected(u.id)}
                  className="w-9 h-9 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl text-soft-text-soft hover:text-soft-accent hover:border-soft-accent transition-colors"
                  title="Подробнее"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {canBlock && (
                  <button
                    onClick={() => handleToggle(u)}
                    disabled={toggling}
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
          ))}
        </ul>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
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
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 bg-soft-surface border border-soft-border rounded-full text-sm font-bold text-soft-text-soft hover:border-soft-accent hover:text-soft-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}

      {/* Модалка деталей */}
      {selected && (
        <UserDetailModal userId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

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

  const detail = data?.adminUserDetail;
  const u = detail?.user;
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
    <div className="fixed inset-0 z-50 bg-soft-dark-2/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-soft-surface border border-soft-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-soft-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-soft-border shrink-0">
          <h2 className="text-lg font-extrabold text-soft-text flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-soft-accent" />
            Детали клиента
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-soft-text-muted hover:text-soft-text hover:bg-soft-surface-2 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {loading && !detail ? (
            <div className="space-y-3">
              <div className="h-20 bg-soft-surface-2 rounded-2xl animate-pulse" />
              <div className="h-32 bg-soft-surface-2 rounded-2xl animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-soft-accent-soft border border-soft-accent/20 rounded-2xl p-4 text-sm text-soft-accent">
              Ошибка загрузки: {error.message}
            </div>
          ) : detail && u ? (
            <>
              {/* Профиль */}
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

              {/* Адреса */}
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

              {/* Заказы */}
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
                  <ul className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                    {detail.orders.map((o: any) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-soft-text truncate">
                            #{o.orderId}
                          </div>
                          <div className="text-[11px] text-soft-text-soft truncate">
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
