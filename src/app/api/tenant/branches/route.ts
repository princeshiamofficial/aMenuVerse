import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateTenantCache } from "@/lib/redis";

// GET: List all branches + tables for the tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branches = await query<any[]>(
      "SELECT id, name, location, phone, operating_hours FROM branches WHERE restaurant_id = ?",
      [user.restaurantId],
    );

    const branchesWithTables = [];
    for (const b of branches) {
      const tables = await query<any[]>(
        "SELECT name, location, status FROM branch_tables WHERE branch_id = ?",
        [b.id],
      );
      branchesWithTables.push({
        id: b.id,
        name: b.name,
        location: b.location,
        phone: b.phone,
        operatingHours: b.operating_hours,
        tables: tables.map((t: any) => ({
          name: t.name,
          location: t.location,
          status: t.status,
        })),
      });
    }

    return NextResponse.json(branchesWithTables);
  } catch (err: any) {
    console.error("Tenant branches GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add or Update a branch and its tables (Upsert)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, location, phone, operatingHours, tables } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });
    }

    const existing = await query<any[]>(
      "SELECT id FROM branches WHERE id = ? AND restaurant_id = ?",
      [id, user.restaurantId],
    );

    if (existing.length > 0) {
      // Update existing branch
      await query(
        `UPDATE branches SET name = ?, location = ?, phone = ?, operating_hours = ? 
         WHERE id = ? AND restaurant_id = ?`,
        [name, location || "", phone || "", operatingHours || "", id, user.restaurantId],
      );
      // Clear existing tables to re-sync
      await query("DELETE FROM branch_tables WHERE branch_id = ?", [id]);
    } else {
      // Insert new branch
      await query(
        `INSERT INTO branches (id, restaurant_id, name, location, phone, operating_hours) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, user.restaurantId, name, location || "", phone || "", operatingHours || ""],
      );
    }

    // Insert Tables if provided
    if (tables && Array.isArray(tables)) {
      for (const t of tables) {
        await query(
          `INSERT INTO branch_tables (branch_id, name, location, status) VALUES (?, ?, ?, ?)`,
          [id, t.name, t.location || "", t.status || "Active"],
        );
      }
    }

    // Invalidate Redis cache
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Branch synchronized successfully" });
  } catch (err: any) {
    console.error("Tenant branches POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete a branch
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify ownership
    const branches = await query<any[]>(
      "SELECT id FROM branches WHERE id = ? AND restaurant_id = ?",
      [id, user.restaurantId],
    );
    if (branches.length === 0) {
      return NextResponse.json({ error: "Branch not found or unauthorized" }, { status: 404 });
    }

    await query("DELETE FROM branches WHERE id = ? AND restaurant_id = ?", [id, user.restaurantId]);

    // Invalidate Redis cache
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Branch deleted successfully" });
  } catch (err: any) {
    console.error("Tenant branches DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
