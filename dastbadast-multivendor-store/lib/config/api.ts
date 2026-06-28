import Constants from "expo-constants";
import { Platform } from "react-native";

function hostFromMetro(): string | null {
  const raw =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri;
  if (!raw) return null;
  return raw.split(":")[0];
}

export function getApiBaseUrl(): string {
  const metroHost = hostFromMetro();
  if (metroHost) return `http://${metroHost}:8001`;

  const env = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (env) return env;

  if (Platform.OS === "android") return "http://10.0.2.2:8001";
  return "http://localhost:8001";
}

export function getWsBaseUrl(httpBase: string): string {
  const env = process.env.EXPO_PUBLIC_WS_URL?.replace(/\/$/, "");
  if (env) return env;
  return httpBase.replace(/^http/, "ws");
}

const API_BASE = getApiBaseUrl();
const WS_BASE = getWsBaseUrl(API_BASE);

export const API_URL = API_BASE;
export const WS_URL = WS_BASE;
export const GRAPHQL_HTTP = `${API_BASE}/graphql`;
export const GRAPHQL_WS = `${WS_BASE}/graphql`;
