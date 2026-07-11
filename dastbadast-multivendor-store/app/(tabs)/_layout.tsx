import "react-native-gesture-handler";
import { Tabs } from "expo-router";
import { Pressable, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function TabsLayout() {
  const { logout, restaurant } = useAuth();
  const router = useRouter();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#F26A4A",
          tabBarInactiveTintColor: "#9A9388",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#ECE6DA",
            paddingTop: 6,
            height: 64,
            paddingBottom: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginBottom: 4,
          },
          headerStyle: {
            backgroundColor: "#FAF7F2",
            borderBottomColor: "#ECE6DA",
            shadowOpacity: 0,
            elevation: 0,
          },
          headerTitleStyle: {
            fontWeight: "800",
            color: "#1F1B16",
            fontSize: 18,
          },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={async () => {
                await logout();
                router.replace("/login");
              }}
              className="flex-row items-center gap-2 px-3.5 py-1.5"
              hitSlop={8}
            >
              <View className="w-8 h-8 rounded-full bg-accent-soft items-center justify-center">
                <Text className="text-accent-dark font-extrabold text-sm">
                  {(restaurant?.name ?? "D")[0]?.toUpperCase()}
                </Text>
              </View>
              <Text
                className="text-text-soft text-sm font-semibold max-w-[120px]"
                numberOfLines={1}
              >
                {restaurant?.name ?? "Выйти"}
              </Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="new"
          options={{
            title: "Новые заказы",
            tabBarLabel: "Новые",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="notifications-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="processing"
          options={{
            title: "В работе",
            tabBarLabel: "В работе",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Моё меню",
            tabBarLabel: "Меню",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="fast-food-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Профиль",
            tabBarLabel: "Профиль",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="storefront-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
      <Toast />
    </GestureHandlerRootView>
  );
}
