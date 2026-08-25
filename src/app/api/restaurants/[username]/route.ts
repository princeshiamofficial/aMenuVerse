import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCachedTenant, setCachedTenant } from "@/lib/redis";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ username: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    // 1. Try to read from Redis cache
    const cachedData = await getCachedTenant(cleanUsername);
    if (cachedData) {
      console.log(`Redis Cache Hit for tenant: ${cleanUsername}`);
      return NextResponse.json(cachedData);
    }

    console.log(`Redis Cache Miss for tenant: ${cleanUsername}. Querying MySQL...`);

    // 2. Query Restaurant details
    const restaurants = await query<Record<string, unknown>[]>(
      `SELECT * FROM restaurants WHERE username = ?`,
      [cleanUsername],
    );

    if (restaurants.length === 0) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const restaurant = restaurants[0];

    // 3. Query Branches
    const branches = await query<Record<string, unknown>[]>(
      `SELECT * FROM branches WHERE restaurant_id = ?`,
      [restaurant.id],
    );

    // 4. Query Tables for each branch
    const branchesWithTables = [];
    for (const b of branches) {
      const tables = await query<Record<string, unknown>[]>(
        `SELECT name, location, status FROM branch_tables WHERE branch_id = ?`,
        [b.id],
      );
      branchesWithTables.push({
        id: b.id as string,
        name: b.name as string,
        location: b.location as string,
        phone: b.phone as string,
        operatingHours: b.operating_hours as string,
        tables: tables.map((t: Record<string, unknown>) => ({
          name: t.name as string,
          location: t.location as string,
          status: t.status as string,
        })),
      });
    }

    // 5. Query Menu Items
    const menuItems = await query<Record<string, unknown>[]>(
      `SELECT id, name, description, price, image, category, popular FROM menu_items WHERE restaurant_id = ?`,
      [restaurant.id],
    );

    const formattedMenuItems = menuItems.map((item: Record<string, unknown>) => ({
      id: item.id as number,
      name: item.name as string,
      description: item.description as string,
      price: parseFloat(item.price as string),
      image: item.image as string,
      category: item.category as string,
      popular: item.popular === 1,
    }));

    // 5.5. Query Categories
    const categories = await query<Record<string, unknown>[]>(
      `SELECT id, name, description, emoji FROM categories WHERE restaurant_id = ? ORDER BY id ASC`,
      [restaurant.id],
    );

    const formattedCategories = categories.map((c: Record<string, unknown>) => ({
      id: c.id as number,
      name: c.name as string,
      description: (c.description as string) || "",
      emoji: (c.emoji as string) || "hamburger",
    }));

    let parsedOfferSlides = [];
    try {
      let slidesVal = restaurant.offer_slides;
      while (slidesVal && typeof slidesVal === "string") {
        slidesVal = JSON.parse(slidesVal);
      }
      parsedOfferSlides = Array.isArray(slidesVal) ? slidesVal : [];
    } catch (e) {
      console.error("Failed to parse offer_slides JSON:", e);
    }

    // 6. Structure response data matching public Restaurant format
    const fullRestaurantData = {
      id: restaurant.id as number,
      name: restaurant.name as string,
      cuisine: restaurant.cuisine as string,
      rating: restaurant.rating as string,
      reviews: restaurant.reviews as string,
      price: restaurant.price as string,
      time: restaurant.time as string,
      location: restaurant.location as string,
      logo: restaurant.logo as string,
      logoBg: restaurant.logo_bg as string,
      image: restaurant.image as string,
      logoImage: restaurant.logo_image as string,
      username: restaurant.username as string,
      phone: restaurant.phone as string,
      operatingHours: restaurant.operating_hours as string,
      facilities: restaurant.facilities as string,
      introText: restaurant.intro_text as string,
      descriptionText: restaurant.description_text as string,
      primaryColor: (restaurant.primary_color as string) || "#ff7a00",
      fontFamily: (restaurant.font_family as string) || "Outfit",
      layoutType: (restaurant.layout_type as string) || "grid",
      offerSlides: parsedOfferSlides,
      branches: branchesWithTables,
      menuItems: formattedMenuItems,
      categories: formattedCategories,
    };

    // 7. Store in Redis cache for 1 hour
    await setCachedTenant(cleanUsername, fullRestaurantData, 3600);

    return NextResponse.json(fullRestaurantData);
  } catch (err) {
    console.error("Public restaurant GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
