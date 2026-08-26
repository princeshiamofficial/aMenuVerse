import { createFileRoute } from "@tanstack/react-router";
import { query, getPool } from "../../lib/mysql";
import { verifySession } from "../../lib/auth.server";
import {
  resolvePrivateTenantContext,
  getUserAssignedBranches,
  getTenantSubscriptionServer,
} from "../../lib/db-queries.server";
import { encodeTableToken } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";
import crypto from "crypto";

export interface TableItemResponse {
  id: string;
  tableNo: string;
  zone: string;
}

export const Route = createFileRoute("/api/branch-tables")({
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

          const url = new URL(request.url);
          const rawBranchId = url.searchParams.get("branchId") || "all";
          const cleanBranchId = rawBranchId.trim();

          const tenant = await resolvePrivateTenantContext();
          const assignedInfo = await getUserAssignedBranches(tenant);

          if (!assignedInfo.isAll && assignedInfo.branches.length === 0) {
            return new Response(JSON.stringify({ success: true, data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Ensure branch_tables schema
          try {
            const pool = getPool();
            const alters = [
              "ALTER TABLE branch_tables CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
              "ALTER TABLE branch_tables ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
              "ALTER TABLE branch_tables ADD COLUMN branch_id VARCHAR(255) NOT NULL DEFAULT '1'",
              "ALTER TABLE branch_tables ADD COLUMN table_no VARCHAR(255) NOT NULL DEFAULT '01'",
              "ALTER TABLE branch_tables ADD COLUMN table_number VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN name VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN location VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN zone VARCHAR(255) DEFAULT 'MAIN ROOM'",
              "ALTER TABLE branch_tables ADD COLUMN sort_order INT DEFAULT 0",
              "ALTER TABLE branch_tables ADD COLUMN qr_token TEXT NULL",
              "ALTER TABLE branch_tables ADD COLUMN status VARCHAR(50) DEFAULT 'available'",
              "ALTER TABLE branch_tables MODIFY COLUMN id VARCHAR(255) NOT NULL",
              "ALTER TABLE branch_tables MODIFY COLUMN table_no VARCHAR(255) NOT NULL DEFAULT '01'",
              "ALTER TABLE branch_tables MODIFY COLUMN branch_id VARCHAR(255) NOT NULL DEFAULT '1'",
            ];
            for (const alt of alters) {
              try {
                await pool.query(alt);
              } catch {
                /* ignore */
              }
            }
          } catch {
            /* ignore */
          }

          let rows: Record<string, unknown>[] | null = null;
          if (cleanBranchId && cleanBranchId !== "all") {
            const branchMatchClauses = [
              "branch_id = ?",
              "branch_id = ?",
              "branch_id LIKE ?",
              "LOWER(branch_id) = LOWER(?)",
            ];
            const branchMatchParams: (string | number | null)[] = [
              cleanBranchId,
              cleanBranchId.replace("branch-", ""),
              `%${cleanBranchId}%`,
              cleanBranchId,
            ];

            try {
              const bRows = await query<Record<string, unknown>[]>(
                "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?)",
                [
                  tenant.restaurantId,
                  cleanBranchId,
                  cleanBranchId,
                  cleanBranchId,
                  `%${cleanBranchId}%`,
                ],
              );
              for (const b of bRows || []) {
                if (b.id) {
                  branchMatchClauses.push("branch_id = ?");
                  branchMatchParams.push(String(b.id));
                }
                if (b.name) {
                  branchMatchClauses.push("LOWER(branch_id) = LOWER(?)");
                  branchMatchParams.push(String(b.name));
                }
              }
            } catch {
              /* ignore */
            }

            const sql = `SELECT id, 
                                COALESCE(NULLIF(table_no, ''), NULLIF(table_number, ''), NULLIF(name, ''), '01') as table_no, 
                                COALESCE(NULLIF(zone, ''), NULLIF(location, ''), 'MAIN ROOM') as zone 
                         FROM branch_tables 
                         WHERE (${branchMatchClauses.join(" OR ")}) AND (restaurant_id = ? OR restaurant_id = 0 OR restaurant_id IS NULL) 
                         ORDER BY sort_order ASC, created_at ASC`;
            rows = await query<Record<string, unknown>[]>(sql, [
              ...branchMatchParams,
              tenant.restaurantId,
            ]);
          } else {
            rows = await query<Record<string, unknown>[]>(
              `SELECT id, 
                      COALESCE(NULLIF(table_no, ''), NULLIF(table_number, ''), NULLIF(name, ''), '01') as table_no, 
                      COALESCE(NULLIF(zone, ''), NULLIF(location, ''), 'MAIN ROOM') as zone 
               FROM branch_tables 
               WHERE (restaurant_id = ? OR restaurant_id = 0 OR restaurant_id IS NULL) 
               ORDER BY sort_order ASC, created_at ASC`,
              [tenant.restaurantId],
            );
          }

          const seen = new Set<string>();
          const dbTables: TableItemResponse[] = [];
          for (const r of rows || []) {
            const tNo = String(r.table_no || "").trim();
            const numKey = parseInt(tNo, 10);
            const key = !isNaN(numKey) ? `num-${numKey}` : tNo.toLowerCase();
            if (tNo && !seen.has(key)) {
              seen.add(key);
              dbTables.push({
                id: String(r.id),
                tableNo: tNo,
                zone: String(r.zone || "MAIN ROOM"),
              });
            }
          }

          return new Response(JSON.stringify({ success: true, data: dbTables }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Internal Server Error";
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

          if (!hasPermission(user.role, "branch_tables:manage")) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Forbidden: Role '${user.role}' lacks branch_tables:manage permission.`,
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            branchId?: string | number;
            tables?: Array<{ id?: string | number; tableNo?: string | number; zone?: string }>;
          };

          const rawBranchId = String(body.branchId || "").trim();
          const tables = Array.isArray(body.tables) ? body.tables : [];

          if (!rawBranchId) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required branchId" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tenant = await resolvePrivateTenantContext();

          // Ensure table columns exist
          try {
            const pool = getPool();
            const alters = [
              "ALTER TABLE branch_tables CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
              "ALTER TABLE branch_tables ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
              "ALTER TABLE branch_tables ADD COLUMN branch_id VARCHAR(255) NOT NULL DEFAULT '1'",
              "ALTER TABLE branch_tables ADD COLUMN table_no VARCHAR(255) NOT NULL DEFAULT '01'",
              "ALTER TABLE branch_tables ADD COLUMN table_number VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN name VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN location VARCHAR(255) NULL",
              "ALTER TABLE branch_tables ADD COLUMN zone VARCHAR(255) DEFAULT 'MAIN ROOM'",
              "ALTER TABLE branch_tables ADD COLUMN sort_order INT DEFAULT 0",
              "ALTER TABLE branch_tables ADD COLUMN qr_token TEXT NULL",
              "ALTER TABLE branch_tables ADD COLUMN status VARCHAR(50) DEFAULT 'available'",
              "ALTER TABLE branch_tables MODIFY COLUMN id VARCHAR(255) NOT NULL",
              "ALTER TABLE branch_tables MODIFY COLUMN table_no VARCHAR(255) NOT NULL DEFAULT '01'",
              "ALTER TABLE branch_tables MODIFY COLUMN branch_id VARCHAR(255) NOT NULL DEFAULT '1'",
            ];
            for (const alt of alters) {
              try {
                await pool.query(alt);
              } catch {
                /* ignore */
              }
            }
          } catch {
            /* ignore */
          }

          // Check subscription limits
          try {
            const otherTables = await query<Record<string, unknown>[]>(
              "SELECT id FROM branch_tables WHERE restaurant_id = ? AND branch_id != ?",
              [tenant.restaurantId, rawBranchId],
            );
            const totalQrs = (otherTables || []).length + tables.length;
            const sub = await getTenantSubscriptionServer();
            if (sub.limits.maxQrs !== "unlimited" && totalQrs > sub.limits.maxQrs) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: `Package Limit Reached: Your current "${sub.plan}" package allows up to ${sub.limits.maxQrs} QR Code(s). Please upgrade your subscription package.`,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }
          } catch (limitErr: unknown) {
            const msg = limitErr instanceof Error ? limitErr.message : "";
            if (msg.includes("Package Limit Reached")) {
              return new Response(JSON.stringify({ success: false, error: msg }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          let canonicalBranchId = rawBranchId;
          let bSlug = rawBranchId;
          try {
            const bRow = await query<Record<string, unknown>[]>(
              "SELECT id, name FROM branches WHERE restaurant_id = ? AND (id = ? OR name = ? OR ? LIKE CONCAT('%', name, '%') OR name LIKE ?) LIMIT 1",
              [tenant.restaurantId, rawBranchId, rawBranchId, rawBranchId, `%${rawBranchId}%`],
            );
            if (bRow && bRow.length > 0) {
              if (bRow[0].id) canonicalBranchId = String(bRow[0].id);
              if (bRow[0].name) {
                bSlug = String(bRow[0].name)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
              }
            }
          } catch {
            /* fallback */
          }

          // Delete previous tables for this branch
          try {
            await query(
              "DELETE FROM branch_tables WHERE (branch_id = ? OR branch_id = ? OR branch_id = ? OR LOWER(branch_id) = LOWER(?)) AND (restaurant_id = ? OR restaurant_id = 0 OR restaurant_id IS NULL)",
              [
                rawBranchId,
                canonicalBranchId,
                rawBranchId.replace("branch-", ""),
                rawBranchId,
                tenant.restaurantId,
              ],
            );
          } catch {
            /* ignore */
          }

          // Insert updated tables
          for (let idx = 0; idx < tables.length; idx++) {
            const t = tables[idx];
            const tableId = t.id ? String(t.id) : crypto.randomUUID();
            const tNo = String(t.tableNo || String(idx + 1).padStart(2, "0")).trim();
            const tZone = String(t.zone || "MAIN ROOM").trim();
            const qrToken = encodeTableToken(bSlug || rawBranchId, tNo);

            await query(
              `INSERT INTO branch_tables (id, restaurant_id, branch_id, table_no, table_number, name, zone, location, sort_order, qr_token, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
                 restaurant_id = VALUES(restaurant_id),
                 branch_id = VALUES(branch_id),
                 table_no = VALUES(table_no),
                 table_number = VALUES(table_number),
                 name = VALUES(name),
                 zone = VALUES(zone),
                 location = VALUES(location),
                 sort_order = VALUES(sort_order),
                 qr_token = VALUES(qr_token),
                 status = VALUES(status)`,
              [
                tableId,
                tenant.restaurantId,
                canonicalBranchId,
                tNo,
                tNo,
                tNo,
                tZone,
                tZone,
                idx,
                qrToken,
                "available",
              ],
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Branch tables saved successfully",
              count: tables.length,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to save branch tables";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
