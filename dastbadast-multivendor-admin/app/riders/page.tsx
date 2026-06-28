"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_RIDERS, CREATE_RIDER } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  Plus,
  Bike,
  AlertCircle,
  Loader2,
  User,
  Phone,
  AtSign,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";

export default function RidersPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.riders}>
      <RidersInner />
    </RoleGate>
  );
}

function RidersInner() {
  const { owner, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, loading, refetch } = useQuery(GET_RIDERS, {
    variables: { available: null },
    skip: !owner,
  });
  const [createRider, { loading: creating, error }] = useMutation(CREATE_RIDER);
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const { hasRole } = useAuth();
  const canCreate = hasRole(ACTION_ACCESS.createRider);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRider({ variables: { input: form } });
      setForm({ username: "", password: "", name: "", phone: "" });
      setShowForm(false);
      refetch();
    } catch {
      /* error via Apollo */
    }
  };

  if (!owner) return null;

  const riders = data?.riders || [];
  const online = riders.filter((r: any) => r.available).length;
  const offline = riders.length - online;

  const filtered = riders.filter((r: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.username?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Управление курьерами
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Регистрация учётных записей и мониторинг смены
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск курьера..."
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
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold text-sm px-4 py-2 rounded-full transition-colors shadow-soft-sm"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Скрыть" : "Добавить"}
            </button>
          )}
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-3">
        <MetricChip
          icon={<Bike className="w-4 h-4" />}
          label="Всего"
          value={riders.length}
          tint="bg-soft-surface-2 text-soft-text border-soft-border"
        />
        <MetricChip
          icon={<ShieldCheck className="w-4 h-4" />}
          label="В сети"
          value={online}
          tint="bg-soft-success-soft text-soft-success border-soft-success/20"
        />
        <MetricChip
          icon={<User className="w-4 h-4" />}
          label="Оффлайн"
          value={offline}
          tint="bg-soft-surface-2 text-soft-text-muted border-soft-border"
        />
      </div>

      {/* Форма */}
      {showForm && (
        <form
          onSubmit={submit}
          className="bg-soft-surface border border-soft-border rounded-3xl p-6 space-y-4 shadow-soft-sm animate-fade-in"
        >
          <div className="flex items-center gap-2 border-b border-soft-border pb-3">
            <div className="w-9 h-9 rounded-xl bg-soft-purple/10 text-soft-purple flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-base text-soft-text">
              Новый курьер
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              icon={<AtSign className="w-4 h-4" />}
              label="Логин (Username)"
              value={form.username}
              onChange={(v) => setForm({ ...form, username: v })}
              placeholder="rider_dushanbe"
              required
            />
            <FormField
              icon={<Lock className="w-4 h-4" />}
              label="Пароль"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              placeholder="••••••••"
              required
            />
            <FormField
              icon={<User className="w-4 h-4" />}
              label="Имя курьера"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Алишер"
            />
            <FormField
              icon={<Phone className="w-4 h-4" />}
              label="Телефон"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="+992 _________"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error.message}</span>
            </div>
          )}

          <button
            disabled={creating}
            className="w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Регистрируем...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Создать курьера
              </>
            )}
          </button>
        </form>
      )}

      {/* Список */}
      <div className="space-y-3">
        <h2 className="font-extrabold text-lg text-soft-text px-1">
          Зарегистрированные курьеры{" "}
          <span className="text-soft-text-muted font-medium">
            {filtered.length}
          </span>
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-soft-surface border border-soft-border h-16 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
            <div className="text-4xl mb-2">🛵</div>
            <p className="text-base font-extrabold text-soft-text">
              {search ? "Ничего не нашли" : "Курьеров пока нет"}
            </p>
            <p className="text-sm text-soft-text-soft mt-1">
              {search
                ? "Попробуйте изменить запрос"
                : "Добавьте первого курьера для доставки"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((r: any) => (
              <li
                key={r.id}
                className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex justify-between items-center shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      r.available
                        ? "bg-soft-success-soft text-soft-success"
                        : "bg-soft-surface-2 text-soft-text-muted"
                    }`}
                  >
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-extrabold text-base text-soft-text group-hover:text-soft-accent transition-colors truncate">
                      {r.name || "Без имени"}
                    </div>
                    <div className="text-xs text-soft-text-soft flex items-center gap-2 truncate">
                      <span>@{r.username}</span>
                      {r.phone && (
                        <>
                          <span className="text-soft-border">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {r.phone}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold border shrink-0 ${
                    r.available
                      ? "bg-soft-success-soft text-soft-success border-soft-success/30"
                      : "bg-soft-surface-2 text-soft-text-muted border-soft-border"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      r.available
                        ? "bg-soft-success animate-pulse-soft"
                        : "bg-soft-text-muted"
                    }`}
                  />
                  {r.available ? "В сети" : "Оффлайн"}
                </span>
              </li>
            ))}
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

function FormField({
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
