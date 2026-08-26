import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export const Route = createFileRoute("/api/reservations")({
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

          if (!hasPermission(user.role, "reservations:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks reservations:manage permission.`,
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
          const status = url.searchParams.get("status") || "all";
          const search = url.searchParams.get("search") || "";

          let sql = "SELECT * FROM reservations WHERE restaurant_id = ?";
          const params: unknown[] = [tenant.restaurantId];

          if (branchId !== "all") {
            sql += " AND (branch_id = ? OR branch_id LIKE ?)";
            params.push(branchId, `%${branchId}%`);
          } else if (!assignedInfo.isAll) {
            const branchIds = assignedInfo.branches.map((b) => b.id);
            if (branchIds.length > 0) {
              sql += ` AND branch_id IN (${branchIds.map(() => "?").join(",")})`;
              params.push(...branchIds);
            }
          }

          if (status !== "all") {
            sql += " AND status = ?";
            params.push(status);
          }
          if (search.trim()) {
            sql += " AND (guest_name LIKE ? OR phone LIKE ? OR email LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
          }
          sql += " ORDER BY reservation_date ASC, reservation_time ASC, created_at DESC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const reservations = (rows || []).map((r) => ({
            id: String(r.id),
            guestName: String(r.guest_name || ""),
            phone: String(r.phone || ""),
            email: r.email ? String(r.email) : undefined,
            guests: Number(r.guests_count || r.guests || 2),
            date: String(r.reservation_date || r.date || ""),
            time: String(r.reservation_time || r.time || ""),
            status: (r.status as string) || "pending",
            branchId: r.branch_id ? String(r.branch_id) : undefined,
            tableNumber: r.table_no ? String(r.table_no) : undefined,
            specialRequests: r.special_requests ? String(r.special_requests) : undefined,
            createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          }));

          return new Response(JSON.stringify({ success: true, data: reservations }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch reservations";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            id?: string;
            guestName: string;
            phone: string;
            email?: string;
            guests: number;
            date: string;
            time: string;
            status?: string;
            branchId?: string;
            tableNumber?: string;
            specialRequests?: string;
          };

          if (!body.guestName || !body.phone || !body.date || !body.time) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Guest name, phone, date, and time are required",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const user = await verifySession().catch(() => null);
          let restaurantId = 1;
          if (user) {
            const tenant = await resolvePrivateTenantContext();
            restaurantId = tenant.restaurantId;
          }

          const resId = body.id || `res-${crypto.randomUUID().slice(0, 8)}`;

          await query(
            `INSERT INTO reservations (
               id, restaurant_id, branch_id, guest_name, phone, email, guests_count,
               reservation_date, reservation_time, status, table_no, special_requests
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               guest_name = VALUES(guest_name),
               phone = VALUES(phone),
               email = VALUES(email),
               guests_count = VALUES(guests_count),
               reservation_date = VALUES(reservation_date),
               reservation_time = VALUES(reservation_time),
               status = VALUES(status),
               table_no = VALUES(table_no),
               special_requests = VALUES(special_requests)`,
            [
              resId,
              restaurantId,
              body.branchId || "branch-main-1",
              body.guestName.trim(),
              body.phone.trim(),
              body.email || "",
              body.guests || 2,
              body.date,
              body.time,
              body.status || "pending",
              body.tableNumber || "",
              body.specialRequests || "",
            ],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Reservation saved successfully",
              data: {
                id: resId,
                guestName: body.guestName.trim(),
                phone: body.phone.trim(),
                email: body.email,
                guests: body.guests || 2,
                date: body.date,
                time: body.time,
                status: body.status || "pending",
                branchId: body.branchId,
                tableNumber: body.tableNumber,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save reservation";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      PUT: async ({ request }) => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!hasPermission(user.role, "reservations:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks reservations:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as { id: string; status: string };
          if (!body.id || !body.status) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Missing required reservation id or status",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query(
            "UPDATE reservations SET status = ? WHERE id = ? AND restaurant_id = ?",
            [body.status, body.id, tenant.restaurantId],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Reservation status updated successfully",
              data: { id: body.id, status: body.status },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update reservation";
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

          if (!hasPermission(user.role, "reservations:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks reservations:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required reservation id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM reservations WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Reservation deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete reservation";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
