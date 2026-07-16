// dastbadast-multivendor-api/src/lib/otp.js
//
// ⭐ Шаг 1: OTP-верификация номера телефона.
// ⭐ Шаг 2: Защита от взлома —
//     - rate limit на запрос кода (на номер и на IP), чтобы не заспамить SMS
//     - лимит неверных попыток ввода (после MAX_VERIFY_ATTEMPTS — блокировка,
//       пока не запросят новый код)
//     - TTL кода (5 минут) — уже было в Шаге 1
//
// Архитектура:
//   1. Генерация  — случайный 4-значный код, TTL 5 минут
//   2. Отправка   — Mock-провайдер: код печатается в консоль сервера
//                   (в проде sendSms() меняется на Twilio/Nexmo/локальный SMS-шлюз)
//   3. Хранение   — Redis: SET key EX 300 (уже используется в проекте, см. utils/redis.js)
//   4. Валидация  — сравнение введённого кода с сохранённым; при совпадении
//                   код удаляется (одноразовый), при несовпадении — растёт
//                   счётчик попыток, после MAX_VERIFY_ATTEMPTS — блокировка
//
// Если Redis недоступен (dev без Redis) — используется fallback-Map в памяти
// процесса. Это ТОЛЬКО для локальной разработки: не переживает рестарт,
// не работает в PM2 cluster (несколько инстансов).

import { tryRedis, checkRateLimit } from "../utils/redis.js";
import { debugLog } from "../debug-log.js";

import { sendMail } from "./mailer.js";

const OTP_TTL_SECONDS = 5 * 60; // 5 минут — время жизни кода
const OTP_LENGTH = 4;

// ⭐ Шаг 2: лимит неверных попыток ввода одного кода
const MAX_VERIFY_ATTEMPTS = 5;
// ⭐ Шаг 2: на сколько блокируем повторные попытки после исчерпания лимита
// (пока пользователь не запросит новый код — новый requestOtp сбрасывает счётчик)
const VERIFY_LOCK_SECONDS = 10 * 60;

// ⭐ Шаг 2: лимиты на ЗАПРОС кода (защита от спама SMS / подбора номеров)
const REQUEST_LIMIT_PER_PHONE = { maxRequests: 3, windowSeconds: 10 * 60 }; // 3 кода / 10 мин на номер
const REQUEST_LIMIT_PER_IP = { maxRequests: 10, windowSeconds: 10 * 60 }; // 10 кодов / 10 мин на IP

// ⚠️ fallback-хранилище на случай отсутствия Redis
const memoryStore = new Map();
const memoryAttempts = new Map();

function otpKey(purpose, phone) {
  return `otp:${purpose}:${phone}`;
}
function attemptsKey(purpose, phone) {
  return `otp:attempts:${purpose}:${phone}`;
}

function generateCode() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

const PURPOSE_LABELS = {
  register: "регистрации",
  login: "входа",
  reset: "сброса пароля",
};

// ⭐ Mock-провайдер отправки SMS.
// 100% бесплатно, без интернета — код просто выводится в консоль сервера.
async function sendSms(phone, code, purpose) {
  console.log(
    `\n📱 [OTP MOCK SMS] → ${phone}\n` +
      `    Код для ${PURPOSE_LABELS[purpose] || purpose}: ${code}\n` +
      `    Действителен ${OTP_TTL_SECONDS / 60} мин.\n`,
  );
  return true;
}

async function sendEmailCode(email, code, purpose) {
  const subject = "Код подтверждения email — Dastbadast";
  const text =
    `Ваш код подтверждения: ${code}\n` +
    `Действителен ${OTP_TTL_SECONDS / 60} мин.\n\n` +
    `Если вы не запрашивали этот код — просто проигнорируйте письмо.`;
  await sendMail({ to: email, subject, text });
  return true;
}

/**
 * ⭐ Шаг 2: проверка лимита на ЗАПРОС кода (до генерации/отправки).
 * Возвращает { allowed, reason?: "phone" | "ip", resetInSec? }
 */
export async function checkOtpRequestLimit(phone, ip) {
  const byPhone = await checkRateLimit({
    key: `otp-request:phone:${phone}`,
    ...REQUEST_LIMIT_PER_PHONE,
  });
  if (!byPhone.allowed) {
    return { allowed: false, reason: "phone", resetInSec: byPhone.resetInSec };
  }

  if (ip) {
    const byIp = await checkRateLimit({
      key: `otp-request:ip:${ip}`,
      ...REQUEST_LIMIT_PER_IP,
    });
    if (!byIp.allowed) {
      return { allowed: false, reason: "ip", resetInSec: byIp.resetInSec };
    }
  }

  return { allowed: true };
}

/**
 * Сгенерировать и «отправить» код.
 * purpose: "register" | "login" | "reset"
 * ⚠️ Вызывать ТОЛЬКО после checkOtpRequestLimit(phone, ip).allowed === true
 */
export async function requestOtp(identifier, purpose, channel = "sms") {
  const code = generateCode();
  const key = otpKey(purpose, identifier);
  const payload = JSON.stringify({ code });

  const storedInRedis = await tryRedis(async (r) => {
    await r.set(key, payload, "EX", OTP_TTL_SECONDS);
    return true;
  }, false);

  if (!storedInRedis) {
    memoryStore.set(key, {
      code,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    });
    debugLog("OTP", "Redis недоступен, используется memory fallback", {
      identifier,
      purpose,
    });
  }

  // ⭐ новый код аннулирует предыдущий счётчик неверных попыток
  await resetAttempts(purpose, identifier);

  if (channel === "email") {
    await sendEmailCode(identifier, code, purpose);
  } else {
    await sendSms(identifier, code, purpose);
  }

  return { sent: true, ttlSeconds: OTP_TTL_SECONDS };
}

async function getAttempts(purpose, phone) {
  const key = attemptsKey(purpose, phone);
  const fromRedis = await tryRedis(async (r) => r.get(key), undefined);
  if (fromRedis !== undefined) {
    return fromRedis ? parseInt(fromRedis, 10) || 0 : 0;
  }
  const entry = memoryAttempts.get(key);
  if (!entry) return 0;
  if (Date.now() > entry.expiresAt) {
    memoryAttempts.delete(key);
    return 0;
  }
  return entry.count;
}

async function incrementAttempts(purpose, phone) {
  const key = attemptsKey(purpose, phone);
  const fromRedis = await tryRedis(async (r) => {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, VERIFY_LOCK_SECONDS);
    return count;
  }, undefined);
  if (fromRedis !== undefined) return fromRedis;

  const entry = memoryAttempts.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memoryAttempts.set(key, {
      count: 1,
      expiresAt: Date.now() + VERIFY_LOCK_SECONDS * 1000,
    });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function resetAttempts(purpose, phone) {
  const key = attemptsKey(purpose, phone);
  await tryRedis(async (r) => r.del(key), null);
  memoryAttempts.delete(key);
}

/**
 * Проверить код.
 * Возвращает { ok, locked, attemptsLeft }:
 *   - ok=true              → код верный, он уже удалён (одноразовый)
 *   - locked=true           → превышен лимит попыток, нужно запросить новый код
 *   - ok=false, locked=false → код неверный, есть ещё попытки (attemptsLeft)
 */
export async function verifyOtp(phone, purpose, code) {
  const attemptsSoFar = await getAttempts(purpose, phone);
  if (attemptsSoFar >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, locked: true, attemptsLeft: 0 };
  }

  const key = otpKey(purpose, phone);
  const fromRedis = await tryRedis(async (r) => r.get(key), undefined);

  let storedCode = null;
  if (fromRedis !== undefined) {
    storedCode = fromRedis ? JSON.parse(fromRedis).code : null;
  } else {
    const entry = memoryStore.get(key);
    if (entry && Date.now() <= entry.expiresAt) storedCode = entry.code;
  }

  if (!storedCode || String(storedCode) !== String(code)) {
    const attempts = await incrementAttempts(purpose, phone);
    const attemptsLeft = Math.max(0, MAX_VERIFY_ATTEMPTS - attempts);
    return {
      ok: false,
      locked: attempts >= MAX_VERIFY_ATTEMPTS,
      attemptsLeft,
    };
  }

  // ✅ успех — код одноразовый, чистим всё за собой
  await tryRedis(async (r) => r.del(key), null);
  memoryStore.delete(key);
  await resetAttempts(purpose, phone);
  return { ok: true, locked: false, attemptsLeft: MAX_VERIFY_ATTEMPTS };
}

export async function clearOtp(phone, purpose) {
  const key = otpKey(purpose, phone);
  await tryRedis(async (r) => r.del(key), null);
  memoryStore.delete(key);
}
