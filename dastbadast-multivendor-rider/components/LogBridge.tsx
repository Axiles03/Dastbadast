// components/LogBridge.tsx
import { useEffect } from "react";
import { View } from "react-native";

export function LogBridge() {
  useEffect(() => {
    if (__DEV__) {
      console.log("⚡ RootLayout: провайдеры готовы");
    }
  }, []);
  return <View />;
}
