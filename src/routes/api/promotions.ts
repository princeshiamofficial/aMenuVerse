import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
  resolvePublicRestaurant,
} from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export const Route = createFileRoute("/api/promotions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");
          const search = url.searchParams.get("search") || "";
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

          let sql = "SELECT * FROM promotions WHERE restaurant_id = ?";
          const params: unknown[] = [restaurantId];

          if (status !== "all") {
            sql += " AND status = ?";
            params.push(status);
          }
          if (search.trim()) {
            sql += " AND (title LIKE ? OR code LIKE ? OR description LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
          }
          sql += " ORDER BY created_at DESC";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const promos = (rows || []).map((r) => {
            let branchIds: string[] = [];
            try {
              if (r.branch_ids) {
                branchIds =
                  typeof r.branch_ids === "string" ? JSON.parse(r.branch_ids) : r.branch_ids;
              }
            } catch {
              /* ignore */
            }

            return {
              id: String(r.id),
              title: String(r.title || ""),
              code: r.code ? String(r.code) : undefined,
              discountPercent: Number(r.discount_percent || 0),
              startDate: r.start_date ? String(r.start_date) : undefined,
              endDate: r.end_date ? String(r.end_date) : undefined,
              status: (r.status as string) || "active",
              bannerUrl: r.banner_url ? String(r.banner_url) : undefined,
              kind: (r.kind as string) || "seasonal",
              branchIds,
              popupEnabled: Boolean(r.popup_enabled),
              createdAt: r.created_at
                ? new Date(r.created_at as string).toISOString()
                : new Date().toISOString(),
            };
          });

          // Branch filtering
          const filtered =
            branchId !== "all"
              ? promos.filter(
                  (p) => !p.branchIds || p.branchIds.length === 0 || p.branchIds.includes(branchId),
                )
              : promos;

          return new Response(JSON.stringify({ success: true, data: filtered }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch promotions";
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

          if (!hasPermission(user.role, "promotions:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks promotions:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            id?: string;
            title: string;
            code?: string;
            discountPercent?: number;
            startDate?: string;
            endDate?: string;
            status?: string;
            bannerUrl?: string;
            kind?: string;
            branchIds?: string[];
            popupEnabled?: boolean;
          };

          if (!body.title || !body.title.trim()) {
            return new Response(
              JSON.stringify({ success: false, error: "Promotion title is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          const promoId = body.id || `promo-${crypto.randomUUID().slice(0, 8)}`;
          const branchIdsJson = JSON.stringify(body.branchIds || []);

          await query(
            `INSERT INTO promotions (
               id, restaurant_id, title, code, discount_percent, start_date, end_date,
               status, banner_url, kind, branch_ids, popup_enabled
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               title = VALUES(title),
               code = VALUES(code),
               discount_percent = VALUES(discount_percent),
               start_date = VALUES(start_date),
               end_date = VALUES(end_date),
               status = VALUES(status),
               banner_url = VALUES(banner_url),
               kind = VALUES(kind),
               branch_ids = VALUES(branch_ids),
               popup_enabled = VALUES(popup_enabled)`,
            [
              promoId,
              tenant.restaurantId,
              body.title.trim(),
              body.code || "",
              body.discountPercent ?? 0,
              body.startDate || null,
              body.endDate || null,
              body.status || "active",
              body.bannerUrl || "",
              body.kind || "seasonal",
              branchIdsJson,
              body.popupEnabled ? 1 : 0,
            ],
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Promotion saved successfully",
              data: {
                id: promoId,
                title: body.title.trim(),
                code: body.code,
                discountPercent: body.discountPercent ?? 0,
                startDate: body.startDate,
                endDate: body.endDate,
                status: body.status || "active",
                bannerUrl: body.bannerUrl,
                kind: body.kind || "seasonal",
                branchIds: body.branchIds || [],
                popupEnabled: Boolean(body.popupEnabled),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save promotion";
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

          if (!hasPermission(user.role, "promotions:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks promotions:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required promotion id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM promotions WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Promotion deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete promotion";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
