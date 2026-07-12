// dastbadast-multivendor-admin/app/riders/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  GET_RIDERS,
  CREATE_RIDER,
  UPDATE_RIDER,
  TOGGLE_RIDER_ACTIVE,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
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
  Pencil,
  X,
  Eye,
  Mail,
  Image as ImageIcon,
  Star,
  PowerOff,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";

const defaultForm = {
  username: "",
  password: "",
  name: "",
  phone: "",
  email: "",
  photo: "",
};

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
  const [updateRider, { loading: updating }] = useMutation(UPDATE_RIDER);
  const [toggleActive] = useMutation(TOGGLE_RIDER_ACTIVE);
  const [form, setForm] = useState(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
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
  const { hasRole } = useAuth();
  const canCreate = hasRole(ACTION_ACCESS.createRider);
  const canEdit = hasRole("OPERATIONS") || hasRole("SUPER_ADMIN");

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

  const riders = data?.riders || [];
  const online = riders.filter(
    (r: any) => r.available && r.isActive !== false,
  ).length;
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

  const showOk = (msg: string) => {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 3000);
  };
  const showErr = (msg: string) => {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 4000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRider({ variables: { input: form } });
      setForm(defaultForm);
      setShowForm(false);
      showOk("Курьер создан");
      refetch();
    } catch {
      /* error via Apollo */
    }
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      photo: r.photo || "",
      isActive: r.isActive !== false,
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateRider({
        variables: {
          id: editingId,
          input: {
            name: editForm.name,
            phone: editForm.phone,
            email: editForm.email,
            photo: editForm.photo,
            isActive: editForm.isActive,
          },
        },
      });
      setShowEdit(false);
      setEditingId(null);
      showOk("Профиль курьера обновлён");
      refetch();
    } catch (e: any) {
      showErr(e?.message || "Ошибка сохранения");
    }
  };

  const quickToggleActive = async (r: any) => {
    try {
      await toggleActive({
        variables: { id: r.id, isActive: !r.isActive },
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
      showErr("Поддерживаются только JPG, PNG или WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showErr("Файл слишком большой — максимум 2 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditForm((f) => ({ ...f, photo: String(ev.target?.result || "") }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
            Управление курьерами
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Регистрация и мониторинг смены
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-soft-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Поиск по имени, логину, телефону..."
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
          label="Активных"
          value={online}
          tint="bg-soft-success-soft text-soft-success border-soft-success/20"
        />
        <MetricChip
          icon={<PowerOff className="w-4 h-4" />}
          label="Неактивных"
          value={offline}
          tint="bg-soft-surface-2 text-soft-text-muted border-soft-border"
        />
      </div>

      {/* Форма создания */}
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
            <FormField
              icon={<Mail className="w-4 h-4" />}
              label="Email (для восстановления пароля)"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="rider@example.com"
              type="email"
            />
            <FormField
              icon={<ImageIcon className="w-4 h-4" />}
              label="Фото (URL)"
              value={form.photo}
              onChange={(v) => setForm({ ...form, photo: v })}
              placeholder="https://..."
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

      {/* Список курьеров */}
      <div className="space-y-3">
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
                className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm hover:border-soft-accent transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
                      r.available
                        ? r.isActive === false
                          ? "bg-soft-surface-2 text-soft-text-muted"
                          : "bg-soft-success-soft text-soft-success"
                        : "bg-soft-surface-2 text-soft-text-muted"
                    }`}
                  >
                    {r.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo}
                        alt={r.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bike className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base text-soft-text truncate">
                        {r.name || r.username}
                      </span>
                      {r.isActive === false && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md bg-soft-surface-2 text-soft-text-muted">
                          ЗАБЛОКИРОВАН
                        </span>
                      )}
                      {typeof r.averageRating === "number" &&
                        r.averageRating > 0 && (
                          <span className="inline-flex items-center gap-1 text-2xs text-soft-rating font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {r.averageRating.toFixed(1)}
                          </span>
                        )}
                    </div>
                    <div className="text-xs text-soft-text-soft flex items-center gap-2 truncate mt-0.5">
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
                    <div className="text-2xs text-soft-text-muted mt-0.5">
                      🛵 Доставок:{" "}
                      <span className="text-soft-text font-bold">
                        {r.totalDeliveries ?? 0}
                      </span>
                      {" · "}
                      Оценка:{" "}
                      <span className="text-soft-text font-bold">
                        {r.totalRatings ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ⭐ Кнопки действий */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-soft-border">
                  <button
                    onClick={() => router.push(`/riders/${r.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-soft-surface-2 hover:bg-soft-info-soft border border-soft-border text-soft-text-soft hover:text-soft-info px-3 py-2 rounded-xl text-xs font-extrabold active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Детали
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => quickToggleActive(r)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border active:scale-95 transition-all ${
                          r.isActive !== false
                            ? "bg-soft-warning-soft text-soft-warning-dark border-soft-warning/30 hover:bg-soft-warning/20"
                            : "bg-soft-success-soft text-soft-success border-soft-success/30 hover:bg-soft-success/20"
                        }`}
                        title={
                          r.isActive !== false
                            ? "Заблокировать"
                            : "Активировать"
                        }
                      >
                        {r.isActive !== false ? (
                          <PowerOff className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
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

      {/* ⭐ Модалка редактирования курьера */}
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
                    Редактировать курьера
                  </h2>
                  <p className="text-2xs text-soft-text-muted">
                    @{riders.find((x: any) => x.id === editingId)?.username}
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
              {/* ⭐ Аватарка с загрузкой файла */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-soft-surface-2 border border-soft-border flex items-center justify-center shrink-0">
                  {editForm.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editForm.photo}
                      alt="Аватар"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">🛵</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPhotoFile}
                    className="hidden"
                    id="rider-photo-upload"
                  />
                  <label
                    htmlFor="rider-photo-upload"
                    className="inline-flex items-center gap-1.5 bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Загрузить фото
                  </label>
                  {editForm.photo && (
                    <button
                      onClick={() => setEditForm({ ...editForm, photo: "" })}
                      className="ml-2 text-2xs text-soft-text-muted hover:text-soft-accent underline"
                    >
                      Удалить
                    </button>
                  )}
                  <p className="text-2xs text-soft-text-muted mt-1">
                    JPG/PNG/WebP, до 2 МБ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  icon={<User className="w-4 h-4" />}
                  label="Имя"
                  value={editForm.name}
                  onChange={(v) => setEditForm({ ...editForm, name: v })}
                />
                <FormField
                  icon={<Phone className="w-4 h-4" />}
                  label="Телефон"
                  value={editForm.phone}
                  onChange={(v) => setEditForm({ ...editForm, phone: v })}
                />
                <FormField
                  icon={<Mail className="w-4 h-4" />}
                  label="Email"
                  type="email"
                  value={editForm.email}
                  onChange={(v) => setEditForm({ ...editForm, email: v })}
                />
                <FormField
                  icon={<ImageIcon className="w-4 h-4" />}
                  label="Фото URL (или загрузите выше)"
                  value={editForm.photo}
                  onChange={(v) => setEditForm({ ...editForm, photo: v })}
                />
              </div>

              <label className="flex items-center gap-3 p-3 bg-soft-surface-2 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.checked })
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
