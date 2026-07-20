// dastbadast-multivendor-admin/app/configuration/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { GET_CONFIGURATION, UPDATE_CONFIGURATION } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  Settings,
  AlertCircle,
  Loader2,
  Save,
  Info,
  Hash,
  DollarSign,
  Percent,
  KeyRound,
  Globe,
  Smartphone,
  Ruler,
  Check,
  Clock,
} from "lucide-react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";

export default function ConfigurationPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.configuration}>
      <ConfigurationInner />
    </RoleGate>
  );
}

function ConfigurationInner() {
  const { owner, loading } = useAuth();
  const router = useRouter();
  const { hasRole } = useAuth();
  const canEditAll = hasRole(ACTION_ACCESS.editAllConfig);
  const canEditFinancial = hasRole(ACTION_ACCESS.editFinancialConfig);

  useEffect(() => {
    document.body.style.backgroundColor = "#FAF7F2";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loading && !owner) router.push("/login");
  }, [owner, loading, router]);

  const { data, loading: ldg } = useQuery(GET_CONFIGURATION, { skip: !owner });
  const [update, { loading: saving, error }] = useMutation(
    UPDATE_CONFIGURATION,
    {
      refetchQueries: [{ query: GET_CONFIGURATION }],
      awaitRefetchQueries: true,
    },
  );

  const [form, setForm] = useState({
    currency: "TJS",
    currencySymbol: "сом.",
    taxPercent: 10,
    // ⭐ ИСПРАВЛЕНО: 3 отдельных поля вместо одной переменной taxPercent
    deliveryBaseKm: 3,
    deliveryBasePrice: 10,
    deliveryPerKmPrice: 3,
    testOtp: "123456",  
    waitCompensationFreeMinutes: 7,
    waitCompensationPerMinute: 0,
  });

  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (data?.configuration) {
      const c = data.configuration;
      setForm({
        currency: c.currency ?? "TJS",
        currencySymbol: c.currencySymbol ?? "сом.",
        taxPercent: typeof c.taxPercent === "number" ? c.taxPercent : 10,
        deliveryBaseKm:
          typeof c.deliveryBaseKm === "number" ? c.deliveryBaseKm : 3,
        deliveryBasePrice:
          typeof c.deliveryBasePrice === "number" ? c.deliveryBasePrice : 10,
        deliveryPerKmPrice:
          typeof c.deliveryPerKmPrice === "number" ? c.deliveryPerKmPrice : 3,
        testOtp: c.testOtp ?? "123456",
        waitCompensationFreeMinutes: c.waitCompensationFreeMinutes ?? 7,
        waitCompensationPerMinute: c.waitCompensationPerMinute ?? 0,
      });
    }
  }, [data]);

  if (!owner) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update({
      variables: {
        input: {
          currency: form.currency,
          currencySymbol: form.currencySymbol,
          taxPercent: Number(form.taxPercent),
          deliveryBaseKm: Number(form.deliveryBaseKm),
          deliveryBasePrice: Number(form.deliveryBasePrice),
          deliveryPerKmPrice: Number(form.deliveryPerKmPrice),
          testOtp: form.testOtp,
          waitCompensationFreeMinutes: form.waitCompensationFreeMinutes,
        },
      },
    });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Глобальные настройки
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Финансовая логика, тариф доставки и параметры верификации
          </p>
        </div>
        {savedOk && (
          <div className="flex items-center gap-1.5 bg-soft-success-soft text-soft-success border border-soft-success/30 px-3 py-1.5 rounded-full text-xs font-extrabold">
            <Check className="w-3.5 h-3.5" />
            Сохранено
          </div>
        )}
      </div>

      {ldg ? (
        <div className="bg-soft-surface border border-soft-border h-64 rounded-3xl animate-pulse" />
      ) : (
        <form
          onSubmit={submit}
          className="bg-soft-surface border border-soft-border rounded-3xl p-6 space-y-5 shadow-soft-sm"
        >
          <div className="flex items-center gap-2 border-b border-soft-border pb-3">
            <div className="w-9 h-9 rounded-xl bg-soft-purple/10 text-soft-purple flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="font-extrabold text-base text-soft-text">
              Системные переменные
            </h2>
          </div>

          <div className="space-y-4">
            {/* Валюта */}
            <SectionGroup
              title="Валюта"
              icon={<DollarSign className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  icon={<Hash className="w-3.5 h-3.5" />}
                  label="ISO код"
                  hint="Используется для процессинга"
                  value={form.currency}
                  onChange={(v) => setForm({ ...form, currency: v })}
                />
                <FormField
                  icon={<Globe className="w-3.5 h-3.5" />}
                  label="Символ"
                  hint="Отображение в чеках и меню"
                  value={form.currencySymbol}
                  onChange={(v) => setForm({ ...form, currencySymbol: v })}
                />
              </div>
            </SectionGroup>

            {/* Финансы */}
            <SectionGroup
              title="Финансы"
              icon={<Percent className="w-4 h-4" />}
            >
              <FormField
                icon={<Percent className="w-3.5 h-3.5" />}
                label="Налог / Комиссия платформы (%)"
                hint="Внутренняя комиссия. НЕ начисляется клиенту в чеке. Удерживается из выплат ресторану (subtotal × percent). Рекомендуемое значение 10%."
                type="number"
                value={String(form.taxPercent)}
                onChange={(v) =>
                  setForm({
                    ...form,
                    taxPercent: Math.max(
                      0,
                      Math.min(100, parseFloat(v || "10")),
                    ),
                  })
                }
              />
            </SectionGroup>

            {/* ⭐ ИСПРАВЛЕНО: 3 отдельных поля вместо одного taxPercent */}
            <SectionGroup
              title="Тариф доставки"
              icon={<Ruler className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                  label="Базовая стоимость"
                  hint={`Цена за первые ${form.deliveryBaseKm} км`}
                  type="number"
                  value={String(form.deliveryBasePrice)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      deliveryBasePrice: Math.max(0, parseFloat(v || "0")),
                    })
                  }
                />
                <FormField
                  icon={<Ruler className="w-3.5 h-3.5" />}
                  label="Базовый радиус (км)"
                  hint="Расстояние включено в базовую цену"
                  type="number"
                  value={String(form.deliveryBaseKm)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      deliveryBaseKm: Math.max(0, parseFloat(v || "0")),
                    })
                  }
                />
                <FormField
                  icon={<Percent className="w-3.5 h-3.5" />}
                  label="Цена за км сверх"
                  hint="За каждый км после базового радиуса"
                  type="number"
                  value={String(form.deliveryPerKmPrice)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      deliveryPerKmPrice: Math.max(0, parseFloat(v || "0")),
                    })
                  }
                />
                <FormField
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Время с безопасностью (мин)"
                  hint="Через сколько минут доставка без оплаты компенсации"
                  type="number"
                  value={String(form.waitCompensationFreeMinutes)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      waitCompensationFreeMinutes: Math.max(
                        0,
                        parseFloat(v || "0"),
                      ),
                    })
                  } 
                />
                <FormField
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Время с безопасностью (мин)"
                  hint="Через сколько минут доставка без оплаты компенсации"
                  type="number"
                  value={String(form.waitCompensationPerMinute)}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      waitCompensationPerMinute: Math.max(
                        0,
                        parseFloat(v || "0"),
                      ),
                    })
                  } 
                />
              </div>
              <div className="mt-3 bg-soft-info-soft border border-soft-info/20 rounded-xl p-3 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-soft-info shrink-0 mt-0.5" />
                <span className="text-xs text-soft-text-soft leading-relaxed">
                  <strong className="text-soft-text">Формула:</strong>{" "}
                  <code className="bg-soft-surface px-1.5 py-0.5 rounded text-2xs">
                    доставка = {form.deliveryBasePrice} сом, если ≤{" "}
                    {form.deliveryBaseKm} км, иначе {form.deliveryBasePrice} +{" "}
                    {form.deliveryPerKmPrice} × (расстояние −{" "}
                    {form.deliveryBaseKm})
                  </code>
                </span>
              </div>
            </SectionGroup>

            {/* Верификация */}
            <SectionGroup
              title="Верификация"
              icon={<Smartphone className="w-4 h-4" />}
            >
              <FormField
                icon={<KeyRound className="w-3.5 h-3.5" />}
                label="Тестовый SMS OTP код"
                hint="Заглушка для прохождения модерации в App Store / Google Play"
                value={form.testOtp}
                onChange={(v) => setForm({ ...form, testOtp: v })}
              />
            </SectionGroup>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Ошибка сохранения: {error.message}</span>
            </div>
          )}

          <div className="bg-soft-info-soft border border-soft-info/20 rounded-2xl p-3 text-xs text-soft-info flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Изменения применятся мгновенно ко всем приложениям (Web, Store,
              Rider)
            </span>
          </div>

          <button
            disabled={saving}
            className="w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохраняем...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Сохранить конфигурацию
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

function SectionGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold text-soft-text-muted uppercase tracking-widest flex items-center gap-1.5">
        <span className="text-soft-text-muted">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function FormField({
  icon,
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-soft-text-soft px-1 flex items-center gap-1.5">
        <span className="text-soft-text-muted">{icon}</span>
        {label}
      </label>
      <input
        type={type}
        className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-[11px] text-soft-text-muted px-1">{hint}</p>}
    </div>
  );
}
