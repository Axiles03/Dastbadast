import { Configuration } from "../models/Configuration.js";
import { GraphQLError } from "graphql";
import { requireRole } from "../middleware/rbac.js";

// FIX: защита от race при cold start через upsert
async function getOrCreateSingleton() {
  try {
    const cfg = await Configuration.findByIdAndUpdate(
      "singleton",
      { $setOnInsert: { _id: "singleton" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return cfg;
  } catch (e) {
    if (e.code === 11000) {
      return Configuration.findById("singleton");
    }
    throw e;
  }
}

export const configuration = async () => {
  return getOrCreateSingleton();
};

export const updateConfiguration = async (_p, { input }, ctx) => {
  requireRole(["SUPER_ADMIN", "FINANCE"])(ctx);
  const update = {};
  for (const k of Object.keys(input)) {
    if (input[k] !== undefined && input[k] !== null) update[k] = input[k];
  }
  return Configuration.findByIdAndUpdate(
    "singleton",
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};
