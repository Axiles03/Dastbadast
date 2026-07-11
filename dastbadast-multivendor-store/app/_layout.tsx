import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { ApolloProviderClient } from "../lib/apollo-provider";
import { AuthProvider } from "../lib/auth-context";
import "../global.css";

export default function RootLayout() {
  return (
    <ApolloProviderClient>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ApolloProviderClient>
  );
}
