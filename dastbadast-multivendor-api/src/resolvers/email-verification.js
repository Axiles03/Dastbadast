// dastbadast-multivendor-api/src/resolvers/email-verification.js
//
// ⭐ Шаг 3: подтверждение email.
//   requestEmailVerification — отправить код на email текущего пользователя
//   verifyEmail              — подтвердить код → emailVerifiedAt = now
//
// Переиспользует ту же инфраструктуру OTP (Redis/rate-limit/attempts),
// что и телефон — просто identifier теперь email, а не phone,
// и purpose = "email-verify".

import { GraphQLError } from "graphql";
import { User } from "../models/User.js";
import { requestOtp, verifyOtp, checkOtpRequestLimit } from "../lib/otp.js";

const EMAIL_VERIFY_PURPOSE = "email-verify";

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

export const requestEmailVerification = async (_p, _a, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!user.email) {
    throw new GraphQLError("Сначала укажите email в профиле", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (user.emailVerifiedAt) {
    throw new GraphQLError("Email уже подтверждён", {
      extensions: { code: "CONFLICT" },
    });
  }

  // ⭐ переиспользуем тот же rate-limit, что и для SMS-кодов (защита от спама писем)
  const limit = await checkOtpRequestLimit(user.email, ctx?.ip);
  if (!limit.allowed) {
    throw new GraphQLError(
      `Слишком много попыток. Повторите через ${minutes(limit.resetInSec)} мин.`,
      { extensions: { code: "RATE_LIMITED", resetInSec: limit.resetInSec } },
    );
  }

  return requestOtp(user.email, EMAIL_VERIFY_PURPOSE, "email");
};

export const verifyEmail = async (_p, { code }, ctx) => {
  const current = requireUser(ctx);
  const user = await User.findById(current._id);
  if (!user) {
    throw new GraphQLError("Пользователь не найден", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!user.email) {
    throw new GraphQLError("Email не указан", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const result = await verifyOtp(user.email, EMAIL_VERIFY_PURPOSE, code);
  if (!result.ok) {
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

  user.emailVerifiedAt = new Date();
  await user.save();
  return user;
};
