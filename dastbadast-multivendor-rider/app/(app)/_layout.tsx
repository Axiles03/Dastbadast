import { Stack } from "expo-router";
import { LogBridge } from "../../components/LogBridge";

export default function AppLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Ensure LogBridge is placed where it won't break early layout context */}
      <LogBridge />
    </>
  );
}
