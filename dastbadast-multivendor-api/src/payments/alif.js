// ⚠️ STUB. Нужен API docs от Alif Mobi (Alif Nasiya / Alif Mobi Merchant).
// TODO(integration):
//  - endpoint: https://api.alif.tj/...   (получить при подключении)
//  - auth:    merchant_id + secret_key (HS256/JWT — по доке)
//  - payload: { orderId, amount, currency: 'TJS', returnUrl, callbackUrl }
//  - webhook: bank -> наш POST /payments/webhook/alif
//  - signature header: X-Alif-Signature (verifySignature должен это проверить)
//
// Пока имитируем: paymentUrl ведёт на наш внутренний mock-redirect,
// webhook ожидает internal token (PAYMENTS_INTERNAL_TOKEN).

import crypto from 'crypto';

export class AlifProvider {
  name = 'ALIF_MOBI';

  async createPayment({ order, returnUrl }) {
    const providerRef = `alif_${order._id}_${Date.now()}`;
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:8001';
    return {
      providerRef,
      paymentUrl: `${base}/payments/mock-redirect?provider=ALIF_MOBI&orderId=${order._id}&ref=${providerRef}&return=${encodeURIComponent(returnUrl || '/')}`,
      raw: { stub: true, note: 'Replace with real Alif Mobi SDK call' },
    };
  }

  async handleWebhook(req) {
    // TODO(integration): разобрать payload банка, вернуть { ok, orderId, status, providerRef }
    return { ok: false, status: 'NOT_IMPLEMENTED', note: 'Alif webhook stub' };
  }

  verifySignature(req) {
    // TODO(integration): HMAC verify с merchant secret
    return req?.headers?.['x-internal-token'] === (process.env.PAYMENTS_INTERNAL_TOKEN || 'dev-token');
  }
}
