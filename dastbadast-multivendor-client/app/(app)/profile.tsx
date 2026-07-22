// dastbadast-multivendor-client/app/(app)/profile.tsx
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { GET_PROFILE_FULL } from "../../lib/api/queries";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data } = useQuery<any>(GET_PROFILE_FULL, {
    fetchPolicy: "cache-and-network",
  });
  const profile = data?.profile ?? user;

  async function handleLogout() {
    Alert.alert("Выйти из аккаунта?", undefined, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login" as any);
        },
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-soft-bg"
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Text className="text-2xl font-extrabold text-text tracking-tight">
        Профиль
      </Text>

      {profile && profile.hasPassword === false && (
        <View className="bg-soft-surface-2 border border-border rounded-2xl px-4 py-3 flex-row items-center gap-2">
          <Ionicons name="lock-closed-outline" size={16} color="#208AEF" />
          <Text className="text-xs font-semibold text-text-soft flex-1">
            Пароль не задан. Задайте его во вкладке «Безопасность», чтобы
            входить не только по коду из SMS.
          </Text>
        </View>
      )}

      {/* Карточка профиля */}
      <View className="bg-soft-surface border border-border rounded-3xl p-5 flex-row items-center gap-4 shadow-soft-sm">
        <View className="w-16 h-16 rounded-full bg-purple items-center justify-center overflow-hidden">
          {profile?.avatar ? (
            <View className="w-full h-full">
              {/* expo-image для локального кэша, но обычный fallback достаточно */}
              <ProfileAvatarImage uri={profile.avatar} />
            </View>
          ) : (
            <Text className="text-text-inverse text-xl font-extrabold">
              {(profile?.name?.[0] || "Г").toUpperCase()}
            </Text>
          )}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-extrabold text-text" numberOfLines={1}>
            {profile?.name || "Гость"}
          </Text>
          <Text className="text-xs text-text-muted" numberOfLines={1}>
            {profile?.email || "Email не указан"}
          </Text>
          <Text className="text-xs text-text-muted" numberOfLines={1}>
            {profile?.phone || "—"}
          </Text>
        </View>
      </View>

      {/* Баланс */}
      <Pressable
        onPress={() => router.push("/(app)/wallet" as any)}
        className="bg-soft-accent rounded-3xl p-5 flex-row items-center justify-between active:opacity-90"
      >
        <View>
          <Text className="text-xs font-bold text-text-inverse/80">Баланс</Text>
          <Text className="text-2xl font-extrabold text-text-inverse mt-1">
            {(profile?.balance ?? 0).toLocaleString("ru")} сом.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
      </Pressable>

      {/* Ссылки */}
      <View className="bg-soft-surface border border-border rounded-3xl overflow-hidden">
        <MenuItem
          icon="create-outline"
          title="Редактировать профиль"
          subtitle="Имя, email, телефон, аватар"
          onPress={() => router.push("/(app)/edit-profile" as any)}
        />
        <MenuItem
          icon="lock-closed-outline"
          title="Безопасность"
          subtitle="Пароль и вход в аккаунт"
          onPress={() => router.push("/(app)/security" as any)}
        />
        <MenuItem
          icon="location-outline"
          title="Мои адреса"
          subtitle="Управление адресами доставки"
          onPress={() => router.push("/(app)/address" as any)}
        />
        <MenuItem
          icon="receipt-outline"
          title="История заказов"
          subtitle="Все ваши заказы"
          onPress={() => router.push("/(app)/orders" as any)}
        />
        <MenuItem
          icon="notifications-outline"
          title="Уведомления"
          subtitle="Push-уведомления в приложении"
          onPress={() => router.push("/(app)/notifications" as any)}
        />
        <MenuItem
          icon="chatbubble-ellipses-outline"
          title="Поддержка"
          subtitle="Связаться с нами"
          onPress={() => router.push("/(app)/support" as any)}
          last
        />
      </View>

      <Pressable
        onPress={handleLogout}
        className="bg-soft-surface border border-border rounded-2xl py-3.5 items-center flex-row justify-center gap-2 active:opacity-80"
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text className="text-sm font-extrabold text-red-dark">
          Выйти из аккаунта
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function ProfileAvatarImage({ uri }: { uri: string }) {
  const { Image } = require("expo-image");
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
    />
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 gap-3 active:bg-soft-surface-2 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <View className="w-10 h-10 rounded-xl bg-soft-surface-2 items-center justify-center">
        <Ionicons name={icon} size={19} color="#1F1B16" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-bold text-text">{title}</Text>
        <Text className="text-2xs text-text-muted">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9A9388" />
    </Pressable>
  );
}
