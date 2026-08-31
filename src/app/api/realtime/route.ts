import { realtimeHub } from "@/lib/realtime.server";
import { verifySession } from "@/lib/auth.server";
import { decodeTableToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reqRestaurantId = url.searchParams.get("restaurantId") || "";
  const reqBranchId = url.searchParams.get("branchId") || "";
  const tableToken = url.searchParams.get("token") || url.searchParams.get("tableToken") || "";

  let restaurantId = "";
  let branchId = "";

  // 1. Check Authenticated Staff / Admin Session
  try {
    const session = await verifySession();
    if (session?.restaurant_id) {
      restaurantId = String(session.restaurant_id);
      // Global admins/owners can listen across branches; operational staff locked to their branch
      if (session.role === "owner" || session.role === "super_admin") {
        branchId = reqBranchId || String(session.branch || "");
      } else {
        branchId = String(session.branch || "");
      }
    }
  } catch {
    /* No active staff session */
  }

  // 2. If guest session, require a verified table QR token or explicit restaurant context
  if (!restaurantId && tableToken) {
    const decoded = decodeTableToken(tableToken);
    if (decoded) {
      restaurantId = reqRestaurantId || "1";
      branchId = decoded.branchSlug || reqBranchId;
    }
  }

  // 3. Fallback for public restaurant menu guests (with explicit tenant identification)
  if (!restaurantId && reqRestaurantId) {
    restaurantId = reqRestaurantId;
    branchId = reqBranchId;
  }

  // 4. Reject unauthenticated anonymous connections without any tenant/table context
  if (!restaurantId) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing restaurant or table context" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      realtimeHub.registerClient(clientId, restaurantId, branchId, controller);
    },
    cancel() {
      realtimeHub.unregisterClient(clientId);
    },
  });

  request.signal?.addEventListener("abort", () => {
    realtimeHub.unregisterClient(clientId);
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
