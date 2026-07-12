import { OwnerType, Permissions } from "@/lib/auth-context";

/**
 * Карта доступа: какие роли могут видеть какие пункты меню.
 * Используется в TopBar и при рендере ссылок.
 */
export const NAV_ACCESS = {
  dashboard: [
    "SUPER_ADMIN",
    "DISPATCHER",
    "FINANCE",
    "OPERATIONS",
    "SUPPORT",
    "ANALYST",
  ],
  map: ["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"],
  dispatch: [
    "SUPER_ADMIN",
    "DISPATCHER",
    "OPERATIONS",
    "FINANCE",
    "SUPPORT",
    "ANALYST",
  ],
  restaurants: ["SUPER_ADMIN", "OPERATIONS"],
  riders: ["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"],
  zones: ["SUPER_ADMIN", "OPERATIONS"],
  users: ["SUPER_ADMIN", "SUPPORT"],
  configuration: ["SUPER_ADMIN", "FINANCE"],
  accounting: ["SUPER_ADMIN", "FINANCE", "ANALYST"],
  admins: ["SUPER_ADMIN"],
} as const satisfies Record<string, OwnerType[]>;

/**
 * Карта доступов для конкретных мутаций/действий внутри страниц.
 * Используется в hasRole() / hasPermission() проверках.
 */
export const ACTION_ACCESS = {
  // Dispatch
  assignRider: ["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"],
  cancelOrder: ["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"],

  // Restaurants / Riders
  createRestaurant: ["SUPER_ADMIN", "OPERATIONS"],
  editRestaurant: ["SUPER_ADMIN", "OPERATIONS"],
  createRider: ["SUPER_ADMIN", "DISPATCHER", "OPERATIONS"],
  editRider: ["SUPER_ADMIN", "OPERATIONS"],

  // Configuration
  editFinancialConfig: ["SUPER_ADMIN", "FINANCE"],
  editAllConfig: ["SUPER_ADMIN"],

  // Users
  viewUserDetails: ["SUPER_ADMIN", "SUPPORT"],
  blockUser: ["SUPER_ADMIN", "SUPPORT"],

  // Admin management
  createAdmin: ["SUPER_ADMIN"],
  editAdmin: ["SUPER_ADMIN"],
  deactivateAdmin: ["SUPER_ADMIN"],
  resetAdminPassword: ["SUPER_ADMIN"],
} as const satisfies Record<string, OwnerType[]>;

export type NavKey = keyof typeof NAV_ACCESS;
export type ActionKey = keyof typeof ACTION_ACCESS;
