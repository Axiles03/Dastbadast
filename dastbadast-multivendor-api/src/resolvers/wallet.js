// dastbadast-multivendor-api/src/resolvers/wallet.js
import { GraphQLError } from "graphql";
import { topUpBalanceStub, listWalletTransactions } from "../lib/wallet.js";

// ⭐ Единая проверка: работает и для клиента, и для курьера — тип
// владельца берём из того, какой токен реально пришёл (ctx.user/ctx.rider),
// сам вызывающий код не выбирает владельца произвольно.
function requireWalletOwner(ctx) {
  if (ctx.user) return { ownerType: "USER", ownerId: ctx.user._id };
  if (ctx.rider) return { ownerType: "RIDER", ownerId: ctx.rider._id };
  throw new GraphQLError("Not authenticated", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export const myWalletTransactions = async (_p, { limit, offset }, ctx) => {
  const { ownerType, ownerId } = requireWalletOwner(ctx);
  return listWalletTransactions(ownerType, ownerId, {
    limit: Math.min(limit ?? 20, 100), // защита от limit=100000 в запросе
    offset: offset ?? 0,
  });
};

export const topUpBalance = async (_p, { amount }, ctx) => {
  const { ownerType, ownerId } = requireWalletOwner(ctx);

  if (typeof amount !== "number" || amount <= 0 || amount > 1_000_000) {
    throw new GraphQLError("Некорректная сумма пополнения", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const tx = await topUpBalanceStub(ownerType, ownerId, amount);
  // tx === null означало бы дубликат по идемпотентности — для TOPUP_STUB
  // такого не бывает (orderId всегда null, см. примечание в lib/wallet.js),
  // так что просто возвращаем актуальный баланс.
  return tx.balanceAfter;
};
