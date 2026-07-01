"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import {
  PLACE_ORDER,
  GET_ADDRESSES,
  GET_CONFIGURATION,
  GET_RESTAURANT_CHECK,
} from "@/lib/queries";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { debugLog, debugError } from "@/lib/debug-log";
import { RequireAuth } from "@/components/RequireAuth";

const API_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SERVER_URL
    ? `${process.env.NEXT_PUBLIC_SERVER_URL}/graphql`
    : "http://localhost:8001/graphql";

export default function CartPage() {
  return (
    <RequireAuth>
      <CartInner />
    </RequireAuth>
  );
}

function CartInner() {
  const { user, loading: aLoading } = useAuth();
  const {
    items,
    hydrated,
    setQty,
    remove,
    clear,
    subtotal,
    restaurantId,
    restaurantName,
  } = useCart();
  const router = useRouter();
  const { data: addrData } = useQuery(GET_ADDRESSES, { skip: !user });
  const { data: cfg } = useQuery(GET_CONFIGURATION);
  const {
    data: restData,
    loading: restLoading,
    error: restError,
  } = useQuery(GET_RESTAURANT_CHECK, {
    variables: { id: restaurantId },
    skip: !restaurantId || !hydrated,
  });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [placeOrder, { loading: placing }] = useMutation(PLACE_ORDER);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!aLoading && !user) router.push("/");
  }, [user, aLoading, router]);

  useEffect(() => {
    if (!addressId && addrData?.selectedAddress)
      setAddressId(addrData.selectedAddress.id);
  }, [addrData, addressId]);

  if (!user) return null;

  if (!hydrated) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Корзина
        </h1>
        <p className="text-soft-text-soft mt-2">Загрузка корзины…</p>
      </div>
    );
  }

  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const deliveryFee = cfg?.configuration?.deliveryRate ?? 0;
  const minimumOrder = restData?.restaurant?.minimumOrder ?? 0;
  const total = +(subtotal + deliveryFee).toFixed(2);

  const blockReasons: string[] = [];
  if (!addressId) blockReasons.push("📍 Выберите адрес доставки ниже");
  if (restLoading) blockReasons.push("⏳ Проверяем доступность ресторана…");
  else if (restError)
    blockReasons.push(
      `🛑 API недоступен: ${restError.message}. Запущен ли бэкенд на ${API_URL}?`,
    );
  else if (!restData?.restaurant)
    blockReasons.push(
      "🚫 Ресторан из корзины больше не существует. Очистите корзину и выберите заново.",
    );
  else if (restData.restaurant.isAvailable === false)
    blockReasons.push("🚫 Ресторан временно не принимает заказы.");
  else if (minimumOrder > 0 && subtotal < minimumOrder)
    blockReasons.push(
      `💰 Минимальная сумма заказа: ${minimumOrder} ${sym}. Добавьте ещё на ${(minimumOrder - subtotal).toFixed(0)} ${sym}.`,
    );
  const canOrder = blockReasons.length === 0;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Корзина
        </h1>
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center mt-6 shadow-soft-sm">
          <div className="text-5xl mb-3">🛒</div>
          <h3 className="font-extrabold text-soft-text">Корзина пуста</h3>
          <p className="text-sm text-soft-text-soft mt-1">
            Добавьте блюда из меню ресторана
          </p>
          <Link
            href="/"
            className="inline-block mt-4 bg-soft-accent text-white px-5 py-2.5 rounded-2xl text-sm font-extrabold hover:bg-soft-accent-dark transition-colors"
          >
            Выбрать ресторан
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Корзина
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Ресторан: <strong className="text-soft-text">{restaurantName}</strong>
        </p>
      </div>

      {/* === Список блюд === */}
      <ul className="space-y-2">
        {items.map((i) => (
          <li
            key={i.foodId}
            className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex items-center gap-3 shadow-soft-sm"
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-soft-surface-2 shrink-0">
              {i.image ? (
                <img
                  src={i.image}
                  alt={i.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">
                  🍽
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-soft-text truncate">
                {i.title}
              </div>
              <div className="text-soft-accent font-extrabold text-sm mt-0.5">
                {i.price} {sym}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQty(i.foodId, i.quantity - 1)}
                className="w-8 h-8 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl hover:border-soft-accent text-soft-text-soft active:scale-95 transition-all"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-sm w-6 text-center text-soft-text">
                {i.quantity}
              </span>
              <button
                type="button"
                onClick={() => setQty(i.foodId, i.quantity + 1)}
                className="w-8 h-8 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl hover:border-soft-accent text-soft-text-soft active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(i.foodId)}
                className="ml-1 w-8 h-8 flex items-center justify-center text-soft-text-muted hover:text-soft-accent hover:bg-soft-accent-soft rounded-xl transition-colors"
                aria-label="Удалить"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* === Адрес === */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-soft-text flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-soft-accent" /> Адрес доставки
          </h2>
          <Link
            href="/address"
            className="text-xs font-extrabold text-soft-accent hover:underline flex items-center gap-0.5"
          >
            Изменить <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!addrData?.addresses?.length ? (
          <p className="text-sm text-soft-text-soft">
            У вас пока нет сохранённых адресов.{" "}
            <Link
              href="/address"
              className="text-soft-accent underline font-bold"
            >
              Добавить адрес
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {addrData.addresses.map((a: any) => (
              <label
                key={a.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  addressId === a.id
                    ? "bg-soft-accent-soft border-soft-accent"
                    : "bg-soft-surface-2 border-soft-border hover:border-soft-accent"
                }`}
              >
                <input
                  type="radio"
                  name="addr"
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="accent-soft-accent w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-soft-text text-sm">
                  {a.label}
                  <span className="text-soft-text-soft font-normal ml-1">
                    — {a.city}, {a.address}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* === Комментарий === */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <h2 className="font-extrabold text-soft-text mb-2">
          Комментарий к заказу{" "}
          <span className="text-xs text-soft-text-soft font-normal">
            (необязательно)
          </span>
        </h2>
        <textarea
          className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl text-sm min-h-[80px] focus:outline-none focus:border-soft-accent transition-colors resize-none"
          placeholder="Например: без лука, позвонить у двери"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </section>

      {!canOrder && (
        <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl p-4 text-sm font-semibold">
          <div className="font-extrabold mb-1">Невозможно оформить заказ:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {blockReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* === Итог === */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 text-sm space-y-2 shadow-soft-sm">
        <div className="flex justify-between text-soft-text-soft">
          <span>Подытог</span>
          <span className="text-soft-text font-bold">
            {subtotal} {sym}
          </span>
        </div>
        <div className="flex justify-between text-soft-text-soft">
          <span>Доставка</span>
          <span className="text-soft-text font-bold">
            {deliveryFee} {sym}
          </span>
        </div>
        <div className="border-t border-soft-border pt-2 flex justify-between font-extrabold text-base">
          <span className="text-soft-text">Итого к оплате</span>
          <span className="text-soft-accent text-lg">
            {total} {sym}
          </span>
        </div>
        <p className="text-xs text-soft-text-muted pt-1">
          Оплата наличными или картой курьеру при получении.
        </p>
      </section>

      {error && (
        <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl p-4 text-sm font-semibold">
          🛑 Ошибка: {error}
        </div>
      )}

      <button
        disabled={placing || !canOrder}
        onClick={async () => {
          setError(null);
          if (!canOrder) {
            setError(blockReasons[0] ?? "Невозможно оформить заказ");
            return;
          }
          try {
            debugLog("Cart", "placeOrder", {
              restaurantId,
              addressId,
              items: items.length,
            });
            const res = await placeOrder({
              variables: {
                input: {
                  restaurantId,
                  addressId,
                  paymentMethod: "COD",
                  note: note.trim() || undefined,
                  items: items.map((i) => ({
                    foodId: i.foodId,
                    quantity: i.quantity,
                  })),
                },
              },
            });
            const orderId = res.data?.placeOrder?.id;
            if (!orderId) {
              setError("Заказ создан, но id не получен");
              return;
            }
            clear();
            router.push(`/orders/${orderId}/waiting`);
          } catch (e: any) {
            debugError("Cart", "placeOrder failed", e.message);
            setError(e.message);
          }
        }}
        className={`w-full h-14 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2 ${
          canOrder
            ? "bg-soft-accent hover:bg-soft-accent-dark text-white shadow-soft active:scale-[0.99]"
            : "bg-soft-surface border border-soft-border text-soft-text-muted opacity-60 cursor-not-allowed"
        }`}
      >
        <ShoppingBag className="w-5 h-5" />
        {placing
          ? "Оформляем заказ…"
          : canOrder
            ? "Заказать (наличными)"
            : `Заблокировано (${blockReasons.length})`}
      </button>
    </div>
  );
}
