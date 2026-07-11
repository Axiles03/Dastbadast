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
    },
  );

  const [form, setForm] = useState({
    currency: "TJS",
    currencySymbol: "сом.",
    taxPercent: 10,
    testOtp: "123456",
  });

  useEffect(() => {
    if (data?.configuration) {
      const c = data.configuration;
      setForm({
        currency: c.currency ?? "TJS",
        currencySymbol: c.currencySymbol ?? "сом.",
        taxPercent: typeof c.taxPercent === "number" ? c.taxPercent : 10,
        testOtp: c.testOtp ?? "123456",
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
          testOtp: form.testOtp,
        },
      },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Шапка */}
      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Глобальные настройки
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Финансовая логика, ключи интеграции и параметры верификации
        </p>
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

            {/* ⭐ ШАГ 2: НОВАЯ секция "Финансы" — комиссия платформы */}
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

            {/* Доставка */}
            <SectionGroup title="Доставка" icon={<Percent className="w-4 h-4" />}>
              <FormField
                icon={<Percent className="w-3.5 h-3.5" />}
                label="Базовая стоимость доставки"
                hint="Фиксированная ставка за доставку заказа курьером"
                type="number"
                value={String(form.taxPercent)}
                onChange={(v) =>
                  setForm({ ...form, taxPercent: parseFloat(v || "0") })
                }
              />
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
