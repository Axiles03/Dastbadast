// ⭐ ФАЗА 1 (FIX, см. пункт 1.6 / 5 плана аудита): раньше при
// API_INSTANCES > 1 без REDIS_URL / ENABLE_REDIS_PUBSUB=1 приложение
// молча деградировало на InMemoryPubSub — часть событий (новый заказ,
// смена статуса) просто не долетала до клиента на другом инстансе, без
// единой ошибки в логах, которую было бы легко связать с причиной.
//
// Добавить в dastbadast-multivendor-api/src/index.js СРАЗУ после строки
// `const API_INSTANCES = parseInt(process.env.API_INSTANCES, 10) || 1;`
// и вызвать `assertPubSubConfigOrThrow()` первой строкой в bootstrap(),
// до initRedis().

function assertPubSubConfigOrThrow() {
  const usingRedisPubSub = !!(
    process.env.REDIS_URL && process.env.ENABLE_REDIS_PUBSUB !== "0"
  );

  if (API_INSTANCES > 1 && !usingRedisPubSub) {
    // Намеренно валим процесс на старте (а не логируем warning) — PM2
    // покажет "errored" статус вместо тихо работающего, но теряющего
    // события кластера. Лучше не подняться вообще, чем поднять кластер,
    // где ресторан на инстансе B не получает часть заказов.
    throw new Error(
      "[boot] API_INSTANCES > 1 требует REDIS_URL и ENABLE_REDIS_PUBSUB=1 " +
        "(иначе события pubsub не долетают между инстансами кластера). " +
        `Текущее: REDIS_URL=${process.env.REDIS_URL ? "set" : "MISSING"}, ` +
        `ENABLE_REDIS_PUBSUB=${process.env.ENABLE_REDIS_PUBSUB ?? "unset"}`,
    );
  }

  if (!usingRedisPubSub) {
    // Одноинстансный dev/staging — не фатально, но должно быть видно в логах.
    debugLog(
      "boot",
      "⚠️ PubSub работает в режиме InMemoryPubSub (single-instance only)",
    );
  }
}
