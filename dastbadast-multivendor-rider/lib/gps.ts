import * as Location from "expo-location";
import { ApolloClient } from "@apollo/client";
import { UPDATE_LOCATION } from "./api/queries";

let timer: ReturnType<typeof setInterval> | null = null;
let client: ApolloClient | null = null;

export async function startGpsLoop(c: ApolloClient) {
  
  client = c;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    console.warn("GPS permission denied");
    return;
  }

  if (timer) clearInterval(timer);
  sendOnce();
  timer = setInterval(sendOnce, 10_000);
}

export function stopGpsLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  client = null;
}

async function sendOnce() {
  // FIX: защита от null client
  if (!client) return;

  // FIX: защита от отсутствующего токена
  const token = (globalThis as any).__DBD_RIDER_TOKEN__;
  if (!token) return;

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lng = pos.coords.longitude;
    const lat = pos.coords.latitude;

    // FIX: проверяем client ещё раз после await
    if (!client) return;

    await client.mutate({
      mutation: UPDATE_LOCATION,
      variables: { input: { lng, lat } },
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/Not authenticated|UNAUTHENTICATED|401/i.test(msg)) return;
    if (/mutate' of null/i.test(msg)) return;
    console.warn("GPS tick failed", e);
  }
}
