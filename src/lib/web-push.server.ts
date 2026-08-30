import webpush from "web-push";
import { query } from "./mysql";

// Default VAPID Credentials (configured in .env)
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@amenuverse.com";
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BFCWjOYUAdv3FqiTopV07F48-nmqk7g-NJkkd-1ZU4XVwhXSXirasbeJpi8qEMIj50WKQ6h8lay1wOGKWxuGhjM";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "B1I9rS45u6FduvwqgphLUHtE9P4_Htxw7_T2yv86jH4";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("[WebPush Init Warning]", err);
}

export type PushNotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  sound?: "chime" | "kitchen-bell" | "cash-register" | "ping" | "urgent" | string;
  unreadCount?: number;
  vibrate?: number[];
  tag?: string;
  orderId?: string;
  data?: Record<string, unknown>;
};

export type PushTargetFilter = {
  restaurantId: number | string;
  branchId?: string | null;
  roles?: string[];
  userId?: string | null;
};

/**
 * Persists a client Web Push subscription in MySQL
 */
export async function savePushSubscriptionServer(params: {
  restaurantId: number | string;
  branchId?: string | null;
  userId?: string | null;
  role?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const restId = Number(params.restaurantId) || 1;

  await query(
    `INSERT INTO push_subscriptions 
      (id, restaurant_id, branch_id, user_id, role, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
      restaurant_id = VALUES(restaurant_id),
      branch_id = VALUES(branch_id),
      user_id = VALUES(user_id),
      role = VALUES(role),
      p256dh = VALUES(p256dh),
      auth = VALUES(auth),
      user_agent = VALUES(user_agent),
      updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      restId,
      params.branchId || null,
      params.userId || null,
      params.role || null,
      params.endpoint,
      params.p256dh,
      params.auth,
      params.userAgent || null,
    ],
  );
}

/**
 * Removes an expired or unsubscribed push subscription
 */
export async function deletePushSubscriptionServer(endpoint: string): Promise<void> {
  await query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
}

/**
 * Dispatches Web Push Notifications to targeted staff/customers
 */
export async function sendPushNotificationServer(
  filter: PushTargetFilter,
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number }> {
  try {
    let sql = "SELECT * FROM push_subscriptions WHERE restaurant_id = ?";
    const params: unknown[] = [Number(filter.restaurantId) || 1];

    if (filter.branchId) {
      sql += " AND (branch_id = ? OR branch_id IS NULL)";
      params.push(filter.branchId);
    }

    if (filter.userId) {
      sql += " AND user_id = ?";
      params.push(filter.userId);
    } else if (filter.roles && filter.roles.length > 0) {
      const placeholders = filter.roles.map(() => "?").join(", ");
      sql += ` AND (LOWER(role) IN (${placeholders}) OR role IS NULL)`;
      params.push(...filter.roles.map((r) => r.toLowerCase()));
    }

    const subscriptions = await query<
      Array<{
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }>
    >(sql, params);

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      url: payload.url || "/orders",
      sound: payload.sound || "chime",
      unreadCount: typeof payload.unreadCount === "number" ? payload.unreadCount : 1,
      vibrate: payload.vibrate || [200, 100, 200, 100, 400],
      tag: payload.tag || `order-alert-${Date.now()}`,
      orderId: payload.orderId,
      data: payload.data || {},
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload);
          sent++;
        } catch (err: unknown) {
          failed++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // 404 or 410 indicates the push subscription has expired on the browser side
          if (statusCode === 404 || statusCode === 410) {
            await deletePushSubscriptionServer(sub.endpoint).catch(() => {});
          }
        }
      }),
    );

    return { sent, failed };
  } catch (err) {
    console.error("[WebPush Dispatch Error]", err);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Broadcasts system-wide announcements to targeted audiences via Web Push
 */
export async function sendSystemAnnouncementPushServer(params: {
  title: string;
  body: string;
  audience?: "all" | "owners" | "staff" | string;
  sound?: string;
  url?: string;
  restaurantId?: number | string;
}): Promise<{ sent: number; failed: number }> {
  try {
    let sql = "SELECT * FROM push_subscriptions WHERE 1=1";
    const sqlParams: unknown[] = [];

    if (params.restaurantId && params.restaurantId !== "all") {
      sql += " AND restaurant_id = ?";
      sqlParams.push(Number(params.restaurantId));
    }

    if (params.audience === "owners") {
      sql += " AND LOWER(role) = 'owner'";
    } else if (params.audience === "staff") {
      sql += " AND LOWER(role) IN ('manager', 'cashier', 'chef', 'waiter', 'host')";
    }

    const subscriptions = await query<
      Array<{
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }>
    >(sql, sqlParams);

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: `📢 ${params.title}`,
      body: params.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      url: params.url || "/dashboard",
      sound: params.sound || "chime",
      unreadCount: 1,
      vibrate: [300, 150, 300, 150, 500],
      tag: `announcement-${Date.now()}`,
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload);
          sent++;
        } catch (err: unknown) {
          failed++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await deletePushSubscriptionServer(sub.endpoint).catch(() => {});
          }
        }
      }),
    );

    return { sent, failed };
  } catch (err) {
    console.error("[WebPush Announcement Error]", err);
    return { sent: 0, failed: 0 };
  }
}

