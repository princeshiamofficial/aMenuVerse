import { createFileRoute } from "@tanstack/react-router";
import { query } from "../../lib/mysql";
import {
  verifySession,
  verifyPassword,
  hashPassword,
  createSession,
  destroySession,
} from "../../lib/auth.server";
import crypto from "crypto";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const user = await verifySession();
          if (!user) {
            return new Response(JSON.stringify({ success: false, user: null }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ success: true, user }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ success: false, user: null }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const action = String(body.action || "login").toLowerCase().trim();

          if (action === "signout" || action === "logout") {
            await destroySession();
            return new Response(JSON.stringify({ success: true, message: "Logged out successfully" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "signup" || action === "register") {
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");
            const name = String(body.name || email.split("@")[0]);
            const restaurantName = String(body.restaurantName || name);

            if (!email || !password) {
              return new Response(
                JSON.stringify({ success: false, error: "Email and password are required." }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }

            const existing = await query<Record<string, unknown>[]>(
              "SELECT id FROM users WHERE email = ? LIMIT 1",
              [email],
            );
            if (existing && existing.length > 0) {
              return new Response(
                JSON.stringify({ success: false, error: "Email is already registered." }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }

            const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
            const hashedPassword = await hashPassword(password);

            // Create restaurant
            const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            const restRes = await query<{ insertId?: number }>(
              "INSERT INTO restaurants (name, slug, cuisine, plan, status) VALUES (?, ?, ?, ?, ?)",
              [restaurantName, slug || userId, "Gourmet Kitchen", "Starter", "active"],
            );
            const restaurantId = restRes?.insertId || 1;

            // Create owner user
            await query(
              "INSERT INTO users (id, restaurant_id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [userId, restaurantId, name, email, hashedPassword, "Owner", "active"],
            );

            const sessionUser = {
              id: userId,
              restaurantId,
              name,
              email,
              role: "Owner",
              restaurantName,
            };

            await createSession(userId);
            return new Response(JSON.stringify({ success: true, user: sessionUser }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Default: Login
          const email = String(body.email || "").trim().toLowerCase();
          const password = String(body.password || "");

          if (!email || !password) {
            return new Response(
              JSON.stringify({ success: false, error: "Email and password are required." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const rows = await query<Record<string, unknown>[]>(
            "SELECT u.*, r.name as restaurant_name, r.slug as restaurant_slug FROM users u LEFT JOIN restaurants r ON r.id = u.restaurant_id WHERE u.email = ? LIMIT 1",
            [email],
          );

          if (!rows || rows.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: "Invalid email or password." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const userRow = rows[0];
          const isValidPass = await verifyPassword(password, String(userRow.password || ""));
          if (!isValidPass) {
            return new Response(
              JSON.stringify({ success: false, error: "Invalid email or password." }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const sessionUser = {
            id: String(userRow.id),
            restaurantId: Number(userRow.restaurant_id || 1),
            name: String(userRow.name || ""),
            email: String(userRow.email || ""),
            role: String(userRow.role || "Owner"),
            restaurantName: String(userRow.restaurant_name || "Restaurant"),
            restaurantSlug: String(userRow.restaurant_slug || ""),
          };

          await createSession(String(userRow.id));
          return new Response(JSON.stringify({ success: true, user: sessionUser }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Authentication failed";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
