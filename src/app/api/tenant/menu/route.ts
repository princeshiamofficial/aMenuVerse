import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateTenantCache } from "@/lib/redis";

// GET: List all menu items for the logged-in tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const menuItems = await query<any[]>(
      "SELECT id, name, description, price, image, category, popular FROM menu_items WHERE restaurant_id = ? ORDER BY id DESC",
      [user.restaurantId],
    );

    const formatted = menuItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      image: item.image,
      category: item.category,
      popular: item.popular === 1,
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("Tenant menu GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add new menu item
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, price, image, category, popular } = await req.json();

    if (!name || price === undefined || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await query<any>(
      `INSERT INTO menu_items (restaurant_id, name, description, price, image, category, popular) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.restaurantId, name, description || "", price, image || "", category, popular ? 1 : 0],
    );

    // Invalidate Redis cache
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({
      success: true,
      id: result.insertId,
      message: "Menu item created successfully",
    });
  } catch (err: any) {
    console.error("Tenant menu POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update menu item
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, price, image, category, popular } = await req.json();

    if (!id || !name || price === undefined || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const items = await query<any[]>(
      "SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?",
      [id, user.restaurantId],
    );
    if (items.length === 0) {
      return NextResponse.json({ error: "Menu item not found or unauthorized" }, { status: 404 });
    }

    await query(
      `UPDATE menu_items SET name = ?, description = ?, price = ?, image = ?, category = ?, popular = ? 
       WHERE id = ? AND restaurant_id = ?`,
      [
        name,
        description || "",
        price,
        image || "",
        category,
        popular ? 1 : 0,
        id,
        user.restaurantId,
      ],
    );

    // Invalidate Redis cache
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Menu item updated successfully" });
  } catch (err: any) {
    console.error("Tenant menu PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete menu item
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
    const items = await query<any[]>(
      "SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?",
      [id, user.restaurantId],
    );
    if (items.length === 0) {
      return NextResponse.json({ error: "Menu item not found or unauthorized" }, { status: 404 });
    }

    await query("DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?", [
      id,
      user.restaurantId,
    ]);

    // Invalidate Redis cache
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Menu item deleted successfully" });
  } catch (err: any) {
    console.error("Tenant menu DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
