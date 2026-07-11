// dastbadast-multivendor-rider/app/(app)/edit-profile.tsx
//
// ⭐ НОВОЕ: экран редактирования профиля курьера.
//  - Фото профиля (галерея/камера через expo-image-picker)
//  - Имя, телефон, email
//  - Смена пароля (нужен текущий пароль)
//  - "Забыли пароль?" — пока заглушка (в будущем: вход через Google / SMS-код)
//
// ⚠️ ТРЕБУЕТСЯ ЗАВИСИМОСТЬ: expo-image-picker.
//    Установить командой:  npx expo install expo-image-picker
//
// ⚠️ MVP-ограничение: фото отправляется на сервер как base64 data-URI и
// хранится прямо в MongoDB (поле Rider.photo — String). Это нормально для
// пилота, но не масштабируется: для продакшена нужно грузить файл в
// объектное хранилище (S3 / Cloudinary / Supabase Storage) и хранить в БД
// только ссылку. Как только определитесь с хранилищем — эту часть
// (pickAndUploadPhoto) нужно будет заменить на реальную загрузку файла.

import { useState, type ComponentProps } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import {
  UPDATE_RIDER_PROFILE,
  CHANGE_RIDER_PASSWORD,
} from "../../lib/api/queries";
import { cn } from "../../lib/cn";

export default function EditProfileScreen() {
  const router = useRouter();
  const { rider, updateRider } = useAuth();

  const [name, setName] = useState(rider?.name ?? "");
  const [phone, setPhone] = useState(rider?.phone ?? "");
  const [email, setEmail] = useState(rider?.email ?? "");
  const [photo, setPhoto] = useState<string | null>(rider?.photo ?? null);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [updateProfile, { loading: savingProfile }] =
    useMutation<any>(UPDATE_RIDER_PROFILE);
  const [changePassword, { loading: savingPassword }] = useMutation<any>(
    CHANGE_RIDER_PASSWORD,
  );

  const pickPhoto = async () => {
    setPickingPhoto(true);
    try {
      // Ленивый импорт — чтобы файл не падал, если зависимость ещё не
      // установлена, а просто показывал понятную ошибку.
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Нет доступа",
          "Разрешите доступ к галерее, чтобы выбрать фото профиля.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      setPhoto(`data:${mime};base64,${asset.base64}`);
    } catch (e: any) {
      Alert.alert(
        "Модуль не установлен",
        "Выполните: npx expo install expo-image-picker, затем пересоберите приложение.",
      );
    } finally {
      setPickingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await updateProfile({
        variables: {
          input: {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            photo: photo ?? "",
          },
        },
      });
      const updated = data?.updateRiderProfile;
      if (updated) {
        await updateRider({
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
          photo: updated.photo,
        });
      }
      Alert.alert("Готово", "Профиль обновлён");
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить профиль");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Слишком короткий пароль", "Минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Пароли не совпадают");
      return;
    }
    try {
      await changePassword({
        variables: { input: { oldPassword, newPassword } },
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      Alert.alert("Готово", "Пароль изменён");
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось изменить пароль");
    }
  };

  const handleForgotPassword = () => {
    // ⭐ ЗАГЛУШКА: позже — восстановление через Google-аккаунт или
    // подтверждение по номеру телефона (SMS-код). Пока просто сообщаем.
    Alert.alert(
      "Скоро",
      "Восстановление пароля через Google или номер телефона появится в одном из следующих обновлений. Пока обратитесь в поддержку: support@dastbadast.tj",
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-soft-bg" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:scale-95"
          >
            <Ionicons name="chevron-back" size={20} color="#1F1B16" />
          </Pressable>
          <Text className="text-lg font-extrabold text-text">
            Редактировать профиль
          </Text>
          <View className="w-10" />
        </View>

        {/* Фото профиля */}
        <View className="items-center mt-4">
          <Pressable
            onPress={pickPhoto}
            disabled={pickingPhoto}
            className="relative"
          >
            <View className="w-24 h-24 rounded-full bg-accent-soft border-2 border-accent/20 items-center justify-center overflow-hidden">
              {pickingPhoto ? (
                <ActivityIndicator color="#F26A4A" />
              ) : photo ? (
                <Image source={{ uri: photo }} className="w-24 h-24" />
              ) : (
                <Text className="text-4xl">🛵</Text>
              )}
            </View>
            <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent items-center justify-center border-2 border-soft-bg">
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          <Text className="text-xs text-text-soft mt-2">
            Нажмите, чтобы изменить фото
          </Text>
        </View>

        {/* Поля профиля */}
        <View className="mx-5 mt-5 bg-soft-surface border border-border rounded-3xl p-5 gap-4 shadow-soft-sm">
          <Field
            label="Имя"
            value={name}
            onChangeText={setName}
            placeholder="Ваше имя"
          />
          <Field
            label="Телефон"
            value={phone}
            onChangeText={setPhone}
            placeholder="+992 ..."
            keyboardType="phone-pad"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Pressable
            onPress={handleSaveProfile}
            disabled={savingProfile}
            className={cn(
              "h-12 rounded-2xl items-center justify-center mt-1",
              savingProfile ? "bg-accent/60" : "bg-accent active:opacity-90",
            )}
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-text-inverse font-extrabold text-sm">
                Сохранить изменения
              </Text>
            )}
          </Pressable>
        </View>

        {/* Смена пароля */}
        <View className="mx-5 mt-3 bg-soft-surface border border-border rounded-3xl p-5 shadow-soft-sm">
          <Pressable
            onPress={() => setShowPasswordForm((v) => !v)}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-soft-surface-2 items-center justify-center">
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#1F1B16"
                />
              </View>
              <Text className="text-base font-extrabold text-text">
                Сменить пароль
              </Text>
            </View>
            <Ionicons
              name={showPasswordForm ? "chevron-up" : "chevron-down"}
              size={18}
              color="#6B6358"
            />
          </Pressable>

          {showPasswordForm && (
            <View className="gap-4 mt-4">
              <Field
                label="Текущий пароль"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
              />
              <Field
                label="Новый пароль"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Field
                label="Повторите новый пароль"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <Pressable
                onPress={handleChangePassword}
                disabled={savingPassword}
                className={cn(
                  "h-12 rounded-2xl items-center justify-center",
                  savingPassword
                    ? "bg-soft-text/60"
                    : "bg-soft-text active:opacity-90",
                )}
              >
                {savingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-text-inverse font-extrabold text-sm">
                    Изменить пароль
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleForgotPassword}
                className="items-center py-1"
              >
                <Text className="text-xs font-bold text-accent">
                  Забыли пароль?
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text className="text-2xs text-text-muted text-center mt-5 px-8 leading-4">
          В будущем здесь также появится вход и восстановление доступа через
          Google-аккаунт или номер телефона.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============== Sub: text field ============== */

function Field({
  label,
  ...inputProps
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text className="text-2xs font-bold text-text-soft uppercase tracking-wider mb-1.5">
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#9C9284"
        className="h-12 px-4 bg-soft-surface-2 border border-border rounded-2xl text-sm text-text font-semibold"
      />
    </View>
  );
}
