import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth-context";

export default function Index() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? (
    <Redirect href={"./(app)/home"} />
  ) : (
    <Redirect href={"./(auth)/login"} />
  );
}
