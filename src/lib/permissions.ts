import { verifySession, AuthenticatedUser } from "./auth.server";

export type PermissionKey =
  // Platform Level Permissions
  | "platform:manage_restaurants"
  | "platform:view_global_analytics"
  | "platform:manage_system_users"
  // Restaurant Tenant Level Permissions
  | "restaurant:update_profile"
  | "branches:manage"
  | "categories:manage"
  | "food_items:manage"
  | "branch_tables:manage"
  | "staff:manage"
  | "settings:manage"
  | "promotions:manage"
  | "reservations:manage"
  // Operations & POS Level Permissions
  | "orders:view"
  | "orders:create"
  | "orders:update_status"
  | "orders:delete"
  | "waiter_requests:manage"
  | "analytics:view";

export type UserRole =
  "super_admin" | "owner" | "manager" | "cashier" | "chef" | "waiter" | "host" | "customer";

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  super_admin: [
    "platform:manage_restaurants",
    "platform:view_global_analytics",
    "platform:manage_system_users",
    "restaurant:update_profile",
    "branches:manage",
    "categories:manage",
    "food_items:manage",
    "branch_tables:manage",
    "staff:manage",
    "settings:manage",
    "promotions:manage",
    "reservations:manage",
    "orders:view",
    "orders:create",
    "orders:update_status",
    "orders:delete",
    "waiter_requests:manage",
    "analytics:view",
  ],
  owner: [
    "restaurant:update_profile",
    "branches:manage",
    "categories:manage",
    "food_items:manage",
    "branch_tables:manage",
    "staff:manage",
    "settings:manage",
    "promotions:manage",
    "reservations:manage",
    "orders:view",
    "orders:create",
    "orders:update_status",
    "orders:delete",
    "waiter_requests:manage",
    "analytics:view",
  ],
  manager: [
    "branch_tables:manage",
    "staff:manage",
    "promotions:manage",
    "reservations:manage",
    "orders:view",
    "orders:create",
    "orders:update_status",
    "orders:delete",
    "waiter_requests:manage",
    "analytics:view",
  ],
  cashier: ["orders:view", "orders:create", "orders:update_status", "orders:delete"],
  chef: ["orders:view", "orders:update_status"],
  waiter: ["orders:view", "orders:create", "orders:update_status", "waiter_requests:manage"],
  host: ["reservations:manage"],
  customer: ["orders:create"],
};

/**
 * Checks whether a given role string possesses a target permission key.
 * Automatically normalizes casing and spacing (e.g., "Owner" -> "owner").
 */
export function hasPermission(
  roleStr: string | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!roleStr) return false;

  const normalized = roleStr.toLowerCase().trim().replace(/ /g, "_") as UserRole;

  if (normalized === "super_admin") return true;

  const permissions = ROLE_PERMISSIONS[normalized] || [];
  return permissions.includes(permission);
}

/**
 * Enforces RBAC permission check inside server functions.
 * Throws an explicit server Error if the session user lacks the required permission.
 */
export async function requirePermission(permission: PermissionKey): Promise<AuthenticatedUser> {
  const user = await verifySession();
  if (!user) {
    throw new Error("Unauthorized: Please sign in to perform this action.");
  }

  if (!hasPermission(user.role, permission)) {
    throw new Error(
      `Forbidden: Role '${user.role || "unknown"}' lacks required '${permission}' permission.`,
    );
  }

  return user;
}
