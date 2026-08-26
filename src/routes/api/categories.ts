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

export const Route = createFileRoute("/api/categories")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");
          const search = url.searchParams.get("search") || "";

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

          let sql = `SELECT c.id, c.name, c.icon, c.sort_order, c.is_active, c.branch_ids,
                            COUNT(f.id) as items_count 
                     FROM categories c 
                     LEFT JOIN food_items f ON f.category_id = c.id AND f.restaurant_id = c.restaurant_id 
                     WHERE c.restaurant_id = ?`;
          const params: (string | number | null)[] = [restaurantId];

          if (search.trim()) {
            sql += " AND c.name LIKE ?";
            params.push(`%${search.trim()}%`);
          }
          sql += " GROUP BY c.id ORDER BY c.sort_order ASC, c.created_at ASC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          return new Response(
            JSON.stringify({
              success: true,
              data: (rows || []).map((r, idx) => ({
                id: String(r.id),
                name: String(r.name || ""),
                icon: String(r.icon || "Utensils"),
                itemsCount: Number(r.items_count || 0),
                sortOrder: r.sort_order != null ? Number(r.sort_order) : idx + 1,
                isActive: r.is_active != null ? Boolean(r.is_active) : true,
                branchIds: r.branch_ids
                  ? typeof r.branch_ids === "string"
                    ? JSON.parse(r.branch_ids)
                    : r.branch_ids
                  : [],
              })),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch categories";
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

          if (!hasPermission(user.role, "categories:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks categories:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            id?: string;
            name: string;
            icon?: string;
            sortOrder?: number;
            isActive?: boolean;
            branchIds?: string[];
          };

          if (!body.name || !body.name.trim()) {
            return new Response(
              JSON.stringify({ success: false, error: "Category name is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const pool = getPool();

          // Ensure columns
          try {
            await pool.query(
              "ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            );
            await pool.query(
              "ALTER TABLE categories ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
            );
            await pool.query("ALTER TABLE categories ADD COLUMN branch_ids JSON NULL");
          } catch {
            /* ignore */
          }

          const isNew = !body.id;
          const catId = body.id || `cat-${crypto.randomUUID().slice(0, 8)}`;

          if (isNew) {
            try {
              const countRows = await query<Record<string, unknown>[]>(
                "SELECT COUNT(*) as cnt FROM categories WHERE restaurant_id = ?",
                [tenant.restaurantId],
              );
              const catCount = Number(countRows?.[0]?.cnt || 0);
              const sub = await getTenantSubscriptionServer();
              if (
                sub.limits.maxCategories !== "unlimited" &&
                catCount >= sub.limits.maxCategories
              ) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxCategories} category(ies). Please upgrade your subscription package.`,
                  }),
                  { status: 400, headers: { "Content-Type": "application/json" } },
                );
              }
            } catch {
              /* ignore */
            }
          }

          const branchIdsJson = JSON.stringify(body.branchIds || []);
          await query(
            `INSERT INTO categories (id, restaurant_id, name, icon, sort_order, is_active, branch_ids)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name),
               icon = VALUES(icon),
               sort_order = VALUES(sort_order),
               is_active = VALUES(is_active),
               branch_ids = VALUES(branch_ids)`,
            [
              catId,
              tenant.restaurantId,
              body.name.trim(),
              body.icon || "Utensils",
              body.sortOrder ?? 1,
              body.isActive !== false ? 1 : 0,
              branchIdsJson,
            ],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Category saved successfully",
              data: {
                id: catId,
                name: body.name.trim(),
                icon: body.icon || "Utensils",
                sortOrder: body.sortOrder ?? 1,
                isActive: body.isActive !== false,
                branchIds: body.branchIds || [],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save category";
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

          if (!hasPermission(user.role, "categories:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks categories:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required category id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM categories WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Category deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete category";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
