// dastbadast-multivendor-store/app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth-context";

export default function Index() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <Redirect href="/(tabs)/new" /> : <Redirect href="/login" />;
}
