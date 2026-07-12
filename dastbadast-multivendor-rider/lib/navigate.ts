// dastbadast-multivendor-rider/lib/navigate.ts
//
// ⭐ ШАГ 5: "Открыть в навигаторе" — как в UberEats/Wolt курьер обычно
// едет по внешнему навигатору (со своими живыми пробками, голосовыми
// подсказками и т.п.), а не по карте внутри приложения. Наша карта
// остаётся для общего обзора/статуса, а фактическая навигация уходит
// во внешнее приложение по выбору курьера.
//
// Поддерживаем 3 популярных в регионе навигатора:
//   - Google Maps
//   - Яндекс.Навигатор / Яндекс.Карты
//   - 2ГИС
//
// Для каждого пробуем deep-link схему (открывает сразу нативное
// приложение, если оно установлено), с fallback на универсальную
// web/store-ссылку, если приложение не установлено.

import { Alert, Linking, Platform } from "react-native";

export type NavigatorApp = "google" | "yandex" | "2gis";

type LatLng = { lat: number; lng: number };

function buildUrls(app: NavigatorApp, dest: LatLng, label?: string) {
  const { lat, lng } = dest;
  const encodedLabel = encodeURIComponent(label || "Точка доставки");

  switch (app) {
    case "google":
      return {
        // iOS: если установлен Google Maps app — comgooglemaps:// открывает его
        native:
          Platform.OS === "ios"
            ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
            : `google.navigation:q=${lat},${lng}&mode=d`,
        // Универсальная веб-ссылка — работает везде (браузер или сама
        // Google Maps, если стоит и настроена как handler)
        fallback: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      };
    case "yandex":
      return {
        native: `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
        fallback: `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`,
      };
    case "2gis":
      return {
        native: `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`,
        fallback: `https://2gis.ru/directions/points/|${lng},${lat}`,
      };
  }
}

/**
 * ⭐ Открывает выбранное навигационное приложение с маршрутом до dest.
 * Сначала пробует deep-link на нативное приложение, если не получилось
 * (не установлено / канал не поддерживается) — открывает универсальную
 * web-ссылку в браузере.
 */
export async function openExternalNavigator(
  app: NavigatorApp,
  dest: LatLng,
  label?: string,
): Promise<void> {
  const urls = buildUrls(app, dest, label);
  try {
    const canOpenNative = await Linking.canOpenURL(urls.native);
    if (canOpenNative) {
      await Linking.openURL(urls.native);
      return;
    }
  } catch {
    // canOpenURL может кинуть на некоторых платформах при отсутствии
    // объявленного query scheme в Info.plist/AndroidManifest — тихо
    // уходим на fallback ниже.
  }
  try {
    await Linking.openURL(urls.fallback);
  } catch {
    Alert.alert(
      "Не удалось открыть навигатор",
      "Проверьте, что на устройстве есть браузер или установлено картографическое приложение.",
    );
  }
}

/**
 * ⭐ Показывает выбор навигатора (Google Maps / Яндекс.Навигатор / 2ГИС)
 * и открывает выбранный с маршрутом до dest.
 */
export function promptOpenInNavigator(dest: LatLng, label?: string): void {
  Alert.alert(
    "Открыть в навигаторе",
    label,
    [
      {
        text: "Google Maps",
        onPress: () => openExternalNavigator("google", dest, label),
      },
      {
        text: "Яндекс.Навигатор",
        onPress: () => openExternalNavigator("yandex", dest, label),
      },
      {
        text: "2ГИС",
        onPress: () => openExternalNavigator("2gis", dest, label),
      },
      { text: "Отмена", style: "cancel" },
    ],
    { cancelable: true },
  );
}
