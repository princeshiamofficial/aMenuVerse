import { NextRequest, NextResponse } from "next/server";
import { savePushSubscriptionServer, deletePushSubscriptionServer } from "@/lib/web-push.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, branchId, userId, role, endpoint, p256dh, auth, userAgent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "endpoint, p256dh, and auth are required." },
        { status: 400 },
      );
    }

    await savePushSubscriptionServer({
      restaurantId: restaurantId || 1,
      branchId,
      userId,
      role,
      endpoint,
      p256dh,
      auth,
      userAgent,
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
