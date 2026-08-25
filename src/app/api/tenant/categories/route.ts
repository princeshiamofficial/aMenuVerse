import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateTenantCache } from "@/lib/redis";

// GET: List all categories for the logged-in tenant with dynamic item counts
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await query<Record<string, unknown>[]>(
      `SELECT c.id, c.name, c.description, c.emoji, COUNT(m.id) as itemCount
       FROM categories c
       LEFT JOIN menu_items m ON c.name = m.category AND c.restaurant_id = m.restaurant_id
       WHERE c.restaurant_id = ?
       GROUP BY c.id, c.name, c.description, c.emoji
       ORDER BY c.id DESC`,
      [user.restaurantId],
    );

    const formatted = categories.map((cat) => ({
      id: `CAT-${String(cat.id).padStart(3, "0")}`,
      rawId: cat.id as number,
      name: cat.name as string,
      description: (cat.description as string) || "",
      emoji: (cat.emoji as string) || "hamburger",
      itemCount: parseInt((cat.itemCount as string) || "0", 10),
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Tenant categories GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add new category
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, emoji } = body;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Check duplicate
    const existing = await query<Record<string, unknown>[]>(
      "SELECT id FROM categories WHERE restaurant_id = ? AND name = ?",
      [user.restaurantId, name.trim()],
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO categories (restaurant_id, name, description, emoji) 
       VALUES (?, ?, ?, ?)`,
      [user.restaurantId, name.trim(), description || "", emoji || "hamburger"],
    );

    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({
      success: true,
      id: `CAT-${String(result.insertId).padStart(3, "0")}`,
      rawId: result.insertId,
      message: "Category created successfully",
    });
  } catch (err) {
    console.error("Tenant categories POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update category (name, description, emoji)
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, emoji } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Strip "CAT-" prefix if present to get the raw INT id
    const rawId =
      typeof id === "string" && id.startsWith("CAT-")
        ? parseInt(id.replace("CAT-", ""), 10)
        : parseInt(id, 10);

    // Verify ownership and get old name
    const cats = await query<Record<string, unknown>[]>(
      "SELECT name FROM categories WHERE id = ? AND restaurant_id = ?",
      [rawId, user.restaurantId],
    );
    if (cats.length === 0) {
      return NextResponse.json({ error: "Category not found or unauthorized" }, { status: 404 });
    }

    const oldName = cats[0].name as string;
    const newName = name.trim();

    // Check duplicate if name is changing
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      const existing = await query<Record<string, unknown>[]>(
        "SELECT id FROM categories WHERE restaurant_id = ? AND name = ? AND id != ?",
        [user.restaurantId, newName, rawId],
      );
      if (existing.length > 0) {
        return NextResponse.json(
          { error: "Another category with this name already exists" },
          { status: 400 },
        );
      }
    }

    // Update categories table
    await query(
      `UPDATE categories SET name = ?, description = ?, emoji = ? 
       WHERE id = ? AND restaurant_id = ?`,
      [newName, description || "", emoji || "hamburger", rawId, user.restaurantId],
    );

    // If the category name changed, update all corresponding menu items
    if (oldName !== newName) {
      await query(
        `UPDATE menu_items SET category = ? 
         WHERE category = ? AND restaurant_id = ?`,
        [newName, oldName, user.restaurantId],
      );
    }

    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Category updated successfully" });
  } catch (err) {
    console.error("Tenant categories PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete category
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

    const rawId =
      typeof id === "string" && id.startsWith("CAT-")
        ? parseInt(id.replace("CAT-", ""), 10)
        : parseInt(id, 10);

    // Verify ownership and get name
    const cats = await query<Record<string, unknown>[]>(
      "SELECT name FROM categories WHERE id = ? AND restaurant_id = ?",
      [rawId, user.restaurantId],
    );
    if (cats.length === 0) {
      return NextResponse.json({ error: "Category not found or unauthorized" }, { status: 404 });
    }

    const catName = cats[0].name as string;

    // Delete category
    await query("DELETE FROM categories WHERE id = ? AND restaurant_id = ?", [
      rawId,
      user.restaurantId,
    ]);

    // Also delete all menu items in this category
    await query("DELETE FROM menu_items WHERE category = ? AND restaurant_id = ?", [
      catName,
      user.restaurantId,
    ]);

    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("Tenant categories DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
