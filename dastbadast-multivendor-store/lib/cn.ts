/**
 * Крошечный clsx без зависимостей.
 * Принимает строки, числа, null, undefined, false, массивы и объекты { key: bool }.
 *
 * Использование вместо шаблонных литералов с `${...}` через перенос строки:
 *   cn("base", isActive && "bg-accent text-text-inverse", { "opacity-50": disabled })
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) {
        if (on) out.push(k);
      }
    }
  };

  inputs.forEach(walk);

  // Схлопываем повторяющиеся пробелы
  return out.join(" ").replace(/\s+/g, " ").trim();
}
