// Заглушка: принимаем webhook, верифицируем подпись, переводим заказ в PENDING + PAID.
// Для ALIF/DC — реальная сигнатура и payload подставятся после получения API docs.
import { getProvider } from '../payments/index.js';
import { Order } from '../models/Order.js';
import { pubsub, TOPICS } from '../pubsub.js';
import { GraphQLError } from 'graphql';

export async function handlePaymentWebhook(req, method) {
  const provider = getProvider(method);
  if (!provider.verifySignature(req)) {
    throw new GraphQLError('Invalid signature', { extensions: { code: 'UNAUTHORIZED' } });
  }
  const result = await provider.handleWebhook(req);
  if (!result.ok) {
    return { received: true, processed: false, reason: result.note || 'failed' };
  }
  // Для stub-flow: при ручном /payments/mock-confirm мы получаем orderId + status
  const orderId = result.orderId || req.body?.orderId;
  const status = result.status || req.body?.status; // 'PAID' | 'FAILED'
  if (!orderId) return { received: true, processed: false, reason: 'no orderId' };

  const order = await Order.findById(orderId);
  if (!order) return { received: true, processed: false, reason: 'order not found' };

  if (status === 'PAID') {
    order.paymentStatus = 'PAID';
    order.paid = true;
    order.paidAt = new Date();
    if (order.orderStatus === 'AWAITING_PAYMENT') {
      order.orderStatus = 'PENDING';
      order.statusTimestamps = order.statusTimestamps || {};
      order.statusTimestamps.pendingAt = order.statusTimestamps.pendingAt || new Date();
    }
    await order.save();
    // Теперь уведомляем store (kitchen)
    pubsub.publish(TOPICS.PLACE_ORDER(order.restaurantId.toString()), { subscribePlaceOrder: order });
  } else if (status === 'FAILED') {
    order.paymentStatus = 'FAILED';
    await order.save();
  }

  pubsub.publish(TOPICS.ORDER_TRACK(order._id.toString()), { subscriptionOrder: order });
  pubsub.publish(TOPICS.ORDER_STATUS_CHANGED(order.userId.toString()), { orderStatusChanged: order });

  return { received: true, processed: true, orderId: order._id, status: order.orderStatus };
}
