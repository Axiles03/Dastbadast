"use client";

import { UtensilsCrossed, TrendingUp, Salad, Pizza, Soup } from "lucide-react";

export type ChipId = "all" | "popular" | "salad" | "pizza" | "pasta";

const CHIPS: { id: ChipId; label: string; icon: any }[] = [
  { id: "all", label: "Все блюда", icon: UtensilsCrossed },
  { id: "popular", label: "Популярные", icon: TrendingUp },
  { id: "salad", label: "Салаты", icon: Salad },
  { id: "pizza", label: "Пицца", icon: Pizza },
  { id: "pasta", label: "Паста", icon: Soup },
];

export function CategoryChips({
  active,
  onChange,
}: {
  active: ChipId;
  onChange: (id: ChipId) => void;
}) {
  return (
    <div className="-mx-5 sm:mx-0 overflow-x-auto scrollbar-hide mb-6">
      <div className="flex gap-2 px-5 sm:px-0 pb-1">
        {CHIPS.map((c) => {
          const Icon = c.icon;
          const a = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-extrabold whitespace-nowrap transition-colors ${
                a
                  ? "bg-soft-accent text-white shadow-soft"
                  : "bg-soft-surface text-soft-text-soft border border-soft-border hover:border-soft-accent hover:text-soft-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
