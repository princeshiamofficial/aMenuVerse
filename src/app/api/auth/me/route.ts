import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isTokenBlacklisted } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Check blacklist in Redis
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return NextResponse.json(
        { authenticated: false, error: "Token is revoked" },
        { status: 401 },
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (err: any) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
