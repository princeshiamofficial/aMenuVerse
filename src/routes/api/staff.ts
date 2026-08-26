import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession, hashPassword } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
  getTenantSubscriptionServer,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export const Route = createFileRoute("/api/staff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!hasPermission(user.role, "staff:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks staff:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
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

          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") || "all";
          const role = url.searchParams.get("role") || "all";
          const status = url.searchParams.get("status") || "all";
          const search = url.searchParams.get("search") || "";

          let sql = `SELECT u.id, u.email, u.full_name as name, u.phone, u.role, u.branch, 
                            u.status, u.avatar_url, u.created_at 
                     FROM users u 
                     WHERE (u.restaurant_id = ? OR u.restaurant_id IS NULL)
                       AND LOWER(COALESCE(u.role, '')) NOT IN ('super_admin', 'superadmin')
                       AND LOWER(COALESCE(u.email, '')) NOT IN ('admin@menuverse.app')`;
          const params: unknown[] = [tenant.restaurantId];

          if (role !== "all") {
            sql += " AND u.role = ?";
            params.push(role);
          }
          if (status !== "all") {
            sql += " AND u.status = ?";
            params.push(status);
          }
          if (search.trim()) {
            sql += " AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
          }
          sql += " ORDER BY u.created_at DESC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const staffList = (rows || []).map((r) => ({
            id: String(r.id),
            name: String(r.name || r.email || "Staff Member"),
            email: String(r.email || ""),
            phone: String(r.phone || ""),
            role: String(r.role || "waiter"),
            branch: r.branch ? String(r.branch) : undefined,
            status: (r.status as string) || "active",
            avatarUrl: r.avatar_url ? String(r.avatar_url) : undefined,
            createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          }));

          return new Response(JSON.stringify({ success: true, data: staffList }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch staff";
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

          if (!hasPermission(user.role, "staff:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks staff:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            id?: string;
            name: string;
            email: string;
            phone?: string;
            role?: string;
            branch?: string;
            status?: string;
            password?: string;
          };

          if (!body.email || !body.name) {
            return new Response(
              JSON.stringify({ success: false, error: "Name and email are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const isNew = !body.id;
          const staffId = body.id || `staff-${crypto.randomUUID().slice(0, 8)}`;

          if (isNew) {
            try {
              const countRows = await query<Record<string, unknown>[]>(
                "SELECT COUNT(*) as cnt FROM users WHERE restaurant_id = ? AND LOWER(COALESCE(role, '')) NOT IN ('super_admin')",
                [tenant.restaurantId],
              );
              const staffCount = Number(countRows?.[0]?.cnt || 0);
              const sub = await getTenantSubscriptionServer();
              if (sub.limits.maxStaff !== "unlimited" && staffCount >= sub.limits.maxStaff) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxStaff} staff member(s). Please upgrade your subscription package.`,
                  }),
                  { status: 400, headers: { "Content-Type": "application/json" } },
                );
              }
            } catch {
              /* ignore */
            }
          }

          let passwordHashClause = "";
          const params: unknown[] = [
            staffId,
            tenant.restaurantId,
            body.email.trim().toLowerCase(),
            body.name.trim(),
            body.phone || "",
            body.role || "waiter",
            body.branch || null,
            body.status || "active",
          ];

          if (body.password && body.password.trim().length >= 6) {
            params.push(hashPassword(body.password.trim()));
            passwordHashClause = ", password_hash = VALUES(password_hash)";
          }

          await query(
            `INSERT INTO users (id, restaurant_id, email, full_name, phone, role, branch, status${body.password ? ", password_hash" : ""})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?${body.password ? ", ?" : ""})
             ON DUPLICATE KEY UPDATE 
               full_name = VALUES(full_name),
               phone = VALUES(phone),
               role = VALUES(role),
               branch = VALUES(branch),
               status = VALUES(status)${passwordHashClause}`,
            params,
          );

          // Update user_roles table
          await query(
            `INSERT INTO user_roles (user_id, role, restaurant_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), restaurant_id = VALUES(restaurant_id)`,
            [staffId, body.role || "waiter", tenant.restaurantId],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Staff member saved successfully",
              data: {
                id: staffId,
                name: body.name.trim(),
                email: body.email.trim().toLowerCase(),
                phone: body.phone || "",
                role: body.role || "waiter",
                branch: body.branch,
                status: body.status || "active",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save staff member";
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

          if (!hasPermission(user.role, "staff:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks staff:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required staff id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM users WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Staff member deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete staff member";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
