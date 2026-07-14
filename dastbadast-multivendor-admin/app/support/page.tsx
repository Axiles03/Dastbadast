"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import {
  GET_SUPPORT_THREADS,
  GET_SUPPORT_MESSAGES,
  SEND_SUPPORT_MESSAGE,
  ASSIGN_SUPPORT_THREAD,
  CLOSE_SUPPORT_THREAD,
  REOPEN_SUPPORT_THREAD,
  MARK_SUPPORT_READ,
  SUB_NEW_SUPPORT_MESSAGE,
  SUB_SUPPORT_INBOX,
} from "@/lib/queries";
import {
  Loader2,
  Send,
  CheckCircle2,
  RotateCcw,
  UserCheck,
} from "lucide-react";

type SupportThread = {
  assignedOwnerAvatar: any;
  assignedOwnerName: any;
  closedByName: string;
  id: string;
  participantType: "USER" | "RIDER" | "RESTAURANT";
  participantName?: string | null;
  orderId?: string | null;
  subject?: string | null;
  status: "OPEN" | "CLOSED";
  assignedOwnerId?: string | null;
  assignedOwnerEmail?: string | null;
  participantAvatar?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadForStaff: boolean;
  createdAt: string;
};

type SupportMessage = {
  id: string;
  threadId: string;
  senderType: "USER" | "RIDER" | "RESTAURANT" | "OWNER";
  senderName?: string | null;
  senderAvatar?: string | null;
  text: string;
  imageUrl?: string | null;
  readByParticipant: boolean;
  createdAt: string;
};

const PARTICIPANT_LABEL: Record<string, string> = {
  USER: "Клиент",
  RIDER: "Курьер",
  RESTAURANT: "Ресторан",
};

export default function SupportPage() {
  return (
    <RoleGate allowedRoles={["SUPER_ADMIN", "SUPPORT"]}>
      <SupportInbox />
    </RoleGate>
  );
}

function SupportInbox() {
  const { owner } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED">("OPEN");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{
    supportThreads: SupportThread[];
  }>(GET_SUPPORT_THREADS, {
    variables: {
      status: statusFilter,
      assignedToMe: onlyMine,
      showAll,
      search: search || null,
    },
    fetchPolicy: "cache-and-network",
    pollInterval: 20_000,
  });

  // ⭐ Живое обновление списка при любом событии (новый тред/сообщение/assign/close)
  useSubscription(SUB_SUPPORT_INBOX, {
    onData: () => refetch(),
  });

  const threads = data?.supportThreads ?? [];

  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [threads, activeId]);

  const activeThread = threads.find((t) => t.id === activeId) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-140px)]">
      {/* ──────── Список тредов ──────── */}
      <div className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-soft-border">
          <h1 className="text-lg font-extrabold text-soft-text mb-3">
            Поддержка
          </h1>
          <div className="flex gap-1.5 mb-2">
            {(["OPEN", "CLOSED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                  statusFilter === s
                    ? "bg-soft-accent text-white"
                    : "bg-soft-surface-2 text-soft-text-soft"
                }`}
              >
                {s === "OPEN" ? "Открытые" : "Закрытые"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-soft-text-soft cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="rounded"
            />
            Только мои
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или тексту…"
            className="w-full text-xs bg-soft-surface-2 border border-soft-border rounded-full px-3 py-1.5 mt-2"
          />
          {owner?.userType === "SUPER_ADMIN" && (
            <label className="flex items-center gap-2 text-xs font-semibold text-soft-text-soft cursor-pointer select-none mt-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded"
              />
              Показать все (включая занятые другими)
            </label>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && threads.length === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-soft-accent animate-spin mx-auto" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-sm text-soft-text-muted text-center p-8">
              Нет обращений
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-soft-border/60 transition-colors ${
                  activeId === t.id
                    ? "bg-soft-accent-soft"
                    : "hover:bg-soft-surface-2"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-soft-surface-2 flex items-center justify-center overflow-hidden shrink-0">
                    {t.participantAvatar ? (
                      <img
                        src={t.participantAvatar}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-soft-text-soft font-extrabold text-sm">
                        {(t.participantName || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-soft-text-muted">
                        {PARTICIPANT_LABEL[t.participantType] ||
                          t.participantType}
                        {t.orderId ? " · заказ" : ""}
                      </span>
                      {t.unreadForStaff && (
                        <span className="w-2 h-2 rounded-full bg-soft-accent shrink-0" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-soft-text truncate mt-0.5">
                      {t.participantName || "Без имени"}
                    </p>
                    <p className="text-xs text-soft-text-soft truncate mt-0.5">
                      {t.lastMessagePreview || "Нет сообщений"}
                    </p>
                    {t.status === "CLOSED"
                      ? t.closedByName && (
                          <p className="text-2xs text-soft-text-muted mt-1 truncate">
                            Закрыл: {t.closedByName}
                          </p>
                        )
                      : t.assignedOwnerName && (
                          <p className="text-2xs text-soft-text-muted mt-1 truncate">
                            Взял в работу: {t.assignedOwnerName}
                          </p>
                        )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ──────── Чат-панель ──────── */}
      <div className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm flex flex-col overflow-hidden">
        {activeThread ? (
          <ThreadPanel
            key={activeThread.id}
            thread={activeThread}
            myOwnerId={owner?.id}
            onThreadChanged={refetch}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-soft-text-muted">
            Выберите обращение слева
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadPanel({
  thread,
  myOwnerId,
  onThreadChanged,
}: {
  thread: SupportThread;
  myOwnerId?: string;
  onThreadChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, loading, refetch } = useQuery<{
    supportMessages: SupportMessage[];
  }>(GET_SUPPORT_MESSAGES, {
    variables: { threadId: thread.id },
    fetchPolicy: "network-only",
  });

  const [sendMessage] = useMutation(SEND_SUPPORT_MESSAGE);
  const [assignThread] = useMutation(ASSIGN_SUPPORT_THREAD);
  const [closeThread] = useMutation(CLOSE_SUPPORT_THREAD);
  const [reopenThread] = useMutation(REOPEN_SUPPORT_THREAD);
  const [markRead] = useMutation(MARK_SUPPORT_READ);

  useSubscription(SUB_NEW_SUPPORT_MESSAGE, {
    variables: { threadId: thread.id },
    onData: () => refetch(),
  });

  useEffect(() => {
    markRead({ variables: { threadId: thread.id } }).catch(() => {});
  }, [thread.id, markRead]);

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
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      await sendMessage({ variables: { threadId: thread.id, text: t } });
      await refetch();
      onThreadChanged();
    } catch (e: any) {
      alert(e?.message ?? "Не удалось отправить сообщение");
      setText(t);
    } finally {
      setSending(false);
    }
  }, [text, sending, sendMessage, thread.id, refetch, onThreadChanged]);

  const isMine = thread.assignedOwnerId === myOwnerId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-soft-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-soft-surface-2 flex items-center justify-center overflow-hidden shrink-0">
            {thread.participantAvatar ? (
              <img
                src={thread.participantAvatar}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-soft-text-soft font-extrabold text-sm">
                {(thread.participantName || "?")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-soft-text truncate">
              {PARTICIPANT_LABEL[thread.participantType] ||
                thread.participantType}
              {" · "}
              {thread.participantName || "Без имени"}
            </p>
            <p className="text-xs text-soft-text-muted truncate">
              {thread.orderId
                ? `По заказу #${thread.orderId.slice(-6)}`
                : "Общий тред"}
              {thread.status === "CLOSED"
                ? ` · закрыл: ${thread.closedByName || "—"}`
                : thread.assignedOwnerName
                  ? ` · работает: ${thread.assignedOwnerName}`
                  : " · никто не взял"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMine && (
            <button
              onClick={async () => {
                await assignThread({ variables: { threadId: thread.id } });
                onThreadChanged();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-soft-info-soft text-soft-info hover:bg-soft-info hover:text-white transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Взять в работу
            </button>
          )}
          {thread.status === "OPEN" ? (
            <button
              onClick={async () => {
                await closeThread({ variables: { threadId: thread.id } });
                onThreadChanged();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-soft-success-soft text-soft-success hover:bg-soft-success hover:text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Закрыть
            </button>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && messages.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 text-soft-accent animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-soft-text-muted text-center py-8">
            Сообщений пока нет
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderType === "OWNER";
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm ${
                    mine
                      ? "bg-soft-accent text-white rounded-br-sm"
                      : "bg-soft-surface-2 text-soft-text rounded-bl-sm"
                  }`}
                >
                  {!mine && (
                    <p className="text-2xs font-bold opacity-70 mb-0.5">
                      {m.senderName}
                    </p>
                  )}
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt="Фото"
                      className="rounded-xl mb-1 max-w-full"
                    />
                  )}
                  {m.text && <p>{m.text}</p>}
                  <p
                    className={`text-2xs mt-0.5 ${
                      mine ? "text-white/70" : "text-soft-text-muted"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString("ru", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine && (m.readByParticipant ? " ✓✓" : " ✓")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {thread.status === "CLOSED" ? (
        <div className="p-4 border-t border-soft-border bg-soft-surface-2 text-center">
          <p className="text-xs font-semibold text-soft-text-muted">
            Тред закрыт — архив, только для просмотра
          </p>
        </div>
      ) : (
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
            placeholder="Ответ клиенту…"
            rows={1}
            className="flex-1 resize-none bg-soft-surface-2 border border-soft-border rounded-2xl px-3.5 py-2.5 text-sm text-soft-text max-h-28"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-colors ${
              sending || !text.trim()
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
      )}
    </div>
  );
}
