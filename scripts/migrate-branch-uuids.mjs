import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "amenuverse",
  port: 3306,
});

// 1. Get all branches with restaurant_id, id, name
const [branches] = await conn.execute("SELECT id, name, restaurant_id FROM branches");
console.log("Found branches:", branches);

// Helper to find branch UUID for a given restaurant and raw string
function findBranchId(restaurantId, raw) {
  if (!raw || raw === "all" || raw === "All Branches") return null;
  const target = String(raw).toLowerCase().trim();
  const restBranches = branches.filter((b) => b.restaurant_id == restaurantId);
  const match = restBranches.find(
    (b) =>
      b.id.toLowerCase() === target ||
      b.name.toLowerCase() === target ||
      b.name.toLowerCase().includes(target) ||
      target.includes(b.name.toLowerCase()),
  );
  return match ? match.id : null;
}

// 2. Fix users table
const [users] = await conn.execute(
  "SELECT u.id, u.branch, ur.restaurant_id FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id",
);
for (const u of users) {
  if (!u.branch) continue;
  const bId = findBranchId(u.restaurant_id || 5, u.branch);
  if (bId && bId !== u.branch) {
    await conn.execute(
      "UPDATE users SET branch = ?, assigned_branch_id = ? WHERE id = ?",
      [bId, bId, u.id],
    );
    console.log(`Updated user ${u.id}: branch '${u.branch}' -> '${bId}'`);
  }
}

// 3. Fix pos_orders table
const [posOrders] = await conn.execute(
  "SELECT id, branch_id, restaurant_id FROM pos_orders WHERE branch_id IS NOT NULL AND branch_id != ''",
);
for (const o of posOrders) {
  const bId = findBranchId(o.restaurant_id, o.branch_id);
  if (bId && bId !== o.branch_id) {
    await conn.execute("UPDATE pos_orders SET branch_id = ? WHERE id = ?", [bId, o.id]);
    console.log(`Updated pos_orders ${o.id}: branch_id '${o.branch_id}' -> '${bId}'`);
  }
}

// 4. Fix reservations table
const [reservations] = await conn.execute(
  "SELECT id, branch_id, branch_name, restaurant_id FROM reservations",
);
for (const r of reservations) {
  const target = r.branch_id || r.branch_name;
  const bId = findBranchId(r.restaurant_id, target);
  if (bId && bId !== r.branch_id) {
    await conn.execute("UPDATE reservations SET branch_id = ? WHERE id = ?", [bId, r.id]);
    console.log(`Updated reservations ${r.id}: branch_id -> '${bId}'`);
  }
}

// 5. Fix waiter_requests if any
try {
  const [wr] = await conn.execute(
    "SELECT id, branch_id, restaurant_id FROM waiter_requests WHERE branch_id IS NOT NULL AND branch_id != ''",
  );
  for (const w of wr) {
    const bId = findBranchId(w.restaurant_id, w.branch_id);
    if (bId && bId !== w.branch_id) {
      await conn.execute("UPDATE waiter_requests SET branch_id = ? WHERE id = ?", [bId, w.id]);
      console.log(`Updated waiter_requests ${w.id}: branch_id -> '${bId}'`);
    }
  }
} catch (e) {
  console.log("waiter_requests check:", e.message);
}

await conn.end();
console.log("Migration complete!");
