import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

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
    const { name, email, password, role, restaurantId, avatar, status } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if another user has this email
    const existing = await query<{ id: number }[]>(
      "SELECT id FROM users WHERE LOWER(email) = ? AND id != ?",
      [email.toLowerCase().trim(), id],
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const finalRestaurantId =
      restaurantId === "" || restaurantId === null ? null : parseInt(restaurantId, 10);

    if (password && password.trim().length >= 6) {
      // Re-hash and update password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      await query(
        `UPDATE users SET 
          name = ?, email = ?, password_hash = ?, role = ?, 
          restaurant_id = ?, avatar = ?, status = ?
         WHERE id = ?`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          passwordHash,
          role,
          finalRestaurantId,
          avatar || null,
          status || "Active",
          id,
        ],
      );
    } else {
      // Update without password change
      await query(
        `UPDATE users SET 
          name = ?, email = ?, role = ?, 
          restaurant_id = ?, avatar = ?, status = ?
         WHERE id = ?`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          role,
          finalRestaurantId,
          avatar || null,
          status || "Active",
          id,
        ],
      );
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error("Admin user PUT error:", err);
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

    // Prevent a system admin from deleting themselves
    const currentUser = await getCurrentUser(req);
    if (currentUser && currentUser.id === parseInt(id, 10)) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    await query("DELETE FROM users WHERE id = ?", [id]);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Admin user DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
