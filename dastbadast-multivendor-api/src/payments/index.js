// Abstraction layer для провайдеров оплаты.
// Каждый провайдер реализует:
//   name: 'COD' | 'ALIF_MOBI' | 'DS_BANK'
//   createPayment({ order, returnUrl }) -> { providerRef, paymentUrl, raw }
//   handleWebhook(req) -> { ok, orderId, status, providerRef, raw }
//   verifySignature(req) -> boolean   (заглушка по умолчанию true)
//
// Замена заглушек на реальные вызовы:
//   1) Получить API docs у банка (Alif Mobi / Dushanbe City Bank)
//   2) Реализовать createPayment/handleWebhook/verifySignature
//   3) Добавить конфиг-переменные окружения (секреты мерчанта)
//
// Текущая реализация ALIF/DC имитирует: createPayment возвращает paymentUrl
// на наш внутренний /payments/mock-redirect?orderId=...&provider=...
// handleWebhook принимает только запросы с нашим internal token.

import { CodProvider } from './cod.js';
import { AlifProvider } from './alif.js';
import { DcProvider } from './dc.js';

const REGISTRY = {
  COD: new CodProvider(),
  ALIF_MOBI: new AlifProvider(),
  DS_BANK: new DcProvider(),
};

export function getProvider(method) {
  const p = REGISTRY[method];
  if (!p) throw new Error(`Unknown payment method: ${method}`);
  return p;
}

export const PAYMENT_METHODS = Object.keys(REGISTRY);
