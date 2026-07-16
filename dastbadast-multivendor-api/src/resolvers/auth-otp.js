// dastbadast-multivendor-api/src/resolvers/auth-otp.js
//
// ⭐ Шаг 1: OTP-аутентификация по номеру телефона.
// ⭐ Шаг 2: Защита от взлома — rate limit на запрос кода (номер + IP),
//           лимит неверных попыток ввода (после исчерпания — блокировка),
//           rate limit на попытки входа по паролю (защита от подбора пароля).
//
//   requestOtp           — сгенерировать код и «отправить» (mock SMS)
//   registerWithPhone    — подтвердить код (purpose=register) → создать юзера → JWT
//   loginWithOtp         — подтвердить код (purpose=login) → JWT существующему юзеру
//   loginWithPassword    — обычный вход: телефон + пароль
//   resetPasswordWithOtp — подтвердить код (purpose=reset) → установить новый пароль → JWT

import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import {
  requestOtp as sendOtp,
  verifyOtp,
  checkOtpRequestLimit,
} from "../lib/otp.js";
import { checkRateLimit } from "../utils/redis.js";

const TJ_PHONE_REGEX = /^\+992\d{9}$/;

// ⭐ Шаг 2: лимит на попытки входа по паролю (защита от брутфорса)
const LOGIN_PASSWORD_LIMIT = { maxRequests: 8, windowSeconds: 10 * 60 };

function normalizePhone(phone) {
  const cleaned = String(phone || "").replace(/[\s\-()]/g, "");
  if (!TJ_PHONE_REGEX.test(cleaned)) {
    throw new GraphQLError(
      "Телефон должен быть в формате +992 и ровно 9 цифр (например +992901234567)",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  return cleaned;
}

function minutes(sec) {
  return Math.max(1, Math.ceil((sec || 60) / 60));
}

function throwRateLimited(resetInSec) {
  throw new GraphQLError(
    `Слишком много попыток. Повторите через ${minutes(resetInSec)} мин.`,
    { extensions: { code: "RATE_LIMITED", resetInSec } },
  );
}

function throwOtpResult(result) {
  if (result.locked) {
    throw new GraphQLError(
      "Слишком много неверных попыток ввода кода. Запросите код повторно.",
      { extensions: { code: "OTP_LOCKED" } },
    );
  }
  throw new GraphQLError(
    `Неверный код. Осталось попыток: ${result.attemptsLeft}`,
    {
      extensions: { code: "INVALID_OTP", attemptsLeft: result.attemptsLeft },
    },
  );
}

// GraphQL enum OtpPurpose (REGISTER|LOGIN|RESET) → внутренний ключ Redis
const PURPOSE_MAP = { REGISTER: "register", LOGIN: "login", RESET: "reset" };

function purposeKey(purpose) {
  const key = PURPOSE_MAP[purpose];
  if (!key) {
    throw new GraphQLError("Некорректный тип OTP", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return key;
}

export const requestOtpMutation = async (_p, { phone, purpose }, ctx) => {
  const cleaned = normalizePhone(phone);
  const key = purposeKey(purpose);

  const existing = await User.findOne({ phone: cleaned });

  if (key === "register" && existing) {
    throw new GraphQLError("Пользователь с таким номером уже зарегистрирован", {
      extensions: { code: "CONFLICT" },
    });
  }
  if ((key === "login" || key === "reset") && !existing) {
    throw new GraphQLError("Пользователь с таким номером не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  // ⭐ Шаг 2: не даём спамить SMS — лимит на номер и на IP
  const limit = await checkOtpRequestLimit(cleaned, ctx?.ip);
  if (!limit.allowed) {
    throwRateLimited(limit.resetInSec);
  }

  return sendOtp(cleaned, key);
};

export const registerWithPhone = async (_p, { phone, code }) => {
  const cleaned = normalizePhone(phone);

  const exists = await User.findOne({ phone: cleaned });
  if (exists) {
    throw new GraphQLError("Пользователь с таким номером уже зарегистрирован", {
      extensions: { code: "CONFLICT" },
    });
  }

  const result = await verifyOtp(cleaned, "register", code);
  if (!result.ok) throwOtpResult(result);

  // ⭐ Имя/email/пароль и т.д. — на странице профиля после регистрации
  const user = await User.create({
    name: "Клиент",
    phone: cleaned,
    phoneVerifiedAt: new Date(),
  });

  const token = signToken(user);
  return { token, user };
};

export const loginWithOtp = async (_p, { phone, code }) => {
  const cleaned = normalizePhone(phone);
  const user = await User.findOne({ phone: cleaned });
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const result = await verifyOtp(cleaned, "login", code);
  if (!result.ok) throwOtpResult(result);

  if (user.isActive === false) {
    throw new GraphQLError("Аккаунт заблокирован. Обратитесь в поддержку.", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  if (!user.phoneVerifiedAt) {
    user.phoneVerifiedAt = new Date();
    await user.save();
  }

  const token = signToken(user);
  return { token, user };
};

export const loginWithPassword = async (_p, { phone, password }, ctx) => {
  const cleaned = normalizePhone(phone);

  // ⭐ Шаг 2: защита от подбора пароля — лимит попыток на номер (+ на IP, если есть)
  const limitByPhone = await checkRateLimit({
    key: `login-attempt:phone:${cleaned}`,
    ...LOGIN_PASSWORD_LIMIT,
  });
  if (!limitByPhone.allowed) throwRateLimited(limitByPhone.resetInSec);

  if (ctx?.ip) {
    const limitByIp = await checkRateLimit({
      key: `login-attempt:ip:${ctx.ip}`,
      maxRequests: 30,
      windowSeconds: 10 * 60,
    });
    if (!limitByIp.allowed) throwRateLimited(limitByIp.resetInSec);
  }

  const user = await User.findOne({ phone: cleaned });
  if (!user || !user.passwordHash) {
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new GraphQLError("Неверные данные", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  if (user.isActive === false) {
    throw new GraphQLError("Аккаунт заблокирован. Обратитесь в поддержку.", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  const token = signToken(user);
  return { token, user };
};

export const resetPasswordWithOtp = async (
  _p,
  { input: { phone, code, newPassword } },
) => {
  const cleaned = normalizePhone(phone);
  const user = await User.findOne({ phone: cleaned });
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const result = await verifyOtp(cleaned, "reset", code);
  if (!result.ok) throwOtpResult(result);

  if (String(newPassword).length < 6) {
    throw new GraphQLError("Пароль должен содержать минимум 6 символов", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  const token = signToken(user);
  return { token, user };
};
