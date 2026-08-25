import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { invalidateTenantCache } from "@/lib/redis";

async function checkAdminAuth(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || (user.restaurantId !== null && user.role !== "system_admin")) {
    return false;
  }
  return true;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      name,
      username,
      cuisine,
      price,
      time,
      location,
      phone,
      operating_hours,
      facilities,
      image,
      logo_image,
    } = body;

    if (!name || !username) {
      return NextResponse.json({ error: "Name and Username slug are required" }, { status: 400 });
    }

    const cleanUsername = username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, "");

    // Check if another restaurant has this username slug
    const existing = await query<{ id: number }[]>(
      "SELECT id FROM restaurants WHERE username = ? AND id != ?",
      [cleanUsername, id],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A restaurant with this username slug already exists" },
        { status: 409 },
      );
    }

    // Get current username slug to invalidate cache later
    const currentRes = await query<{ username: string }[]>(
      "SELECT username FROM restaurants WHERE id = ?",
      [id],
    );
    if (currentRes.length === 0) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const currentUsername = currentRes[0].username;

    await query(
      `UPDATE restaurants SET 
        name = ?, username = ?, cuisine = ?, price = ?, time = ?, 
        location = ?, phone = ?, operating_hours = ?, facilities = ?, 
        image = ?, logo_image = ?
       WHERE id = ?`,
      [
        name.trim(),
        cleanUsername,
        cuisine || "",
        price || "$$",
        time || "20-30 min",
        location || "",
        phone || "",
        operating_hours || "",
        facilities || "",
        image || "",
        logo_image || "",
        id,
      ],
    );

    // Invalidate Redis cache for both the old and new usernames
    try {
      await invalidateTenantCache(currentUsername);
      if (currentUsername !== cleanUsername) {
        await invalidateTenantCache(cleanUsername);
      }
    } catch (cacheErr) {
      console.error("Failed to invalidate tenant cache:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      message: "Restaurant updated successfully",
    });
  } catch (err) {
    console.error("Admin restaurant PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get username to invalidate cache before deleting
    const currentRes = await query<{ username: string }[]>(
      "SELECT username FROM restaurants WHERE id = ?",
      [id],
    );
    if (currentRes.length === 0) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const currentUsername = currentRes[0].username;

    // Delete restaurant
    await query("DELETE FROM restaurants WHERE id = ?", [id]);

    // Invalidate Redis cache
    try {
      await invalidateTenantCache(currentUsername);
    } catch (cacheErr) {
      console.error("Failed to invalidate tenant cache on delete:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (err) {
    console.error("Admin restaurant DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
