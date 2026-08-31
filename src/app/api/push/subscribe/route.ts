import { NextRequest, NextResponse } from "next/server";
import { savePushSubscriptionServer, deletePushSubscriptionServer } from "@/lib/web-push.server";
import { verifySession } from "@/lib/auth.server";
import { checkRateLimitAsync } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await checkRateLimitAsync("push_subscribe", ip, {
      maxRequests: 30,
      windowMs: 60 * 1000,
    });

    const body = await req.json();
    const { branchId, endpoint, p256dh, auth, userAgent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "endpoint, p256dh, and auth are required." },
        { status: 400 },
      );
    }

    // Bind session context if authenticated
    const session = await verifySession().catch(() => null);

    const effectiveRestaurantId = session?.restaurant_id || body.restaurantId || 1;
    const effectiveUserId = session?.id || body.userId;
    const effectiveRole = session?.role || body.role;
    const effectiveBranchId = session?.branch || branchId;

    await savePushSubscriptionServer({
      restaurantId: effectiveRestaurantId,
      branchId: effectiveBranchId,
      userId: effectiveUserId,
      role: effectiveRole,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent || req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to save push subscription" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
    }

    await deletePushSubscriptionServer(endpoint);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete push subscription" },
      { status: 500 },
    );
  }
}
