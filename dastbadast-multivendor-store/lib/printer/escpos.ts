// dastbadast-multivendor-store/lib/printer/escpos.ts
//
// ⭐ ФАЗА 3, п.11: раньше в проекте не было ни одного упоминания ESC/POS —
// печать чеков на кухню отсутствовала как класс. Это билдер команд,
// независимый от транспорта (сетевой/Bluetooth/USB — см. printer.ts).
//
// Формат: набираем массив байт по спецификации ESC/POS (стандарт, который
// понимают почти все китайские/no-name кухонные термопринтеры, не только
// брендовые Epson/Star). Кодировка — CP866 для кириллицы (самая
// распространённая на дешёвых 58/80мм принтерах в СНГ; часть принтеров
// ожидает Windows-1251 — см. настройку encoding в printer.ts).

const ESC = 0x1b;
const GS = 0x1d;

export type TicketAlign = "left" | "center" | "right";

export class EscPosBuilder {
  private bytes: number[] = [];

  private push(...codes: number[]) {
    this.bytes.push(...codes);
    return this;
  }

  init() {
    return this.push(ESC, 0x40); // ESC @ — сброс принтера к дефолтам
  }

  align(a: TicketAlign) {
    const map = { left: 0, center: 1, right: 2 };
    return this.push(ESC, 0x61, map[a]);
  }

  bold(on: boolean) {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }

  doubleSize(on: boolean) {
    // GS ! — ширина и высота x2 одновременно (0x11), обычный размер (0x00)
    return this.push(GS, 0x21, on ? 0x11 : 0x00);
  }

  /** Кодирует кириллический текст в CP866 и добавляет в буфер + перевод строки. */
  text(str: string, opts: { newline?: boolean } = { newline: true }) {
    const encoded = encodeCp866(str);
    this.bytes.push(...encoded);
    if (opts.newline !== false) this.bytes.push(0x0a);
    return this;
  }

  divider(char = "-", width = 32) {
    return this.text(char.repeat(width));
  }

  feed(lines = 1) {
    return this.push(ESC, 0x64, lines); // ESC d n — прогон n строк
  }

  cut() {
    return this.push(GS, 0x56, 0x42, 0x00); // GS V B 0 — полная отрезка (partial cut на некоторых моделях)
  }

  /** Звуковой сигнал самого принтера (buzzer) — есть не на всех моделях. */
  beep() {
    return this.push(ESC, 0x42, 0x02, 0x02); // ESC B n t — 2 сигнала
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

// ⭐ Минимальная таблица CP866 для кириллицы А-Я/а-я + базовая латиница/цифры
// напрямую как ASCII. Этого достаточно для чеков (названия блюд, суммы,
// адреса) — полноценная библиотека iconv тут избыточна для одного юзкейса.
function encodeCp866(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code); // ASCII как есть
    } else if (code >= 0x0410 && code <= 0x044f) {
      // А-Я (0x0410-0x042F) -> CP866 0x80-0x9F ; а-я (0x0430-0x044F) -> 0xA0-0xBF
      out.push(code <= 0x042f ? code - 0x0410 + 0x80 : code - 0x0430 + 0xa0);
    } else if (code === 0x0401) {
      out.push(0xf0); // Ё
    } else if (code === 0x0451) {
      out.push(0xf1); // ё
    } else {
      out.push(0x3f); // '?' — неизвестный символ, не роняем печать
    }
  }
  return out;
}

export interface KitchenTicketOrder {
  shortId: string; // последние 6 символов orderId — то, что видит клиент
  createdAt: string;
  paymentMethod: "CASH" | "CARD" | "COD" | string;
  paid: boolean;
  note?: string | null;
  items: { title: string; quantity: number; price: number }[];
  deliveryAddress?: { address?: string; city?: string } | null;
  isPreOrder?: boolean;
  scheduledFor?: string | null;
}

/**
 * ⭐ ФАЗА 3, п.11: собирает кухонный чек. Намеренно БЕЗ цен построчно по
 * умолчанию мелким шрифтом — кухне важнее название и количество крупным
 * шрифтом, чтобы читалось с полуметра в шуме и суете. Итоговая сумма — только
 * для сверки, мелко внизу.
 */
export function buildKitchenTicket(order: KitchenTicketOrder): Uint8Array {
  const b = new EscPosBuilder();
  b.init().align("center").doubleSize(true).bold(true);
  b.text(`ЗАКАЗ #${order.shortId}`);
  b.doubleSize(false).bold(false);

  if (order.isPreOrder && order.scheduledFor) {
    b.bold(true)
      .text(`⏰ К ВРЕМЕНИ: ${formatTicketTime(order.scheduledFor)}`)
      .bold(false);
  }

  b.align("left").divider();
  b.text(`Принят: ${formatTicketTime(order.createdAt)}`);
  b.text(paymentLabel(order.paymentMethod, order.paid));
  b.divider();
  b.feed(1);

  for (const item of order.items) {
    b.doubleSize(true).bold(true);
    b.text(`${item.quantity}x ${item.title}`);
    b.doubleSize(false).bold(false);
  }

  b.feed(1).divider();

  if (order.deliveryAddress?.address) {
    b.text(`Доставка: ${order.deliveryAddress.address}`);
  } else {
    b.text("Самовывоз");
  }

  if (order.note) {
    b.divider();
    b.bold(true).text(`Комментарий: ${order.note}`).bold(false);
  }

  b.divider();
  const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  b.align("right").text(`Итого: ${total.toLocaleString("ru")} сом.`);

  b.feed(3).cut();
  return b.build();
}

function formatTicketTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(method: string, paid: boolean): string {
  if (method === "COD" || method === "CASH") return "Оплата: наличными курьеру";
  return paid ? "Оплата: картой (оплачено)" : "Оплата: картой (ожидание)";
}
