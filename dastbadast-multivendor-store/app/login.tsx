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
  const [username, setUsername] = useState("chayhana1");
  const [password, setPassword] = useState("store123");
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
      if (/NoRouteToHost|Network request failed|fetch failed/i.test(msg)) {
        msg = `Не удалось подключиться к API.\n\nURL: ${GRAPHQL_HTTP}\n\nПроверьте:\n• API запущен\n• EXPO_PUBLIC_API_URL в .env указывает на IP машины`;
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

        <Text className="text-2xs text-text-muted mt-3 text-center font-medium">
          Демо: <Text className="text-accent font-bold">chayhana1</Text> /{" "}
          <Text className="text-accent font-bold">store123</Text>
        </Text>
      </View>

      <Text className="text-2xs text-text-muted mt-4 text-center font-mono tracking-wider">
        {GRAPHQL_HTTP}
      </Text>
    </KeyboardAvoidingView>
  );
}
  