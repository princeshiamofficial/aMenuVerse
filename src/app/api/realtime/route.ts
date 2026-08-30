import { realtimeHub } from "@/lib/realtime.server";
import { verifySession } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let restaurantId = url.searchParams.get("restaurantId") || "";
  let branchId = url.searchParams.get("branchId") || "";

  if (!restaurantId) {
    try {
      const session = await verifySession();
      if (session?.restaurant_id) {
        restaurantId = String(session.restaurant_id);
      }
      if (session?.branch && !branchId) {
        branchId = String(session.branch);
      }
    } catch {
      /* allow query params for guest sessions */
    }
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
