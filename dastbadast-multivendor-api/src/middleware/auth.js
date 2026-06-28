import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const SECRET = process.env.JWT_SECRET || "dastbadast-dev-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      kind: "user",
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    SECRET,
    { expiresIn: "30d" },
  );
}
export function signRestaurantToken(restaurant) {
  return jwt.sign(
    {
      sub: restaurant._id.toString(),
      kind: "restaurant",
      name: restaurant.name,
      username: restaurant.username,
    },
    SECRET,
    { expiresIn: "30d" },
  );
}
export function signOwnerToken(owner) {
  return jwt.sign(
    {
      sub: owner._id.toString(),
      kind: "owner",
      email: owner.email,
      userType: owner.userType,
    },
    SECRET,
    { expiresIn: "30d" },
  );
}
export function signRiderToken(rider) {
  return jwt.sign(
    {
      sub: rider._id.toString(),
      kind: "rider",
      username: rider.username,
      name: rider.name,
    },
    SECRET,
    { expiresIn: "30d" },
  );
}

export async function authMiddleware(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { user: null };
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.kind !== "user") return { user: null };
    const user = await User.findById(payload.sub);
    return { user };
  } catch {
    return { user: null };
  }
}
