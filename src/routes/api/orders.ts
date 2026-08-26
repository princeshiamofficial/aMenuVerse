import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import { resolvePrivateTenantContext, getUserAssignedBranches } from "../../lib/db-queries.server";
import { hasPermission } from "../../lib/permissions";
import { broadcastRealtimeEvent } from "../../lib/realtime.server";
import crypto from "crypto";

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const customerPhone = url.searchParams.get("customerPhone");
          const customSlugOrEmail = url.searchParams.get("customSlugOrEmail");

          // Customer Order History Lookup
          if (customerPhone) {
            const cleanPhone = customerPhone.replace(/\D/g, "");
            const rows = await query<Record<string, unknown>[]>(
              `SELECT * FROM pos_orders 
               WHERE REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '') LIKE ? 
               ORDER BY created_at DESC LIMIT 50`,
              [`%${cleanPhone}%`],
            );

            return new Response(
              JSON.stringify({
                success: true,
                data: (rows || []).map((r) => {
                  let items = [];
                  try {
                    items =
                      typeof r.lines_json === "string"
                        ? JSON.parse(r.lines_json)
                        : r.lines_json || [];
                  } catch {
                    /* ignore */
                  }
                  return {
                    id: String(r.id),
                    orderNumber: String(r.order_no || r.id),
                    total: Number(r.total_amount || 0),
                    status: (r.status as string) || "pending",
                    items,
                    createdAt: r.created_at
                      ? new Date(r.created_at as string).toISOString()
                      : new Date().toISOString(),
                    customerName: String(r.customer_name || "Guest Customer"),
                    branchId: r.branch_id ? String(r.branch_id) : undefined,
                  };
                }),
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

          if (!hasPermission(user.role, "orders:view")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks orders:view permission.`,
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

          const branchId = url.searchParams.get("branchId") || "all";
          const status = url.searchParams.get("status") || "all";
          const type = url.searchParams.get("type") || "all";
          const search = url.searchParams.get("search") || "";

          let sql = "SELECT * FROM pos_orders WHERE restaurant_id = ?";
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
          if (type !== "all") {
            sql += " AND order_type = ?";
            params.push(type);
          }
          if (search.trim()) {
            sql += " AND (order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ?)";
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
          }
          sql += " ORDER BY created_at DESC LIMIT 200";

          const rows = await query<Record<string, unknown>[]>(sql, params);
          const orders = (rows || []).map((r) => {
            let items = [];
            try {
              items =
                typeof r.lines_json === "string" ? JSON.parse(r.lines_json) : r.lines_json || [];
            } catch {
              /* ignore */
            }

            return {
              id: String(r.id),
              orderNumber: String(r.order_no || r.id),
              customerName: String(r.customer_name || "Walk-in Customer"),
              customerPhone: String(r.phone || ""),
              status: (r.status as string) || "pending",
              orderType: (r.order_type as string) || "dine_in",
              paymentStatus: (r.payment_status as string) || "paid",
              subtotal: Number(r.subtotal_amount || r.total_amount || 0),
              tax: Number(r.tax_amount || 0),
              serviceCharge: Number(r.service_charge || 0),
              discount: Number(r.discount_amount || 0),
              deliveryFee: Number(r.delivery_fee || 0),
              total: Number(r.total_amount || 0),
              items,
              branchId: r.branch_id ? String(r.branch_id) : undefined,
              branchName: r.branch_id ? String(r.branch_id) : undefined,
              tableNumber: r.table_no ? String(r.table_no) : undefined,
              createdAt: r.created_at
                ? new Date(r.created_at as string).toISOString()
                : new Date().toISOString(),
              specialInstructions: r.special_instructions
                ? String(r.special_instructions)
                : undefined,
            };
          });

          return new Response(JSON.stringify({ success: true, data: orders }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to fetch orders";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            orderNumber?: string;
            customerName?: string;
            customerPhone?: string;
            customerEmail?: string;
            branchId?: string;
            tableNumber?: string;
            orderType?: string;
            status?: string;
            paymentMethod?: string;
            paymentStatus?: string;
            items: Array<{
              itemId: string;
              name: string;
              quantity: number;
              unitPrice: number;
              price?: number;
              total?: number;
              notes?: string;
            }>;
            subtotal?: number;
            tax?: number;
            serviceCharge?: number;
            discount?: number;
            deliveryFee?: number;
            total?: number;
            specialInstructions?: string;
          };

          const user = await verifySession().catch(() => null);
          let restaurantId = 1;
          if (user) {
            const tenant = await resolvePrivateTenantContext();
            restaurantId = tenant.restaurantId;
          }

          if (!body.items || body.items.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: "Order must contain at least one item" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const orderId = `pos-${crypto.randomUUID().slice(0, 10)}`;
          const orderNo = body.orderNumber || `#${Math.floor(1000 + Math.random() * 9000)}`;

          let calculatedSubtotal = 0;
          for (const item of body.items) {
            calculatedSubtotal += (item.unitPrice || item.price || 0) * (item.quantity || 1);
          }
          const subtotal = body.subtotal ?? calculatedSubtotal;
          const tax = body.tax ?? subtotal * 0.085;
          const serviceCharge = body.serviceCharge ?? 0;
          const discount = body.discount ?? 0;
          const deliveryFee = body.deliveryFee ?? 0;
          const total = body.total ?? subtotal + tax + serviceCharge + deliveryFee - discount;

          const linesJson = JSON.stringify(body.items);

          await query(
            `INSERT INTO pos_orders (
               id, restaurant_id, branch_id, order_no, customer_name, phone, order_type,
               table_no, status, payment_status, payment_method, subtotal_amount, tax_amount,
               service_charge, discount_amount, delivery_fee, total_amount, lines_json, special_instructions
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              restaurantId,
              body.branchId || "branch-main-1",
              orderNo,
              body.customerName || "Walk-in Customer",
              body.customerPhone || "",
              body.orderType || "dine_in",
              body.tableNumber || "",
              body.status || "pending",
              body.paymentStatus || "paid",
              body.paymentMethod || "cash",
              subtotal,
              tax,
              serviceCharge,
              discount,
              deliveryFee,
              total,
              linesJson,
              body.specialInstructions || "",
            ],
          );

          // Broadcast real-time order creation event
          try {
            broadcastRealtimeEvent({
              type: "ORDER_CREATED",
              restaurantId,
              branchId: body.branchId || "branch-main-1",
              data: {
                orderId,
                orderNumber: orderNo,
                customerName: body.customerName || "Walk-in Customer",
                total,
                status: body.status || "pending",
              },
            });
          } catch {
            /* ignore realtime broadcast notice */
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Order placed successfully",
              data: {
                id: orderId,
                orderNumber: orderNo,
                total,
                status: body.status || "pending",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to place order";
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

          if (!hasPermission(user.role, "orders:update_status")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks orders:update_status permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as { id: string; status: string };
          if (!body.id || !body.status) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required order id or status" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("UPDATE pos_orders SET status = ? WHERE id = ? AND restaurant_id = ?", [
            body.status,
            body.id,
            tenant.restaurantId,
          ]);

          try {
            broadcastRealtimeEvent({
              type: "ORDER_STATUS_CHANGED",
              restaurantId: tenant.restaurantId,
              data: {
                orderId: body.id,
                status: body.status,
              },
            });
          } catch {
            /* ignore */
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Order status updated successfully",
              data: { id: body.id, status: body.status },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update order status";
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

          if (!hasPermission(user.role, "orders:delete")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks orders:delete permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required order id" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();
          await query("DELETE FROM pos_orders WHERE id = ? AND restaurant_id = ?", [
            id,
            tenant.restaurantId,
          ]);

          return new Response(
            JSON.stringify({ success: true, message: "Order deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete order";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
