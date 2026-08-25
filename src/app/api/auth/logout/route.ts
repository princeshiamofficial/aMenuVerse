import { NextRequest, NextResponse } from "next/server";
import { blacklistToken } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth_token")?.value;

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });

    // Revoke cookie
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0), // set expiry to Unix epoch to delete
    });

    // Blacklist token in Redis
    if (token) {
      // Set blacklist TTL to 24 hours (matching maximum token age)
      await blacklistToken(token, 24 * 60 * 60);
    }

    return response;
  } catch (err: any) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
