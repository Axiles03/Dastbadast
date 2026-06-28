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