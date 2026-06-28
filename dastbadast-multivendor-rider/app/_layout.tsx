import "../global.css";
import { Stack } from "expo-router";
import { ApolloProviderClient } from "../lib/apollo-provider";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <ApolloProviderClient>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ApolloProviderClient>
  );
}
