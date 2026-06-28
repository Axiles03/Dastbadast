// Реальная рабочая реализация: деньги привозит курьер, статус PENDING -> kitchen.
export class CodProvider {
    name = 'COD';
  
    async createPayment({ order }) {
      return {
        providerRef: `cod_${order._id}`,
        paymentUrl: null,        // нет редиректа — оплата при получении
        raw: { method: 'COD' },
      };
    }
  
    // У COD нет вебхука: деньги фиксируются курьером при DELIVERED (см. rider.resolver).
    async handleWebhook(/* req */) {
      return { ok: true, status: 'CASH_ON_DELIVERY' };
    }
  
    verifySignature(/* req */) { return true; }
  }
  