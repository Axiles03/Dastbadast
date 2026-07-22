// dastbadast-multivendor-store/app/(tabs)/kds.tsx
//
// ⭐ ФАЗА 3, п.12: полноценный Kitchen Display System — три колонки
// ("Готовятся" / "Почти готово" / "Готово, ждёт курьера") вместо плоского
// списка в processing.tsx. Переиспользует уже существующий и хорошо
// написанный usePrepRemainingMs (lib/prep-timer.ts) как основу таймера —
// не изобретаем часы заново.
//
// Это НЕ замена processing.tsx (там осталась вкладка "История" — доставленные
// и отменённые заказы, вне скоупа KDS), а альтернативный/дополнительный
// экран для основного рабочего процесса кухни. Добавить в табы навигации
// (app/(tabs)/_layout.tsx) как отдельный таб "Кухня" рядом с "Готовятся".
//
// Эскалация просроченных: карточка заказа, у которого remainingMs === 0
// (isLate === true), подсвечивается красным и триггерит короткий повторный
// сигнал (переиспользуем playNewOrderSignal из lib/sound.ts, Фаза 1) —
// кухня не должна "прошляпить" заказ, который уже вышел за prepTime.

import { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client/react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RESTAURANT_ORDERS,
  MARK_ORDER_READY,
} from "../../lib/api/graphql/queries";
import { useAuth } from "../../lib/auth-context";
import { usePrepRemainingMs, formatPrepRemaining } from "../../lib/prep-timer";
import { playNewOrderSignal, stopNewOrderSignal } from "../../lib/sound";
import { buildKitchenTicket } from "../../lib/printer/escpos";
import { printTicket } from "../../lib/printer/printer";
import { colors, spacing, radius } from "../../lib/styles";

const POLL_MS = 10_000;
// ⭐ Заказ считается "почти готовым" за 3 минуты до истечения prepTime —
// психологически полезная граница, чтобы кухня успела собрать заказ,
// а не хватилась в последнюю секунду.
const ALMOST_READY_THRESHOLD_MS = 3 * 60 * 1000;

type OrderCard = {
  id: string;
  items: { foodId: string; title: string; price: number; quantity: number }[];
  note?: string | null;
  paymentMethod: string;
  paid: boolean;
  createdAt: string;
  statusTimestamps?: { acceptedAt?: string | null; prepTime?: number | null };
  deliveryAddress?: { address?: string; city?: string } | null;
};

function useOrdersByStatus(status: string, restaurantId?: string) {
  const { data, loading, refetch } = useQuery(RESTAURANT_ORDERS, {
    variables: { status },
    pollInterval: POLL_MS,
    skip: !restaurantId,
  }) as any;
  return {
    orders: (data?.restaurantOrders ?? []) as OrderCard[],
    loading,
    refetch,
  };
}

export default function KitchenDisplay() {
  const { restaurant } = useAuth();
  const cooking = useOrdersByStatus("ACCEPTED", restaurant?.id);
  const ready = useOrdersByStatus("READY_FOR_PICKUP", restaurant?.id);
  const [markOrderReady] = useMutation(MARK_ORDER_READY);

  // ⭐ Отслеживаем, каким заказам уже проиграли эскалационный сигнал,
  // чтобы не зацикливать звук на каждый ре-рендер таймера (раз в секунду).
  const escalatedRef = useRef<Set<string>>(new Set());

  const lateCooking = useMemo(
    () =>
      cooking.orders.filter((o) => {
        const total = (o.statusTimestamps?.prepTime ?? 0) * 60 * 1000;
        const elapsed =
          Date.now() - new Date(o.statusTimestamps?.acceptedAt ?? 0).getTime();
        return total > 0 && elapsed > total;
      }),
    [cooking.orders],
  );

  useEffect(() => {
    const stillLateIds = new Set(lateCooking.map((o) => o.id));
    const newlyLate = lateCooking.filter(
      (o) => !escalatedRef.current.has(o.id),
    );
    if (newlyLate.length > 0) {
      playNewOrderSignal().catch(() => {});
      newlyLate.forEach((o) => escalatedRef.current.add(o.id));
      // Короткий сигнал, не бесконечный, как для нового заказа — иначе кухня
      // не отличит "новый заказ" от "этот подгорает".
      setTimeout(() => stopNewOrderSignal().catch(() => {}), 4000);
    }
    // Забываем заказы, которые перестали быть late (менеджер обработал).
    escalatedRef.current.forEach((id) => {
      if (!stillLateIds.has(id)) escalatedRef.current.delete(id);
    });
  }, [lateCooking]);

  const handleReady = async (orderId: string) => {
    await markOrderReady({ variables: { orderId } });
    await cooking.refetch();
    await ready.refetch();
  };

  const handleReprint = (order: OrderCard) => {
    printTicket(
      buildKitchenTicket({
        shortId: order.id.slice(-6),
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        paid: order.paid,
        note: order.note,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
      }),
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <View
        style={{
          flexDirection: "row",
          padding: spacing.base,
          gap: spacing.md,
          flex: 1,
        }}
      >
        <KdsColumn
          title="Готовятся"
          icon="👨‍🍳"
          count={cooking.orders.length}
          loading={cooking.loading}
          children={undefined}
        >
          {cooking.orders.map((o) => (
            <CookingCard
              key={o.id}
              order={o}
              onReady={() => handleReady(o.id)}
              onReprint={() => handleReprint(o)}
            />
          ))}
        </KdsColumn>

        <KdsColumn
          title="Готово, ждёт курьера"
          icon="✅"
          count={ready.orders.length}
          loading={ready.loading}
          children={undefined}
        >
          {ready.orders.map((o) => (
            <ReadyCard key={o.id} order={o} />
          ))}
        </KdsColumn>
      </View>
    </SafeAreaView>
  );
}

function KdsColumn({
  title,
  icon,
  count,
  loading,
  children,
}: {
  title: string;
  icon: string;
  count: number;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface2,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>
          {title}
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            marginLeft: "auto",
          }}
        >
          <Text
            style={{ color: colors.textSoft, fontSize: 12, fontWeight: "600" }}
          >
            {count}
          </Text>
        </View>
      </View>
      {loading && count === 0 ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      )}
    </View>
  );
}

function CookingCard({
  order,
  onReady,
  onReprint,
}: {
  order: OrderCard;
  onReady: () => void;
  onReprint: () => void;
  key?: string | number | null;
}) {
  const { remainingMs, isLate } = usePrepRemainingMs(
    order.statusTimestamps?.acceptedAt,
    order.statusTimestamps?.prepTime,
  );
  const almostReady =
    !isLate && remainingMs > 0 && remainingMs <= ALMOST_READY_THRESHOLD_MS;

  const borderColor = isLate
    ? colors.red
    : almostReady
      ? colors.warning
      : colors.border;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 2,
        borderColor,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "700", color: colors.text }}>
          #{order.id.slice(-6)}
        </Text>
        <Text
          style={{
            fontWeight: "700",
            color: isLate ? colors.red : colors.textSoft,
          }}
        >
          {isLate ? "ПРОСРОЧЕНО" : formatPrepRemaining(remainingMs)}
        </Text>
      </View>
      {order.items.map((it, idx) => (
        <Text key={idx} style={{ color: colors.text, marginTop: spacing.xs }}>
          {it.quantity}× {it.title}
        </Text>
      ))}
      {order.note ? (
        <Text
          style={{
            color: colors.accentDark,
            marginTop: spacing.xs,
            fontStyle: "italic",
          }}
        >
          {order.note}
        </Text>
      ) : null}
      <View
        style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}
      >
        <TouchableOpacity
          onPress={onReprint}
          style={{
            backgroundColor: colors.surface2,
            borderRadius: radius.sm,
            padding: spacing.sm,
          }}
        >
          <Text style={{ color: colors.text }}>🖨️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onReady}
          style={{
            flex: 1,
            backgroundColor: colors.success,
            borderRadius: radius.sm,
            padding: spacing.sm,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.textInverse, fontWeight: "700" }}>
            Готово
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReadyCard({ order }: { order: OrderCard, key?: string | number }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontWeight: "700", color: colors.text }}>
        #{order.id.slice(-6)}
      </Text>
      <Text style={{ color: colors.textSoft, marginTop: spacing.xs }}>
        {order.items.length} {order.items.length === 1 ? "позиция" : "позиции"}{" "}
        · ждём курьера
      </Text>
    </View>
  );
}
