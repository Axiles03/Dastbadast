// dastbadast-multivendor-client/components/auth/RegisterForm.tsx
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useMutation } from "@apollo/client/react";
import { REQUEST_OTP, REGISTER_WITH_PHONE } from "@/lib/api/queries";

const PHONE_REGEX = /^\+992\d{9}$/;
const RESEND_COOLDOWN = 60;

type Step = "phone" | "code";

export default function RegisterForm({
  onSuccess,
}: {
  onSuccess: (payload: { token: string; user: any }) => void;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+992");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [doRequestOtp, { loading: lOtp }] = useMutation<any>(REQUEST_OTP);
  const [doRegister, { loading: lReg }] = useMutation<any>(REGISTER_WITH_PHONE);
  const loading = lOtp || lReg;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  function friendlyError(e: any) {
    return e?.message || "Не удалось выполнить запрос";
  }

  async function requestCode() {
    setError(null);
    if (!PHONE_REGEX.test(phone)) {
      setError(
        "Телефон должен быть в формате +992 и ровно 9 цифр, например +992901234567",
      );
      return;
    }
    try {
      await doRequestOtp({ variables: { phone, purpose: "REGISTER" } });
      setStep("code");
      startCooldown();
    } catch (e: any) {
      setError(friendlyError(e));
    }
  }

  async function submitCode() {
    setError(null);
    if (!code) {
      setError("Введите код из SMS");
      return;
    }
    try {
      const res = await doRegister({ variables: { phone, code } });
      const payload = res.data?.registerWithPhone;
      if (payload) onSuccess(payload);
    } catch (e: any) {
      setError(friendlyError(e));
    }
  }

  return (
    <View className="gap-3.5">
      {step === "phone" && (
        <>
          <TextInput
            className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-base"
            placeholder="+992901234567"
            placeholderTextColor="#9A9388"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))}
          />
          {error && <ErrorBox text={error} />}
          <SubmitButton
            loading={loading}
            onPress={requestCode}
            label="Получить код"
          />
        </>
      )}

      {step === "code" && (
        <>
          <Text className="text-text-soft text-sm">
            Код отправлен на {phone}
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
          {error && <ErrorBox text={error} />}
          <SubmitButton
            loading={loading}
            onPress={submitCode}
            label="Создать аккаунт"
          />
          <View className="flex-row justify-between items-center mt-1">
            <Pressable onPress={() => setStep("phone")}>
              <Text className="text-text-soft text-sm">← Изменить номер</Text>
            </Pressable>
            <Pressable onPress={requestCode} disabled={cooldown > 0 || loading}>
              <Text
                className={`text-sm ${
                  cooldown > 0 || loading ? "text-text-muted" : "text-text-soft"
                }`}
              >
                {cooldown > 0
                  ? `Повторить через ${cooldown}с`
                  : "Отправить код ещё раз"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
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
