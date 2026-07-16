// dastbadast-multivendor-api/src/resolvers/contact-change.js
//
// ⭐ Смена email и телефона: и то, и другое можно менять в любой момент,
// но новый адрес/номер обязательно подтверждается кодом (email — письмо,
// телефон — SMS), прежде чем реально применится. До подтверждения новое
// значение лежит в pendingEmail/pendingPhone и не заменяет текущее.

import { GraphQLError } from "graphql";
import { User } from "../models/User.js";
import { requestOtp, verifyOtp, checkOtpRequestLimit } from "../lib/otp.js";

const EMAIL_CHANGE_PURPOSE = "email-change";
const PHONE_CHANGE_PURPOSE = "phone-change";
const TJ_PHONE_REGEX = /^\+992\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.user;
}

function minutes(sec) {
  return Math.max(1, Math.ceil((sec || 60) / 60));
}

function lockedError() {
  return new GraphQLError(
    "Слишком много неверных попыток ввода кода. Запросите код повторно.",
    { extensions: { code: "OTP_LOCKED" } },
  );
}

/* ================== EMAIL ================== */

export const requestEmailChange = async (_p, { newEmail }, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const email = String(newEmail || "")
    .trim()
    .toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new GraphQLError("Некорректный email", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (email === (user.email || "").toLowerCase()) {
    throw new GraphQLError("Это уже ваш текущий email", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const exists = await User.findOne({ email });
  if (exists && exists._id.toString() !== user._id.toString()) {
    throw new GraphQLError("Этот email уже используется", {
      extensions: { code: "CONFLICT" },
    });
  }

  const limit = await checkOtpRequestLimit(email, ctx?.ip);
  if (!limit.allowed) {
    throw new GraphQLError(
      `Слишком много попыток. Повторите через ${minutes(limit.resetInSec)} мин.`,
      { extensions: { code: "RATE_LIMITED", resetInSec: limit.resetInSec } },
    );
  }

  user.pendingEmail = email;
  await user.save();

  return requestOtp(email, EMAIL_CHANGE_PURPOSE, "email");
};

export const confirmEmailChange = async (_p, { code }, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!user.pendingEmail) {
    throw new GraphQLError("Нет заявки на смену email", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const result = await verifyOtp(user.pendingEmail, EMAIL_CHANGE_PURPOSE, code);
  if (!result.ok) {
    if (result.locked) throw lockedError();
    throw new GraphQLError(
      `Неверный код. Осталось попыток: ${result.attemptsLeft}`,
      {
        extensions: { code: "INVALID_OTP", attemptsLeft: result.attemptsLeft },
      },
    );
  }

  const exists = await User.findOne({ email: user.pendingEmail });
  if (exists && exists._id.toString() !== user._id.toString()) {
    user.pendingEmail = null;
    await user.save();
    throw new GraphQLError("Этот email уже занят другим пользователем", {
      extensions: { code: "CONFLICT" },
    });
  }

  user.email = user.pendingEmail;
  user.emailVerifiedAt = new Date();
  user.pendingEmail = null;
  await user.save();
  return user;
};

export const cancelEmailChange = async (_p, _a, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) return false;
  user.pendingEmail = null;
  await user.save();
  return true;
};

/* ================== ТЕЛЕФОН ================== */

export const requestPhoneChange = async (_p, { newPhone }, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const phone = String(newPhone || "")
    .replace(/[\s\-()]/g, "")
    .trim();
  if (!TJ_PHONE_REGEX.test(phone)) {
    throw new GraphQLError(
      "Формат: +992 и ровно 9 цифр (например +992901234567)",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  if (phone === user.phone) {
    throw new GraphQLError("Это уже ваш текущий номер", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const exists = await User.findOne({ phone });
  if (exists && exists._id.toString() !== user._id.toString()) {
    throw new GraphQLError("Этот номер уже используется", {
      extensions: { code: "CONFLICT" },
    });
  }

  const limit = await checkOtpRequestLimit(phone, ctx?.ip);
  if (!limit.allowed) {
    throw new GraphQLError(
      `Слишком много попыток. Повторите через ${minutes(limit.resetInSec)} мин.`,
      { extensions: { code: "RATE_LIMITED", resetInSec: limit.resetInSec } },
    );
  }

  user.pendingPhone = phone;
  await user.save();

  return requestOtp(phone, PHONE_CHANGE_PURPOSE); // channel по умолчанию "sms"
};

export const confirmPhoneChange = async (_p, { code }, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!user.pendingPhone) {
    throw new GraphQLError("Нет заявки на смену номера", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const result = await verifyOtp(user.pendingPhone, PHONE_CHANGE_PURPOSE, code);
  if (!result.ok) {
    if (result.locked) throw lockedError();
    throw new GraphQLError(
      `Неверный код. Осталось попыток: ${result.attemptsLeft}`,
      {
        extensions: { code: "INVALID_OTP", attemptsLeft: result.attemptsLeft },
      },
    );
  }

  const exists = await User.findOne({ phone: user.pendingPhone });
  if (exists && exists._id.toString() !== user._id.toString()) {
    user.pendingPhone = null;
    await user.save();
    throw new GraphQLError("Этот номер уже занят другим пользователем", {
      extensions: { code: "CONFLICT" },
    });
  }

  user.phone = user.pendingPhone;
  user.phoneVerifiedAt = new Date();
  user.pendingPhone = null;
  await user.save();
  return user;
};

export const cancelPhoneChange = async (_p, _a, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) return false;
  user.pendingPhone = null;
  await user.save();
  return true;
};
