import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useMutation } from "@apollo/client/react";
import { LOGIN, CREATE_USER } from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "expo-router";
import { GRAPHQL_HTTP } from "../../lib/config/api";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function isValidPhone(s: string) {
  const clean = s.replace(/[\s\-()]/g, "");
  return /^\+?\d{9,15}$/.test(clean);
}
function isValidPassword(s: string) {
  return typeof s === "string" && s.length >= 6;
}

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");

  // ⭐ useMutation<any>
  const [doLogin, { loading: lLogin, error: eLogin }] = useMutation<any>(LOGIN);
  const [doRegister, { loading: lReg, error: eReg }] =
    useMutation<any>(CREATE_USER);
  const { setAuth } = useAuth();
  const router = useRouter();

  const loading = lLogin || lReg;
  const err = eLogin || eReg;

  const isEmail = useMemo(() => contact.includes("@"), [contact]);

  const clientErrors = useMemo<string[]>(() => {
    const out: string[] = [];
    const c = contact.trim();
    if (!c) out.push("Укажите email или телефон");
    else if (isEmail && !isValidEmail(c)) out.push("Неверный формат email");
    else if (!isEmail && !isValidPhone(c))
      out.push("Телефон должен содержать 9–15 цифр (можно с +)");

    if (!isValidPassword(password))
      out.push("Пароль должен быть не короче 6 символов");

    if (mode === "register" && name.trim().length < 2)
      out.push("Имя должно содержать минимум 2 символа");

    return out;
  }, [contact, password, name, mode, isEmail]);

  const canSubmit = clientErrors.length === 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const c = contact.trim();
      const baseInput: any = { password };
      if (isEmail) baseInput.email = c.toLowerCase();
      else baseInput.phone = c;

      const variables =
        mode === "login"
          ? { input: baseInput }
          : { input: { name: name.trim(), ...baseInput } };

      const res =
        mode === "login"
          ? await doLogin({ variables })
          : await doRegister({ variables });

      const payload = (res.data as any)?.login ?? (res.data as any)?.createUser;
      if (payload?.token && payload?.user) {
        await setAuth(payload.token, payload.user);
        router.replace("/(app)/home" as any);
      }
    } catch (e: any) {
      let msg = e?.message ?? "Не удалось выполнить запрос";
      if (/NoRouteToHost|Network request failed|fetch failed/i.test(msg)) {
        msg = `Нет соединения с API: ${GRAPHQL_HTTP}`;
      }
      console.warn("Auth error:", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center p-6 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-md self-center">
          <View className="items-center mb-7">
            <View className="w-16 h-16 rounded-2xl bg-accent items-center justify-center mb-3.5">
              <Text className="text-text-inverse text-3xl font-black">D</Text>
            </View>
            <Text className="text-3xl font-extrabold text-text tracking-tight">
              Dastbadast
            </Text>
            <Text className="text-sm text-text-muted mt-1">
              Клиентское приложение
            </Text>
          </View>

          <View className="flex-row bg-soft-surface-2 border border-border rounded-2xl p-1.5 mb-5">
            <Pressable
              onPress={() => setMode("login")}
              className={`flex-1 py-3 rounded-xl items-center ${
                mode === "login" ? "bg-soft-surface shadow-soft-sm" : ""
              }`}
            >
              <Text
                className={`text-sm font-extrabold ${
                  mode === "login" ? "text-accent" : "text-text-soft"
                }`}
              >
                Вход
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("register")}
              className={`flex-1 py-3 rounded-xl items-center ${
                mode === "register" ? "bg-soft-surface shadow-soft-sm" : ""
              }`}
            >
              <Text
                className={`text-sm font-extrabold ${
                  mode === "register" ? "text-accent" : "text-text-soft"
                }`}
              >
                Регистрация
              </Text>
            </Pressable>
          </View>

          <View className="bg-soft-surface border border-border rounded-2xl p-5 shadow-soft-sm">
            {mode === "register" && (
              <>
                <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
                  Имя
                </Text>
                <TextInput
                  className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base mb-3.5"
                  placeholder="Ваше имя"
                  placeholderTextColor="#9A9388"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </>
            )}

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Email или телефон
            </Text>
            <TextInput
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base mb-3.5"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isEmail ? "email-address" : "email-address"}
              placeholder="email@example.com"
              placeholderTextColor="#9A9388"
              value={contact}
              onChangeText={setContact}
            />

            <Text className="text-xs text-text-muted font-bold mb-1.5 uppercase tracking-wider">
              Пароль
            </Text>
            <TextInput
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base mb-4"
              secureTextEntry
              placeholder="Минимум 6 символов"
              placeholderTextColor="#9A9388"
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              className={`h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm ${
                !canSubmit ? "opacity-50" : "active:opacity-85"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-text-inverse font-extrabold text-base tracking-wide">
                  {mode === "login" ? "Войти" : "Создать аккаунт"}
                </Text>
              )}
            </TouchableOpacity>

            {clientErrors.length > 0 && (
              <View className="mt-3 bg-soft-surface-2 border border-border rounded-xl px-3 py-2">
                {clientErrors.map((m, i) => (
                  <Text key={i} className="text-xs text-text-soft">
                    • {m}
                  </Text>
                ))}
              </View>
            )}

            {err && (
              <View className="mt-3 bg-red-soft border border-red/30 rounded-xl px-3 py-2">
                <Text className="text-red-dark text-xs font-semibold">
                  {err.message}
                </Text>
              </View>
            )}
          </View>

          <Text className="text-2xs text-text-muted mt-4 text-center font-mono">
            {GRAPHQL_HTTP}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
