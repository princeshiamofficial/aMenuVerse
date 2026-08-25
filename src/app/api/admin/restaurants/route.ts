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

    // Retrieve all restaurants and their counts of branches & menu items
    const list = await query<Record<string, unknown>[]>(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM branches b WHERE b.restaurant_id = r.id) AS branchCount,
              (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.id) AS menuCount
       FROM restaurants r
       ORDER BY r.id DESC`,
    );

    return NextResponse.json({
      success: true,
      restaurants: list.map((item) => ({
        ...item,
        branchCount:
          typeof item.branchCount === "number"
            ? item.branchCount
            : parseInt(String(item.branchCount || 0), 10),
        menuCount:
          typeof item.menuCount === "number"
            ? item.menuCount
            : parseInt(String(item.menuCount || 0), 10),
      })),
    });
  } catch (err) {
    console.error("Admin restaurants GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthorized = await checkAdminAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      username,
      cuisine,
      price,
      time,
      location,
      phone,
      operating_hours,
      facilities,
      image,
      logo_image,
    } = body;

    if (!name || !username) {
      return NextResponse.json({ error: "Name and Username slug are required" }, { status: 400 });
    }

    const cleanUsername = username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, "");

    // Check if username is unique
    const existing = await query<{ id: number }[]>(
      "SELECT id FROM restaurants WHERE username = ?",
      [cleanUsername],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A restaurant with this username slug already exists" },
        { status: 409 },
      );
    }

    // Default values
    const finalCuisine = cuisine || "General Food";
    const finalPrice = price || "$$";
    const finalTime = time || "20-30 min";
    const finalRating = "5.0";
    const finalReviews = "0";
    const logoChar = name.charAt(0).toUpperCase();

    // Choose a random gradient background for the text logo if image logo is not available
    const gradients = [
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-rose-500 to-pink-600",
      "from-blue-500 to-indigo-600",
      "from-violet-500 to-purple-600",
    ];
    const logoBg = gradients[Math.floor(Math.random() * gradients.length)];

    const finalImage =
      image ||
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80";
    const finalLogoImage = logo_image || "";

    const insertRes = await query<{ insertId: number }>(
      `INSERT INTO restaurants 
       (name, username, cuisine, price, time, rating, reviews, location, logo, logo_bg, image, logo_image, phone, operating_hours, facilities)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        cleanUsername,
        finalCuisine,
        finalPrice,
        finalTime,
        finalRating,
        finalReviews,
        location || "",
        logoChar,
        logoBg,
        finalImage,
        finalLogoImage,
        phone || "",
        operating_hours || "",
        facilities || "",
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Restaurant created successfully",
      restaurantId: insertRes.insertId,
    });
  } catch (err) {
    console.error("Admin restaurant POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
