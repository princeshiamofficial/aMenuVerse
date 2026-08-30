"use server";

import { createServerFn } from "./server-fn";
import { z } from "zod";
import type { PermissionKey } from "./permissions";
import type { AuthenticatedUser } from "./auth.server";
import { resolvePlanLimits } from "./plan-limits";
import { RESTAURANTS, type Restaurant } from "./restaurants-data";
import { toISODateString, isTimeInWindow, decodeTableToken, encodeTableToken } from "./utils";

// Lazy server module loaders (prevents Node/mysql2/ioredis modules from leaking into client Vite bundle graph)
const query = async <T = unknown>(sql: string, params?: unknown): Promise<T> => {
  const m = await import("./mysql");
  return m.query<T>(sql, params as Parameters<typeof m.query>[1]);
};

const transaction = async <T = unknown>(
  cb: (conn: import("mysql2/promise").PoolConnection) => Promise<T>,
): Promise<T> => {
  const m = await import("./mysql");
  return m.transaction<T>(cb);
};

const getPool = async (): Promise<import("mysql2/promise").Pool> => {
  const m = await import("./mysql");
  return m.getPool();
};

const checkRateLimitAsync = async (
  actionKey: string,
  identifier?: string,
  opts?: { maxRequests: number; windowMs: number },
): Promise<void> => {
  const m = await import("./rate-limit");
  return m.checkRateLimitAsync(actionKey, identifier, opts);
};

const checkRateLimit = (
  actionKey: string,
  identifier?: string,
  opts?: { maxRequests: number; windowMs: number },
): void => {
  // Safe sync call
  import("./rate-limit").then((m) => m.checkRateLimit(actionKey, identifier, opts)).catch(() => {});
};

const verifySession = async (explicitToken?: string) => {
  const m = await import("./auth.server");
  return m.verifySession(explicitToken);
};

const requireAuth = async () => {
  const m = await import("./auth.server");
  return m.requireAuth();
};

const requireRole = async (allowedRoles: string | string[]) => {
  const m = await import("./auth.server");
  return m.requireRole(allowedRoles);
};

const createSession = async (userId: string) => {
  const m = await import("./auth.server");
  return m.createSession(userId);
};

const destroySession = async () => {
  const m = await import("./auth.server");
  return m.destroySession();
};

const hashPassword = async (password: string) => {
  const m = await import("./auth.server");
  return m.hashPassword(password);
};

const verifyPassword = async (password: string, storedHash: string) => {
  const m = await import("./auth.server");
  return m.verifyPassword(password, storedHash);
};

const isLegacyHash = async (storedHash: string) => {
  const m = await import("./auth.server");
  return m.isLegacyHash(storedHash);
};

const requirePermission = async (permission: PermissionKey) => {
  const m = await import("./permissions");
  return m.requirePermission(permission);
};

const broadcastRealtimeEvent = async (params: {
  type: import("./realtime.server").RealtimeEventType;
  restaurantId: string | number;
  tenantSlug?: string;
  branchId?: string | null;
  branchName?: string;
  payload: unknown;
}) => {
  try {
    const m = await import("./realtime.server");
    m.broadcastRealtimeEvent(params);
  } catch (err) {
    console.warn("[Realtime] broadcast error:", err);
  }
};

const sendPushNotification = async (
  filter: import("./web-push.server").PushTargetFilter,
  payload: import("./web-push.server").PushNotificationPayload,
) => {
  try {
    const m = await import("./web-push.server");
    return await m.sendPushNotificationServer(filter, payload);
  } catch (err) {
    console.warn("[WebPush] notification error:", err);
  }
};

const sanitizeText = (text: string) => {
  if (!text) return text;
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
};

const validateImagePayload = (payload: string) => {
  if (!payload) return;
  if (payload.length > 5 * 1024 * 1024) throw new Error("Image size exceeds 5MB limit.");
};

// =========================================================
// AUTHENTICATION SERVER FUNCTIONS
// =========================================================

export const getCurrentUser = createServerFn({ method: "GET" })
  .validator((data?: { token?: string }) => data)
  .handler(async ({ data }) => {
    try {
      return await verifySession(data?.token);
    } catch (err) {
      console.error("getCurrentUser error:", err);
      return null;
    }
  });

export const signInAction = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await checkRateLimitAsync("login", data.email, { maxRequests: 60, windowMs: 60 * 1000 });
    const { email, password } = data;

    const users = await query<Record<string, string>[]>("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!users || users.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = users[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Transparently upgrade legacy (1,000-iteration) hashes to v2 (600,000-iteration) on login
    if (await isLegacyHash(user.password_hash)) {
      const upgraded = await hashPassword(password);
      await query("UPDATE users SET password_hash = ? WHERE id = ?", [upgraded, user.id]);
    }

    const roles = await query<{ role: string }[]>("SELECT role FROM user_roles WHERE user_id = ?", [
      user.id,
    ]);
    const roleList = (roles || []).map((r) => r.role);

    const token = await createSession(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: roleList,
      },
      token,
    };
  });

export const signUpAction = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string; fullName: string }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
        fullName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await checkRateLimitAsync("signup", data.email, { maxRequests: 3, windowMs: 60 * 1000 });
    const { email, password, fullName } = data;

    // Check if user exists
    const existing = await query<Record<string, string>[]>("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing && existing.length > 0) {
      throw new Error("Email already registered");
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    // Insert user
    await query("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)", [
      userId,
      email,
      passwordHash,
      fullName,
    ]);

    // Insert role - hardcoded to customer for public signup
    const assignedRole = "customer";
    const roleId = crypto.randomUUID();
    await query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
      roleId,
      userId,
      assignedRole,
    ]);

    // Create session
    await createSession(userId);
    return {
      user: {
        id: userId,
        email,
        full_name: fullName,
        roles: [assignedRole],
      },
    };
  });

export const signOutAction = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { success: true };
});

export type DbRestaurantRecord = {
  id: string | number;
  name: string;
  slug?: string | null;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  cuisine?: string | null;
  phone?: string | null;
  status?: string | null;
};

// =========================================================
// DATA FETCHING SERVER FUNCTIONS
// =========================================================

export const getPublicMenu = createServerFn({ method: "GET" })
  .validator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    // 1. Fetch Restaurant
    let restaurants: DbRestaurantRecord[] | null = null;
    try {
      restaurants = await query<DbRestaurantRecord[]>(
        "SELECT id, name, slug, description, logo_url, cover_url, cuisine, status FROM restaurants WHERE slug = ? AND status = 'active' LIMIT 1",
        [slug],
      );
    } catch {
      restaurants = await query<DbRestaurantRecord[]>(
        "SELECT id, name, slug, description, logo_url, cover_url, cuisine FROM restaurants WHERE slug = ? LIMIT 1",
        [slug],
      );
    }
    if (!restaurants || restaurants.length === 0) {
      return null;
    }
    const restaurant = restaurants[0];

    // 2. Fetch active categories
    const categories = await query<Record<string, unknown>[]>(
      "SELECT id, name, description, sort_order, is_active FROM categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order ASC",
      [restaurant.id],
    );

    // 3. Fetch available food items
    const items = await query<Record<string, unknown>[]>(
      "SELECT id, name, description, price, compare_at_price, currency, is_featured, category_id, sort_order, is_available FROM food_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY sort_order ASC",
      [restaurant.id],
    );

    // 4. Fetch food images
    const imagesByItem: Record<string, string> = {};
    const itemIds = (items || []).map((i) => String(i.id));
    if (itemIds.length > 0) {
      // Build inline placeholder list for query
      const placeholders = itemIds.map(() => "?").join(",");
      const images = await query<Record<string, string>[]>(
        `SELECT food_item_id, url, is_primary, sort_order FROM food_images WHERE food_item_id IN (${placeholders}) ORDER BY is_primary DESC, sort_order ASC`,
        itemIds,
      );
      for (const img of images || []) {
        if (!imagesByItem[img.food_item_id]) {
          imagesByItem[img.food_item_id] = img.url;
        }
      }
    }

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug || "",
        description: restaurant.description || "",
        logo_url: restaurant.logo_url || "",
        cover_url: restaurant.cover_url || "",
        cuisine: restaurant.cuisine || "",
      },
      categories: (categories || []).map((c) => ({
        id: String(c.id),
        name: String(c.name || ""),
        description: c.description ? String(c.description) : null,
        items: (items || [])
          .filter((i) => String(i.category_id) === String(c.id))
          .map((i) => ({
            id: String(i.id),
            name: String(i.name || ""),
            description: i.description ? String(i.description) : null,
            price: Number(i.price),
            compare_at_price: i.compare_at_price ? Number(i.compare_at_price) : null,
            currency: String(i.currency || "USD"),
            is_featured: !!i.is_featured,
            image_url: imagesByItem[String(i.id)] || null,
          })),
      })),
    };
  });

export const getRestaurantStatusBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    try {
      const rows = await query<{ id: number; name: string; status: string; logo_url: string }[]>(
        "SELECT id, name, status, logo_url FROM restaurants WHERE slug = ? LIMIT 1",
        [slug],
      );
      if (!rows || rows.length === 0) return null;
      return rows[0];
    } catch {
      return null;
    }
  });

export const getRestaurantData = createServerFn({ method: "GET" })
  .validator((username: string) => z.string().parse(username))
  .handler(async ({ data: username }) => {
    // 1. Fetch Restaurant
    let restaurants: DbRestaurantRecord[] | null = null;
    const cleanUser = (username || "").toLowerCase().trim().split(".")[0];
    const slugWithoutLab = cleanUser.replace(/lab$/i, "");
    const slugWithLab = cleanUser.endsWith("lab") ? cleanUser : `${cleanUser}lab`;

    try {
      restaurants = await query<DbRestaurantRecord[]>(
        "SELECT id, name, COALESCE(slug, username) AS slug, description, logo_url, cover_url, cuisine, phone, status FROM restaurants WHERE (slug = ? OR username = ? OR slug = ? OR username = ? OR slug = ? OR username = ? OR id = ?) AND (status != 'suspended' OR status IS NULL) LIMIT 1",
        [cleanUser, cleanUser, slugWithoutLab, slugWithoutLab, slugWithLab, slugWithLab, cleanUser],
      );
    } catch {
      restaurants = [];
    }
    if (!restaurants || restaurants.length === 0) {
      return null;
    }
    const restaurant = restaurants[0];

    // 2. Fetch branches
    let branches: Record<string, unknown>[] = [];
    try {
      branches = await query<Record<string, unknown>[]>(
        "SELECT id, name, address, phone, manager, status, is_default, menu_id FROM branches WHERE restaurant_id = ?",
        [restaurant.id],
      );
    } catch {
      branches = [];
    }

    // 3. Fetch active categories, food items, and profile from DB for this specific tenant
    const serverCategories = await getCategoriesServer({ data: username });
    const serverItems = await getFoodItemsServer({ data: username });
    const profile = ((await getRestaurantProfile({ data: username })) || {}) as Record<
      string,
      unknown
    >;
    const rawCategories = serverCategories || [];
    const rawItems = serverItems || [];

    type CategoryItem = {
      id?: string;
      visible?: boolean;
      name?: string;
      icon?: string;
      emoji?: string;
    };
    type FoodItemRecordOrMenuItem = {
      available?: boolean;
      price?: number | string;
      discountPrice?: number | string | null;
      id?: string | number;
      name?: string;
      shortDescription?: string;
      longDescription?: string;
      description?: string;
      image?: string;
      category?: string;
      popular?: boolean;
      bestSeller?: boolean;
    };

    const activeCategories = rawCategories.filter((c: CategoryItem) => c.visible !== false);

    const validCategoryKeys = new Set<string>();
    activeCategories.forEach((c: CategoryItem) => {
      if (c.id) validCategoryKeys.add(String(c.id).toLowerCase().trim());
      if (c.name) validCategoryKeys.add(String(c.name).toLowerCase().trim());
    });

    const activeItems = rawItems.filter((i: FoodItemRecordOrMenuItem) => {
      if (i.available === false) return false;
      const itemCatKey = String(i.category || "")
        .toLowerCase()
        .trim();
      if (!itemCatKey) return false;
      return validCategoryKeys.has(itemCatKey);
    });

    // 4. Fetch active promotions for this restaurant tenant
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let activePromotions: Record<string, unknown>[] = [];
    try {
      activePromotions = await query<Record<string, unknown>[]>(
        "SELECT * FROM promotions WHERE (restaurant_id = ? OR restaurant_id = ? OR restaurant_id = 'all') AND active = 1 ORDER BY created_at DESC",
        [restaurant.id, restaurant.slug || username],
      );
    } catch {
      try {
        activePromotions = await query<Record<string, unknown>[]>(
          "SELECT * FROM promotions WHERE active = 1 ORDER BY created_at DESC",
        );
      } catch {
        activePromotions = [];
      }
    }

    if (!activePromotions || activePromotions.length === 0) {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const cachePath = path.join(process.cwd(), "promotions-data-cache.json");
        if (fs.existsSync(cachePath)) {
          const raw = fs.readFileSync(cachePath, "utf-8");
          const cachePromos = JSON.parse(raw) as Record<string, unknown>[];
          activePromotions = cachePromos.filter((p: Record<string, unknown>) => p.active !== false);
        }
      } catch {
        activePromotions = [];
      }
    }

    // Filter activePromotions by date range (start_date <= todayStr <= end_date)
    const validPromotions = activePromotions.filter((p) => {
      const startDate = String(p.start_date || p.startDate || "").slice(0, 10);
      const endDate = String(p.end_date || p.endDate || "").slice(0, 10);
      if (startDate && startDate > todayStr) return false;
      if (endDate && endDate < todayStr) return false;
      return true;
    });

    return {
      id: restaurant.id,
      name: String(profile.name || restaurant.name || ""),
      currency: String((profile as unknown as Record<string, unknown>).currency || "BDT"),
      cuisine: String(profile.cuisineType || restaurant.cuisine || ""),
      rating: String(profile.rating || "4.9 Stars"),
      reviews: "340",
      price: "$$",
      time: String(profile.avgPrepTime || "15-25 min"),
      location: String(profile.address || restaurant.description || ""),
      logo: restaurant.name ? restaurant.name.charAt(0) : "R",
      logoBg: "from-blue-500 to-indigo-600",
      image: String(profile.cover || restaurant.cover_url || ""),
      logoImage: String(profile.logo || restaurant.logo_url || ""),
      favicon: String(profile.favicon || profile.logo || restaurant.logo_url || ""),
      socialPreview: String(profile.socialPreview || ""),
      facebookUrl: String((profile as Record<string, unknown>).facebookUrl || ""),
      instagramUrl: String((profile as Record<string, unknown>).instagramUrl || ""),
      whatsappNumber: String((profile as Record<string, unknown>).whatsappNumber || ""),
      username: String(restaurant.slug || ""),
      phone: String(profile.phone || restaurant.phone || ""),
      operatingHours: String(profile.openingHours || "Open Daily"),
      isVerified: profile.isVerified !== undefined ? Boolean(profile.isVerified) : true,
      appearance: (profile.appearance as Restaurant["appearance"]) || {
        themeColor: "amber",
        menuLayout: "cards",
        fontFamily: "sans",
      },
      menuLayout: (profile.appearance as Restaurant["appearance"])?.menuLayout || "cards",
      themeColor: (profile.appearance as Restaurant["appearance"])?.themeColor || "amber",
      fontFamily: (profile.appearance as Restaurant["appearance"])?.fontFamily || "sans",
      branches: (branches || []).map((b) => ({
        id: String(b.id || ""),
        name: String(b.name || ""),
        address: String(b.address || ""),
        phone: String(b.phone || ""),
        manager: String(b.manager || ""),
        status: String(b.status || "open"),
        isDefault: Boolean(b.is_default || b.isDefault),
        menuId: String(b.menu_id || b.menuId || ""),
      })),
      categories: activeCategories.map((c: CategoryItem) => ({
        name: String(c.name || ""),
        emoji: String(c.icon || c.emoji || "🍽️"),
      })),
      menuItems: activeItems.map((i: FoodItemRecordOrMenuItem) => {
        const itemPrice = Number(i.price || 0);
        const itemDiscountPrice =
          i.discountPrice != null && Number(i.discountPrice) < itemPrice
            ? Number(i.discountPrice)
            : null;

        return {
          id: String(i.id || ""),
          name: String(i.name || ""),
          description: String(i.shortDescription || i.longDescription || i.description || ""),
          price: itemPrice,
          discountPrice: itemDiscountPrice,
          image: String(i.image || ""),
          category: String(i.category || "General"),
          popular: Boolean(i.popular || i.bestSeller),
          trending: Boolean(i.popular || i.bestSeller),
        };
      }),
      promotions: validPromotions.map((p) => ({
        id: String(p.id || ""),
        name: String(p.name || ""),
        kind: String(p.kind || p.type || "seasonal"),
        discountPercent: Number(p.discount_percent ?? p.discountPercent ?? 0),
        startDate: toISODateString(p.start_date || p.startDate),
        endDate: toISODateString(p.end_date || p.endDate),
        startTime: p.start_time ? String(p.start_time) : undefined,
        endTime: p.end_time ? String(p.end_time) : undefined,
        image: p.image ? String(p.image) : undefined,
        description: p.description ? String(p.description) : undefined,
        showPopup: p.show_popup !== 0 && p.showPopup !== false,
        branchName: String(p.branch_name || p.branchName || "all"),
        branchId: String(p.branch_id || p.branchId || "all"),
        createdByRole: String(p.created_by_role || p.createdByRole || "owner"),
        createdByUserId: p.created_by_user_id ? String(p.created_by_user_id) : undefined,
        targetScope: String(p.target_scope || p.targetScope || "all"),
        categoryNames: p.category_names_json
          ? typeof p.category_names_json === "string"
            ? (JSON.parse(p.category_names_json) as string[])
            : (p.category_names_json as string[])
          : (p.categoryNames as string[]) || [],
        itemIds: p.item_ids_json
          ? typeof p.item_ids_json === "string"
            ? (JSON.parse(p.item_ids_json) as string[])
            : (p.item_ids_json as string[])
          : (p.itemIds as string[]) || [],
      })),
    };
  });

export const getAdminRestaurantsServer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await query<Record<string, unknown>[]>(
        `SELECT 
          r.id,
          r.name,
          COALESCE(r.slug, r.username, '') AS username,
          COALESCE(r.cuisine, 'Gourmet Kitchen') AS cuisine,
          COALESCE(r.location, 'Main Location') AS location,
          COALESCE(r.plan, 'Starter') AS plan,
          COALESCE(r.status, 'active') AS status,
          COALESCE(r.logo_url, '') AS logo_url,
          COALESCE(r.is_verified, 1) AS is_verified,
          '2026-01-01' AS joined,
          (SELECT COUNT(*) FROM branches b WHERE b.restaurant_id = r.id) AS branches,
          (SELECT COUNT(*) FROM categories c WHERE c.restaurant_id = r.id) AS categories_count,
          (SELECT COUNT(*) FROM food_items f WHERE f.restaurant_id = r.id) AS food_items_count
         FROM restaurants r
         ORDER BY r.id ASC`,
      );
    } catch (fullQueryErr) {
      console.warn(
        "[getAdminRestaurantsServer] Complex query notice, falling back to simple SELECT:",
        fullQueryErr,
      );
      rows = await query<Record<string, unknown>[]>(`SELECT * FROM restaurants ORDER BY id ASC`);
    }

    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const id = String(r.id || "");
        const name = String(r.name || "Restaurant");
        const slug = String(r.slug || r.username || id || "");
        const logoImage =
          String(r.logo_url || r.logo || "") ||
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&auto=format&fit=crop&q=80";
        const cuisine = String(r.cuisine || "Gourmet Kitchen");
        const location = String(r.location || r.address || "Main Location");
        const plan = String(r.plan || "Starter");
        const status = String(r.status || "active");
        const isVerified = r.is_verified === 1 || r.is_verified === true || r.is_verified === "1";
        const categoriesCount = Number(r.categories_count || 0);
        const foodItemsCount = Number(r.food_items_count || 0);
        const branchesCount = Number(r.branches || 1);

        return {
          id,
          name,
          username: slug,
          cuisine,
          location,
          plan,
          status,
          isVerified,
          logoImage,
          joined: String(r.created_at ? String(r.created_at).split("T")[0] : "2026-01-01"),
          branches: branchesCount,
          categories: categoriesCount,
          foodItems: foodItemsCount,
          mrr: plan === "Business" ? 89 : plan === "Enterprise" ? 299 : plan === "Starter" ? 29 : 0,
        };
      });
    }
  } catch (err) {
    console.error("[getAdminRestaurantsServer Error]", err);
  }

  return [];
});

export const getAdminDashboardMetricsServer = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      // 1. Restaurant metrics
      let totalRestaurants = 0;
      let activeRestaurants = 0;
      let newRestaurantsWeek = 0;
      try {
        const [rStats] = await query<Record<string, unknown>[]>(
          `SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_cnt,
            SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS new_week
           FROM restaurants`,
        );
        if (rStats) {
          totalRestaurants = Number(rStats.total || 0);
          activeRestaurants = Number(rStats.active_cnt || 0);
          newRestaurantsWeek = Number(rStats.new_week || 0);
        }
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] restaurants query fallback:", err);
      }

      // 2. Restaurant plan distribution & MRR
      let planMix = [
        { name: "Starter", value: 0, color: "#60a5fa", mrr: 29 },
        { name: "Business", value: 0, color: "#f59e0b", mrr: 89 },
        { name: "Enterprise", value: 0, color: "#e11d48", mrr: 299 },
        { name: "Free", value: 0, color: "#94a3b8", mrr: 0 },
      ];
      let calculatedMrr = 0;
      let activeSubs = 0;

      try {
        const planRows = await query<Record<string, unknown>[]>(
          `SELECT COALESCE(plan, 'Starter') AS plan, status, COUNT(*) AS cnt 
           FROM restaurants 
           GROUP BY plan, status`,
        );
        const planCountMap: Record<string, number> = {};
        for (const row of planRows || []) {
          const planName = String(row.plan || "Starter");
          const status = String(row.status || "active");
          const count = Number(row.cnt || 0);
          planCountMap[planName] = (planCountMap[planName] || 0) + count;
          const planRate =
            planName.toLowerCase() === "business"
              ? 89
              : planName.toLowerCase() === "enterprise"
                ? 299
                : planName.toLowerCase() === "starter"
                  ? 29
                  : 0;
          if (status === "active" && planRate > 0) {
            calculatedMrr += planRate * count;
            activeSubs += count;
          }
        }

        planMix = [
          { name: "Free", value: planCountMap["Free"] || 0, color: "#94a3b8", mrr: 0 },
          { name: "Starter", value: planCountMap["Starter"] || 0, color: "#60a5fa", mrr: 29 },
          { name: "Business", value: planCountMap["Business"] || 0, color: "#f59e0b", mrr: 89 },
          {
            name: "Enterprise",
            value: planCountMap["Enterprise"] || 0,
            color: "#e11d48",
            mrr: 299,
          },
        ];
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] plan query fallback:", err);
      }

      // 3. Platform Users metrics
      let totalUsers = 0;
      let activeUsers = 0;
      let newUsersToday = 0;
      try {
        const [uStats] = await query<Record<string, unknown>[]>(
          `SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_cnt,
            SUM(CASE WHEN created_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS new_today
           FROM users`,
        );
        if (uStats) {
          totalUsers = Number(uStats.total || 0);
          activeUsers = Number(uStats.active_cnt || 0);
          newUsersToday = Number(uStats.new_today || 0);
        }
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] users query fallback:", err);
      }

      // 4. Platform aggregates (Branches, Categories, Food Items, Orders, Revenue)
      let totalBranches = 0;
      let totalCategories = 0;
      let totalFoodItems = 0;
      let totalOrders = 0;
      let totalRevenue = 0;

      try {
        const [bRow] = await query<Record<string, unknown>[]>(
          `SELECT COUNT(*) AS total FROM branches`,
        );
        totalBranches = Number(bRow?.total || 0);

        const [cRow] = await query<Record<string, unknown>[]>(
          `SELECT COUNT(*) AS total FROM categories`,
        );
        totalCategories = Number(cRow?.total || 0);

        const [fRow] = await query<Record<string, unknown>[]>(
          `SELECT COUNT(*) AS total FROM food_items`,
        );
        totalFoodItems = Number(fRow?.total || 0);

        const [oRow] = await query<Record<string, unknown>[]>(
          `SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS rev FROM pos_orders`,
        );
        totalOrders = Number(oRow?.total || 0);
        totalRevenue = Number(oRow?.rev || 0);
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] aggregates fallback:", err);
      }

      // 5. Monthly Revenue / MRR Trend
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const now = new Date();
      const currentMonthIndex = now.getMonth();
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), currentMonthIndex - i, 1);
        last6Months.push({
          m: monthNames[d.getMonth()],
          ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          mrr: calculatedMrr > 0 ? calculatedMrr : 0,
          orders: 0,
        });
      }

      try {
        const orderTrends = await query<Record<string, unknown>[]>(
          `SELECT 
            DATE_FORMAT(created_at, '%Y-%m') AS ym,
            COUNT(*) AS order_cnt,
            COALESCE(SUM(total), 0) AS rev
           FROM pos_orders
           WHERE created_at >= NOW() - INTERVAL 6 MONTH
           GROUP BY ym`,
        );
        const orderMap = new Map<string, { count: number; rev: number }>();
        for (const row of orderTrends || []) {
          orderMap.set(String(row.ym || ""), {
            count: Number(row.order_cnt || 0),
            rev: Number(row.rev || 0),
          });
        }

        for (const mObj of last6Months) {
          const matched = orderMap.get(mObj.ym);
          if (matched) {
            mObj.orders = matched.count;
            mObj.mrr = calculatedMrr + matched.rev;
          }
        }
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] trend fallback:", err);
      }

      // 6. Recent Restaurants from DB
      let recentRestaurants: Array<{
        id: string;
        name: string;
        username: string;
        cuisine: string;
        location: string;
        plan: string;
        status: string;
        logoUrl: string;
        createdAt: string;
      }> = [];
      try {
        const rRows = await query<Record<string, unknown>[]>(
          `SELECT id, name, COALESCE(slug, '') AS username, 
                  COALESCE(cuisine, 'Multi-Cuisine') AS cuisine,
                  COALESCE(location, 'Main Location') AS location,
                  COALESCE(plan, 'Starter') AS plan,
                  COALESCE(status, 'active') AS status,
                  COALESCE(logo_url, '') AS logo_url,
                  created_at
           FROM restaurants
           ORDER BY id DESC LIMIT 5`,
        );
        recentRestaurants = (rRows || []).map((r) => ({
          id: String(r.id),
          name: String(r.name || ""),
          username: String(r.username || ""),
          cuisine: String(r.cuisine || "Multi-Cuisine"),
          location: String(r.location || "Main Location"),
          plan: String(r.plan || "Starter"),
          status: String(r.status || "active"),
          logoUrl: String(r.logo_url || ""),
          createdAt: r.created_at ? String(r.created_at).split("T")[0] : "Recent",
        }));
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] recent restaurants fallback:", err);
      }

      // 7. Recent Users from DB
      let recentUsers: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        avatarUrl?: string;
        createdAt: string;
      }> = [];
      try {
        const uRows = await query<Record<string, unknown>[]>(
          `SELECT u.id, COALESCE(u.full_name, 'User') AS name, u.email,
                  COALESCE(ur.role, 'Owner') AS role,
                  COALESCE(u.status, 'Active') AS status,
                  COALESCE(u.avatar_url, '') AS avatar_url,
                  u.created_at
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           WHERE LOWER(ur.role) IN ('owner', 'manager')
           ORDER BY (CASE WHEN LOWER(ur.role) = 'owner' THEN 0 ELSE 1 END) ASC, u.created_at DESC 
           LIMIT 5`,
        );
        recentUsers = (uRows || []).map((u) => {
          const name = String(u.name || "User");
          const email = String(u.email || "");
          const dbAvatar = String(u.avatar_url || "").trim();
          const avatarUrl =
            dbAvatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&bold=true`;

          return {
            id: String(u.id),
            name,
            email,
            role: String(u.role || "Owner"),
            status: String(u.status || "Active"),
            avatarUrl,
            createdAt: u.created_at ? String(u.created_at).split("T")[0] : "Recent",
          };
        });
      } catch (err) {
        console.warn("[getAdminDashboardMetricsServer] recent users fallback:", err);
      }

      return {
        totalRestaurants,
        activeRestaurants,
        newRestaurantsWeek,
        activeSubs,
        mrr: calculatedMrr,
        mrrDelta: newRestaurantsWeek > 0 ? `+${newRestaurantsWeek} this week` : "Stable",
        totalUsers,
        activeUsers,
        newUsersToday,
        totalBranches,
        totalCategories,
        totalFoodItems,
        totalOrders,
        totalRevenue,
        planMix,
        revenueTrend: last6Months,
        recentRestaurants,
        recentUsers,
      };
    } catch (err) {
      console.error("[getAdminDashboardMetricsServer Error]", err);
      throw err;
    }
  },
);

// =========================================================
// MUTATION SERVER FUNCTIONS
// =========================================================

/**
 * Generates per-branch daily DDMM01+ order numbers directly from MySQL DB.
 * Format: DDMM + 2-digit daily incrementing counter starting at 01 per branch (e.g. 080801, 080802, 080803...)
 * Scoped per branch (and restaurant tenant) with transaction FOR UPDATE row locking.
 */
async function generateDailyOrderNumber(
  conn: import("mysql2/promise").PoolConnection,
  restaurantId: number,
  branchId?: string | null,
): Promise<number> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const ddmm = `${dd}${mm}`; // e.g. "0808" for 8th August
  const minRange = Number(`${ddmm}00`); // 80800
  const maxRange = Number(`${ddmm}99`); // 80899

  let rows: import("mysql2/promise").RowDataPacket[];

  if (branchId) {
    [rows] = await conn.execute<import("mysql2/promise").RowDataPacket[]>(
      `SELECT COALESCE(MAX(order_number), ?) + 1 AS next_num 
       FROM pos_orders 
       WHERE restaurant_id = ? AND branch_id = ? AND order_number >= ? AND order_number <= ? 
       FOR UPDATE`,
      [minRange, restaurantId, branchId, minRange, maxRange],
    );
  } else {
    [rows] = await conn.execute<import("mysql2/promise").RowDataPacket[]>(
      `SELECT COALESCE(MAX(order_number), ?) + 1 AS next_num 
       FROM pos_orders 
       WHERE restaurant_id = ? AND order_number >= ? AND order_number <= ? 
       FOR UPDATE`,
      [minRange, restaurantId, minRange, maxRange],
    );
  }

  const nextNum = Number((rows?.[0] as { next_num?: number })?.next_num || minRange + 1);
  return nextNum;
}

export const placeOrderAction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      restaurantId: string;
      branchId: string | null;
      tableNumber: string;
      totalPrice: number;
      customerName: string;
      phone: string;
      items: Array<{
        itemId: string | null;
        name: string;
        quantity: number;
        price: number;
      }>;
    }) =>
      z
        .object({
          restaurantId: z.string(),
          branchId: z.string().nullable().optional(),
          tableNumber: z.string(),
          totalPrice: z.number(),
          customerName: z.string().min(1, "Customer name is required"),
          phone: z.string().min(1, "Phone number is required"),
          items: z
            .array(
              z.object({
                itemId: z.string().nullable(),
                name: z.string(),
                quantity: z.number(),
                price: z.number(),
              }),
            )
            .min(1, "Cart cannot be empty"),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    checkRateLimit("place_order", data.restaurantId, { maxRequests: 10, windowMs: 60 * 1000 });
    const { restaurantId, branchId, tableNumber, items, customerName, phone } = data;
    const tenant = await resolvePublicRestaurant(restaurantId);

    let resolvedBranchId = branchId ? String(branchId).trim() : null;
    let resolvedBranchName = "";

    try {
      if (tableNumber || resolvedBranchId) {
        const tRows = await query<Record<string, unknown>[]>(
          "SELECT branch_id FROM branch_tables WHERE restaurant_id = ? AND (qr_token = ? OR id = ? OR (table_no = ? AND branch_id IS NOT NULL)) LIMIT 1",
          [tenant.restaurantId, resolvedBranchId || "", resolvedBranchId || "", tableNumber || ""],
        );
        if (tRows && tRows.length > 0 && tRows[0].branch_id) {
          resolvedBranchId = String(tRows[0].branch_id);
        }
      }

      const bRows = await query<Record<string, unknown>[]>(
        "SELECT id, name, is_default FROM branches WHERE restaurant_id = ? ORDER BY is_default DESC, created_at ASC",
        [tenant.restaurantId],
      );
      if (bRows && bRows.length > 0) {
        let match: Record<string, unknown> | undefined;
        if (resolvedBranchId && resolvedBranchId !== "null" && resolvedBranchId !== "undefined") {
          const target = resolvedBranchId.toLowerCase().trim();
          match = bRows.find((b) => {
            const bId = String(b.id || "")
              .toLowerCase()
              .trim();
            const bName = String(b.name || "")
              .toLowerCase()
              .trim();
            const bSlug = bName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            return bId === target || bName === target || bSlug === target;
          });
        }
        if (!match) {
          match = bRows.find((b) => Number(b.is_default || 0) === 1) || bRows[0];
        }
        resolvedBranchId = String(match.id);
        resolvedBranchName = String(match.name || "");
      }
    } catch {
      /* fallback to raw branchId */
    }

    if (!resolvedBranchId || resolvedBranchId === "null" || resolvedBranchId === "undefined") {
      resolvedBranchId = "b1";
    }

    // Check order package limit using public tenant context (no staff session required)
    const sub = await getPublicTenantOrderLimits(tenant.restaurantId);
    if (sub.limits.maxOrders !== "unlimited" && sub.usage.orders >= sub.limits.maxOrders) {
      throw new Error(
        `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxOrders} order(s). Please upgrade your subscription package to process more orders.`,
      );
    }

    // 1. Recalculate item prices and subtotal/total on the server using authoritative MySQL prices
    const serverItems = await getFoodItemsServer({ data: tenant.slug });
    const priceMap = new Map<string, number>();
    for (const f of serverItems) {
      if (f.id) priceMap.set(String(f.id), Number(f.price || 0));
      if (f.name) priceMap.set(String(f.name).toLowerCase().trim(), Number(f.price || 0));
    }

    let calculatedSubtotal = 0;
    const validatedItems = items.map((item: any) => {
      let unitPrice = item.price;
      if (item.itemId && priceMap.has(item.itemId)) {
        unitPrice = priceMap.get(item.itemId)!;
      } else if (item.name && priceMap.has(item.name.toLowerCase().trim())) {
        unitPrice = priceMap.get(item.name.toLowerCase().trim())!;
      }
      const itemSubtotal = unitPrice * item.quantity;
      calculatedSubtotal += itemSubtotal;
      return {
        itemId: item.itemId || crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        price: unitPrice,
        subtotal: itemSubtotal,
      };
    });

    const calculatedTotal = calculatedSubtotal;
    const orderId = crypto.randomUUID();

    const linesJson = JSON.stringify(
      validatedItems.map((i: any) => ({
        itemId: i.itemId,
        name: i.name,
        qty: i.quantity,
        quantity: i.quantity,
        price: i.price,
        unitPrice: i.price,
        total: i.subtotal,
      })),
    );

    // 2. Wrap complete order creation in ONE database transaction with per-branch DDMM01+ sequential order_number
    let orderNumber = 0;
    await transaction(async (conn) => {
      orderNumber = await generateDailyOrderNumber(conn, tenant.restaurantId, resolvedBranchId);

      try {
        await conn.execute(
          "INSERT INTO orders (id, restaurant_id, branch_id, table_number, subtotal, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            orderId,
            tenant.restaurantId,
            resolvedBranchId,
            tableNumber,
            calculatedSubtotal,
            calculatedTotal,
            "pending",
          ],
        );
      } catch {
        /* ignore if legacy orders table structure differs */
      }

      await conn.execute(
        `INSERT INTO pos_orders (
          id, restaurant_id, branch_id, order_number, type, status, table_number, customer_name, phone, notes,
          lines_json, subtotal, discount_type, discount_value, discount_amount, tax, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          tenant.restaurantId,
          resolvedBranchId,
          orderNumber,
          "dine-in",
          "pending",
          tableNumber || null,
          sanitizeText(customerName.trim()),
          sanitizeText(phone.trim()),
          `Table ${tableNumber || "Order"} · ${sanitizeText(customerName.trim())} (${sanitizeText(phone.trim())})`,
          linesJson,
          calculatedSubtotal,
          "amount",
          0,
          0,
          0,
          calculatedTotal,
        ],
      );

      for (const item of validatedItems) {
        const orderItemId = crypto.randomUUID();
        await conn.execute(
          "INSERT INTO order_items (id, order_id, food_item_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [orderItemId, orderId, item.itemId, item.name, item.quantity, item.price, item.subtotal],
        );
      }
    });

    broadcastRealtimeEvent({
      type: "order:created",
      restaurantId: tenant.restaurantId,
      tenantSlug: tenant.slug,
      branchId: resolvedBranchId,
      branchName: resolvedBranchName,
      payload: {
        id: orderId,
        number: orderNumber,
        branchId: resolvedBranchId,
        branchName: resolvedBranchName,
        status: "pending",
        tableNumber,
        customerName: sanitizeText(customerName.trim()),
        phone: sanitizeText(phone.trim()),
        lines: validatedItems.map((i: any) => ({
          itemId: i.itemId,
          name: i.name,
          qty: i.quantity,
          quantity: i.quantity,
          price: i.price,
          unitPrice: i.price,
          total: i.subtotal,
        })),
        total: calculatedTotal,
        type: "dine-in",
        createdAt: new Date().toISOString(),
      },
    });

    // Send background OS Web Push Notification with kitchen-bell chime & unread badge
    sendPushNotification(
      {
        restaurantId: tenant.restaurantId,
        branchId: resolvedBranchId || null,
        roles: ["owner", "manager", "cashier", "chef", "waiter"],
      },
      {
        title: `🔔 New Order #${orderNumber} (${tableNumber ? `Table ${tableNumber}` : "Dine-in"})`,
        body: `${validatedItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")} • Total: ${calculatedTotal}`,
        sound: "kitchen-bell",
        orderId,
        url: "/orders",
        unreadCount: 1,
      },
    ).catch(() => {});

    return { id: orderId, total: calculatedTotal };
  });

// =========================================================
// RESTAURANT PROFILE MYSQL SERVER FUNCTIONS
import fs from "node:fs";
import path from "node:path";

// =========================================================
// RESTAURANT PROFILE MYSQL & DISK CACHE SERVER FUNCTIONS
// =========================================================

function getProfileFilePath() {
  if (typeof window !== "undefined") return "";
  return path.join(process.cwd(), "profile-data-cache.json");
}

type ProfileAppearance = {
  themeColor?: string;
  menuLayout?: string;
  fontFamily?: string;
};

type ProfileCache = Record<string, string | number | boolean | ProfileAppearance | undefined>;

async function ensureRestaurantAppearanceColumns() {
  try {
    const pool = await getPool();
    const statements = [
      "ALTER TABLE restaurants ADD COLUMN theme_color VARCHAR(50) DEFAULT 'amber'",
      "ALTER TABLE restaurants ADD COLUMN menu_layout VARCHAR(50) DEFAULT 'cards'",
      "ALTER TABLE restaurants ADD COLUMN font_family VARCHAR(50) DEFAULT 'sans'",
      "ALTER TABLE restaurants ADD COLUMN favicon_url TEXT",
      "ALTER TABLE restaurants ADD COLUMN og_image_url TEXT",
      "ALTER TABLE restaurants ADD COLUMN meta_title TEXT",
      "ALTER TABLE restaurants ADD COLUMN is_indexed TINYINT(1) DEFAULT 1",
      "ALTER TABLE restaurants ADD COLUMN facebook_url TEXT",
      "ALTER TABLE restaurants ADD COLUMN instagram_url TEXT",
      "ALTER TABLE restaurants ADD COLUMN whatsapp_number TEXT",
      "ALTER TABLE restaurants ADD COLUMN intro TEXT",
      "ALTER TABLE restaurants ADD COLUMN description TEXT",
      "ALTER TABLE restaurants ADD COLUMN about TEXT",
      "ALTER TABLE restaurants ADD COLUMN operating_hours VARCHAR(255)",
      "ALTER TABLE restaurants ADD COLUMN facilities TEXT",
      "ALTER TABLE restaurants ADD COLUMN prep_time VARCHAR(100)",
      "ALTER TABLE restaurants ADD COLUMN rating VARCHAR(100)",
      "ALTER TABLE restaurants ADD COLUMN cover_url TEXT",
      "ALTER TABLE restaurants ADD COLUMN logo_url TEXT",
    ];

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch {
        /* column may already exist */
      }
    }
  } catch {
    /* ignore */
  }
}

function coerceProfileAppearance(value: unknown): ProfileAppearance {
  if (!value || typeof value !== "object") return {};
  const appearance = value as Record<string, unknown>;
  return {
    themeColor:
      appearance.themeColor && String(appearance.themeColor).trim()
        ? String(appearance.themeColor).trim()
        : undefined,
    menuLayout:
      appearance.menuLayout && String(appearance.menuLayout).trim()
        ? String(appearance.menuLayout).trim()
        : undefined,
    fontFamily:
      appearance.fontFamily && String(appearance.fontFamily).trim()
        ? String(appearance.fontFamily).trim()
        : undefined,
  };
}

function loadProfileFromFile(): ProfileCache {
  return {};
}

function saveProfileToFile(_data: ProfileCache) {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

const LIVE_PROFILE_STORES: Record<string, ProfileCache> = {};

export const getRestaurantProfile = createServerFn({ method: "GET" })
  .validator((slugOrEmail?: string) => z.string().optional().parse(slugOrEmail))
  .handler(async ({ data: customSlugOrEmail }) => {
    const tenant = customSlugOrEmail
      ? await resolvePublicRestaurant(customSlugOrEmail)
      : await resolvePrivateTenantContext();

    if (customSlugOrEmail && tenant.restaurantId === 0) {
      return null;
    }
    // Resolve target slug and tenant identity
    const targetSlug = tenant.slug;
    const isSultans = tenant.restaurantId === 2 || targetSlug === "sultansdine";

    let dynamicName = targetSlug
      ? targetSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Gourmet Kitchen";
    let dynamicLocation = "Main Location";
    try {
      const restRows = await query<Record<string, unknown>[]>(
        "SELECT name, location FROM restaurants WHERE id = ? OR slug = ? LIMIT 1",
        [tenant.restaurantId, targetSlug],
      );
      if (restRows && restRows.length > 0) {
        if (restRows[0].name) dynamicName = String(restRows[0].name);
        if (restRows[0].location) dynamicLocation = String(restRows[0].location);
      }
    } catch {
      /* ignore */
    }

    const defaultProfile = isSultans
      ? {
          name: "Sultan's Dine",
          slug: "sultansdine",
          address: "Satmasjid Road, Dhanmondi, Dhaka",
          intro:
            "Experience royal Kacchi Biryani & traditional Mughal delicacies at Sultan's Dine.",
          description:
            "Sultan's Dine brings you authentic, aromatic Basmati Kacchi Biryani cooked over slow wood fires with premium mutton and fragrant spices.",
          about:
            "Established with a royal heritage in traditional Bengali & Mughal cuisine, Sultan's Dine is famous for its legendary Kacchi Biryani, Borhani, and Firni.",
          openingHours: "12:00 PM - 11:00 PM",
          phone: "+880 1912-990011",
          facilities: "Air Conditioned, Private Dining, Family Party Space, bKash & Card Payments",
          rating: "4.9 Stars (1.5k reviews)",
          avgPrepTime: "10-20 min",
          cuisineType: "Traditional Mughal & Kacchi Biryani",
          logo: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=80&auto=format&fit=crop&q=80",
          cover:
            "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80",
          favicon: "",
          socialPreview: "",
          appearance: { themeColor: "rose", menuLayout: "cards", fontFamily: "serif" },
        }
      : {
          name: dynamicName,
          slug: targetSlug,
          address: dynamicLocation,
          intro: `Welcome to ${dynamicName} digital menu. Scan our unique QR codes directly at your table to place real-time kitchen orders instantly.`,
          description: `Welcome to ${dynamicName}, where we specialize in serving premium quality gourmet options.`,
          about: `${dynamicName} was founded with a passion for authentic culinary experiences, bringing together high-grade ingredients and artisan recipes.`,
          openingHours: "11:00 AM - 11:30 PM",
          phone: "+880 1700-112233",
          facilities: "Air Conditioned, Wifi, Table QR ordering, bKash payments accepted",
          rating: "4.9 Stars (340 reviews)",
          avgPrepTime: "15-25 min",
          cuisineType: "Gourmet Kitchen",
          logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
          cover:
            "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
          favicon: "",
          socialPreview: "",
          appearance: { themeColor: "amber", menuLayout: "cards", fontFamily: "sans" },
        };

    const live = LIVE_PROFILE_STORES[targetSlug] || {};

    let dbData: ProfileCache = {};
    try {
      await ensureRestaurantAppearanceColumns();
      const restaurants = await query<Record<string, unknown>[]>(
        "SELECT id, name, slug, intro, description, about, logo_url, cover_url, favicon_url, og_image_url, cuisine, phone, location, operating_hours, facilities, prep_time, rating, theme_color, menu_layout, font_family, facebook_url, instagram_url, whatsapp_number, COALESCE(is_verified, 0) AS is_verified FROM restaurants WHERE id = ? OR slug = ? LIMIT 1",
        [tenant.restaurantId, targetSlug],
      );

      if (restaurants && restaurants.length > 0) {
        const r = restaurants[0];
        dbData = {
          name: String(r.name || ""),
          slug: String(r.slug || ""),
          address: String(r.location || ""),
          intro: String(r.intro || ""),
          description: String(r.description || ""),
          about: String(r.about || ""),
          openingHours: String(r.operating_hours || ""),
          phone: String(r.phone || ""),
          facilities: String(r.facilities || ""),
          rating: String(r.rating || ""),
          avgPrepTime: String(r.prep_time || ""),
          cuisineType: String(r.cuisine || ""),
          logo:
            !String(r.logo_url || "").trim() ||
            String(r.logo_url || "").includes("ibb.co/2ndCYJK") ||
            String(r.logo_url || "").includes("image-not-found")
              ? defaultProfile.logo || "/default-logo.png"
              : String(r.logo_url || ""),
          cover:
            !String(r.cover_url || "").trim() ||
            String(r.cover_url || "").includes("image-not-found")
              ? defaultProfile.cover ||
                "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=80"
              : String(r.cover_url || ""),
          favicon: String(r.favicon_url || r.logo_url || ""),
          socialPreview: String(r.og_image_url || ""),
          facebookUrl: String(r.facebook_url || ""),
          instagramUrl: String(r.instagram_url || ""),
          whatsappNumber: String(r.whatsapp_number || ""),
          isVerified: Number(r.is_verified) === 1,
          appearance: {
            themeColor: String(r.theme_color || ""),
            menuLayout: String(r.menu_layout || ""),
            fontFamily: String(r.font_family || ""),
          },
        };
      } else if (tenant.restaurantId === 0) {
        return null;
      }
    } catch (err) {
      console.error("[MySQL] getRestaurantProfile query error:", err);
    }

    let dynamicCurrency = "BDT";
    try {
      const settingRows = await query<Record<string, unknown>[]>(
        "SELECT setting_key, setting_value FROM restaurant_settings WHERE (restaurant_id = ? OR restaurant_id = ?) AND (setting_key = 'currency' OR setting_key = 'app_settings') ORDER BY updated_at DESC",
        [String(tenant.restaurantId), targetSlug],
      );
      if (settingRows && settingRows.length > 0) {
        for (const sr of settingRows) {
          let found: string | null = null;
          if (sr.setting_key === "currency" && sr.setting_value) {
            found = String(sr.setting_value).trim();
          } else if (sr.setting_key === "app_settings" && sr.setting_value) {
            try {
              const parsed =
                typeof sr.setting_value === "string"
                  ? JSON.parse(sr.setting_value)
                  : sr.setting_value;
              if (
                parsed &&
                typeof parsed === "object" &&
                (parsed as Record<string, unknown>).currency
              ) {
                found = String((parsed as Record<string, unknown>).currency).trim();
              }
            } catch {
              /* ignore */
            }
          }
          if (found) {
            dynamicCurrency = found;
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }

    const liveApp = coerceProfileAppearance(live.appearance);
    const dbApp = coerceProfileAppearance(dbData.appearance);
    const defApp = defaultProfile.appearance;

    const appearance = {
      themeColor: liveApp.themeColor || dbApp.themeColor || defApp.themeColor,
      menuLayout: liveApp.menuLayout || dbApp.menuLayout || defApp.menuLayout,
      fontFamily: liveApp.fontFamily || dbApp.fontFamily || defApp.fontFamily,
    };

    return {
      name: String(live.name || dbData.name || defaultProfile.name),
      currency: dynamicCurrency,
      slug: String(live.slug || dbData.slug || defaultProfile.slug || targetSlug || ""),
      address: String(live.address || dbData.address || defaultProfile.address),
      intro: String(live.intro || dbData.intro || defaultProfile.intro),
      description: String(live.description || dbData.description || defaultProfile.description),
      about: String(live.about || dbData.about || defaultProfile.about),
      openingHours: String(live.openingHours || dbData.openingHours || defaultProfile.openingHours),
      phone: String(live.phone || dbData.phone || defaultProfile.phone),
      facilities: String(live.facilities || dbData.facilities || defaultProfile.facilities),
      rating: String(live.rating || dbData.rating || defaultProfile.rating),
      avgPrepTime: String(live.avgPrepTime || dbData.avgPrepTime || defaultProfile.avgPrepTime),
      cuisineType: String(live.cuisineType || dbData.cuisineType || defaultProfile.cuisineType),
      logo: String(live.logo || dbData.logo || defaultProfile.logo),
      cover: String(live.cover || dbData.cover || defaultProfile.cover),
      favicon: String(
        live.favicon ||
          dbData.favicon ||
          defaultProfile.favicon ||
          live.logo ||
          dbData.logo ||
          defaultProfile.logo ||
          "",
      ),
      socialPreview: String(
        live.socialPreview || dbData.socialPreview || defaultProfile.socialPreview,
      ),
      facebookUrl: String(live.facebookUrl || dbData.facebookUrl || ""),
      instagramUrl: String(live.instagramUrl || dbData.instagramUrl || ""),
      whatsappNumber: String(live.whatsappNumber || dbData.whatsappNumber || ""),
      isVerified:
        live.isVerified !== undefined
          ? Boolean(live.isVerified)
          : dbData.isVerified !== undefined
            ? Boolean(dbData.isVerified)
            : true,
      appearance,
    };
  });

export const updateRestaurantStatusServer = createServerFn({ method: "POST" })
  .validator((data: { id: string | number; status: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");
    await query("UPDATE restaurants SET status = ? WHERE id = ?", [data.status, data.id]);
    return { ok: true };
  });

export const updateRestaurantVerificationServer = createServerFn({ method: "POST" })
  .validator((data: { id: string | number; isVerified: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");
    try {
      await query("ALTER TABLE restaurants ADD COLUMN is_verified TINYINT(1) DEFAULT 1;");
    } catch {
      /* ignore if column exists */
    }
    await query("UPDATE restaurants SET is_verified = ? WHERE id = ?", [
      data.isVerified ? 1 : 0,
      data.id,
    ]);

    try {
      const rows = await query<Record<string, unknown>[]>(
        "SELECT slug FROM restaurants WHERE id = ? LIMIT 1",
        [data.id],
      );
      if (rows && rows[0]?.slug) {
        const slug = String(rows[0].slug);
        LIVE_PROFILE_STORES[slug] = {
          ...(LIVE_PROFILE_STORES[slug] || {}),
          isVerified: data.isVerified,
        };
      }
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

export const getAdminSeoServer = createServerFn({ method: "GET" }).handler(async () => {
  await requireAuth();
  await requirePermission("platform:manage_restaurants");
  await ensureRestaurantAppearanceColumns();

  const rows = await query<Record<string, unknown>[]>(
    `SELECT 
      r.id,
      r.name,
      r.slug AS username,
      r.intro,
      r.description,
      r.meta_title,
      r.logo_url,
      r.cover_url,
      r.favicon_url,
      r.og_image_url,
      COALESCE(r.is_indexed, 1) AS is_indexed
     FROM restaurants r
     ORDER BY r.id ASC`,
  );

  return (rows || []).map((r) => {
    const name = String(r.name || "");
    const username = String(r.username || "").toLowerCase();
    const metaTitle = String(r.meta_title || `${name} — Digital Menu & Table QR Ordering`);
    const metaDescription = String(
      r.description || r.intro || `Browse the official digital menu for ${name}.`,
    );

    const faviconUrl = String(r.favicon_url || "");
    const ogImageUrl = String(r.og_image_url || "");

    const isIndexed = r.is_indexed === 1 || r.is_indexed === null || r.is_indexed === undefined;

    let score = 50;
    if (metaTitle) score += 15;
    if (metaDescription) score += 15;
    if (faviconUrl) score += 10;
    if (ogImageUrl) score += 10;

    return {
      id: String(r.id),
      name,
      username: String(r.username || ""),
      metaTitle,
      metaDescription,
      faviconUrl,
      ogImageUrl,
      isIndexed,
      healthScore: score,
    };
  });
});

export const saveAdminSeoServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string | number;
      metaTitle?: string;
      metaDescription?: string;
      faviconUrl?: string;
      ogImageUrl?: string;
      isIndexed?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");
    await ensureRestaurantAppearanceColumns();

    await query(
      `UPDATE restaurants SET 
        meta_title = COALESCE(?, meta_title),
        description = COALESCE(?, description),
        favicon_url = ?,
        og_image_url = ?,
        is_indexed = COALESCE(?, is_indexed)
      WHERE id = ? OR slug = ?`,
      [
        data.metaTitle ?? null,
        data.metaDescription ?? null,
        data.faviconUrl ?? "",
        data.ogImageUrl ?? "",
        data.isIndexed !== undefined ? (data.isIndexed ? 1 : 0) : null,
        data.id,
        data.id,
      ],
    );

    return { ok: true };
  });

export const createRestaurantServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name: string;
      slug: string;
      cuisine?: string;
      location?: string;
      plan?: string;
      status?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    const cleanSlug = data.slug.toLowerCase().trim().replace(/\s+/g, "-");
    const res = await query<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO restaurants (name, slug, username, cuisine, location, plan, status, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, '/default-logo.png')`,
      [
        data.name,
        cleanSlug,
        cleanSlug,
        data.cuisine || "Gourmet Kitchen",
        data.location || "Main Location",
        data.plan || "Starter",
        data.status || "active",
      ],
    );

    if (res.insertId) {
      try {
        await query(
          `INSERT INTO branches (id, restaurant_id, name, address, location, status, is_default)
           VALUES (?, ?, ?, ?, ?, 'open', 1)`,
          [
            `branch-main-${res.insertId}`,
            res.insertId,
            "Main Branch",
            data.location || "Main Location",
            data.location || "Main Location",
          ],
        );
      } catch (branchErr) {
        console.warn("[createRestaurantServer] Branch insert fallback notice:", branchErr);
        try {
          await query(
            `INSERT INTO branches (id, restaurant_id, name, status, is_default)
             VALUES (?, ?, ?, 'open', 1)`,
            [`branch-main-${res.insertId}`, res.insertId, "Main Branch"],
          );
        } catch {
          /* ignore */
        }
      }
    }

    return { id: res.insertId, slug: cleanSlug };
  });

export const updateRestaurantDetailsServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string | number;
      name?: string;
      slug?: string;
      cuisine?: string;
      location?: string;
      plan?: string;
      status?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    const cleanSlug = data.slug ? data.slug.toLowerCase().trim().replace(/\s+/g, "-") : null;

    await query(
      `UPDATE restaurants SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        username = COALESCE(?, username),
        cuisine = COALESCE(?, cuisine),
        location = COALESCE(?, location),
        plan = COALESCE(?, plan),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        data.name || null,
        cleanSlug,
        cleanSlug,
        data.cuisine || null,
        data.location || null,
        data.plan || null,
        data.status || null,
        data.id,
      ],
    );

    if (data.slug || data.name) {
      const slugKey = data.slug ? data.slug.toLowerCase().trim().replace(/\s+/g, "-") : "";
      if (slugKey) {
        LIVE_PROFILE_STORES[slugKey] = {
          ...(LIVE_PROFILE_STORES[slugKey] || {}),
          ...(data.name ? { name: data.name } : {}),
          ...(data.location ? { address: data.location } : {}),
          ...(data.cuisine ? { cuisineType: data.cuisine } : {}),
        };
      }
    }

    return { success: true };
  });

export const updateRestaurantCustomLimitsServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string | number;
      plan?: string;
      mrr?: number;
      customLimits?: {
        maxBranches?: number | "unlimited";
        maxItems?: number | "unlimited";
        maxOrders?: number | "unlimited";
        maxStaff?: number | "unlimited";
        mrrPrice?: number | string;
        features?: Record<string, boolean>;
        notes?: string;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    const customLimitsJson = data.customLimits ? JSON.stringify(data.customLimits) : null;

    try {
      await query(
        `UPDATE restaurants SET
          plan = COALESCE(?, plan),
          mrr = COALESCE(?, mrr),
          custom_limits = COALESCE(?, custom_limits)
         WHERE id = ?`,
        [data.plan || null, data.mrr !== undefined ? data.mrr : null, customLimitsJson, data.id],
      );
    } catch {
      await query(
        `UPDATE restaurants SET
          plan = COALESCE(?, plan)
         WHERE id = ?`,
        [data.plan || null, data.id],
      );
    }

    return { success: true };
  });

export const submitEnterpriseInquiryServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      restaurantId?: string | number;
      restaurantName?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      estimatedBranches?: string;
      estimatedItems?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth();
    console.log("[Enterprise Inquiry Submitted]", data, session.email);
    return { success: true, message: "Enterprise custom plan inquiry submitted successfully!" };
  });

export const deleteRestaurantServer = createServerFn({ method: "POST" })
  .validator((data: { id: string | number }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    await query("DELETE FROM restaurants WHERE id = ?", [data.id]);
    await query("DELETE FROM branches WHERE restaurant_id = ?", [data.id]);
    await query("DELETE FROM food_items WHERE restaurant_id = ?", [data.id]);
    await query("DELETE FROM categories WHERE restaurant_id = ?", [data.id]);

    return { success: true };
  });

export const updateRestaurantProfile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name?: string;
      address?: string;
      intro?: string;
      description?: string;
      about?: string;
      openingHours?: string;
      phone?: string;
      facilities?: string;
      rating?: string;
      avgPrepTime?: string;
      cuisineType?: string;
      logo?: string;
      cover?: string;
      favicon?: string;
      socialPreview?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      whatsappNumber?: string;
      appearance?: ProfileAppearance;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requirePermission("restaurant:update_profile");
    const tenant = await resolvePrivateTenantContext();
    const targetSlug = tenant.slug;

    LIVE_PROFILE_STORES[targetSlug] = {
      ...(LIVE_PROFILE_STORES[targetSlug] || {}),
      ...data,
    };

    try {
      await ensureRestaurantAppearanceColumns();

      const updates: string[] = [];
      const values: unknown[] = [];

      if (data.name !== undefined) {
        updates.push("name = ?");
        values.push(data.name);
      }
      if (data.logo && !data.logo.startsWith("blob:")) {
        updates.push("logo_url = ?");
        values.push(data.logo);
      }
      if (data.cover && !data.cover.startsWith("blob:")) {
        updates.push("cover_url = ?");
        values.push(data.cover);
      }
      if (data.favicon && !data.favicon.startsWith("blob:")) {
        updates.push("favicon_url = ?");
        values.push(data.favicon);
      }
      if (data.socialPreview && !data.socialPreview.startsWith("blob:")) {
        updates.push("og_image_url = ?");
        values.push(data.socialPreview);
      }
      if (data.cuisineType !== undefined) {
        updates.push("cuisine = ?");
        values.push(data.cuisineType);
      }
      if (data.phone !== undefined) {
        updates.push("phone = ?");
        values.push(data.phone);
      }
      if (data.intro !== undefined) {
        updates.push("intro = ?");
        values.push(data.intro);
      }
      if (data.description !== undefined) {
        updates.push("description = ?");
        values.push(data.description);
      }
      if (data.about !== undefined) {
        updates.push("about = ?");
        values.push(data.about);
      }
      if (data.openingHours !== undefined) {
        updates.push("operating_hours = ?");
        values.push(data.openingHours);
      }
      if (data.facilities !== undefined) {
        updates.push("facilities = ?");
        values.push(data.facilities);
      }
      if (data.address !== undefined) {
        updates.push("location = ?");
        values.push(data.address);
      }
      if (data.appearance?.themeColor !== undefined) {
        updates.push("theme_color = ?");
        values.push(data.appearance.themeColor);
      }
      if (data.appearance?.menuLayout !== undefined) {
        updates.push("menu_layout = ?");
        values.push(data.appearance.menuLayout);
      }
      if (data.appearance?.fontFamily !== undefined) {
        updates.push("font_family = ?");
        values.push(data.appearance.fontFamily);
      }
      if (data.facebookUrl !== undefined) {
        updates.push("facebook_url = ?");
        values.push(data.facebookUrl);
      }
      if (data.instagramUrl !== undefined) {
        updates.push("instagram_url = ?");
        values.push(data.instagramUrl);
      }
      if (data.whatsappNumber !== undefined) {
        updates.push("whatsapp_number = ?");
        values.push(data.whatsappNumber);
      }

      if (updates.length > 0) {
        const sql = `UPDATE restaurants SET ${updates.join(", ")} WHERE id = ? OR slug = ?`;
        values.push(tenant.restaurantId, targetSlug);
        await query(sql, values);
      }

      return { success: true };
    } catch (err) {
      console.error("[MySQL] updateRestaurantProfile query error:", err);
      try {
        if (data.logo && !data.logo.startsWith("blob:")) {
          await query("UPDATE restaurants SET logo_url = ? WHERE id = ? OR slug = ?", [
            data.logo,
            tenant.restaurantId,
            targetSlug,
          ]);
        }
        if (data.cover && !data.cover.startsWith("blob:")) {
          await query("UPDATE restaurants SET cover_url = ? WHERE id = ? OR slug = ?", [
            data.cover,
            tenant.restaurantId,
            targetSlug,
          ]);
        }
        if (data.name) {
          await query("UPDATE restaurants SET name = ? WHERE id = ? OR slug = ?", [
            data.name,
            tenant.restaurantId,
            targetSlug,
          ]);
        }
        return { success: true };
      } catch (fallbackErr) {
        console.error("[MySQL] updateRestaurantProfile fallback error:", fallbackErr);
        throw new Error("Failed to update restaurant profile in database");
      }
    }
  });

export type DbBranchRecord = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  manager?: string;
  status?: string;
  isDefault?: boolean;
  menuId?: string;
};

function getBranchesFilePath() {
  if (typeof window !== "undefined") return "";
  return path.join(process.cwd(), "branches-data-cache.json");
}

function loadBranchesFromFile(): DbBranchRecord[] {
  return [];
}

function saveBranchesToFile(_data: DbBranchRecord[]) {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

async function resolvePublicRestaurant(
  customSlugOrEmail?: string,
): Promise<{ restaurantId: number; slug: string }> {
  const target = (customSlugOrEmail || "burgercraftlab").toLowerCase().trim();
  const slugWithoutLab = target.replace(/lab$/i, "");
  const slugWithLab = target.endsWith("lab") ? target : `${target}lab`;

  try {
    const rows = await query<Record<string, unknown>[]>(
      "SELECT id, slug FROM restaurants WHERE slug = ? OR slug = ? OR slug = ? OR id = ? LIMIT 1",
      [target, slugWithoutLab, slugWithLab, target],
    );
    if (rows && rows.length > 0) {
      return {
        restaurantId: Number(rows[0].id),
        slug: String(rows[0].slug || target),
      };
    }
  } catch {
    /* fallback if DB initializing */
  }

  return {
    restaurantId: 0,
    slug: target,
  };
}

async function resolvePrivateTenantContext(): Promise<{
  restaurantId: number;
  slug: string;
  userId: string;
  role: string | null;
  branch: string | null;
  isGlobalAdmin: boolean;
}> {
  const user = await verifySession();
  if (!user) {
    throw new Error("Unauthorized: Session required for tenant operation");
  }

  let restaurantId: number | null = null;
  let slug = "burgercraftlab";

  if (user.restaurant_id && Number(user.restaurant_id) > 0) {
    restaurantId = Number(user.restaurant_id);
  } else {
    try {
      const roles = await query<Record<string, unknown>[]>(
        "SELECT restaurant_id FROM user_roles WHERE user_id = ? AND restaurant_id IS NOT NULL AND restaurant_id > 0 LIMIT 1",
        [user.id],
      );
      if (roles && roles.length > 0 && roles[0].restaurant_id) {
        restaurantId = Number(roles[0].restaurant_id);
      }
    } catch {
      /* ignore */
    }
  }

  if (!restaurantId || isNaN(restaurantId) || restaurantId <= 0) {
    try {
      const owned = await query<Record<string, unknown>[]>(
        "SELECT id, slug FROM restaurants WHERE owner_email = ? OR owner_id = ? LIMIT 1",
        [user.email, user.id],
      );
      if (owned && owned.length > 0 && owned[0].id) {
        restaurantId = Number(owned[0].id);
        if (owned[0].slug) slug = String(owned[0].slug);
      }
    } catch {
      /* ignore */
    }

    if (!restaurantId || isNaN(restaurantId) || restaurantId <= 0) {
      try {
        const firstRest = await query<Record<string, unknown>[]>(
          "SELECT id, slug FROM restaurants ORDER BY id ASC LIMIT 1",
        );
        if (firstRest && firstRest.length > 0 && firstRest[0].id) {
          restaurantId = Number(firstRest[0].id);
          if (firstRest[0].slug) slug = String(firstRest[0].slug);
        }
      } catch {
        /* ignore */
      }
    }

    if (!restaurantId || isNaN(restaurantId) || restaurantId <= 0) {
      restaurantId = 1;
    }
  }

  try {
    const restaurants = await query<Record<string, unknown>[]>(
      "SELECT slug FROM restaurants WHERE id = ? LIMIT 1",
      [restaurantId],
    );
    if (restaurants && restaurants.length > 0 && restaurants[0].slug) {
      slug = String(restaurants[0].slug);
    } else if (restaurantId === 2) {
      slug = "sultansdine";
    }
  } catch {
    if (restaurantId === 2) slug = "sultansdine";
  }

  const roleClean = (user.role || "").toLowerCase().trim();
  const isGlobalAdmin =
    roleClean === "super_admin" || roleClean === "superadmin" || roleClean === "owner";

  let userBranch = user.branch || null;
  if (!userBranch && user.id) {
    try {
      const uRows = await query<Record<string, unknown>[]>(
        "SELECT branch FROM users WHERE id = ? LIMIT 1",
        [user.id],
      );
      if (uRows && uRows.length > 0 && uRows[0].branch) {
        userBranch = String(uRows[0].branch);
      }
    } catch {
      /* ignore */
    }
  }

  return {
    restaurantId,
    slug,
    userId: user.id,
    role: user.role || null,
    branch: userBranch,
    isGlobalAdmin,
  };
}

async function resolveTenantContext(
  customSlugOrEmail?: string,
): Promise<{ restaurantId: number; slug: string }> {
  if (customSlugOrEmail) {
    return resolvePublicRestaurant(customSlugOrEmail);
  }
  return await resolvePrivateTenantContext();
}

const DEFAULT_BRANCHES_MAP: Record<string, DbBranchRecord[]> = {
  burgercraftlab: [
    {
      id: "downtown",
      name: "Downtown Flagship",
      address: "221 Baker Street, New York, NY",
      phone: "+1 (555) 010-2233",
      manager: "Sabrina Rahman",
      status: "open",
      isDefault: true,
      menuId: "menu-downtown",
    },
    {
      id: "dhanmondi",
      name: "Dhanmondi Branch",
      address: "Road 27, Dhanmondi, Dhaka",
      phone: "+880 1712-345678",
      manager: "Tariqul Islam",
      status: "open",
      isDefault: false,
      menuId: "menu-dhanmondi",
    },
    {
      id: "gulshan",
      name: "Gulshan Branch",
      address: "Road 11, Gulshan-2, Dhaka",
      phone: "+880 1712-876543",
      manager: "Tamanna Akter",
      status: "open",
      isDefault: false,
      menuId: "menu-gulshan",
    },
    {
      id: "uttara",
      name: "Uttara Branch",
      address: "Sector 11, Uttara, Dhaka",
      phone: "+880 1712-112233",
      manager: "Arif Chowdhury",
      status: "open",
      isDefault: false,
      menuId: "menu-uttara",
    },
  ],
  sultansdine: [
    {
      id: "sd-dhanmondi",
      name: "Dhanmondi Main Branch",
      address: "754 Satmasjid Road, Dhanmondi, Dhaka",
      phone: "+880 1912-990011",
      manager: "Kabir Khan",
      status: "open",
      isDefault: true,
      menuId: "menu-sd-dhanmondi",
    },
    {
      id: "sd-gulshan",
      name: "Gulshan Avenue Branch",
      address: "Plot 35, Gulshan Avenue, Dhaka",
      phone: "+880 1912-990022",
      manager: "Faria Ahmed",
      status: "open",
      isDefault: false,
      menuId: "menu-sd-gulshan",
    },
    {
      id: "sd-mirpur",
      name: "Mirpur 10 Branch",
      address: "Circle 10, Mirpur, Dhaka",
      phone: "+880 1912-990033",
      manager: "Imran Hossain",
      status: "open",
      isDefault: false,
      menuId: "menu-sd-mirpur",
    },
    {
      id: "sd-chittagong",
      name: "Chittagong GEC Branch",
      address: "GEC Circle, Chittagong",
      phone: "+880 1912-990044",
      manager: "Mehnaz Parveen",
      status: "open",
      isDefault: false,
      menuId: "menu-sd-gec",
    },
  ],
};

export type UserAssignedBranchesInfo = {
  isAll: boolean;
  branches: DbBranchRecord[];
  branchIds: string[];
  branchNames: string[];
};

export async function getUserAssignedBranches(tenant: {
  restaurantId: number;
  userId: string;
  role: string | null;
  branch: string | null;
  isGlobalAdmin: boolean;
  userEmail?: string | null;
  userName?: string | null;
}): Promise<UserAssignedBranchesInfo> {
  let allDbBranches: DbBranchRecord[] = [];
  try {
    const rows = await query<Record<string, unknown>[]>(
      "SELECT id, name, address, phone, manager, status, is_default as isDefault, menu_id as menuId FROM branches WHERE restaurant_id = ? ORDER BY is_default DESC, created_at ASC",
      [tenant.restaurantId],
    );
    if (rows && rows.length > 0) {
      allDbBranches = rows.map((b) => ({
        id: String(b.id || ""),
        name: String(b.name || ""),
        address: String(b.address || ""),
        phone: String(b.phone || ""),
        manager: String(b.manager || ""),
        status: (b.status as string) || "open",
        isDefault: Boolean(b.isDefault),
        menuId: String(b.menuId || "menu-downtown"),
      }));
    }
  } catch (err) {
    console.warn("[MySQL] getUserAssignedBranches error:", err);
  }

  // 1. Global Admins (Super Admin / Owner) have full visibility of all branches
  if (tenant.isGlobalAdmin) {
    return {
      isAll: true,
      branches: allDbBranches,
      branchIds: allDbBranches.map((b) => b.id),
      branchNames: allDbBranches.map((b) => b.name),
    };
  }

  // 2. For non-global admin, check assigned branch tokens and manager match
  let userBranchRaw = tenant.branch || "";
  let userName = tenant.userName || "";
  let userEmail = tenant.userEmail || "";

  if (!userName || !userEmail || !userBranchRaw) {
    try {
      const uRows = await query<Record<string, unknown>[]>(
        "SELECT email, full_name, branch FROM users WHERE id = ? LIMIT 1",
        [tenant.userId],
      );
      if (uRows && uRows.length > 0) {
        if (!userBranchRaw && uRows[0].branch) userBranchRaw = String(uRows[0].branch);
        if (!userName && uRows[0].full_name) userName = String(uRows[0].full_name);
        if (!userEmail && uRows[0].email) userEmail = String(uRows[0].email);
      }
    } catch {
      /* ignore */
    }
  }

  const assignedTokens = userBranchRaw
    .split(/[,;\n|]+/)
    .map((s) =>
      s
        .replace(/\s*\([^)]*\)/g, "")
        .toLowerCase()
        .trim(),
    )
    .filter(Boolean);

  const uNameClean = userName.toLowerCase().trim();
  const uEmailClean = userEmail.toLowerCase().trim();

  const assignedBranches = allDbBranches.filter((b) => {
    const bId = b.id.toLowerCase().trim();
    const bName = b.name.toLowerCase().trim();
    const bManager = (b.manager || "")
      .replace(/\s*\([^)]*\)/g, "")
      .toLowerCase()
      .trim();

    if (assignedTokens.length > 0) {
      const match = assignedTokens.some((tok) => {
        return (
          tok === bId ||
          tok === bName ||
          bName === tok ||
          bName.includes(tok) ||
          tok.includes(bName)
        );
      });
      if (match) return true;
    }

    if (
      bManager &&
      uNameClean &&
      (bManager === uNameClean || bManager.includes(uNameClean) || uNameClean.includes(bManager))
    ) {
      return true;
    }
    if (bManager && uEmailClean && bManager.includes(uEmailClean)) {
      return true;
    }

    return false;
  });

  return {
    isAll: false,
    branches: assignedBranches,
    branchIds: assignedBranches.map((b) => b.id),
    branchNames: assignedBranches.map((b) => b.name),
  };
}

export async function resolveBranchIdentifiers(
  restaurantId: number,
  target: string,
): Promise<string[]> {
  const clean = (target || "").trim();
  if (!clean || clean.toLowerCase() === "all") return [];
  const list = [clean, clean.replace("branch-", "")];
  try {
    const bRows = await query<Record<string, unknown>[]>(
      "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?)",
      [restaurantId, clean, clean, clean, `%${clean}%`],
    );
    if (bRows && bRows.length > 0) {
      for (const r of bRows) {
        if (r.id) list.push(String(r.id), String(r.id).replace("branch-", ""));
        if (r.name) list.push(String(r.name));
      }
    }
  } catch {
    /* ignore */
  }
  return Array.from(new Set(list.filter(Boolean)));
}

export type BranchesFilter = {
  customSlugOrEmail?: string;
  search?: string;
  status?: string;
};

export const getBranchesServer = createServerFn({ method: "GET" })
  .validator((input?: string | BranchesFilter) =>
    z
      .union([
        z.string().optional(),
        z.object({
          customSlugOrEmail: z.string().optional(),
          search: z.string().optional(),
          status: z.string().optional(),
        }),
      ])
      .optional()
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const filter: BranchesFilter =
      typeof input === "string" ? { customSlugOrEmail: input } : input || {};

    if (filter.customSlugOrEmail) {
      const tenant = await resolvePublicRestaurant(filter.customSlugOrEmail);
      try {
        let sql =
          "SELECT id, name, address, phone, manager, status, is_default as isDefault, menu_id as menuId FROM branches WHERE restaurant_id = ?";
        const params: unknown[] = [tenant.restaurantId];

        if (filter.status && filter.status !== "all") {
          sql += " AND status = ?";
          params.push(filter.status);
        }
        if (filter.search && filter.search.trim()) {
          sql += " AND (name LIKE ? OR address LIKE ? OR manager LIKE ? OR phone LIKE ?)";
          const s = `%${filter.search.trim()}%`;
          params.push(s, s, s, s);
        }
        sql += " ORDER BY is_default DESC, created_at ASC";

        let rows: Record<string, unknown>[] | null = null;
        try {
          rows = await query<Record<string, unknown>[]>(sql, params);
        } catch {
          rows = await query<Record<string, unknown>[]>(
            "SELECT id, name, address, phone, manager FROM branches WHERE restaurant_id = ? ORDER BY id ASC",
            [tenant.restaurantId],
          );
        }
        if (rows && rows.length > 0) {
          const mapped: DbBranchRecord[] = rows.map((b) => ({
            id: String(b.id || ""),
            name: String(b.name || ""),
            address: String(b.address || ""),
            phone: String(b.phone || ""),
            manager: String(b.manager || ""),
            status: (b.status as string) || "open",
            isDefault: Boolean(b.isDefault),
            menuId: String(b.menuId || "menu-downtown"),
          }));
          if (!mapped.some((b) => b.isDefault)) {
            mapped[0] = { ...mapped[0], isDefault: true };
          }
          return mapped;
        }
      } catch (err) {
        console.warn("[MySQL] getBranchesServer query warning:", err);
      }
      return [];
    }

    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    let result = assignedInfo.branches;
    if (filter.status && filter.status !== "all") {
      result = result.filter((b) => b.status === filter.status);
    }
    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(s) ||
          (b.address || "").toLowerCase().includes(s) ||
          (b.manager || "").toLowerCase().includes(s) ||
          (b.phone || "").toLowerCase().includes(s),
      );
    }
    return result;
  });

const ZBranchSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    address: z.string().max(255).optional(),
    phone: z.string().max(50).optional(),
    manager: z.string().max(100).optional(),
    status: z.enum(["open", "closed", "busy"]).optional(),
    isDefault: z.boolean().optional(),
    menuId: z.string().max(100).optional(),
  })
  .strict();

export const updateBranchesServer = createServerFn({ method: "POST" })
  .validator(
    (branches: DbBranchRecord[]) => z.array(ZBranchSchema).parse(branches) as DbBranchRecord[],
  )
  .handler(async ({ data: branches }) => {
    await requirePermission("branches:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      let validated = [...branches];
      if (validated.length > 0 && !validated.some((b) => b.isDefault)) {
        validated[0] = { ...validated[0], isDefault: true };
      }
      let defaultFound = false;
      validated = validated.map((b) => {
        if (b.isDefault && !defaultFound) {
          defaultFound = true;
          return { ...b, isDefault: true };
        }
        return { ...b, isDefault: false };
      });
      if (!defaultFound && validated.length > 0) {
        validated[0] = { ...validated[0], isDefault: true };
      }

      // Check branch package limit
      const existingBranches = await query<Record<string, unknown>[]>(
        "SELECT id, name FROM branches WHERE restaurant_id = ?",
        [tenant.restaurantId],
      );
      const existingIds = new Set((existingBranches || []).map((b) => String(b.id)));
      const existingNameMap = new Map<string, string>();
      (existingBranches || []).forEach((b) => {
        if (b.id) existingNameMap.set(String(b.id), String(b.name || ""));
      });

      const newBranchesCount = validated.filter((b) => !existingIds.has(b.id)).length;
      if (newBranchesCount > 0) {
        const sub = await getTenantSubscriptionServer();
        if (
          sub.limits.maxBranches !== "unlimited" &&
          (existingBranches || []).length + newBranchesCount > sub.limits.maxBranches
        ) {
          throw new Error(
            `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxBranches} branch(es). Please upgrade your subscription to add more branches.`,
          );
        }
      }

      await transaction(async (conn) => {
        await conn.execute("DELETE FROM branches WHERE restaurant_id = ?", [tenant.restaurantId]);
        for (const b of validated) {
          const branchId = b.id || crypto.randomUUID();
          const branchName = sanitizeText(b.name);
          const mgrRaw = sanitizeText(b.manager || "");
          const mgrClean = mgrRaw.replace(/\s*\([^)]*\)/g, "").trim();
          const oldName = existingNameMap.get(branchId);

          await conn.execute(
            `INSERT INTO branches (id, restaurant_id, name, address, phone, manager, status, is_default, menu_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              branchId,
              tenant.restaurantId,
              branchName,
              sanitizeText(b.address || ""),
              sanitizeText(b.phone || ""),
              mgrRaw,
              b.status || "open",
              b.isDefault ? 1 : 0,
              b.menuId || "menu-downtown",
            ],
          );

          // If branch name changed, cascade update connected records
          if (oldName && oldName !== branchName) {
            try {
              await conn.execute(
                `UPDATE pos_orders SET branch_id = ? WHERE restaurant_id = ? AND (branch_id = ? OR branch_id = ?)`,
                [branchName, tenant.restaurantId, branchId, oldName],
              );
              await conn.execute(
                `UPDATE reservations SET branch_name = ?, branch_id = ? WHERE restaurant_id = ? AND (branch_id = ? OR branch_name = ?)`,
                [branchName, branchId, tenant.restaurantId, branchId, oldName],
              );
              await conn.execute(
                `UPDATE promotions SET branch_name = ?, branch_id = ? WHERE restaurant_id = ? AND (branch_id = ? OR branch_name = ?)`,
                [branchName, branchId, tenant.restaurantId, branchId, oldName],
              );
              await conn.execute(`UPDATE users SET branch = ? WHERE branch = ?`, [
                branchName,
                oldName,
              ]);
              await conn.execute(
                `UPDATE branch_tables SET branch_id = ? WHERE restaurant_id = ? AND (branch_id = ? OR branch_id = ?)`,
                [branchId, tenant.restaurantId, branchId, oldName],
              );
            } catch (cascadeErr) {
              console.warn("[MySQL] Branch rename cascade warning:", cascadeErr);
            }
          }

          if (mgrClean) {
            try {
              await conn.execute(
                `UPDATE users SET branch = ? WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?))`,
                [branchName, mgrClean],
              );
            } catch {
              /* ignore */
            }
          }
        }
      });
      return { success: true };
    } catch (err) {
      console.error("[MySQL] updateBranchesServer query error:", err);
      throw new Error("Failed to update branches in database");
    }
  });

export const uploadToImgBBServer = createServerFn({ method: "POST" })
  .validator((base64String: string) => z.string().min(1).parse(base64String))
  .handler(async ({ data: base64String }) => {
    await requireAuth();
    checkRateLimit("image_upload", undefined, { maxRequests: 10, windowMs: 60 * 1000 });
    validateImagePayload(base64String);

    const apiKey =
      process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
      process.env.VITE_IMGBB_API_KEY ||
      process.env.IMGBB_API_KEY ||
      process.env.IMGBB_KEY;

    if (!apiKey) {
      throw new Error(
        "ImgBB API key is missing. Please configure VITE_IMGBB_API_KEY in environment variables.",
      );
    }
    const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");

    // Strategy 1: Native FormData in Node.js
    try {
      const formData = new FormData();
      formData.append("image", cleanBase64);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      const directCdnUrl =
        json?.data?.image?.url || json?.data?.display_url || json?.data?.url || null;
      if (directCdnUrl && typeof directCdnUrl === "string") {
        return directCdnUrl;
      }
    } catch (err) {
      console.warn("[Node Server ImgBB FormData Warning]", err);
    }

    // Strategy 2: URLSearchParams fallback
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append("image", cleanBase64);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      });

      const json = await res.json();
      const directCdnUrl =
        json?.data?.image?.url || json?.data?.display_url || json?.data?.url || null;
      if (directCdnUrl && typeof directCdnUrl === "string") {
        return directCdnUrl;
      }
    } catch (err) {
      console.error("[Node Server ImgBB URLSearchParams Error]", err);
    }

    return null;
  });

// =========================================================
// CATEGORIES & FOOD ITEMS MYSQL & DISK CACHE SERVER FUNCTIONS
// =========================================================

export type CategoryRecord = {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  visible: boolean;
  itemCount: number;
};

export type FoodItemRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  image: string;
  gallery: string[];
  view360: string;
  price: number;
  discountPrice: number | null;
  prepTime: number;
  calories: number;
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  bestSeller: boolean;
  popular: boolean;
  chefChoice: boolean;
  vegetarian: boolean;
  halal: boolean;
  outOfStock: boolean;
  available: boolean;
  sortOrder: number;
};

const DEFAULT_CATEGORIES_BY_TENANT: Record<string, CategoryRecord[]> = {
  burgercraftlab: [
    {
      id: "c1",
      name: "Gourmet Burgers",
      description: "Handcrafted artisan patties",
      icon: "🍔",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
      visible: true,
      itemCount: 3,
    },
    {
      id: "c2",
      name: "Fries & Sides",
      description: "Crispy skin-on seasoned fries",
      icon: "🍟",
      image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600",
      visible: true,
      itemCount: 1,
    },
    {
      id: "c3",
      name: "Craft Shakes",
      description: "Thick hand-spun ice cream shakes",
      icon: "🥤",
      image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600",
      visible: true,
      itemCount: 1,
    },
    {
      id: "c4",
      name: "Beverages",
      description: "Chilled sodas and fresh juices",
      icon: "🥤",
      image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600",
      visible: true,
      itemCount: 1,
    },
  ],
  sultansdine: [
    {
      id: "sd-c1",
      name: "Kacchi Biryani",
      description: "Royal Mutton & Basmati Rice",
      icon: "🍲",
      image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600",
      visible: true,
      itemCount: 1,
    },
    {
      id: "sd-c2",
      name: "Kabab & Grill",
      description: "Wood-fire charcoal grilled kababs",
      icon: "🍢",
      image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600",
      visible: true,
      itemCount: 1,
    },
    {
      id: "sd-c3",
      name: "Mughal Specialties",
      description: "Traditional curries & roast chicken",
      icon: "🍗",
      image: "https://images.unsplash.com/photo-1545247181-516773cae754?w=600",
      visible: true,
      itemCount: 2,
    },
    {
      id: "sd-c4",
      name: "Desserts & Borhani",
      description: "Shahi Firni and chilled Borhani",
      icon: "🥛",
      image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600",
      visible: true,
      itemCount: 2,
    },
  ],
};

const DEFAULT_ITEMS_BY_TENANT: Record<string, FoodItemRecord[]> = {
  burgercraftlab: [
    {
      id: "item-1",
      name: "Smokey BBQ Bacon Burger",
      slug: "smokey-bbq-bacon-burger",
      shortDescription:
        "Angus beef patty topped with smoked applewood bacon, sharp cheddar, onion rings, and house BBQ sauce.",
      longDescription:
        "Our signature 100% Angus beef patty flame-grilled to perfection, layered with crispy applewood bacon, melted sharp cheddar cheese, beer-battered onion rings, and hickory BBQ sauce inside a toasted brioche bun.",
      category: "Gourmet Burgers",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
      gallery: [],
      view360: "",
      price: 12.99,
      discountPrice: null,
      prepTime: 15,
      calories: 850,
      ingredients: ["Angus Beef", "Applewood Bacon", "Cheddar", "Brioche Bun"],
      allergens: ["Gluten", "Dairy"],
      spicyLevel: 1,
      bestSeller: true,
      popular: true,
      chefChoice: true,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 0,
    },
    {
      id: "item-2",
      name: "Truffle Mushroom Swiss Burger",
      slug: "truffle-mushroom-swiss-burger",
      shortDescription:
        "Sautéed wild cremini mushrooms, Swiss cheese, and garlic truffle aioli on artisan patty.",
      longDescription:
        "Gourmet beef patty crowned with rich sautéed wild cremini mushrooms, melted Swiss cheese, caramelized onions, and white truffle garlic mayo sauce.",
      category: "Gourmet Burgers",
      image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600",
      gallery: [],
      view360: "",
      price: 14.5,
      discountPrice: null,
      prepTime: 18,
      calories: 920,
      ingredients: ["Beef Patty", "Cremini Mushrooms", "Swiss Cheese", "Truffle Mayo"],
      allergens: ["Gluten", "Dairy"],
      spicyLevel: 0,
      bestSeller: false,
      popular: true,
      chefChoice: true,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 1,
    },
    {
      id: "item-3",
      name: "Crispy Cajun Chicken Burger",
      slug: "crispy-cajun-chicken-burger",
      shortDescription:
        "Buttermilk fried chicken breast coated in spicy Cajun rub with dill pickles and spicy slaw.",
      longDescription:
        "Crispy buttermilk-soaked fried chicken breast dusted in Cajun spices, served on a toasted sesame bun with tangy dill pickles and creamy house slaw.",
      category: "Gourmet Burgers",
      image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600",
      gallery: [],
      view360: "",
      price: 11.99,
      discountPrice: null,
      prepTime: 15,
      calories: 780,
      ingredients: ["Chicken Breast", "Cajun Spices", "Dill Pickles", "Creamy Slaw"],
      allergens: ["Gluten", "Dairy"],
      spicyLevel: 2,
      bestSeller: true,
      popular: true,
      chefChoice: false,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 2,
    },
    {
      id: "item-4",
      name: "Loaded Truffle Cheese Fries",
      slug: "loaded-truffle-cheese-fries",
      shortDescription:
        "Hand-cut fries drizzled with truffle oil, melted cheddar, and fresh chives.",
      longDescription:
        "Crispy skin-on french fries tossed in black truffle oil, smothered in warm cheddar cheese sauce, parmesan shavings, and chopped fresh chives.",
      category: "Fries & Sides",
      image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600",
      gallery: [],
      view360: "",
      price: 6.5,
      discountPrice: null,
      prepTime: 10,
      calories: 550,
      ingredients: ["French Fries", "Truffle Oil", "Cheddar Cheese", "Parmesan"],
      allergens: ["Dairy"],
      spicyLevel: 0,
      bestSeller: true,
      popular: true,
      chefChoice: false,
      vegetarian: true,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 3,
    },
    {
      id: "item-5",
      name: "Salted Caramel Thick Shake",
      slug: "salted-caramel-thick-shake",
      shortDescription:
        "Rich vanilla bean ice cream blended with artisan salted caramel sauce and whipped cream.",
      longDescription:
        "Hand-spun thick shake crafted with premium vanilla bean ice cream, buttery salted caramel swirl, topped with fluffy whipped cream and caramel drizzle.",
      category: "Craft Shakes",
      image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600",
      gallery: [],
      view360: "",
      price: 5.99,
      discountPrice: null,
      prepTime: 5,
      calories: 480,
      ingredients: ["Vanilla Ice Cream", "Salted Caramel", "Whole Milk", "Whipped Cream"],
      allergens: ["Dairy"],
      spicyLevel: 0,
      bestSeller: false,
      popular: true,
      chefChoice: true,
      vegetarian: true,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 4,
    },
  ],
  sultansdine: [
    {
      id: "sd-item-1",
      name: "Royal Mutton Kacchi Biryani (Full)",
      slug: "royal-mutton-kacchi-biryani-full",
      shortDescription:
        "Authentic wood-fire cooked Basmati rice with tender marinated mutton and spiced potato.",
      longDescription:
        "Legendary Kacchi Biryani prepared in traditional copper degs with premium long-grain Basmati rice, succulent young mutton, aromatic saffron ghee, and melt-in-mouth aloo.",
      category: "Kacchi Biryani",
      image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600",
      gallery: [],
      view360: "",
      price: 12.0,
      discountPrice: null,
      prepTime: 10,
      calories: 950,
      ingredients: ["Basmati Rice", "Mutton", "Saffron Ghee", "Potato", "Mughal Spices"],
      allergens: ["Dairy"],
      spicyLevel: 1,
      bestSeller: true,
      popular: true,
      chefChoice: true,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 0,
    },
    {
      id: "sd-item-2",
      name: "Beef Kala Bhuna",
      slug: "beef-kala-bhuna",
      shortDescription:
        "Chittagong style slow-cooked tender dark beef caramelized in aromatic roasted spices.",
      longDescription:
        "Classic Bangladeshi delicacy cooked over low heat for hours with fried onions, mustard oil, black cardamom, cloves, and secret roasted spice mix until dark and rich.",
      category: "Mughal Specialties",
      image: "https://images.unsplash.com/photo-1545247181-516773cae754?w=600",
      gallery: [],
      view360: "",
      price: 8.5,
      discountPrice: null,
      prepTime: 12,
      calories: 680,
      ingredients: ["Beef", "Mustard Oil", "Fried Shallots", "Roasted Spices"],
      allergens: [],
      spicyLevel: 2,
      bestSeller: true,
      popular: true,
      chefChoice: true,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 1,
    },
    {
      id: "sd-item-3",
      name: "Special Chicken Roast",
      slug: "special-chicken-roast",
      shortDescription:
        "Whole chicken leg cooked in sweet and savory yogurt, ghee, and cashew gravy.",
      longDescription:
        "Traditional marriage-style chicken roast cooked gently in pure ghee, yogurt, fried onion paste, golden raisins, and toasted cashew gravy.",
      category: "Mughal Specialties",
      image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600",
      gallery: [],
      view360: "",
      price: 4.5,
      discountPrice: null,
      prepTime: 10,
      calories: 520,
      ingredients: ["Chicken Quarter", "Pure Ghee", "Yogurt", "Cashew Paste"],
      allergens: ["Dairy", "Nuts"],
      spicyLevel: 1,
      bestSeller: false,
      popular: true,
      chefChoice: false,
      vegetarian: false,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 2,
    },
    {
      id: "sd-item-4",
      name: "Traditional Borhani (Pitcher)",
      slug: "traditional-borhani-pitcher",
      shortDescription:
        "Spiced refreshing sour yogurt drink infused with mint, coriander, and black salt.",
      longDescription:
        "A essential companion to Kacchi Biryani — homemade sour curd blended with fresh mint leaves, green chilli, coriander, black salt, and digestive spices.",
      category: "Desserts & Borhani",
      image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600",
      gallery: [],
      view360: "",
      price: 3.0,
      discountPrice: null,
      prepTime: 3,
      calories: 180,
      ingredients: ["Sour Yogurt", "Mint Leaves", "Green Chilli", "Black Salt"],
      allergens: ["Dairy"],
      spicyLevel: 1,
      bestSeller: true,
      popular: true,
      chefChoice: false,
      vegetarian: true,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 3,
    },
    {
      id: "sd-item-5",
      name: "Royal Shahi Firni",
      slug: "royal-shahi-firni",
      shortDescription:
        "Creamy ground rice pudding slow-simmered in milk, saffron, and pistachio garnishing.",
      longDescription:
        "Classic dessert served in traditional clay bowls — aromatic Gobindobhog rice paste slow cooked in thick sweetened milk, infused with kewra water, cardamom, pistachios, and almonds.",
      category: "Desserts & Borhani",
      image: "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=600",
      gallery: [],
      view360: "",
      price: 2.5,
      discountPrice: null,
      prepTime: 5,
      calories: 320,
      ingredients: ["Condensed Milk", "Gobindobhog Rice", "Saffron", "Pistachio"],
      allergens: ["Dairy", "Nuts"],
      spicyLevel: 0,
      bestSeller: false,
      popular: true,
      chefChoice: true,
      vegetarian: true,
      halal: true,
      outOfStock: false,
      available: true,
      sortOrder: 4,
    },
  ],
};

export type CategoriesFilter = {
  customSlugOrEmail?: string;
  search?: string;
  activeOnly?: boolean;
};

export const getCategoriesServer = createServerFn({ method: "GET" })
  .validator((input?: string | CategoriesFilter) =>
    z
      .union([
        z.string().optional(),
        z.object({
          customSlugOrEmail: z.string().optional(),
          search: z.string().optional(),
          activeOnly: z.boolean().optional(),
        }),
      ])
      .optional()
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const filter: CategoriesFilter =
      typeof input === "string" ? { customSlugOrEmail: input } : input || {};
    const tenant = filter.customSlugOrEmail
      ? await resolvePublicRestaurant(filter.customSlugOrEmail)
      : await resolvePrivateTenantContext();

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE categories ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE categories ADD COLUMN description TEXT NULL",
          "ALTER TABLE categories ADD COLUMN icon VARCHAR(50) NULL",
          "ALTER TABLE categories ADD COLUMN image TEXT NULL",
          "ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0",
          "ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1",
          "ALTER TABLE categories MODIFY COLUMN id VARCHAR(255) NOT NULL",
          "ALTER TABLE categories MODIFY COLUMN name VARCHAR(255) NOT NULL",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      let sql = "SELECT * FROM categories WHERE restaurant_id = ?";
      const params: unknown[] = [tenant.restaurantId];

      if (filter.activeOnly) {
        sql += " AND (is_active = 1 OR is_active IS NULL)";
      }
      if (filter.search && filter.search.trim()) {
        sql += " AND (name LIKE ? OR description LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s);
      }

      sql += " ORDER BY sort_order ASC, name ASC";

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        let countsMap: Record<string, number> = {};
        try {
          const countRows = await query<Record<string, unknown>[]>(
            "SELECT category, COUNT(*) as cnt FROM food_items WHERE restaurant_id = ? GROUP BY category",
            [tenant.restaurantId],
          );
          if (countRows && countRows.length > 0) {
            for (const cr of countRows) {
              const catKey = String(cr.category || "").toLowerCase();
              countsMap[catKey] = Number(cr.cnt || 0);
            }
          }
        } catch {
          /* ignore count query error */
        }

        const dbCategories: CategoryRecord[] = rows.map((r) => {
          const rId = String(r.id);
          const rName = String(r.name || "Category");
          const count = countsMap[rId.toLowerCase()] ?? countsMap[rName.toLowerCase()] ?? 0;
          return {
            id: rId,
            name: rName,
            description: String(r.description || ""),
            icon: String(r.icon || r.emoji || "🍽️"),
            image: String(r.image || r.image_url || ""),
            visible: r.is_active !== 0 && r.status !== "inactive",
            itemCount: count,
          };
        });
        return dbCategories;
      }
      return [];
    } catch (err) {
      console.warn("[MySQL] getCategoriesServer query warning:", err);
    }

    return [];
  });

const ZCategorySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Category name required").max(100),
    description: z.string().max(500).optional(),
    icon: z.string().max(50).optional(),
    image: z.string().max(500).optional(),
    visible: z.boolean().optional(),
    itemCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export const saveCategoriesServer = createServerFn({ method: "POST" })
  .validator(
    (categories: CategoryRecord[]) =>
      z.array(ZCategorySchema).parse(categories) as CategoryRecord[],
  )
  .handler(async ({ data: categories }) => {
    await requirePermission("categories:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
          "ALTER TABLE categories ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE categories ADD COLUMN description TEXT NULL",
          "ALTER TABLE categories ADD COLUMN icon VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
          "ALTER TABLE categories ADD COLUMN emoji VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
          "ALTER TABLE categories ADD COLUMN image TEXT NULL",
          "ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0",
          "ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1",
          "ALTER TABLE categories MODIFY COLUMN id VARCHAR(255) NOT NULL",
          "ALTER TABLE categories MODIFY COLUMN name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL",
          "ALTER TABLE categories MODIFY COLUMN icon VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
          "ALTER TABLE categories MODIFY COLUMN emoji VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
          "ALTER TABLE categories MODIFY COLUMN description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      // Check category package limit
      const existingCategories = await query<Record<string, unknown>[]>(
        "SELECT id FROM categories WHERE (restaurant_id = ? OR restaurant_id = 0)",
        [tenant.restaurantId],
      );
      const existingIds = new Set((existingCategories || []).map((c: any) => String(c.id)));
      const newCategoriesCount = categories.filter((c: any) => !existingIds.has(c.id)).length;
      if (newCategoriesCount > 0) {
        const sub = await getTenantSubscriptionServer();
        if (
          sub.limits.maxCategories !== "unlimited" &&
          (existingCategories || []).length + newCategoriesCount > sub.limits.maxCategories
        ) {
          throw new Error(
            `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxCategories} category(ies). Please upgrade your subscription package to add more categories.`,
          );
        }
      }

      await transaction(async (conn) => {
        for (let idx = 0; idx < categories.length; idx++) {
          const c = categories[idx];
          const rawIcon = c.icon || "🍽️";
          try {
            await conn.execute(
              `INSERT INTO categories (id, restaurant_id, name, description, icon, emoji, image, sort_order, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 restaurant_id = VALUES(restaurant_id),
                 name = VALUES(name),
                 description = VALUES(description),
                 icon = VALUES(icon),
                 emoji = VALUES(emoji),
                 image = VALUES(image),
                 sort_order = VALUES(sort_order),
                 is_active = VALUES(is_active)`,
              [
                c.id || crypto.randomUUID(),
                tenant.restaurantId,
                sanitizeText(c.name),
                sanitizeText(c.description || ""),
                rawIcon,
                rawIcon,
                c.image || "",
                idx,
                c.visible ? 1 : 0,
              ],
            );
          } catch (insertErr) {
            console.warn("[MySQL] Primary categories insert notice, trying fallback:", insertErr);
            try {
              await conn.execute(
                `INSERT INTO categories (id, restaurant_id, name, description, icon, emoji)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   restaurant_id = VALUES(restaurant_id),
                   name = VALUES(name),
                   description = VALUES(description),
                   icon = VALUES(icon),
                   emoji = VALUES(emoji)`,
                [
                  c.id || crypto.randomUUID(),
                  tenant.restaurantId,
                  sanitizeText(c.name),
                  sanitizeText(c.description || ""),
                  rawIcon,
                  rawIcon,
                ],
              );
            } catch (fbErr) {
              console.error("[MySQL] Category insert fallback error:", fbErr);
            }
          }
        }
      });
      return { success: true, categories };
    } catch (err) {
      console.error("[MySQL] saveCategoriesServer query error:", err);
      throw new Error("Failed to save categories in database");
    }
  });

export const deleteCategoryServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requirePermission("categories:manage");
    const tenant = await resolvePrivateTenantContext();
    await query("DELETE FROM categories WHERE id = ? AND restaurant_id = ?", [
      data.id,
      tenant.restaurantId,
    ]);
    return { success: true };
  });

const ZFoodItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Food item name required").max(150),
    slug: z.string().max(150).optional(),
    category: z.string().max(100).optional(),
    price: z.number().nonnegative("Price must be non-negative"),
    discountPrice: z.number().nonnegative().nullable().optional(),
    shortDescription: z.string().max(300).optional(),
    longDescription: z.string().max(2000).optional(),
    image: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    view360: z.string().optional(),
    prepTime: z.number().int().nonnegative().optional(),
    calories: z.number().int().nonnegative().optional(),
    ingredients: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    spicyLevel: z.number().int().min(0).max(5).optional(),
    bestSeller: z.boolean().optional(),
    popular: z.boolean().optional(),
    chefChoice: z.boolean().optional(),
    vegetarian: z.boolean().optional(),
    halal: z.boolean().optional(),
    outOfStock: z.boolean().optional(),
    available: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .strict();

export type FoodItemsFilter = {
  customSlugOrEmail?: string;
  category?: string;
  search?: string;
  availableOnly?: boolean;
  isPopular?: boolean;
  isBestSeller?: boolean;
};

export const getFoodItemsServer = createServerFn({ method: "GET" })
  .validator((input?: string | FoodItemsFilter) =>
    z
      .union([
        z.string().optional(),
        z.object({
          customSlugOrEmail: z.string().optional(),
          category: z.string().optional(),
          search: z.string().optional(),
          availableOnly: z.boolean().optional(),
          isPopular: z.boolean().optional(),
          isBestSeller: z.boolean().optional(),
        }),
      ])
      .optional()
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const filter: FoodItemsFilter =
      typeof input === "string" ? { customSlugOrEmail: input } : input || {};
    const tenant = filter.customSlugOrEmail
      ? await resolvePublicRestaurant(filter.customSlugOrEmail)
      : await resolvePrivateTenantContext();

    try {
      let sql = `SELECT * FROM food_items WHERE restaurant_id = ?`;
      const params: unknown[] = [tenant.restaurantId];

      if (filter.category && filter.category !== "all") {
        sql += ` AND (LOWER(category) = LOWER(?) OR LOWER(category) LIKE LOWER(?))`;
        params.push(filter.category, `%${filter.category}%`);
      }
      if (filter.availableOnly) {
        sql += ` AND (available = 1 OR available IS NULL OR is_available = 1 OR is_available IS NULL) AND (out_of_stock = 0 OR out_of_stock IS NULL)`;
      }
      if (filter.isPopular) {
        sql += ` AND popular = 1`;
      }
      if (filter.isBestSeller) {
        sql += ` AND best_seller = 1`;
      }
      if (filter.search && filter.search.trim()) {
        sql += ` AND (name LIKE ? OR short_description LIKE ? OR category LIKE ?)`;
        const s = `%${filter.search.trim()}%`;
        params.push(s, s, s);
      }

      sql += ` ORDER BY sort_order ASC, name ASC`;

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        const dbItems: FoodItemRecord[] = rows.map((r, idx) => ({
          id: String(r.id),
          name: String(r.name || "Food Item"),
          slug:
            String(r.slug || "") ||
            String(r.name || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-"),
          category: String(r.category || r.category_id || "General"),
          price: Number(r.price || 0),
          discountPrice: r.discount_price ? Number(r.discount_price) : null,
          shortDescription: String(r.short_description || r.description || ""),
          longDescription: String(r.long_description || r.description || ""),
          image: String(r.image || r.image_url || ""),
          gallery: [],
          view360: "",
          prepTime: Number(r.prep_time || 15),
          calories: Number(r.calories || 0),
          ingredients: r.ingredients
            ? typeof r.ingredients === "string"
              ? JSON.parse(r.ingredients)
              : r.ingredients
            : [],
          allergens: r.allergens
            ? typeof r.allergens === "string"
              ? JSON.parse(r.allergens)
              : r.allergens
            : [],
          spicyLevel: Number(r.spicy_level || 0),
          bestSeller: Boolean(r.best_seller),
          popular: Boolean(r.popular),
          chefChoice: Boolean(r.chef_choice),
          vegetarian: Boolean(r.vegetarian),
          halal: r.halal !== 0,
          outOfStock: Boolean(r.out_of_stock),
          available: r.is_available !== 0 && r.available !== 0,
          sortOrder: Number(r.sort_order || idx),
        }));
        return dbItems;
      }
      return [];
    } catch (err) {
      console.warn("[MySQL] getFoodItemsServer query warning:", err);
    }

    return [];
  });

export const saveFoodItemsServer = createServerFn({ method: "POST" })
  .validator((items: FoodItemRecord[]) => z.array(ZFoodItemSchema).parse(items) as FoodItemRecord[])
  .handler(async ({ data: items }) => {
    await requirePermission("food_items:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE food_items ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE food_items ADD COLUMN category VARCHAR(255) NULL",
          "ALTER TABLE food_items ADD COLUMN category_id VARCHAR(255) NULL",
          "ALTER TABLE food_items ADD COLUMN slug VARCHAR(255) NULL",
          "ALTER TABLE food_items ADD COLUMN short_description TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN long_description TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN description TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN image_url TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN image TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN discount_price DECIMAL(10,2) NULL",
          "ALTER TABLE food_items ADD COLUMN prep_time INT DEFAULT 15",
          "ALTER TABLE food_items ADD COLUMN calories INT DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN ingredients TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN allergens TEXT NULL",
          "ALTER TABLE food_items ADD COLUMN spicy_level INT DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN best_seller TINYINT(1) DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN popular TINYINT(1) DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN chef_choice TINYINT(1) DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN vegetarian TINYINT(1) DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN halal TINYINT(1) DEFAULT 1",
          "ALTER TABLE food_items ADD COLUMN out_of_stock TINYINT(1) DEFAULT 0",
          "ALTER TABLE food_items ADD COLUMN is_available TINYINT(1) DEFAULT 1",
          "ALTER TABLE food_items ADD COLUMN sort_order INT DEFAULT 0",
          "ALTER TABLE food_items MODIFY COLUMN id VARCHAR(255) NOT NULL",
          "ALTER TABLE food_items MODIFY COLUMN name VARCHAR(255) NOT NULL",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      // Check food item package limit
      const existingItems = await query<Record<string, unknown>[]>(
        "SELECT id FROM food_items WHERE restaurant_id = ?",
        [tenant.restaurantId],
      );
      const existingIds = new Set((existingItems || []).map((i: any) => String(i.id)));
      const newItemsCount = items.filter((i: any) => !existingIds.has(i.id)).length;
      if (newItemsCount > 0) {
        const sub = await getTenantSubscriptionServer();
        if (
          sub.limits.maxItems !== "unlimited" &&
          (existingItems || []).length + newItemsCount > sub.limits.maxItems
        ) {
          throw new Error(
            `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxItems} menu item(s). Please upgrade your subscription package to add more food items.`,
          );
        }
      }

      await transaction(async (conn) => {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const sanitizedName = sanitizeText(item.name);
          try {
            await conn.execute(
              `INSERT INTO food_items (
                id, restaurant_id, category, name, slug, short_description, long_description,
                image_url, price, discount_price, prep_time, calories, ingredients, allergens,
                spicy_level, best_seller, popular, chef_choice, vegetarian, halal, out_of_stock,
                is_available, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                restaurant_id = VALUES(restaurant_id),
                category = VALUES(category),
                name = VALUES(name),
                slug = VALUES(slug),
                short_description = VALUES(short_description),
                long_description = VALUES(long_description),
                image_url = VALUES(image_url),
                price = VALUES(price),
                discount_price = VALUES(discount_price),
                prep_time = VALUES(prep_time),
                calories = VALUES(calories),
                ingredients = VALUES(ingredients),
                allergens = VALUES(allergens),
                spicy_level = VALUES(spicy_level),
                best_seller = VALUES(best_seller),
                popular = VALUES(popular),
                chef_choice = VALUES(chef_choice),
                vegetarian = VALUES(vegetarian),
                halal = VALUES(halal),
                out_of_stock = VALUES(out_of_stock),
                is_available = VALUES(is_available),
                sort_order = VALUES(sort_order)`,
              [
                item.id || crypto.randomUUID(),
                tenant.restaurantId,
                sanitizeText(item.category || "General"),
                sanitizedName,
                item.slug || sanitizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                sanitizeText(item.shortDescription || ""),
                sanitizeText(item.longDescription || ""),
                item.image || "",
                item.price || 0,
                item.discountPrice ?? null,
                item.prepTime || 15,
                item.calories || 0,
                JSON.stringify((item.ingredients || []).map((i: any) => sanitizeText(i))),
                JSON.stringify((item.allergens || []).map((a: any) => sanitizeText(a))),
                item.spicyLevel || 0,
                item.bestSeller ? 1 : 0,
                item.popular ? 1 : 0,
                item.chefChoice ? 1 : 0,
                item.vegetarian ? 1 : 0,
                item.halal !== false ? 1 : 0,
                item.outOfStock ? 1 : 0,
                item.available !== false ? 1 : 0,
                idx,
              ],
            );
          } catch (insertErr) {
            console.warn("[MySQL] Primary food_items insert notice, trying fallback:", insertErr);
            try {
              await conn.execute(
                `INSERT INTO food_items (id, restaurant_id, category, name, price)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   restaurant_id = VALUES(restaurant_id),
                   category = VALUES(category),
                   name = VALUES(name),
                   price = VALUES(price)`,
                [
                  item.id || crypto.randomUUID(),
                  tenant.restaurantId,
                  sanitizeText(item.category || "General"),
                  sanitizedName,
                  item.price || 0,
                ],
              );
            } catch (fbErr) {
              console.error("[MySQL] Food item secondary fallback failed:", fbErr);
            }
          }
        }
      });
      return { success: true, items };
    } catch (err) {
      console.error("[MySQL] saveFoodItemsServer query error:", err);
      throw new Error("Failed to save food items in database");
    }
  });

export const deleteFoodItemServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requirePermission("food_items:manage");
    const tenant = await resolvePrivateTenantContext();
    await query("DELETE FROM food_items WHERE id = ? AND restaurant_id = ?", [
      data.id,
      tenant.restaurantId,
    ]);
    return { success: true };
  });

// =========================================================
// BRANCH TABLES MYSQL SERVER FUNCTIONS
// =========================================================

export type TableRecord = {
  id: string;
  tableNo: string;
  zone: string;
};

function loadTablesFromFile(_branchId: string): TableRecord[] | null {
  return null;
}

function saveTablesToFile(_branchId: string, _data: TableRecord[]) {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

export const getBranchTablesServer = createServerFn({ method: "POST" })
  .validator((branchId: string) => z.string().parse(branchId))
  .handler(async ({ data: branchId }) => {
    await requireAuth();
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
      return [];
    }

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS branch_tables (
          id VARCHAR(100) PRIMARY KEY,
          restaurant_id INT DEFAULT 1,
          branch_id VARCHAR(100) NOT NULL,
          table_no VARCHAR(50) NOT NULL,
          zone VARCHAR(100) DEFAULT 'MAIN ROOM',
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      try {
        await query("ALTER TABLE branch_tables ADD COLUMN restaurant_id INT DEFAULT 1");
      } catch {
        /* column exists */
      }

      let rows: Record<string, unknown>[] | null = null;
      if (branchId && branchId !== "all") {
        const target = branchId.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return [];
          }
        }
        rows = await query<Record<string, unknown>[]>(
          "SELECT id, table_no, zone FROM branch_tables WHERE (branch_id = ? OR branch_id = ?) AND restaurant_id = ? ORDER BY sort_order ASC, created_at ASC",
          [branchId, branchId.replace("branch-", ""), tenant.restaurantId],
        );
      } else if (!assignedInfo.isAll) {
        const branchIds = assignedInfo.branches.flatMap((b) => [b.id, b.name]);
        const placeholders = branchIds.map(() => "?").join(",");
        rows = await query<Record<string, unknown>[]>(
          `SELECT id, table_no, zone FROM branch_tables WHERE (branch_id IN (${placeholders})) AND restaurant_id = ? ORDER BY sort_order ASC, created_at ASC`,
          [...branchIds, tenant.restaurantId],
        );
      } else {
        rows = await query<Record<string, unknown>[]>(
          "SELECT id, table_no, zone FROM branch_tables WHERE restaurant_id = ? ORDER BY sort_order ASC, created_at ASC",
          [tenant.restaurantId],
        );
      }

      if (rows && rows.length > 0) {
        const seen = new Set<string>();
        const dbTables: TableRecord[] = [];
        for (const r of rows) {
          const tNo = String(r.table_no || "").trim();
          const numKey = parseInt(tNo, 10);
          const key = !isNaN(numKey) ? `num-${numKey}` : tNo.toLowerCase();
          if (tNo && !seen.has(key)) {
            seen.add(key);
            dbTables.push({
              id: String(r.id),
              tableNo: tNo,
              zone: String(r.zone || "MAIN ROOM"),
            });
          }
        }
        return dbTables;
      }
    } catch (err) {
      console.warn("[MySQL] getBranchTablesServer query warning:", err);
    }
    return [];
  });

export const saveBranchTablesServer = createServerFn({ method: "POST" })
  .validator((data: { branchId: string; tables: TableRecord[] }) =>
    z
      .object({
        branchId: z.string(),
        tables: z.array(
          z.object({
            id: z.string(),
            tableNo: z.string(),
            zone: z.string(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requirePermission("branch_tables:manage");
    const { branchId, tables } = data;
    const tenant = await resolvePrivateTenantContext();
    saveTablesToFile(branchId, tables);
    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE branch_tables ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE branch_tables ADD COLUMN branch_id VARCHAR(255) NOT NULL DEFAULT '1'",
          "ALTER TABLE branch_tables ADD COLUMN table_no VARCHAR(50) NOT NULL DEFAULT '01'",
          "ALTER TABLE branch_tables ADD COLUMN table_number VARCHAR(50) NULL",
          "ALTER TABLE branch_tables ADD COLUMN zone VARCHAR(100) DEFAULT 'MAIN ROOM'",
          "ALTER TABLE branch_tables ADD COLUMN sort_order INT DEFAULT 0",
          "ALTER TABLE branch_tables ADD COLUMN qr_token VARCHAR(255) NULL",
          "ALTER TABLE branch_tables ADD COLUMN status VARCHAR(50) DEFAULT 'available'",
          "ALTER TABLE branch_tables MODIFY COLUMN id VARCHAR(255) NOT NULL",
          "ALTER TABLE branch_tables MODIFY COLUMN table_no VARCHAR(50) NOT NULL DEFAULT '01'",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      // Check QR Code package limit for tenant
      try {
        const otherTables = await query<Record<string, unknown>[]>(
          "SELECT id FROM branch_tables WHERE restaurant_id = ? AND branch_id != ?",
          [tenant.restaurantId, branchId],
        );
        const totalQrs = (otherTables || []).length + tables.length;
        const sub = await getTenantSubscriptionServer();
        if (sub.limits.maxQrs !== "unlimited" && totalQrs > sub.limits.maxQrs) {
          throw new Error(
            `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxQrs} QR Code(s). Please upgrade your subscription package to generate more table QR codes.`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("Package Limit Reached")) {
          throw e;
        }
      }

      await transaction(async (conn) => {
        try {
          await conn.execute(
            "DELETE FROM branch_tables WHERE branch_id = ? AND restaurant_id = ?",
            [branchId, tenant.restaurantId],
          );
        } catch {
          await conn.execute("DELETE FROM branch_tables WHERE branch_id = ?", [branchId]);
        }

        let bSlug = branchId;
        try {
          const bRow = await query<Record<string, unknown>[]>(
            "SELECT name FROM branches WHERE id = ? AND restaurant_id = ? LIMIT 1",
            [branchId, tenant.restaurantId],
          );
          if (bRow && bRow.length > 0 && bRow[0].name) {
            bSlug = String(bRow[0].name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
          }
        } catch {
          /* fallback */
        }

        for (let idx = 0; idx < tables.length; idx++) {
          const t = tables[idx];
          const tableId =
            t.id.startsWith(branchId) || t.id.length > 15 ? t.id : `${branchId}-${t.id}`;
          const qrToken = encodeTableToken(bSlug || branchId, t.tableNo);
          try {
            await conn.execute(
              `INSERT INTO branch_tables (id, restaurant_id, branch_id, table_no, zone, sort_order, qr_token) 
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE branch_id = VALUES(branch_id), table_no = VALUES(table_no), zone = VALUES(zone), sort_order = VALUES(sort_order), qr_token = VALUES(qr_token)`,
              [
                tableId,
                tenant.restaurantId,
                branchId,
                t.tableNo,
                t.zone || "MAIN ROOM",
                idx,
                qrToken,
              ],
            );
          } catch (insertErr) {
            console.warn(
              "[MySQL] Primary branch_tables insert notice, trying fallback:",
              insertErr,
            );
            try {
              await conn.execute(
                `INSERT INTO branch_tables (id, branch_id, table_no, zone, sort_order, qr_token) 
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE branch_id = VALUES(branch_id), table_no = VALUES(table_no), zone = VALUES(zone), sort_order = VALUES(sort_order), qr_token = VALUES(qr_token)`,
                [tableId, branchId, t.tableNo, t.zone || "MAIN ROOM", idx, qrToken],
              );
            } catch (fallbackErr) {
              console.warn(
                "[MySQL] Secondary branch_tables insert notice, trying legacy name fallback:",
                fallbackErr,
              );
              try {
                await conn.execute(
                  `INSERT INTO branch_tables (id, branch_id, name, location, status) 
                   VALUES (?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE branch_id = VALUES(branch_id), name = VALUES(name), location = VALUES(location)`,
                  [tableId, branchId, t.tableNo, t.zone || "MAIN ROOM", "available"],
                );
              } catch (finalErr) {
                console.error("[MySQL] Final branch_tables insert fallback error:", finalErr);
              }
            }
          }
        }
      });
      return { success: true };
    } catch (err: unknown) {
      console.error("[MySQL] saveBranchTablesServer query error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save branch tables in database";
      throw new Error(msg);
    }
  });

export const validateTableQrServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      restaurantSlug: string;
      token?: string;
      branchId?: string;
      tableNo?: string;
      tableId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      try {
        await query("ALTER TABLE branch_tables ADD COLUMN status VARCHAR(50) DEFAULT 'available'");
      } catch {
        /* ignore */
      }
      try {
        await query("ALTER TABLE branch_tables ADD COLUMN qr_token VARCHAR(255) NULL");
      } catch {
        /* ignore */
      }

      const tenant = await resolvePublicRestaurant(data.restaurantSlug);
      if (!tenant || tenant.restaurantId === 0) {
        return { valid: false, reason: "Restaurant not found in database" };
      }

      let rows: Record<string, unknown>[] = [];

      // 1. Strict exact match by qr_token or table id in MySQL branch_tables
      if (data.token) {
        rows = await query<Record<string, unknown>[]>(
          "SELECT id, branch_id, table_no, zone, qr_token FROM branch_tables WHERE (qr_token = ? OR id = ?) AND restaurant_id = ? LIMIT 1",
          [data.token, data.token, tenant.restaurantId],
        );
      }

      // 2. Match by tableId/tableNo short UUID or token
      if ((!rows || rows.length === 0) && (data.tableId || data.tableNo)) {
        const tSearch = (data.tableId || data.tableNo || "").trim();
        const tPattern = `%${tSearch}%`;

        rows = await query<Record<string, unknown>[]>(
          `SELECT id, branch_id, table_no, zone, qr_token 
           FROM branch_tables 
           WHERE restaurant_id = ? 
             AND (id = ? OR id LIKE ? OR qr_token = ? OR table_no = ?)
           LIMIT 1`,
          [tenant.restaurantId, tSearch, tPattern, tSearch, tSearch],
        );
      }

      if (!rows || rows.length === 0) {
        return {
          valid: false,
          reason:
            "Invalid QR Code Token: This dining table QR code has not been created or saved in the database.",
        };
      }

      const row = rows[0];
      return {
        valid: true,
        tableId: String(row.id),
        branchId: String(row.branch_id || ""),
        tableNo: String(row.table_no),
        zone: String(row.zone || "MAIN ROOM"),
        status: "available",
      };
    } catch (err) {
      console.warn("[validateTableQrServer Warning]", err);
      return { valid: false, reason: "Database validation failed" };
    }
  });

export const getCurrentTenantSlugServer = createServerFn({ method: "GET" }).handler(async () => {
  const tenant = await resolvePrivateTenantContext();
  return { slug: tenant.slug, restaurantId: tenant.restaurantId };
});

export const resolveTableRestaurantServer = createServerFn({ method: "POST" })
  .validator((data: { token: string; subdomain?: string | null }) => data)
  .handler(async ({ data }) => {
    const { token, subdomain } = data;

    if (subdomain && subdomain !== "www" && subdomain !== "app" && subdomain !== "localhost") {
      try {
        const rows = await query<Record<string, unknown>[]>(
          "SELECT slug FROM restaurants WHERE slug = ? OR slug LIKE ? OR name LIKE ? LIMIT 1",
          [subdomain, `%${subdomain}%`, `%${subdomain}%`],
        );
        if (rows && rows.length > 0 && rows[0].slug) {
          return { slug: String(rows[0].slug) };
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const decoded = decodeTableToken(token);
      if (decoded) {
        const { branchSlug, tableNo } = decoded;
        const rows = await query<Record<string, unknown>[]>(
          `SELECT r.slug 
           FROM branch_tables bt 
           JOIN restaurants r ON bt.restaurant_id = r.id 
           WHERE (bt.branch_id = ? OR bt.branch_id LIKE ? OR bt.id LIKE ?) 
             AND bt.table_no = ? 
           LIMIT 1`,
          [branchSlug, `%${branchSlug}%`, `%${token}%`, tableNo],
        );
        if (rows && rows.length > 0 && rows[0].slug) {
          return { slug: String(rows[0].slug) };
        }
      }
    } catch {
      /* ignore */
    }

    if (subdomain && subdomain !== "localhost") {
      return { slug: subdomain };
    }

    return { slug: null };
  });

// =========================================================
// ORDERS MYSQL SERVER FUNCTIONS
// =========================================================

export type OrderLineRecord = {
  itemId: string;
  name: string;
  price: number;
  qty: number;
};

export type FullOrderRecord = {
  id: string;
  number: number;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
  type: "dine-in" | "takeaway" | "delivery";
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  tableNumber?: string;
  customerName: string;
  phone: string;
  notes?: string;
  lines: OrderLineRecord[];
  subtotal: number;
  discountType?: "amount" | "percent";
  discountValue?: number;
  discountAmount?: number;
  tax: number;
  total: number;
};

function loadOrdersFromFile(_slug = "burgercraftlab"): FullOrderRecord[] | null {
  return null;
}

function saveOrdersToFile(_data: FullOrderRecord[], _slug = "burgercraftlab") {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

export type OrdersFilter = {
  branchId?: string;
  status?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

const ZOrdersFilterSchema = z
  .object({
    branchId: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .optional();

export const getOrdersServer = createServerFn({ method: "GET" })
  .validator((filter?: OrdersFilter) => ZOrdersFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("orders:view");
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    // If regular user has 0 assigned branches, return empty array immediately (no data leaks)
    if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
      return [];
    }

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE pos_orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
          "ALTER TABLE pos_orders ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE pos_orders ADD COLUMN branch_id VARCHAR(255) NULL",
          "ALTER TABLE pos_orders ADD COLUMN order_number INT DEFAULT 1",
          "ALTER TABLE pos_orders ADD COLUMN type VARCHAR(50) DEFAULT 'dine-in'",
          "ALTER TABLE pos_orders ADD COLUMN status VARCHAR(50) DEFAULT 'pending'",
          "ALTER TABLE pos_orders ADD COLUMN table_number VARCHAR(50) NULL",
          "ALTER TABLE pos_orders ADD COLUMN customer_name VARCHAR(255) NULL",
          "ALTER TABLE pos_orders ADD COLUMN phone VARCHAR(50) NULL",
          "ALTER TABLE pos_orders ADD COLUMN notes TEXT NULL",
          "ALTER TABLE pos_orders ADD COLUMN lines_json LONGTEXT NULL",
          "ALTER TABLE pos_orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0",
          "ALTER TABLE pos_orders ADD COLUMN discount_type VARCHAR(20) DEFAULT 'amount'",
          "ALTER TABLE pos_orders ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0",
          "ALTER TABLE pos_orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0",
          "ALTER TABLE pos_orders ADD COLUMN tax DECIMAL(10,2) DEFAULT 0",
          "ALTER TABLE pos_orders ADD COLUMN total DECIMAL(10,2) DEFAULT 0",
          "ALTER TABLE pos_orders ADD COLUMN prep_time_minutes INT NULL",
          "ALTER TABLE pos_orders ADD COLUMN prep_started_at TIMESTAMP NULL",
          "ALTER TABLE pos_orders ADD COLUMN estimated_prep_minutes INT NULL",
          "ALTER TABLE pos_orders MODIFY COLUMN id VARCHAR(255) NOT NULL",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      let sql = "SELECT * FROM pos_orders WHERE (restaurant_id = ? OR restaurant_id = 0)";
      const params: unknown[] = [tenant.restaurantId];

      if (filter.branchId && filter.branchId !== "all") {
        const target = filter.branchId.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return []; // Deny access to unassigned branch
          }
        }
        const idents = await resolveBranchIdentifiers(tenant.restaurantId, filter.branchId);
        const branchClauses: string[] = [];
        for (const ident of idents) {
          branchClauses.push("branch_id = ?");
          params.push(ident);
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      } else if (!assignedInfo.isAll) {
        const branchClauses: string[] = [];
        for (const b of assignedInfo.branches) {
          const idents = await resolveBranchIdentifiers(tenant.restaurantId, b.id || b.name);
          for (const ident of idents) {
            branchClauses.push("branch_id = ?");
            params.push(ident);
          }
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      }

      if (filter.status && filter.status !== "all") {
        sql += " AND status = ?";
        params.push(filter.status);
      }

      if (filter.type && filter.type !== "all") {
        sql += " AND type = ?";
        params.push(filter.type);
      }

      if (filter.startDate) {
        sql += " AND created_at >= ?";
        params.push(
          filter.startDate.length === 10 ? `${filter.startDate} 00:00:00` : filter.startDate,
        );
      }

      if (filter.endDate) {
        sql += " AND created_at <= ?";
        params.push(filter.endDate.length === 10 ? `${filter.endDate} 23:59:59` : filter.endDate);
      }

      if (filter.search && filter.search.trim()) {
        sql +=
          " AND (CAST(order_number AS CHAR) LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR table_number LIKE ? OR notes LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s, s, s, s);
      }

      sql += " ORDER BY created_at DESC";

      if (filter.limit) {
        sql += " LIMIT ? OFFSET ?";
        params.push(Number(filter.limit), Number(filter.offset || 0));
      }

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        const dbOrders: FullOrderRecord[] = rows.map((r) => {
          let lines: Array<{ itemId: string; name: string; price: number; qty: number }> = [];
          if (r.lines_json) {
            if (Array.isArray(r.lines_json)) {
              lines = r.lines_json.map((l: Record<string, unknown>) => ({
                itemId: String(l.itemId || l.id || crypto.randomUUID()),
                name: String(l.name || l.item_name || "Food Item"),
                price: Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0),
                qty: Number(l.qty ?? l.quantity ?? 1),
              }));
            } else if (typeof r.lines_json === "string" && r.lines_json.trim()) {
              try {
                const parsed = JSON.parse(r.lines_json.trim());
                const arr = Array.isArray(parsed)
                  ? parsed
                  : typeof parsed === "object" && parsed !== null
                    ? [parsed]
                    : [];
                lines = arr.map((l: Record<string, unknown>) => ({
                  itemId: String(l.itemId || l.id || crypto.randomUUID()),
                  name: String(l.name || l.item_name || "Food Item"),
                  price: Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0),
                  qty: Number(l.qty ?? l.quantity ?? 1),
                }));
              } catch {
                lines = [];
              }
            } else if (typeof r.lines_json === "object" && r.lines_json !== null) {
              const l = r.lines_json as Record<string, unknown>;
              lines = [
                {
                  itemId: String(l.itemId || l.id || crypto.randomUUID()),
                  name: String(l.name || l.item_name || "Food Item"),
                  price: Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0),
                  qty: Number(l.qty ?? l.quantity ?? 1),
                },
              ];
            }
          }

          const parseDate = (d: unknown): string => {
            if (!d) return new Date().toISOString();
            if (d instanceof Date)
              return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
            try {
              const dt = new Date(String(d));
              return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
            } catch {
              return new Date().toISOString();
            }
          };

          return {
            id: String(r.id),
            number: Number(r.order_number || 1),
            branchId: r.branch_id ? String(r.branch_id) : undefined,
            createdAt: parseDate(r.created_at),
            updatedAt: parseDate(r.updated_at),
            type: (r.type as FullOrderRecord["type"]) || "dine-in",
            status: (r.status as FullOrderRecord["status"]) || "pending",
            tableNumber: r.table_number ? String(r.table_number) : undefined,
            customerName: String(r.customer_name || "Guest"),
            phone: String(r.phone || ""),
            lines,
            subtotal: Number(r.subtotal || 0),
            discountType: (r.discount_type as FullOrderRecord["discountType"]) || "amount",
            discountValue: Number(r.discount_value || 0),
            discountAmount: Number(r.discount_amount || 0),
            tax: Number(r.tax || 0),
            total: Number(r.total || 0),
            prepTimeMinutes:
              r.prep_time_minutes !== null && r.prep_time_minutes !== undefined
                ? Number(r.prep_time_minutes)
                : undefined,
            prepStartedAt: r.prep_started_at ? parseDate(r.prep_started_at) : undefined,
            estimatedPrepMinutes:
              r.estimated_prep_minutes !== null && r.estimated_prep_minutes !== undefined
                ? Number(r.estimated_prep_minutes)
                : undefined,
          };
        });
        return dbOrders;
      }
    } catch (err) {
      console.warn("[MySQL] getOrdersServer query warning:", err);
    }
    return [];
  });

export const getOrderStatusCountsServer = createServerFn({ method: "GET" })
  .validator((filter?: OrdersFilter) => ZOrdersFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("orders:view");
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);
    const counts = {
      pending: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    };

    if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
      return counts;
    }

    try {
      let sql =
        "SELECT status, COUNT(*) as cnt FROM pos_orders WHERE (restaurant_id = ? OR restaurant_id = 0)";
      const params: unknown[] = [tenant.restaurantId];

      if (filter.branchId && filter.branchId !== "all") {
        const target = filter.branchId.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return counts;
          }
        }
        const idents = await resolveBranchIdentifiers(tenant.restaurantId, filter.branchId);
        const branchClauses: string[] = [];
        for (const ident of idents) {
          branchClauses.push("branch_id = ?");
          params.push(ident);
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      } else if (!assignedInfo.isAll) {
        const branchClauses: string[] = [];
        for (const b of assignedInfo.branches) {
          const idents = await resolveBranchIdentifiers(tenant.restaurantId, b.id || b.name);
          for (const ident of idents) {
            branchClauses.push("branch_id = ?");
            params.push(ident);
          }
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      }

      if (filter.type && filter.type !== "all") {
        sql += " AND type = ?";
        params.push(filter.type);
      }

      if (filter.startDate) {
        sql += " AND created_at >= ?";
        params.push(
          filter.startDate.length === 10 ? `${filter.startDate} 00:00:00` : filter.startDate,
        );
      }

      if (filter.endDate) {
        sql += " AND created_at <= ?";
        params.push(filter.endDate.length === 10 ? `${filter.endDate} 23:59:59` : filter.endDate);
      }

      if (filter.search && filter.search.trim()) {
        sql +=
          " AND (CAST(order_number AS CHAR) LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR table_number LIKE ? OR notes LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s, s, s, s);
      }

      sql += " GROUP BY status";

      const rows = await query<Record<string, unknown>[]>(sql, params);
      if (rows && rows.length > 0) {
        for (const r of rows) {
          const st = String(r.status || "")
            .toLowerCase()
            .trim() as keyof typeof counts;
          if (counts[st] !== undefined) {
            counts[st] = Number(r.cnt || 0);
          }
        }
      }
    } catch (err) {
      console.warn("[MySQL] getOrderStatusCountsServer error:", err);
    }
    return counts;
  });

const ZOrderLineSchema = z
  .object({
    itemId: z.string(),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    qty: z.number().int().positive(),
  })
  .strict();

const ZOrderSchema = z
  .object({
    id: z.string().optional(),
    number: z.number().int().positive().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    branchId: z.string().nullable().optional(),
    type: z.enum(["dine-in", "takeaway", "delivery"]).optional(),
    status: z.enum(["pending", "preparing", "ready", "completed", "cancelled"]).optional(),
    tableNumber: z.string().max(20).optional(),
    customerName: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    lines: z.array(ZOrderLineSchema),
    subtotal: z.number().nonnegative().optional(),
    discountType: z.enum(["amount", "percent"]).optional(),
    discountValue: z.number().nonnegative().optional(),
    discountAmount: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
  })
  .passthrough();

export const saveOrderServer = createServerFn({ method: "POST" })
  .validator((order: FullOrderRecord) => ZOrderSchema.parse(order) as unknown as FullOrderRecord)
  .handler(async ({ data: order }) => {
    await requirePermission("orders:create");
    const tenant = await resolvePrivateTenantContext();
    const orderId = order.id || crypto.randomUUID();

    // Check order package limit for new orders
    const existingOrders = await query<Record<string, unknown>[]>(
      "SELECT id FROM pos_orders WHERE id = ? AND restaurant_id = ?",
      [orderId, tenant.restaurantId],
    );
    const isNewOrder = !existingOrders || existingOrders.length === 0;
    if (isNewOrder) {
      const sub = await getTenantSubscriptionServer();
      if (sub.limits.maxOrders !== "unlimited" && sub.usage.orders >= sub.limits.maxOrders) {
        throw new Error(
          `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxOrders} order(s). Please upgrade your subscription package to process more orders.`,
        );
      }
    }

    // Recalculate item prices server-side from food_items DB table
    let dbFoodItems: Record<string, unknown>[] = [];
    try {
      dbFoodItems = await query<Record<string, unknown>[]>(
        "SELECT id, name, price FROM food_items WHERE restaurant_id = ?",
        [tenant.restaurantId],
      );
    } catch {
      /* ignore */
    }

    const priceMap = new Map<string, number>();
    for (const f of dbFoodItems) {
      if (f.id) priceMap.set(String(f.id), Number(f.price || 0));
      if (f.name) priceMap.set(String(f.name).toLowerCase().trim(), Number(f.price || 0));
    }

    let calculatedSubtotal = 0;
    const validatedLines: OrderLineRecord[] = (order.lines || []).map((line: any) => {
      let unitPrice = line.price;
      if (line.itemId && priceMap.has(line.itemId)) {
        unitPrice = priceMap.get(line.itemId)!;
      } else if (line.name && priceMap.has(line.name.toLowerCase().trim())) {
        unitPrice = priceMap.get(line.name.toLowerCase().trim())!;
      }
      calculatedSubtotal += unitPrice * line.qty;
      return { ...line, price: unitPrice };
    });

    const discountAmount =
      order.discountType === "percent"
        ? (calculatedSubtotal * (order.discountValue || 0)) / 100
        : order.discountAmount || order.discountValue || 0;

    const taxAmount = order.tax || 0;
    const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount + taxAmount);
    const fullOrder: FullOrderRecord = {
      ...order,
      id: orderId,
      lines: validatedLines,
      subtotal: calculatedSubtotal,
      discountAmount,
      tax: taxAmount,
      total: calculatedTotal,
    };

    try {
      let orderNum = fullOrder.number;
      const rawBranch =
        (order as { branchId?: string })?.branchId ||
        (fullOrder as { branchId?: string })?.branchId;
      let branchId = typeof rawBranch === "string" ? rawBranch : null;
      if (branchId) {
        try {
          const bRow = await query<Record<string, unknown>[]>(
            "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?)",
            [tenant.restaurantId, branchId, branchId, branchId, `%${branchId}%`],
          );
          if (bRow && bRow.length > 0 && bRow[0].id) {
            branchId = String(bRow[0].id);
          }
        } catch {
          /* ignore */
        }
      }

      await transaction(async (conn) => {
        if (!orderNum || orderNum <= 0) {
          orderNum = await generateDailyOrderNumber(conn, tenant.restaurantId, branchId);
        }

        try {
          await conn.execute(
            "ALTER TABLE pos_orders ADD COLUMN branch_id VARCHAR(255) AFTER restaurant_id",
          );
        } catch {
          /* column already exists */
        }

        await conn.execute(
          `INSERT INTO pos_orders (
            id, restaurant_id, branch_id, order_number, type, status, table_number, customer_name, phone, notes,
            lines_json, subtotal, discount_type, discount_value, discount_amount, tax, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            branch_id = VALUES(branch_id),
            type = VALUES(type),
            status = VALUES(status),
            table_number = VALUES(table_number),
            customer_name = VALUES(customer_name),
            phone = VALUES(phone),
            notes = VALUES(notes),
            lines_json = VALUES(lines_json),
            subtotal = VALUES(subtotal),
            discount_type = VALUES(discount_type),
            discount_value = VALUES(discount_value),
            discount_amount = VALUES(discount_amount),
            tax = VALUES(tax),
            total = VALUES(total)`,
          [
            orderId,
            tenant.restaurantId,
            branchId,
            orderNum,
            fullOrder.type || "dine-in",
            fullOrder.status || "pending",
            fullOrder.tableNumber ? sanitizeText(fullOrder.tableNumber) : null,
            sanitizeText(fullOrder.customerName || "Guest"),
            sanitizeText(fullOrder.phone || ""),
            fullOrder.notes ? sanitizeText(fullOrder.notes) : null,
            JSON.stringify(fullOrder.lines),
            fullOrder.subtotal,
            fullOrder.discountType || "amount",
            fullOrder.discountValue || 0,
            fullOrder.discountAmount || 0,
            fullOrder.tax,
            fullOrder.total,
          ],
        );
      });

      broadcastRealtimeEvent({
        type: isNewOrder ? "order:created" : "order:updated",
        restaurantId: tenant.restaurantId,
        branchId: branchId || null,
        payload: {
          id: orderId,
          number: orderNum,
          branchId,
          status: fullOrder.status || "pending",
          tableNumber: fullOrder.tableNumber,
          customerName: fullOrder.customerName,
          phone: fullOrder.phone,
          lines: fullOrder.lines,
          total: fullOrder.total,
          type: fullOrder.type,
          createdAt: new Date().toISOString(),
        },
      });

      if (isNewOrder) {
        sendPushNotification(
          {
            restaurantId: tenant.restaurantId,
            branchId: branchId || null,
            roles: ["owner", "manager", "cashier", "chef", "waiter"],
          },
          {
            title: `🛎️ Order #${orderNum} Created (${fullOrder.tableNumber ? `Table ${fullOrder.tableNumber}` : fullOrder.type || "Dine-in"})`,
            body: `${(fullOrder.lines || []).map((i: any) => `${i.qty || i.quantity || 1}x ${i.name}`).join(", ")} • Total: ${fullOrder.total}`,
            sound: "cash-register",
            orderId,
            url: "/orders",
            unreadCount: 1,
          },
        ).catch(() => {});
      }

      return { success: true };
    } catch (err) {
      console.error("[MySQL] saveOrderServer query error:", err);
      throw new Error(err instanceof Error ? err.message : "Failed to save order in database");
    }
  });

export const updateOrderStatusServer = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; status: FullOrderRecord["status"]; estimatedPrepMinutes?: number }) =>
      z
        .object({
          id: z.string(),
          status: z.enum(["pending", "preparing", "ready", "completed", "cancelled"]),
          estimatedPrepMinutes: z.number().int().positive().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    await requirePermission("orders:update_status");
    const tenant = await resolvePrivateTenantContext();

    try {
      try {
        await query("ALTER TABLE pos_orders ADD COLUMN prep_time_minutes INT DEFAULT NULL");
      } catch {
        /* column exists */
      }
      try {
        await query(
          "ALTER TABLE pos_orders ADD COLUMN prep_started_at TIMESTAMP NULL DEFAULT NULL",
        );
      } catch {
        /* column exists */
      }
      try {
        await query("ALTER TABLE pos_orders ADD COLUMN estimated_prep_minutes INT DEFAULT NULL");
      } catch {
        /* column exists */
      }

      if (data.status === "preparing") {
        await query(
          `UPDATE pos_orders 
           SET status = ?, 
               updated_at = NOW(), 
               prep_started_at = COALESCE(prep_started_at, NOW()),
               estimated_prep_minutes = COALESCE(?, estimated_prep_minutes, 15) 
           WHERE id = ? AND restaurant_id = ?`,
          [data.status, data.estimatedPrepMinutes || null, data.id, tenant.restaurantId],
        );
      } else if (data.status === "completed") {
        await query(
          `UPDATE pos_orders 
           SET status = ?, 
               updated_at = NOW(), 
               prep_time_minutes = COALESCE(prep_time_minutes, GREATEST(0, TIMESTAMPDIFF(MINUTE, COALESCE(prep_started_at, created_at), NOW()))) 
           WHERE id = ? AND restaurant_id = ?`,
          [data.status, data.id, tenant.restaurantId],
        );
      } else {
        await query(
          "UPDATE pos_orders SET status = ?, updated_at = NOW() WHERE id = ? AND restaurant_id = ?",
          [data.status, data.id, tenant.restaurantId],
        );
      }

      broadcastRealtimeEvent({
        type: "order:updated",
        restaurantId: tenant.restaurantId,
        payload: {
          id: data.id,
          status: data.status,
          estimatedPrepMinutes: data.estimatedPrepMinutes,
        },
      });

      return { success: true };
    } catch (err) {
      console.error("[MySQL] updateOrderStatusServer query error:", err);
      throw new Error("Failed to update order status in database");
    }
  });

export const deleteOrderServer = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requirePermission("orders:delete");
    const tenant = await resolvePrivateTenantContext();

    try {
      await query(
        "DELETE FROM pos_orders WHERE id = ? AND (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR))",
        [id, tenant.restaurantId, tenant.restaurantId],
      );
      await query(
        "DELETE FROM orders WHERE id = ? AND (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR))",
        [id, tenant.restaurantId, tenant.restaurantId],
      ).catch(() => null);
      await query("DELETE FROM order_items WHERE order_id = ?", [id]).catch(() => null);

      broadcastRealtimeEvent({
        type: "order:deleted",
        restaurantId: tenant.restaurantId,
        payload: {
          id,
        },
      });

      return { success: true };
    } catch (err) {
      console.error("[MySQL] deleteOrderServer query error:", err);
      throw new Error("Failed to delete order from database");
    }
  });

// =========================================================
// PROMOTIONS MYSQL SERVER FUNCTIONS
// =========================================================

export type PromotionRecord = {
  id: string;
  kind: "seasonal" | "happy-hour" | "limited-time";
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  targetScope?: "all" | "items" | "categories";
  categoryNames?: string[];
  itemIds: string[];
  active: boolean;
  image?: string;
  description?: string;
  showPopup?: boolean;
  branchName?: string;
  branchId?: string;
  createdByRole?: string;
  createdByUserId?: string;
};

function loadPromotionsFromFile(_slug = "burgercraftlab"): PromotionRecord[] | null {
  return null;
}

function savePromotionsToFile(_data: PromotionRecord[], _slug = "burgercraftlab") {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

export type PromotionsFilter = {
  branchId?: string;
  kind?: string;
  activeOnly?: boolean;
  search?: string;
};
const ZPromotionsFilterSchema = z
  .object({
    branchId: z.string().optional(),
    kind: z.string().optional(),
    activeOnly: z.boolean().optional(),
    search: z.string().optional(),
  })
  .optional();

export const getPromotionsServer = createServerFn({ method: "GET" })
  .validator((filter?: PromotionsFilter) => ZPromotionsFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("promotions:manage");
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS promotions (
          id VARCHAR(255) PRIMARY KEY,
          restaurant_id INT NOT NULL,
          kind VARCHAR(50) DEFAULT 'seasonal',
          name VARCHAR(255) NOT NULL,
          discount_percent DECIMAL(5,2) NOT NULL,
          start_date VARCHAR(50),
          end_date VARCHAR(50),
          start_time VARCHAR(20),
          end_time VARCHAR(20),
          target_scope VARCHAR(50) DEFAULT 'all',
          category_names_json TEXT,
          item_ids_json TEXT,
          active TINYINT(1) DEFAULT 1,
          image TEXT,
          description TEXT,
          show_popup TINYINT(1) DEFAULT 1,
          branch_name VARCHAR(255) DEFAULT 'all',
          branch_id VARCHAR(255) DEFAULT 'all',
          created_by_role VARCHAR(50) DEFAULT 'owner',
          created_by_user_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_promotions_restaurant (restaurant_id),
          INDEX idx_promotions_active (restaurant_id, active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try {
        await query("ALTER TABLE promotions ADD COLUMN image TEXT;");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN description TEXT;");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN show_popup TINYINT(1) DEFAULT 1;");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN target_scope VARCHAR(50) DEFAULT 'all';");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN category_names_json TEXT;");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN branch_name VARCHAR(255) DEFAULT 'all';");
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN branch_id VARCHAR(255) DEFAULT 'all';");
      } catch {
        /* column already exists */
      }
      try {
        await query(
          "ALTER TABLE promotions ADD COLUMN created_by_role VARCHAR(50) DEFAULT 'owner';",
        );
      } catch {
        /* column already exists */
      }
      try {
        await query("ALTER TABLE promotions ADD COLUMN created_by_user_id VARCHAR(255);");
      } catch {
        /* column already exists */
      }

      let sql = "SELECT * FROM promotions WHERE (restaurant_id = ? OR restaurant_id = 0)";
      const params: unknown[] = [tenant.restaurantId];

      if (filter.branchId && filter.branchId !== "all") {
        const target = filter.branchId.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return [];
          }
        }
        sql +=
          " AND (branch_id = ? OR branch_id = 'all' OR branch_name = ? OR branch_name = 'all')";
        params.push(filter.branchId, filter.branchId);
      } else if (!assignedInfo.isAll) {
        if (assignedInfo.branches.length === 0) {
          return [];
        }
        const branchClauses: string[] = ["branch_id = 'all'", "branch_name = 'all'"];
        for (const b of assignedInfo.branches) {
          branchClauses.push(
            "branch_id = ?",
            "branch_name = ?",
            "branch_id LIKE ?",
            "branch_name LIKE ?",
          );
          params.push(b.id, b.name, `%${b.id}%`, `%${b.name}%`);
        }
        sql += ` AND (${branchClauses.join(" OR ")})`;
      }

      if (filter.activeOnly) {
        sql += " AND active = 1";
      }

      if (filter.kind && filter.kind !== "all") {
        sql += " AND kind = ?";
        params.push(filter.kind);
      }

      if (filter.search && filter.search.trim()) {
        sql += " AND (name LIKE ? OR description LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s);
      }

      sql += " ORDER BY created_at DESC";

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        const dbPromos: PromotionRecord[] = rows.map((r) => ({
          id: String(r.id),
          kind: (r.kind as PromotionRecord["kind"]) || "seasonal",
          name: String(r.name || ""),
          discountPercent: Number(r.discount_percent || 0),
          startDate: String(r.start_date || ""),
          endDate: String(r.end_date || ""),
          startTime: r.start_time ? String(r.start_time) : undefined,
          endTime: r.end_time ? String(r.end_time) : undefined,
          targetScope: (r.target_scope as PromotionRecord["targetScope"]) || "all",
          categoryNames: r.category_names_json
            ? (JSON.parse(String(r.category_names_json)) as string[])
            : [],
          itemIds: r.item_ids_json ? (JSON.parse(String(r.item_ids_json)) as string[]) : [],
          active: r.active !== 0,
          image: r.image ? String(r.image) : undefined,
          description: r.description ? String(r.description) : undefined,
          showPopup: r.show_popup !== 0,
          branchName: r.branch_name ? String(r.branch_name) : "all",
          branchId: r.branch_id ? String(r.branch_id) : "all",
          createdByRole: r.created_by_role ? String(r.created_by_role) : "owner",
          createdByUserId: r.created_by_user_id ? String(r.created_by_user_id) : undefined,
        }));
        return dbPromos;
      }
    } catch (err) {
      console.warn("[MySQL] getPromotionsServer query warning:", err);
    }
    return [];
  });

const ZPromotionSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["seasonal", "happy-hour", "limited-time"]).optional(),
  name: z.string().min(1),
  discountPercent: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  targetScope: z.enum(["all", "items", "categories"]).optional(),
  categoryNames: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  image: z.string().optional(),
  description: z.string().optional(),
  showPopup: z.boolean().optional(),
  branchName: z.string().optional(),
  branchId: z.string().optional(),
  createdByRole: z.string().optional(),
  createdByUserId: z.string().optional(),
});

export const savePromotionsServer = createServerFn({ method: "POST" })
  .validator(
    (promotions: PromotionRecord[]) =>
      z.array(ZPromotionSchema).parse(promotions) as PromotionRecord[],
  )
  .handler(async ({ data: promotions }) => {
    await requirePermission("promotions:manage");
    const tenant = await resolvePrivateTenantContext();
    const isManager = (tenant.role || "").toLowerCase().trim() === "manager";
    const managerBranch = tenant.branch || "";

    try {
      await transaction(async (conn) => {
        await conn.execute("DELETE FROM promotions WHERE restaurant_id = ?", [tenant.restaurantId]);
        for (const p of promotions) {
          // Preserve Owner-created promotion scope and role
          let promoBranchName = p.branchName || "all";
          let promoBranchId = p.branchId || promoBranchName;
          let createdRole = p.createdByRole || "owner";
          let createdUser = p.createdByUserId || tenant.userId;

          if (p.createdByRole === "owner") {
            createdRole = "owner";
            promoBranchName = p.branchName || "all";
            promoBranchId = p.branchId || promoBranchName;
          } else if (isManager) {
            promoBranchName = managerBranch || p.branchName || "Assigned Branch";
            promoBranchId = p.branchId || promoBranchName;
            createdRole = "manager";
            createdUser = tenant.userId;
          } else if (!p.createdByRole) {
            createdRole = "owner";
            if (!p.branchName) {
              promoBranchName = "all";
              promoBranchId = "all";
            }
          }

          await conn.execute(
            `INSERT INTO promotions (
              id, restaurant_id, kind, name, discount_percent, start_date, end_date, start_time, end_time, target_scope, category_names_json, item_ids_json, active, image, description, show_popup, branch_name, branch_id, created_by_role, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id || crypto.randomUUID(),
              tenant.restaurantId,
              p.kind || "seasonal",
              p.name,
              p.discountPercent || 0,
              p.startDate || "",
              p.endDate || "",
              p.startTime || null,
              p.endTime || null,
              p.targetScope || "all",
              JSON.stringify(p.categoryNames || []),
              JSON.stringify(p.itemIds || []),
              p.active ? 1 : 0,
              p.image || "",
              p.description || "",
              p.showPopup !== false ? 1 : 0,
              promoBranchName,
              promoBranchId,
              createdRole,
              createdUser,
            ],
          );
        }
      });
      return { success: true };
    } catch (err) {
      console.error("[MySQL] savePromotionsServer query error:", err);
      throw new Error("Failed to save promotions in database");
    }
  });

// =========================================================
// PUBLIC ACTIVE PROMOTIONS (no auth required)
// =========================================================

export const getPublicActivePromotionsServer = createServerFn({ method: "GET" })
  .validator((data: { restaurantSlug: string; branchId?: string }) =>
    z.object({ restaurantSlug: z.string(), branchId: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const tenant = await resolvePublicRestaurant(data.restaurantSlug);
      if (!tenant || tenant.restaurantId === 0) return [];

      const rows = await query<Record<string, unknown>[]>(
        `SELECT id, kind, name, discount_percent, start_date, end_date,
                start_time, end_time, target_scope, category_names_json,
                item_ids_json, active, image, description, show_popup,
                branch_name, branch_id
         FROM promotions
         WHERE restaurant_id = ? AND active = 1
         ORDER BY created_at DESC`,
        [tenant.restaurantId],
      );

      if (!rows || rows.length === 0) return [];

      const now = new Date();
      // Use local date string YYYY-MM-DD
      const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const activePromos = rows.filter((r) => {
        // Date range check
        const startDate = r.start_date ? String(r.start_date) : null;
        const endDate = r.end_date ? String(r.end_date) : null;
        if (startDate && todayStr < startDate) return false;
        if (endDate && todayStr > endDate) return false;

        // Time window check (optional — only for happy-hour)
        const startTime = r.start_time ? String(r.start_time).slice(0, 5) : null;
        const endTime = r.end_time ? String(r.end_time).slice(0, 5) : null;
        if (startTime && endTime) {
          if (currentTimeStr < startTime || currentTimeStr > endTime) return false;
        }

        // Branch filter — "all" means every branch
        if (data.branchId) {
          const promoBranchId = r.branch_id ? String(r.branch_id).toLowerCase() : "all";
          const promoBranchName = r.branch_name ? String(r.branch_name).toLowerCase() : "all";
          const targetBranch = data.branchId.toLowerCase();
          if (
            promoBranchId !== "all" &&
            promoBranchName !== "all" &&
            !promoBranchId.includes(targetBranch) &&
            !targetBranch.includes(promoBranchId) &&
            !promoBranchName.includes(targetBranch) &&
            !targetBranch.includes(promoBranchName)
          ) {
            return false;
          }
        }

        return true;
      });

      return activePromos.map((r) => ({
        id: String(r.id),
        kind: String(r.kind || "seasonal"),
        name: String(r.name || ""),
        discountPercent: Number(r.discount_percent || 0),
        startDate: String(r.start_date || ""),
        endDate: String(r.end_date || ""),
        startTime: r.start_time ? String(r.start_time) : undefined,
        endTime: r.end_time ? String(r.end_time) : undefined,
        targetScope: String(r.target_scope || "all") as "all" | "items" | "categories",
        categoryNames: r.category_names_json
          ? (JSON.parse(String(r.category_names_json)) as string[])
          : [],
        itemIds: r.item_ids_json ? (JSON.parse(String(r.item_ids_json)) as string[]) : [],
        image: r.image ? String(r.image) : undefined,
        description: r.description ? String(r.description) : undefined,
        showPopup: r.show_popup !== 0,
        branchName: r.branch_name ? String(r.branch_name) : undefined,
        branchId: r.branch_id ? String(r.branch_id) : "all",
      }));
    } catch (err) {
      console.warn("[MySQL] getPublicActivePromotionsServer warning:", err);
      return [];
    }
  });

// =========================================================
// RESERVATIONS MYSQL SERVER FUNCTIONS
// =========================================================

export type ReservationRecord = {
  id: string;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  date: string;
  time: string;
  seatingArea: string;
  tableNumber?: string;
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled";
  specialNotes?: string;
  occasion?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
};

function getReservationsCachePath(slug = "burgercraftlab") {
  if (typeof window !== "undefined") return "";
  return path.join(process.cwd(), `reservations-${slug}-data-cache.json`);
}

function loadReservationsFromFile(_slug = "burgercraftlab"): ReservationRecord[] | null {
  return null;
}

function saveReservationsToFile(_data: ReservationRecord[], _slug = "burgercraftlab") {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

export type ReservationsFilter = {
  branchId?: string;
  status?: string;
  search?: string;
  date?: string;
  seatingArea?: string;
  limit?: number;
  offset?: number;
};

const ZReservationsFilterSchema = z
  .object({
    branchId: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    date: z.string().optional(),
    seatingArea: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .optional();

export const getReservationsServer = createServerFn({ method: "GET" })
  .validator((filter?: ReservationsFilter) => ZReservationsFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("reservations:manage");
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
      return [];
    }

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE reservations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
          "ALTER TABLE reservations ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE reservations ADD COLUMN branch_id VARCHAR(255) NULL",
          "ALTER TABLE reservations ADD COLUMN branch_name VARCHAR(255) NULL",
          "ALTER TABLE reservations ADD COLUMN guest_name VARCHAR(255) NULL",
          "ALTER TABLE reservations ADD COLUMN guest_phone VARCHAR(50) NULL",
          "ALTER TABLE reservations ADD COLUMN guest_email VARCHAR(255) NULL",
          "ALTER TABLE reservations ADD COLUMN guests INT DEFAULT 2",
          "ALTER TABLE reservations ADD COLUMN reservation_time VARCHAR(50) NULL",
          "ALTER TABLE reservations ADD COLUMN table_number VARCHAR(50) NULL",
          "ALTER TABLE reservations ADD COLUMN status VARCHAR(50) DEFAULT 'confirmed'",
          "ALTER TABLE reservations ADD COLUMN notes TEXT NULL",
          "ALTER TABLE reservations ADD COLUMN special_requests TEXT NULL",
          "ALTER TABLE reservations MODIFY COLUMN id VARCHAR(255) NOT NULL",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      let sql = "SELECT * FROM reservations WHERE (restaurant_id = ? OR restaurant_id = 0)";
      const params: unknown[] = [tenant.restaurantId];

      if (filter.branchId && filter.branchId !== "all") {
        const target = filter.branchId.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return [];
          }
        }
        const idents = await resolveBranchIdentifiers(tenant.restaurantId, filter.branchId);
        const branchClauses: string[] = [];
        for (const ident of idents) {
          branchClauses.push(
            "branch_id = ?",
            "branch_name = ?",
            "branch_id LIKE ?",
            "branch_name LIKE ?",
          );
          params.push(ident, ident, `%${ident}%`, `%${ident}%`);
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      } else if (!assignedInfo.isAll) {
        const branchClauses: string[] = [];
        for (const b of assignedInfo.branches) {
          const idents = await resolveBranchIdentifiers(tenant.restaurantId, b.id || b.name);
          for (const ident of idents) {
            branchClauses.push(
              "branch_id = ?",
              "branch_name = ?",
              "branch_id LIKE ?",
              "branch_name LIKE ?",
            );
            params.push(ident, ident, `%${ident}%`, `%${ident}%`);
          }
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      }

      if (filter.status && filter.status !== "all") {
        sql += " AND status = ?";
        params.push(filter.status);
      }

      if (filter.seatingArea && filter.seatingArea !== "all") {
        sql += " AND seating_area = ?";
        params.push(filter.seatingArea);
      }

      if (filter.date) {
        sql += " AND date = ?";
        params.push(filter.date);
      }

      if (filter.search && filter.search.trim()) {
        sql +=
          " AND (guest_name LIKE ? OR phone LIKE ? OR email LIKE ? OR table_number LIKE ? OR special_notes LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s, s, s, s);
      }

      sql += " ORDER BY date DESC, time ASC";

      if (filter.limit) {
        sql += " LIMIT ? OFFSET ?";
        params.push(Number(filter.limit), Number(filter.offset || 0));
      }

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        const dbRes: ReservationRecord[] = rows.map((r) => ({
          id: String(r.id),
          guestName: String(r.guest_name || ""),
          phone: String(r.phone || ""),
          email: r.email ? String(r.email) : undefined,
          partySize: Number(r.party_size || 2),
          date: String(r.date || ""),
          time: String(r.time || ""),
          seatingArea: String(r.seating_area || "Main Dining Room"),
          tableNumber: r.table_number ? String(r.table_number) : undefined,
          status: (r.status as ReservationRecord["status"]) || "pending",
          specialNotes: r.special_notes ? String(r.special_notes) : undefined,
          occasion: r.occasion ? String(r.occasion) : undefined,
          branchId: r.branch_id ? String(r.branch_id) : undefined,
          branchName: r.branch_name ? String(r.branch_name) : tenant.branch || "Main Branch",
          createdAt: r.created_at
            ? new Date(r.created_at as string).toISOString()
            : new Date().toISOString(),
        }));
        return dbRes;
      }
    } catch (err) {
      console.warn("[MySQL] getReservationsServer query warning:", err);
    }
    return [];
  });

const ZReservationSchema = z.object({
  id: z.string().optional(),
  guestName: z.string().min(1, "Guest name required").max(100),
  phone: z.string().min(1, "Phone number required").max(50),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  partySize: z.number().int().positive("Party size must be at least 1").optional(),
  date: z.string().min(1, "Reservation date required"),
  time: z.string().min(1, "Reservation time required"),
  seatingArea: z.string().max(100).optional(),
  tableNumber: z.string().max(50).optional(),
  branchId: z.string().max(100).optional(),
  branchName: z.string().max(100).optional(),
  status: z.enum(["pending", "confirmed", "seated", "cancelled", "completed"]).optional(),
  specialNotes: z.string().max(500).optional(),
  occasion: z.string().max(100).optional(),
  createdAt: z.string().optional(),
});

export const saveReservationsServer = createServerFn({ method: "POST" })
  .validator(
    (
      data:
        | {
            data: ReservationRecord[];
          }
        | ReservationRecord[],
    ) =>
      z
        .union([z.object({ data: z.array(ZReservationSchema) }), z.array(ZReservationSchema)])
        .parse(data) as unknown as { data?: ReservationRecord[] } | ReservationRecord[],
  )
  .handler(async ({ data }) => {
    await requirePermission("reservations:manage");
    const tenant = await resolvePrivateTenantContext();
    const reservations = Array.isArray(data) ? data : data.data || [];
    try {
      await transaction(async (conn) => {
        if (!tenant.isGlobalAdmin && tenant.branch) {
          await conn.execute(
            "DELETE FROM reservations WHERE restaurant_id = ? AND (branch_id = ? OR branch_name = ? OR branch_name IS NULL OR branch_name = '')",
            [tenant.restaurantId, tenant.branch, tenant.branch],
          );
        } else {
          await conn.execute("DELETE FROM reservations WHERE restaurant_id = ?", [
            tenant.restaurantId,
          ]);
        }

        const [bRows] = await conn.execute(
          "SELECT id, name FROM branches WHERE restaurant_id = ?",
          [tenant.restaurantId],
        );
        const branchList = Array.isArray(bRows)
          ? (bRows as Array<{ id: string; name: string }>)
          : [];

        for (const r of reservations) {
          const target = (r.branchId || r.branchName || "").toLowerCase().trim();
          const matchedBranch = branchList.find(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );

          const resolvedBranchId = matchedBranch ? matchedBranch.id : r.branchId || "";
          const resolvedBranchName = matchedBranch
            ? matchedBranch.name
            : r.branchName || tenant.branch || "Main Branch";

          await conn.execute(
            `INSERT INTO reservations (id, restaurant_id, branch_id, guest_name, phone, email, party_size, date, time, seating_area, branch_name, table_number, status, special_notes, occasion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id || crypto.randomUUID(),
              tenant.restaurantId,
              sanitizeText(resolvedBranchId),
              sanitizeText(r.guestName),
              sanitizeText(r.phone),
              sanitizeText(r.email || ""),
              r.partySize || 2,
              sanitizeText(r.date),
              sanitizeText(r.time),
              sanitizeText(r.seatingArea || "Main Dining Room"),
              sanitizeText(resolvedBranchName),
              sanitizeText(r.tableNumber || ""),
              r.status || "pending",
              sanitizeText(r.specialNotes || ""),
              sanitizeText(r.occasion || ""),
            ],
          );
        }
      });
      return { success: true };
    } catch (err) {
      console.error("[MySQL] saveReservationsServer query error:", err);
      throw new Error("Failed to save reservations in database");
    }
  });

// =========================================================
// SETTINGS MYSQL SERVER FUNCTIONS
// =========================================================

function getSettingsCachePath(slug?: string): string {
  if (slug && slug !== "default") {
    return path.join(process.cwd(), `settings-${slug}-data-cache.json`);
  }
  return path.join(process.cwd(), "settings-data-cache.json");
}

function loadSettingsFromFile(_slug?: string): Record<string, unknown> | null {
  return null;
}

function saveSettingsToFile(_data: Record<string, unknown>, _slug?: string) {
  /* Disabled plain-text disk cache — MySQL database is primary store */
}

type SettingsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, string | number | boolean | null>
  | Array<string | number | boolean | Record<string, string | number | boolean> | null>;

export const getSettingsServer = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("settings:manage");
  const tenant = await resolvePrivateTenantContext();

  try {
    const rows = await query<Record<string, unknown>[]>(
      "SELECT setting_key, setting_value FROM restaurant_settings WHERE restaurant_id = ? ORDER BY setting_key ASC",
      [String(tenant.restaurantId)],
    );

    if (rows && rows.length > 0) {
      const settingsObj: Record<string, SettingsValue> = {};
      for (const r of rows) {
        const k = String(r.setting_key);
        if (settingsObj[k] !== undefined) continue;
        const vStr = String(r.setting_value);
        try {
          settingsObj[k] = JSON.parse(vStr);
        } catch {
          settingsObj[k] = vStr;
        }
      }
      return settingsObj as Record<string, SettingsValue>;
    }
  } catch (err) {
    console.warn("[MySQL] getSettingsServer query warning:", err);
  }

  return {};
});

export const saveSettingsServer = createServerFn({ method: "POST" })
  .validator((data: Record<string, unknown>) => z.record(z.unknown()).parse(data))
  .handler(async ({ data: payload }) => {
    await requirePermission("settings:manage");
    const settings = (payload || {}) as Record<string, unknown>;
    const tenant = await resolvePrivateTenantContext();
    const slug = tenant.slug || "default";
    const tenantIdStr = String(tenant.restaurantId || "default");
    saveSettingsToFile(settings, slug);

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS restaurant_settings (
          restaurant_id VARCHAR(255) NOT NULL DEFAULT 'default',
          setting_key VARCHAR(100) NOT NULL,
          setting_value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (restaurant_id, setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try {
        await query(
          "ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id VARCHAR(255) NOT NULL DEFAULT 'default'",
        );
      } catch {
        /* ignore */
      }

      for (const [key, val] of Object.entries(settings)) {
        const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
        await query(
          `INSERT INTO restaurant_settings (restaurant_id, setting_key, setting_value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [tenantIdStr, key, valStr],
        );
        if (slug && slug !== tenantIdStr) {
          await query(
            `INSERT INTO restaurant_settings (restaurant_id, setting_key, setting_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [slug, key, valStr],
          );
        }
        if (
          key === "app_settings" &&
          typeof val === "object" &&
          val &&
          (val as Record<string, unknown>).currency
        ) {
          const currStr = String((val as Record<string, unknown>).currency);
          await query(
            `INSERT INTO restaurant_settings (restaurant_id, setting_key, setting_value)
             VALUES (?, 'currency', ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [tenantIdStr, currStr],
          );
          if (slug && slug !== tenantIdStr) {
            await query(
              `INSERT INTO restaurant_settings (restaurant_id, setting_key, setting_value)
               VALUES (?, 'currency', ?)
               ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
              [slug, currStr],
            );
          }
        }
      }
      return { success: true };
    } catch (err) {
      console.error("[MySQL] saveSettingsServer query error:", err);
      throw new Error("Failed to save settings in database");
    }
  });

// =========================================================
// STAFF / USER ACCOUNTS MYSQL SERVER FUNCTIONS
// =========================================================

export type StaffRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: "Owner" | "Manager" | "Cashier" | "Chef" | "Waiter" | "Host";
  branch: string;
  status: "active" | "on-leave" | "suspended";
  shift: string;
  joinDate: string;
  avatarUrl?: string;
};

export type StaffFilter = {
  branch?: string;
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

const ZStaffFilterSchema = z
  .object({
    branch: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .optional();

export const getStaffServer = createServerFn({ method: "GET" })
  .validator((filter?: StaffFilter) => ZStaffFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    const tenant = await resolvePrivateTenantContext();
    const assignedInfo = await getUserAssignedBranches(tenant);

    if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
      return [];
    }

    try {
      try {
        await query("ALTER TABLE users ADD COLUMN avatar_url TEXT");
        await query("ALTER TABLE users ADD COLUMN branch VARCHAR(100) DEFAULT 'Main Branch'");
        await query("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active'");
        await query("ALTER TABLE users ADD COLUMN shift VARCHAR(100) DEFAULT 'Full Day'");
      } catch {
        /* ignore if columns already exist */
      }

      let sql = `SELECT u.id, u.email, u.full_name as name, u.phone, ur.role, 
                COALESCE(u.avatar_url, '') as avatar_url,
                COALESCE(u.branch, 'Main Branch') as branch,
                COALESCE(u.status, 'active') as status,
                COALESCE(u.shift, 'Full Day') as shift,
                DATE_FORMAT(u.created_at, '%b %Y') as join_date
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         WHERE ur.restaurant_id = ?`;
      const params: unknown[] = [tenant.restaurantId];

      if (filter.branch && filter.branch !== "all") {
        const target = filter.branch.toLowerCase().trim();
        if (!assignedInfo.isAll) {
          const isAssigned = assignedInfo.branches.some(
            (b) =>
              b.id.toLowerCase() === target ||
              b.name.toLowerCase() === target ||
              b.name.toLowerCase().includes(target) ||
              target.includes(b.name.toLowerCase()),
          );
          if (!isAssigned) {
            return [];
          }
        }
        sql += " AND (u.branch = ? OR u.branch = ? OR u.branch LIKE ?)";
        params.push(filter.branch, filter.branch.replace("branch-", ""), `%${filter.branch}%`);
      } else if (!assignedInfo.isAll) {
        const branchClauses: string[] = [];
        for (const b of assignedInfo.branches) {
          branchClauses.push("u.branch = ?", "u.branch = ?", "u.branch LIKE ?");
          params.push(b.id, b.name, `%${b.name}%`);
        }
        if (branchClauses.length > 0) {
          sql += ` AND (${branchClauses.join(" OR ")})`;
        }
      }

      const isTenantOwner =
        tenant.isGlobalAdmin || (tenant.role || "").toLowerCase().trim() === "owner";
      if (!isTenantOwner) {
        sql += " AND LOWER(ur.role) != 'owner' AND LOWER(ur.role) != 'super_admin'";
      }

      if (filter.role && filter.role !== "all") {
        sql += " AND LOWER(ur.role) = LOWER(?)";
        params.push(filter.role);
      }

      if (filter.status && filter.status !== "all") {
        sql += " AND u.status = ?";
        params.push(filter.status);
      }

      if (filter.search && filter.search.trim()) {
        sql += " AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
        const s = `%${filter.search.trim()}%`;
        params.push(s, s, s);
      }

      sql += ` GROUP BY u.id, ur.role ORDER BY u.created_at DESC`;

      if (filter.limit) {
        sql += " LIMIT ? OFFSET ?";
        params.push(Number(filter.limit), Number(filter.offset || 0));
      }

      const rows = await query<Record<string, unknown>[]>(sql, params);

      if (rows && rows.length > 0) {
        const dbStaffMap = new Map<string, StaffRecord>();
        rows.forEach((r) => {
          let roleName: StaffRecord["role"] = "Waiter";
          const rawRole = String(r.role || "").toLowerCase();
          if (rawRole === "owner") roleName = "Owner";
          else if (rawRole === "manager") roleName = "Manager";
          else if (rawRole === "cashier") roleName = "Cashier";
          else if (rawRole === "chef") roleName = "Chef";
          else if (rawRole === "waiter") roleName = "Waiter";
          else if (rawRole === "host") roleName = "Host";

          const rec: StaffRecord = {
            id: String(r.id),
            name: String(r.name || "Staff Member"),
            email: String(r.email || ""),
            phone: String(r.phone || ""),
            role: roleName,
            branch: String(r.branch || "Main Branch"),
            status: (r.status as StaffRecord["status"]) || "active",
            shift: String(r.shift || "Full Day"),
            joinDate: String(r.join_date || "Jan 2026"),
            avatarUrl:
              r.avatar_url && !String(r.avatar_url).startsWith("blob:")
                ? String(r.avatar_url)
                : undefined,
          };
          const key = (rec.email || rec.id).toLowerCase().trim();
          if (!dbStaffMap.has(key)) {
            dbStaffMap.set(key, rec);
          }
        });
        return Array.from(dbStaffMap.values());
      }
    } catch (err) {
      console.warn("[MySQL] getStaffServer query warning:", err);
    }
    return [];
  });

const ZStaffSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Staff name required").max(100),
    email: z.string().email("Invalid email address"),
    phone: z.string().max(50).optional().or(z.literal("")),
    password: z.string().min(6).optional().or(z.literal("")),
    role: z.enum(["Owner", "Manager", "Cashier", "Chef", "Waiter", "Host"]),
    branch: z.string().max(100).optional().or(z.literal("")),
    status: z.enum(["active", "on-leave", "suspended", "inactive"]).optional(),
    shift: z.string().max(100).optional().or(z.literal("")),
    joinDate: z.string().optional().or(z.literal("")),
    avatarUrl: z.string().optional().or(z.literal("")),
  })
  .passthrough();

export const saveStaffServer = createServerFn({ method: "POST" })
  .validator(
    (staffMember: StaffRecord) => ZStaffSchema.parse(staffMember) as unknown as StaffRecord,
  )
  .handler(async ({ data: s }) => {
    await requirePermission("staff:manage");
    const tenant = await resolvePrivateTenantContext();
    const isTenantOwner =
      tenant.isGlobalAdmin || (tenant.role || "").toLowerCase().trim() === "owner";
    const isManager = (tenant.role || "").toLowerCase().trim() === "manager";
    const managerBranch = tenant.branch || "";

    if (!isTenantOwner && s.role.toLowerCase() === "owner") {
      throw new Error("Forbidden: Only restaurant owners can assign or edit Owner role accounts.");
    }

    try {
      try {
        const pool = await getPool();
        const alters = [
          "ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
          "ALTER TABLE users ADD COLUMN full_name VARCHAR(255) NULL",
          "ALTER TABLE users ADD COLUMN name VARCHAR(255) NULL",
          "ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL",
          "ALTER TABLE users ADD COLUMN avatar_url TEXT NULL",
          "ALTER TABLE users ADD COLUMN branch VARCHAR(255) NULL",
          "ALTER TABLE users ADD COLUMN assigned_branch_id VARCHAR(255) NULL",
          "ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active'",
          "ALTER TABLE users ADD COLUMN shift VARCHAR(100) DEFAULT 'Full Day'",
          "ALTER TABLE users ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
          "ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'waiter'",
          "ALTER TABLE user_roles ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
        ];
        for (const alt of alters) {
          try {
            await pool.query(alt);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      const roleLower = s.role.toLowerCase().trim();
      const sanitizedName = sanitizeText(s.name);
      const sanitizedEmail = s.email.toLowerCase().trim();
      const sanitizedPhone = sanitizeText(s.phone || "");
      let sanitizedBranch = sanitizeText(s.branch || "Main Branch");
      if (isManager && managerBranch) {
        sanitizedBranch = sanitizeText(managerBranch);
      }

      // Always resolve to the authoritative branch UUID if available
      try {
        const bRows = await query<Record<string, unknown>[]>(
          "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?) LIMIT 1",
          [
            tenant.restaurantId,
            sanitizedBranch,
            sanitizedBranch,
            sanitizedBranch,
            `%${sanitizedBranch}%`,
          ],
        );
        if (bRows && bRows.length > 0 && bRows[0].id) {
          sanitizedBranch = String(bRows[0].id);
        }
      } catch {
        /* ignore */
      }

      const sanitizedShift = sanitizeText(s.shift || "Full Day");
      const sanitizedAvatar = s.avatarUrl && !s.avatarUrl.startsWith("blob:") ? s.avatarUrl : null;

      // Check if user exists across the users table by email
      const existingByEmail = await query<Record<string, unknown>[]>(
        "SELECT id, email, role, branch FROM users WHERE email = ? LIMIT 1",
        [sanitizedEmail],
      );

      // Check if this is an update to an existing user record
      const isExistingUser = s.id
        ? await query<Record<string, unknown>[]>(
            "SELECT id, email, role, branch FROM users WHERE id = ? LIMIT 1",
            [s.id],
          )
        : [];

      if (existingByEmail && existingByEmail.length > 0) {
        const existingUserId = String(existingByEmail[0].id);
        // If creating new staff or email belongs to a different user
        if (
          !s.id ||
          (isExistingUser && isExistingUser.length === 0) ||
          existingUserId !== String(s.id)
        ) {
          throw new Error("User already exists with this email address");
        }
      }

      const targetExisting =
        isExistingUser && isExistingUser.length > 0 ? isExistingUser : existingByEmail;

      if (targetExisting && targetExisting.length > 0 && !isTenantOwner) {
        const existingRole = String(targetExisting[0].role || "").toLowerCase();
        if (existingRole === "owner" || existingRole === "super_admin") {
          throw new Error("Forbidden: Managers cannot modify Owner accounts.");
        }
      }

      if (targetExisting && targetExisting.length > 0) {
        const userId = String(targetExisting[0].id);
        if (s.password && s.password.trim().length >= 6) {
          const passHash = await hashPassword(s.password.trim());
          await query(
            `UPDATE users SET email = ?, full_name = ?, name = ?, password_hash = ?, phone = ?, avatar_url = ?, branch = ?, assigned_branch_id = ?, status = ?, shift = ?, restaurant_id = ?, role = ? WHERE id = ?`,
            [
              sanitizedEmail,
              sanitizedName,
              sanitizedName,
              passHash,
              sanitizedPhone,
              sanitizedAvatar,
              sanitizedBranch,
              sanitizedBranch,
              s.status || "active",
              sanitizedShift,
              tenant.restaurantId,
              roleLower,
              userId,
            ],
          );
        } else {
          await query(
            `UPDATE users SET email = ?, full_name = ?, name = ?, phone = ?, avatar_url = ?, branch = ?, assigned_branch_id = ?, status = ?, shift = ?, restaurant_id = ?, role = ? WHERE id = ?`,
            [
              sanitizedEmail,
              sanitizedName,
              sanitizedName,
              sanitizedPhone,
              sanitizedAvatar,
              sanitizedBranch,
              sanitizedBranch,
              s.status || "active",
              sanitizedShift,
              tenant.restaurantId,
              roleLower,
              userId,
            ],
          );
        }
        try {
          await query(
            `INSERT INTO user_roles (id, user_id, role, restaurant_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), restaurant_id = VALUES(restaurant_id)`,
            [crypto.randomUUID(), userId, roleLower, tenant.restaurantId],
          );
        } catch {
          await query(`UPDATE user_roles SET role = ?, restaurant_id = ? WHERE user_id = ?`, [
            roleLower,
            tenant.restaurantId,
            userId,
          ]);
        }
      } else {
        const newId = s.id || crypto.randomUUID();
        const passHash = s.password
          ? await hashPassword(s.password.trim())
          : await hashPassword("password123");
        await query(
          `INSERT INTO users (id, email, password_hash, full_name, name, phone, avatar_url, branch, assigned_branch_id, status, shift, restaurant_id, role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            sanitizedEmail,
            passHash,
            sanitizedName,
            sanitizedName,
            sanitizedPhone,
            sanitizedAvatar,
            sanitizedBranch,
            sanitizedBranch,
            s.status || "active",
            sanitizedShift,
            tenant.restaurantId,
            roleLower,
          ],
        );
        try {
          await query(
            `INSERT INTO user_roles (id, user_id, role, restaurant_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), restaurant_id = VALUES(restaurant_id)`,
            [crypto.randomUUID(), newId, roleLower, tenant.restaurantId],
          );
        } catch {
          /* ignore */
        }
      }
      return { success: true };
    } catch (err: unknown) {
      console.error("[MySQL] saveStaffServer query error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save staff member in database";
      throw new Error(msg);
    }
  });

export const updateStaffAvatarServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      avatarUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
    }).parse,
  )
  .handler(async ({ data }) => {
    const authUser = await requireAuth();
    const isSelf = authUser.id === data.id || authUser.email === data.id;
    if (!isSelf) {
      await requirePermission("staff:manage");
    }
    // Never persist blob: URLs into MySQL database (only real CDN/HTTP URLs or null)
    const cleanAvatar =
      data.avatarUrl && !data.avatarUrl.startsWith("blob:") ? data.avatarUrl : null;
    await query(`UPDATE users SET avatar_url = ? WHERE id = ? OR email = ?`, [
      cleanAvatar,
      data.id,
      data.id,
    ]);
    return { success: true };
  });

export const updateUserEmailServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      newEmail: z.string().email("Invalid email address"),
    }).parse,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    const existing = await query<Record<string, unknown>[]>(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [data.newEmail, data.id],
    );
    if (existing && existing.length > 0) {
      throw new Error("Email address is already in use by another account.");
    }
    await query("UPDATE users SET email = ? WHERE id = ?", [data.newEmail, data.id]);
    return { success: true };
  });
export const verifyCurrentPasswordServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      password: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    const users = await query<Record<string, string>[]>(
      "SELECT password_hash FROM users WHERE id = ?",
      [data.id],
    );
    if (!users || users.length === 0) {
      throw new Error("User account not found.");
    }
    const isValid = await verifyPassword(data.password, users[0].password_hash);
    if (!isValid) {
      throw new Error("Current password is incorrect.");
    }
    return { valid: true };
  });
export const updateUserPasswordServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }).parse,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    const users = await query<Record<string, string>[]>(
      "SELECT password_hash FROM users WHERE id = ?",
      [data.id],
    );
    if (!users || users.length === 0) {
      throw new Error("User account not found.");
    }
    const isValid = await verifyPassword(data.currentPassword, users[0].password_hash);
    if (!isValid) {
      throw new Error("Current password is incorrect.");
    }
    const newHash = await hashPassword(data.newPassword);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, data.id]);
    return { success: true };
  });

export const deleteStaffServer = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requirePermission("staff:manage");
    const tenant = await resolvePrivateTenantContext();
    const isTenantOwner =
      tenant.isGlobalAdmin || (tenant.role || "").toLowerCase().trim() === "owner";

    try {
      const targetRoles = await query<Record<string, unknown>[]>(
        "SELECT role FROM user_roles WHERE user_id = ? AND restaurant_id = ?",
        [id, tenant.restaurantId],
      );
      const targetIsOwner = (targetRoles || []).some(
        (r) =>
          String(r.role).toLowerCase() === "owner" ||
          String(r.role).toLowerCase() === "super_admin",
      );
      if (targetIsOwner && !isTenantOwner) {
        throw new Error("Forbidden: Managers cannot delete Owner accounts.");
      }

      await query("DELETE FROM user_roles WHERE user_id = ? AND restaurant_id = ?", [
        id,
        tenant.restaurantId,
      ]);
      const remainingRoles = await query<Record<string, unknown>[]>(
        "SELECT id FROM user_roles WHERE user_id = ?",
        [id],
      );
      if (!remainingRoles || remainingRoles.length === 0) {
        await query("DELETE FROM users WHERE id = ?", [id]);
      }
      return { success: true };
    } catch (err) {
      console.error("[MySQL] deleteStaffServer query error:", err);
      throw new Error("Failed to delete staff member from database");
    }
  });

export const saveAdminUserAccountServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      name: string;
      email: string;
      password?: string;
      role: string;
      restaurantName?: string;
      branchName?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_system_users");

    const emailClean = data.email.toLowerCase().trim();
    let restaurantId: number | null = null;

    if (data.restaurantName && data.restaurantName !== "All Restaurants (Global)") {
      try {
        const rows = await query<Record<string, unknown>[]>(
          "SELECT id FROM restaurants WHERE name = ? OR slug = ? LIMIT 1",
          [data.restaurantName, data.restaurantName],
        );
        if (rows && rows.length > 0) {
          restaurantId = Number(rows[0].id);
        }
      } catch {
        /* ignore */
      }
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;
    let targetRestaurantId = restaurantId ?? 1;
    if (data.restaurantName === "All Restaurants (Global)") {
      targetRestaurantId = 0;
    }
    const targetPasswordHash = passwordHash || (await hashPassword("password123"));
    const roleDb = data.role.toLowerCase().trim();

    try {
      const existing = await query<Record<string, unknown>[]>(
        "SELECT id FROM users WHERE email = ? OR id = ? LIMIT 1",
        [emailClean, data.id || ""],
      );

      if (existing && existing.length > 0) {
        const uid = String(existing[0].id);
        if (passwordHash) {
          await query(
            "UPDATE users SET full_name = ?, name = ?, password_hash = ?, branch = ?, role = ?, restaurant_id = ? WHERE id = ?",
            [
              data.name,
              data.name,
              passwordHash,
              data.branchName || "Main Branch",
              roleDb,
              targetRestaurantId,
              uid,
            ],
          );
        } else {
          await query(
            "UPDATE users SET full_name = ?, name = ?, branch = ?, role = ?, restaurant_id = ? WHERE id = ?",
            [
              data.name,
              data.name,
              data.branchName || "Main Branch",
              roleDb,
              targetRestaurantId,
              uid,
            ],
          );
        }
        try {
          await query(
            "INSERT INTO user_roles (user_id, role, restaurant_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), restaurant_id = VALUES(restaurant_id)",
            [uid, roleDb, targetRestaurantId],
          );
        } catch {
          /* ignore user_roles sync if not available */
        }
        return { success: true, id: uid };
      } else {
        const uid = data.id || crypto.randomUUID();
        await query(
          "INSERT INTO users (id, email, password_hash, full_name, name, branch, role, restaurant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')",
          [
            uid,
            emailClean,
            targetPasswordHash,
            data.name,
            data.name,
            data.branchName || "Main Branch",
            roleDb,
            targetRestaurantId,
          ],
        );
        try {
          await query(
            "INSERT INTO user_roles (user_id, role, restaurant_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), restaurant_id = VALUES(restaurant_id)",
            [uid, roleDb, targetRestaurantId],
          );
        } catch {
          /* ignore user_roles sync if not available */
        }
        return { success: true, id: uid };
      }
    } catch (err) {
      console.error("[MySQL] saveAdminUserAccountServer error:", err);
      throw new Error((err as Error)?.message || "Failed to save user account credentials");
    }
  });

export const getAdminUsersServer = createServerFn({ method: "GET" }).handler(async () => {
  await requireAuth();
  await requirePermission("platform:manage_system_users");

  try {
    const rows = await query<Record<string, unknown>[]>(
      `SELECT 
        u.id,
        COALESCE(u.full_name, u.name, 'User') AS name,
        u.email,
        COALESCE(u.phone, '') AS phone,
        COALESCE(ur.role, u.role, 'owner') AS role,
        COALESCE(r.name, u.branch, 'Main Location') AS restaurant_name,
        COALESCE(u.branch, 'Main Branch') AS branch_name,
        COALESCE(u.status, 'active') AS status,
        COALESCE(DATE_FORMAT(u.created_at, '%b %Y'), 'Recent') AS joined_date
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN restaurants r ON r.id = COALESCE(ur.restaurant_id, u.restaurant_id)
       ORDER BY u.created_at DESC`,
    );

    if (rows && rows.length > 0) {
      return rows.map((u) => {
        const rawRole = String(u.role || "")
          .toLowerCase()
          .replace(/_/g, " ")
          .trim();
        const roleDisplay =
          rawRole === "super admin" || rawRole === "admin"
            ? "Super Admin"
            : rawRole === "owner"
              ? "Owner"
              : rawRole === "manager"
                ? "Manager"
                : rawRole === "cashier"
                  ? "Cashier"
                  : rawRole === "chef"
                    ? "Chef"
                    : rawRole === "waiter"
                      ? "Waiter"
                      : rawRole === "host"
                        ? "Host"
                        : "Owner";

        return {
          id: String(u.id),
          name: String(u.name || "User"),
          email: String(u.email || ""),
          phone: String(u.phone || ""),
          role: roleDisplay as
            "Super Admin" | "Owner" | "Manager" | "Cashier" | "Chef" | "Waiter" | "Host",
          restaurantName: String(u.restaurant_name || "All Restaurants (Global)"),
          branchName: String(u.branch_name || "Main Branch"),
          status: (String(u.status || "active") === "suspended" ? "suspended" : "active") as
            "active" | "invited" | "suspended",
          lastActive: "Just now",
          joinedDate: String(u.joined_date || "Recent"),
        };
      });
    }
  } catch (err) {
    console.error("[getAdminUsersServer Error]", err);
  }

  return [];
});

export const deleteAdminUserAccountServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    await requirePermission("platform:manage_system_users");

    try {
      await query("DELETE FROM user_roles WHERE user_id = ?", [data.id]);
      await query("DELETE FROM users WHERE id = ?", [data.id]);
      return { success: true };
    } catch (err) {
      console.error("[deleteAdminUserAccountServer Error]", err);
      throw new Error("Failed to delete user account");
    }
  });

// =========================================================
// QR SCAN & MENU VIEW ANALYTICS MYSQL SERVER FUNCTIONS
// =========================================================

export const recordAnalyticsEventServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      eventType: "qr_scan" | "menu_view";
      restaurantId?: string;
      branchId?: string;
      tableNo?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    checkRateLimit("analytics", undefined, { maxRequests: 30, windowMs: 60 * 1000 });
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          restaurant_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          branch_id VARCHAR(255),
          table_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      let rId = data.restaurantId ? String(data.restaurantId) : "";
      if (!rId) {
        const tenant = await resolveTenantContext();
        rId = String(tenant.restaurantId || "1");
      }

      await query(
        `INSERT INTO analytics_events (restaurant_id, event_type, branch_id, table_no) VALUES (?, ?, ?, ?)`,
        [rId || "1", data.eventType, data.branchId || null, data.tableNo || null],
      );
      return { success: true };
    } catch (err) {
      console.warn("[MySQL] recordAnalyticsEventServer query warning:", err);
      return { success: false };
    }
  });

export type AnalyticsFilter = {
  branchId?: string;
  startDate?: string;
  endDate?: string;
};

const ZAnalyticsFilterSchema = z
  .object({
    branchId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .optional();

export const getAnalyticsSummaryServer = createServerFn({ method: "GET" })
  .validator((filter?: AnalyticsFilter) => ZAnalyticsFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("analytics:view");
    const tenant = await resolvePrivateTenantContext();

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          restaurant_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          branch_id VARCHAR(255),
          table_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      let branchClause = "";
      const branchParams: unknown[] = [tenant.restaurantId, tenant.restaurantId];

      if (filter.branchId && filter.branchId !== "all") {
        branchClause = " AND (branch_id = ? OR branch_id = ?)";
        branchParams.push(filter.branchId, filter.branchId.replace("branch-", ""));
      } else if (!tenant.isGlobalAdmin && tenant.branch) {
        branchClause =
          " AND (branch_id = ? OR branch_id = ? OR branch_id IS NULL OR branch_id = '')";
        branchParams.push(tenant.branch, tenant.branch.replace("branch-", ""));
      }

      if (filter.startDate) {
        branchClause += " AND created_at >= ?";
        branchParams.push(
          filter.startDate.length === 10 ? `${filter.startDate} 00:00:00` : filter.startDate,
        );
      }
      if (filter.endDate) {
        branchClause += " AND created_at <= ?";
        branchParams.push(
          filter.endDate.length === 10 ? `${filter.endDate} 23:59:59` : filter.endDate,
        );
      }

      const scanRows = await query<Record<string, unknown>[]>(
        `SELECT event_type, COUNT(*) as cnt
         FROM analytics_events
         WHERE (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR))${branchClause}
         GROUP BY event_type`,
        branchParams,
      );

      let totalScans = 0;
      let totalViews = 0;

      if (scanRows && Array.isArray(scanRows)) {
        for (const r of scanRows) {
          if (r.event_type === "qr_scan") totalScans = Number(r.cnt || 0);
          if (r.event_type === "menu_view") totalViews = Number(r.cnt || 0);
        }
      }

      const hourlyRows = await query<Record<string, unknown>[]>(
        `SELECT HOUR(created_at) as hr, event_type, COUNT(*) as cnt
         FROM analytics_events
         WHERE (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR))${branchClause}
         GROUP BY HOUR(created_at), event_type`,
        branchParams,
      );

      const hoursMap: Record<string, { hour: string; orders: number; scans: number }> = {};
      for (let i = 8; i <= 21; i++) {
        const hStr = `${i}:00`;
        hoursMap[hStr] = { hour: hStr, orders: 0, scans: 0 };
      }

      if (hourlyRows && Array.isArray(hourlyRows)) {
        for (const r of hourlyRows) {
          const h = Number(r.hr);
          const key = `${h}:00`;
          if (hoursMap[key]) {
            if (r.event_type === "qr_scan") hoursMap[key].scans += Number(r.cnt || 0);
            if (r.event_type === "menu_view") hoursMap[key].orders += Number(r.cnt || 0);
          }
        }
      }

      const deviceRows = await query<Record<string, unknown>[]>(
        `SELECT device_type as name, COUNT(*) as value
         FROM analytics_events
         WHERE (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR)) AND device_type IS NOT NULL AND device_type != ''${branchClause}
         GROUP BY device_type`,
        branchParams,
      ).catch(() => []);

      const devices =
        deviceRows && Array.isArray(deviceRows) && deviceRows.length > 0
          ? deviceRows.map((r) => ({
              name: String(r.name || "Mobile"),
              value: Number(r.value || 0),
            }))
          : totalViews > 0 || totalScans > 0
            ? [{ name: "Mobile", value: totalScans + totalViews }]
            : [];

      const countryRows = await query<Record<string, unknown>[]>(
        `SELECT country as name, COUNT(*) as value
         FROM analytics_events
         WHERE (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR)) AND country IS NOT NULL AND country != ''${branchClause}
         GROUP BY country`,
        branchParams,
      ).catch(() => []);

      const countries =
        countryRows && Array.isArray(countryRows) && countryRows.length > 0
          ? countryRows.map((r) => ({
              name: String(r.name || "Local"),
              value: Number(r.value || 0),
            }))
          : totalViews > 0 || totalScans > 0
            ? [{ name: "Local", value: totalScans + totalViews }]
            : [];

      const langRows = await query<Record<string, unknown>[]>(
        `SELECT language as name, COUNT(*) as value
         FROM analytics_events
         WHERE (restaurant_id = ? OR restaurant_id = CAST(? AS CHAR)) AND language IS NOT NULL AND language != ''${branchClause}
         GROUP BY language`,
        branchParams,
      ).catch(() => []);

      const languages =
        langRows && Array.isArray(langRows) && langRows.length > 0
          ? langRows.map((r) => ({
              name: String(r.name || "English"),
              value: Number(r.value || 0),
            }))
          : totalViews > 0 || totalScans > 0
            ? [{ name: "English", value: totalScans + totalViews }]
            : [];

      return {
        totalScans,
        totalViews,
        hourlyData: Object.values(hoursMap),
        devices,
        countries,
        languages,
      };
    } catch (err) {
      console.warn("[MySQL] getAnalyticsSummaryServer query warning:", err);
      return {
        totalScans: 0,
        totalViews: 0,
        hourlyData: [],
        devices: [],
        countries: [],
        languages: [],
      };
    }
  });

// =========================================================
// WAITER REQUEST SERVER FUNCTIONS
// =========================================================

export type WaiterRequestType = "call" | "water" | "bill" | "custom";
export type WaiterRequestStatus = "pending" | "acknowledged" | "done";

export type WaiterRequest = {
  id: string;
  restaurantId: number;
  branchId: string | null;
  tableNo: string;
  type: WaiterRequestType;
  note: string | null;
  status: WaiterRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type WaiterFilter = {
  branchId?: string;
  tableNo?: string;
  type?: string;
  status?: string;
};

const ZWaiterFilterSchema = z
  .object({
    branchId: z.string().optional(),
    tableNo: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
  })
  .optional();

async function ensureWaiterRequestsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS waiter_requests (
      id VARCHAR(36) PRIMARY KEY,
      restaurant_id INT NOT NULL DEFAULT 1,
      branch_id VARCHAR(100),
      table_no VARCHAR(50) NOT NULL,
      type ENUM('call','water','bill','custom') DEFAULT 'call',
      note TEXT,
      status ENUM('pending','acknowledged','done') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_restaurant_status (restaurant_id, status),
      INDEX idx_table (restaurant_id, table_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/** PUBLIC — customer submits a call/water/bill request from QR landing page */
export const createWaiterRequestServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      restaurantUsername: string;
      branchId: string;
      tableNo: string;
      type: WaiterRequestType;
      note?: string;
    }) =>
      z
        .object({
          restaurantUsername: z.string(),
          branchId: z.string(),
          tableNo: z.string(),
          type: z.enum(["call", "water", "bill", "custom"]),
          note: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    checkRateLimit("waiter_request", `${data.restaurantUsername}:${data.tableNo}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    const { restaurantUsername, branchId, tableNo, type, note } = data;
    const publicTenant = await resolvePublicRestaurant(restaurantUsername);

    let resolvedBranchId = branchId ? String(branchId).trim() : null;
    try {
      if (resolvedBranchId) {
        const bRows = await query<Record<string, unknown>[]>(
          "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?) LIMIT 1",
          [
            publicTenant.restaurantId,
            resolvedBranchId,
            resolvedBranchId,
            resolvedBranchId,
            `%${resolvedBranchId}%`,
          ],
        );
        if (bRows && bRows.length > 0 && bRows[0].id) {
          resolvedBranchId = String(bRows[0].id);
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO waiter_requests
           (id, restaurant_id, branch_id, table_no, type, note, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [id, publicTenant.restaurantId, resolvedBranchId || null, tableNo, type, note || null],
      );

      broadcastRealtimeEvent({
        type: "waiter:called",
        restaurantId: publicTenant.restaurantId,
        branchId: resolvedBranchId || null,
        payload: {
          id,
          restaurantId: Number(publicTenant.restaurantId),
          branchId: resolvedBranchId || null,
          tableNo,
          type,
          note: note || null,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      sendPushNotification(
        {
          restaurantId: publicTenant.restaurantId,
          branchId: resolvedBranchId || null,
          roles: ["waiter", "manager", "owner"],
        },
        {
          title: `👋 Table ${tableNo} Needs Assistance (${type.toUpperCase()})`,
          body: note ? `Note: ${note}` : `Guest at Table ${tableNo} requested ${type}.`,
          sound: "urgent",
          url: "/waiter-panel",
          unreadCount: 1,
        },
      ).catch(() => {});

      return { success: true, id };
    } catch (err) {
      console.warn("[MySQL] createWaiterRequestServer error:", err);
      throw new Error("Failed to submit request. Please try again.");
    }
  });

/** AUTHENTICATED — waiter fetches active requests for their restaurant */
export const getWaiterRequestsServer = createServerFn({ method: "GET" })
  .validator((filter?: WaiterFilter) => ZWaiterFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("waiter_requests:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      let sql = "SELECT * FROM waiter_requests WHERE restaurant_id = ? AND status != 'done'";
      const params: unknown[] = [tenant.restaurantId];

      const targetBranch = (
        filter.branchId ||
        (!tenant.isGlobalAdmin ? tenant.branch : undefined) ||
        ""
      ).trim();
      if (targetBranch && targetBranch !== "all") {
        const branchIds = await resolveBranchIdentifiers(tenant.restaurantId, targetBranch);
        if (branchIds.length > 0) {
          const placeholders = branchIds.map(() => "?").join(", ");
          sql += ` AND (branch_id IN (${placeholders}) OR branch_id IS NULL OR branch_id = '')`;
          params.push(...branchIds);
        }
      }

      if (filter.tableNo) {
        sql += " AND table_no = ?";
        params.push(filter.tableNo);
      }

      if (filter.type && filter.type !== "all") {
        sql += " AND type = ?";
        params.push(filter.type);
      }

      sql += " ORDER BY created_at DESC LIMIT 100";

      const rows = await query<Record<string, unknown>[]>(sql, params);

      return (rows || []).map((r): WaiterRequest => ({
        id: String(r.id),
        restaurantId: Number(r.restaurant_id),
        branchId: r.branch_id ? String(r.branch_id) : null,
        tableNo: String(r.table_no),
        type: (r.type as WaiterRequestType) || "call",
        note: r.note ? String(r.note) : null,
        status: (r.status as WaiterRequestStatus) || "pending",
        createdAt: r.created_at
          ? new Date(r.created_at as string).toISOString()
          : new Date().toISOString(),
        updatedAt: r.updated_at
          ? new Date(r.updated_at as string).toISOString()
          : new Date().toISOString(),
      }));
    } catch (err) {
      console.warn("[MySQL] getWaiterRequestsServer error:", err);
      return [];
    }
  });

/** AUTHENTICATED — waiter updates request status (acknowledged / done) */
export const updateWaiterRequestServer = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: WaiterRequestStatus }) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["pending", "acknowledged", "done"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requirePermission("waiter_requests:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      await query(
        `UPDATE waiter_requests
         SET status = ?
         WHERE id = ? AND restaurant_id = ?`,
        [data.status, data.id, tenant.restaurantId],
      );

      broadcastRealtimeEvent({
        type: "waiter:resolved",
        restaurantId: tenant.restaurantId,
        payload: {
          id: data.id,
          status: data.status,
        },
      });

      return { success: true };
    } catch (err) {
      console.warn("[MySQL] updateWaiterRequestServer error:", err);
      throw new Error("Failed to update request status.");
    }
  });

/** AUTHENTICATED — fetch all done requests (history for waiter panel) */
export const getWaiterRequestHistoryServer = createServerFn({ method: "GET" })
  .validator((filter?: WaiterFilter) => ZWaiterFilterSchema.parse(filter))
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("waiter_requests:manage");
    const tenant = await resolvePrivateTenantContext();

    try {
      let sql = "SELECT * FROM waiter_requests WHERE restaurant_id = ? AND status = 'done'";
      const params: unknown[] = [tenant.restaurantId];

      const targetBranch = (
        filter.branchId ||
        (!tenant.isGlobalAdmin ? tenant.branch : undefined) ||
        ""
      ).trim();
      if (targetBranch && targetBranch !== "all") {
        const branchIds = await resolveBranchIdentifiers(tenant.restaurantId, targetBranch);
        if (branchIds.length > 0) {
          const placeholders = branchIds.map(() => "?").join(", ");
          sql += ` AND (branch_id IN (${placeholders}) OR branch_id IS NULL OR branch_id = '')`;
          params.push(...branchIds);
        }
      }

      if (filter.tableNo) {
        sql += " AND table_no = ?";
        params.push(filter.tableNo);
      }

      sql += " ORDER BY updated_at DESC LIMIT 50";

      const rows = await query<Record<string, unknown>[]>(sql, params);

      return (rows || []).map((r): WaiterRequest => ({
        id: String(r.id),
        restaurantId: Number(r.restaurant_id),
        branchId: r.branch_id ? String(r.branch_id) : null,
        tableNo: String(r.table_no),
        type: (r.type as WaiterRequestType) || "call",
        note: r.note ? String(r.note) : null,
        status: (r.status as WaiterRequestStatus) || "done",
        createdAt: r.created_at
          ? new Date(r.created_at as string).toISOString()
          : new Date().toISOString(),
        updatedAt: r.updated_at
          ? new Date(r.updated_at as string).toISOString()
          : new Date().toISOString(),
      }));
    } catch (err) {
      console.warn("[MySQL] getWaiterRequestHistoryServer error:", err);
      return [];
    }
  });

/** AUTHENTICATED — fetch active dine-in orders for waiter panel (pending/preparing) */
export const getWaiterActiveOrdersServer = createServerFn({ method: "GET" })
  .validator((filter?: { branchId?: string }) =>
    z.object({ branchId: z.string().optional() }).optional().parse(filter),
  )
  .handler(async ({ data: filter = {} }) => {
    await requirePermission("orders:view");
    const tenant = await resolvePrivateTenantContext();

    try {
      let sql = `SELECT * FROM pos_orders
       WHERE restaurant_id = ?
         AND type = 'dine-in'
         AND status IN ('pending', 'preparing', 'ready')`;
      const params: unknown[] = [tenant.restaurantId];

      const targetBranch = (
        filter?.branchId ||
        (!tenant.isGlobalAdmin ? tenant.branch : undefined) ||
        ""
      ).trim();
      if (targetBranch && targetBranch !== "all") {
        const branchIds = await resolveBranchIdentifiers(tenant.restaurantId, targetBranch);
        if (branchIds.length > 0) {
          const placeholders = branchIds.map(() => "?").join(", ");
          sql += ` AND (branch_id IN (${placeholders}) OR branch_id IS NULL OR branch_id = '')`;
          params.push(...branchIds);
        }
      }

      sql += " ORDER BY created_at DESC";

      const rows = await query<Record<string, unknown>[]>(sql, params);

      return (rows || []).map((r): FullOrderRecord => {
        let lines: Array<{ itemId: string; name: string; price: number; qty: number }> = [];
        if (r.lines_json) {
          if (Array.isArray(r.lines_json)) {
            lines = r.lines_json.map((l: Record<string, unknown>) => ({
              itemId: String(l.itemId || l.id || crypto.randomUUID()),
              name: String(l.name || l.item_name || "Food Item"),
              price: Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0),
              qty: Number(l.qty ?? l.quantity ?? 1),
            }));
          } else if (typeof r.lines_json === "string" && r.lines_json.trim()) {
            try {
              const parsed = JSON.parse(r.lines_json.trim());
              const arr = Array.isArray(parsed)
                ? parsed
                : typeof parsed === "object" && parsed !== null
                  ? [parsed]
                  : [];
              lines = arr.map((l: Record<string, unknown>) => ({
                itemId: String(l.itemId || l.id || crypto.randomUUID()),
                name: String(l.name || l.item_name || "Food Item"),
                price: Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0),
                qty: Number(l.qty ?? l.quantity ?? 1),
              }));
            } catch {
              lines = [];
            }
          }
        }

        const parseDate = (d: unknown): string => {
          if (!d) return new Date().toISOString();
          if (d instanceof Date)
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          try {
            const dt = new Date(String(d));
            return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
          } catch {
            return new Date().toISOString();
          }
        };

        return {
          id: String(r.id),
          number: Number(r.order_number || 1),
          branchId: r.branch_id ? String(r.branch_id) : undefined,
          createdAt: parseDate(r.created_at),
          updatedAt: parseDate(r.updated_at),
          type: "dine-in",
          status: (r.status as FullOrderRecord["status"]) || "pending",
          tableNumber: r.table_number ? String(r.table_number) : undefined,
          customerName: String(r.customer_name || "Guest"),
          phone: String(r.phone || ""),
          notes: r.notes ? String(r.notes) : undefined,
          lines,
          subtotal: Number(r.subtotal || 0),
          discountType: (r.discount_type as FullOrderRecord["discountType"]) || "amount",
          discountValue: Number(r.discount_value || 0),
          discountAmount: Number(r.discount_amount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0),
        };
      });
    } catch (err) {
      console.warn("[MySQL] getWaiterActiveOrdersServer error:", err);
      return [];
    }
  });

/** Fetch real system audit logs from MySQL audit_logs table */
export const getAuditLogsServer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await query<Record<string, unknown>[]>(
      `SELECT id, action, user_id, restaurant_id, ip_address, details_json, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 200`,
    );

    return (rows || []).map((r) => {
      const actionStr = String(r.action || "system:event");
      let level: "info" | "warn" | "error" = "info";
      if (
        actionStr.includes("delete") ||
        actionStr.includes("error") ||
        actionStr.includes("revoke")
      ) {
        level = "error";
      } else if (
        actionStr.includes("update") ||
        actionStr.includes("warn") ||
        actionStr.includes("assign")
      ) {
        level = "warn";
      }

      let detailsStr = "";
      if (r.details_json) {
        try {
          const parsed =
            typeof r.details_json === "string" ? JSON.parse(r.details_json) : r.details_json;
          detailsStr = Object.entries(parsed as Record<string, unknown>)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ");
        } catch {
          detailsStr = String(r.details_json);
        }
      }

      const formattedTime = r.created_at
        ? new Date(r.created_at as string).toISOString().replace("T", " ").substring(0, 19)
        : new Date().toISOString().replace("T", " ").substring(0, 19);

      const parts = actionStr.split(":");
      const service = parts[0] || "system";
      const actionName = parts[1] || actionStr;

      const msg =
        `[${actionStr}] ${actionName.toUpperCase()} user=${String(r.user_id || "guest")} ip=${String(r.ip_address || "127.0.0.1")} ${detailsStr}`.trim();

      return {
        id: String(r.id),
        t: formattedTime,
        level,
        service,
        msg,
      };
    });
  } catch (err) {
    console.warn("[MySQL] getAuditLogsServer error:", err);
    return [];
  }
});

// =========================================================
// SUBSCRIPTION PACKAGES CRUD MYSQL SERVER FUNCTIONS
// =========================================================

export interface SubscriptionPackageRecord {
  id: string;
  name: string;
  price: string;
  billing: string;
  badge: string;
  badgeColor?: string;
  features: string[];
  maxBranches?: string;
  maxCategories?: string;
  maxItems?: string;
  maxOrders?: string;
  maxQrs?: string;
}

const DEFAULT_PACKAGES: SubscriptionPackageRecord[] = [
  {
    id: "pkg-free",
    name: "Free Trial",
    price: "$0",
    billing: "Forever free",
    badge: "Starter",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    features: ["1 Branch", "5 Categories", "25 Menu Items", "5 QR Codes", "Digital Ordering"],
    maxBranches: "1",
    maxCategories: "5",
    maxItems: "25",
    maxOrders: "100",
    maxQrs: "5",
  },
  {
    id: "pkg-starter",
    name: "Starter Package",
    price: "$29",
    billing: "per month",
    badge: "Popular",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    features: [
      "Up to 3 Branches",
      "15 Categories",
      "150 Menu Items",
      "25 QR Codes",
      "POS Billing System",
    ],
    maxBranches: "3",
    maxCategories: "15",
    maxItems: "150",
    maxOrders: "1000",
    maxQrs: "25",
  },
  {
    id: "pkg-business",
    name: "Business Growth",
    price: "$89",
    billing: "per month",
    badge: "Pro",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    features: [
      "Up to 10 Branches",
      "Unlimited Categories",
      "Unlimited Food Items",
      "Up to 100 QR Codes",
      "Full Analytics & Reports",
    ],
    maxBranches: "10",
    maxCategories: "unlimited",
    maxItems: "unlimited",
    maxOrders: "10000",
    maxQrs: "100",
  },
  {
    id: "pkg-enterprise",
    name: "Enterprise Suite",
    price: "Custom",
    billing: "Custom Quote (Contact Admin)",
    badge: "VIP",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    features: [
      "Custom Branches & Items",
      "Unlimited Categories & QR Codes",
      "Custom Domain & SSO",
      "24/7 Priority Support",
    ],
    maxBranches: "unlimited",
    maxCategories: "unlimited",
    maxItems: "unlimited",
    maxOrders: "unlimited",
    maxQrs: "unlimited",
  },
];

export const getSubscriptionPackagesServer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await query(`
        CREATE TABLE IF NOT EXISTS subscription_packages (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price VARCHAR(50) NOT NULL,
          billing VARCHAR(100) DEFAULT 'per month',
          badge VARCHAR(100) DEFAULT 'Starter',
          badge_color VARCHAR(255) DEFAULT '',
          features TEXT,
          max_branches VARCHAR(50) DEFAULT '1',
          max_categories VARCHAR(50) DEFAULT '5',
          max_items VARCHAR(50) DEFAULT '25',
          max_orders VARCHAR(50) DEFAULT '100',
          max_qrs VARCHAR(50) DEFAULT '5',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

    try {
      await query(
        "ALTER TABLE subscription_packages ADD COLUMN max_branches VARCHAR(50) DEFAULT '1';",
      );
    } catch {
      // column exists
    }
    try {
      await query(
        "ALTER TABLE subscription_packages ADD COLUMN max_categories VARCHAR(50) DEFAULT '5';",
      );
    } catch {
      // column exists
    }
    try {
      await query(
        "ALTER TABLE subscription_packages ADD COLUMN max_items VARCHAR(50) DEFAULT '25';",
      );
    } catch {
      // column exists
    }
    try {
      await query(
        "ALTER TABLE subscription_packages ADD COLUMN max_orders VARCHAR(50) DEFAULT '100';",
      );
    } catch {
      // column exists
    }
    try {
      await query("ALTER TABLE subscription_packages ADD COLUMN max_qrs VARCHAR(50) DEFAULT '5';");
    } catch {
      // column exists
    }

    // Delete old legacy packages from MySQL DB that are not in official package list
    try {
      await query(
        `DELETE FROM subscription_packages WHERE id NOT IN ('pkg-free', 'pkg-starter', 'pkg-business', 'pkg-enterprise')`,
      );
    } catch {
      // ignore
    }

    // Seed / Upsert the 4 new official packages into MySQL DB
    for (const pkg of DEFAULT_PACKAGES) {
      try {
        await query(
          `INSERT INTO subscription_packages (id, name, price, billing, badge, badge_color, features, max_branches, max_categories, max_items, max_orders, max_qrs)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             price = VALUES(price),
             billing = VALUES(billing),
             badge = VALUES(badge),
             badge_color = VALUES(badge_color),
             features = VALUES(features),
             max_branches = VALUES(max_branches),
             max_categories = VALUES(max_categories),
             max_items = VALUES(max_items),
             max_orders = VALUES(max_orders),
             max_qrs = VALUES(max_qrs)`,
          [
            pkg.id,
            pkg.name,
            pkg.price,
            pkg.billing,
            pkg.badge,
            pkg.badgeColor || "",
            JSON.stringify(pkg.features),
            pkg.maxBranches || "1",
            pkg.maxCategories || "5",
            pkg.maxItems || "25",
            pkg.maxOrders || "100",
            pkg.maxQrs || "5",
          ],
        );
      } catch {
        // ignore duplicate
      }
    }

    const rows = await query<Record<string, unknown>[]>("SELECT * FROM subscription_packages");

    if (rows && rows.length > 0) {
      const ORDER = ["pkg-free", "pkg-starter", "pkg-business", "pkg-enterprise"];
      const sortedRows = [...rows].sort((a, b) => {
        const idA = String(a.id || "").toLowerCase();
        const idB = String(b.id || "").toLowerCase();
        const ia = ORDER.findIndex((o) => idA.includes(o) || o.includes(idA));
        const ib = ORDER.findIndex((o) => idB.includes(o) || o.includes(idB));
        return (ia !== -1 ? ia : 99) - (ib !== -1 ? ib : 99);
      });

      return sortedRows.map((r) => ({
        id: String(r.id),
        name: String(r.name || ""),
        price: String(r.price || "$0"),
        billing: String(r.billing || "per month"),
        badge: String(r.badge || "Starter"),
        badgeColor: String(r.badge_color || ""),
        maxBranches: String(r.max_branches ?? "1"),
        maxCategories: String(r.max_categories ?? "5"),
        maxItems: String(r.max_items ?? "25"),
        maxOrders: String(r.max_orders ?? "100"),
        maxQrs: String(r.max_qrs ?? "5"),
        features: r.features
          ? typeof r.features === "string"
            ? (JSON.parse(r.features) as string[])
            : (r.features as string[])
          : [],
      }));
    }
  } catch (err) {
    console.warn("[MySQL] getSubscriptionPackagesServer query error:", err);
  }

  return DEFAULT_PACKAGES;
});

export const saveSubscriptionPackageServer = createServerFn({ method: "POST" })
  .validator((pkg: SubscriptionPackageRecord) => pkg)
  .handler(async ({ data: pkg }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    const id = pkg.id || `pkg-${Date.now()}`;
    const featuresJson = JSON.stringify(pkg.features || []);

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS subscription_packages (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price VARCHAR(50) NOT NULL,
          billing VARCHAR(100) DEFAULT 'per month',
          badge VARCHAR(100) DEFAULT 'Starter',
          badge_color VARCHAR(255) DEFAULT '',
          features TEXT,
          max_branches VARCHAR(50) DEFAULT '1',
          max_categories VARCHAR(50) DEFAULT '5',
          max_items VARCHAR(50) DEFAULT '25',
          max_orders VARCHAR(50) DEFAULT '100',
          max_qrs VARCHAR(50) DEFAULT '5',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const existing = await query<Record<string, unknown>[]>(
        "SELECT id FROM subscription_packages WHERE id = ? LIMIT 1",
        [id],
      );

      if (existing && existing.length > 0) {
        await query(
          `UPDATE subscription_packages SET name = ?, price = ?, billing = ?, badge = ?, badge_color = ?, features = ?, max_branches = ?, max_categories = ?, max_items = ?, max_orders = ?, max_qrs = ? WHERE id = ?`,
          [
            pkg.name,
            pkg.price,
            pkg.billing,
            pkg.badge,
            pkg.badgeColor || "",
            featuresJson,
            pkg.maxBranches || "1",
            pkg.maxCategories || "5",
            pkg.maxItems || "25",
            pkg.maxOrders || "100",
            pkg.maxQrs || "5",
            id,
          ],
        );
      } else {
        await query(
          `INSERT INTO subscription_packages (id, name, price, billing, badge, badge_color, features, max_branches, max_categories, max_items, max_orders, max_qrs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            pkg.name,
            pkg.price,
            pkg.billing,
            pkg.badge,
            pkg.badgeColor || "",
            featuresJson,
            pkg.maxBranches || "1",
            pkg.maxCategories || "5",
            pkg.maxItems || "25",
            pkg.maxOrders || "100",
            pkg.maxQrs || "5",
          ],
        );
      }
      return { success: true, id };
    } catch (err) {
      console.error("[MySQL] saveSubscriptionPackageServer error:", err);
      throw new Error("Failed to save subscription package in database");
    }
  });

export const deleteSubscriptionPackageServer = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireAuth();
    await requirePermission("platform:manage_restaurants");

    try {
      await query("DELETE FROM subscription_packages WHERE id = ?", [id]);
      return { success: true };
    } catch (err) {
      console.error("[MySQL] deleteSubscriptionPackageServer error:", err);
      throw new Error("Failed to delete package from database");
    }
  });

async function getPublicTenantOrderLimits(restaurantId: number): Promise<{
  plan: string;
  limits: ReturnType<typeof resolvePlanLimits>;
  usage: { orders: number };
}> {
  let currentPlan = "Business";

  try {
    const rows = await query<Record<string, unknown>[]>(
      "SELECT plan, status, plan_expires_at FROM restaurants WHERE id = ? LIMIT 1",
      [restaurantId],
    );
    if (rows && rows.length > 0) {
      currentPlan = String(rows[0].plan || "Business");
      const currentStatus = String(rows[0].status || "active");
      const expiresAt = rows[0].plan_expires_at
        ? new Date(rows[0].plan_expires_at as string)
        : null;
      const isPastDue = expiresAt ? expiresAt.getTime() < Date.now() : false;
      if ((isPastDue || currentStatus === "expired") && currentPlan !== "Free") {
        currentPlan = "Free";
      }
    }
  } catch {
    /* ignore */
  }

  let orderCount = 0;
  try {
    const oRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM pos_orders WHERE restaurant_id = ?",
      [restaurantId],
    );
    orderCount = Number(oRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  let pkgs: SubscriptionPackageRecord[] = [];
  try {
    pkgs = await getSubscriptionPackagesServer();
  } catch {
    /* ignore */
  }

  return {
    plan: currentPlan,
    limits: resolvePlanLimits(currentPlan, pkgs),
    usage: { orders: orderCount },
  };
}

export const getTenantSubscriptionServer = createServerFn({ method: "GET" }).handler(async () => {
  const tenant = await resolvePrivateTenantContext();
  let currentPlan = "Business";
  let currentStatus = "active";
  let isExpiredDowngraded = false;
  let expiresAtStr: string | null = null;
  let joinedStr = "2026-08-08";

  try {
    try {
      await query("ALTER TABLE restaurants ADD COLUMN plan_expires_at DATETIME NULL;");
    } catch {
      /* ignore if already exists */
    }
    try {
      await query("ALTER TABLE restaurants ADD COLUMN mrr INT DEFAULT 0;");
    } catch {
      /* ignore if already exists */
    }
    try {
      await query("ALTER TABLE restaurants ADD COLUMN status VARCHAR(50) DEFAULT 'active';");
    } catch {
      /* ignore if already exists */
    }

    const rows = await query<Record<string, unknown>[]>(
      "SELECT id, name, slug, plan, status, created_at, plan_expires_at FROM restaurants WHERE id = ? LIMIT 1",
      [tenant.restaurantId],
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      currentPlan = String(r.plan || "Business");
      currentStatus = String(r.status || "active");

      const expiresAt = r.plan_expires_at ? new Date(r.plan_expires_at as string) : null;
      const isPastDue = expiresAt ? expiresAt.getTime() < Date.now() : false;

      // Auto-move to Free plan if subscription expired or status is expired
      if ((isPastDue || currentStatus === "expired") && currentPlan !== "Free") {
        await query(
          "UPDATE restaurants SET plan = 'Free', status = 'expired', mrr = 0 WHERE id = ?",
          [tenant.restaurantId],
        );
        currentPlan = "Free";
        currentStatus = "expired";
        isExpiredDowngraded = true;
      }
      expiresAtStr = expiresAt ? expiresAt.toISOString().split("T")[0] : null;
      joinedStr = r.created_at
        ? new Date(r.created_at as string).toISOString().split("T")[0]
        : "2026-08-08";
    }
  } catch (err) {
    console.warn("[MySQL] getTenantSubscriptionServer query error:", err);
  }

  // Calculate usage counts
  let branchCount = 0;
  let categoryCount = 0;
  let itemCount = 0;
  let orderCount = 0;
  let qrCount = 0;

  try {
    const bRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM branches WHERE restaurant_id = ?",
      [tenant.restaurantId],
    );
    branchCount = Number(bRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  try {
    const cRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM categories WHERE restaurant_id = ?",
      [tenant.restaurantId],
    );
    categoryCount = Number(cRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  try {
    const iRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM food_items WHERE restaurant_id = ?",
      [tenant.restaurantId],
    );
    itemCount = Number(iRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  try {
    const oRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM pos_orders WHERE restaurant_id = ?",
      [tenant.restaurantId],
    );
    orderCount = Number(oRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  try {
    const qRows = await query<Record<string, unknown>[]>(
      "SELECT COUNT(*) as cnt FROM branch_tables WHERE restaurant_id = ?",
      [tenant.restaurantId],
    );
    qrCount = Number(qRows?.[0]?.cnt || 0);
  } catch {
    /* ignore */
  }

  // Resolve limits
  let pkgs: SubscriptionPackageRecord[] = [];
  try {
    pkgs = await getSubscriptionPackagesServer();
  } catch {
    /* ignore */
  }
  const limits = resolvePlanLimits(currentPlan, pkgs);

  return {
    id: String(tenant.restaurantId),
    name: tenant.slug,
    slug: tenant.slug,
    plan: currentPlan,
    status: currentStatus,
    isExpiredDowngraded,
    expiresAt: expiresAtStr,
    joined: joinedStr,
    limits,
    usage: {
      branches: branchCount,
      categories: categoryCount,
      items: itemCount,
      orders: orderCount,
      qrs: qrCount,
    },
  };
});

export const updateTenantSubscriptionServer = createServerFn({ method: "POST" })
  .validator((data: { plan: string; mrr?: number; days?: number }) => data)
  .handler(async ({ data }) => {
    const tenant = await resolvePrivateTenantContext();
    const mrrValue =
      data.mrr !== undefined
        ? data.mrr
        : data.plan === "Business"
          ? 89
          : data.plan === "Enterprise"
            ? 299
            : data.plan === "Starter"
              ? 29
              : 0;

    const days = data.days || 30;
    const expiresAtDate =
      data.plan === "Free"
        ? null
        : new Date(Date.now() + days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

    const newStatus = "active";

    try {
      try {
        await query("ALTER TABLE restaurants ADD COLUMN plan_expires_at DATETIME NULL;");
      } catch {
        /* ignore if exists */
      }
      try {
        await query("ALTER TABLE restaurants ADD COLUMN mrr INT DEFAULT 0;");
      } catch {
        /* ignore if exists */
      }
      try {
        await query("ALTER TABLE restaurants ADD COLUMN status VARCHAR(50) DEFAULT 'active';");
      } catch {
        /* ignore if exists */
      }

      await query(
        "UPDATE restaurants SET plan = ?, mrr = ?, status = ?, plan_expires_at = ? WHERE id = ?",
        [data.plan, mrrValue, newStatus, expiresAtDate, tenant.restaurantId],
      );
      return { success: true, plan: data.plan, mrr: mrrValue, expiresAt: expiresAtDate };
    } catch (err) {
      console.error("[MySQL] updateTenantSubscriptionServer error:", err);
      throw new Error("Failed to update subscription in database");
    }
  });

// =========================================================
// SYSTEM ANNOUNCEMENTS & WEB PUSH BROADCASTS
// =========================================================

export type AnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "owners" | "staff" | string;
  sound: string;
  url: string;
  live: boolean;
  sentCount: number;
  date: string;
  createdAt: string;
};

export const getAnnouncementsServer = createServerFn({ method: "GET" })
  .validator((input?: { data?: Record<string, unknown> }) => input)
  .handler(async () => {
    try {
      try {
        const pool = await getPool();
        await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          audience VARCHAR(50) DEFAULT 'all',
          sound VARCHAR(50) DEFAULT 'chime',
          url VARCHAR(255) DEFAULT '/dashboard',
          live TINYINT(1) DEFAULT 1,
          sent_count INT DEFAULT 0,
          created_by VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_announcements_audience (audience),
          INDEX idx_announcements_live (live)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      } catch {
        /* ignore */
      }

      const rows = await query<Record<string, unknown>[]>(
        "SELECT * FROM announcements ORDER BY created_at DESC",
      );

      if (!rows || rows.length === 0) return [];

      return rows.map((r) => ({
        id: String(r.id),
        title: String(r.title || ""),
        body: String(r.body || ""),
        audience: String(r.audience || "all"),
        sound: String(r.sound || "chime"),
        url: String(r.url || "/dashboard"),
        live: Boolean(r.live),
        sentCount: Number(r.sent_count || 0),
        date: String(r.created_at ? new Date(String(r.created_at)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
        createdAt: String(r.created_at || new Date().toISOString()),
      })) as AnnouncementRecord[];
    } catch (err) {
      console.warn("[MySQL] getAnnouncementsServer query warning:", err);
      return [];
    }
  });

export const publishAnnouncementServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      title: string;
      body: string;
      audience: "all" | "owners" | "staff" | string;
      sound?: string;
      url?: string;
      sendPush?: boolean;
    }) =>
      z
        .object({
          title: z.string().min(1),
          body: z.string().min(1),
          audience: z.string().default("all"),
          sound: z.string().default("chime"),
          url: z.string().default("/dashboard"),
          sendPush: z.boolean().default(true),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const authUser = await requireAuth();

    try {
      let sentCount = 0;

      if (data.sendPush) {
        const m = await import("./web-push.server");
        const pushResult = await m.sendSystemAnnouncementPushServer({
          title: data.title,
          body: data.body,
          audience: data.audience,
          sound: data.sound || "chime",
          url: data.url || "/dashboard",
        });
        sentCount = pushResult.sent;
      }

      await query(
        `INSERT INTO announcements (id, title, body, audience, sound, url, live, sent_count, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          id,
          data.title.trim(),
          data.body.trim(),
          data.audience,
          data.sound || "chime",
          data.url || "/dashboard",
          sentCount,
          authUser.email || authUser.id,
        ],
      );

      try {
        const { broadcastRealtimeEvent } = await import("./realtime.server");
        broadcastRealtimeEvent({
          type: "announcement:created",
          restaurantId: "all",
          payload: {
            id,
            title: data.title.trim(),
            body: data.body.trim(),
            sound: data.sound || "chime",
            url: data.url || "/dashboard",
            audience: data.audience,
          },
        });
      } catch {
        /* ignore */
      }

      return { success: true, id, sentCount };
    } catch (err) {
      console.error("[MySQL] publishAnnouncementServer error:", err);
      throw new Error(err instanceof Error ? err.message : "Failed to publish announcement");
    }
  });

export const deleteAnnouncementServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    await query("DELETE FROM announcements WHERE id = ?", [data.id]);
    return { success: true };
  });

export const toggleAnnouncementLiveServer = createServerFn({ method: "POST" })
  .validator((data: { id: string; live: boolean }) =>
    z.object({ id: z.string(), live: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    await query("UPDATE announcements SET live = ? WHERE id = ?", [data.live ? 1 : 0, data.id]);
    return { success: true };
  });

export const resendAnnouncementPushServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM announcements WHERE id = ? LIMIT 1",
      [data.id],
    );

    if (!rows || rows.length === 0) {
      throw new Error("Announcement not found");
    }

    const ann = rows[0];
    const m = await import("./web-push.server");
    const pushResult = await m.sendSystemAnnouncementPushServer({
      title: String(ann.title || "Announcement"),
      body: String(ann.body || ""),
      audience: String(ann.audience || "all"),
      sound: String(ann.sound || "chime"),
      url: String(ann.url || "/dashboard"),
    });

    await query(
      "UPDATE announcements SET sent_count = sent_count + ? WHERE id = ?",
      [pushResult.sent, data.id],
    );

    try {
      const { broadcastRealtimeEvent } = await import("./realtime.server");
      broadcastRealtimeEvent({
        type: "announcement:created",
        restaurantId: "all",
        payload: {
          id: data.id,
          title: String(ann.title || "Announcement"),
          body: String(ann.body || ""),
          sound: String(ann.sound || "chime"),
          url: String(ann.url || "/dashboard"),
          audience: String(ann.audience || "all"),
        },
      });
    } catch {
      /* ignore */
    }

    return { success: true, sentCount: pushResult.sent };
  });

// =========================================================
// FCM & WEB PUSH ADMIN MANAGEMENT SERVER FUNCTIONS
// =========================================================

export type FcmSubscriberRecord = {
  id: string;
  restaurantId: number;
  restaurantName?: string;
  restaurantSlug?: string;
  branchId?: string | null;
  userId?: string | null;
  role?: string | null;
  endpoint: string;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const getFcmStatsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireRole(["super_admin", "owner"]);

    const [countRows, restRows] = await Promise.all([
      query<
        Array<{
          total: number;
          customers: number;
          staff: number;
          owners: number;
          unique_restaurants: number;
        }>
      >(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN LOWER(role) = 'customer' THEN 1 ELSE 0 END) as customers,
          SUM(CASE WHEN LOWER(role) IN ('manager', 'cashier', 'chef', 'waiter', 'host') THEN 1 ELSE 0 END) as staff,
          SUM(CASE WHEN LOWER(role) = 'owner' THEN 1 ELSE 0 END) as owners,
          COUNT(DISTINCT restaurant_id) as unique_restaurants
        FROM push_subscriptions`,
      ),
      query<
        Array<{
          restaurant_id: number;
          name: string;
          slug: string;
          subscribers: number;
        }>
      >(
        `SELECT 
          ps.restaurant_id,
          COALESCE(r.name, CONCAT('Restaurant #', ps.restaurant_id)) as name,
          COALESCE(r.slug, 'unknown') as slug,
          COUNT(*) as subscribers
        FROM push_subscriptions ps
        LEFT JOIN restaurants r ON ps.restaurant_id = r.id
        GROUP BY ps.restaurant_id, r.name, r.slug
        ORDER BY subscribers DESC`,
      ),
    ]);

    const stats = countRows?.[0] || {
      total: 0,
      customers: 0,
      staff: 0,
      owners: 0,
      unique_restaurants: 0,
    };

    return {
      totalDevices: Number(stats.total) || 0,
      customerDevices: Number(stats.customers) || 0,
      staffDevices: Number(stats.staff) || 0,
      ownerDevices: Number(stats.owners) || 0,
      uniqueRestaurants: Number(stats.unique_restaurants) || 0,
      restaurants: restRows || [],
      vapidPublicKey:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        "BFCWjOYUAdv3FqiTopV07F48-nmqk7g-NJkkd-1ZU4XVwhXSXirasbeJpi8qEMIj50WKQ6h8lay1wOGKWxuGhjM",
      gatewayStatus: "Online (Google FCM / WebPush RFC 8292)",
    };
  });

export const getFcmSubscribersServer = createServerFn({ method: "GET" })
  .validator((input?: { search?: string; role?: string; restaurantId?: string }) =>
    z
      .object({
        search: z.string().optional(),
        role: z.string().optional(),
        restaurantId: z.string().optional(),
      })
      .optional()
      .parse(input),
  )
  .handler(async ({ data: filter }) => {
    await requireRole(["super_admin", "owner"]);

    let sql = `
      SELECT 
        ps.id,
        ps.restaurant_id,
        ps.branch_id,
        ps.user_id,
        ps.role,
        ps.endpoint,
        ps.user_agent,
        ps.created_at,
        ps.updated_at,
        COALESCE(r.name, CONCAT('Restaurant #', ps.restaurant_id)) as restaurant_name,
        COALESCE(r.slug, 'unknown') as restaurant_slug
      FROM push_subscriptions ps
      LEFT JOIN restaurants r ON ps.restaurant_id = r.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filter?.restaurantId && filter.restaurantId !== "all") {
      sql += " AND ps.restaurant_id = ?";
      params.push(Number(filter.restaurantId));
    }

    if (filter?.role && filter.role !== "all") {
      sql += " AND LOWER(ps.role) = ?";
      params.push(filter.role.toLowerCase());
    }

    if (filter?.search && filter.search.trim()) {
      sql += " AND (ps.id LIKE ? OR ps.user_agent LIKE ? OR r.name LIKE ?)";
      const q = `%${filter.search.trim()}%`;
      params.push(q, q, q);
    }

    sql += " ORDER BY ps.created_at DESC LIMIT 200";

    const rows = await query<
      Array<{
        id: string;
        restaurant_id: number;
        branch_id: string | null;
        user_id: string | null;
        role: string | null;
        endpoint: string;
        user_agent: string | null;
        created_at: string;
        updated_at: string;
        restaurant_name: string;
        restaurant_slug: string;
      }>
    >(sql, params);

    return rows.map((r) => ({
      id: r.id,
      restaurantId: r.restaurant_id,
      restaurantName: r.restaurant_name,
      restaurantSlug: r.restaurant_slug,
      branchId: r.branch_id,
      userId: r.user_id,
      role: r.role || "customer",
      endpoint: r.endpoint,
      userAgent: r.user_agent,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  });

export const deleteFcmSubscriberServer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    await query("DELETE FROM push_subscriptions WHERE id = ?", [data.id]);
    return { success: true };
  });

export const sendFcmCustomBroadcastServer = createServerFn({ method: "POST" })
  .validator((data: {
    title: string;
    body: string;
    audience?: string;
    restaurantId?: string;
    sound?: string;
    url?: string;
  }) =>
    z
      .object({
        title: z.string().min(1, "Title is required"),
        body: z.string().min(1, "Message body is required"),
        audience: z.string().default("all"),
        restaurantId: z.string().default("all"),
        sound: z.string().default("chime"),
        url: z.string().default("/dashboard"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    const m = await import("./web-push.server");
    const res = await m.sendSystemAnnouncementPushServer({
      title: data.title,
      body: data.body,
      audience: data.audience,
      restaurantId: data.restaurantId,
      sound: data.sound,
      url: data.url,
    });
    return { success: true, sent: res.sent, failed: res.failed };
  });

export const testSingleFcmSubscriberServer = createServerFn({ method: "POST" })
  .validator((data: { id: string; sound?: string }) =>
    z
      .object({
        id: z.string(),
        sound: z.string().default("chime"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireRole(["super_admin", "owner"]);
    const rows = await query<
      Array<{
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
        role: string;
      }>
    >("SELECT * FROM push_subscriptions WHERE id = ? LIMIT 1", [data.id]);

    if (!rows || rows.length === 0) {
      throw new Error("Subscriber endpoint not found");
    }

    const sub = rows[0];
    const webpush = (await import("web-push")).default;

    const payload = JSON.stringify({
      title: "🔔 Test FCM Push Alert",
      body: "Your device is successfully receiving instant Web Push alerts from MenuVerse!",
      icon: "/placeholder.svg",
      badge: "/placeholder.svg",
      sound: data.sound || "chime",
      url: "/dashboard",
      vibrate: [200, 100, 200, 100, 300],
      tag: `test-fcm-${Date.now()}`,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
        { urgency: "high", TTL: 3600 },
      );
      return { success: true };
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await query("DELETE FROM push_subscriptions WHERE id = ?", [data.id]);
        throw new Error("Subscription has expired on client browser (removed from DB).");
      }
      throw new Error((err as Error).message || "Failed to deliver test push.");
    }
  });

