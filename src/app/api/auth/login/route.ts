import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, JWTPayload } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Query user and join restaurant to get the tenant username
    const users = await query<any[]>(
      `SELECT u.*, r.username as restaurantUsername 
       FROM users u 
       LEFT JOIN restaurants r ON u.restaurant_id = r.id 
       WHERE LOWER(u.email) = ?`,
      [email.toLowerCase().trim()],
    );

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = users[0];

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify Account Status
    if (user.status === "Banned" || user.status === "Inactive") {
      return NextResponse.json(
        {
          error: `Your account is ${user.status.toLowerCase()}. Please contact your administrator.`,
        },
        { status: 403 },
      );
    }

    // Generate JWT payload
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurant_id,
      restaurantUsername: user.restaurantUsername || null,
      assignedBranchId: user.assigned_branch_id || null,
    };

    const token = await signToken(payload);

    // Create Response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurant_id,
        restaurantUsername: user.restaurantUsername || null,
        assignedBranchId: user.assigned_branch_id || null,
      },
    });

    // Set Token Cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
