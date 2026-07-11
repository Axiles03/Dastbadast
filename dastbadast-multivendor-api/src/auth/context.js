// dastbadast-multivendor-api/src/auth/context.js
//
// Парсит Authorization header и подгружает владельца токена.
// Выделено из index.js для переиспользования в server.js (factory).

import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Restaurant } from "../models/Restaurant.js";
import { Owner } from "../models/Owner.js";
import { Rider } from "../models/Rider.js";

const SECRET = process.env.JWT_SECRET || "dastbadast-dev-secret-change-me";

export async function resolveContextFromAuthHeader(header) {
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
