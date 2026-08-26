import { createFileRoute } from "@tanstack/react-router";
import { query } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import { resolvePrivateTenantContext } from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";

export const Route = createFileRoute("/api/settings")({
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
          const rows = await query<Record<string, unknown>[]>(
            "SELECT * FROM settings WHERE restaurant_id = ? LIMIT 1",
            [tenant.restaurantId],
          ).catch(() => []);

          if (rows && rows.length > 0) {
            const row = rows[0];
            let appSettings = {};
            try {
              if (row.app_settings) {
                appSettings =
                  typeof row.app_settings === "string"
                    ? JSON.parse(row.app_settings)
                    : row.app_settings;
              }
            } catch {
              /* ignore */
            }

            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  ...appSettings,
                  currency: row.currency || "BDT",
                  taxRate: row.tax_rate != null ? Number(row.tax_rate) : 0,
                  serviceFee: row.service_fee != null ? Number(row.service_fee) : 0,
                  themeColor: row.theme_color || "amber",
                  fontFamily: row.font_family || "sans",
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                currency: "BDT",
                taxRate: 0,
                serviceFee: 0,
                themeColor: "amber",
                fontFamily: "sans",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load settings";
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

          await query(
            `INSERT INTO settings (
               restaurant_id, currency, tax_rate, service_fee, theme_color, font_family, app_settings
             ) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               currency = VALUES(currency),
               tax_rate = VALUES(tax_rate),
               service_fee = VALUES(service_fee),
               theme_color = VALUES(theme_color),
               font_family = VALUES(font_family),
               app_settings = VALUES(app_settings)`,
            [
              tenant.restaurantId,
              String(body.currency || "BDT"),
              body.taxRate != null ? Number(body.taxRate) : 0,
              body.serviceFee != null ? Number(body.serviceFee) : 0,
              String(body.themeColor || "amber"),
              String(body.fontFamily || "sans"),
              JSON.stringify(body),
            ],
          );

          return new Response(
            JSON.stringify({ success: true, message: "Settings saved successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save settings";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
