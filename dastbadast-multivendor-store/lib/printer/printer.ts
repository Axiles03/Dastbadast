// dastbadast-multivendor-store/lib/printer/printer.ts
//
// ⭐ ФАЗА 3, п.11: транспорт для отправки уже собранных ESC/POS-байт (см.
// escpos.ts) на физический принтер...
//
// ⚠️ ТРЕБУЕТСЯ prebuild: `react-native-tcp-socket` — нативный модуль,
// работает только в dev-client/production сборке, НЕ в Expo Go.
//
// ⭐ FIX: раньше модуль импортировался статически наверху файла — это
// крашило ВЕСЬ экран "Новые заказы" сразу при открытии в Expo Go (native
// module invariant violation при загрузке JS-бандла), даже если менеджер
// никогда не пытался печатать. Теперь подключаем его лениво, только внутри
// printTicket(), обёрнуто в try/catch — в Expo Go printTicket() просто
// вернёт { ok: false, reason: "unsupported" } вместо краша приложения.

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "printer:network-config";
const PRINT_PORT_DEFAULT = 9100;
const CONNECT_TIMEOUT_MS = 4000;

export interface PrinterConfig {
  ip: string;
  port: number;
  enabled: boolean;
}

export async function getPrinterConfig(): Promise<PrinterConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setPrinterConfig(cfg: PrinterConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export type PrintResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not-configured"
        | "disabled"
        | "connect-failed"
        | "timeout"
        | "unsupported"; // ⭐ NEW: нативный модуль недоступен (Expo Go)
      detail?: string;
    };

/**
 * Пытается лениво подключить react-native-tcp-socket. Возвращает null,
 * если модуль недоступен (Expo Go) — вместо того, чтобы уронить всё
 * приложение при импорте.
 */
function loadTcpSocket():
  | typeof import("react-native-tcp-socket").default
  | null {
  try {
    return require("react-native-tcp-socket").default;
  } catch {
    return null;
  }
}

/**
 * Отправляет готовые ESC/POS байты на настроенный сетевой принтер.
 * Не бросает исключение — печать не должна ронять экран "Новые заказы",
 * это вспомогательный канал.
 */
export async function printTicket(bytes: Uint8Array): Promise<PrintResult> {
  const cfg = await getPrinterConfig();
  if (!cfg) return { ok: false, reason: "not-configured" };
  if (!cfg.enabled) return { ok: false, reason: "disabled" };

  const TcpSocket = loadTcpSocket();
  if (!TcpSocket) {
    return {
      ok: false,
      reason: "unsupported",
      detail:
        "Печать по сети недоступна в Expo Go — нужна dev-client/production сборка",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      socket.destroy();
      finish({ ok: false, reason: "timeout" });
    }, CONNECT_TIMEOUT_MS);

    const socket = TcpSocket.createConnection(
      {
        host: cfg.ip,
        port: cfg.port || PRINT_PORT_DEFAULT,
      },
      () => {
        socket.write(Buffer.from(bytes));
        clearTimeout(timeout);
        setTimeout(() => {
          socket.destroy();
          finish({ ok: true });
        }, 300);
      },
    );

    socket.on("error", (e: Error) => {
      clearTimeout(timeout);
      finish({ ok: false, reason: "connect-failed", detail: e.message });
    });
  });
}

/**
 * Тестовая печать — используется на экране настроек принтера.
 */
export async function printTestPage(): Promise<PrintResult> {
  const { EscPosBuilder } = await import("./escpos");
  const b = new EscPosBuilder();
  b.init().align("center").bold(true).text("ТЕСТОВАЯ ПЕЧАТЬ").bold(false);
  b.text("Принтер настроен верно ✓");
  b.feed(3).cut();
  return printTicket(b.build());
}
