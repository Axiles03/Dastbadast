// dastbadast-multivendor-store/app/settings/printer.tsx
//
// ⭐ ФАЗА 3, п.11: экран настройки IP кухонного принтера + тестовая печать.
// Добавить ссылку на этот экран из главного экрана настроек
// (app/(tabs)/profile.tsx или аналог — пункт "Принтер чеков").

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPrinterConfig,
  setPrinterConfig,
  printTestPage,
  type PrinterConfig,
} from "../../lib/printer/printer";
import { colors, spacing, radius } from "../../lib/styles";

export default function PrinterSettingsScreen() {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("9100");
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPrinterConfig().then((cfg) => {
      if (!cfg) return;
      setIp(cfg.ip);
      setPort(String(cfg.port));
      setEnabled(cfg.enabled);
    });
  }, []);

  const handleSave = async () => {
    if (enabled && !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      Alert.alert(
        "Проверьте IP",
        "Введите корректный IP-адрес принтера, например 192.168.1.50",
      );
      return;
    }
    setSaving(true);
    try {
      const cfg: PrinterConfig = {
        ip,
        port: parseInt(port, 10) || 9100,
        enabled,
      };
      await setPrinterConfig(cfg);
      Alert.alert("Сохранено", "Настройки принтера обновлены");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Сохраняем перед тестом, чтобы тест шёл по актуальным полям на экране,
      // а не по последней сохранённой версии.
      await setPrinterConfig({
        ip,
        port: parseInt(port, 10) || 9100,
        enabled: true,
      });
      const result = await printTestPage();
      if (result.ok) {
        Alert.alert("Успех", "Тестовая страница отправлена на принтер");
      } else {
        Alert.alert(
          "Не удалось напечатать",
          result.reason === "connect-failed"
            ? `Принтер не отвечает по адресу ${ip}:${port}. Проверьте, что принтер включён и в той же Wi-Fi сети.`
            : result.reason === "timeout"
              ? "Принтер не ответил вовремя (таймаут). Проверьте IP и сеть."
              : result.reason === "unsupported"
                ? "Печать по сети недоступна в Expo Go. Соберите dev-client (npx expo run:ios / run:android) или production-сборку, чтобы проверить принтер."
                : "Печать не настроена или отключена.",
        );
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
          Принтер чеков
        </Text>
        <Text style={{ color: colors.textSoft }}>
          Автоматическая печать чека на кухню при принятии нового заказа.
          Поддерживаются сетевые термопринтеры (Ethernet/Wi-Fi, порт 9100).
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            Включить автопечать
          </Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textSoft, fontSize: 13 }}>
            IP-адрес принтера
          </Text>
          <TextInput
            value={ip}
            onChangeText={setIp}
            placeholder="192.168.1.50"
            keyboardType="numbers-and-punctuation"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textSoft, fontSize: 13 }}>
            Порт (обычно 9100)
          </Text>
          <TextInput
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.text,
            }}
          />
        </View>

        <TouchableOpacity
          onPress={handleTest}
          disabled={testing}
          style={{
            backgroundColor: colors.surface2,
            borderRadius: radius.md,
            padding: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {testing ? "Печатаем..." : "🖨️ Тестовая печать"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            padding: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.textInverse, fontWeight: "700" }}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
