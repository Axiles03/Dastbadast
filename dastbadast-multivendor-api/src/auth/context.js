// dastbadast-multivendor-api/src/auth/context.js
//
// Парсит Authorization header и подгружает владельца токена.
// Выделено из index.js для переиспользования в server.js (factory).
//
// добавлен параметр ip — пробрасывается в GraphQL-контекст,
// чтобы резолверы OTP/логина могли рейт-лимитить запросы по IP,
// а не только по номеру телефона (см. src/resolvers/auth-otp.js).

import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Restaurant } from "../models/Restaurant.js";
import { Owner } from "../models/Owner.js";
import { Rider } from "../models/Rider.js";

const SECRET = process.env.JWT_SECRET || "dastbadast-dev-secret-change-me";

export async function resolveContextFromAuthHeader(header, ip) {
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    return { user: null, restaurant: null, owner: null, rider: null, ip };
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.kind === "restaurant") {
      const r = await Restaurant.findById(payload.sub);
      return { user: null, restaurant: r, owner: null, rider: null, ip };
    }
    if (payload.kind === "owner") {
      const o = await Owner.findById(payload.sub);
      return { user: null, restaurant: null, owner: o, rider: null, ip };
    }
    if (payload.kind === "rider") {
      const r = await Rider.findById(payload.sub);
      return { user: null, restaurant: null, owner: null, rider: r, ip };
    }
    const u = await User.findById(payload.sub);
    return { user: u, restaurant: null, owner: null, rider: null, ip };
  } catch {
    return { user: null, restaurant: null, owner: null, rider: null, ip };
  }
}
