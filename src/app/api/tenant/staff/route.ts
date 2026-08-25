import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET: List all staff for the logged-in tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = await query<any[]>(
      "SELECT id, name, email, role, assigned_branch_id as assignedBranchId, avatar, status FROM users WHERE restaurant_id = ? ORDER BY id DESC",
      [user.restaurantId],
    );

    return NextResponse.json(staff);
  } catch (err: any) {
    console.error("Tenant staff GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add new staff member
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, email, password, role, assignedBranchId, avatar, status } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await query<any[]>("SELECT id FROM users WHERE LOWER(email) = ?", [
      email.toLowerCase().trim(),
    ]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    // Hash Password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await query(
      `INSERT INTO users (restaurant_id, name, email, password_hash, role, assigned_branch_id, avatar, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.restaurantId,
        name,
        email.toLowerCase().trim(),
        passwordHash,
        role,
        assignedBranchId || null,
        avatar || null,
        status || "Active",
      ],
    );

    return NextResponse.json({ success: true, message: "Staff member added successfully" });
  } catch (err: any) {
    console.error("Tenant staff POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update existing staff member
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, email, role, assignedBranchId, password, avatar, status } = await req.json();

    if (!id || !name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const targets = await query<any[]>("SELECT id FROM users WHERE id = ? AND restaurant_id = ?", [
      id,
      user.restaurantId,
    ]);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Staff member not found or unauthorized" },
        { status: 404 },
      );
    }

    if (password && password.trim() !== "") {
      // Update with new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      await query(
        `UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, assigned_branch_id = ?, avatar = ?, status = ? 
         WHERE id = ? AND restaurant_id = ?`,
        [
          name,
          email.toLowerCase().trim(),
          passwordHash,
          role,
          assignedBranchId || null,
          avatar || null,
          status || "Active",
          id,
          user.restaurantId,
        ],
      );
    } else {
      // Update details only
      await query(
        `UPDATE users SET name = ?, email = ?, role = ?, assigned_branch_id = ?, avatar = ?, status = ? 
         WHERE id = ? AND restaurant_id = ?`,
        [
          name,
          email.toLowerCase().trim(),
          role,
          assignedBranchId || null,
          avatar || null,
          status || "Active",
          id,
          user.restaurantId,
        ],
      );
    }

    return NextResponse.json({ success: true, message: "Staff member updated successfully" });
  } catch (err: any) {
    console.error("Tenant staff PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Remove staff member
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

    const targetId = parseInt(id, 10);

    // Prevent deleting oneself
    if (targetId === user.id) {
      return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
    }

    // Verify ownership
    const targets = await query<any[]>("SELECT id FROM users WHERE id = ? AND restaurant_id = ?", [
      targetId,
      user.restaurantId,
    ]);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Staff member not found or unauthorized" },
        { status: 404 },
      );
    }

    await query("DELETE FROM users WHERE id = ? AND restaurant_id = ?", [
      targetId,
      user.restaurantId,
    ]);

    return NextResponse.json({ success: true, message: "Staff member deleted successfully" });
  } catch (err: any) {
    console.error("Tenant staff DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
