import { createFileRoute } from "@tanstack/react-router";
import { query } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getTenantSubscriptionServer,
} from "../../lib/db-queries.server";

export const Route = createFileRoute("/api/subscription")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized: Please sign in." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const sub = await getTenantSubscriptionServer();

          // Count current resources
          const [catRows, itemRows, branchRows, orderRows] = await Promise.all([
            query<Record<string, unknown>[]>(
              "SELECT COUNT(*) as cnt FROM categories WHERE restaurant_id = ?",
              [tenant.restaurantId],
            ).catch(() => [{ cnt: 0 }]),
            query<Record<string, unknown>[]>(
              "SELECT COUNT(*) as cnt FROM food_items WHERE restaurant_id = ?",
              [tenant.restaurantId],
            ).catch(() => [{ cnt: 0 }]),
            query<Record<string, unknown>[]>(
              "SELECT COUNT(*) as cnt FROM branches WHERE restaurant_id = ?",
              [tenant.restaurantId],
            ).catch(() => [{ cnt: 0 }]),
            query<Record<string, unknown>[]>(
              "SELECT COUNT(*) as cnt FROM pos_orders WHERE restaurant_id = ?",
              [tenant.restaurantId],
            ).catch(() => [{ cnt: 0 }]),
          ]);

          const usage = {
            categories: Number(catRows?.[0]?.cnt || 0),
            foodItems: Number(itemRows?.[0]?.cnt || 0),
            branches: Number(branchRows?.[0]?.cnt || 0),
            orders: Number(orderRows?.[0]?.cnt || 0),
          };

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                subscription: sub,
                usage,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load subscription info";
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

          const tenant = await resolvePrivateTenantContext();
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const plan = String(body.plan || "Starter").trim();

          await query("UPDATE restaurants SET plan = ? WHERE id = ?", [plan, tenant.restaurantId]);

          return new Response(
            JSON.stringify({
              success: true,
              message: `Successfully upgraded to ${plan} plan.`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update subscription";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
