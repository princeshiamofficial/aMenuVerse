import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
  resolvePublicRestaurant,
  getTenantSubscriptionServer,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export const Route = createFileRoute("/api/branches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");
          const search = url.searchParams.get("search") || "";
          const status = url.searchParams.get("status") || "all";

          if (customSlugOrEmail) {
            const tenant = await resolvePublicRestaurant(customSlugOrEmail);
            let sql =
              "SELECT id, name, address, phone, manager, status, is_default as isDefault, menu_id as menuId FROM branches WHERE restaurant_id = ?";
            const params: unknown[] = [tenant.restaurantId];

            if (status !== "all") {
              sql += " AND status = ?";
              params.push(status);
            }
            if (search.trim()) {
              sql += " AND (name LIKE ? OR address LIKE ? OR manager LIKE ? OR phone LIKE ?)";
              const s = `%${search.trim()}%`;
              params.push(s, s, s, s);
            }
            sql += " ORDER BY is_default DESC, created_at ASC";

            const rows = await query<Record<string, unknown>[]>(sql, params);
            return new Response(
              JSON.stringify({
                success: true,
                data: (rows || []).map((b) => ({
                  id: String(b.id || ""),
                  name: String(b.name || ""),
                  address: String(b.address || ""),
                  phone: String(b.phone || ""),
                  manager: String(b.manager || ""),
                  status: (b.status as string) || "open",
                  isDefault: Boolean(b.isDefault),
                  menuId: String(b.menuId || "menu-downtown"),
                })),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const assignedInfo = await getUserAssignedBranches(tenant);

          if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
            return new Response(JSON.stringify({ success: true, data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          let sql =
            "SELECT id, name, address, phone, manager, status, is_default as isDefault, menu_id as menuId FROM branches WHERE restaurant_id = ?";
          const params: unknown[] = [tenant.restaurantId];

          if (!assignedInfo.isAll) {
            const branchIds = assignedInfo.branches.map((b) => b.id);
            if (branchIds.length > 0) {
              sql += ` AND id IN (${branchIds.map(() => "?").join(",")})`;
              params.push(...branchIds);
            }
          }

          if (status !== "all") {
            sql += " AND status = ?";
            params.push(status);
          }
          if (search.trim()) {
            sql += " AND (name LIKE ? OR address LIKE ? OR manager LIKE ? OR phone LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s, s, s);
          }
          sql += " ORDER BY is_default DESC, created_at ASC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          return new Response(
            JSON.stringify({
              success: true,
              data: (rows || []).map((b) => ({
                id: String(b.id || ""),
                name: String(b.name || ""),
                address: String(b.address || ""),
                phone: String(b.phone || ""),
                manager: String(b.manager || ""),
                status: (b.status as string) || "open",
                isDefault: Boolean(b.isDefault),
                menuId: String(b.menuId || "menu-downtown"),
              })),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to get branches";
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

          if (!hasPermission(user.role, "branches:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks branches:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            id?: string;
            name: string;
            address?: string;
            phone?: string;
            manager?: string;
            status?: string;
            isDefault?: boolean;
            menuId?: string;
          };

          if (!body.name || !body.name.trim()) {
            return new Response(
              JSON.stringify({ success: false, error: "Branch name is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const pool = getPool();

          // Ensure columns
          try {
            await pool.query(
              "ALTER TABLE branches CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            );
            await pool.query(
              "ALTER TABLE branches ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
            );
            await pool.query(
              "ALTER TABLE branches ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE",
            );
          } catch {
            /* ignore */
          }

          const isNew = !body.id;
          const branchId = body.id || `branch-${crypto.randomUUID().slice(0, 8)}`;

          // Check subscription limit for new branches
          if (isNew) {
            try {
              const countRows = await query<Record<string, unknown>[]>(
                "SELECT COUNT(*) as cnt FROM branches WHERE restaurant_id = ?",
                [tenant.restaurantId],
              );
              const branchCount = Number(countRows?.[0]?.cnt || 0);
              const sub = await getTenantSubscriptionServer();
              if (sub.limits.maxBranches !== "unlimited" && branchCount >= sub.limits.maxBranches) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxBranches} branch(es). Please upgrade your package.`,
                  }),
                  { status: 400, headers: { "Content-Type": "application/json" } },
                );
              }
            } catch {
              /* ignore */
            }
          }

          let isDefault = Boolean(body.isDefault);
          const existingRows = await query<Record<string, unknown>[]>(
            "SELECT id, is_default FROM branches WHERE restaurant_id = ?",
            [tenant.restaurantId],
          );
          if (!existingRows || existingRows.length === 0) {
            isDefault = true;
          }

          if (isDefault) {
            await query("UPDATE branches SET is_default = FALSE WHERE restaurant_id = ?", [
              tenant.restaurantId,
            ]);
          }

          await query(
            `INSERT INTO branches (id, restaurant_id, name, address, phone, manager, status, is_default, menu_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name),
               address = VALUES(address),
               phone = VALUES(phone),
               manager = VALUES(manager),
               status = VALUES(status),
               is_default = VALUES(is_default),
               menu_id = VALUES(menu_id)`,
            [
              branchId,
              tenant.restaurantId,
              body.name.trim(),
              body.address || "",
              body.phone || "",
              body.manager || "",
              body.status || "open",
              isDefault ? 1 : 0,
              body.menuId || "menu-downtown",
            ],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Branch saved successfully",
              data: {
                id: branchId,
                name: body.name.trim(),
                address: body.address || "",
                phone: body.phone || "",
                manager: body.manager || "",
                status: body.status || "open",
                isDefault,
                menuId: body.menuId || "menu-downtown",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save branch";
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

          if (!hasPermission(user.role, "branches:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks branches:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required branch id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM branches WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Branch deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete branch";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
