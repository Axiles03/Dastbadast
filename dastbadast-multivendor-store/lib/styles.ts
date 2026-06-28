import { StyleSheet, Platform, ViewStyle, TextStyle } from "react-native";

/**
 * Тёплая / soft палитра — синхронизирована с dastbadast-multivendor-web
 * (Tailwind tokens: soft-bg / soft-surface / soft-accent / soft-…)
 */
export const colors = {
  // Поверхности
  bg: "#FAF7F2", // основной бежевый
  surface: "#FFFFFF", // карточки
  surface2: "#F4EFE7", // альтернативный фон (поля, чипы)
  surface3: "#FBF8F3", // лёгкая модификация

  // Текст
  text: "#1F1B16", // основной
  textSoft: "#6B6358", // вторичный
  textMuted: "#9A9388", // третичный (метки, время)
  textInverse: "#FFFFFF", // на тёмных плашках

  // Границы
  border: "#ECE6DA",
  borderSoft: "#F1ECE3",

  // Бренд (оранжевый)
  accent: "#F26A4A",
  accentDark: "#DC5635",
  accentSoft: "#FFEEE5",

  // Семантика
  success: "#16A34A",
  successDark: "#15803D",
  successSoft: "#DCFCE7",
  warning: "#F5A623",
  warningDark: "#B45309",
  warningSoft: "#FEF3C7",
  info: "#2D9CDB",
  infoSoft: "#E0F2FE",
  purple: "#6E5BFF",
  purpleDark: "#5847E0",
  purpleSoft: "#EEEBFF",
  red: "#DC2626",
  redSoft: "#FEE2E2",

  // Спец
  white: "#FFFFFF",
  black: "#1F1B16",
  shadow: "rgba(31, 27, 22, 0.08)",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
} as const;

const softShadow = (level: 1 | 2 | 3 = 1): ViewStyle => {
  if (Platform.OS === "web") return {};
  const levels: Record<number, ViewStyle> = {
    1: {
      shadowColor: "#1F1B16",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    2: {
      shadowColor: "#1F1B16",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    3: {
      shadowColor: "#1F1B16",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
  };
  return levels[level];
};

/* ============== Общие стили (карточки, кнопки) ============== */
export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, flex: 1 },

  // Заголовки
  h1: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  h2: { fontSize: 20, fontWeight: "800", color: colors.text },
  h3: { fontSize: 17, fontWeight: "700", color: colors.text },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  // Карточка
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 12,
    ...softShadow(1),
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: { flexDirection: "row", alignItems: "center" },
  gap1: { gap: 4 },
  gap2: { gap: 8 },
  gap3: { gap: 12 },

  // Текстовые утилиты
  orderId: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  muted: { fontSize: 12, color: colors.textMuted },
  soft: { fontSize: 13, color: colors.textSoft },
  addr: { fontSize: 14, color: colors.textSoft, marginTop: 6, lineHeight: 20 },
  total: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  totalAccent: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: -0.2,
  },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 48,
    fontSize: 15,
  },

  // Кнопки
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.accent, ...softShadow(1) },
  btnSuccess: { backgroundColor: colors.success, ...softShadow(1) },
  btnDanger: { backgroundColor: colors.red, ...softShadow(1) },
  btnOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnGhost: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.1,
  },
  btnTextAccent: { color: colors.accentDark, fontWeight: "700", fontSize: 15 },
  btnTextSoft: { color: colors.textSoft, fontWeight: "700", fontSize: 15 },

  // Поля ввода
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.textMuted,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },

  // Пиллы/бейджи статусов
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
});

/* ============== Статусы заказа (синхронизированы с web) ============== */
export const statusBadge = (
  status: string,
): {
  bg: string;
  color: string;
  border: string;
  label: string;
  emoji: string;
} => {
  const map: Record<
    string,
    { bg: string; color: string; border: string; label: string; emoji: string }
  > = {
    PENDING: {
      bg: colors.warningSoft,
      color: colors.warningDark,
      border: "#FDE68A",
      label: "Новый",
      emoji: "⏱",
    },
    ACCEPTED: {
      bg: colors.purpleSoft,
      color: colors.purpleDark,
      border: "#D8D2FF",
      label: "Готовится",
      emoji: "👨‍🍳",
    },
    ASSIGNED: {
      bg: colors.accentSoft,
      color: colors.accentDark,
      border: "#FFD0BC",
      label: "Курьер едет",
      emoji: "🛵",
    },
    PICKED: {
      bg: colors.infoSoft,
      color: "#0E6BA8",
      border: "#BFE3F5",
      label: "В пути",
      emoji: "🚴",
    },
    DELIVERED: {
      bg: colors.successSoft,
      color: colors.successDark,
      border: "#BBF7D0",
      label: "Доставлен",
      emoji: "✅",
    },
    CANCELLED: {
      bg: colors.redSoft,
      color: "#991B1B",
      border: "#FECACA",
      label: "Отменён",
      emoji: "✕",
    },
    AWAITING_CONFIRMATION: {
      bg: colors.warningSoft,
      color: colors.warningDark,
      border: "#FDE68A",
      label: "Ждём подтверждения",
      emoji: "📦",
    },
  };
  return (
    map[status] || {
      bg: colors.surface2,
      color: colors.textSoft,
      border: colors.border,
      label: status,
      emoji: "",
    }
  );
};

/* ============== Меню (категории и блюда) ============== */
export const menu = StyleSheet.create({
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 18,
  },

  actionRow: { flexDirection: "row", gap: 10, marginBottom: 18 },

  categoryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    marginBottom: 14,
    overflow: "hidden",
    ...softShadow(1),
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    flex: 1,
    letterSpacing: -0.2,
  },

  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  linkText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  linkDanger: { color: colors.red, fontWeight: "700", fontSize: 13 },

  foodRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  foodTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  foodDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.accent,
    marginTop: 4,
  },
  foodHidden: {
    fontSize: 11,
    color: colors.warningDark,
    marginTop: 2,
    fontWeight: "600",
  },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    minHeight: 36,
    justifyContent: "center",
  },
  smallBtnDanger: { backgroundColor: colors.redSoft },
  smallBtnText: { fontSize: 12, color: colors.text, fontWeight: "700" },

  addLink: { padding: 14, alignItems: "center" },

  // Модалки
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 27, 22, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    padding: 20,
    paddingBottom: 32,
    maxHeight: "92%",
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 50,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  modalBtnSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: "center",
    backgroundColor: colors.accent,
    minHeight: 50,
    justifyContent: "center",
    ...softShadow(1),
  },
  modalBtnCancelText: { color: colors.textSoft, fontWeight: "700" },
  modalBtnSaveText: { color: colors.white, fontWeight: "700" },

  // Чипы категорий
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },

  // Поле в модалке
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.surface2,
    color: colors.text,
    marginBottom: 14,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: "top", paddingTop: 12 },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: "600",
  },
});

/* ============== Карточка заказа для ресторана ============== */
export const orderCard = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 14,
    ...softShadow(2),
  },
  cardPending: { borderColor: colors.accent, borderWidth: 1.5 },
  cardUrgent: { backgroundColor: colors.accentSoft },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  left: { flex: 1, minWidth: 0, marginRight: 12 },
  right: { alignItems: "flex-end" },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  orderId: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: -0.2,
  },
  addressBlock: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressValue: { fontSize: 14, color: colors.text, fontWeight: "600" },
  noteBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  noteText: { fontSize: 13, color: colors.text, fontStyle: "italic" },
  itemsList: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemLine: { fontSize: 14, color: colors.textSoft, lineHeight: 22 },
  itemQuantity: { color: colors.accent, fontWeight: "800" },
});

/* ============== Утилиты ============== */
export const utils = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, paddingBottom: 32 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});
