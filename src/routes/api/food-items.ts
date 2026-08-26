import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  resolvePublicRestaurant,
  getTenantSubscriptionServer,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export const Route = createFileRoute("/api/food-items")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");
          const search = url.searchParams.get("search") || "";
          const categoryId = url.searchParams.get("categoryId") || "all";
          const status = url.searchParams.get("status") || "all";
          const branchId = url.searchParams.get("branchId") || "all";

          let restaurantId: number;
          if (customSlugOrEmail) {
            const pub = await resolvePublicRestaurant(customSlugOrEmail);
            restaurantId = pub.restaurantId;
          } else {
            const user = await verifySession();
            if (!user) {
              return new Response(
                JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
                { status: 401, headers: { "Content-Type": "application/json" } },
              );
            }
            const tenant = await resolvePrivateTenantContext();
            restaurantId = tenant.restaurantId;
          }

          let sql = "SELECT * FROM food_items WHERE restaurant_id = ?";
          const params: unknown[] = [restaurantId];

          if (categoryId !== "all") {
            sql += " AND category_id = ?";
            params.push(categoryId);
          }
          if (status !== "all") {
            sql += " AND status = ?";
            params.push(status);
          }
          if (search.trim()) {
            sql += " AND (name LIKE ? OR description LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s);
          }
          sql += " ORDER BY sort_order ASC, created_at DESC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const items = (rows || []).map((r) => {
            let variations = [];
            let addOns = [];
            let branchIds = [];
            try {
              if (r.variations) {
                variations =
                  typeof r.variations === "string" ? JSON.parse(r.variations) : r.variations;
              }
              if (r.addons || r.add_ons) {
                const raw = r.addons || r.add_ons;
                addOns = typeof raw === "string" ? JSON.parse(raw) : raw;
              }
              if (r.branch_ids) {
                branchIds =
                  typeof r.branch_ids === "string" ? JSON.parse(r.branch_ids) : r.branch_ids;
              }
            } catch {
              /* ignore parse errors */
            }

            return {
              id: String(r.id),
              name: String(r.name || ""),
              categoryId: String(r.category_id || ""),
              price: Number(r.price || 0),
              originalPrice: r.original_price ? Number(r.original_price) : undefined,
              image: String(r.image || ""),
              description: String(r.description || ""),
              badge: r.badge ? String(r.badge) : undefined,
              isVeg: Boolean(r.is_veg),
              isVegan: Boolean(r.is_vegan),
              isGlutenFree: Boolean(r.is_gluten_free),
              isHalal: Boolean(r.is_halal),
              spicyLevel: Number(r.spicy_level || 0),
              calories: r.calories ? Number(r.calories) : undefined,
              prepTime: r.prep_time ? Number(r.prep_time) : undefined,
              status: (r.status as string) || "available",
              variations,
              addOns,
              branchIds,
            };
          });

          // Filter by branchId if applicable
          const filtered =
            branchId !== "all"
              ? items.filter(
                  (item) =>
                    !item.branchIds ||
                    item.branchIds.length === 0 ||
                    item.branchIds.includes(branchId),
                )
              : items;

          return new Response(JSON.stringify({ success: true, data: filtered }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch food items";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!hasPermission(user.role, "food_items:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks food_items:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            id?: string;
            name: string;
            categoryId: string;
            price: number;
            originalPrice?: number;
            image?: string;
            description?: string;
            badge?: string;
            isVeg?: boolean;
            isVegan?: boolean;
            isGlutenFree?: boolean;
            isHalal?: boolean;
            spicyLevel?: number;
            calories?: number;
            prepTime?: number;
            status?: string;
            variations?: unknown[];
            addOns?: unknown[];
            branchIds?: string[];
          };

          if (!body.name || !body.name.trim() || body.price == null) {
            return new Response(
              JSON.stringify({ success: false, error: "Name and price are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const pool = getPool();

          // Ensure columns
          try {
            await pool.query(
              "ALTER TABLE food_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            );
            await pool.query(
              "ALTER TABLE food_items ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
            );
            await pool.query(
              "ALTER TABLE food_items ADD COLUMN addons JSON NULL",
            );
            await pool.query(
              "ALTER TABLE food_items ADD COLUMN branch_ids JSON NULL",
            );
          } catch {
            /* ignore */
          }

          const isNew = !body.id;
          const itemId = body.id || `item-${crypto.randomUUID().slice(0, 8)}`;

          if (isNew) {
            try {
              const countRows = await query<Record<string, unknown>[]>(
                "SELECT COUNT(*) as cnt FROM food_items WHERE restaurant_id = ?",
                [tenant.restaurantId],
              );
              const itemCount = Number(countRows?.[0]?.cnt || 0);
              const sub = await getTenantSubscriptionServer();
              if (sub.limits.maxItems !== "unlimited" && itemCount >= sub.limits.maxItems) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxItems} item(s). Please upgrade your subscription package.`,
                  }),
                  { status: 400, headers: { "Content-Type": "application/json" } },
                );
              }
            } catch {
              /* ignore */
            }
          }

          await query(
            `INSERT INTO food_items (
               id, restaurant_id, category_id, name, price, original_price, image, description,
               badge, is_veg, is_vegan, is_gluten_free, is_halal, spicy_level, calories, prep_time,
               status, variations, addons, branch_ids
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               category_id = VALUES(category_id),
               name = VALUES(name),
               price = VALUES(price),
               original_price = VALUES(original_price),
               image = VALUES(image),
               description = VALUES(description),
               badge = VALUES(badge),
               is_veg = VALUES(is_veg),
               is_vegan = VALUES(is_vegan),
               is_gluten_free = VALUES(is_gluten_free),
               is_halal = VALUES(is_halal),
               spicy_level = VALUES(spicy_level),
               calories = VALUES(calories),
               prep_time = VALUES(prep_time),
               status = VALUES(status),
               variations = VALUES(variations),
               addons = VALUES(addons),
               branch_ids = VALUES(branch_ids)`,
            [
              itemId,
              tenant.restaurantId,
              body.categoryId,
              body.name.trim(),
              body.price,
              body.originalPrice ?? null,
              body.image || "",
              body.description || "",
              body.badge || null,
              body.isVeg ? 1 : 0,
              body.isVegan ? 1 : 0,
              body.isGlutenFree ? 1 : 0,
              body.isHalal ? 1 : 0,
              body.spicyLevel ?? 0,
              body.calories ?? null,
              body.prepTime ?? null,
              body.status || "available",
              JSON.stringify(body.variations || []),
              JSON.stringify(body.addOns || []),
              JSON.stringify(body.branchIds || []),
            ],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Food item saved successfully",
              data: {
                id: itemId,
                name: body.name.trim(),
                categoryId: body.categoryId,
                price: body.price,
                originalPrice: body.originalPrice,
                image: body.image || "",
                description: body.description || "",
                badge: body.badge,
                isVeg: Boolean(body.isVeg),
                isVegan: Boolean(body.isVegan),
                isGlutenFree: Boolean(body.isGlutenFree),
                isHalal: Boolean(body.isHalal),
                spicyLevel: body.spicyLevel ?? 0,
                calories: body.calories,
                prepTime: body.prepTime,
                status: body.status || "available",
                variations: body.variations || [],
                addOns: body.addOns || [],
                branchIds: body.branchIds || [],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save food item";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!hasPermission(user.role, "food_items:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks food_items:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required food item id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM food_items WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Food item deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete food item";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
