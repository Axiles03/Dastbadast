// dastbadast-multivendor-rider/lib/gps.ts
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApolloClient, gql } from "@apollo/client";

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($input: RiderLocationInput!) {
    updateRiderLocation(input: $input) {
      id
      location
      available
    }
  }
`;

const STOP_STREAM = gql`
  mutation StopStream {
    stopRiderLocationStream
  }
`;

// ⭐⭐⭐ Background task: продолжает отправлять GPS даже когда приложение в фоне
const BACKGROUND_LOCATION_TASK = "background-location-task";

let foregroundTimer: ReturnType<typeof setInterval> | null = null;
let client: ApolloClient | null = null;
let isBackgroundRegistered = false;
let lastBearing: { lat: number; lng: number; bearing: number } | null = null;

function computeBearing(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(toLng - fromLng);
  const lat1r = toRad(fromLat);
  const lat2r = toRad(toLat);
  const y = Math.sin(dLng) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/* ============================================================
 * ⭐⭐⭐ RETRY QUEUE: буфер GPS-пингов на устройстве.
 *
 * Проблема: если у курьера пропадает сеть (метро, подвал, плохое
 * покрытие), `client.mutate()` падает с сетевой ошибкой, точка
 * теряется навсегда — клиент и диспетчер видят курьера "замёршим"
 * в последней успешно отправленной точке, хотя курьер продолжает
 * ехать.
 *
 * Решение: если отправка падает именно по СЕТЕВОЙ причине (не по
 * бизнес-ошибке типа "не авторизован" или серверной ошибке валидации),
 * точка кладётся в очередь на устройстве (в памяти + AsyncStorage,
 * чтобы пережить перезапуск приложения). При каждой следующей
 * успешной попытке отправки сначала выгружается очередь (по порядку,
 * от старых к новым), и только потом — свежая точка.
 *
 * Очередь ограничена по размеру и по возрасту точек: если курьер был
 * оффлайн 20 минут, отправлять все накопленные точки бессмысленно —
 * шлём только последние (актуальные для истории/аналитики), а не
 * бесконечно растущий бэклог.
 * ============================================================ */

type QueuedPing = {
  lng: number;
  lat: number;
  bearing: number | null;
  // ⭐ Фаза 1 (аудит): Android mock-location флаг из expo-location.
  // На iOS всегда null/undefined — API его не предоставляет.
  mocked: boolean | null;
  capturedAt: number; // Date.now() в момент, когда координата была получена
};

const RETRY_QUEUE_STORAGE_KEY = "@dbd_rider_gps_retry_queue_v1";
const MAX_QUEUE_SIZE = 30; // ~5 мин бэклога при пинге раз в 10 сек
const MAX_QUEUE_AGE_MS = 15 * 60 * 1000; // точки старше 15 мин не имеют смысла — выбрасываем
const MAX_FLUSH_PER_CALL = 6; // не блокируем надолго один тик отправки

let retryQueue: QueuedPing[] = [];
let queueLoaded = false;
let queueLoadPromise: Promise<void> | null = null;
let flushInFlight = false;

async function loadQueueOnce(): Promise<void> {
  if (queueLoaded) return;
  if (!queueLoadPromise) {
    queueLoadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(RETRY_QUEUE_STORAGE_KEY);
        retryQueue = raw ? JSON.parse(raw) : [];
      } catch {
        retryQueue = [];
      }
      queueLoaded = true;
    })();
  }
  await queueLoadPromise;
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      RETRY_QUEUE_STORAGE_KEY,
      JSON.stringify(retryQueue),
    );
  } catch {
    /* ignore — best-effort persistence */
  }
}

function pruneStaleEntries(): boolean {
  const cutoff = Date.now() - MAX_QUEUE_AGE_MS;
  const before = retryQueue.length;
  retryQueue = retryQueue.filter((p) => p.capturedAt >= cutoff);
  return retryQueue.length !== before;
}

async function enqueueRetry(ping: QueuedPing): Promise<void> {
  await loadQueueOnce();
  retryQueue.push(ping);
  pruneStaleEntries();
  // Если очередь переполнена — выбрасываем самые старые (сеть отсутствовала
  // очень долго), сохраняя самые свежие точки как более полезные.
  if (retryQueue.length > MAX_QUEUE_SIZE) {
    retryQueue = retryQueue.slice(retryQueue.length - MAX_QUEUE_SIZE);
  }
  await persistQueue();
  if (__DEV__) {
    console.log(
      "[GPS] queued for retry (offline), queue size:",
      retryQueue.length,
    );
  }
}

/**
 * Классифицирует ошибку мутации:
 * - "network"  → сети реально нет / таймаут — стоит поставить в очередь
 * - "auth"     → не авторизован — точку теряем (переотправка не поможет)
 * - "server"   → GraphQL/сервер вернул ошибку по этой самой точке
 *                (например, невалидные координаты, либо баг вроде
 *                упавшего резолвера) — переотправка ТОЙ ЖЕ точки не
 *                поможет, поэтому не queue'им, только логируем.
 */
function classifyMutationError(e: unknown): "network" | "auth" | "server" {
  const err = e as any;
  const msg = String(err?.message ?? err);

  if (/Not authenticated|UNAUTHENTICATED|401/i.test(msg)) return "auth";

  const isNetworkError =
    !!err?.networkError ||
    /Network request failed|Failed to fetch|network error|timeout|ETIMEDOUT|ECONNREFUSED|offline/i.test(
      msg,
    );
  if (isNetworkError) return "network";

  return "server";
}

async function sendRawPing(input: {
  lng: number;
  lat: number;
  bearing: number | null;
  mocked?: boolean | null;
}): Promise<"ok" | "network" | "dropped"> {
  if (!client) return "dropped";
  try {
    await client.mutate({ mutation: UPDATE_LOCATION, variables: { input } });
    return "ok";
  } catch (e) {
    const kind = classifyMutationError(e);
    if (kind === "network") return "network";
    if (kind === "auth") return "dropped";
    // "server": логируем один раз, точку не ретраим (см. классификатор выше)
    console.warn("[GPS] send failed:", String((e as Error)?.message ?? e));
    return "dropped";
  }
}

/**
 * Выгружает очередь на устройстве (FIFO), пока не встретит очередную
 * сетевую ошибку (тогда останавливается — сети всё ещё нет) или пока
 * не выгрузит весь бэклог / лимит за один вызов.
 * Возвращает true, если сеть сейчас доступна (можно отправлять свежую точку).
 */
async function flushRetryQueue(): Promise<boolean> {
  await loadQueueOnce();
  if (retryQueue.length === 0) return true;
  if (flushInFlight) return false; // уже идёт выгрузка в другом тике
  flushInFlight = true;
  try {
    pruneStaleEntries();
    let sentCount = 0;
    let networkStillDown = false;

    while (
      retryQueue.length > 0 &&
      sentCount < MAX_FLUSH_PER_CALL &&
      !networkStillDown
    ) {
      const next = retryQueue[0];
      const result = await sendRawPing({
        lng: next.lng,
        lat: next.lat,
        bearing: next.bearing,
        mocked: next.mocked,
      });
      if (result === "ok" || result === "dropped") {
        retryQueue.shift();
        sentCount++;
      } else {
        // "network" — сеть всё ещё недоступна, останавливаемся,
        // остаток очереди остаётся на следующую попытку.
        networkStillDown = true;
      }
    }

    if (sentCount > 0) {
      await persistQueue();
      if (__DEV__) {
        console.log(
          `[GPS] retry queue flushed ${sentCount} point(s), ${retryQueue.length} remaining`,
        );
      }
    }
    return !networkStillDown;
  } finally {
    flushInFlight = false;
  }
}

export function getRetryQueueSize(): number {
  return retryQueue.length;
}

/* ============================================================ */

async function sendLocationToServer(
  lng: number,
  lat: number,
  isBackground = false,
  mocked: boolean | null = null,
): Promise<void> {
  if (!client) return;
  const token = (globalThis as any).__DBD_RIDER_TOKEN__;
  if (!token) return;

  let bearing: number | null = null;
  if (lastBearing) {
    bearing = computeBearing(lastBearing.lat, lastBearing.lng, lat, lng);
  }
  lastBearing = { lat, lng, bearing: bearing ?? 0 };

  // ⭐ Сначала пробуем выгрузить бэклог (если сеть только что вернулась),
  // чтобы сохранить порядок точек. Если сети всё ещё нет — сразу же
  // ставим свежую точку в очередь, не тратя лишний mutate.
  const networkLooksUp = await flushRetryQueue();
  if (!networkLooksUp) {
    await enqueueRetry({ lng, lat, bearing, mocked, capturedAt: Date.now() });
    return;
  }

  const result = await sendRawPing({ lng, lat, bearing, mocked });
  if (result === "ok") {
    if (__DEV__) {
      console.log(`[GPS${isBackground ? "-BG" : ""}] sent`, {
        lng: lng.toFixed(5),
        lat: lat.toFixed(5),
        bearing: bearing?.toFixed(0) ?? "—",
      });
    }
  } else if (result === "network") {
    await enqueueRetry({ lng, lat, bearing, mocked, capturedAt: Date.now() });
  }
  // "dropped" — уже залогировано/не имеет смысла ретраить, ничего не делаем
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[BG-GPS] task error:", error.message);
    return;
  }
  if (!data || !client) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;
  const loc = locations[locations.length - 1];
  // ⭐ Фаза 1 (аудит): `mocked` — поле expo-location, заполняется на Android
  // при активном mock-location провайдере (Developer Options → Select
  // mock location app). На iOS отсутствует — там придёт undefined → null.
  await sendLocationToServer(
    loc.coords.longitude,
    loc.coords.latitude,
    true,
    (loc as any).mocked ?? null,
  );
});

/**
 * ⭐⭐⭐ ШАГ 2: возвращаем структурированный результат, чтобы orders.tsx
 * мог показать Alert при permission denied.
 * `backgroundGranted` — отдельно, не блокирует ok:true (foreground достаточно
 * для работы), но UI может ненавязчиво предложить включить background,
 * так как от этого напрямую зависит точность позиции в фоне.
 */
export type GpsStartResult =
  | { ok: true; backgroundGranted: boolean }
  | { ok: false; reason: "denied" | "unavailable" | "no_token" };

/**
 * Запустить GPS-стрим.
 * 1) Запрашивает foreground permission.
 * 2) Если granted — отправляет текущую точку, запускает таймер каждые 10 сек.
 * 3) Запрашивает background permission (только если foreground grant'нут).
 * 4) Если foreground denied — возвращает { ok: false, reason: "denied" }.
 */
export async function startGpsLoop(c: ApolloClient): Promise<GpsStartResult> {
  client = c;
  await loadQueueOnce();

  // ⭐⭐⭐ ШАГ 2: проверяем наличие токена ДО запроса permission.
  // Это устраняет бессмысленный "GPS permission denied" при logout.
  const token = (globalThis as any).__DBD_RIDER_TOKEN__;
  if (!token) {
    return { ok: false, reason: "no_token" };
  }

  const { status: fgStatus, canAskAgain } =
    await Location.requestForegroundPermissionsAsync();

  if (fgStatus !== "granted") {
    // ⭐⭐⭐ ШАГ 2: различаем "denied" и "unavailable"
    if (canAskAgain === false) {
      console.warn(
        "[GPS] foreground permission permanently denied — open Settings",
      );
    } else {
      console.warn("[GPS] foreground permission denied");
    }
    return { ok: false, reason: "denied" };
  }

  if (foregroundTimer) clearInterval(foregroundTimer);
  await sendOnce();
  foregroundTimer = setInterval(sendOnce, 10_000);

  let backgroundGranted = false;
  try {
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus === "granted") {
      await startBackgroundUpdates();
      backgroundGranted = true;
    } else {
      // ⭐⭐⭐ FIX: раньше это тихо оседало в консоли и на этом всё
      // заканчивалось. Без background permission таймер выше (setInterval)
      // на iOS/Android приостанавливается, когда приложение уходит в фон —
      // то есть GPS фактически перестаёт отправляться, как только курьер
      // сворачивает приложение (а курьеры именно так и ездят). Теперь
      // явно возвращаем backgroundGranted:false, чтобы orders.tsx мог
      // показать ненавязчивый баннер с предложением включить "Разрешить
      // всегда" в настройках — это напрямую влияет на точность позиции
      // у клиента и диспетчера, когда экран выключен/приложение свёрнуто.
      console.warn(
        "[GPS] background permission not granted — position updates will pause while the app is backgrounded",
      );
    }
  } catch (e) {
    console.warn("[GPS] background tracking init failed:", e);
  }

  return { ok: true, backgroundGranted };
}

export async function stopGpsLoop(): Promise<void> {
  if (foregroundTimer) {
    clearInterval(foregroundTimer);
    foregroundTimer = null;
  }
  if (isBackgroundRegistered) {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
      );
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
      isBackgroundRegistered = false;
    } catch (e) {
      console.warn("[GPS] failed to stop background:", e);
    }
  }
  if (client) {
    try {
      await client.mutate({ mutation: STOP_STREAM });
    } catch {
      /* ignore */
    }
  }
  client = null;
}

/**
 * ⭐⭐⭐ ШАГ 2: проверить текущий статус permission без запроса.
 * Используется в orders.tsx перед тем, как предлагать пользователю снова.
 */
export async function getPermissionStatus(): Promise<{
  foreground: "granted" | "denied" | "undetermined";
  background: "granted" | "denied" | "undetermined";
}> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: fg.status as any,
      background: bg.status as any,
    };
  } catch {
    return { foreground: "undetermined", background: "undetermined" };
  }
}

async function startBackgroundUpdates(): Promise<void> {
  if (isBackgroundRegistered) return;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 25,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Dastbadast Курьер",
        notificationBody: "Отслеживание доставки активно",
        notificationColor: "#F26A4A",
      },
      pausesUpdatesAutomatically: false,
    });
    isBackgroundRegistered = true;
    console.log("[GPS] background tracking started");
  } catch (e) {
    console.warn("[GPS] failed to start background:", e);
  }
}

async function sendOnce(): Promise<void> {
  if (!client) return;
  const token = (globalThis as any).__DBD_RIDER_TOKEN__;
  if (!token) return;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (!client) return;
    await sendLocationToServer(
      pos.coords.longitude,
      pos.coords.latitude,
      false,
      (pos as any).mocked ?? null,
    );
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (
      /Not authenticated|UNAUTHENTICATED|401/i.test(msg) ||
      /mutate' of null/i.test(msg)
    ) {
      return;
    }
    console.warn("[GPS] tick failed:", e);
  }
}

/**
 * ⭐⭐⭐ Для кнопки "Моё местоположение": одноразовый запрос текущей
 * позиции устройства, без завязки на серверный broadcast/подписку —
 * так кнопка работает мгновенно, даже если стрим ещё не успел прислать
 * первую точку через сервер.
 */
export async function getCurrentDeviceLocation(): Promise<{
  lat: number;
  lng: number;
} | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== "granted") return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
