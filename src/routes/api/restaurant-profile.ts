import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  resolvePublicRestaurant,
  serverUploadImageToImgBBIfBase64,
} from "../../lib/db-queries.server";
import { sanitizeImageUrl } from "../../lib/imgbb";
import { hasPermission } from "../../lib/permissions";

export const Route = createFileRoute("/api/restaurant-profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");

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

          const rows = await query<Record<string, unknown>[]>(
            "SELECT * FROM restaurant_profiles WHERE restaurant_id = ? LIMIT 1",
            [restaurantId],
          );

          if (!rows || rows.length === 0) {
            const restRows = await query<Record<string, unknown>[]>(
              "SELECT * FROM restaurants WHERE id = ? LIMIT 1",
              [restaurantId],
            );
            if (restRows && restRows.length > 0) {
              const r = restRows[0];
              return new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    restaurantName: String(r.name || ""),
                    slug: String(r.slug || ""),
                    tagline: String(r.tagline || ""),
                    description: String(r.description || ""),
                    logoUrl: sanitizeImageUrl(String(r.logo_url || "")),
                    coverUrl: sanitizeImageUrl(String(r.cover_url || "")),
                    phone: String(r.phone || ""),
                    email: String(r.owner_email || ""),
                    currency: String(r.currency || "BDT"),
                  },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
          }

          const p = rows[0];
          let socialLinks = {};
          let businessHours = {};
          try {
            if (p.social_links) {
              socialLinks =
                typeof p.social_links === "string" ? JSON.parse(p.social_links) : p.social_links;
            }
            if (p.business_hours) {
              businessHours =
                typeof p.business_hours === "string"
                  ? JSON.parse(p.business_hours)
                  : p.business_hours;
            }
          } catch {
            /* ignore */
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                restaurantName: String(p.restaurant_name || ""),
                slug: String(p.slug || ""),
                tagline: String(p.tagline || ""),
                description: String(p.description || ""),
                logoUrl: sanitizeImageUrl(String(p.logo_url || "")),
                coverUrl: sanitizeImageUrl(String(p.cover_url || "")),
                phone: String(p.phone || ""),
                email: String(p.email || ""),
                website: String(p.website || ""),
                currency: String(p.currency || "BDT"),
                address: String(p.address || ""),
                socialLinks,
                businessHours,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch restaurant profile";
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

          if (!hasPermission(user.role, "restaurant:update_profile")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks restaurant:update_profile permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            restaurantName?: string;
            tagline?: string;
            description?: string;
            logoUrl?: string;
            coverUrl?: string;
            phone?: string;
            email?: string;
            website?: string;
            currency?: string;
            address?: string;
            socialLinks?: Record<string, string>;
            businessHours?: Record<string, unknown>;
          };

          const tenant = await resolvePrivateTenantContext();
          const pool = getPool();

          // Ensure columns
          try {
            await pool.query(
              "ALTER TABLE restaurant_profiles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            );
            await pool.query(
              "ALTER TABLE restaurant_profiles ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
            );
          } catch {
            /* ignore */
          }

          const logoUrl = await serverUploadImageToImgBBIfBase64(body.logoUrl);
          const coverUrl = await serverUploadImageToImgBBIfBase64(body.coverUrl);

          await query(
            `INSERT INTO restaurant_profiles (
               restaurant_id, restaurant_name, tagline, description, logo_url, cover_url,
               phone, email, website, currency, address, social_links, business_hours
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               restaurant_name = VALUES(restaurant_name),
               tagline = VALUES(tagline),
               description = VALUES(description),
               logo_url = VALUES(logo_url),
               cover_url = VALUES(cover_url),
               phone = VALUES(phone),
               email = VALUES(email),
               website = VALUES(website),
               currency = VALUES(currency),
               address = VALUES(address),
               social_links = VALUES(social_links),
               business_hours = VALUES(business_hours)`,
            [
              tenant.restaurantId,
              body.restaurantName || "",
              body.tagline || "",
              body.description || "",
              logoUrl,
              coverUrl,
              body.phone || "",
              body.email || "",
              body.website || "",
              body.currency || "BDT",
              body.address || "",
              JSON.stringify(body.socialLinks || {}),
              JSON.stringify(body.businessHours || {}),
            ],
          );

          // Keep restaurants table fully synchronized with profile updates
          try {
            await query(
              `UPDATE restaurants SET 
                 name = COALESCE(NULLIF(?, ''), name),
                 phone = COALESCE(NULLIF(?, ''), phone),
                 location = COALESCE(NULLIF(?, ''), location),
                 logo_url = COALESCE(NULLIF(?, ''), logo_url),
                 cover_url = COALESCE(NULLIF(?, ''), cover_url)
               WHERE id = ?`,
              [
                body.restaurantName?.trim() || "",
                body.phone?.trim() || "",
                body.address?.trim() || "",
                logoUrl || "",
                coverUrl || "",
                tenant.restaurantId,
              ],
            );
          } catch {
            /* ignore */
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Restaurant profile updated successfully",
              data: body,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update restaurant profile";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
