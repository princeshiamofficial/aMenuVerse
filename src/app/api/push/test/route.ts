import { NextRequest, NextResponse } from "next/server";
import { sendPushNotificationServer } from "@/lib/web-push.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId = 1,
      branchId,
      sound = "kitchen-bell",
      title = "🛎️ Kitchen Order Test",
      message = "Custom Web Push notification with chime audio and badge count!",
      unreadCount = 3,
    } = body;

    const result = await sendPushNotificationServer(
      { restaurantId, branchId },
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
