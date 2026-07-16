// dastbadast-multivendor-client/app/(app)/security.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useMutation, useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import {
  GET_PROFILE_FULL,
  SET_PASSWORD,
  REQUEST_OTP,
  RESET_PASSWORD_WITH_OTP,
} from "../../lib/api/queries";

type Mode = "idle" | "form" | "forgotRequest" | "forgotVerify";

export default function SecurityScreen() {
  const router = useRouter();
  const { setAuth, user } = useAuth();
  const { data } = useQuery<any>(GET_PROFILE_FULL, {
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;
  const hasPassword = !!profile?.hasPassword;
  const phone = profile?.phone;

  const [mode, setMode] = useState<Mode>("idle");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [setPasswordMutation, { loading: saving }] = useMutation<any>(
    SET_PASSWORD,
    { refetchQueries: [{ query: GET_PROFILE_FULL }] },
  );
  const [requestOtpMutation, { loading: sendingOtp }] =
    useMutation<any>(REQUEST_OTP);
  const [resetPasswordWithOtp, { loading: resetting }] = useMutation<any>(
    RESET_PASSWORD_WITH_OTP,
  );

  function resetFields() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setError(null);
  }
  function closeAll() {
    setMode("idle");
    resetFields();
  }

  async function submitDirect() {
    setError(null);
    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (hasPassword && !oldPassword) {
      setError("Введите текущий пароль");
      return;
    }
    try {
      await setPasswordMutation({
        variables: {
          input: hasPassword ? { oldPassword, newPassword } : { newPassword },
        },
      });
      setSuccess(hasPassword ? "Пароль изменён" : "Пароль установлен");
      closeAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить пароль");
    }
  }

  async function sendForgotOtp() {
    setError(null);
    if (!phone) {
      setError("У аккаунта не указан телефон");
      return;
    }
    try {
      await requestOtpMutation({ variables: { phone, purpose: "RESET" } });
      setMode("forgotVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }

  async function submitForgotOtp() {
    setError(null);
    if (!otpCode) {
      setError("Введите код из SMS");
      return;
    }
    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    try {
      const res = await resetPasswordWithOtp({
        variables: { input: { phone, code: otpCode, newPassword } },
      });
      const payload = res.data?.resetPasswordWithOtp;
      if (payload?.token && payload?.user) {
        await setAuth(payload.token, payload.user);
      }
      setSuccess("Пароль сброшен");
      closeAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сбросить пароль");
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-soft-bg"
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center gap-1.5"
      >
        <Ionicons name="chevron-back" size={16} color="#9A9388" />
        <Text className="text-xs font-bold text-text-muted">
          Назад в профиль
        </Text>
      </Pressable>

      <View>
        <Text className="text-2xl font-extrabold text-text tracking-tight">
          Безопасность
        </Text>
        <Text className="text-sm text-text-muted mt-1">
          Пароль и способы входа в аккаунт
        </Text>
      </View>

      <View className="bg-soft-surface border border-border rounded-3xl p-5">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-extrabold text-text flex-row items-center">
            Пароль
          </Text>
          {mode === "idle" && (
            <Pressable onPress={() => setMode("form")}>
              <Text className="text-sm font-bold text-accent">
                {hasPassword ? "Изменить" : "Задать пароль"}
              </Text>
            </Pressable>
          )}
        </View>

        <Text className="text-xs text-text-muted mb-1">
          {hasPassword
            ? "Пароль задан — можно входить по номеру телефона и паролю."
            : "Пароль не задан. Вход пока доступен только по коду из SMS."}
        </Text>

        {success && (
          <Text className="text-xs font-semibold text-green-600 mt-2">
            {success}
          </Text>
        )}
        {error && mode !== "idle" && (
          <Text className="text-xs font-semibold text-red-dark mt-2">
            {error}
          </Text>
        )}

        {mode === "form" && (
          <View className="gap-2.5 mt-3">
            {hasPassword && (
              <TextInput
                secureTextEntry
                placeholder="Текущий пароль"
                placeholderTextColor="#9A9388"
                value={oldPassword}
                onChangeText={setOldPassword}
                className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
              />
            )}
            <TextInput
              secureTextEntry
              placeholder="Новый пароль (минимум 6 символов)"
              placeholderTextColor="#9A9388"
              value={newPassword}
              onChangeText={setNewPassword}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
            />
            <TextInput
              secureTextEntry
              placeholder="Повторите новый пароль"
              placeholderTextColor="#9A9388"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
            />
            <View className="flex-row gap-2 mt-1">
              <Pressable
                onPress={closeAll}
                className="flex-1 py-3 rounded-2xl border border-border items-center"
              >
                <Text className="text-sm font-bold text-text-soft">Отмена</Text>
              </Pressable>
              <Pressable
                onPress={submitDirect}
                disabled={saving}
                className={`flex-1 py-3 rounded-2xl bg-accent items-center ${saving ? "opacity-50" : ""}`}
              >
                <Text className="text-sm font-extrabold text-text-inverse">
                  {saving ? "Сохраняем…" : "Сохранить"}
                </Text>
              </Pressable>
            </View>

            {hasPassword && (
              <Pressable
                onPress={() => {
                  resetFields();
                  setMode("forgotRequest");
                }}
                className="mt-1"
              >
                <Text className="text-xs font-bold text-text-muted">
                  Забыли текущий пароль? Сбросить по коду из SMS
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {mode === "forgotRequest" && (
          <View className="gap-2.5 mt-3">
            <Text className="text-sm text-text-soft">
              Отправим код подтверждения на {phone}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={closeAll}
                className="flex-1 py-3 rounded-2xl border border-border items-center"
              >
                <Text className="text-sm font-bold text-text-soft">Отмена</Text>
              </Pressable>
              <Pressable
                onPress={sendForgotOtp}
                disabled={sendingOtp}
                className={`flex-1 py-3 rounded-2xl bg-accent items-center ${sendingOtp ? "opacity-50" : ""}`}
              >
                <Text className="text-sm font-extrabold text-text-inverse">
                  {sendingOtp ? "Отправляем…" : "Отправить код"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {mode === "forgotVerify" && (
          <View className="gap-2.5 mt-3">
            <TextInput
              keyboardType="number-pad"
              placeholder="Код из SMS"
              placeholderTextColor="#9A9388"
              value={otpCode}
              onChangeText={(v) => setOtpCode(v.replace(/\D/g, ""))}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
            />
            <TextInput
              secureTextEntry
              placeholder="Новый пароль (минимум 6 символов)"
              placeholderTextColor="#9A9388"
              value={newPassword}
              onChangeText={setNewPassword}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
            />
            <TextInput
              secureTextEntry
              placeholder="Повторите новый пароль"
              placeholderTextColor="#9A9388"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={closeAll}
                className="flex-1 py-3 rounded-2xl border border-border items-center"
              >
                <Text className="text-sm font-bold text-text-soft">Отмена</Text>
              </Pressable>
              <Pressable
                onPress={submitForgotOtp}
                disabled={resetting}
                className={`flex-1 py-3 rounded-2xl bg-accent items-center ${resetting ? "opacity-50" : ""}`}
              >
                <Text className="text-sm font-extrabold text-text-inverse">
                  {resetting ? "Сохраняем…" : "Сбросить пароль"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
