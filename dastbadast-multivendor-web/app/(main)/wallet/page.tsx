// dastbadast-multivendor-web/app/(main)/wallet/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import {
  GET_PROFILE,
  GET_WALLET_TRANSACTIONS,
  TOP_UP_BALANCE,
  GET_CONFIGURATION,
} from "@/lib/queries";
import { RequireAuth } from "@/components/RequireAuth";

// ⭐ Тип проводки → человекочитаемая подпись. Чисто клиентская локализация,
// бэкенд отдаёт технический код (см. mobile client/app/(app)/wallet.tsx).
const TYPE_LABELS: Record<string, string> = {
  TOPUP_STUB: "Пополнение",
  ADJUSTMENT: "Корректировка",
  WITHDRAWAL: "Списание",
};

const QUICK_AMOUNTS = [100, 300, 500, 1000];

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletInner />
    </RequireAuth>
  );
}

function WalletInner() {
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: profileData } = useQuery(GET_PROFILE, {
    fetchPolicy: "cache-and-network",
  });
  const {
    data: txData,
    loading: txLoading,
    refetch: refetchTx,
  } = useQuery(GET_WALLET_TRANSACTIONS, {
    variables: { limit: 30, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
  const { data: cfg } = useQuery(GET_CONFIGURATION);
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  const [topUpBalance, { loading: toppingUp }] = useMutation(TOP_UP_BALANCE, {
    refetchQueries: [{ query: GET_PROFILE }],
    awaitRefetchQueries: true,
  });

  const balance = profileData?.profile?.balance ?? 0;
  const transactions = txData?.myWalletTransactions ?? [];
  const isEmpty = !txLoading && transactions.length === 0;

  async function handleTopUp(rawAmount?: number) {
    setError(null);
    setSuccess(false);
    const amount = rawAmount ?? Number(amountInput.replace(",", "."));
    if (!amount || amount <= 0) {
      setError("Введите сумму пополнения");
      return;
    }
    try {
      await topUpBalance({ variables: { amount } });
      setAmountInput("");
      await refetchTx();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось пополнить баланс");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-soft-text-muted hover:text-soft-accent"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Назад в профиль
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
          <WalletIcon className="w-6 h-6 text-soft-accent" />
          Баланс
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Текущий баланс, пополнение и история операций
        </p>
      </div>

      {/* Текущий баланс */}
      <div className="bg-soft-accent rounded-3xl p-8 text-center shadow-soft-sm">
        <p className="text-xs font-bold text-white/80">Текущий баланс</p>
        <p className="text-4xl font-extrabold text-white mt-1">
          {balance.toLocaleString("ru")} {sym}
        </p>
      </div>

      {/* Пополнение — ЗАГЛУШКА, без реального платёжного шлюза */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm space-y-4">
        <h3 className="font-extrabold text-soft-text">Пополнить</h3>

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={toppingUp}
              onClick={() => handleTopUp(amt)}
              className="px-4 py-2 rounded-xl border border-soft-border text-sm font-bold text-soft-text hover:border-soft-accent hover:text-soft-accent transition-colors disabled:opacity-50"
            >
              +{amt} {sym}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder={`Своя сумма, ${sym}`}
            inputMode="decimal"
            className="flex-1 px-4 py-2.5 bg-soft-surface-2 border border-soft-border rounded-xl text-sm focus:outline-none focus:border-soft-accent"
          />
          <button
            type="button"
            onClick={() => handleTopUp()}
            disabled={toppingUp}
            className="inline-flex items-center justify-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark disabled:opacity-60 text-white font-extrabold px-5 rounded-xl transition-colors"
          >
            {toppingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Пополнить"
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Баланс пополнен (тестовый режим — без реальной оплаты)
          </div>
        )}

        <p className="text-xs text-soft-text-muted">
          Тестовый режим: пополнение происходит мгновенно, без реальной оплаты.
        </p>
      </section>

      {/* История операций */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-soft-text flex items-center gap-2">
          <History className="w-4 h-4 text-soft-text-muted" />
          История
        </h3>

        {txLoading && !txData ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 bg-soft-surface border border-soft-border rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="bg-soft-surface border border-soft-border rounded-3xl p-8 text-center shadow-soft-sm">
            <p className="text-sm text-soft-text-soft">Пока нет операций</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((item: any) => (
              <div
                key={item.id}
                className="bg-soft-surface border border-soft-border rounded-2xl px-4 py-3 flex items-center justify-between shadow-soft-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-soft-text truncate">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </p>
                  {item.note && (
                    <p className="text-xs text-soft-text-muted truncate">
                      {item.note}
                    </p>
                  )}
                  <p className="text-xs text-soft-text-muted">
                    {new Date(item.createdAt).toLocaleString("ru")}
                  </p>
                </div>
                <p
                  className={`text-sm font-extrabold shrink-0 ml-3 ${
                    item.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {item.amount >= 0 ? "+" : ""}
                  {item.amount.toLocaleString("ru")} {sym}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
