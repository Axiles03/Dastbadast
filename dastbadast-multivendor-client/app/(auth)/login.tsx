import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useMutation } from "@apollo/client/react";
import {
  REQUEST_OTP,
  REGISTER_WITH_PHONE,
  LOGIN_WITH_OTP,
  LOGIN_WITH_PASSWORD,
  RESET_PASSWORD_WITH_OTP,
} from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "expo-router";
import { GRAPHQL_HTTP } from "../../lib/config/api";

const PHONE_REGEX = /^\+992\d{9}$/;
const RESEND_COOLDOWN = 60; // секунд

type Mode = "login" | "register" | "forgot";
type LoginMethod = "password" | "otp";
type Step = "phone" | "code";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("+992");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const { setAuth } = useAuth();
  const router = useRouter();

  const [doRequestOtp, { loading: lOtp }] = useMutation<any>(REQUEST_OTP);
  const [doRegister, { loading: lReg }] = useMutation<any>(REGISTER_WITH_PHONE);
  const [doLoginOtp, { loading: lLoginOtp }] = useMutation<any>(LOGIN_WITH_OTP);
  const [doLoginPass, { loading: lLoginPass }] =
    useMutation<any>(LOGIN_WITH_PASSWORD);
  const [doReset, { loading: lReset }] = useMutation<any>(
    RESET_PASSWORD_WITH_OTP,
  );

  const loading = lOtp || lReg || lLoginOtp || lLoginPass || lReset;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function resetFlow() {
    setStep("phone");
    setCode("");
    setPassword("");
    setNewPassword("");
    setFormError(null);
    setCooldown(0);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setLoginMethod("password");
    resetFlow();
  }

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function purposeForMode(m: Mode): "REGISTER" | "LOGIN" | "RESET" {
    if (m === "register") return "REGISTER";
    if (m === "forgot") return "RESET";
    return "LOGIN";
  }

  function validatePhone(): boolean {
    if (!PHONE_REGEX.test(phone)) {
      setFormError(
        "Телефон должен быть в формате +992 и ровно 9 цифр, например +992901234567",
      );
      return false;
    }
    return true;
  }

  async function goHome(payload: { token: string; user: any }) {
    await setAuth(payload.token, payload.user);
    router.replace("/(app)/home" as any);
  }

  async function requestCode() {
    setFormError(null);
    if (!validatePhone()) return;
    try {
      await doRequestOtp({
        variables: { phone, purpose: purposeForMode(mode) },
      });
      setStep("code");
      startCooldown();
    } catch (e: any) {
      setFormError(friendlyError(e));
    }
  }

  async function submitLoginPassword() {
    setFormError(null);
    if (!validatePhone()) return;
    if (password.length < 1) {
      setFormError("Введите пароль");
      return;
    }
    try {
      const res = await doLoginPass({ variables: { phone, password } });
      const payload = res.data?.loginWithPassword;
      if (payload) await goHome(payload);
    } catch (e: any) {
      setFormError(friendlyError(e));
    }
  }

  async function submitCode() {
    setFormError(null);
    if (!code) {
      setFormError("Введите код из SMS");
      return;
    }
    try {
      if (mode === "register") {
        const res = await doRegister({ variables: { phone, code } });
        const payload = res.data?.registerWithPhone;
        if (payload) await goHome(payload);
      } else if (mode === "login") {
        const res = await doLoginOtp({ variables: { phone, code } });
        const payload = res.data?.loginWithOtp;
        if (payload) await goHome(payload);
      } else if (mode === "forgot") {
        if (newPassword.length < 6) {
          setFormError("Пароль должен содержать минимум 6 символов");
          return;
        }
        const res = await doReset({
          variables: { input: { phone, code, newPassword } },
        });
        const payload = res.data?.resetPasswordWithOtp;
        if (payload) await goHome(payload);
      }
    } catch (e: any) {
      setFormError(friendlyError(e, "Неверный код"));
    }
  }

  function friendlyError(e: any, fallback = "Не удалось выполнить запрос") {
    let msg = e?.message ?? fallback;
    if (/NoRouteToHost|Network request failed|fetch failed/i.test(msg)) {
      msg = `Нет соединения с API: ${GRAPHQL_HTTP}`;
    }
    return msg;
  }

  const codeStepTitle =
    mode === "register"
      ? "Подтвердите номер"
      : mode === "forgot"
        ? "Новый пароль"
        : "Код из SMS";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-soft-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="px-6"
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

          {mode !== "forgot" && (
            <View className="flex-row bg-soft-surface-2 border border-border rounded-2xl p-1.5 mb-5">
              <Pressable
                onPress={() => switchMode("login")}
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
                onPress={() => switchMode("register")}
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
          )}

          {mode === "forgot" && (
            <View className="mb-5">
              <Pressable onPress={() => switchMode("login")} className="mb-3">
                <Text className="text-text-soft text-sm">← Назад ко входу</Text>
              </Pressable>
              <Text className="text-lg font-extrabold text-text">
                Восстановление пароля
              </Text>
            </View>
          )}

          <View className="bg-soft-surface border border-border rounded-2xl p-5 shadow-soft-sm">
            {/* ===== ШАГ: телефон ===== */}
            {step === "phone" && (
              <View className="space-y-3.5">
                <TextInput
                  className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base"
                  placeholder="+992901234567"
                  placeholderTextColor="#9A9388"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))}
                />

                {mode === "login" && (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setLoginMethod("password")}
                      className={`flex-1 py-2.5 rounded-xl border items-center ${
                        loginMethod === "password"
                          ? "border-accent"
                          : "border-border"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          loginMethod === "password"
                            ? "text-accent"
                            : "text-text-soft"
                        }`}
                      >
                        По паролю
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setLoginMethod("otp")}
                      className={`flex-1 py-2.5 rounded-xl border items-center ${
                        loginMethod === "otp"
                          ? "border-accent"
                          : "border-border"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          loginMethod === "otp"
                            ? "text-accent"
                            : "text-text-soft"
                        }`}
                      >
                        По коду из SMS
                      </Text>
                    </Pressable>
                  </View>
                )}

                {mode === "login" && loginMethod === "password" ? (
                  <>
                    <TextInput
                      className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base"
                      placeholder="Пароль"
                      placeholderTextColor="#9A9388"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                    {formError && <ErrorBox text={formError} />}
                    <SubmitButton
                      loading={loading}
                      onPress={submitLoginPassword}
                      label="Войти"
                    />
                    <Pressable
                      onPress={() => switchMode("forgot")}
                      className="items-center mt-1"
                    >
                      <Text className="text-text-soft text-sm">
                        Забыли пароль?
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {formError && <ErrorBox text={formError} />}
                    <SubmitButton
                      loading={loading}
                      onPress={requestCode}
                      label="Получить код"
                    />
                  </>
                )}

                {mode === "register" && (
                  <>
                    {formError && <ErrorBox text={formError} />}
                    <SubmitButton
                      loading={loading}
                      onPress={requestCode}
                      label="Получить код"
                    />
                  </>
                )}
              </View>
            )}

            {/* ===== ШАГ: код ===== */}
            {step === "code" && (
              <View className="space-y-3.5">
                <Text className="text-text-soft text-sm">
                  {codeStepTitle} — код отправлен на {phone}
                </Text>
                <TextInput
                  className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base"
                  placeholder="Код из SMS"
                  placeholderTextColor="#9A9388"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                />
                {mode === "forgot" && (
                  <TextInput
                    className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base"
                    placeholder="Новый пароль"
                    placeholderTextColor="#9A9388"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                )}
                {formError && <ErrorBox text={formError} />}
                <SubmitButton
                  loading={loading}
                  onPress={submitCode}
                  label={
                    mode === "register"
                      ? "Создать аккаунт"
                      : mode === "forgot"
                        ? "Сохранить пароль"
                        : "Войти"
                  }
                />
                <View className="flex-row justify-between items-center mt-1">
                  <Pressable onPress={() => setStep("phone")}>
                    <Text className="text-text-soft text-sm">
                      ← Изменить номер
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={requestCode}
                    disabled={cooldown > 0 || loading}
                  >
                    <Text
                      className={`text-sm ${
                        cooldown > 0 || loading
                          ? "text-text-muted"
                          : "text-text-soft"
                      }`}
                    >
                      {cooldown > 0
                        ? `Повторить через ${cooldown}с`
                        : "Отправить код ещё раз"}
                    </Text>
                  </Pressable>
                </View>
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

function SubmitButton({
  onPress,
  loading,
  label,
}: {
  onPress: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`h-12 rounded-2xl items-center justify-center bg-accent shadow-soft-sm mt-1 ${
        loading ? "opacity-50" : "active:opacity-85"
      }`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-text-inverse font-extrabold text-base tracking-wide">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <View className="bg-red-soft border border-red/30 rounded-xl px-3 py-2">
      <Text className="text-red-dark text-xs font-semibold">{text}</Text>
    </View>
  );
}
