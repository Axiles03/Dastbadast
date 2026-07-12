// dastbadast-multivendor-admin/app/restaurants/[id]/page.tsx
"use client";
import { useQuery, useMutation } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GET_RESTAURANT_DETAIL, UPDATE_RESTAURANT } from "@/lib/queries";
import {
  ChevronLeft,
  Store,
  MapPin,
  Loader2,
  AlertCircle,
  Pencil,
  Save,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  TrendingUp,
  Receipt,
  Users,
  Ban,
  Power,
  ToggleRight,
  ToggleLeft,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";
import { useAuth } from "@/lib/auth-context";

export default function RestaurantDetailPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.restaurants}>
      <RestaurantDetailInner />
    </RoleGate>
  );
}

function RestaurantDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const { hasRole } = useAuth();
  const canEdit = hasRole(ACTION_ACCESS.editRestaurant);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    tax: "10",
    minimumOrder: "0",
    isAvailable: true,
    lat: "0",
    lng: "0",
  });
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_RESTAURANT_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const [updateRestaurant, { loading: saving }] = useMutation(
    UPDATE_RESTAURANT,
    {
      refetchQueries: [{ query: GET_RESTAURANT_DETAIL, variables: { id } }],
      awaitRefetchQueries: true,
    },
  );

  const r = data?.restaurant;

  const startEdit = () => {
    if (!r) return;
    setForm({
      name: r.name || "",
      address: r.address || "",
      tax: String(r.tax ?? 10),
      minimumOrder: String(r.minimumOrder ?? 0),
      isAvailable: r.isAvailable !== false,
      lat: String(r.location?.coordinates?.[0] ?? 68.783),
      lng: String(r.location?.coordinates?.[1] ?? 38.574),
    });
    setEdit(true);
  };

  const showOk = (msg: string) => {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 3000);
  };
  const showErr = (msg: string) => {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 4000);
  };

  const save = async () => {
    try {
      await updateRestaurant({
        variables: {
          id,
          input: {
            name: form.name,
            address: form.address,
            tax: parseFloat(form.tax) || 0,
            minimumOrder: parseFloat(form.minimumOrder) || 0,
            isAvailable: form.isAvailable,
            lat: parseFloat(form.lat),
            lng: parseFloat(form.lng),
          },
        },
      });
      setEdit(false);
      showOk("Изменения сохранены");
    } catch (e: any) {
      showErr(e?.message || "Ошибка сохранения");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-32 bg-soft-surface rounded animate-pulse" />
        <div className="h-48 bg-soft-surface border border-soft-border rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !r) {
    return (
      <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center">
        <div className="text-5xl mb-3">😕</div>
        <h2 className="text-lg font-extrabold text-soft-text mb-2">
          Ресторан не найден
        </h2>
        <p className="text-sm text-soft-text-soft">
          Возможно, он был удалён или у вас нет доступа
        </p>
        <button
          onClick={() => router.push("/restaurants")}
          className="mt-4 px-5 py-2.5 bg-soft-accent text-white font-extrabold rounded-2xl text-sm"
        >
          К списку ресторанов
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
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

      {/* Хлебные крошки */}
      <button
        onClick={() => router.push("/restaurants")}
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> Все рестораны
      </button>

      {/* Шапка */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-start gap-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
              r.isAvailable
                ? "bg-soft-success-soft text-soft-success"
                : "bg-soft-surface-2 text-soft-text-muted"
            }`}
          >
            <Store className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold text-soft-text">
                {r.name}
              </h1>
              {r.isAvailable ? (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-soft-success-soft text-soft-success border border-soft-success/30">
                  <CheckCircle2 className="w-3 h-3" /> Активен
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-soft-surface-2 text-soft-text-muted border border-soft-border">
                  <Ban className="w-3 h-3" /> Не принимает заказы
                </span>
              )}
            </div>
            {r.address && (
              <p className="text-sm text-soft-text-soft flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" /> {r.address}
              </p>
            )}
            {r.workingHours && !r.workingHours?.isAlwaysOpen && (
              <p className="text-xs text-soft-text-muted flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3" />
                {r.workingHours.open}–{r.workingHours.close}
              </p>
            )}
          </div>
          {canEdit && !edit && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 bg-soft-accent-soft text-soft-accent border border-soft-accent/30 px-3.5 py-2 rounded-xl text-sm font-extrabold hover:bg-soft-accent hover:text-white transition-all active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
              Изменить
            </button>
          )}
        </div>

        {edit && (
          <div className="mt-5 pt-5 border-t border-soft-border space-y-3">
            <h3 className="text-sm font-extrabold text-soft-text-muted uppercase tracking-wider">
              Редактирование
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldEdit
                label="Название"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <FieldEdit
                label="Адрес"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
              />
              <FieldEdit
                label="Мин. заказ (сом.)"
                type="number"
                value={form.minimumOrder}
                onChange={(v) => setForm({ ...form, minimumOrder: v })}
              />
              <FieldEdit
                label="Комиссия (%)"
                type="number"
                value={form.tax}
                onChange={(v) => setForm({ ...form, tax: v })}
              />
              <FieldEdit
                label="Долгота (Lng)"
                value={form.lng}
                onChange={(v) => setForm({ ...form, lng: v })}
                hint="[GeoJSON порядок]"
              />
              <FieldEdit
                label="Широта (Lat)"
                value={form.lat}
                onChange={(v) => setForm({ ...form, lat: v })}
                hint="[GeoJSON порядок]"
              />
            </div>
            <label className="flex items-center gap-3 p-3 bg-soft-surface-2 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) =>
                  setForm({ ...form, isAvailable: e.target.checked })
                }
                className="w-4 h-4 accent-soft-accent"
              />
              <div>
                <div className="text-sm font-bold text-soft-text">
                  Принимает заказы
                </div>
                <div className="text-2xs text-soft-text-muted">
                  При выключении ресторан временно не принимает заказы
                </div>
              </div>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEdit(false)}
                className="flex-1 h-11 bg-soft-surface-2 border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm"
              >
                Отмена
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 h-11 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Сохранить
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Координаты (если не в режиме редактирования) */}
      {!edit && r.location && (
        <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
          <h3 className="font-extrabold text-soft-text mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-soft-accent" /> Координаты
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-2xs text-soft-text-muted font-extrabold uppercase tracking-wider">
                Долгота (Lng)
              </p>
              <p className="font-mono text-soft-text mt-0.5">
                {r.location.coordinates?.[0]?.toFixed(6) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-2xs text-soft-text-muted font-extrabold uppercase tracking-wider">
                Широта (Lat)
              </p>
              <p className="font-mono text-soft-text mt-0.5">
                {r.location.coordinates?.[1]?.toFixed(6) ?? "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Быстрые действия */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <h3 className="font-extrabold text-soft-text mb-3 text-sm">Действия</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => router.push("/restaurants")}
            className="flex items-center gap-2 p-3 bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent rounded-xl transition-all text-sm font-extrabold text-soft-text-soft hover:text-soft-accent"
          >
            <Receipt className="w-4 h-4" />
            Все заказы ресторана (скоро)
          </button>
          <button
            onClick={() => router.push("/accounting")}
            className="flex items-center gap-2 p-3 bg-soft-surface-2 hover:bg-soft-success-soft border border-soft-border hover:border-soft-success rounded-xl transition-all text-sm font-extrabold text-soft-text-soft hover:text-soft-success"
          >
            <TrendingUp className="w-4 h-4" />
            Финансы по ресторану
          </button>
        </div>
      </section>
    </div>
  );
}

function FieldEdit({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-soft-text-soft px-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
      />
      {hint && <p className="text-[11px] text-soft-text-muted px-1">{hint}</p>}
    </div>
  );
}
