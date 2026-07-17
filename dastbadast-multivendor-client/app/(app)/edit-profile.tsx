// dastbadast-multivendor-client/app/(app)/edit-profile.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useMutation, useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth-context";
import {
  GET_PROFILE_FULL,
  UPDATE_NAME,
  UPDATE_AVATAR,
  REQUEST_EMAIL_VERIFICATION,
  VERIFY_EMAIL,
  REQUEST_EMAIL_CHANGE,
  CONFIRM_EMAIL_CHANGE,
  CANCEL_EMAIL_CHANGE,
  REQUEST_PHONE_CHANGE,
  CONFIRM_PHONE_CHANGE,
  CANCEL_PHONE_CHANGE,
} from "../../lib/api/queries";

const TJ_PHONE_REGEX = /^\+992\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatRemaining(untilIso?: string | null): string {
  if (!untilIso) return "";
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "";
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin} мин`;
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) {
    const m = totalMin % 60;
    return m === 0 ? `${totalHours} ч` : `${totalHours} ч ${m} мин`;
  }
  const days = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h === 0 ? `${days} дн` : `${days} дн ${h} ч`;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data } = useQuery<any>(GET_PROFILE_FULL, {
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;

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
          Редактировать профиль
        </Text>
        <Text className="text-sm text-text-muted mt-1">
          Имя, email, телефон и аватар
        </Text>
      </View>

      <AvatarSection
        name={profile?.name}
        avatar={profile?.avatar}
        avatarUnlocksAt={profile?.avatarUnlocksAt}
      />
      <NameSection
        name={profile?.name || ""}
        changesLeft={profile?.nameChangesLeft ?? 2}
        unlocksAt={profile?.nameChangeUnlocksAt}
      />
      <EmailSection
        email={profile?.email}
        verified={!!profile?.emailVerifiedAt}
        pendingEmail={profile?.pendingEmail}
      />
      <PhoneSection
        phone={profile?.phone}
        pendingPhone={profile?.pendingPhone}
      />
    </ScrollView>
  );
}

/* ================== АВАТАР ================== */

function AvatarSection({
  name,
  avatar,
  avatarUnlocksAt,
}: {
  name?: string | null;
  avatar?: string | null;
  avatarUnlocksAt?: string | null;
}) {
  const { user, token, setAuth } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateAvatarMutation] = useMutation<any>(UPDATE_AVATAR, {
    refetchQueries: [{ query: GET_PROFILE_FULL }],
  });

  const displayed = preview ?? avatar ?? null;
  const locked = !!avatarUnlocksAt;

  async function pickImage() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Нет доступа к галерее");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return;

    const base64 = asset.base64;
    const mime = asset.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    // ~2МБ лимит как на бэке
    if (base64.length * 0.75 > 2 * 1024 * 1024) {
      setError("Файл слишком большой — максимум 2 МБ");
      return;
    }

    setPreview(dataUrl);
    setSaving(true);
    try {
      await updateAvatarMutation({ variables: { avatar: dataUrl } });
      if (token && user)
        await setAuth(token, { ...(user as any), avatar: dataUrl });
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить аватар");
      setPreview(null);
    } finally {
      setSaving(false);
    }
  }

  async function removeAvatar() {
    setError(null);
    setPreview(null);
    setSaving(true);
    try {
      await updateAvatarMutation({ variables: { avatar: null } });
    } catch (e: any) {
      setError(e?.message || "Не удалось удалить аватар");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-soft-surface border border-border rounded-3xl p-5">
      <Text className="text-sm font-extrabold text-text mb-3">Аватар</Text>
      <View className="flex-row items-center gap-4">
        <View className="w-16 h-16 rounded-full bg-purple items-center justify-center overflow-hidden">
          {displayed ? (
            <ImageFallback uri={displayed} dim={saving} />
          ) : (
            <Text className="text-text-inverse text-xl font-extrabold">
              {(name?.[0] || "Г").toUpperCase()}
            </Text>
          )}
        </View>
        <View className="flex-1 gap-1.5">
          <View className="flex-row gap-2">
            <Pressable
              onPress={pickImage}
              disabled={saving || locked}
              className={`px-3.5 py-2 rounded-xl bg-accent ${saving || locked ? "opacity-40" : ""}`}
            >
              <Text className="text-xs font-bold text-text-inverse">
                Загрузить
              </Text>
            </Pressable>
            {displayed && !saving && (
              <Pressable
                onPress={removeAvatar}
                className="px-3.5 py-2 rounded-xl border border-border"
              >
                <Text className="text-xs font-bold text-text-soft">
                  Удалить
                </Text>
              </Pressable>
            )}
          </View>
          {saving && (
            <Text className="text-2xs text-accent font-semibold">
              Сохраняем аватар…
            </Text>
          )}
          {!saving && locked && (
            <Text className="text-2xs text-text-muted font-semibold">
              Смена аватара — через {formatRemaining(avatarUnlocksAt)}
            </Text>
          )}
          {!saving && !locked && (
            <Text className="text-2xs text-text-muted">
              JPG/PNG, до 2 МБ. Раз в 14 дней.
            </Text>
          )}
        </View>
      </View>
      {error && (
        <Text className="text-xs font-semibold text-red-dark mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}

function ImageFallback({ uri, dim }: { uri: string; dim: boolean }) {
  const { Image } = require("expo-image");
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%", opacity: dim ? 0.5 : 1 }}
      contentFit="cover"
    />
  );
}

/* ================== ИМЯ ================== */

function NameSection({
  name,
  changesLeft,
  unlocksAt,
}: {
  name: string;
  changesLeft: number;
  unlocksAt?: string | null;
}) {
  const { token, user, setAuth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  const [updateName, { loading: saving }] = useMutation<any>(UPDATE_NAME, {
    refetchQueries: [{ query: GET_PROFILE_FULL }],
    awaitRefetchQueries: true,
  });

  const locked = changesLeft <= 0 && !!unlocksAt;

  async function save() {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Имя не может быть пустым");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    try {
      await updateName({ variables: { input: { name: trimmed } } });
      if (token && user) {
        await setAuth(token, { ...user, name: trimmed });
      }
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить имя");
    }
  }

  return (
    <View className="bg-soft-surface border border-border rounded-3xl p-5">
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-sm font-extrabold text-text">Имя</Text>
        {!editing && !locked && (
          <Pressable onPress={() => setEditing(true)}>
            <Text className="text-sm font-bold text-accent">Изменить</Text>
          </Pressable>
        )}
      </View>

      {!editing ? (
        <View>
          <Text className="text-sm font-semibold text-text">{name || "—"}</Text>
          <Text className="text-xs text-text-muted mt-1">
            {locked
              ? `Лимит смен исчерпан. Доступно снова через ${formatRemaining(unlocksAt)}`
              : `Осталось смен: ${changesLeft} из 2 (окно 14 дней)`}
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Как вас зовут"
            placeholderTextColor="#9A9388"
            className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setEditing(false);
                setValue(name);
                setError(null);
              }}
              className="flex-1 py-3 rounded-2xl border border-border items-center"
            >
              <Text className="text-sm font-bold text-text-soft">Отмена</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving}
              className={`flex-1 py-3 rounded-2xl bg-accent items-center ${saving ? "opacity-50" : ""}`}
            >
              <Text className="text-sm font-extrabold text-text-inverse">
                {saving ? "Сохраняем…" : "Сохранить"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {success && (
        <Text className="text-xs font-semibold text-green-600 mt-2">
          Имя изменено
        </Text>
      )}
      {error && (
        <Text className="text-xs font-semibold text-red-dark mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}

/* ================== EMAIL ================== */

type EmailMode = "idle" | "verifyCurrent" | "changeInput" | "changeVerify";

function EmailSection({
  email,
  verified,
  pendingEmail,
}: {
  email?: string | null;
  verified: boolean;
  pendingEmail?: string | null;
}) {
  const [mode, setMode] = useState<EmailMode>(
    pendingEmail ? "changeVerify" : "idle",
  );
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requestVerification, { loading: sendingVerify }] = useMutation<any>(
    REQUEST_EMAIL_VERIFICATION,
  );
  const [verifyEmailMutation, { loading: verifyingCurrent }] = useMutation<any>(
    VERIFY_EMAIL,
    { refetchQueries: [{ query: GET_PROFILE_FULL }] },
  );
  const [requestChange, { loading: sendingChange }] =
    useMutation<any>(REQUEST_EMAIL_CHANGE);
  const [confirmChange, { loading: confirming }] = useMutation<any>(
    CONFIRM_EMAIL_CHANGE,
    { refetchQueries: [{ query: GET_PROFILE_FULL }] },
  );
  const [cancelChange] = useMutation<any>(CANCEL_EMAIL_CHANGE, {
    refetchQueries: [{ query: GET_PROFILE_FULL }],
  });

  function reset() {
    setMode(pendingEmail ? "changeVerify" : "idle");
    setNewEmail("");
    setCode("");
    setError(null);
  }

  async function verifyCurrentSend() {
    setError(null);
    try {
      await requestVerification();
      setMode("verifyCurrent");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }
  async function verifyCurrentSubmit() {
    setError(null);
    if (!code) {
      setError("Введите код из письма");
      return;
    }
    try {
      await verifyEmailMutation({ variables: { code } });
      setSuccess("Email подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить");
    }
  }
  async function submitNewEmail() {
    setError(null);
    if (!EMAIL_REGEX.test(newEmail.trim())) {
      setError("Некорректный email");
      return;
    }
    try {
      await requestChange({ variables: { newEmail: newEmail.trim() } });
      setMode("changeVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }
  async function submitChangeCode() {
    setError(null);
    if (!code) {
      setError("Введите код из письма");
      return;
    }
    try {
      await confirmChange({ variables: { code } });
      setSuccess("Email изменён и подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить email");
    }
  }
  async function cancel() {
    setError(null);
    try {
      await cancelChange();
      reset();
    } catch (e: any) {
      setError(e?.message || "Не удалось отменить заявку");
    }
  }

  return (
    <View className="bg-soft-surface border border-border rounded-3xl p-5">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-extrabold text-text">Email</Text>
        {mode === "idle" && (
          <Pressable onPress={() => setMode("changeInput")}>
            <Text className="text-sm font-bold text-accent">Изменить</Text>
          </Pressable>
        )}
      </View>

      <Text className="text-sm font-semibold text-text">
        {email || "Не указан"}
      </Text>

      {email &&
        mode === "idle" &&
        (verified ? (
          <Text className="text-xs font-semibold text-green-600 mt-1">
            Подтверждён
          </Text>
        ) : (
          <Pressable
            onPress={verifyCurrentSend}
            disabled={sendingVerify}
            className="mt-1"
          >
            <Text className="text-xs font-bold text-accent">
              {sendingVerify ? "Отправляем…" : "Не подтверждён — отправить код"}
            </Text>
          </Pressable>
        ))}

      {pendingEmail && mode === "changeVerify" && (
        <Text className="text-xs text-text-soft mt-2">
          Ожидает подтверждения: {pendingEmail}
        </Text>
      )}

      {mode === "verifyCurrent" && (
        <View className="flex-row items-center gap-2 mt-3">
          <TextInput
            keyboardType="number-pad"
            placeholder="Код из письма"
            placeholderTextColor="#9A9388"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
            className="bg-soft-surface-2 border border-border text-text rounded-xl px-3 py-2.5 text-sm w-28"
          />
          <Pressable
            onPress={verifyCurrentSubmit}
            disabled={verifyingCurrent}
            className="px-4 py-2.5 rounded-xl bg-accent"
          >
            <Text className="text-xs font-bold text-text-inverse">
              {verifyingCurrent ? "…" : "Подтвердить"}
            </Text>
          </Pressable>
          <Pressable onPress={reset}>
            <Text className="text-xs font-bold text-text-muted">Отмена</Text>
          </Pressable>
        </View>
      )}

      {mode === "changeInput" && (
        <View className="gap-2.5 mt-3">
          <TextInput
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Новый email"
            placeholderTextColor="#9A9388"
            value={newEmail}
            onChangeText={setNewEmail}
            className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={reset}
              className="flex-1 py-3 rounded-2xl border border-border items-center"
            >
              <Text className="text-sm font-bold text-text-soft">Отмена</Text>
            </Pressable>
            <Pressable
              onPress={submitNewEmail}
              disabled={sendingChange}
              className={`flex-1 py-3 rounded-2xl bg-accent items-center ${sendingChange ? "opacity-50" : ""}`}
            >
              <Text className="text-sm font-extrabold text-text-inverse">
                {sendingChange ? "Отправляем код…" : "Отправить код"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === "changeVerify" && (
        <View className="gap-2.5 mt-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              keyboardType="number-pad"
              placeholder="Код из письма"
              placeholderTextColor="#9A9388"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3 py-2.5 text-sm w-28"
            />
            <Pressable
              onPress={submitChangeCode}
              disabled={confirming}
              className="px-4 py-2.5 rounded-xl bg-accent"
            >
              <Text className="text-xs font-bold text-text-inverse">
                {confirming ? "…" : "Подтвердить"}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={cancel}>
            <Text className="text-xs font-bold text-text-muted">
              Отменить смену email
            </Text>
          </Pressable>
        </View>
      )}

      {success && (
        <Text className="text-xs font-semibold text-green-600 mt-2">
          {success}
        </Text>
      )}
      {error && (
        <Text className="text-xs font-semibold text-red-dark mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}

/* ================== ТЕЛЕФОН ================== */

type PhoneMode = "idle" | "changeInput" | "changeVerify";

function PhoneSection({
  phone,
  pendingPhone,
}: {
  phone?: string | null;
  pendingPhone?: string | null;
}) {
  const [mode, setMode] = useState<PhoneMode>(
    pendingPhone ? "changeVerify" : "idle",
  );
  const [newPhone, setNewPhone] = useState("+992");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requestChange, { loading: sending }] =
    useMutation<any>(REQUEST_PHONE_CHANGE);
  const [confirmChange, { loading: confirming }] = useMutation<any>(
    CONFIRM_PHONE_CHANGE,
    { refetchQueries: [{ query: GET_PROFILE_FULL }] },
  );
  const [cancelChange] = useMutation<any>(CANCEL_PHONE_CHANGE, {
    refetchQueries: [{ query: GET_PROFILE_FULL }],
  });

  function reset() {
    setMode(pendingPhone ? "changeVerify" : "idle");
    setNewPhone("+992");
    setCode("");
    setError(null);
  }

  async function submitNewPhone() {
    setError(null);
    const cleaned = newPhone.replace(/[\s\-()]/g, "").trim();
    if (!TJ_PHONE_REGEX.test(cleaned)) {
      setError("Формат: +992 и ровно 9 цифр");
      return;
    }
    try {
      await requestChange({ variables: { newPhone: cleaned } });
      setMode("changeVerify");
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить код");
    }
  }
  async function submitCode() {
    setError(null);
    if (!code) {
      setError("Введите код из SMS");
      return;
    }
    try {
      await confirmChange({ variables: { code } });
      setSuccess("Номер изменён и подтверждён");
      reset();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || "Не удалось подтвердить номер");
    }
  }
  async function cancel() {
    setError(null);
    try {
      await cancelChange();
      reset();
    } catch (e: any) {
      setError(e?.message || "Не удалось отменить заявку");
    }
  }

  return (
    <View className="bg-soft-surface border border-border rounded-3xl p-5">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-extrabold text-text">Телефон</Text>
        {mode === "idle" && (
          <Pressable onPress={() => setMode("changeInput")}>
            <Text className="text-sm font-bold text-accent">Изменить</Text>
          </Pressable>
        )}
      </View>

      <Text className="text-sm font-semibold text-text">{phone || "—"}</Text>

      {pendingPhone && mode === "changeVerify" && (
        <Text className="text-xs text-text-soft mt-2">
          Ожидает подтверждения: {pendingPhone}
        </Text>
      )}

      {mode === "changeInput" && (
        <View className="gap-2.5 mt-3">
          <TextInput
            keyboardType="phone-pad"
            placeholder="+992XXXXXXXXX"
            placeholderTextColor="#9A9388"
            value={newPhone}
            onChangeText={(v) => setNewPhone(v.replace(/[^\d+]/g, ""))}
            className="bg-soft-surface-2 border border-border text-text rounded-xl px-3.5 py-3 text-sm"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={reset}
              className="flex-1 py-3 rounded-2xl border border-border items-center"
            >
              <Text className="text-sm font-bold text-text-soft">Отмена</Text>
            </Pressable>
            <Pressable
              onPress={submitNewPhone}
              disabled={sending}
              className={`flex-1 py-3 rounded-2xl bg-accent items-center ${sending ? "opacity-50" : ""}`}
            >
              <Text className="text-sm font-extrabold text-text-inverse">
                {sending ? "Отправляем код…" : "Отправить код"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === "changeVerify" && (
        <View className="gap-2.5 mt-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              keyboardType="number-pad"
              placeholder="Код из SMS"
              placeholderTextColor="#9A9388"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              className="bg-soft-surface-2 border border-border text-text rounded-xl px-3 py-2.5 text-sm w-28"
            />
            <Pressable
              onPress={submitCode}
              disabled={confirming}
              className="px-4 py-2.5 rounded-xl bg-accent"
            >
              <Text className="text-xs font-bold text-text-inverse">
                {confirming ? "…" : "Подтвердить"}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={cancel}>
            <Text className="text-xs font-bold text-text-muted">
              Отменить смену номера
            </Text>
          </Pressable>
        </View>
      )}

      {success && (
        <Text className="text-xs font-semibold text-green-600 mt-2">
          {success}
        </Text>
      )}
      {error && (
        <Text className="text-xs font-semibold text-red-dark mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}
