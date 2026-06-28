import { View, Text, Pressable } from "react-native";
import { useCart } from "../lib/cart-context";
import { useRouter } from "expo-router";

export function CartBar({ symbol = "сом." }: { symbol?: string }) {
  const { items, subtotal, itemCount } = useCart();
  const router = useRouter();

  if (itemCount === 0) return null;

  return (
    <View className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-2">
      <Pressable
        onPress={() => router.push("/(app)/cart")}
        className="bg-accent h-14 rounded-2xl flex-row items-center justify-between px-5 shadow-soft-lg active:opacity-90"
      >
        <View className="flex-row items-center">
          <View className="bg-text-inverse/20 w-9 h-9 rounded-full items-center justify-center mr-3">
            <Text className="text-text-inverse font-extrabold">
              {itemCount}
            </Text>
          </View>
          <Text className="text-text-inverse font-extrabold text-base">
            Корзина
          </Text>
        </View>
        <Text className="text-text-inverse font-extrabold text-lg">
          {subtotal} {symbol}
        </Text>
      </Pressable>
    </View>
  );
}
