const TWO = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function formatTimeAgo(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "только что";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

export function formatDateTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("ru", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatItemsCount(n: number): string {
  return `${n} ${pluralize(n, "блюдо", "блюда", "блюд")}`;
}

export function formatOrdersCount(n: number): string {
  return `${n} ${pluralize(n, "заказ", "заказа", "заказов")}`;
}
