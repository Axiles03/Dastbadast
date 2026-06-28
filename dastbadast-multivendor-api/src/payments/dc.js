// ⚠️ STUB. Нужен API docs от Dushanbe City Bank (DCB / DS).
// TODO(integration):
//  - endpoint: https://api.dcb.tj/...   (получить при подключении)
//  - auth:    api_key + secret (по доке)
//  - payload: { orderId, amount, currency: 'TJS', returnUrl, callbackUrl }
//  - webhook: bank -> наш POST /payments/webhook/dc
//  - signature: X-DS-Signature (verifySignature должен это проверить)

import crypto from 'crypto';

export class DcProvider {
  name = 'DS_BANK';

  async createPayment({ order, returnUrl }) {
    const providerRef = `dc_${order._id}_${Date.now()}`;
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:8001';
    return {
      providerRef,
      paymentUrl: `${base}/payments/mock-redirect?provider=DS_BANK&orderId=${order._id}&ref=${providerRef}&return=${encodeURIComponent(returnUrl || '/')}`,
      raw: { stub: true, note: 'Replace with real DCB SDK call' },
    };
  }

  async handleWebhook(req) {
    return { ok: false, status: 'NOT_IMPLEMENTED', note: 'DC webhook stub' };
  }

  verifySignature(req) {
    return req?.headers?.['x-internal-token'] === (process.env.PAYMENTS_INTERNAL_TOKEN || 'dev-token');
  }
}
