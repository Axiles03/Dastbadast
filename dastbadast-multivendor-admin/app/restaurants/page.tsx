// dastbadast-multivendor-admin/app/restaurants/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  GET_RESTAURANTS,
  CREATE_RESTAURANT,
  UPDATE_RESTAURANT,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  MapPin,
  Store,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  Percent,
  ShoppingBag,
  Pencil,
  X,
  Eye,
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
  lat: "38.574",
  lng: "68.783",
};

// ⭐ Поля для редактирования (без username/password — они не меняются)
const editForm = {
  name: "",
  address: "",
  tax: "10",
  minimumOrder: "0",
  isAvailable: true,
  lat: "38.574",
  lng: "68.783",
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
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState("");
  const { hasRole } = useAuth();
  const canCreate = hasRole(ACTION_ACCESS.createRestaurant);
  const canEdit = hasRole(ACTION_ACCESS.editRestaurant);

  const { data, loading, refetch } = useQuery(GET_RESTAURANTS, {
    skip: !owner,
  });
  const [createRestaurant, { loading: creating }] =
    useMutation(CREATE_RESTAURANT);
  const [updateRestaurant, { loading: updating }] =
    useMutation(UPDATE_RESTAURANT);
  // ⭐ Состояние для редактирования
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState(editForm);

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
      showOk("Ресторан создан");
      refetch();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  // ⭐ Открытие модалки редактирования с предзаполнением
  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEdit({
      name: r.name || "",
      address: r.address || "",
      tax: String(r.tax ?? 10),
      minimumOrder: String(r.minimumOrder ?? 0),
      isAvailable: r.isAvailable !== false,
      lat: String(r.location?.coordinates?.[0] ?? 68.783),
      lng: String(r.location?.coordinates?.[1] ?? 38.574),
    });
    setShowEdit(true);
  };

  // ⭐ Сохранение изменений
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateRestaurant({
        variables: {
          id: editingId,
          input: {
            name: edit.name,
            address: edit.address,
            tax: parseFloat(edit.tax) || 0,
            minimumOrder: parseFloat(edit.minimumOrder) || 0,
            isAvailable: edit.isAvailable,
            lat: parseFloat(edit.lat),
            lng: parseFloat(edit.lng),
          },
        },
      });
      setShowEdit(false);
      setEditingId(null);
      showOk("Изменения сохранены");
      refetch();
    } catch (e: any) {
      showErr(e.message);
    }
  };

  // ⭐ Быстрое переключение доступности прямо из карточки
  const toggleAvailable = async (r: any) => {
    try {
      await updateRestaurant({
        variables: {
          id: r.id,
          input: { isAvailable: !r.isAvailable },
        },
      });
      showOk(r.isAvailable ? "Ресторан выключен" : "Ресторан включён");
      refetch();
    } catch (e: any) {
      showErr(e.message);
    }
  };

  const showOk = (msg: string) => {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 3000);
  };
  const showErr = (msg: string) => {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Тост */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl shadow-soft-lg flex items-center gap-2 text-sm font-bold animate-fade-in ${
            toast.type === "ok"
              ? "bg-soft-success text-white"
              : "bg-soft-accent text-white"
          }`}
        >
          {toast.type === "ok" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Управление ресторанами
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Подключённые заведения к платформе ·{" "}
            <span className="text-soft-text font-bold">{filtered.length}</span>{" "}
            из {restaurants.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск по названию или адресу..."
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
                className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm hover:border-soft-accent transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      r.isAvailable
                        ? "bg-soft-success-soft text-soft-success"
                        : "bg-soft-surface-2 text-soft-text-muted"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base text-soft-text">
                        {r.name}
                      </span>
                      {!r.isAvailable && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md bg-soft-surface-2 text-soft-text-muted">
                          ВЫКЛЮЧЕН
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-soft-text-soft flex items-center gap-1.5 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {r.address || "Адрес не указан"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-2xs">
                      <span className="text-soft-text-muted font-bold">
                        Мин. заказ:{" "}
                        <span className="text-soft-text">
                          {r.minimumOrder} сом.
                        </span>
                      </span>
                      <span className="text-soft-text-muted font-bold">
                        Налог:{" "}
                        <span className="text-soft-text">{r.tax ?? 0}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ⭐ Кнопки действий: просмотр, редактирование, вкл/выкл */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-soft-border">
                  <button
                    onClick={() => router.push(`/restaurants/${r.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-soft-surface-2 hover:bg-soft-info-soft border border-soft-border text-soft-text-soft hover:text-soft-info px-3 py-2 rounded-xl text-xs font-extrabold active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Детали
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => toggleAvailable(r)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border active:scale-95 transition-all ${
                          r.isAvailable
                            ? "bg-soft-warning-soft text-soft-warning-dark border-soft-warning/30 hover:bg-soft-warning/20"
                            : "bg-soft-success-soft text-soft-success border-soft-success/30 hover:bg-soft-success/20"
                        }`}
                      >
                        {r.isAvailable ? "⏸ Выключить" : "▶ Включить"}
                      </button>
                      <button
                        onClick={() => startEdit(r)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-soft-accent-soft text-soft-accent border border-soft-accent/30 px-3 py-2 rounded-xl text-xs font-extrabold active:scale-95 hover:bg-soft-accent hover:text-white transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Изменить
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ⭐ Модалка редактирования */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-soft-dark-2/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0"
            onClick={() => !updating && setShowEdit(false)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-soft-surface border border-soft-border rounded-t-3xl sm:rounded-3xl shadow-soft-xl flex flex-col">
            <div className="sticky top-0 bg-soft-surface border-b border-soft-border px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-soft-accent-soft text-soft-accent flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-soft-text">
                    Редактировать ресторан
                  </h2>
                  <p className="text-2xs text-soft-text-muted">
                    {filtered.find((x: any) => x.id === editingId)?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                disabled={updating}
                className="w-8 h-8 flex items-center justify-center text-soft-text-muted hover:text-soft-text hover:bg-soft-surface-2 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  label="Название"
                  value={edit.name}
                  onChange={(v) => setEdit({ ...edit, name: v })}
                  required
                />
                <FormField
                  label="Адрес"
                  value={edit.address}
                  onChange={(v) => setEdit({ ...edit, address: v })}
                  required
                />
                <FormField
                  label="Мин. заказ (сом.)"
                  type="number"
                  value={edit.minimumOrder}
                  onChange={(v) => setEdit({ ...edit, minimumOrder: v })}
                />
                <FormField
                  label="Комиссия (%)"
                  type="number"
                  value={edit.tax}
                  onChange={(v) => setEdit({ ...edit, tax: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Долгота (Lng)"
                  value={edit.lng}
                  onChange={(v) => setEdit({ ...edit, lng: v })}
                  hint="[GeoJSON порядок]"
                />
                <FormField
                  label="Широта (Lat)"
                  value={edit.lat}
                  onChange={(v) => setEdit({ ...edit, lat: v })}
                  hint="[GeoJSON порядок]"
                />
              </div>

              <label className="flex items-center gap-3 p-3 bg-soft-surface-2 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.isAvailable}
                  onChange={(e) =>
                    setEdit({ ...edit, isAvailable: e.target.checked })
                  }
                  className="w-4 h-4 accent-soft-accent"
                />
                <div>
                  <div className="text-sm font-bold text-soft-text">
                    Принимает заказы
                  </div>
                  <div className="text-2xs text-soft-text-muted">
                    Выключите, чтобы временно приостановить приём заказов
                  </div>
                </div>
              </label>
            </div>

            <div className="sticky bottom-0 bg-soft-surface border-t border-soft-border p-4 flex gap-2">
              <button
                onClick={() => setShowEdit(false)}
                disabled={updating}
                className="flex-1 h-11 bg-soft-surface-2 border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-border"
              >
                Отмена
              </button>
              <button
                onClick={saveEdit}
                disabled={updating}
                className="flex-1 h-11 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Сохраняем...
                  </>
                ) : (
                  "Сохранить"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
