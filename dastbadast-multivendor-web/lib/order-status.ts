export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает ресторан",
  ACCEPTED: "Принят рестораном",
  ASSIGNED: "Курьер назначен",
  PICKED: "Доставляется",
  AWAITING_CONFIRMATION: "Завершите доставку",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

export const STATUS_STEPS = [
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PICKED",
  "AWAITING_CONFIRMATION",
  "DELIVERED",
] as const;
