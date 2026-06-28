import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useQuery } from "@apollo/client/react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GET_ORDERS, GET_CONFIGURATION } from "../../lib/api/queries";
import { useAuth } from "../../lib/auth-context";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { formatTimeAgo } from "../../lib/config/format";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "active" | "history";

export default function OrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");

  // ⭐ useQuery<any>
  const { data, loading } = useQuery<any>(GET_ORDERS, { skip: !user });
  const { data: cfg } = useQuery<any>(GET_CONFIGURATION);

  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const orders = (data?.orders ?? []) as any[];

  const active = orders.filter(
    (o) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );
  const history = orders.filter((o) =>
    ["DELIVERED", "CANCELLED"].includes(o.orderStatus),
  );
  const visible = tab === "active" ? active : history;

  return (
    <SafeAreaView className="flex-1 bg-soft-bg">
      <View className="flex-row items-center px-5 pt-4 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-soft-surface border border-border items-center justify-center active:opacity-80 mr-3"
        >
          <Ionicons name="chevron-back" size={20} color="#1F1B16" />
        </Pressable>
        <Text className="text-lg font-extrabold text-text flex-1">
          История заказов
        </Text>
      </View>

      <View className="px-5 mb-3">
        <Text className="text-2xl font-extrabold text-text">Заказы</Text>
        <Text className="text-sm text-text-muted mt-1">
          Статус обновляется автоматически
        </Text>
      </View>

      <View className="flex-row bg-soft-surface border border-border rounded-full p-1.5 mx-5 mb-4 shadow-soft-sm">
        <Pressable
          onPress={() => setTab("active")}
          className={`flex-1 py-2.5 rounded-full items-center ${
            tab === "active" ? "bg-text" : ""
          }`}
        >
          <Text
            className={`text-sm font-extrabold ${
              tab === "active" ? "text-text-inverse" : "text-text-soft"
            }`}
          >
            🔥 Активные ({active.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("history")}
          className={`flex-1 py-2.5 rounded-full items-center ${
            tab === "history" ? "bg-text" : ""
          }`}
        >
          <Text
            className={`text-sm font-extrabold ${
              tab === "history" ? "text-text-inverse" : "text-text-soft"
            }`}
          >
            📦 История ({history.length})
          </Text>
        </Pressable>
      </View>

      {loading && orders.length === 0 ? (
        <ActivityIndicator color="#F26A4A" className="mt-6" />
      ) : visible.length === 0 ? (
        <EmptyState
          emoji={tab === "active" ? "📭" : "📦"}
          title={
            tab === "active"
              ? "Активных заказов пока нет"
              : "Истории заказов пока нет"
          }
          subtitle={
            tab === "active"
              ? "Сделайте первый заказ из главной"
              : "Завершённые заказы появятся здесь"
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/orders/${item.id}` as any)}
              className="bg-soft-surface border border-border rounded-2xl p-4 mb-3 shadow-soft-sm active:border-accent"
            >
              <View className="flex-row justify-between items-start gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="font-extrabold text-text text-base">
                    Заказ #{item.orderId}
                  </Text>
                  <Text className="text-xs text-text-muted mt-0.5">
                    {formatTimeAgo(item.createdAt)}
                  </Text>
                  <Text
                    className="text-sm text-text-soft mt-1.5"
                    numberOfLines={2}
                  >
                    📍 {item.deliveryAddress?.city},{" "}
                    {item.deliveryAddress?.address}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-accent text-base font-extrabold">
                    {item.amounts?.total} {sym}
                  </Text>
                  <View className="flex-row items-center bg-soft-surface-2 border border-border px-2.5 py-1 rounded-xl mt-2">
                    <Text className="text-2xs font-extrabold text-text-soft mr-0.5">
                      Подробнее
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={12}
                      color="#6B6358"
                    />
                  </View>
                </View>
              </View>
              <View className="mt-3 pt-3 border-t border-border">
                <StatusPill status={item.orderStatus} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
