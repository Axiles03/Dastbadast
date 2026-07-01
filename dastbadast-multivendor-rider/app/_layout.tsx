import "../global.css";
import { Stack } from "expo-router";
import { ApolloProviderClient } from "../lib/apollo-provider";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <ApolloProviderClient children={undefined}>
      <AuthProvider children={undefined}>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ApolloProviderClient>
  );
}
