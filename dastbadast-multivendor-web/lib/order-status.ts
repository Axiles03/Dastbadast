export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает ресторан",
  ACCEPTED: "Принят рестораном",
  PREPARING: "Готовится",
  READY_FOR_PICKUP: "Готов, ждёт курьера",
  ASSIGNED: "Курьер назначен",
  PICKED: "Доставляется",
  AWAITING_CONFIRMATION: "Завершите доставку",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

export const STATUS_STEPS = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "ASSIGNED",
  "PICKED",
  "AWAITING_CONFIRMATION",
  "DELIVERED",
] as const;
