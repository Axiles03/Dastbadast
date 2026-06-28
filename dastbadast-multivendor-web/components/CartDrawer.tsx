"use client";

import Link from "next/link";
import { X, ChevronUp, ChevronDown, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useShell } from "@/lib/shell-context";

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { cartExpanded, setCartExpanded } = useShell();
  const { items, setQty, remove, subtotal, restaurantName } = useCart();

  // Превью: если корзина свёрнута, показываем плашку с количеством
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-soft-dark-2/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 h-screen bg-soft-surface z-50 shadow-drawer flex flex-col transition-[width] duration-300 ${
          cartExpanded ? "w-full sm:w-[420px]" : "w-[88px]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-soft-border">
          {cartExpanded ? (
            <h3 className="font-extrabold text-base text-soft-text">
              Список заказа и стоимость
            </h3>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCartExpanded(!cartExpanded)}
              aria-label={cartExpanded ? "Свернуть" : "Развернуть"}
              className="w-8 h-8 rounded-lg hover:bg-soft-surface-2 flex items-center justify-center text-soft-text-soft"
            >
              {cartExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="w-8 h-8 rounded-lg hover:bg-soft-surface-2 flex items-center justify-center text-soft-text-soft"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!cartExpanded ? (
          // Свернутое состояние — вертикальный «rail»
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-2">
            <div className="text-soft-text-soft text-sm">🛒</div>
            <div className="font-extrabold text-soft-text text-sm">
              {items.length}
            </div>
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div className="text-5xl mb-3">🛒</div>
                <p className="font-bold text-soft-text">Корзина пуста</p>
                <p className="text-sm text-soft-text-soft mt-1">
                  Добавьте блюда из меню ресторана
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto p-5 space-y-4">
                {restaurantName && (
                  <div className="text-xs text-soft-text-muted font-semibold">
                    {restaurantName}
                  </div>
                )}
                {items.map((i) => (
                  <li key={i.foodId} className="flex items-center gap-3 group">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-soft-surface-2 shrink-0 border border-soft-border">
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
                      <div className="text-sm font-bold text-soft-text truncate">
                        {i.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-soft-text-soft">
                        <button
                          type="button"
                          onClick={() => setQty(i.foodId, i.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-soft-surface-2 hover:bg-soft-border flex items-center justify-center"
                          aria-label="Меньше"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-soft-text font-bold">
                          {i.quantity} ×
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(i.foodId, i.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-soft-surface-2 hover:bg-soft-border flex items-center justify-center"
                          aria-label="Больше"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-soft-text font-bold ml-1">
                          {i.price * i.quantity} сом.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i.foodId)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-soft-text-muted transition"
                      aria-label="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}

                <Link
                  href="/"
                  onClick={onClose}
                  className="block text-center text-soft-accent font-bold text-sm py-3 hover:underline"
                >
                  + Добавить ещё блюда
                </Link>
              </ul>
            )}

            {/* Подвал с суммами и CTA */}
            <div className="p-5 border-t border-soft-border space-y-2">
              <Row label="Подытог" value={`${subtotal} сом.`} />
              <Row label="Доставка" value="0 сом." muted />
              <div className="pt-2 border-t border-soft-border flex justify-between items-center">
                <span className="font-extrabold text-soft-text">Итого</span>
                <span className="font-extrabold text-soft-accent text-lg">
                  {subtotal} сом.
                </span>
              </div>
              <Link
                href="/cart"
                onClick={onClose}
                className="mt-3 block text-center w-full py-3.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-colors"
              >
                Оформить заказ
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-soft-text-soft">{label}</span>
      <span
        className={muted ? "text-soft-text-muted" : "text-soft-text font-bold"}
      >
        {value}
      </span>
    </div>
  );
}
