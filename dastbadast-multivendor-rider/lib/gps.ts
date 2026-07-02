// dastbadast-multivendor-rider/lib/gps.ts
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { ApolloClient, FetchResult, gql } from "@apollo/client";

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($input: RiderLocationInput!) {
    updateRiderLocation(input: $input) {
      id
      location
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

  try {
    await client.mutate({
      mutation: UPDATE_LOCATION,
      variables: { input: { lng, lat } },
    });
    if (__DEV__) {
      console.log(`[GPS${isBackground ? "-BG" : ""}] sent`, {
        lng: lng.toFixed(5),
        lat: lat.toFixed(5),
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
 * ⭐⭐⭐ Запуск трекинга: foreground + background.
 * Foreground: каждые 10 сек, пока приложение активно.
 * Background: через expo-task-manager, настраивается через startLocationUpdatesAsync.
 */
export async function startGpsLoop(c: ApolloClient): Promise<void> {
  client = c;

  // 1) Запрос foreground-разрешения
  const { status: fgStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    console.warn("[GPS] foreground permission denied");
    return;
  }

  // 2) Foreground polling — каждую 10 сек
  if (foregroundTimer) clearInterval(foregroundTimer);
  await sendOnce();
  foregroundTimer = setInterval(sendOnce, 10_000);

  // 3) Background tracking — запрашиваем разрешение и запускаем
  try {
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus === "granted") {
      await startBackgroundUpdates();
    } else {
      console.warn("[GPS] background permission not granted, foreground only");
    }
  } catch (e) {
    console.warn("[GPS] background tracking init failed:", e);
  }
}

async function startBackgroundUpdates(): Promise<void> {
  if (isBackgroundRegistered) return;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000, // каждые 10 сек
      distanceInterval: 25, // или при смещении на 25 м
      showsBackgroundLocationIndicator: true, // iOS: синяя полоска
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
  // Сигнализируем серверу, что стрим завершён
  if (client) {
    try {
      await client.mutate({ mutation: STOP_STREAM });
    } catch {}
  }
  client = null;
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
