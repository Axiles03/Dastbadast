// dastbadast-multivendor-admin/app/riders/[id]/page.tsx
"use client";
import { useQuery, useMutation } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GET_RIDER_DETAIL,
  GET_RIDER_FINANCIALS,
  UPDATE_RIDER,
  TOGGLE_RIDER_ACTIVE,
} from "@/lib/queries";
import {
  ChevronLeft,
  Bike,
  Loader2,
  AlertCircle,
  Pencil,
  Save,
  X,
  CheckCircle2,
  Ban,
  Star,
  Mail,
  Phone,
  AtSign,
  Wallet,
  Receipt,
  TrendingUp,
  Image as ImageIcon,
  Power,
  PowerOff,
  Calendar,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS } from "@/lib/page-access";
import { useAuth } from "@/lib/auth-context";

export default function RiderDetailPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.riders}>
      <RiderDetailInner />
    </RoleGate>
  );
}

function RiderDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const { hasRole } = useAuth();
  const canEdit = hasRole("OPERATIONS") || hasRole("SUPER_ADMIN");

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    photo: "",
    isActive: true,
  });
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_RIDER_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const { data: finData, refetch: refetchFin } = useQuery(
    GET_RIDER_FINANCIALS,
    {
      variables: { riderId: id },
      skip: !id,
    },
  );

  const [updateRider, { loading: saving }] = useMutation(UPDATE_RIDER);
  const [toggleActive, { loading: toggling }] =
    useMutation(TOGGLE_RIDER_ACTIVE);

  const r = data?.rider;
  const fin = finData?.riderFinancials;

  const startEdit = () => {
    if (!r) return;
    setForm({
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      photo: r.photo || "",
      isActive: r.isActive !== false,
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
      await updateRider({
        variables: {
          id,
          input: {
            name: form.name,
            phone: form.phone,
            email: form.email,
            photo: form.photo,
            isActive: form.isActive,
          },
        },
      });
      setEdit(false);
      showOk("Профиль сохранён");
    } catch (e: any) {
      showErr(e?.message || "Ошибка");
    }
  };

  const handleToggleActive = async () => {
    if (!r) return;
    try {
      await toggleActive({
        variables: { id, isActive: !r.isActive },
      });
      showOk(r.isActive ? "Курьер заблокирован" : "Курьер активирован");
      refetch();
    } catch (e: any) {
      showErr(e?.message || "Ошибка");
    }
  };

  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showErr("Только JPG, PNG или WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showErr("Файл слишком большой");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) =>
      setForm((f) => ({ ...f, photo: String(ev.target?.result || "") }));
    reader.readAsDataURL(file);
    e.target.value = "";
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
          Курьер не найден
        </h2>
        <button
          onClick={() => router.push("/riders")}
          className="mt-4 px-5 py-2.5 bg-soft-accent text-white font-extrabold rounded-2xl text-sm"
        >
          К списку курьеров
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

      <button
        onClick={() => router.push("/riders")}
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> Все курьеры
      </button>

      {/* Шапка */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-soft-accent-soft border border-soft-border flex items-center justify-center shrink-0">
            {r.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.photo}
                alt={r.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">🛵</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold text-soft-text">
                {r.name || r.username}
              </h1>
              {r.isActive === false ? (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-soft-surface-2 text-soft-text-muted border border-soft-border">
                  <Ban className="w-3 h-3" /> ЗАБЛОКИРОВАН
                </span>
              ) : r.available ? (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-soft-success-soft text-soft-success border border-soft-success/30">
                  <CheckCircle2 className="w-3 h-3" /> В сети
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-soft-surface-2 text-soft-text-muted border border-soft-border">
                  Оффлайн
                </span>
              )}
              {typeof r.averageRating === "number" && r.averageRating > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-soft-rating font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {r.averageRating.toFixed(1)}
                  <span className="text-soft-text-muted font-normal">
                    ({r.totalRatings})
                  </span>
                </span>
              )}
            </div>
            <div className="text-xs text-soft-text-soft flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className="inline-flex items-center gap-1">
                <AtSign className="w-3 h-3" /> @{r.username}
              </span>
              {r.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {r.phone}
                </span>
              )}
              {r.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {r.email}
                </span>
              )}
            </div>
            {r.createdAt && (
              <p className="text-2xs text-soft-text-muted mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />С нами с{" "}
                {new Date(r.createdAt).toLocaleDateString("ru")}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-col gap-1.5">
              {!edit && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 bg-soft-accent-soft text-soft-accent border border-soft-accent/30 px-3 py-2 rounded-xl text-xs font-extrabold hover:bg-soft-accent hover:text-white transition-all active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5" /> Изменить
                </button>
              )}
              {!edit && (
                <button
                  onClick={handleToggleActive}
                  disabled={toggling}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border active:scale-95 ${
                    r.isActive !== false
                      ? "bg-soft-warning-soft text-soft-warning-dark border-soft-warning/30 hover:bg-soft-warning/20"
                      : "bg-soft-success-soft text-soft-success border-soft-success/30 hover:bg-soft-success/20"
                  }`}
                >
                  {r.isActive !== false ? (
                    <>
                      <PowerOff className="w-3.5 h-3.5" /> Заблокировать
                    </>
                  ) : (
                    <>
                      <Power className="w-3.5 h-3.5" /> Активировать
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {edit && (
          <div className="mt-5 pt-5 border-t border-soft-border space-y-3">
            <h3 className="text-sm font-extrabold text-soft-text-muted uppercase tracking-wider">
              Редактирование
            </h3>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-soft-surface-2 border border-soft-border flex items-center justify-center shrink-0">
                {form.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photo}
                    alt="Аватар"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">🛵</span>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPhotoFile}
                  className="hidden"
                  id="rider-photo-detail"
                />
                <label
                  htmlFor="rider-photo-detail"
                  className="inline-flex items-center gap-1.5 bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Загрузить фото
                </label>
                {form.photo && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                    className="ml-2 text-2xs text-soft-text-muted hover:text-soft-accent underline"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldEdit
                label="Имя"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <FieldEdit
                label="Телефон"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <FieldEdit
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-soft-surface-2 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="w-4 h-4 accent-soft-accent"
              />
              <div>
                <div className="text-sm font-bold text-soft-text">
                  Активный аккаунт
                </div>
                <div className="text-2xs text-soft-text-muted">
                  Заблокированный курьер не сможет войти в Rider App
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

      {/* ⭐ Финансы и статистика */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <h3 className="font-extrabold text-soft-text mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-soft-accent" />
          Финансы и статистика
        </h3>
        {fin ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBlock
              icon={<Wallet className="w-4 h-4" />}
              label="Текущий баланс"
              value={`${(fin.balance ?? 0).toLocaleString("ru")} сом.`}
              tint="bg-soft-accent-soft text-soft-accent"
              big
            />
            <StatBlock
              icon={<TrendingUp className="w-4 h-4" />}
              label="Заработано всего"
              value={`${(fin.totalEarned ?? 0).toLocaleString("ru")} сом.`}
              tint="bg-soft-success-soft text-soft-success"
            />
            <StatBlock
              icon={<Receipt className="w-4 h-4" />}
              label="Доставок"
              value={String(fin.totalDeliveries ?? 0)}
              tint="bg-soft-info-soft text-soft-info"
            />
            <StatBlock
              icon={<Star className="w-4 h-4" />}
              label="Средний чек"
              value={`${(fin.averageDeliveryFee ?? 0).toFixed(0)} сом.`}
              tint="bg-soft-rating-soft text-soft-rating-dark"
            />
          </div>
        ) : (
          <p className="text-sm text-soft-text-soft text-center py-4">
            Финансовая статистика появится после первых доставок
          </p>
        )}
      </section>
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
  tint,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  big?: boolean;
}) {
  return (
    <div className={`${tint} rounded-2xl p-3 ${big ? "" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-2xs font-extrabold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className={`font-black ${big ? "text-lg" : "text-base"} truncate`}>
        {value}
      </p>
    </div>
  );
}

function FieldEdit({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
    </div>
  );
}
