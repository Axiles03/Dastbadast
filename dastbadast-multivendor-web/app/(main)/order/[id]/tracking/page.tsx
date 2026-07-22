// dastbadast-multivendor-web/app/(main)/order/[id]/tracking/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useSubscription, useMutation } from "@apollo/client/react";
import dynamic from "next/dynamic";
import {
  GET_ORDER,
  GET_CONFIGURATION,
  GET_CHAT_MESSAGES,
  SUB_ORDER,
  SUB_CHAT,
  SUB_RIDER_LOCATION,
  RIDER_LOCATION_QUERY,
  CONFIRM_ORDER_RECEIVED,
  SEND_CHAT_MESSAGE,
  MARK_CHAT_READ,
  SUB_CHAT_TYPING,
  REFRESH_ORDER_STATUS,
  ORDER_FRAGMENT,
  SUB_ORDER_UPDATED,
  GET_ORDER_FULL,
} from "@/lib/queries";
import { getApolloClient } from "@/lib/apollo-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { STATUS_LABELS, STATUS_STEPS } from "@/lib/order-status";
import { useShell } from "@/lib/shell-context";
import { useCart } from "@/lib/cart-context";
import { OrderStatusStage } from "@/components/OrderStatusStage";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

const OrderTrackingMap = dynamic(
  () => import("@/components/OrderTrackingMap").then((m) => m.OrderTrackingMap),
  { ssr: false },
);

type ChatMessage = {
  id: string;
  orderId: string;
  senderType: "USER" | "RIDER";
  text: string;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type RiderPos = {
  lat: number;
  lng: number;
  bearing?: number | null;
  speedKmh?: number | null;
  at?: string;
} | null;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TrackingPage() {
  return <TrackingInner />;
}

function TrackingInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  // ⭐ NEW: индикатор "курьер печатает…" и состояние отправки фото
  const [peerTyping, setPeerTyping] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [riderPos, setRiderPos] = useState<RiderPos | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const { setCartOpen } = useShell();
  const [cartExpanded, setCartExpanded] = useState(true);

  const { data, loading, error, refetch, subscribeToMore } = useQuery(
    GET_ORDER_FULL,
    {
      variables: { id },
      skip: !id,
    },
  );

  useEffect(() => {
    if (!id || !subscribeToMore) return;
    // Импортируем SUB_ORDER
    import("@/lib/queries").then(({ SUB_ORDER }) => {
      const unsubscribe = subscribeToMore({
        document: SUB_ORDER,
        variables: { orderId: id },
        updateQuery: (prev: any, { subscriptionData }: any) => {
          if (!subscriptionData?.data?.subscriptionOrder) return prev;
          const updated = subscriptionData.data.subscriptionOrder;
          return {
            order: {
              ...prev?.order,
              ...updated,
              items: updated.items ?? prev?.order?.items,
              amounts: updated.amounts ?? prev?.order?.amounts,
              deliveryAddress:
                updated.deliveryAddress ?? prev?.order?.deliveryAddress,
              pickupAddress:
                updated.pickupAddress ?? prev?.order?.pickupAddress,
            },
          };
        },
        onError: (err) => console.error("[SUB_ORDER] error:", err?.message),
      });
      return unsubscribe;
    });
  }, [id, subscribeToMore]);

  const { data: cfg } = useQuery(GET_CONFIGURATION);
  const { data: chatData } = useQuery<{ chatMessages: ChatMessage[] }>(
    GET_CHAT_MESSAGES,
    { variables: { orderId: id }, skip: !id },
  );

  const [confirmReceived, { loading: confirming }] = useMutation(
    CONFIRM_ORDER_RECEIVED,
  );
  // ⭐ NEW: пометить чат прочитанным
  const [markChatRead] = useMutation(MARK_CHAT_READ);

  // ⭐⭐⭐ FIX: безопасные дефолты для всех вложенных полей
  const o = data?.order ?? null;

  // ⭐⭐⭐ FIX: защита от undefined через optional chaining + nullish coalescing
  const isSearchingRider =
    !o?.riderId &&
    ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"].includes(
      o?.orderStatus,
    );
  useEffect(() => {
    if (!o || o.orderStatus !== "AWAITING_CONFIRMATION") return;
    const interval = setInterval(async () => {
      try {
        const client = getApolloClient();
        await client.mutate({
          mutation: REFRESH_ORDER_STATUS,
          variables: { id: o.id },
        });
        refetch();
      } catch {
        /* ignore */
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [o?.id, o?.orderStatus, refetch]);

  // ⭐⭐⭐ FIX: riderId безопасно извлекается
  const riderId: string | null = o?.riderId ?? null;
  const hasRider = !!riderId && riderId.length === 24;

  useSubscription(SUB_CHAT, {
    variables: { orderId: id },
    skip: !id,
    onData: (options) => {
      const m = (
        options.data?.data as { newChatMessage?: ChatMessage } | undefined
      )?.newChatMessage;
      if (!m) return;
      setLiveMessages((prev) =>
        prev.some((p) => p.id === m.id) ? prev : [...prev, m],
      );
      setChatOpen(true);
    },
  });

  // ⭐ NEW: индикатор "курьер печатает…"
  useSubscription<{
    chatTypingStatus: {
      orderId: string;
      senderType: "USER" | "RIDER";
      isTyping: boolean;
    };
  }>(SUB_CHAT_TYPING, {
    variables: { orderId: id },
    skip: !id,
    onData: ({ data: subData }) => {
      const ev = subData?.data?.chatTypingStatus;
      if (!ev) return;
      if (ev.senderType === "RIDER") setPeerTyping(!!ev.isTyping);
    },
  });

  // ⭐ NEW: помечаем чат прочитанным, когда панель открыта (и при открытии,
  // и повторно при получении нового сообщения, пока панель уже открыта)
  useEffect(() => {
    if (chatOpen && id) {
      markChatRead({ variables: { orderId: id } }).catch(() => {});
    }
  }, [chatOpen, id, markChatRead, liveMessages.length]);

  useSubscription(SUB_RIDER_LOCATION, {
    variables: { riderId: riderId || "" },
    skip: !hasRider,
    onData: ({ data: subData }) => {
      const p = subData?.data?.subscriptionRiderLocation;
      if (!p) return;
      if (p.stopped) {
        setRiderPos(null);
        return;
      }
      if (p.lat && p.lng) {
        setRiderPos({
          lat: p.lat,
          lng: p.lng,
          bearing: p.bearing ?? null,
          at: p.updatedAt,
        });
      }
    },
  });

  const { data: riderLocData } = useQuery(RIDER_LOCATION_QUERY, {
    variables: { id: riderId! },
    skip: !hasRider,
    pollInterval: 5000,
    fetchPolicy: "network-only",
  });

  const handleConfirmReceived = useCallback(async () => {
    if (!o) return;
    try {
      await confirmReceived({ variables: { input: { orderId: o.id } } });
    } catch (e: any) {
      alert(`Не удалось подтвердить: ${e?.message ?? e}`);
    }
  }, [o, confirmReceived]);

  const submitMessage = useCallback(async () => {
    const txt = draft.trim();
    if (!txt || !o) return;
    setDraft("");
    try {
      const client = getApolloClient();
      await client.mutate({
        mutation: SEND_CHAT_MESSAGE,
        variables: { orderId: o.id, text: txt },
      });
    } catch (e: any) {
      alert(`Не удалось отправить: ${e?.message ?? e}`);
      setDraft(txt);
    }
  }, [draft, o]);

  // ⭐ NEW: отправка фото из чата (например, скрин/фото для бесконтактной
  // доставки). ⚠️ MVP: кодируем файл в base64 data-URI, как и в мобильных
  // приложениях — для прода нужно загружать в объектное хранилище
  // (S3/Cloudinary) и слать сюда только готовую ссылку.
  const sendPhoto = useCallback(
    async (file: File) => {
      if (!o) return;
      setSendingPhoto(true);
      try {
        const dataUri: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
          reader.readAsDataURL(file);
        });
        const client = getApolloClient();
        await client.mutate({
          mutation: SEND_CHAT_MESSAGE,
          variables: { orderId: o.id, imageUrl: dataUri },
        });
      } catch (e: any) {
        alert(`Не удалось отправить фото: ${e?.message ?? e}`);
      } finally {
        setSendingPhoto(false);
      }
    },
    [o],
  );

  useEffect(() => {
    if (riderLocData?.rider?.location?.coordinates) {
      const c = riderLocData.rider.location.coordinates;
      if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) {
        setRiderPos({
          lat: c[1],
          lng: c[0],
          at: riderLocData.rider.lastLocationAt,
        });
      }
    }
  }, [riderLocData]);

  // ⭐⭐⭐ ШАГ 3 FIX: ETA считается от правильной точки в зависимости от статуса.
  //   - ASSIGNED: курьер едет к ресторану → ETA от riderPos до pickupAddress
  //   - PICKED / EN_ROUTE_TO_DROP_OFF / ARRIVED_AT_DROP_OFF: курьер едет к клиенту → ETA от riderPos до deliveryAddress
  // До фикса — всегда считался только до deliveryAddress, что для ASSIGNED было некорректно.
  useEffect(() => {
    if (!riderPos || !o) return;

    // Определяем точку назначения по статусу
    let destCoords: number[] | null = null;
    if (
      o.orderStatus === "PICKED" ||
      o.orderStatus === "EN_ROUTE_TO_DROP_OFF" ||
      o.orderStatus === "ARRIVED_AT_DROP_OFF"
    ) {
      destCoords = o?.deliveryAddress?.location?.coordinates ?? null;
    } else if (o.orderStatus === "ASSIGNED") {
      destCoords = o?.pickupAddress?.location?.coordinates ?? null;
    }

    if (!destCoords || destCoords.length < 2) return;
    const destLat = destCoords[1];
    const destLng = destCoords[0];
    if (typeof destLat !== "number" || typeof destLng !== "number") return;

    const km = haversineKm(riderPos.lat, riderPos.lng, destLat, destLng);
    setEtaMin(Math.max(1, Math.round((km / 25) * 60)));
  }, [riderPos, o]);

  useEffect(() => {
    if (!o || o.orderStatus !== "AWAITING_CONFIRMATION") {
      setTimeLeftMs(null);
      return;
    }
    const deliveredAt = o?.statusTimestamps?.deliveredAt;
    if (!deliveredAt) {
      setTimeLeftMs(null);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - new Date(deliveredAt).getTime();
      setTimeLeftMs(Math.max(0, 30 * 60 * 1000 - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [o?.orderStatus, o?.statusTimestamps?.deliveredAt]);

  useEffect(() => {
    if (chatScrollRef.current && chatOpen) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatData, liveMessages, chatOpen]);

  const messages = useMemo(
    () =>
      [...(chatData?.chatMessages ?? []), ...liveMessages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [chatData, liveMessages],
  );

  const stepIdx = useMemo(
    () =>
      o
        ? STATUS_STEPS.indexOf(o.orderStatus as (typeof STATUS_STEPS)[number])
        : -1,
    [o?.orderStatus],
  );

  if (loading) {
    return (
      <div className="text-center space-y-2 py-10">
        <div className="text-xl font-medium animate-pulse text-soft-text">
          Загрузка заказа…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
        <p className="text-red-600 font-medium">🛑 Ошибка: {error.message}</p>
        <Link
          href="/orders"
          className="inline-block bg-soft-surface border border-soft-border text-soft-text px-4 py-2 rounded-xl text-sm font-medium hover:border-soft-accent"
        >
          ← Вернуться в Мои заказы
        </Link>
      </div>
    );
  }

  // ⭐⭐⭐ FIX: ранний возврат, если данных нет
  if (!o) {
    return (
      <div className="bg-soft-surface border border-soft-border rounded-2xl p-6 text-center space-y-4">
        <p className="text-soft-text-soft font-medium">Заказ не найден</p>
        <Link
          href="/orders"
          className="inline-block bg-soft-surface-2 border border-soft-border text-soft-text px-4 py-2 rounded-xl text-sm font-medium hover:border-soft-accent"
        >
          ← Вернуться в Мои заказы
        </Link>
      </div>
    );
  }

  // ⭐ С этого момента TypeScript точно знает, что o не null
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const chatEnabled = [
    "ASSIGNED",
    "PICKED",
    "AWAITING_CONFIRMATION",
    "DELIVERED",
  ].includes(o.orderStatus);
  const showMap = !!hasRider && ["ASSIGNED", "PICKED"].includes(o.orderStatus);
  const deliveryFee = o.amounts?.deliveryFee ?? 0;
  const itemsTotal =
    o.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0) ?? 0;
  const tax = o.amounts?.tax ?? 0;
  const total = o.amounts?.total ?? itemsTotal + tax + deliveryFee;

  return (
    <>
      <OrderStatusStage
        status={o.orderStatus as any}
        acceptedAt={o?.statusTimestamps?.acceptedAt ?? null}
        prepTime={o?.statusTimestamps?.prepTime ?? null}
        etaMin={etaMin}
      />

      {isSearchingRider && (
        <div className="mt-6 bg-soft-warning-soft text-soft-warning-dark border border-soft-warning/30 rounded-2xl p-4 flex items-center gap-3 shadow-soft-sm animate-fade-in">
          <div className="text-3xl animate-pulse">🛵</div>
          <div className="flex-1">
            <p className="font-extrabold text-base">Ищем ближайшего курьера</p>
            <p className="text-xs text-soft-warning-dark/80 mt-0.5">
              Отправили заявку{" "}
              {o?.statusTimestamps?.courierSearchTimestamps?.initialPushedAt
                ? `${Math.max(1, Math.round((Date.now() - new Date(o.statusTimestamps.courierSearchTimestamps.initialPushedAt).getTime()) / 1000))} сек назад`
                : "только что"}
              {o?.statusTimestamps?.courierSearchTimestamps
                ?.escalationPushedAt && " · ⚡ эскалация отправлена"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 bg-soft-surface border border-soft-border rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft-sm">
        <p className="text-sm text-soft-text-soft text-center sm:text-left">
          Заказ готовится. Хотите добавить ещё что-нибудь?
        </p>
        <Link
          href="/"
          className="px-5 py-3 bg-soft-purple hover:bg-soft-purple-dark text-white font-extrabold rounded-2xl text-sm whitespace-nowrap"
        >
          Ask for recommendations
        </Link>
      </div>

      {showMap && (
        <div className="mt-6 bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base text-soft-text">
              🚴 Курьер на карте
            </h2>
            {etaMin !== null && (
              <span className="bg-soft-success-soft text-soft-success px-2.5 py-1 rounded-full text-xs font-extrabold">
                ⏱ ~{etaMin} мин
              </span>
            )}
          </div>
          <div
            className="rounded-xl overflow-hidden border border-soft-border"
            style={{ height: 280 }}
          >
            <OrderTrackingMap
              deliveryLat={
                o?.deliveryAddress?.location?.coordinates?.[1] ?? 38.574
              }
              deliveryLng={
                o?.deliveryAddress?.location?.coordinates?.[0] ?? 68.783
              }
              pickupLat={o?.pickupAddress?.location?.coordinates?.[1] ?? null}
              pickupLng={o?.pickupAddress?.location?.coordinates?.[0] ?? null}
              riderLat={riderPos?.lat ?? null}
              riderLng={riderPos?.lng ?? null}
              riderBearing={riderPos?.bearing ?? null}
              deliveryPrice={o?.deliveryPrice ?? null}
              etaMin={etaMin}
            />
          </div>
        </div>
      )}

      <section className="mt-6 bg-soft-surface border border-soft-border rounded-2xl shadow-soft-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setCartExpanded((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-soft-surface-2 transition-colors"
        >
          <h3 className="font-extrabold text-soft-text text-left">
            Список заказа и стоимость
          </h3>
          {cartExpanded ? (
            <ChevronUp className="w-4 h-4 text-soft-text-soft" />
          ) : (
            <ChevronDown className="w-4 h-4 text-soft-text-soft" />
          )}
        </button>

        {cartExpanded && (
          <>
            <ul className="px-4 pb-4 space-y-3 border-t border-soft-border">
              {o.items.map((i: any) => (
                <li key={i.foodId} className="flex items-center gap-3 pt-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-soft-surface-2 shrink-0 border border-soft-border">
                    {i.image ? (
                      <img
                        src={i.image}
                        alt={i.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        🍽
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-soft-text truncate">
                      {i.title}
                    </div>
                  </div>
                  <div className="text-sm text-soft-text-soft whitespace-nowrap">
                    {i.quantity} ×{" "}
                    <span className="text-soft-text font-bold ml-1">
                      {i.price} {sym}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="block w-full text-center text-soft-accent font-bold text-sm py-3 hover:bg-soft-surface-2 border-t border-soft-border"
            >
              + Добавить ещё блюда
            </button>
            <div className="p-4 border-t border-soft-border space-y-2 text-sm">
              <Row label="Подытог" value={`${itemsTotal} ${sym}`} />
              <Row
                label="Доставка"
                value={`${typeof o?.deliveryPrice === "number" ? o.deliveryPrice : deliveryFee} ${sym}`}
              />
              <div className="pt-2 border-t border-soft-border flex justify-between items-center">
                <span className="font-extrabold text-soft-text">
                  Итого к оплате
                </span>
                <span className="font-extrabold text-soft-accent text-lg">
                  {total} {sym}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {o.orderStatus === "AWAITING_CONFIRMATION" && (
        <div className="mt-6 bg-soft-surface border-2 border-soft-accent rounded-2xl p-5 shadow-soft-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-3xl shrink-0">📦</div>
            <div className="flex-1">
              <h2 className="font-bold text-lg text-soft-text">
                Завершите доставку
              </h2>
              <p className="text-sm text-soft-text-soft mt-1">
                Проверьте всё и подтвердите получение.
              </p>
              {timeLeftMs !== null && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-soft-surface-2 text-soft-accent border border-soft-accent/30 text-xs px-2.5 py-1 rounded-full font-mono font-bold">
                  ⏱ {formatCountdown(timeLeftMs)}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleConfirmReceived}
            disabled={confirming}
            className="w-full h-14 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2 bg-soft-success hover:bg-soft-success/90 active:scale-[0.98] disabled:opacity-50 text-white shadow-soft"
          >
            {confirming ? "⏳ Подтверждение..." : "✅ Получил заказ"}
          </button>
        </div>
      )}

      {o.orderStatus !== "CANCELLED" && stepIdx >= 0 && (
        <section className="mt-6 bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
          <h3 className="font-extrabold text-soft-text mb-3 text-sm">
            Этапы заказа
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {STATUS_STEPS.map((step, i) => {
              const passed = i <= stepIdx;
              return (
                <div
                  key={step}
                  className={`text-center p-2.5 rounded-xl border text-xs font-semibold ${
                    passed
                      ? "bg-soft-accent-soft border-soft-accent text-soft-accent"
                      : "bg-soft-surface-2 border-soft-border text-soft-text-muted"
                  }`}
                >
                  <div className="text-[10px] opacity-60 mb-0.5">
                    Шаг 0{i + 1}
                  </div>
                  <div className="truncate">{STATUS_LABELS[step]}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {chatEnabled && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-soft-accent hover:bg-soft-accent-dark text-white pl-4 pr-5 py-3 rounded-full shadow-soft-lg font-bold text-sm"
        >
          <MessageCircle className="w-5 h-5" />
          Чат ({messages.length})
        </button>
      )}

      {chatOpen && chatEnabled && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-soft-dark-2/60 backdrop-blur-sm">
          <div
            className="w-full sm:max-w-md bg-soft-surface border border-soft-border rounded-t-3xl sm:rounded-3xl shadow-drawer flex flex-col"
            style={{ maxHeight: "80vh" }}
          >
            <div className="flex items-center justify-between p-4 border-b border-soft-border">
              <div>
                <h3 className="font-extrabold text-base text-soft-text">
                  💬 Чат по заказу #{o.orderId}
                </h3>
                <p className="text-xs text-soft-text-soft">
                  {peerTyping
                    ? "Курьер печатает…"
                    : `${messages.length} сообщений`}
                </p>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-soft-text-soft hover:text-soft-text text-2xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px]"
            >
              {messages.length === 0 ? (
                <p className="text-center text-soft-text-soft text-sm py-8">
                  Пока нет сообщений 👋
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderType === "USER";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${mine ? "bg-soft-accent text-white rounded-br-sm" : "bg-soft-surface-2 border border-soft-border text-soft-text rounded-bl-sm"} ${m.imageUrl ? "p-1.5" : ""}`}
                      >
                        {m.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.imageUrl}
                            alt="Фото"
                            className="rounded-xl max-w-[220px] max-h-[220px] object-cover"
                          />
                        ) : null}
                        {m.text ? (
                          <div
                            className={`whitespace-pre-wrap break-words ${m.imageUrl ? "mt-1.5 px-1.5" : ""}`}
                          >
                            {m.text}
                          </div>
                        ) : null}
                        <div
                          className={`text-[10px] mt-0.5 ${m.imageUrl ? "px-1.5 pb-0.5" : ""} ${mine ? "text-white/70" : "text-soft-text-muted"}`}
                        >
                          {new Date(m.createdAt).toLocaleTimeString("ru", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {mine && m.readAt ? " · прочитано" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-soft-border flex gap-2">
              {/* ⭐ NEW: отправка фото (например, у двери при бесконтактной доставке) */}
              <label
                className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-soft-border bg-soft-surface-2 cursor-pointer ${sendingPhoto ? "opacity-50 pointer-events-none" : "hover:bg-soft-surface-3"}`}
              >
                {sendingPhoto ? "…" : "📷"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={sendingPhoto}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) sendPhoto(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitMessage()}
                placeholder="Введите сообщение…"
                className="flex-1 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-soft-accent"
                maxLength={1000}
              />
              <button
                onClick={submitMessage}
                className="bg-soft-accent hover:bg-soft-accent-dark text-white font-bold rounded-xl px-4"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-soft-text-soft">{label}</span>
      <span className="text-soft-text font-bold">{value}</span>
    </div>
  );
}
