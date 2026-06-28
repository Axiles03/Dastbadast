import * as Haptics from "expo-haptics";

export async function playNewOrderSignal() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}
