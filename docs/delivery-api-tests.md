# 1) Пометить заказ как "готовится" (ресторан)

mutation { markOrderPreparing(orderId: "...") { id orderStatus } }

# 2) Пометить заказ как "готов к выдаче"

mutation { markOrderReady(orderId: "...") { id orderStatus } }

# 3) Курьер принимает заказ

mutation { acceptDelivery(orderId: "...") { id orderStatus riderId } }

# 4) Курьер забрал еду

mutation { pickupDelivery(orderId: "...") { id orderStatus } }

# 5) Курьер прибыл к клиенту

mutation { arriveAtDropOff(orderId: "...") { id orderStatus } }

# 6) Курьер отметил доставку

mutation { markDelivered(orderId: "...") { id orderStatus paid } }

# 7) Подписка на жизненный цикл (клиентский front)

subscription {
deliveryStatusChanged(orderId: "...") {
order { id orderStatus }
etaToRestaurant
etaToCustomer
event
}
}
