// dastbadast-multivendor-web/app/(main)/support/page.tsx
"use client";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  START_SUPPORT_THREAD,
  GET_SUPPORT_MESSAGES,
  SEND_SUPPORT_MESSAGE,
  SUB_SUPPORT_MESSAGE,
  MARK_SUPPORT_READ,
} from "@/lib/queries";
import { ChevronLeft, Send, Loader2, MessageCircle } from "lucide-react";

type Msg = {
  id: string;
  senderType: "USER" | "RIDER" | "RESTAURANT" | "OWNER";
  senderName?: string | null;
  text: string;
  imageUrl?: string | null;
  readByStaff?: boolean;
  createdAt: string;
};

// ⭐ Список вопросов бота — поменяйте текст под себя, структура не трогается.
const FAQ_ITEMS: { id: string; q: string; a: string }[] = [
  {
    id: "late",
    q: "Заказ задерживается",
    a: "Приносим извинения за задержку! Курьеры иногда попадают в пробки или ждут заказ на кухне. Обычно доставка занимает до 60 минут с момента подтверждения. Если прошло больше — позовите оператора, поможем разобраться прямо сейчас.",
  },
  {
    id: "wrong",
    q: "Привезли не тот заказ / не хватает позиций",
    a: "Сожалеем об ошибке! Опишите оператору, чего не хватает или что перепутали — оформим возврат или досылку недостающих позиций.",
  },
  {
    id: "payment",
    q: "Проблема с оплатой",
    a: "Если деньги списались, а заказ не оформился — не переживайте, средства автоматически возвращаются в течение 1-3 дней. Если нужна помощь прямо сейчас — позовите оператора.",
  },
  {
    id: "cancel",
    q: "Хочу отменить заказ",
    a: "Если заказ ещё не принят рестораном — отменить можно из истории заказов. Если ресторан уже начал готовить — позовите оператора, решим индивидуально.",
  },
  {
    id: "other",
    q: "Другой вопрос",
    a: "Опишите, пожалуйста, подробнее — позовите оператора, и мы поможем.",
  },
];

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}

function SupportPageInner() {
  const { user, token, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  // Если пришли по конкретному заказу — бот не нужен, сразу к оператору.
  const [mode, setMode] = useState<"bot" | "chat">(orderId ? "chat" : "bot");

  if (!authLoading && (!user || !token)) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-soft-accent-soft text-soft-accent flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-extrabold text-soft-text mb-2">
          Нужно войти
        </h1>
        <p className="text-sm text-soft-text-soft mb-5">
          Чтобы написать в поддержку через сайт, сначала войдите в аккаунт.
        </p>
        <Link
          href="/login"
          className="inline-flex bg-soft-accent text-white font-extrabold px-5 py-2.5 rounded-full text-sm"
        >
          Войти
        </Link>
      </div>
    );
  }

  if (mode === "bot") {
    return <SupportBot onCallOperator={() => setMode("chat")} />;
  }
  return <SupportChat orderId={orderId} />;
}

/* ============================== Бот ============================== */

function SupportBot({ onCallOperator }: { onCallOperator: () => void }) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const opened = FAQ_ITEMS.find((f) => f.id === openedId) || null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> Помощь
      </Link>

      <div className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-soft-border">
          <h1 className="font-extrabold text-lg text-soft-text">
            💬 Поддержка
          </h1>
          <p className="text-xs text-soft-text-muted">Помощник Dastbadast</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="max-w-[85%] bg-soft-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
            <p className="text-sm text-soft-text">
              Привет 👋 Выберите вопрос, который ближе всего к вашей ситуации —
              попробую помочь сразу. Если не поможет — соединю с оператором.
            </p>
          </div>

          {!opened ? (
            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setOpenedId(item.id)}
                  className="w-full text-left bg-soft-surface border border-soft-border rounded-2xl px-4 py-3 hover:border-soft-accent transition-colors"
                >
                  <span className="text-sm font-semibold text-soft-text">
                    {item.q}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-w-[85%] bg-soft-accent-soft border border-soft-accent/20 rounded-2xl rounded-bl-sm px-4 py-3">
                <p className="text-sm text-soft-text">{opened.a}</p>
              </div>

              <button
                onClick={() => setOpenedId(null)}
                className="w-full bg-soft-surface-2 rounded-2xl px-4 py-3 text-center hover:bg-soft-border/40 transition-colors"
              >
                <span className="text-sm font-bold text-soft-text">
                  Спасибо, помогло 🙌
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-soft-border">
          <button
            onClick={onCallOperator}
            className="w-full h-12 rounded-2xl bg-soft-accent text-white font-extrabold text-sm hover:bg-soft-accent-dark transition-colors"
          >
            {opened
              ? "Не помогло — позвать оператора"
              : "Сразу позвать оператора"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Живой чат ============================ */

function SupportChat({ orderId }: { orderId: string | null }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [agent, setAgent] = useState<{
    name?: string | null;
    avatar?: string | null;
  } | null>(null);
  const [starting, setStarting] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [startThread] = useMutation<{
    startSupportThread: {
      id: string;
      assignedOwnerName?: string | null;
      assignedOwnerAvatar?: string | null;
    };
  }>(START_SUPPORT_THREAD);
  const [sendMessage] = useMutation(SEND_SUPPORT_MESSAGE);
  const [markRead] = useMutation(MARK_SUPPORT_READ);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await startThread({
          variables: { orderId: orderId || null },
        });
        const t = data?.startSupportThread;
        if (!cancelled) {
          setThreadId(t?.id ?? null);
          setAgent(
            t?.assignedOwnerName
              ? { name: t.assignedOwnerName, avatar: t.assignedOwnerAvatar }
              : null,
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const { data, loading, refetch } = useQuery<{ supportMessages: Msg[] }>(
    GET_SUPPORT_MESSAGES,
    { variables: { threadId }, skip: !threadId, fetchPolicy: "network-only" },
  );

  useSubscription(SUB_SUPPORT_MESSAGE, {
    variables: { threadId: threadId || "" },
    skip: !threadId,
    onData: () => {
      refetch();
      if (threadId) markRead({ variables: { threadId } }).catch(() => {});
    },
  });

  useEffect(() => {
    if (!threadId) return;
    markRead({ variables: { threadId } }).catch(() => {});
  }, [threadId, markRead]);

  const messages = useMemo(
    () =>
      (data?.supportMessages ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [data],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || sending || !threadId) return;
    setSending(true);
    setText("");
    try {
      await sendMessage({ variables: { threadId, text: t } });
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Не удалось отправить сообщение");
      setText(t);
    } finally {
      setSending(false);
    }
  }, [text, sending, threadId, sendMessage, refetch]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> Помощь
      </Link>

      <div className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm flex flex-col h-[70vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-soft-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-soft-accent-soft flex items-center justify-center overflow-hidden shrink-0">
            {agent?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.avatar}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-soft-accent font-extrabold text-base">
                {agent?.name ? agent.name[0].toUpperCase() : "D"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-base text-soft-text truncate">
              {agent?.name || "Поддержка Dastbadast"}
            </h1>
            <p className="text-xs text-soft-text-muted truncate">
              {agent?.name
                ? "обычно отвечает быстро"
                : orderId
                  ? `По заказу #${orderId.slice(-6)}`
                  : "мы онлайн"}
            </p>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {starting || (loading && messages.length === 0) ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 text-soft-accent animate-spin mx-auto" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-soft-text-muted text-center py-10">
              Опишите свой вопрос — мы ответим как можно скорее 👋
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
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                      mine
                        ? "bg-soft-accent text-white rounded-br-sm"
                        : "bg-soft-surface-2 text-soft-text rounded-bl-sm"
                    }`}
                  >
                    {!mine && (
                      <p className="text-2xs font-bold opacity-70 mb-0.5">
                        {m.senderType === "OWNER"
                          ? agent?.name || "Поддержка"
                          : m.senderName}
                      </p>
                    )}
                    <p>{m.text}</p>
                    <p
                      className={`text-2xs mt-0.5 ${
                        mine ? "text-white/70" : "text-soft-text-muted"
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString("ru", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {mine && (m.readByStaff ? " ✓✓" : " ✓")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-soft-border flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Опишите проблему…"
            rows={1}
            disabled={!threadId}
            className="flex-1 resize-none bg-soft-surface-2 border border-soft-border rounded-2xl px-3.5 py-2.5 text-sm text-soft-text max-h-28"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim() || !threadId}
            className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-colors ${
              sending || !text.trim() || !threadId
                ? "bg-soft-surface-2 text-soft-text-muted"
                : "bg-soft-accent text-white hover:bg-soft-accent-dark"
            }`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
