// dastbadast-multivendor-rider/lib/gps.ts
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
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

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[BG-GPS] task error:", error.message);
    return;
  }
  if (!data || !client) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;
  const loc = locations[locations.length - 1];
  await sendLocationToServer(loc.coords.longitude, loc.coords.latitude, true);
});

async function sendLocationToServer(
  lng: number,
  lat: number,
  isBackground = false,
): Promise<void> {
  if (!client) return;
  const token = (globalThis as any).__DBD_RIDER_TOKEN__;
  if (!token) return;

  let bearing: number | null = null;
  if (lastBearing) {
    bearing = computeBearing(lastBearing.lat, lastBearing.lng, lat, lng);
  }
  lastBearing = { lat, lng, bearing: bearing ?? 0 };

  try {
    await client.mutate({
      mutation: UPDATE_LOCATION,
      variables: { input: { lng, lat, bearing } },
    });
    if (__DEV__) {
      console.log(`[GPS${isBackground ? "-BG" : ""}] sent`, {
        lng: lng.toFixed(5),
        lat: lat.toFixed(5),
        bearing: bearing?.toFixed(0) ?? "—",
      });
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (
      /Not authenticated|UNAUTHENTICATED|401/i.test(msg) ||
      /mutate' of null/i.test(msg)
    ) {
      return;
    }
    console.warn("[GPS] send failed:", msg);
  }
}

/**
 * ⭐⭐⭐ ШАГ 2: возвращаем структурированный результат, чтобы orders.tsx
 * мог показать Alert при permission denied.
 */
export type GpsStartResult =
  | { ok: true }
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

  try {
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus === "granted") {
      await startBackgroundUpdates();
    } else {
      console.warn(
        "[GPS] background permission not granted (iOS still works in foreground)",
      );
    }
  } catch (e) {
    console.warn("[GPS] background tracking init failed:", e);
  }

  return { ok: true };
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
