// dastbadast-multivendor-admin/lib/auth-context.tsx
"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { storage } from "./security";

type Permissions = {
  canManageRestaurants: boolean;
  canManageRiders: boolean;
  canManageZones: boolean;
  canManageConfiguration: boolean;
  canViewAccounting: boolean;
  canAssignRiders: boolean;
  canManageUsers: boolean;
};

export type OwnerType =
  | "SUPER_ADMIN"
  | "DISPATCHER"
  | "FINANCE"
  | "OPERATIONS"
  | "SUPPORT"
  | "ANALYST";

type Owner = {
  id: string;
  email: string;
  userType: OwnerType;
  permissions?: Permissions | null;
  isActive?: boolean;
};

type AuthState = {
  token: string | null;
  owner: Owner | null;
  loading: boolean;
  /** ⭐ NEW: true после чтения localStorage, до этого момента `owner === null` */
  hydrated: boolean;
  setAuth: (token: string, owner: Owner) => void;
  logout: () => void;
  hasRole: (role: OwnerType | OwnerType[]) => boolean;
  hasPermission: (perm: keyof Permissions) => boolean;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false); // ⭐ NEW

  useEffect(() => {
    setToken(storage.get("dbd_admin_token"));
    const u = storage.get("dbd_admin_owner");
    if (u) {
      try {
        const parsed = JSON.parse(u) as Owner;
        if (!parsed.userType) parsed.userType = "SUPER_ADMIN";
        if (parsed.isActive === undefined) parsed.isActive = true;
        setOwner(parsed);
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
    setHydrated(true); // ⭐ NEW
  }, []);

  const setAuth = (t: string, o: Owner) => {
    const normalized: Owner = {
      ...o,
      userType: o.userType || "SUPER_ADMIN",
      isActive: o.isActive ?? true,
    };
    storage.set("dbd_admin_token", t);
    storage.set("dbd_admin_owner", JSON.stringify(normalized));
    setToken(t);
    setOwner(normalized);
  };

  const logout = () => {
    storage.remove("dbd_admin_token");
    storage.remove("dbd_admin_owner");
    setToken(null);
    setOwner(null);
  };

  const hasRole = useCallback(
    (role: OwnerType | OwnerType[]) => {
      if (!owner) return false;
      if (owner.userType === "SUPER_ADMIN") return true;
      if (Array.isArray(role)) return role.includes(owner.userType);
      return owner.userType === role;
    },
    [owner],
  );

  const hasPermission = useCallback(
    (perm: keyof Permissions) => {
      if (!owner) return false;
      if (owner.userType === "SUPER_ADMIN") return true;
      return !!owner.permissions?.[perm];
    },
    [owner],
  );

  const value = useMemo<AuthState>(
    () => ({
      token,
      owner,
      loading,
      hydrated, // ⭐ NEW
      setAuth,
      logout,
      hasRole,
      hasPermission,
    }),
    [token, owner, loading, hydrated, hasRole, hasPermission],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
