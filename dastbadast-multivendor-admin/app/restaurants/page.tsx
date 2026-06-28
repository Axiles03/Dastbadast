"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RESTAURANTS, CREATE_RESTAURANT } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  Plus,
  MapPin,
  Store,
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Search,
  Percent,
  ShoppingBag,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { ACTION_ACCESS, NAV_ACCESS } from "@/lib/page-access";

const defaultForm = {
  name: "",
  address: "",
  city: "Душанбе",
  username: "",
  password: "",
  tax: "10",
  minimumOrder: "0",
  lat: "38.5598",
  lng: "68.7870",
};

export default function RestaurantsPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.restaurants}>
      <RestaurantsInner />
    </RoleGate>
  );
}

function RestaurantsInner() {
  const { owner, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [err, setErr] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const { hasRole } = useAuth();
  const canCreate = hasRole(ACTION_ACCESS.createRestaurant);

  const { data, loading, refetch } = useQuery(GET_RESTAURANTS, {
    skip: !owner,
  });
  const [createRestaurant, { loading: creating }] =
    useMutation(CREATE_RESTAURANT);

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

  const restaurants = data?.restaurants || [];

  const filtered = restaurants.filter((r: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name?.toLowerCase().includes(q) || r.address?.toLowerCase().includes(q)
    );
  });

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErr("Геолокация не поддерживается вашим браузером");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      () => {
        setErr(
          "Не удалось получить координаты. Разрешите доступ к геолокации.",
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await createRestaurant({
        variables: {
          input: {
            name: form.name,
            address: form.address,
            username: form.username,
            password: form.password,
            tax: parseFloat(form.tax) || 0,
            minimumOrder: parseFloat(form.minimumOrder) || 0,
            lat: parseFloat(form.lat),
            lng: parseFloat(form.lng),
          },
        },
      });
      setForm(defaultForm);
      setShowForm(false);
      refetch();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Управление ресторанами
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Подключённые заведения к платформе
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск..."
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

      {/* Форма создания */}
      {showForm && (
        <form
          onSubmit={submit}
          className="bg-soft-surface border border-soft-border rounded-3xl p-6 space-y-5 shadow-soft-sm animate-fade-in"
        >
          <div className="flex items-center gap-2 border-b border-soft-border pb-3">
            <div className="w-9 h-9 rounded-xl bg-soft-accent-soft text-soft-accent flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-base text-soft-text">
              Новый ресторан
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              label="Название ресторана"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Чайхана №1"
              required
            />
            <FormField
              label="Адрес"
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
              placeholder="ул. Рудаки 14"
              required
            />
            <FormField
              label="Логин (для Store App)"
              value={form.username}
              onChange={(v) => setForm({ ...form, username: v })}
              placeholder="chayhana1"
              required
            />
            <FormField
              label="Пароль (для Store App)"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              placeholder="••••••••"
              required
            />
            <FormField
              label="Налог платформы (%)"
              type="number"
              value={form.tax}
              onChange={(v) => setForm({ ...form, tax: v })}
              hint="Процент от чека"
            />
            <FormField
              label="Минимальный заказ (сом.)"
              type="number"
              value={form.minimumOrder}
              onChange={(v) => setForm({ ...form, minimumOrder: v })}
              hint="Минимум для оформления"
            />
          </div>

          {/* Геопозиция */}
          <div className="border border-soft-border bg-soft-surface-2 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-soft-text">
                  Геопозиция ресторана
                </h3>
                <p className="text-xs text-soft-text-soft">
                  Необходима для расчёта зон доставки
                </p>
              </div>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={geoLoading}
                className="inline-flex items-center gap-1.5 text-xs bg-soft-accent-soft text-soft-accent border border-soft-accent/20 px-3 py-1.5 rounded-full font-bold hover:bg-soft-accent hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {geoLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <MapPin className="w-3 h-3" />
                )}
                {geoLoading ? "Определяем..." : "Я нахожусь в ресторане"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Широта (Lat)"
                value={form.lat}
                onChange={(v) => setForm({ ...form, lat: v })}
              />
              <FormField
                label="Долгота (Lng)"
                value={form.lng}
                onChange={(v) => setForm({ ...form, lng: v })}
              />
            </div>
          </div>

          <div className="bg-soft-info-soft border border-soft-info/20 rounded-2xl p-3 text-xs text-soft-info flex gap-2">
            <ShoppingBag className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Меню, категории и блюда владелец точки настраивает самостоятельно
              через приложение <strong>Store App</strong>.
            </span>
          </div>

          {err && (
            <div className="flex items-start gap-2 bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <button
            disabled={creating}
            className="w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-soft-sm"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Создаём точку...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Создать ресторан
              </>
            )}
          </button>
        </form>
      )}

      {/* Список ресторанов */}
      <div className="space-y-3">
        <h2 className="font-extrabold text-lg text-soft-text px-1">
          Подключённые заведения{" "}
          <span className="text-soft-text-muted font-medium">
            {filtered.length}
          </span>
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="bg-soft-surface border border-soft-border h-24 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
            <div className="text-4xl mb-2">🏪</div>
            <p className="text-base font-extrabold text-soft-text">
              {search ? "Ничего не нашли" : "Список ресторанов пуст"}
            </p>
            <p className="text-sm text-soft-text-soft mt-1">
              {search
                ? "Попробуйте изменить запрос"
                : "Добавьте первый ресторан — нажмите «Добавить»"}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r: any) => (
              <li
                key={r.id}
                className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex justify-between items-center shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      r.isAvailable
                        ? "bg-soft-success-soft text-soft-success"
                        : "bg-soft-accent-soft text-soft-accent"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-extrabold text-base text-soft-text group-hover:text-soft-accent transition-colors truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-soft-text-soft flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {r.address || "Адрес не указан"}
                    </div>
                    {r.lat && r.lng && (
                      <div className="text-[10px] text-soft-text-muted font-mono pt-0.5 truncate">
                        {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-soft-text-muted font-bold">
                      Мин. заказ
                    </div>
                    <div className="text-sm font-extrabold text-soft-accent">
                      {r.minimumOrder} сом.
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-bold border ${
                      r.isAvailable
                        ? "bg-soft-success-soft text-soft-success border-soft-success/30"
                        : "bg-soft-accent-soft text-soft-accent border-soft-accent/20"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        r.isAvailable ? "bg-soft-success" : "bg-soft-accent"
                      } ${r.isAvailable ? "animate-pulse-soft" : ""}`}
                    />
                    {r.isAvailable ? "Открыт" : "Закрыт"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-soft-text-soft px-1">
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
      {hint && <p className="text-[11px] text-soft-text-muted px-1">{hint}</p>}
    </div>
  );
}
