import { createFileRoute } from "@tanstack/react-router";
import { query } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import { resolvePrivateTenantContext, getUserAssignedBranches } from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";

export const Route = createFileRoute("/api/analytics")({
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

          if (!hasPermission(user.role, "analytics:view")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks analytics:view permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") || "all";

          let sql = "SELECT * FROM pos_orders WHERE restaurant_id = ?";
          const params: unknown[] = [tenant.restaurantId];

          if (branchId !== "all") {
            sql += " AND (branch_id = ? OR branch_id LIKE ?)";
            params.push(branchId, `%${branchId}%`);
          }

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const orders = rows || [];

          let totalRevenue = 0;
          let completedOrders = 0;
          const customersSet = new Set<string>();
          const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> =
            {};

          for (const o of orders) {
            const total = Number(o.total_amount || 0);
            totalRevenue += total;
            if (o.status === "completed" || o.payment_status === "paid") {
              completedOrders++;
            }
            if (o.phone || o.customer_name) {
              customersSet.add(String(o.phone || o.customer_name));
            }

            try {
              const lines =
                typeof o.lines_json === "string" ? JSON.parse(o.lines_json) : o.lines_json || [];
              for (const l of lines) {
                const name = l.name || l.title || "Item";
                const qty = Number(l.quantity || l.qty || 1);
                const price = Number(l.unitPrice || l.price || 0);
                if (!itemSalesMap[name]) {
                  itemSalesMap[name] = { name, quantity: 0, revenue: 0 };
                }
                itemSalesMap[name].quantity += qty;
                itemSalesMap[name].revenue += price * qty;
              }
            } catch {
              /* ignore */
            }
          }

          const topItems = Object.values(itemSalesMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                totalRevenue,
                totalOrders: orders.length,
                completedOrders,
                totalCustomers: customersSet.size,
                averageOrderValue: avgOrderValue,
                topItems,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch analytics";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
