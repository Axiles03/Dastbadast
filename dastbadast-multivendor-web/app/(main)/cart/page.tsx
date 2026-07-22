"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import {
  PLACE_ORDER,
  GET_ADDRESSES,
  GET_CONFIGURATION,
  GET_RESTAURANT_CHECK,
  GET_ORDERS,
  GET_PROFILE,
} from "@/lib/queries";
import { useShell } from "@/lib/shell-context";
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
import {
  CALCULATE_DELIVERY_PRICE_BREAKDOWN,
  CALCULATE_DELIVERY_PRICE,
} from "@/lib/queries";
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
  const apolloClient = useApolloClient();
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

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
  // ⭐ ШАГ 5: один useShell() — здесь же деструктурируем deliveryFee/breakdown
  const {
    setCartOpen,
    deliveryFee: shellDeliveryFee,
    setDeliveryFee,
    setDeliveryBreakdown,
  } = useShell();
  const { data: addrData } = useQuery(GET_ADDRESSES, { skip: !user });
  const { data: cfg } = useQuery(GET_CONFIGURATION);
  const { data: profileData } = useQuery(GET_PROFILE, {
    skip: !user,
    fetchPolicy: "cache-and-network",
  });
  const balance: number = profileData?.profile?.balance ?? 0;
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
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "BALANCE">("COD"); // ⭐ NEW
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
  const minimumOrder = restData?.restaurant?.minimumOrder ?? 0;

  const restaurantCoords = restData?.restaurant?.location?.coordinates ?? null;
  const selectedAddress = addrData?.addresses?.find(
    (a: any) => a.id === addressId,
  );
  const addressCoords = selectedAddress?.location?.coordinates ?? null;
  const { data: deliveryData, loading: deliveryLoading } = useQuery(
    CALCULATE_DELIVERY_PRICE_BREAKDOWN,
    {
      variables: {
        fromCoords: restaurantCoords,
        toCoords: addressCoords,
        basePrice: cfg?.configuration?.deliveryBasePrice,
        baseKm: cfg?.configuration?.deliveryBaseKm,
        perKmPrice: cfg?.configuration?.deliveryPerKmPrice,
      },
      skip: !restaurantCoords || !addressCoords,
    },
  );
  const deliveryBreakdown =
    deliveryData?.calculateDeliveryPriceBreakdown ?? null;
  const deliveryFee = deliveryBreakdown?.total ?? 0;
  const deliveryDistance = deliveryBreakdown?.distanceKm ?? null;
  const calculatedDelivery = deliveryBreakdown;
  const total = +(subtotal + deliveryFee).toFixed(2);

  useEffect(() => {
    setDeliveryFee(deliveryFee);
    setDeliveryBreakdown(deliveryBreakdown);
  }, [deliveryFee, deliveryBreakdown, setDeliveryFee, setDeliveryBreakdown]);

  const blockReasons: string[] = [];
  if (!addressId) blockReasons.push("📍 Выберите адрес доставки");
  if (restaurantCoords && addressCoords && deliveryLoading)
    blockReasons.push("⏳ Считаем стоимость доставки…");
  if (restLoading) blockReasons.push("⏳ Проверяем ресторан…");
  else if (restError)
    blockReasons.push(
      `🛑 API недоступен: ${restError.message}. Запущен ли бэкенд на http://localhost:8001/graphql?`,
    );
  else if (!restData?.restaurant)
    blockReasons.push("🚫 Ресторан из корзины больше не существует.");
  else if (restData.restaurant.isAvailable === false)
    blockReasons.push("🚫 Ресторан временно не принимает заказы.");
  else if (restData.restaurant.isOpenNow === false)
    blockReasons.push(
      `🕐 Ресторан закрыт · откроется в ${restData.restaurant.workingHours?.open ?? ""}`,
    );
  else if (minimumOrder > 0 && subtotal < minimumOrder)
    blockReasons.push(
      `💰 Минимальная сумма заказа: ${minimumOrder} ${sym}. Добавьте ещё на ${(minimumOrder - subtotal).toFixed(0)} ${sym}.`,
    );
  // ⭐ NEW — оплата балансом, но денег не хватает
  if (paymentMethod === "BALANCE" && balance < total)
    blockReasons.push(
      `💳 Недостаточно средств на балансе (${balance} ${sym} из ${total} ${sym}). Пополните баланс или выберите оплату наличными.`,
    );
  if (!restaurantCoords || !addressCoords)
    blockReasons.push("📍 Выберите адрес в зоне доставки");
  const canOrder = blockReasons.length === 0;

  if (items.length === 0) {
    return <div>Корзина пуста</div>;
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

      {/* === Итог === */}
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

      {/* === Способ оплаты === */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 shadow-soft-sm">
        <h2 className="font-extrabold text-soft-text mb-3">Способ оплаты</h2>
        <div className="space-y-2">
          <label
            className={`flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
              paymentMethod === "COD"
                ? "bg-soft-accent-soft border-soft-accent"
                : "bg-soft-surface-2 border-soft-border hover:border-soft-accent"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "COD"}
                onChange={() => setPaymentMethod("COD")}
                className="accent-soft-accent w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-soft-text text-sm">
                Наличными при получении
              </span>
            </span>
          </label>
          <label
            className={`flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
              paymentMethod === "BALANCE"
                ? "bg-soft-accent-soft border-soft-accent"
                : "bg-soft-surface-2 border-soft-border hover:border-soft-accent"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "BALANCE"}
                onChange={() => setPaymentMethod("BALANCE")}
                className="accent-soft-accent w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-soft-text text-sm">
                С баланса
              </span>
            </span>
            <span className="text-xs text-soft-text-muted font-semibold">
              {balance} {sym}
            </span>
          </label>
        </div>
      </section>

      {/* === Итог === */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-5 text-sm space-y-2 shadow-soft-sm">
        <div className="flex justify-between text-soft-text-soft">
          <span>Подытог {`${subtotal} ${sym}`}</span>
          <span className="text-soft-text font-bold">
            {subtotal} {sym}
          </span>
        </div>
        {/* ⭐⭐⭐ ШАГ 4: блок "Доставка" с детализацией (base + perKm = total).
            Использует deliveryBreakdown из API. Если адрес не выбран — показываем
            прочерк (цена вычислится после выбора адреса). */}
        <button
          type="button"
          onClick={() => {
            // Разворачиваем подсказку с разбивкой
            const el = document.getElementById("delivery-breakdown");
            if (el) el.classList.toggle("hidden");
          }}
          className="w-full flex justify-between text-soft-text-soft hover:text-soft-text transition-colors"
        >
          <span className="text-left">
            Доставка{" "}
            {!addressId ? (
              <span className="text-soft-text-muted text-xs">
                (выберите адрес)
              </span>
            ) : calculatedDelivery ? (
              <span className="text-soft-text-muted text-xs">
                {calculatedDelivery.isOverBase
                  ? `📏 ${calculatedDelivery.distanceKm.toFixed(1)} км`
                  : "≤ базового радиуса"}
              </span>
            ) : null}
          </span>
          <span className="text-soft-text font-bold">
            {deliveryFee} {sym}
          </span>
        </button>
        {calculatedDelivery && addressId && (
          <div
            id="delivery-breakdown"
            className="text-xs text-soft-text-muted bg-soft-surface-2 px-3 py-2 rounded-lg"
          >
            <div className="flex justify-between">
              <span>
                Базовая ставка (≤ {cfg?.configuration?.deliveryBaseKm ?? 3} км)
              </span>
              <span className="font-bold text-soft-text-soft">
                {calculatedDelivery.base} {sym}
              </span>
            </div>
            {calculatedDelivery.isOverBase && (
              <div className="flex justify-between">
                <span>
                  Сверх базы: {calculatedDelivery.distanceKm.toFixed(2)} км ×{" "}
                  {cfg?.configuration?.deliveryPerKmPrice ?? 3} {sym}/км
                </span>
                <span className="font-bold text-soft-text-soft">
                  +{calculatedDelivery.perKm} {sym}
                </span>
              </div>
            )}
            <div className="text-2xs mt-1 italic">
              Расчёт по формуле: base + perKm × (distance − baseKm)
            </div>
          </div>
        )}

        <div className="border-t border-soft-border pt-2 flex justify-between font-extrabold text-base">
          <span className="text-soft-text">Итого к оплате</span>
          <span className="text-soft-accent text-lg">
            {total} {sym}
          </span>
        </div>
        <p className="text-xs text-soft-text-muted pt-1">
          {paymentMethod === "BALANCE"
            ? "Оплата спишется с баланса сразу при оформлении."
            : "Оплата наличными или картой курьеру при получении."}
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
            // ⭐ ФИКС: `refetchQueries` / `awaitRefetchQueries` — это опции
            // вызова placeOrder(...) в Apollo, а НЕ поля GraphQL-типа
            // PlaceOrderInput. Раньше они лежали внутри variables.input,
            // из-за чего сервер отклонял запрос на этапе валидации
            // ("Field \"refetchQueries\" is not defined by type
            // \"PlaceOrderInput\"") — заказ никогда не создавался.
            const res = await placeOrder({
              variables: {
                input: {
                  restaurantId,
                  addressId,
                  paymentMethod, // ⭐ NEW: было захардкожено "COD"
                  note: note.trim() || undefined,
                  idempotencyKey: idempotencyKeyRef.current,
                  deliveryPrice: deliveryFee,
                  items: items.map((i) => ({
                    foodId: i.foodId,
                    quantity: i.quantity,
                    selectedOptions: i.selectedOptions?.map((o) => ({
                      groupId: o.groupId,
                      optionId: o.optionId,
                    })),
                  })),
                },
              },
              refetchQueries:
                paymentMethod === "BALANCE"
                  ? [{ query: GET_ORDERS }, { query: GET_PROFILE }]
                  : [{ query: GET_ORDERS }],
              awaitRefetchQueries: true,
            });
            const orderId = res.data?.placeOrder?.id;
            if (!orderId) {
              setError("Заказ создан, но id не получен");
              return;
            }
            clear();
            await apolloClient.resetStore();
            idempotencyKeyRef.current = crypto.randomUUID();
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
            ? `Заказать (${paymentMethod === "BALANCE" ? "с баланса" : "наличными"})`
            : `Заблокировано (${blockReasons.length})`}
      </button>
    </div>
  );
}
