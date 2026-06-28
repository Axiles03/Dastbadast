import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Источники URL API (по приоритету):
 *   1) AsyncStorage override (пользователь ввёл вручную)
 *   2) EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WS_URL
 *   3) IP из Metro / Expo Go
 *   4) 10.0.2.2 для Android-эмулятора / localhost для iOS
 */

const API_URL_KEY = "dbd_client_api_url";
const WS_URL_KEY = "dbd_client_ws_url";

let _resolvedHttp: string | null = null;
let _resolvedWs: string | null = null;
let _resolvedSource: "override" | "env" | "metro" | "default" | null = null;

function hostFromMetro(): string | null {
  try {
    const fromExpoGo = (Constants as any).expoGoConfig?.debuggerHost;
    const fromExpo = (Constants as any).expoConfig?.hostUri;
    const fromManifest = (Constants as any).manifest?.debuggerHost;
    const raw: string | undefined = fromExpoGo ?? fromExpo ?? fromManifest;
    if (!raw) return null;
    const host = raw.split(":")[0];
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;
    return null;
  } catch {
    return null;
  }
}

function normalizeUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function httpToWs(http: string): string {
  return http.replace(/^http/i, "ws");
}

function detectDefaultBaseUrl(): {
  url: string;
  source: "env" | "metro" | "default";
} {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (env && /^https?:\/\//i.test(env)) {
    return { url: env.replace(/\/$/, ""), source: "env" };
  }
  const host = hostFromMetro();
  if (host) {
    return { url: `http://${host}:8001`, source: "metro" };
  }
  if (Platform.OS === "android") {
    return { url: "http://10.0.2.2:8001", source: "default" };
  }
  return { url: "http://localhost:8001", source: "default" };
}

export type ApiConfig = {
  http: string;
  ws: string;
  graphqlHttp: string;
  graphqlWs: string;
  source: "override" | "env" | "metro" | "default";
};

export async function initApiConfig(): Promise<ApiConfig> {
  const override = await AsyncStorage.getItem(API_URL_KEY);
  if (override) {
    const normalized = normalizeUrl(override);
    if (normalized) {
      _resolvedHttp = normalized;
      _resolvedWs = httpToWs(normalized);
      _resolvedSource = "override";
    }
  }

  if (!_resolvedHttp) {
    const def = detectDefaultBaseUrl();
    _resolvedHttp = def.url;
    _resolvedSource = def.source;

    const wsEnv = process.env.EXPO_PUBLIC_WS_URL?.trim();
    _resolvedWs =
      wsEnv && /^wss?:\/\//i.test(wsEnv)
        ? wsEnv.replace(/\/$/, "")
        : httpToWs(def.url);
  }

  return {
    http: _resolvedHttp!,
    ws: _resolvedWs!,
    graphqlHttp: `${_resolvedHttp}/graphql`,
    graphqlWs: `${_resolvedWs}/graphql`,
    source: _resolvedSource!,
  };
}

export function getApiBaseUrl(): string {
  return _resolvedHttp || "http://localhost:8001";
}
export function getWsBaseUrl(): string {
  return _resolvedWs || "ws://localhost:8001";
}

export const GRAPHQL_HTTP = `${getApiBaseUrl()}/graphql`;
export const GRAPHQL_WS = `${getWsBaseUrl()}/graphql`;

export async function setApiUrlOverride(
  url: string,
): Promise<{ http: string; ws: string }> {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error("URL должен начинаться с http:// или https://");
  }
  await AsyncStorage.setItem(API_URL_KEY, normalized);
  const ws = httpToWs(normalized);
  await AsyncStorage.setItem(WS_URL_KEY, ws);
  _resolvedHttp = normalized;
  _resolvedWs = ws;
  _resolvedSource = "override";
  return { http: normalized, ws };
}

export async function clearApiUrlOverride(): Promise<void> {
  await AsyncStorage.multiRemove([API_URL_KEY, WS_URL_KEY]);
  _resolvedHttp = null;
  _resolvedWs = null;
  _resolvedSource = null;
  await initApiConfig();
}

export function getCurrentSource(): ApiConfig["source"] {
  return _resolvedSource || "default";
}

export async function testConnection(
  httpUrl?: string,
): Promise<{ ok: boolean; status?: number; error?: string; ms: number }> {
  const base = (httpUrl || getApiBaseUrl()).replace(/\/$/, "");
  const url = `${base}/health`;
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    const ms = Date.now() - start;
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}`, ms };
    }
    return { ok: true, status: res.status, ms };
  } catch (e: any) {
    const ms = Date.now() - start;
    const msg = e?.message ?? String(e);
    if (/abort/i.test(msg)) {
      return { ok: false, error: "Таймаут 5с — API не отвечает", ms };
    }
    if (/Network request failed/i.test(msg)) {
      return {
        ok: false,
        error: "Нет сетевого доступа (проверьте Wi-Fi и URL)",
        ms,
      };
    }
    return { ok: false, error: msg, ms };
  }
}
