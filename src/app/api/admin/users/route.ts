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

export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await query<Record<string, unknown>[]>(
      `SELECT u.id, u.name, u.email, u.role, u.restaurant_id as restaurantId, 
              r.name as restaurantName, u.assigned_branch_id as assignedBranchId, 
              u.avatar, u.status, u.created_at
       FROM users u
       LEFT JOIN restaurants r ON u.restaurant_id = r.id
       ORDER BY u.id DESC`,
    );

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        ...u,
        restaurantId: u.restaurantId ? parseInt(String(u.restaurantId), 10) : null,
      })),
    });
  } catch (err) {
    console.error("Admin users GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, email, password, role, restaurantId, avatar, status } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await query<{ id: number }[]>("SELECT id FROM users WHERE LOWER(email) = ?", [
      email.toLowerCase().trim(),
    ]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    // Hash Password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const finalRestaurantId =
      restaurantId === "" || restaurantId === null ? null : parseInt(restaurantId, 10);

    await query(
      `INSERT INTO users (restaurant_id, name, email, password_hash, role, avatar, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        finalRestaurantId,
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        role,
        avatar || null,
        status || "Active",
      ],
    );

    return NextResponse.json({
      success: true,
      message: "User created successfully",
    });
  } catch (err) {
    console.error("Admin user POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
