import { Slot } from "expo-router";
import { View } from "react-native";

export default function AuthLayout() {
  return (
    // Если у тебя здесь была какая-то общая обертка (например, фон или SafeAreaView) — оставляй её.
    // Главное — внутри рендерить <Slot />, а не конкретный экран вручную.
    <View className="flex-1 bg-soft-bg">
      <Slot /> 
    </View>
  );
}