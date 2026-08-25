import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

async function checkAdminAuth(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || (user.restaurantId !== null && user.role !== "system_admin")) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantCountRes = await query<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM restaurants",
    );
    const branchCountRes = await query<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM branches",
    );
    const menuItemCountRes = await query<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM menu_items",
    );
    const orderCountRes = await query<{ count: number }[]>("SELECT COUNT(*) AS count FROM orders");
    const revenueRes = await query<{ total: string | null }[]>(
      "SELECT SUM(total) AS total FROM orders WHERE status != 'Cancelled'",
    );

    return NextResponse.json({
      success: true,
      stats: {
        restaurants: restaurantCountRes[0]?.count || 0,
        branches: branchCountRes[0]?.count || 0,
        menuItems: menuItemCountRes[0]?.count || 0,
        orders: orderCountRes[0]?.count || 0,
        revenue: parseFloat(revenueRes[0]?.total || "0"),
      },
    });
  } catch (err) {
    console.error("Admin stats GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
