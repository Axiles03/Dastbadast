// dastbadast-multivendor-api/src/lib/mailer.js
//
// ⭐ Шаг 3: подтверждение email через Nodemailer + личный Gmail-аккаунт.
//
// В .env нужно указать:
//   GMAIL_USER=your-gmail@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (App Password, НЕ обычный пароль от аккаунта)
//
// ⚠️ Только для разработки/тестов — у Gmail SMTP жёсткие лимиты (~500 писем/сутки
// и антиспам-эвристики). В продакшене нужен отдельный транзакционный провайдер
// (SendGrid, Postmark, Amazon SES и т.д.)
//
// Если .env не настроен — письмо просто печатается в консоль (mock-режим),
// как и SMS-коды в lib/otp.js. Это позволяет разрабатывать без реального Gmail.

import nodemailer from "nodemailer";
import { debugLog, debugWarn } from "../debug-log.js";

let transporter = null;
let transporterChecked = false;

function getTransporter() {
  if (transporterChecked) return transporter;
  transporterChecked = true;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    debugWarn(
      "Mailer",
      "GMAIL_USER / GMAIL_APP_PASSWORD не заданы — письма будут только логироваться в консоль",
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });
  return transporter;
}

/**
 * Отправить письмо. При отсутствии конфигурации Gmail или ошибке отправки
 * НЕ бросает исключение — пишет в консоль (mock), чтобы не ронять запрос
 * пользователя из-за проблем с почтой.
 */
export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();

  if (!t) {
    console.log(
      `\n📧 [MAIL MOCK] → ${to}\n    Тема: ${subject}\n    ${text}\n`,
    );
    return { mocked: true };
  }

  try {
    const info = await t.sendMail({
      from: `"Dastbadast" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    debugLog("Mailer", "письмо отправлено", { to, messageId: info.messageId });
    return { mocked: false, messageId: info.messageId };
  } catch (err) {
    debugWarn("Mailer", "ошибка отправки письма", err?.message);
    console.log(
      `\n📧 [MAIL FALLBACK — ошибка отправки, см. лог] → ${to}\n    Тема: ${subject}\n    ${text}\n`,
    );
    return { mocked: true, error: err?.message };
  }
}
