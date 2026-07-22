// dastbadast-multivendor-client/app/(app)/wallet.tsx
import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GET_PROFILE_FULL,
  GET_WALLET_TRANSACTIONS,
  TOP_UP_BALANCE,
} from "../../lib/api/queries";

// ⭐ Тип проводки → человекочитаемая подпись. Держим здесь, а не в схеме —
// это чисто клиентская локализация, бэкенд отдаёт технический код.
const TYPE_LABELS: Record<string, string> = {
  TOPUP_STUB: "Пополнение",
  ADJUSTMENT: "Корректировка",
  WITHDRAWAL: "Списание",
};

export default function WalletScreen() {
  const router = useRouter();
  const [amountInput, setAmountInput] = useState("");

  const { data: profileData } = useQuery<any>(GET_PROFILE_FULL, {
    fetchPolicy: "cache-and-network",
  });
  const {
    data: txData,
    loading: txLoading,
    refetch: refetchTx,
  } = useQuery<any>(GET_WALLET_TRANSACTIONS, {
    variables: { limit: 30, offset: 0 },
    fetchPolicy: "cache-and-network",
  });

  const [topUpBalance, { loading: toppingUp }] = useMutation<any>(
    TOP_UP_BALANCE,
    { refetchQueries: [{ query: GET_PROFILE_FULL }] },
  );

  const balance = profileData?.profile?.balance ?? 0;
  const transactions = txData?.myWalletTransactions ?? [];

  async function handleTopUp() {
    const amount = Number(amountInput.replace(",", "."));
    if (!amount || amount <= 0) {
      Alert.alert("Введите сумму пополнения");
      return;
    }
    try {
      await topUpBalance({ variables: { amount } });
      setAmountInput("");
      refetchTx();
      Alert.alert(
        "Готово",
        "Баланс пополнен (тестовый режим — без реальной оплаты)",
      );
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? String(e));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-bg" edges={["top"]}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#1F1B16" />
        </Pressable>
        <Text className="text-xl font-extrabold text-text">Баланс</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        ListHeaderComponent={
          <View className="gap-4 mb-2">
            {/* Текущий баланс */}
            <View className="bg-soft-accent rounded-3xl p-6 items-center">
              <Text className="text-xs font-bold text-text-inverse/80">
                Текущий баланс
              </Text>
              <Text className="text-3xl font-extrabold text-text-inverse mt-1">
                {balance.toLocaleString("ru")} сом.
              </Text>
            </View>

            {/* Пополнение — ЗАГЛУШКА, без реального платёжного шлюза */}
            <View className="bg-soft-surface border border-border rounded-2xl p-4 gap-3">
              <Text className="text-sm font-bold text-text">Пополнить</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="Сумма, сом."
                  keyboardType="numeric"
                  className="flex-1 bg-soft-surface-2 rounded-xl px-4 py-3 text-sm text-text"
                />
                <Pressable
                  onPress={handleTopUp}
                  disabled={toppingUp}
                  className="bg-text rounded-xl px-5 items-center justify-center active:opacity-80"
                >
                  {toppingUp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-extrabold text-text-inverse">
                      Пополнить
                    </Text>
                  )}
                </Pressable>
              </View>
              <Text className="text-2xs text-text-muted">
                Тестовый режим: пополнение происходит мгновенно, без реальной
                оплаты.
              </Text>
            </View>

            <Text className="text-sm font-bold text-text mt-2">История</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-soft-surface border border-border rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-text" numberOfLines={1}>
                {TYPE_LABELS[item.type] ?? item.type}
              </Text>
              {!!item.note && (
                <Text className="text-2xs text-text-muted" numberOfLines={1}>
                  {item.note}
                </Text>
              )}
            </View>
            <Text
              className={`text-sm font-extrabold ${
                item.amount >= 0 ? "text-green-dark" : "text-red-dark"
              }`}
            >
              {item.amount >= 0 ? "+" : ""}
              {item.amount.toLocaleString("ru")} сом.
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !txLoading ? (
            <Text className="text-center text-xs text-text-muted py-8">
              Пока нет операций
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
