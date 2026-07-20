// dastbadast-multivendor-store/app/login.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useMutation } from "@apollo/client/react";
import { RESTAURANT_LOGIN } from "../lib/api/graphql/queries";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "expo-router";
import { GRAPHQL_HTTP } from "../lib/config/api";

export default function Login() {
  // ⭐ ФИКС ПЕРЕД ПУБЛИКАЦИЕЙ: раньше сюда были захардкожены демо-логин/пароль
  // ("chayhana1"/"store123"), и они же дублировались подсказкой прямо на
  // экране (см. блок "Демо:" ниже, тоже убран). Для продакшен-сборки,
  // которая пойдёт в Play Store, поля должны быть пустыми — иначе это
  // фактически видимый бэкдор в реальный ресторанный аккаунт.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [doLogin, { loading }] = useMutation(RESTAURANT_LOGIN);
  const { setAuth } = useAuth();
  const router = useRouter();

  const submit = async () => {
    try {
      const res = await doLogin({
        variables: { input: { username, password } },
      });
      const data = res.data as any;
      const { token, restaurant } = data.restaurantLogin;
      await setAuth(token, restaurant);
      router.replace("/(tabs)/new");
    } catch (e: any) {
      let msg = e?.message ?? "Не удалось войти";
      // ⭐ ФИКС: подробности с адресом API и советами по .env — полезны при
      // локальной разработке, но не должны показываться конечным
      // пользователям в опубликованном приложении (мусорная/пугающая
      // техническая информация). Показываем их только в dev-сборке.
      if (
        __DEV__ &&
        /NoRouteToHost|Network request failed|fetch failed/i.test(msg)
      ) {
        msg = `Не удалось подключиться к API.\n\nURL: ${GRAPHQL_HTTP}\n\nПроверьте:\n• API запущен\n• EXPO_PUBLIC_API_URL в .env указывает на IP машины`;
      } else if (
        /NoRouteToHost|Network request failed|fetch failed/i.test(msg)
      ) {
        msg =
          "Не удалось подключиться к серверу. Проверьте интернет-соединение и попробуйте снова.";
      }
      Alert.alert("Ошибка входа", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center px-6 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Логотип */}
      <View className="items-center mb-7">
        <View className="w-16 h-16 rounded-2xl bg-accent items-center justify-center mb-3.5 shadow-soft-sm">
          <Text className="text-text-inverse text-3xl font-black">D</Text>
        </View>
        <Text className="text-3xl font-extrabold text-text tracking-tight">
          Dastbadast
        </Text>
        <Text className="text-sm text-text-muted mt-1">Портал ресторана</Text>
      </View>

      {/* Карточка */}
      <View className="bg-soft-surface border border-border rounded-3xl p-5 shadow-soft-sm">
        <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
          Логин
        </Text>
        <TextInput
          className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-3.5"
          autoCapitalize="none"
          placeholder="username"
          placeholderTextColor="#9A9388"
          value={username}
          onChangeText={setUsername}
        />

        <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
          Пароль
        </Text>
        <TextInput
          className="border border-border rounded-xl px-3.5 py-3 text-base bg-soft-surface-2 text-text placeholder-text-muted mb-4"
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9A9388"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          className={`h-13 rounded-2xl items-center justify-center bg-accent shadow-soft-sm ${
            loading ? "opacity-40" : "active:opacity-85"
          }`}
          style={{ height: 52 }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-text-inverse font-extrabold text-lg tracking-wide">
              Войти в систему
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ⭐ ФИКС: адрес API на экране логина — полезно для отладки, но не
          для публичной сборки (лишняя техническая информация для
          пользователя, плюс раскрывает инфраструктуру). Показываем только
          в dev. */}
      {__DEV__ && (
        <Text className="text-2xs text-text-muted mt-4 text-center font-mono tracking-wider">
          {GRAPHQL_HTTP}
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}
