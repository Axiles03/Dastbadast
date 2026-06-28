// Stub для Firebase Cloud Messaging.
// Чтобы включить реальные push:
// 1) npm i @react-native-firebase/app @react-native-firebase/messaging
// 2) положить google-services.json / GoogleService-Info.plist
// 3) раскомментировать код ниже
// 4) на бэке: collection PushTokens + Firebase Admin SDK

export type PushModule = {
    getToken: () => Promise<string | null>;
  };
  
  let moduleRef: PushModule | null = null;
  
  export function setPushModule(m: PushModule) { moduleRef = m; }
  
  export async function getNotificationToken(): Promise<string | null> {
    if (!moduleRef) return null;
    try { return await moduleRef.getToken(); } catch { return null; }
  }
  