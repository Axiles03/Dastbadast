// dastbadast-multivendor-rider/components/ScreenHeader.tsx
//
// Универсальная шапка экрана: back-button, title, subtitle,
// а в правой части — slot для action-кнопок (фильтр, toggle и т.д.).
//
// ⭐ Использует "useSafeAreaInsets" из react-native-safe-area-context,
// чтобы корректно работать под iOS notch / Android cutouts.

import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../lib/cn";

type Props = {
  title: string;
  subtitle?: string;
  /** Показывать ли кнопку "Назад" (по умолчанию — да) */
  showBack?: boolean;
  /** Кастомный обработчик (по умолчанию router.back()) */
  onBack?: () => void;
  /** Слот для правых кнопок (toggle, filter, etc) */
  rightSlot?: React.ReactNode;
  /** Включить подсветку статуса (если `online` === true — зелёная точка) */
  online?: boolean;
  /** ⭐ Переключатель "Список / Карта" — покажется, если задан listMode+onChange */
  listMode?: boolean;
  onListModeChange?: (next: boolean) => void;
};

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  online,
  listMode,
  onListModeChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    try {
      if (router.canGoBack()) router.back();
    } catch {
      /* ignore */
    }
  };

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="bg-soft-surface border-b border-border"
    >
      <View className="px-4 pb-3 flex-row items-center justify-between gap-3">
        {/* Левая часть: back + title */}
        <View className="flex-row items-center gap-2 min-w-0 flex-1">
          {showBack && (
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-full bg-soft-surface-2 items-center justify-center active:scale-95"
              hitSlop={6}
            >
              <Ionicons name="chevron-back" size={20} color="#1F1B16" />
            </Pressable>
          )}
          <View className="min-w-0 flex-1">
            {subtitle ? (
              <Text className="text-2xs text-text-muted uppercase tracking-wider font-bold">
                {subtitle}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              {typeof online === "boolean" && (
                <View
                  className={cn(
                    "w-2 h-2 rounded-full",
                    online ? "bg-success" : "bg-text-muted",
                  )}
                />
              )}
              <Text
                className="text-lg font-extrabold text-text tracking-tight"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          </View>
        </View>

        {/* Правая часть: toggle Список/Карта (если задан) + rightSlot одновременно.
            ⭐ ФИКС: раньше rightSlot полностью перекрывал toggle через тернарник —
            на экране "Доступные" toggle никогда не показывался, и карта была
            недостижима из UI, хотя весь функционал карты уже реализован. */}
        <View className="flex-row items-center gap-1.5">
          {typeof listMode === "boolean" && onListModeChange ? (
            <ListMapToggle listMode={listMode} onChange={onListModeChange} />
          ) : null}
          {rightSlot}
        </View>
      </View>
    </View>
  );
}

/* ============== Sub: List ↔ Map toggle (⭐ ШАГ 2) ============== */

function ListMapToggle({
  listMode,
  onChange,
}: {
  listMode: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row bg-soft-surface-2 border border-border rounded-full p-1">
      <Pressable
        onPress={() => onChange(true)}
        className={cn(
          "flex-row items-center gap-1 px-3.5 h-9 rounded-full active:scale-95",
          listMode ? "bg-soft-text" : "bg-transparent",
        )}
      >
        <Ionicons
          name="list-outline"
          size={14}
          color={listMode ? "#FFFFFF" : "#6B6358"}
        />
        <Text
          className={cn(
            "text-xs font-extrabold",
            listMode ? "text-text-inverse" : "text-text-soft",
          )}
        >
          Список
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(false)}
        className={cn(
          "flex-row items-center gap-1 px-3.5 h-9 rounded-full active:scale-95",
          !listMode ? "bg-soft-text" : "bg-transparent",
        )}
      >
        <Ionicons
          name="map-outline"
          size={14}
          color={!listMode ? "#FFFFFF" : "#6B6358"}
        />
        <Text
          className={cn(
            "text-xs font-extrabold",
            !listMode ? "text-text-inverse" : "text-text-soft",
          )}
        >
          Карта
        </Text>
      </Pressable>
    </View>
  );
}
