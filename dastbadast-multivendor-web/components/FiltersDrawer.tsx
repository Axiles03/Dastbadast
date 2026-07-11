// dastbadast-multivendor-web/components/FiltersDrawer.tsx
"use client";

import { X, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import {
  useShell,
  DEFAULT_RESTAURANT_FILTERS,
  RestaurantFilters,
} from "@/lib/shell-context";

export function FiltersDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { restaurantFilters, setRestaurantFilters } = useShell();
  // локальный черновик — применяется только по кнопке "Применить"
  const [draft, setDraft] = useState<RestaurantFilters>(restaurantFilters);

  useEffect(() => {
    if (open) setDraft(restaurantFilters);
  }, [open, restaurantFilters]);

  if (!open) return null;

  const apply = () => {
    setRestaurantFilters(draft);
    onClose();
  };

  const reset = () => {
    setDraft(DEFAULT_RESTAURANT_FILTERS);
    setRestaurantFilters(DEFAULT_RESTAURANT_FILTERS);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-soft-dark-2/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[400px] bg-soft-surface z-50 shadow-drawer flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-soft-border">
          <h3 className="font-extrabold text-base text-soft-text">Фильтры</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-lg hover:bg-soft-surface-2 flex items-center justify-center text-soft-text-soft"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Group title="Сортировка">
            <Option
              label="По рейтингу"
              active={draft.sortBy === "rating"}
              onClick={() => setDraft((d) => ({ ...d, sortBy: "rating" }))}
            />
            <Option
              label="По времени доставки"
              active={draft.sortBy === "deliveryTime"}
              onClick={() =>
                setDraft((d) => ({ ...d, sortBy: "deliveryTime" }))
              }
            />
            <Option
              label="По минимальному заказу"
              active={draft.sortBy === "minimumOrder"}
              onClick={() =>
                setDraft((d) => ({ ...d, sortBy: "minimumOrder" }))
              }
            />
          </Group>

          <Group title="Минимальный заказ">
            <Option
              label="до 50 сом."
              active={draft.maxMinimumOrder === 50}
              onClick={() => setDraft((d) => ({ ...d, maxMinimumOrder: 50 }))}
            />
            <Option
              label="до 100 сом."
              active={draft.maxMinimumOrder === 100}
              onClick={() => setDraft((d) => ({ ...d, maxMinimumOrder: 100 }))}
            />
            <Option
              label="Любой"
              active={draft.maxMinimumOrder === null}
              onClick={() => setDraft((d) => ({ ...d, maxMinimumOrder: null }))}
            />
          </Group>

          <Group title="Время доставки">
            <Option
              label="до 30 мин"
              active={draft.maxDeliveryTime === 30}
              onClick={() => setDraft((d) => ({ ...d, maxDeliveryTime: 30 }))}
            />
            <Option
              label="до 60 мин"
              active={draft.maxDeliveryTime === 60}
              onClick={() => setDraft((d) => ({ ...d, maxDeliveryTime: 60 }))}
            />
            <Option
              label="Не важно"
              active={draft.maxDeliveryTime === null}
              onClick={() => setDraft((d) => ({ ...d, maxDeliveryTime: null }))}
            />
          </Group>
        </div>

        <div className="p-5 border-t border-soft-border flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 py-3.5 border border-soft-border text-soft-text-soft font-bold rounded-2xl hover:bg-soft-surface-2 flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Сбросить
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-1 py-3.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl"
          >
            Применить
          </button>
        </div>
      </aside>
    </>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-extrabold text-soft-text-muted tracking-widest mb-2">
        {title.toUpperCase()}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Option({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <label
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        active
          ? "border-soft-accent bg-soft-accent-soft"
          : "border-soft-border bg-soft-surface hover:border-soft-accent"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
          active ? "border-soft-accent" : "border-soft-border"
        }`}
      >
        {active && <span className="w-2 h-2 rounded-full bg-soft-accent" />}
      </span>
      <span
        className={`text-sm font-semibold ${
          active ? "text-soft-text" : "text-soft-text-soft"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
