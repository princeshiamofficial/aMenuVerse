import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getCurrentUser, signToken, JWTPayload } from "@/lib/auth";

interface UserRow {
  id: number;
  name: string;
  email: string;
}

interface DbUserRow {
  password_hash: string;
}

interface EmailCheckRow {
  id: number;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await query<UserRow[]>("SELECT id, name, email FROM users WHERE id = ?", [
      user.id,
    ]);

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: users[0].name,
      email: users[0].email,
    });
  } catch (err) {
    console.error("Account details GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, currentPassword, newPassword } = await req.json();

    if (!email || !currentPassword) {
      return NextResponse.json(
        { error: "Email and current password are required" },
        { status: 400 },
      );
    }

    // Retrieve user from DB to get the current password hash
    const dbUsers = await query<DbUserRow[]>("SELECT password_hash FROM users WHERE id = ?", [
      user.id,
    ]);

    if (dbUsers.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dbUser = dbUsers[0];

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, dbUser.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // If email is changing, verify it is not already taken
    if (trimmedEmail !== user.email.toLowerCase().trim()) {
      const emailChecks = await query<EmailCheckRow[]>(
        "SELECT id FROM users WHERE LOWER(email) = ? AND id != ?",
        [trimmedEmail, user.id],
      );
      if (emailChecks.length > 0) {
        return NextResponse.json(
          { error: "Email is already in use by another account" },
          { status: 400 },
        );
      }
    }

    let passwordHash = dbUser.password_hash;
    if (newPassword && newPassword.trim() !== "") {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long" },
          { status: 400 },
        );
      }
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // Update in database
    await query("UPDATE users SET email = ?, password_hash = ? WHERE id = ?", [
      trimmedEmail,
      passwordHash,
      user.id,
    ]);

    // Re-sign new JWT token with updated email
    const payload: JWTPayload = {
      ...user,
      email: trimmedEmail,
    };

    const token = await signToken(payload);

    const response = NextResponse.json({
      success: true,
      message: "Account details updated successfully",
    });

    // Set updated token in cookies
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (err) {
    console.error("Account details PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
