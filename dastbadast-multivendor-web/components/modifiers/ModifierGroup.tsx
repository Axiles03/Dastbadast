// dastbadast-multivendor-web/components/modifiers/ModifierGroup.tsx
"use client";

/**
 * ⭐⭐⭐ ШАГ 5: shared компонент группы модификаторов.
 *
 * Используется в FoodDetailModal (web) и FoodDetailSheet (mobile).
 * Полностью controlled — родитель хранит state.
 *
 * Props:
 *   group: { id, title, required, multiple, minSelect, maxSelect, options[] }
 *   selectedIds: Set<string> — какие опции выбраны
 *   onChange: (newSelectedIds: Set<string>) => void
 */

import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type FoodOption = {
  id: string;
  title: string;
  price: number;
  isAvailable: boolean;
};

type ModifierGroupProps = {
  group: {
    id: string;
    title: string;
    required: boolean;
    multiple: boolean;
    minSelect: number;
    maxSelect: number;
    sortOrder?: number;
    options: FoodOption[];
  };
  selectedIds: Set<string>;
  onChange: (newSelectedIds: Set<string>) => void;
  currencySymbol?: string;
};

export function ModifierGroup({
  group,
  selectedIds,
  onChange,
  currencySymbol = "сом.",
}: ModifierGroupProps) {
  const handleSelect = (optionId: string) => {
    const next = new Set(selectedIds);

    if (group.multiple) {
      // ⭐ Multi-select: toggle. Валидируем min/max в useFoodModifiers (родитель).
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
    } else {
      // ⭐ Single-select: заменяем выбор
      next.clear();
      next.add(optionId);
    }
    onChange(next);
  };

  return (
    <section
      className="bg-soft-surface border border-soft-border rounded-2xl p-5"
      aria-labelledby={`mod-group-${group.id}`}
    >
      {/* Заголовок группы с индикатором required */}
      <div className="flex items-baseline justify-between mb-3">
        <h3
          id={`mod-group-${group.id}`}
          className="font-extrabold text-soft-text flex items-center gap-1.5"
        >
          {group.title}
          {group.required && (
            <span className="text-soft-accent text-xs font-bold">
              обязательно
            </span>
          )}
          {group.multiple && (
            <span className="text-soft-text-muted text-xs font-normal">
              · можно выбрать до {group.maxSelect}
            </span>
          )}
        </h3>
        {group.required && selectedIds.size === 0 && (
          <span
            className="text-2xs text-soft-accent flex items-center gap-1"
            title="Нужно выбрать хотя бы одну опцию"
          >
            <AlertCircle className="w-3 h-3" /> не выбрано
          </span>
        )}
      </div>

      {/* Список опций */}
      <ul className="space-y-2">
        {group.options.map((opt) => {
          const isSelected = selectedIds.has(opt.id);
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => opt.isAvailable && handleSelect(opt.id)}
                disabled={!opt.isAvailable}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                  isSelected
                    ? "border-soft-accent bg-soft-accent-soft"
                    : "border-soft-border bg-soft-surface hover:border-soft-accent",
                  !opt.isAvailable && "opacity-50 cursor-not-allowed",
                )}
                aria-pressed={isSelected}
              >
                {/* ⭐ Checkbox / radio indicator */}
                <span
                  className={cn(
                    "w-5 h-5 flex items-center justify-center shrink-0 border-2",
                    group.multiple ? "rounded-md" : "rounded-full",
                    isSelected
                      ? "bg-soft-accent border-soft-accent"
                      : "border-soft-border",
                  )}
                >
                  {isSelected && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-soft-text block">
                    {opt.title}
                  </span>
                  {!opt.isAvailable && (
                    <span className="text-2xs text-soft-text-muted">
                      нет в наличии
                    </span>
                  )}
                </span>

                {/* Цена надбавки */}
                <span
                  className={cn(
                    "text-sm font-extrabold whitespace-nowrap",
                    opt.price === 0
                      ? "text-soft-text-muted"
                      : "text-soft-accent",
                  )}
                >
                  {opt.price === 0
                    ? "Бесплатно"
                    : `+${opt.price} ${currencySymbol}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
