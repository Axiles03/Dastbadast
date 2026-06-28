import { GraphQLError } from "graphql";

// Роли, которые имеют абсолютный доступ ко всему
const SUPER_ROLES = ["SUPER_ADMIN"];

/**
 * Проверяет, что аутентифицированный owner входит в список разрешённых ролей.
 * SUPER_ADMIN проходит всегда.
 * Также проверяет isActive === true.
 *
 * Использование:
 *   requireRole(['SUPER_ADMIN', 'DISPATCHER'])(ctx)
 */
export function requireRole(allowedRoles) {
  return (ctx) => {
    if (!ctx.owner) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    if (!ctx.owner.isActive) {
      throw new GraphQLError("Аккаунт деактивирован", {
        extensions: { code: "FORBIDDEN" },
      });
    }
    if (
      SUPER_ROLES.includes(ctx.owner.userType) ||
      (Array.isArray(allowedRoles) && allowedRoles.includes(ctx.owner.userType))
    ) {
      return ctx.owner;
    }
    throw new GraphQLError("Недостаточно прав", {
      extensions: { code: "FORBIDDEN" },
    });
  };
}

/**
 * Облегчённая проверка: только аутентификация + активный аккаунт.
 * Используется для read-only операций, доступных всем ролям.
 */
export function requireOwner(ctx) {
  if (!ctx.owner) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  if (!ctx.owner.isActive) {
    throw new GraphQLError("Аккаунт деактивирован", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return ctx.owner;
};
