if (__DEV__ && typeof ErrorUtils !== "undefined") {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log("🔴🔴🔴 GLOBAL ERROR 🔴🔴🔴");
    console.log("isFatal:", isFatal);
    console.log("message:", error?.message);
    console.log("stack:", error?.stack);
    defaultHandler(error, isFatal);
  });
}

import "../global.css";
import { Stack } from "expo-router";
import { ApolloProviderClient } from "../lib/apollo-provider";
import { AuthProvider } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";

export default function RootLayout() {
  return (
    <ApolloProviderClient>
      <AuthProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </AuthProvider>
    </ApolloProviderClient>
  );
}