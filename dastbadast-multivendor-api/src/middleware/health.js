// dastbadast-multivendor-api/src/middleware/health.js
//
// Health-check endpoints для Kubernetes / PM2 / load balancer.
//
// /health/live   — процесс жив (всегда 200 если Node запущен)
// /health/ready  — готов принимать трафик (Mongo + Redis доступны)
// /health/metrics — JSON с runtime-метриками (для мониторинга)

import mongoose from "mongoose";
import { getRedis, isRedisReady } from "../utils/redis.js";
import { getCacheStats } from "./cache.js";

const startedAt = Date.now();
let activeSubscriptions = 0;

// Простой counter для /health/metrics
export function trackSubscription(action) {
  // action = "open" | "close"
  if (action === "open") activeSubscriptions++;
  else if (action === "close" && activeSubscriptions > 0) activeSubscriptions--;
}

function getMongoStatus() {
  // Mongoose states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  return mongoose.connection.readyState === 1 ? "up" : "down";
}

function getRedisStatus() {
  return isRedisReady() ? "up" : "down";
}

export function healthLiveHandler(req, res) {
  res.status(200).json({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
}

export async function healthReadyHandler(req, res) {
  const mongo = getMongoStatus();
  const redis = getRedisStatus();
  const ready = mongo === "up"; // Redis — optional, Mongo критичен
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    mongo,
    redis,
  });
}

export function healthMetricsHandler(req, res) {
  const mem = process.memoryUsage();
  const cache = getCacheStats();
  res.json({
    pid: process.pid,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    cache: {
      size: cache.size,
      max: cache.max,
    },
    activeSubscriptions,
    mongo: { status: getMongoStatus() },
    redis: { status: getRedisStatus() },
  });
}
