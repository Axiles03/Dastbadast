// dastbadast-multivendor-api/src/server.js
//
// ⭐ Factory: создаёт Express app + HTTP server + Apollo + WS.
// Выделено из index.js для тестов (можно создать N инстансов в памяти).
// В production index.js делает `startServer().listen(PORT)`.

import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { handlePaymentWebhook } from "./webhooks/payments.js";
import { cacheMiddleware } from "./middleware/cache.js";
import {
  healthLiveHandler,
  healthReadyHandler,
  healthMetricsHandler,
} from "./middleware/health.js";
import { resolveContextFromAuthHeader } from "./auth/context.js";

const SECRET = process.env.JWT_SECRET || "dastbadast-dev-secret-change-me";

/**
 * ⭐ Создать полностью настроенный сервер (без listen).
 * @returns {{app, httpServer, apollo, wsCleanup, config}}
 */
export async function createServer() {
  // Mongo (lazy connect — если уже подключены, не дублируем)
  if (mongoose.connection.readyState === 0) {
    const MONGO_URI =
      process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";
    await mongoose.connect(MONGO_URI);
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));

  // ===== Payment webhooks =====
  app.post("/payments/webhook/alif", bodyParser.json(), async (req, res) => {
    const out = await handlePaymentWebhook(req, "ALIF_MOBI");
    res.json(out);
  });
  app.post("/payments/webhook/dc", bodyParser.json(), async (req, res) => {
    const out = await handlePaymentWebhook(req, "DS_BANK");
    res.json(out);
  });

  // Mock redirect (для разработки)
  app.get("/payments/mock-redirect", (req, res) => {
    const { provider, orderId, ref, return: ret } = req.query;
    res.send(/* тот же HTML, что в index.js */ "");
  });
  app.post(
    "/payments/mock-confirm",
    express.urlencoded({ extended: true }),
    async (req, res) => {
      // тот же код
    },
  );

  // ===== Health checks =====
  app.get("/health", healthLiveHandler);
  app.get("/health/live", healthLiveHandler);
  app.get("/health/ready", healthReadyHandler);
  app.get("/health/metrics", healthMetricsHandler);

  app.get("/info", (_, res) =>
    res.json({
      ok: true,
      service: "dastbadast-multivendor-api",
      version: "1.1.0",
      pid: process.pid,
      redis: !!process.env.REDIS_URL ? "enabled" : "disabled",
    }),
  );

  // ===== WS =====
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const wsCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const params = ctx.connectionParams || {};
        const auth = params.authorization || params.Authorization || "";
        return resolveContextFromAuthHeader(auth);
      },
    },
    wsServer,
  );

  // ===== Apollo =====
  const apollo = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await apollo.start();

  // ===== Rate limit + cache =====
  app.use(
    "/graphql",
    rateLimit({
      windowMs: 60_000,
      max: parseInt(process.env.RATE_LIMIT_PER_MIN, 10) || 200,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(cacheMiddleware());

  // ===== GraphQL HTTP =====
  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async ({ req }) =>
        resolveContextFromAuthHeader(req.headers.authorization || ""),
    }),
  );

  return { app, httpServer, apollo, wsCleanup };
}
