import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import { broadcastRealtimeEvent } from "../../lib/realtime.server";
import crypto from "crypto";

export const Route = createFileRoute("/api/waiter-requests")({
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

          const tenant = await resolvePrivateTenantContext();
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") || "all";
          const status = url.searchParams.get("status") || "pending";

          let sql = "SELECT * FROM waiter_requests WHERE restaurant_id = ?";
          const params: unknown[] = [tenant.restaurantId];

          if (branchId !== "all") {
            sql += " AND (branch_id = ? OR branch_id LIKE ?)";
            params.push(branchId, `%${branchId}%`);
          }
          if (status !== "all") {
            sql += " AND status = ?";
            params.push(status);
          }
          sql += " ORDER BY created_at DESC LIMIT 50";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const requests = (rows || []).map((r) => ({
            id: String(r.id),
            tableNumber: String(r.table_no || ""),
            branchId: r.branch_id ? String(r.branch_id) : undefined,
            type: String(r.request_type || "service"),
            status: String(r.status || "pending"),
            message: r.message ? String(r.message) : undefined,
            createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          }));

          return new Response(JSON.stringify({ success: true, data: requests }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch waiter requests";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            tableNumber: string;
            branchId?: string;
            type?: string;
            message?: string;
            restaurantId?: number;
          };

          if (!body.tableNumber) {
            return new Response(
              JSON.stringify({ success: false, error: "Table number is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const user = await verifySession().catch(() => null);
          let restaurantId = body.restaurantId || 1;
          if (user) {
            const tenant = await resolvePrivateTenantContext();
            restaurantId = tenant.restaurantId;
          }

          const reqId = `wr-${crypto.randomUUID().slice(0, 8)}`;
          await query(
            `INSERT INTO waiter_requests (id, restaurant_id, branch_id, table_no, request_type, status, message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              reqId,
              restaurantId,
              body.branchId || "branch-main-1",
              body.tableNumber,
              body.type || "service",
              "pending",
              body.message || "",
            ],
          );

          try {
            broadcastRealtimeEvent({
              type: "WAITER_REQUEST_CREATED",
              restaurantId,
              branchId: body.branchId || "branch-main-1",
              data: {
                id: reqId,
                tableNumber: body.tableNumber,
                type: body.type || "service",
              },
            });
          } catch {
            /* ignore */
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Waiter requested successfully",
              data: { id: reqId, tableNumber: body.tableNumber },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to create waiter request";
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

          const body = (await request.json()) as { id: string; status: string };
          if (!body.id || !body.status) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required request id or status" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query(
            "UPDATE waiter_requests SET status = ? WHERE id = ? AND restaurant_id = ?",
            [body.status, body.id, tenant.restaurantId],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Waiter request updated successfully",
              data: { id: body.id, status: body.status },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update waiter request";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
