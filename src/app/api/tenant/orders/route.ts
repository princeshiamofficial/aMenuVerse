import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET: Retrieve list of orders for the tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let orders;
    // If the user is a manager with a specific assigned branch, filter by branch
    if (user.role === "manager" && user.assignedBranchId) {
      orders = await query<any[]>(
        `SELECT o.id, o.restaurant_id as restaurantId, o.branch_id as branchId, 
                o.table_name as \`table\`, o.items, o.status, o.total, o.created_at as time,
                b.name as branchName
         FROM orders o
         JOIN branches b ON o.branch_id = b.id
         WHERE o.restaurant_id = ? AND o.branch_id = ?
         ORDER BY o.created_at DESC`,
        [user.restaurantId, user.assignedBranchId],
      );
    } else {
      orders = await query<any[]>(
        `SELECT o.id, o.restaurant_id as restaurantId, o.branch_id as branchId, 
                o.table_name as \`table\`, o.items, o.status, o.total, o.created_at as time,
                b.name as branchName
         FROM orders o
         JOIN branches b ON o.branch_id = b.id
         WHERE o.restaurant_id = ?
         ORDER BY o.created_at DESC`,
        [user.restaurantId],
      );
    }

    // Parse JSON items
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      branchName: order.branchName,
      table: order.table,
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items,
      status: order.status,
      total: parseFloat(order.total),
      time: order.time,
    }));

    return NextResponse.json(formattedOrders);
  } catch (err: any) {
    console.error("Tenant orders GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Public endpoint to submit a customer order via QR code scanning
export async function POST(req: NextRequest) {
  try {
    const { restaurantId, branchId, table, items, total } = await req.json();

    if (!restaurantId || !branchId || !table || !items || !total) {
      return NextResponse.json({ error: "Missing order details" }, { status: 400 });
    }

    // Check if branch exists and belongs to restaurant
    const branches = await query<any[]>(
      "SELECT id FROM branches WHERE id = ? AND restaurant_id = ?",
      [branchId, restaurantId],
    );

    if (branches.length === 0) {
      return NextResponse.json({ error: "Invalid branch selection" }, { status: 400 });
    }

    // Generate readable order ID (e.g. ORD-12345)
    const orderId = `ORD-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    await query(
      `INSERT INTO orders (id, restaurant_id, branch_id, table_name, items, status, total) 
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      [orderId, restaurantId, branchId, table, JSON.stringify(items), total],
    );

    return NextResponse.json({
      success: true,
      orderId,
      message: "Order submitted successfully",
    });
  } catch (err: any) {
    console.error("Submit order POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update order status (authenticated tenant staff only)
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify ownership and manager branch bounds
    const orders = await query<any[]>(
      "SELECT id, branch_id FROM orders WHERE id = ? AND restaurant_id = ?",
      [id, user.restaurantId],
    );

    if (orders.length === 0) {
      return NextResponse.json({ error: "Order not found or unauthorized" }, { status: 404 });
    }

    const order = orders[0];

    // Managers can only update orders of their assigned branch
    if (
      user.role === "manager" &&
      user.assignedBranchId &&
      order.branch_id !== user.assignedBranchId
    ) {
      return NextResponse.json({ error: "Access denied to this branch's orders" }, { status: 403 });
    }

    await query("UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?", [
      status,
      id,
      user.restaurantId,
    ]);

    return NextResponse.json({ success: true, message: "Order status updated successfully" });
  } catch (err: any) {
    console.error("Update order PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
