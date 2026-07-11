// dastbadast-multivendor-web/hooks/useFoodModifiers.ts
"use client";

/**
 * ⭐⭐⭐ ШАГ 5: хук для управления выбором модификаторов.
 *
 * Возвращает:
 *   - selectedByGroup: Map<groupId, Set<optionId>>
 *   - perGroupValid: Map<groupId, boolean> — true если выбор соответствует required/min/max
 *   - allValid: boolean — все required группы выбраны, min/max соблюдены
 *   - optionsTotal: number — Σ(price) выбранных опций
 *   - finalPrice: number — food.price + optionsTotal
 *   - toggle(groupId, optionId, multiple) — единая точка входа
 *   - reset() — очистить все
 *   - toMutationInput() — вернуть {groupId, optionId}[] для placeOrder
 *
 * Используется и в FoodDetailModal (web), и в FoodDetailSheet (mobile).
 */

import { useCallback, useMemo, useState } from "react";

type FoodOptionLite = {
  id: string;
  title: string;
  price: number;
  isAvailable: boolean;
};

type ModifierGroupLite = {
  id: string;
  title: string;
  required: boolean;
  multiple: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
  options: FoodOptionLite[];
};

export function useFoodModifiers(
  foodPrice: number,
  groups: ModifierGroupLite[],
) {
  // ⭐ Хранилище: Map<groupId, Set<optionId>> — для O(1) проверок
  const [selectedByGroup, setSelectedByGroup] = useState(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, new Set<string>());
    return m;
  });

  // ⭐ Словарь опций для быстрого расчёта цены
  const optionPriceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      for (const o of g.options) m.set(o.id, o.price);
    }
    return m;
  }, [groups]);

  // ⭐ Toggle: single или multiple — определяется по группе
  const toggle = useCallback(
    (groupId: string, optionId: string) => {
      setSelectedByGroup((prev) => {
        const next = new Map(prev);
        const currentSet = new Set(prev.get(groupId) || []);
        const group = groups.find((g) => g.id === groupId);
        if (!group) return prev;

        if (group.multiple) {
          if (currentSet.has(optionId)) {
            currentSet.delete(optionId);
          } else {
            // ⭐ Защита от превышения maxSelect
            if (currentSet.size >= group.maxSelect) {
              return prev; // игнорируем
            }
            currentSet.add(optionId);
          }
        } else {
          // ⭐ Single: заменяем (radio-behavior)
          currentSet.clear();
          currentSet.add(optionId);
        }
        next.set(groupId, currentSet);
        return next;
      });
    },
    [groups],
  );

  // ⭐ Сброс всех выборов
  const reset = useCallback(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, new Set<string>());
    setSelectedByGroup(m);
  }, [groups]);

  // ⭐ Валидация: возвращает Map<groupId, isValid>
  const perGroupValid = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const g of groups) {
      const selected = selectedByGroup.get(g.id) || new Set();
      let valid = true;
      if (g.required && selected.size === 0) valid = false;
      if (g.multiple) {
        if (selected.size < g.minSelect) valid = false;
        if (selected.size > g.maxSelect) valid = false;
      } else {
        if (g.required && selected.size !== 1) valid = false;
      }
      m.set(g.id, valid);
    }
    return m;
  }, [groups, selectedByGroup]);

  // ⭐ Общая валидность: все группы прошли проверку
  const allValid = useMemo(() => {
    for (const [, valid] of perGroupValid) {
      if (!valid) return false;
    }
    return true;
  }, [perGroupValid]);

  // ⭐ Σ цен выбранных опций
  const optionsTotal = useMemo(() => {
    let sum = 0;
    for (const set of selectedByGroup.values()) {
      for (const optId of set) {
        sum += optionPriceMap.get(optId) || 0;
      }
    }
    return +sum.toFixed(2);
  }, [selectedByGroup, optionPriceMap]);

  // ⭐ Финальная цена за единицу
  const finalPrice = +(foodPrice + optionsTotal).toFixed(2);

  // ⭐ Конвертация в формат input для placeOrder / saveCart (Шаг 2)
  const toMutationInput = useCallback(() => {
    const out: Array<{ groupId: string; optionId: string }> = [];
    for (const [groupId, optSet] of selectedByGroup) {
      for (const optionId of optSet) out.push({ groupId, optionId });
    }
    return out;
  }, [selectedByGroup]);

  return {
    selectedByGroup,
    perGroupValid,
    allValid,
    optionsTotal,
    finalPrice,
    toggle,
    reset,
    toMutationInput,
  };
}
