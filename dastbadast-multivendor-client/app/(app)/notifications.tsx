// // dastbadast-multivendor-client/app/(app)/notifications.tsx
// import { useEffect, useState } from "react";
// import { View, Text, Pressable, ScrollView, Platform } from "react-native";
// import { useMutation } from "@apollo/client/react";
// import { Ionicons } from "@expo/vector-icons";
// import { useRouter } from "expo-router";
// import * as Notifications from "expo-notifications";
// import * as Device from "expo-device";
// import Constants from "expo-constants";
// import {
//   REGISTER_PUSH_TOKEN,
//   UNREGISTER_PUSH_TOKEN,
// } from "../../lib/api/queries";

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//     shouldShowBanner: true,
//     shouldShowList: true,
//   }),
// });

// export default function NotificationsScreen() {
//   const router = useRouter();
//   const [status, setStatus] = useState<
//     "checking" | "unsupported" | "enabled" | "disabled"
//   >("checking");
//   const [expoToken, setExpoToken] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null);

//   const [registerToken] = useMutation<any>(REGISTER_PUSH_TOKEN);
//   const [unregisterToken] = useMutation<any>(UNREGISTER_PUSH_TOKEN);

//   useEffect(() => {
//     (async () => {
//       if (!Device.isDevice) {
//         setStatus("unsupported"); // push не работает в симуляторе iOS/Android
//         return;
//       }
//       const perm = await Notifications.getPermissionsAsync();
//       setStatus(perm.granted ? "enabled" : "disabled");
//     })();
//   }, []);

//   async function enable() {
//     setError(null);
//     setLoading(true);
//     try {
//       const perm = await Notifications.requestPermissionsAsync();
//       if (!perm.granted) {
//         setStatus("disabled");
//         setError("Уведомления не разрешены в настройках устройства");
//         return;
//       }

//       const projectId =
//         Constants.expoConfig?.extra?.eas?.projectId ??
//         Constants.easConfig?.projectId;

//       if (!projectId) {
//         setError(
//           "На проекте не настроен EAS projectId — выполните `eas init`, чтобы получить push-токен",
//         );
//         return;
//       }

//       const tokenResp = await Notifications.getExpoPushTokenAsync({
//         projectId,
//       });
//       setExpoToken(tokenResp.data);

//       await registerToken({
//         variables: {
//           input: {
//             token: tokenResp.data,
//             platform: Platform.OS === "ios" ? "ios" : "android",
//             locale: "ru",
//           },
//         },
//       });

//       if (Platform.OS === "android") {
//         await Notifications.setNotificationChannelAsync("default", {
//           name: "default",
//           importance: Notifications.AndroidImportance.HIGH,
//         });
//       }

//       setStatus("enabled");
//       setSuccess("Уведомления включены");
//       setTimeout(() => setSuccess(null), 3000);
//     } catch (e: any) {
//       setError(e?.message || "Не удалось включить уведомления");
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function disable() {
//     setError(null);
//     setLoading(true);
//     try {
//       if (expoToken) {
//         await unregisterToken({ variables: { token: expoToken } });
//       }
//       setExpoToken(null);
//       setStatus("disabled");
//     } catch (e: any) {
//       setError(e?.message || "Не удалось отключить уведомления");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <ScrollView
//       className="flex-1 bg-soft-bg"
//       contentContainerStyle={{ padding: 20, gap: 16 }}
//     >
//       <Pressable
//         onPress={() => router.back()}
//         className="flex-row items-center gap-1.5"
//       >
//         <Ionicons name="chevron-back" size={16} color="#9A9388" />
//         <Text className="text-xs font-bold text-text-muted">
//           Назад в профиль
//         </Text>
//       </Pressable>

//       <View>
//         <Text className="text-2xl font-extrabold text-text tracking-tight">
//           Уведомления
//         </Text>
//         <Text className="text-sm text-text-muted mt-1">
//           Push-уведомления о статусе заказа
//         </Text>
//       </View>

//       <View className="bg-soft-surface border border-border rounded-3xl p-5 gap-3">
//         {status === "checking" && (
//           <Text className="text-sm text-text-muted">Проверяем…</Text>
//         )}
//         {status === "unsupported" && (
//           <Text className="text-sm text-text-muted">
//             Push-уведомления недоступны в симуляторе — проверьте на реальном
//             устройстве
//           </Text>
//         )}
//         {(status === "enabled" || status === "disabled") && (
//           <View className="flex-row items-center justify-between">
//             <View className="flex-row items-center gap-2">
//               <Ionicons
//                 name={
//                   status === "enabled"
//                     ? "notifications"
//                     : "notifications-off-outline"
//                 }
//                 size={18}
//                 color={status === "enabled" ? "#16A34A" : "#9A9388"}
//               />
//               <Text className="text-sm font-bold text-text">
//                 {status === "enabled"
//                   ? "Уведомления включены"
//                   : "Уведомления выключены"}
//               </Text>
//             </View>
//             <Pressable
//               onPress={status === "enabled" ? disable : enable}
//               disabled={loading}
//               className={`px-5 py-2.5 rounded-2xl ${
//                 status === "enabled" ? "border border-border" : "bg-accent"
//               } ${loading ? "opacity-50" : ""}`}
//             >
//               <Text
//                 className={`text-sm font-extrabold ${
//                   status === "enabled" ? "text-text-soft" : "text-text-inverse"
//                 }`}
//               >
//                 {loading
//                   ? "…"
//                   : status === "enabled"
//                     ? "Выключить"
//                     : "Включить"}
//               </Text>
//             </Pressable>
//           </View>
//         )}

//         {success && (
//           <Text className="text-sm font-semibold text-green-600">
//             {success}
//           </Text>
//         )}
//         {error && (
//           <Text className="text-sm font-semibold text-red-dark">{error}</Text>
//         )}
//       </View>
//     </ScrollView>
//   );
// }
