// dastbadast-multivendor-api/src/resolvers/support.js
//
// ⭐ NEW: чат поддержки. Отвечают за него Owner-аккаунты с ролью
// SUPPORT (или SUPER_ADMIN, у которого есть доступ ко всему — см. rbac.js).
//
// Кто может писать в тред:
//   - участник (USER / RIDER / RESTAURANT), которому принадлежит тред
//   - сотрудник поддержки (ctx.owner, роль SUPPORT/SUPER_ADMIN) — любой тред
//
// Общий тред на участника (orderId = null) создаётся/переиспользуется через
// upsert в startSupportThread. Тред по заказу — то же самое, но с orderId.
import { GraphQLError } from "graphql";
import { SupportThread } from "../models/SupportThread.js";
import { SupportMessage } from "../models/SupportMessage.js";
import { Order } from "../models/Order.js";
import { pubsub, TOPICS } from "../pubsub.js";
import { requireRole } from "../middleware/rbac.js";

const STAFF_ROLES = ["SUPPORT"]; // SUPER_ADMIN проходит requireRole всегда

function requireStaff(ctx) {
  return requireRole(STAFF_ROLES)(ctx);
}

// Определяем, от чьего лица говорит текущий ctx (клиент/курьер/ресторан).
function resolveParticipant(ctx) {
  if (ctx.user) {
    return {
      participantType: "USER",
      participantId: ctx.user._id,
      participantName: ctx.user.name || ctx.user.phone || "Клиент",
    };
  }
  if (ctx.rider) {
    return {
      participantType: "RIDER",
      participantId: ctx.rider._id,
      participantName: ctx.rider.name || ctx.rider.username || "Курьер",
    };
  }
  if (ctx.restaurant) {
    return {
      participantType: "RESTAURANT",
      participantId: ctx.restaurant._id,
      participantName: ctx.restaurant.name || "Ресторан",
    };
  }
  return null;
}

// Проверяет, что orderId (если передан) действительно относится к этому участнику.
async function assertOrderBelongsToParticipant(orderId, participant) {
  if (!orderId) return;
  const order = await Order.findById(orderId);
  if (!order) {
    throw new GraphQLError("Заказ не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  const ok =
    (participant.participantType === "USER" &&
      order.userId?.toString() === participant.participantId.toString()) ||
    (participant.participantType === "RIDER" &&
      order.riderId?.toString() === participant.participantId.toString()) ||
    (participant.participantType === "RESTAURANT" &&
      order.restaurantId?.toString() === participant.participantId.toString());
  if (!ok) {
    throw new GraphQLError("Этот заказ вам не принадлежит", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

// Проверяет доступ к треду: либо это владелец-участник, либо сотрудник поддержки.
async function canAccessThread(ctx, threadId) {
  const thread = await SupportThread.findById(threadId);
  if (!thread) {
    throw new GraphQLError("Тред не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (ctx.owner) {
    requireStaff(ctx); // кинет, если роль/статус не подходят
    return { thread, asStaff: true };
  }
  const participant = resolveParticipant(ctx);
  if (
    participant &&
    thread.participantType === participant.participantType &&
    thread.participantId.toString() === participant.participantId.toString()
  ) {
    return { thread, asStaff: false, participant };
  }
  throw new GraphQLError("Нет доступа к этому треду", {
    extensions: { code: "FORBIDDEN" },
  });
}

function publishInboxUpdate(thread) {
  pubsub.publish(TOPICS.SUPPORT_INBOX, { supportInboxUpdated: thread });
}

/* ============================== Queries ============================== */

// Список своих тредов (участник) — на будущее, если понадобится "Мои обращения".
export const mySupportThreads = async (_p, _a, ctx) => {
  const participant = resolveParticipant(ctx);
  if (!participant) {
    throw new GraphQLError("Не авторизован", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return SupportThread.find({
    participantType: participant.participantType,
    participantId: participant.participantId,
  }).sort({ lastMessageAt: -1, createdAt: -1 });
};

export const supportThread = async (_p, { id }, ctx) => {
  const { thread } = await canAccessThread(ctx, id);
  return thread;
};

export const supportMessages = async (_p, { threadId }, ctx) => {
  await canAccessThread(ctx, threadId);
  return SupportMessage.find({ threadId }).sort({ createdAt: 1 }).limit(500);
};

// Инбокс поддержки (админка): список тредов с фильтрами.
export const supportThreads = async (
  _p,
  { status, assignedToMe, showAll, search },
  ctx,
) => {
  const owner = requireStaff(ctx);
  const filter = {};
  if (status) filter.status = status;

  if (assignedToMe) {
    filter.assignedOwnerId = owner._id;
  } else if (!showAll) {
    // Скрываем треды, которые уже взял в работу кто-то другой —
    // виден либо ничей тред, либо свой.
    filter.$or = [{ assignedOwnerId: null }, { assignedOwnerId: owner._id }];
  }
  // showAll — только для аудита (например SUPER_ADMIN), видно вообще всё

  if (search && search.trim()) {
    const rx = new RegExp(search.trim(), "i");
    filter.$and = [
      ...(filter.$or ? [{ $or: filter.$or }] : []),
      { $or: [{ participantName: rx }, { lastMessagePreview: rx }] },
    ];
    delete filter.$or;
  }

  return SupportThread.find(filter)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(300);
};

/* ============================= Mutations =============================== */

export const startSupportThread = async (_p, { orderId, subject }, ctx) => {
  const participant = resolveParticipant(ctx);
  if (!participant) {
    throw new GraphQLError("Не авторизован", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  await assertOrderBelongsToParticipant(orderId, participant);

  const filter = {
    participantType: participant.participantType,
    participantId: participant.participantId,
    orderId: orderId || null,
  };

  // Ищем только ОТКРЫТЫЙ тред. Закрытый — архив, его не переиспользуем.
  let thread = await SupportThread.findOne({ ...filter, status: "OPEN" });

  if (!thread) {
    thread = await SupportThread.create({
      ...filter,
      participantName: participant.participantName,
      subject: subject || "",
      status: "OPEN",
    });
  }

  return thread;
};

export const sendSupportMessage = async (
  _p,
  { threadId, text, imageUrl },
  ctx,
) => {
  const trimmed = (text || "").trim();
  const photo = (imageUrl || "").trim();
  if (!trimmed && !photo) {
    throw new GraphQLError("Пустое сообщение", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const { thread, asStaff, participant } = await canAccessThread(ctx, threadId);
  if (thread.status === "CLOSED") {
    throw new GraphQLError("Тред закрыт — это архив, писать в него нельзя", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  let senderType, senderId, senderName, senderAvatar;
  if (asStaff) {
    senderType = "OWNER";
    senderId = ctx.owner._id;
    senderName = ctx.owner.email || ctx.owner.name;
    senderAvatar = ctx.owner.avatarUrl || null;
    // Первый ответ сотрудника автоматически "забирает" тред, если он ничей.
    if (!thread.assignedOwnerId) {
      thread.assignedOwnerId = ctx.owner._id;
    }
  }

  const msg = await SupportMessage.create({
    threadId,
    senderType,
    senderId,
    senderName,
    senderAvatar,
    text: trimmed,
    imageUrl: photo || null,
  });

  thread.lastMessageAt = msg.createdAt;
  thread.lastMessagePreview = photo && !trimmed ? "📷 Фото" : trimmed;
  thread.lastSenderType = senderType;
  await thread.save();

  pubsub.publish(TOPICS.SUPPORT_THREAD(threadId.toString()), {
    newSupportMessage: msg,
  });
  publishInboxUpdate(thread);

  return msg;
};

export const assignSupportThread = async (_p, { threadId }, ctx) => {
  const owner = requireStaff(ctx);
  const thread = await SupportThread.findById(threadId);
  if (!thread) {
    throw new GraphQLError("Тред не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  thread.assignedOwnerId = owner._id;
  thread.assignedOwnerName = owner.name || owner.email;
  thread.assignedOwnerAvatar = owner.avatarUrl || null;
  await thread.save();
  publishInboxUpdate(thread);
  return thread;
};

export const closeSupportThread = async (_p, { threadId }, ctx) => {
  const owner = requireStaff(ctx);
  const thread = await SupportThread.findById(threadId);
  if (!thread)
    throw new GraphQLError("Тред не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  thread.status = "CLOSED";
  thread.closedByOwnerId = owner._id;
  thread.closedByName = owner.name || owner.email;
  await thread.save();
  publishInboxUpdate(thread);
  return thread;
};

export const reopenSupportThread = async () => {
  throw new GraphQLError("Закрытые треды нельзя открыть повторно — это архив", {
    extensions: { code: "FORBIDDEN" },
  });
};

export const markSupportRead = async (_p, { threadId }, ctx) => {
  const { thread, asStaff } = await canAccessThread(ctx, threadId);
  const now = new Date();
  if (asStaff) {
    thread.staffReadAt = now;
  } else {
    thread.participantReadAt = now;
  }
  await thread.save();
  return true;
};

/* ============================= Field resolvers =========================== */

export const supportThreadUnreadForStaff = (thread) =>
  !!thread.lastMessageAt &&
  (!thread.staffReadAt || thread.lastMessageAt > thread.staffReadAt);

export const supportThreadUnreadForParticipant = (thread) =>
  !!thread.lastMessageAt &&
  (!thread.participantReadAt ||
    thread.lastMessageAt > thread.participantReadAt);
