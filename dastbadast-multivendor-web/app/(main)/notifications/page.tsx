// dastbadast-multivendor-web/app/(main)/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import {
  VAPID_PUBLIC_KEY_QUERY,
  SUBSCRIBE_WEB_PUSH,
  UNSUBSCRIBE_WEB_PUSH,
  SEND_TEST_WEB_PUSH,
} from "@/lib/queries";
import { RequireAuth } from "@/components/RequireAuth";
import {
  isWebPushSupported,
  subscribeToPush,
  getExistingSubscription,
  subscriptionToInput,
} from "@/lib/webpush";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
} from "lucide-react";

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsInner />
    </RequireAuth>
  );
}

function NotificationsInner() {
  const { data } = useQuery(VAPID_PUBLIC_KEY_QUERY);
  const vapidPublicKey: string | null = data?.vapidPublicKey ?? null;

  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [subscribeMutation] = useMutation(SUBSCRIBE_WEB_PUSH);
  const [unsubscribeMutation] = useMutation(UNSUBSCRIBE_WEB_PUSH);
  const [sendTest, { loading: sendingTest }] = useMutation(SEND_TEST_WEB_PUSH);

  useEffect(() => {
    (async () => {
      const ok = isWebPushSupported();
      setSupported(ok);
      if (ok) {
        const sub = await getExistingSubscription();
        setSubscribed(!!sub);
      }
      setChecking(false);
    })();
  }, []);

  async function enable() {
    setError(null);
    if (!vapidPublicKey) {
      setError("Push пока не настроен на сервере (нет VAPID-ключа в .env)");
      return;
    }
    setLoading(true);
    try {
      const sub = await subscribeToPush(vapidPublicKey);
      if (!sub) {
        setError(
          "Уведомления не разрешены в браузере. Проверьте настройки сайта.",
        );
        return;
      }
      await subscribeMutation({
        variables: { input: subscriptionToInput(sub) },
      });
      setSubscribed(true);
      setSuccess("Уведомления включены");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось включить уведомления");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setError(null);
    setLoading(true);
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        await unsubscribeMutation({ variables: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e: any) {
      setError(e?.message || "Не удалось отключить уведомления");
    } finally {
      setLoading(false);
    }
  }

  async function test() {
    setError(null);
    try {
      await sendTest();
      setSuccess(
        "Тестовое уведомление отправлено — проверьте системные уведомления",
      );
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-soft-text-muted hover:text-soft-accent mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад в профиль
        </Link>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-soft-accent" />
          Уведомления
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Push-уведомления о статусе заказа прямо в браузере
        </p>
      </div>

      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm space-y-4">
        {checking && (
          <p className="text-sm text-soft-text-soft">Проверяем поддержку…</p>
        )}

        {!checking && !supported && (
          <p className="text-sm text-soft-text-soft flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Ваш браузер не поддерживает push-уведомления
          </p>
        )}

        {!checking && supported && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {subscribed ? (
                  <Bell className="w-4 h-4 text-soft-success" />
                ) : (
                  <BellOff className="w-4 h-4 text-soft-text-muted" />
                )}
                <span className="text-sm font-bold text-soft-text">
                  {subscribed
                    ? "Уведомления включены"
                    : "Уведомления выключены"}
                </span>
              </div>
              <button
                type="button"
                onClick={subscribed ? disable : enable}
                disabled={loading}
                className={`px-5 py-2 rounded-2xl text-sm font-extrabold transition disabled:opacity-50 shrink-0 ${
                  subscribed
                    ? "bg-soft-surface border border-soft-border text-soft-text-soft hover:border-soft-accent"
                    : "bg-soft-accent hover:bg-soft-accent-dark text-white"
                }`}
              >
                {loading ? "…" : subscribed ? "Выключить" : "Включить"}
              </button>
            </div>

            {subscribed && (
              <button
                type="button"
                onClick={test}
                disabled={sendingTest}
                className="text-xs font-bold text-soft-accent hover:underline disabled:opacity-50"
              >
                {sendingTest ? "Отправляем…" : "Отправить тестовое уведомление"}
              </button>
            )}
          </>
        )}

        {success && (
          <p className="text-sm font-semibold text-soft-success flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {success}
          </p>
        )}
        {error && (
          <p className="text-sm font-semibold text-soft-accent flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
