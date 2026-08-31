import { NextRequest, NextResponse } from "next/server";
import { sendPushNotificationServer } from "@/lib/web-push.server";
import { verifySession } from "@/lib/auth.server";
import { checkRateLimitAsync } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Authentication
    const session = await verifySession();
    if (!session || !session.id) {
      return NextResponse.json(
        { error: "Unauthorized. You must be signed in to send push alerts." },
        { status: 401 },
      );
    }

    // 2. Enforce Role-Based Access Control
    const allowedRoles = ["super_admin", "owner", "manager", "cashier", "chef", "waiter", "host"];
    if (!allowedRoles.includes(session.role?.toLowerCase() || "")) {
      return NextResponse.json(
        { error: "Forbidden. Insufficient permissions to test push notifications." },
        { status: 403 },
      );
    }

    // 3. Rate Limit per User
    await checkRateLimitAsync("push_test_alert", session.id, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });

    const body = await req.json();
    const {
      branchId,
      sound = "kitchen-bell",
      title = "🛎️ Kitchen Order Test",
      message = "Custom Web Push notification with chime audio and badge count!",
      unreadCount = 3,
    } = body;

    // 4. Authoritative Restaurant ID from Session (Super admins can override)
    const effectiveRestaurantId =
      session.role === "super_admin" && body.restaurantId
        ? body.restaurantId
        : session.restaurant_id || 1;

    const result = await sendPushNotificationServer(
      { restaurantId: effectiveRestaurantId, branchId: branchId || session.branch },
      {
        title,
        body: message,
        sound,
        unreadCount,
        url: "/orders",
      },
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || "Push test failed" },
      { status: 500 },
    );
  }
}
