import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import jwt from "jsonwebtoken";

import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { authMiddleware } from "./middleware/auth.js";
import { User } from "./models/User.js";
import { Restaurant } from "./models/Restaurant.js";
import { Owner } from "./models/Owner.js";
import { Rider } from "./models/Rider.js";
import { handlePaymentWebhook } from "./webhooks/payments.js";
import { Order } from "./models/Order.js";
import rateLimit from "express-rate-limit";

const PORT = process.env.PORT || 8001;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/dastbadast";
const SECRET = process.env.JWT_SECRET || "dastbadast-dev-secret-change-me";

async function resolveContextFromAuthHeader(header) {
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    return { user: null, restaurant: null, owner: null, rider: null };
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.kind === "restaurant") {
      const r = await Restaurant.findById(payload.sub);
      return { user: null, restaurant: r, owner: null, rider: null };
    }
    if (payload.kind === "owner") {
      const o = await Owner.findById(payload.sub);
      return { user: null, restaurant: null, owner: o, rider: null };
    }
    if (payload.kind === "rider") {
      const r = await Rider.findById(payload.sub);
      return { user: null, restaurant: null, owner: null, rider: r };
    }
    const u = await User.findById(payload.sub);
    return { user: u, restaurant: null, owner: null, rider: null };
  } catch {
    return { user: null, restaurant: null, owner: null, rider: null };
  }
}

async function start() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer(
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

  const apollo = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await apollo.start();

  // Mock redirect — открывается в браузере, имитирует банковскую страницу
  app.get("/payments/mock-redirect", (req, res) => {
    const { provider, orderId, ref, return: ret } = req.query;
    res.send(`
    <html><body style="font-family:sans-serif;padding:30px;max-width:520px;margin:auto">
      <h2>Mock ${provider} payment</h2>
      <p>Order: <code>${orderId}</code></p>
      <p>Ref: <code>${ref}</code></p>
      <form method="POST" action="/payments/mock-confirm">
        <input type="hidden" name="orderId" value="${orderId}"/>
        <input type="hidden" name="provider" value="${provider}"/>
        <input type="hidden" name="providerRef" value="${ref}"/>
        <input type="hidden" name="returnUrl" value="${ret || "/"}"/>
        <button name="status" value="PAID" style="padding:10px 20px;background:green;color:white;border:0;border-radius:6px;cursor:pointer">Оплатить (имитация)</button>
        <button name="status" value="FAILED" style="padding:10px 20px;background:#999;color:white;border:0;border-radius:6px;cursor:pointer;margin-left:8px">Отклонить</button>
      </form>
      <p style="color:#666;font-size:12px;margin-top:16px">Это заглушка. Реальный платёж будет идти через банк-шлюз Alif/DS.</p>
    </body></html>
  `);
  });

  // Mock confirm — посылает webhook-like запрос самому себе
  app.post(
    "/payments/mock-confirm",
    express.urlencoded({ extended: true }),
    async (req, res) => {
      const { orderId, provider, status, providerRef, returnUrl } = req.body;
      const method = provider === "ALIF_MOBI" ? "ALIF_MOBI" : "DS_BANK";
      // Имитация банковского webhook
      const fakeReq = {
        body: { orderId, status, providerRef },
        headers: {
          "x-internal-token":
            process.env.PAYMENTS_INTERNAL_TOKEN || "dev-token",
        },
      };
      const out = await handlePaymentWebhook(fakeReq, method);
      res.redirect(
        303,
        (returnUrl || "/") +
          `?orderId=${orderId}&payment=${status}&orderStatus=${out.status || ""}`,
      );
    },
  );

  // Реальные webhook-эндпоинты — для будущей интеграции
  app.post("/payments/webhook/alif", bodyParser.json(), async (req, res) => {
    const out = await handlePaymentWebhook(req, "ALIF_MOBI");
    res.json(out);
  });
  app.post("/payments/webhook/dc", bodyParser.json(), async (req, res) => {
    const out = await handlePaymentWebhook(req, "DS_BANK");
    res.json(out);
  });

  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));
  app.get("/health", (_, res) => res.json({ ok: true }));

  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async ({ req }) => {
        // 🔧 DEBUG: логируем ВСЕ запросы
        if (req.body?.query) {
          console.log("📨 [GraphQL Request]", req.body.query.slice(0, 300));
          if (req.body.variables) {
            console.log("📨 [Variables]", JSON.stringify(req.body.variables));
          }
        }
        return resolveContextFromAuthHeader(req.headers.authorization || "");
      },
    }),
  );

  app.use(
    "/graphql",
    rateLimit({
      windowMs: 60_000,
      max: 200,
      message: {
        errors: [
          {
            message: "Too many requests",
            extensions: { code: "RATE_LIMITED" },
          },
        ],
      },
    }),
  );

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 API http://0.0.0.0:${PORT}/graphql (доступен в LAN для Expo)`,
    );
    console.log(`🔌 WS    ws://0.0.0.0:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
