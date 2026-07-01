// dastbadast-multivendor-rider/lib/cn.ts
/**
 * Крошечный clsx без зависимостей.
 * Принимает строки, числа, boolean-true, null, undefined, false, массивы
 * и объекты { className: boolean | null | undefined }.
 * Фильтрует falsy и склеивает оставшееся через пробел.
 *
 * @example
 *   cn("base", isActive && "bg-accent", { "opacity-50": disabled })
 *   // → "base bg-accent opacity-50" (если disabled=true)
 */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (v: ClassValue): void => {
    if (v === null || v === undefined || v === false) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) {
        if (on) out.push(k);
      }
    }
  };

  for (const input of inputs) walk(input);

  // Схлопываем множественные пробелы в один и тримим
  return out.join(" ").replace(/\s+/g, " ").trim();
}
