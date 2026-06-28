"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { gql } from "@apollo/client";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";
import {
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Search,
  MoreVertical,
  Power,
  KeyRound,
  Edit3,
  Mail,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const OWNERS_QUERY = gql`
  query Owners {
    owners {
      id
      email
      userType
      isActive
      lastLoginAt
      createdAt
    }
  }
`;

const CREATE_OWNER = gql`
  mutation CreateOwner($input: CreateOwnerInput!) {
    createOwner(input: $input) {
      id
      email
      userType
      isActive
    }
  }
`;

const UPDATE_OWNER = gql`
  mutation UpdateOwner($id: ID!, $input: UpdateOwnerInput!) {
    updateOwner(id: $id, input: $input) {
      id
      email
      userType
      isActive
    }
  }
`;

const DEACTIVATE_OWNER = gql`
  mutation DeactivateOwner($id: ID!) {
    deactivateOwner(id: $id)
  }
`;

const RESET_PASSWORD = gql`
  mutation ResetOwnerPassword($id: ID!, $newPassword: String!) {
    resetOwnerPassword(id: $id, newPassword: $newPassword)
  }
`;

const ROLE_OPTIONS = [
  {
    value: "DISPATCHER",
    label: "Диспетчер",
    color: "info",
    desc: "Диспетчерская + курьеры",
  },
  {
    value: "FINANCE",
    label: "Финансы",
    color: "success",
    desc: "Бухгалтерия + конфиг",
  },
  {
    value: "OPERATIONS",
    label: "Операции",
    color: "purple",
    desc: "Рестораны + курьеры + зоны",
  },
  {
    value: "SUPPORT",
    label: "Поддержка",
    color: "rating",
    desc: "Пользователи + заказы (read)",
  },
  {
    value: "ANALYST",
    label: "Аналитик",
    color: "muted",
    desc: "Только отчёты",
  },
  {
    value: "SUPER_ADMIN",
    label: "Суперадмин",
    color: "accent",
    desc: "Полный доступ",
  },
];

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-soft-accent-soft text-soft-accent border-soft-accent/30",
  DISPATCHER: "bg-soft-info-soft text-soft-info border-soft-info/30",
  FINANCE: "bg-soft-success-soft text-soft-success border-soft-success/30",
  OPERATIONS: "bg-soft-purple/10 text-soft-purple border-soft-purple/30",
  SUPPORT: "bg-soft-rating-soft text-soft-rating-dark border-soft-rating/30",
  ANALYST: "bg-soft-surface-2 text-soft-text-muted border-soft-border",
};

export default function AdminsPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.admins}>
      <AdminsInner />
    </RoleGate>
  );
}

function AdminsInner() {
  const { owner: currentUser, hasRole } = useAuth();
  const { data, loading, refetch } = useQuery(OWNERS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const [createOwner, { loading: creating }] = useMutation(CREATE_OWNER);
  const [updateOwner, { loading: updating }] = useMutation(UPDATE_OWNER);
  const [deactivateOwner] = useMutation(DEACTIVATE_OWNER);
  const [resetPwd] = useMutation(RESET_PASSWORD);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    userType: "DISPATCHER",
  });

  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const filtered = (data?.owners || []).filter((o: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.email?.toLowerCase().includes(q) ||
      o.userType?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: data?.owners?.length || 0,
    active: data?.owners?.filter((o: any) => o.isActive).length || 0,
    superAdmins:
      data?.owners?.filter(
        (o: any) => o.userType === "SUPER_ADMIN" && o.isActive,
      ).length || 0,
  };

  const resetForm = () => {
    setForm({ email: "", password: "", userType: "DISPATCHER" });
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        // При редактировании пароль не обновляется
        const input: any = {
          email: form.email,
          userType: form.userType,
        };
        await updateOwner({ variables: { id: editing.id, input } });
        showToast("success", "Админ обновлён");
      } else {
        if (!form.password || form.password.length < 6) {
          showToast("error", "Пароль должен быть не короче 6 символов");
          return;
        }
        await createOwner({
          variables: { input: { ...form, email: form.email.toLowerCase() } },
        });
        showToast("success", "Админ создан");
      }
      setShowForm(false);
      resetForm();
      refetch();
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка сохранения");
    }
  };

  const startEdit = (o: any) => {
    setEditing(o);
    setForm({ email: o.email, password: "", userType: o.userType });
    setShowForm(true);
    setMenuFor(null);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleDeactivate = async (o: any) => {
    if (o.id === currentUser?.id) {
      showToast("error", "Нельзя деактивировать себя");
      return;
    }
    if (
      !confirm(
        `Деактивировать ${o.email}? Аккаунт сохранится в БД, но войти будет нельзя.`,
      )
    )
      return;
    try {
      await deactivateOwner({ variables: { id: o.id } });
      showToast("success", "Админ деактивирован");
      setMenuFor(null);
      refetch();
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка");
    }
  };

  const handleReactivate = async (o: any) => {
    try {
      await updateOwner({ variables: { id: o.id, input: { isActive: true } } });
      showToast("success", "Админ активирован");
      setMenuFor(null);
      refetch();
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка");
    }
  };

  const handleResetPassword = async (o: any) => {
    const newPwd = prompt(`Новый пароль для ${o.email} (мин. 6 символов):`);
    if (!newPwd) return;
    if (newPwd.length < 6) {
      showToast("error", "Пароль слишком короткий");
      return;
    }
    try {
      await resetPwd({ variables: { id: o.id, newPassword: newPwd } });
      showToast("success", `Пароль для ${o.email} обновлён`);
      setMenuFor(null);
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
            Команда админки
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Управление сотрудниками с доступом к панели
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск по email или роли..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-soft-surface border border-soft-border rounded-full text-sm text-soft-text placeholder-soft-text-muted focus:outline-none focus:border-soft-accent transition-colors"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold text-sm px-4 py-2 rounded-full transition-colors shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-3">
        <MetricChip
          icon={<Users className="w-4 h-4" />}
          label="Всего"
          value={stats.total}
          tint="bg-soft-surface border-soft-border text-soft-text"
        />
        <MetricChip
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Активных"
          value={stats.active}
          tint="bg-soft-success-soft border-soft-success/20 text-soft-success"
        />
        <MetricChip
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Суперадминов"
          value={stats.superAdmins}
          tint="bg-soft-accent-soft border-soft-accent/20 text-soft-accent"
        />
      </div>

      {/* Форма создания/редактирования */}
      {showForm && (
        <form
          onSubmit={submit}
          className="bg-soft-surface border border-soft-border rounded-3xl p-6 space-y-4 shadow-soft-sm animate-fade-in"
        >
          <div className="flex items-center gap-2 border-b border-soft-border pb-3">
            <div className="w-9 h-9 rounded-xl bg-soft-accent-soft text-soft-accent flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-base text-soft-text">
              {editing ? `Редактировать: ${editing.email}` : "Новый админ"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              icon={<Mail className="w-4 h-4" />}
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="dispatcher@dastbadast.tj"
              required
            />
            {!editing && (
              <Field
                icon={<KeyRound className="w-4 h-4" />}
                label="Пароль (мин. 6 символов)"
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder="••••••••"
                required
              />
            )}
            {editing && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-soft-text-soft px-1">
                  Смена пароля
                </label>
                <div className="text-xs text-soft-text-soft bg-soft-surface-2 border border-soft-border rounded-xl px-3 py-2.5">
                  Используйте «Сбросить пароль» в меню действий
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-soft-text-soft px-1">
              Роль
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((r) => {
                const active = form.userType === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, userType: r.value })}
                    className={`text-left p-3 rounded-2xl border-2 transition-all ${
                      active
                        ? "border-soft-accent bg-soft-accent-soft"
                        : "border-soft-border bg-soft-surface hover:border-soft-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md border ${ROLE_STYLES[r.value]}`}
                      >
                        {r.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-soft-text-soft leading-tight">
                      {r.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {editing && (
            <div className="bg-soft-info-soft border border-soft-info/20 rounded-2xl p-3 text-xs text-soft-info flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                При смене роли гранулярные права обновятся автоматически. Можно
                также сбросить пароль в меню действий.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-border transition-colors"
            >
              Отмена
            </button>
            <button
              disabled={creating || updating}
              className="flex-1 h-11 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
            >
              {creating || updating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохраняем...
                </>
              ) : (
                <>{editing ? "Обновить" : "Создать админа"}</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Список админов */}
      <div className="space-y-3">
        <h2 className="font-extrabold text-lg text-soft-text px-1">
          Команда{" "}
          <span className="text-soft-text-muted font-medium">
            {filtered.length}
          </span>
        </h2>

        {loading && !data ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="bg-soft-surface border border-soft-border h-20 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-base font-extrabold text-soft-text">
              {search ? "Ничего не нашли" : "Команда пока пуста"}
            </p>
            <p className="text-sm text-soft-text-soft mt-1">
              {search
                ? "Попробуйте другой запрос"
                : "Добавьте первого сотрудника"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((o: any) => {
              const isMe = o.id === currentUser?.id;
              return (
                <li
                  key={o.id}
                  className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex justify-between items-center shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        o.isActive
                          ? ROLE_STYLES[o.userType] ||
                            "bg-soft-surface-2 text-soft-text"
                          : "bg-soft-surface-2 text-soft-text-muted"
                      }`}
                    >
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-soft-text truncate">
                          {o.email}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-soft-accent text-white">
                            ВЫ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold border ${
                            ROLE_STYLES[o.userType] || ROLE_STYLES.ANALYST
                          }`}
                        >
                          {o.userType}
                        </span>
                        {o.lastLoginAt && (
                          <span className="text-soft-text-soft inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Последний вход:{" "}
                            {new Date(o.lastLoginAt).toLocaleString("ru", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Статус */}
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border ${
                        o.isActive
                          ? "bg-soft-success-soft text-soft-success border-soft-success/30"
                          : "bg-soft-surface-2 text-soft-text-muted border-soft-border"
                      }`}
                    >
                      {o.isActive ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {o.isActive ? "Активен" : "Неактивен"}
                    </span>

                    {/* Меню действий */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuFor(menuFor === o.id ? null : o.id)
                        }
                        className="w-9 h-9 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl text-soft-text-soft hover:text-soft-accent hover:border-soft-accent transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuFor === o.id && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setMenuFor(null)}
                          />
                          <div className="absolute right-0 mt-2 w-56 bg-soft-surface rounded-2xl border border-soft-border shadow-soft-lg p-1.5 z-40">
                            <MenuItem
                              icon={<Edit3 className="w-3.5 h-3.5" />}
                              label="Редактировать"
                              onClick={() => startEdit(o)}
                            />
                            <MenuItem
                              icon={<KeyRound className="w-3.5 h-3.5" />}
                              label="Сбросить пароль"
                              onClick={() => handleResetPassword(o)}
                            />
                            {o.isActive ? (
                              <MenuItem
                                icon={<Power className="w-3.5 h-3.5" />}
                                label="Деактивировать"
                                onClick={() => handleDeactivate(o)}
                                danger
                                disabled={isMe}
                              />
                            ) : (
                              <MenuItem
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                label="Активировать"
                                onClick={() => handleReactivate(o)}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
        danger
          ? "text-soft-accent hover:bg-soft-accent-soft"
          : "text-soft-text hover:bg-soft-surface-2"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-soft-text-soft px-1 flex items-center gap-1.5">
        <span className="text-soft-text-muted">{icon}</span>
        {label}
        {required && <span className="text-soft-accent ml-0.5">*</span>}
      </label>
      <input
        type={type}
        className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
