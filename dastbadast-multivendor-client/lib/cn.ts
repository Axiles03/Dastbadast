/**
 * Крошечный clsx без зависимостей.
 * Идентично web/lib/cn.ts (для shared-компонентов модификаторов).
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

  return out.join(" ").replace(/\s+/g, " ").trim();
}
