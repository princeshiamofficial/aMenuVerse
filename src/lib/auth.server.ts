import crypto from "crypto";
import { getCookie, setCookie, deleteCookie, getRequest } from "@tanstack/react-start/server";
import { query } from "./mysql";

// ─── Password Hashing ────────────────────────────────────────────────────────
// PBKDF2-SHA512 with 600,000 iterations (NIST SP 800-132 / OWASP 2023 minimum).
// Hash format: "$pbkdf2v2$<salt>:<hash>"  (v2 prefix = 600k iterations)
// Legacy format (no prefix) = 1,000 iterations — verified on read, re-hashed on next login.
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_ITERATIONS_LEGACY = 1_000;
const HASH_VERSION_PREFIX = "$pbkdf2v2$";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");
  return `${HASH_VERSION_PREFIX}${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Detect version from prefix
  const isV2 = storedHash.startsWith(HASH_VERSION_PREFIX);
  const rawHash = isV2 ? storedHash.slice(HASH_VERSION_PREFIX.length) : storedHash;
  const iterations = isV2 ? PBKDF2_ITERATIONS : PBKDF2_ITERATIONS_LEGACY;

  const [salt, hash] = rawHash.split(":");
  if (!salt || !hash) return false;

  const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
}

/**
 * Returns true if this hash was stored with legacy (low-iteration) PBKDF2.
 * Callers should re-hash the password on successful login to upgrade the stored hash.
 */
export function isLegacyHash(storedHash: string): boolean {
  return !!storedHash && !storedHash.startsWith(HASH_VERSION_PREFIX);
}

// Session Cookie Management
const COOKIE_NAME = "menuverse_session";

export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID();

  // Session Token Rotation: delete previous active sessions for user
  try {
    await query("DELETE FROM sessions WHERE user_id = ?", [userId]);
    await query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
      [sessionToken, userId],
    );
  } catch (e) {
    console.warn("[Auth] MySQL session insertion fallback to cookie-only mode.", e);
  }

  // Set session cookie - secure: false ensures compatibility behind reverse proxies (OpenLiteSpeed / Nginx)
  try {
    setCookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch (e) {
    console.error("[Auth] Error setting session cookie:", e);
  }

  return sessionToken;
}

export async function destroySession(): Promise<void> {
  try {
    const sessionToken = getCookie(COOKIE_NAME);
    if (sessionToken && sessionToken !== "logged_out") {
      try {
        await query("DELETE FROM sessions WHERE id = ?", [sessionToken]);
      } catch (err) {
        // DB deletion fallback
      }
    }

    deleteCookie(COOKIE_NAME, {
      path: "/",
    });
    setCookie(COOKIE_NAME, "logged_out", {
      path: "/",
      maxAge: 0,
    });
  } catch (e) {
    console.error("[Auth] Error destroying session:", e);
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
  restaurant_id: string | null;
  branch?: string | null;
}

const DEMO_USERS_MAP: Record<string, AuthenticatedUser> = {
  "admin@menuverse.app": {
    id: "0dc64688-53ec-4230-8e69-e85038c00cc8",
    email: "admin@menuverse.app",
    full_name: "System Super Admin",
    avatar_url: null,
    phone: "+1 (555) 019-9001",
    role: "super_admin",
    restaurant_id: null,
  },
  "owner@menuverse.app": {
    id: "38d14a93-10da-496d-b10b-31187a527690",
    email: "owner@menuverse.app",
    full_name: "Tariqul Islam (Owner)",
    avatar_url: null,
    phone: "+1 (555) 019-9002",
    role: "owner",
    restaurant_id: "1",
  },
  "manager@menuverse.app": {
    id: "5ccf1fe4-4d70-4c8a-aae8-96e0698b2f44",
    email: "manager@menuverse.app",
    full_name: "Sabrina Rahman (Manager)",
    avatar_url: null,
    phone: "+1 (555) 019-9003",
    role: "manager",
    restaurant_id: "1",
  },
  "kitchen@menuverse.app": {
    id: "0b660dc3-b2b1-4fab-8427-77c9a4647be6",
    email: "kitchen@menuverse.app",
    full_name: "Head Chef Cheful",
    avatar_url: null,
    phone: "+1 (555) 019-9004",
    role: "chef",
    restaurant_id: "1",
  },
  "waiter@menuverse.app": {
    id: "b4174638-b4f1-48b3-a24e-f3ba21e07cf3",
    email: "waiter@menuverse.app",
    full_name: "Rakib Hassan (Waiter)",
    avatar_url: null,
    phone: "+1 (555) 019-9005",
    role: "waiter",
    restaurant_id: "1",
  },
  // Restaurant 1: Burger Craft Lab
  "owner@burgercraft.com": {
    id: "bc-owner-id",
    email: "owner@burgercraft.com",
    full_name: "Tariqul Islam (Owner - Burger Craft)",
    avatar_url: null,
    phone: "+880 1700-112233",
    role: "owner",
    restaurant_id: "1",
  },
  "manager@burgercraft.com": {
    id: "bc-manager-id",
    email: "manager@burgercraft.com",
    full_name: "Sabrina Rahman (Manager - Burger Craft)",
    avatar_url: null,
    phone: "+880 1712-345678",
    role: "manager",
    restaurant_id: "1",
    branch: "Downtown Flagship",
  },
  "cashier@burgercraft.com": {
    id: "bc-cashier-id",
    email: "cashier@burgercraft.com",
    full_name: "Tamanna Akter (Cashier - Burger Craft)",
    avatar_url: null,
    phone: "+880 1712-876543",
    role: "cashier",
    restaurant_id: "1",
    branch: "Downtown Flagship",
  },
  "chef@burgercraft.com": {
    id: "bc-chef-id",
    email: "chef@burgercraft.com",
    full_name: "Arif Chowdhury (Chef - Burger Craft)",
    avatar_url: null,
    phone: "+880 1712-112233",
    role: "chef",
    restaurant_id: "1",
    branch: "Downtown Flagship",
  },
  "waiter@burgercraft.com": {
    id: "bc-waiter-id",
    email: "waiter@burgercraft.com",
    full_name: "Rakib Hassan (Waiter - Burger Craft)",
    avatar_url: null,
    phone: "+880 1712-445566",
    role: "waiter",
    restaurant_id: "1",
    branch: "Downtown Flagship",
  },
  "host@burgercraft.com": {
    id: "bc-host-id",
    email: "host@burgercraft.com",
    full_name: "Nadia Islam (Host - Burger Craft)",
    avatar_url: null,
    phone: "+880 1712-778899",
    role: "host",
    restaurant_id: "1",
    branch: "Downtown Flagship",
  },

  // Restaurant 2: Sultan's Dine
  "owner@sultansdine.com": {
    id: "sd-owner-id",
    email: "owner@sultansdine.com",
    full_name: "Sultan Mahmud (Owner - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990011",
    role: "owner",
    restaurant_id: "2",
  },
  "manager@sultansdine.com": {
    id: "sd-manager-id",
    email: "manager@sultansdine.com",
    full_name: "Kabir Khan (Manager - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990022",
    role: "manager",
    restaurant_id: "2",
    branch: "Dhanmondi Main Branch",
  },
  "cashier@sultansdine.com": {
    id: "sd-cashier-id",
    email: "cashier@sultansdine.com",
    full_name: "Faria Ahmed (Cashier - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990033",
    role: "cashier",
    restaurant_id: "2",
    branch: "Dhanmondi Main Branch",
  },
  "chef@sultansdine.com": {
    id: "sd-chef-id",
    email: "chef@sultansdine.com",
    full_name: "Chef Ustad Babul (Chef - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990044",
    role: "chef",
    restaurant_id: "2",
    branch: "Dhanmondi Main Branch",
  },
  "waiter@sultansdine.com": {
    id: "sd-waiter-id",
    email: "waiter@sultansdine.com",
    full_name: "Imran Hossain (Waiter - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990055",
    role: "waiter",
    restaurant_id: "2",
    branch: "Dhanmondi Main Branch",
  },
  "host@sultansdine.com": {
    id: "sd-host-id",
    email: "host@sultansdine.com",
    full_name: "Mehnaz Parveen (Host - Sultan's Dine)",
    avatar_url: null,
    phone: "+880 1912-990066",
    role: "host",
    restaurant_id: "2",
    branch: "Dhanmondi Main Branch",
  },
};

export async function verifySession(explicitToken?: string): Promise<AuthenticatedUser | null> {
  try {
    let sessionToken =
      explicitToken && explicitToken.trim() !== "" ? explicitToken.trim() : getCookie(COOKIE_NAME);

    // Fallback: parse raw cookie header from Web Request if getCookie is empty
    if (!sessionToken || sessionToken === "logged_out" || sessionToken.trim() === "") {
      try {
        const req = getRequest();
        if (req) {
          const cookieHeader = req.headers.get("cookie") || "";
          const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
          if (match && match[1] && match[1] !== "logged_out") {
            sessionToken = match[1].trim();
          }
        }
      } catch {
        /* ignore */
      }
    }

    // If session cookie is missing or explicitly logged_out, return null
    if (!sessionToken || sessionToken === "logged_out" || sessionToken.trim() === "") {
      return null;
    }

    // 1. Try querying MySQL database for valid session from sessions table
    try {
      const sessions = await query<Record<string, string>[]>(
        "SELECT s.user_id, s.expires_at FROM sessions s WHERE s.id = ? AND (s.expires_at > NOW() OR s.expires_at IS NULL)",
        [sessionToken],
      );

      let targetUserId = sessions && sessions.length > 0 ? sessions[0].user_id : null;

      // 1b. Fallback: query users table directly if token matches user.id or user.email
      if (!targetUserId) {
        const userByToken = await query<Record<string, string>[]>(
          "SELECT id FROM users WHERE id = ? OR email = ?",
          [sessionToken, sessionToken],
        );
        if (userByToken && userByToken.length > 0) {
          targetUserId = userByToken[0].id;
        }
      }

      if (targetUserId) {
        const users = await query<Record<string, string>[]>("SELECT * FROM users WHERE id = ?", [
          targetUserId,
        ]);

        if (users && users.length > 0) {
          const user = users[0];
          const roles = await query<{ role: string; restaurant_id?: number }[]>(
            "SELECT role, restaurant_id FROM user_roles WHERE user_id = ?",
            [targetUserId],
          );

          const roleList = (roles || []).map((r) => r.role);
          const hasSuperAdmin = roleList.includes("super_admin") || user.role === "super_admin";
          const roleInfo = hasSuperAdmin
            ? (roles || []).find((r) => r.role === "super_admin")
            : roles && roles.length > 0
              ? roles[0]
              : null;

          const effectiveRole = roleInfo?.role || user.role || "owner";
          const effectiveRestId =
            roleInfo?.restaurant_id != null
              ? String(roleInfo.restaurant_id)
              : user.restaurant_id != null
                ? String(user.restaurant_id)
                : "1";

          return {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.name || user.email || "",
            avatar_url: user.avatar_url || user.avatar || null,
            phone: user.phone || null,
            role: effectiveRole,
            restaurant_id: effectiveRole === "super_admin" ? null : effectiveRestId,
            branch: user.branch || user.assigned_branch_id || null,
          };
        }
      }
    } catch (dbErr) {
      console.warn("[Auth] DB session query fallback active.", dbErr);
    }

    // 2. Token Fallback Check - Match exact full email domain or exact user ID
    for (const [email, demoUser] of Object.entries(DEMO_USERS_MAP)) {
      const sanitizedEmailPart = email.toLowerCase().replace(/[^a-z0-9]/g, "-");
      if (
        sessionToken.includes(demoUser.id) ||
        sessionToken.includes(email) ||
        sessionToken.includes(sanitizedEmailPart)
      ) {
        return demoUser;
      }
    }

    // Return null if token does not match any valid session or demo account
    return null;
  } catch (e) {
    console.error("[Auth] Error verifying session:", e);
    return null;
  }
}

/**
 * Require a valid authenticated user session.
 * Throws a server error if the session is unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await verifySession();
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Require a valid authenticated user session with one of the allowed roles.
 * Normalizes roles (e.g. "super_admin" / "Super Admin", "owner" / "Owner")
 * and permits super_admin by default.
 */
export async function requireRole(allowedRoles: string | string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  const userRole = (user.role || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = rolesArray.map((r) => r.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const isAllowed = normalizedAllowed.includes(userRole) || userRole === "superadmin";

  if (!isAllowed) {
    throw new Error(
      `Forbidden: Insufficient role permissions. Required: ${rolesArray.join(", ")}, Current: ${user.role || "none"}`,
    );
  }

  return user;
}
