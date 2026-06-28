import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useMutation } from "@apollo/client/react";
import { RIDER_LOGIN } from "../../lib/api/queries";
import {
  GRAPHQL_HTTP,
  initApiConfig,
  setApiUrlOverride,
  clearApiUrlOverride,
  testConnection,
  getCurrentSource,
  type ApiConfig,
} from "../../lib/config/api";
import { resetApolloClient } from "../../lib/apollo-provider";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "expo-router";

const LOGIN_PRESETS = [
  { label: "По умолчанию (Metro)", value: "" },
  { label: "Android-эмулятор", value: "http://10.0.2.2:8001" },
  { label: "iOS симулятор", value: "http://localhost:8001" },
];

export default function Login() {
  const [username, setUsername] = useState("courier1");
  const [password, setPassword] = useState("rider123");
  const [doLogin, { loading }] = useMutation(RIDER_LOGIN);
  const { setAuth } = useAuth();
  const router = useRouter();

  // Конфиг API + кнопка "Изменить"
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
    ms?: number;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Поле ввода URL в модалке
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => {
    initApiConfig().then(setConfig);
  }, []);

  const submit = async () => {
    try {
      const res = await doLogin({
        variables: { input: { username, password } },
      });
      const data = res.data as any;
      const { token, rider } = data.riderLogin;
      if (!token || !rider) throw new Error("Неверный ответ сервера");
      await setAuth(token, rider);
      router.replace("/orders");
    } catch (e: any) {
      let msg = e?.message ?? "Не удалось войти";
      if (/NoRouteToHost|Network request failed|fetch failed/i.test(msg)) {
        msg = `Не удалось подключиться к API.\n\nURL: ${GRAPHQL_HTTP}\n\nЧто проверить:\n• API запущен на Mac (порт 8001)\n• Mac и телефон в одной Wi-Fi\n• Если используется Expo Go — нажмите на URL ниже и введите IP Mac вручную`;
      } else if (/timeout/i.test(msg)) {
        msg = "Таймаут соединения. Проверьте URL и сеть.";
      } else if (/invalid|graphql/i.test(msg)) {
        // оставляем как есть
      }
      Alert.alert("Ошибка входа", msg);
    }
  };

  const openUrlModal = () => {
    setUrlInput(config?.http || "");
    setUrlError(null);
    setTestResult(null);
    setShowUrlModal(true);
  };

  const handleTest = async () => {
    if (!urlInput.trim()) {
      setUrlError("Введите URL");
      return;
    }
    if (!/^https?:\/\//i.test(urlInput.trim())) {
      setUrlError("Должен начинаться с http:// или https://");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await testConnection(urlInput.trim());
    setTesting(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        msg: `OK · ${res.status ?? 200}`,
        ms: res.ms,
      });
    } else {
      setTestResult({ ok: false, msg: res.error ?? "Ошибка" });
    }
  };

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) {
      setUrlError("Введите URL");
      return;
    }
    if (!/^https?:\/\//i.test(urlInput.trim())) {
      setUrlError("Должен начинаться с http:// или https://");
      return;
    }
    setSavingUrl(true);
    try {
      await setApiUrlOverride(urlInput.trim());
      resetApolloClient();
      const fresh = await initApiConfig();
      setConfig(fresh);
      setShowUrlModal(false);
      Alert.alert(
        "Готово",
        "URL сохранён. Apollo-клиент пересоздан — попробуйте войти.",
      );
    } catch (e: any) {
      setUrlError(e?.message ?? "Не удалось сохранить");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleResetUrl = async () => {
    setSavingUrl(true);
    try {
      await clearApiUrlOverride();
      resetApolloClient();
      const fresh = await initApiConfig();
      setConfig(fresh);
      setUrlInput(fresh.http);
      setUrlError(null);
      setTestResult(null);
    } finally {
      setSavingUrl(false);
    }
  };

  const sourceLabel: Record<ApiConfig["source"], string> = {
    override: "📌 Пользовательский",
    env: "🌐 Переменная окружения",
    metro: "🚇 Metro (Expo Go)",
    default: "🔧 По умолчанию",
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center p-6 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="w-full max-w-md self-center">
        <Text className="text-3xl font-extrabold text-text text-center mb-2 tracking-wide">
          Dastbadast <Text className="text-accent">·</Text> Rider
        </Text>
        <Text className="text-sm text-text-muted text-center mb-6">
          Панель авторизации курьера
        </Text>

        <View className="bg-soft-surface border border-border rounded-2xl p-5 shadow-soft-sm space-y-4">
          <View className="space-y-1">
            <Text className="text-xs font-semibold text-text-muted px-1">
              Логин
            </Text>
            <TextInput
              className="bg-soft-surface-2 border border-border text-text p-3.5 rounded-xl text-base focus:border-accent"
              autoCapitalize="none"
              placeholder="Введите ваш логин"
              placeholderTextColor="#9A9388"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View className="space-y-1">
            <Text className="text-xs font-semibold text-text-muted px-1">
              Пароль
            </Text>
            <TextInput
              className="bg-soft-surface-2 border border-border text-text p-3.5 rounded-xl text-base focus:border-accent"
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#9A9388"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={loading || !config}
            className="bg-accent h-14 rounded-xl items-center justify-center mt-2 active:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-text-inverse font-bold text-lg">
                Войти в систему
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Пресеты */}
        <View className="mt-5 space-y-2">
          <Text className="text-text-muted text-xs text-center font-medium">
            🔑 Демо: <Text className="text-accent font-bold">courier1</Text> /{" "}
            <Text className="text-accent font-bold">rider123</Text>
          </Text>

          {/* Блок URL — кликабельный */}
          <Pressable
            onPress={openUrlModal}
            className="bg-soft-surface border border-border py-2.5 px-3 rounded-xl active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 min-w-0">
                <Text className="text-text-muted text-[10px] uppercase font-bold tracking-wider">
                  API · {sourceLabel[config?.source || "default"]}
                </Text>
                <Text
                  className="text-accent text-xs font-mono mt-0.5"
                  numberOfLines={1}
                >
                  {config?.graphqlHttp || GRAPHQL_HTTP}
                </Text>
              </View>
              <Text className="text-accent text-xs font-bold ml-2">
                Изменить ✎
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Модалка настройки URL */}
      <Modal
        visible={showUrlModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable
            className="flex-1"
            onPress={() => setShowUrlModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="bg-soft-surface rounded-t-3xl p-5 pb-8">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text font-extrabold text-lg">
                  🌐 Настройки API
                </Text>
                <Pressable
                  onPress={() => setShowUrlModal(false)}
                  className="w-9 h-9 rounded-xl bg-soft-surface-2 items-center justify-center"
                >
                  <Text className="text-text-muted text-lg">×</Text>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                <Text className="text-text-muted text-xs font-bold mb-2 uppercase tracking-wider">
                  Быстрый выбор
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {LOGIN_PRESETS.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => setUrlInput(p.value)}
                      className={`px-3 py-2 rounded-xl border ${
                        urlInput === p.value
                          ? "bg-accent border-accent"
                          : "bg-soft-surface-2 border-border"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          urlInput === p.value
                            ? "text-text-inverse"
                            : "text-text-muted"
                        }`}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-text-muted text-xs font-bold mb-2 uppercase tracking-wider">
                  URL GraphQL API
                </Text>
                <TextInput
                  className="bg-soft-surface-2 border border-border text-text p-3.5 rounded-xl text-sm font-mono"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.0.108:8001"
                  placeholderTextColor="#9A9388"
                  value={urlInput}
                  onChangeText={(t) => {
                    setUrlInput(t);
                    setUrlError(null);
                    setTestResult(null);
                  }}
                />
                <Text className="text-text-muted text-[10px] mt-1.5">
                  💡 Узнайте IP Mac: Системные настройки → Сеть → IP-адрес
                </Text>

                {urlError && (
                  <View className="mt-3 bg-red-soft border border-red/30 rounded-xl px-3 py-2">
                    <Text className="text-red-dark text-xs font-semibold">
                      {urlError}
                    </Text>
                  </View>
                )}

                {testResult && (
                  <View
                    className={`mt-3 border rounded-xl px-3 py-2 ${
                      testResult.ok
                        ? "bg-success-soft border-success/30"
                        : "bg-red-soft border-red/30"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        testResult.ok ? "text-success-dark" : "text-red-dark"
                      }`}
                    >
                      {testResult.ok ? "✅ " : "❌ "}
                      {testResult.msg}
                      {testResult.ms !== undefined && ` · ${testResult.ms}мс`}
                    </Text>
                  </View>
                )}

                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={handleTest}
                    disabled={testing || !urlInput.trim()}
                    className="flex-1 bg-soft-surface-2 border border-info h-12 rounded-xl items-center justify-center active:opacity-80 disabled:opacity-40"
                  >
                    {testing ? (
                      <ActivityIndicator color="#2D9CDB" size="small" />
                    ) : (
                      <Text className="text-info font-bold text-sm">
                        🔌 Проверить
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handleSaveUrl}
                    disabled={savingUrl}
                    className="flex-1 bg-accent h-12 rounded-xl items-center justify-center active:opacity-80 disabled:opacity-40"
                  >
                    {savingUrl ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="text-text-inverse font-bold text-sm">
                        💾 Сохранить
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleResetUrl}
                  disabled={savingUrl}
                  className="mt-3 items-center py-2"
                >
                  <Text className="text-text-muted text-xs underline">
                    Сбросить на автоматическое определение
                  </Text>
                </Pressable>

                <View className="mt-4 bg-soft-surface-2 border border-border rounded-xl p-3">
                  <Text className="text-text-muted text-[11px] font-bold mb-1.5">
                    Диагностика
                  </Text>
                  <Text className="text-text-muted text-[11px] leading-4">
                    • Убедитесь, что API запущен на Mac:{" "}
                    <Text className="text-text font-mono">npm run dev</Text> в
                    папке API
                  </Text>
                  <Text className="text-text-muted text-[11px] leading-4 mt-1">
                    • API должен слушать 0.0.0.0:8001, а не 127.0.0.1
                  </Text>
                  <Text className="text-text-muted text-[11px] leading-4 mt-1">
                    • Mac и iPhone в одной Wi-Fi сети
                  </Text>
                  <Text className="text-text-muted text-[11px] leading-4 mt-1">
                    • Брандмауэр macOS разрешает входящие на 8001
                  </Text>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
