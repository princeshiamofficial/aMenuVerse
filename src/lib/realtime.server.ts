/**
 * aMenuVerse Real-Time Server Event Hub
 *
 * Provides persistent multi-tenant Server-Sent Events (SSE) & WebSocket-grade
 * real-time event broadcasting partitioned by restaurantId and branchId.
 */

export type RealtimeEventType =
  | "order:created"
  | "order:updated"
  | "order:deleted"
  | "waiter:called"
  | "waiter:resolved"
  | "reservation:created"
  | "reservation:updated"
  | "reservation:deleted"
  | "table:updated"
  | "announcement:created"
  | "ping";

export interface RealtimeEvent<T = unknown> {
  id: string;
  type: RealtimeEventType;
  restaurantId: string | number;
  branchId?: string | null;
  payload: T;
  timestamp: string;
}

interface RealtimeClient {
  id: string;
  restaurantId: string;
  branchId?: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  connectedAt: number;
}

class RealtimeHub {
  private static instance: RealtimeHub;
  private clients: Map<string, RealtimeClient> = new Map();
  private encoder: TextEncoder = new TextEncoder();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): RealtimeHub {
    if (!RealtimeHub.instance) {
      RealtimeHub.instance = new RealtimeHub();
    }
    return RealtimeHub.instance;
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.broadcastPing();
    }, 25000);
  }

  private broadcastPing() {
    const pingBytes = this.encoder.encode(
      `event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
    );
    for (const [id, client] of this.clients.entries()) {
      try {
        client.controller.enqueue(pingBytes);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  public registerClient(
    id: string,
    restaurantId: string | number,
    branchId: string | undefined,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) {
    const normalizedRestId = String(restaurantId || "").trim();
    const normalizedBranchId = branchId ? String(branchId).trim() : undefined;

    this.clients.set(id, {
      id,
      restaurantId: normalizedRestId,
      branchId: normalizedBranchId,
      controller,
      connectedAt: Date.now(),
    });

    // Send instant connection confirmation event
    try {
      const welcome = this.encoder.encode(
        `event: connected\ndata: ${JSON.stringify({
          status: "connected",
          clientId: id,
          restaurantId: normalizedRestId,
          branchId: normalizedBranchId,
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );
      controller.enqueue(welcome);
    } catch {
      this.clients.delete(id);
    }
  }

  public unregisterClient(id: string) {
    this.clients.delete(id);
  }

  public broadcast<T = unknown>(params: {
    type: RealtimeEventType;
    restaurantId: string | number;
    tenantSlug?: string;
    branchId?: string | null;
    branchName?: string;
    payload: T;
  }) {
    const event: RealtimeEvent<T> = {
      id: crypto.randomUUID(),
      type: params.type,
      restaurantId: params.restaurantId,
      branchId: params.branchId,
      payload: params.payload,
      timestamp: new Date().toISOString(),
    };

    const targetRestId = String(params.restaurantId || "")
      .toLowerCase()
      .trim();
    const targetSlug = String(params.tenantSlug || "")
      .toLowerCase()
      .trim();
    const targetBranch = params.branchId ? String(params.branchId).toLowerCase().trim() : null;
    const targetBranchName = params.branchName
      ? String(params.branchName).toLowerCase().trim()
      : null;

    const eventPayload = `event: ${params.type}\ndata: ${JSON.stringify(event)}\n\n`;
    const bytes = this.encoder.encode(eventPayload);

    for (const [id, client] of this.clients.entries()) {
      // 1. Must match restaurant / tenant
      if (client.restaurantId) {
        const cRest = client.restaurantId.toLowerCase().trim();
        const matchesRest =
          !cRest ||
          cRest === "all" ||
          cRest === targetRestId ||
          (Boolean(targetSlug) && cRest === targetSlug) ||
          (Boolean(targetRestId) && cRest.includes(targetRestId)) ||
          (Boolean(targetSlug) && cRest.includes(targetSlug));

        if (!matchesRest) {
          continue;
        }
      }

      // 2. Branch isolation check
      if (client.branchId && client.branchId !== "all" && client.branchId !== "undefined") {
        const clientBranch = client.branchId.toLowerCase().trim();
        const clientBranchRaw = clientBranch.replace(/^branch-/, "");

        if (targetBranch) {
          const targetBranchRaw = targetBranch.replace(/^branch-/, "");
          const targetNameRaw = targetBranchName ? targetBranchName.replace(/^branch-/, "") : null;

          const branchMatches =
            clientBranch === targetBranch ||
            clientBranchRaw === targetBranchRaw ||
            (targetBranchName !== null &&
              (clientBranch === targetBranchName || clientBranchRaw === targetNameRaw));

          if (!branchMatches) {
            continue;
          }
        }
      }

      try {
        client.controller.enqueue(bytes);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = RealtimeHub.getInstance();

export function broadcastRealtimeEvent<T = unknown>(params: {
  type: RealtimeEventType;
  restaurantId: string | number;
  tenantSlug?: string;
  branchId?: string | null;
  branchName?: string;
  payload: T;
}) {
  try {
    realtimeHub.broadcast(params);
  } catch (err) {
    console.warn("[RealtimeHub] Failed to broadcast event:", err);
  }
}
