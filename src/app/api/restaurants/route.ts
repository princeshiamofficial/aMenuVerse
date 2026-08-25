import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await query<Record<string, unknown>[]>(
      `SELECT id, name, cuisine, rating, reviews, price, time, location, logo, logo_bg, image, logo_image, username, phone, operating_hours, facilities 
       FROM restaurants 
       ORDER BY id ASC`,
    );

    const formatted = list.map((item) => ({
      id: item.id as number,
      name: item.name as string,
      cuisine: (item.cuisine as string) || "",
      rating: (item.rating as string) || "5.0",
      reviews: (item.reviews as string) || "0",
      price: (item.price as string) || "$$",
      time: (item.time as string) || "20-30 min",
      location: (item.location as string) || "",
      logo: (item.logo as string) || "",
      logoBg: (item.logo_bg as string) || "",
      image: (item.image as string) || "",
      logoImage: (item.logo_image as string) || "",
      username: item.username as string,
      phone: (item.phone as string) || "",
      operatingHours: (item.operating_hours as string) || "",
      facilities: (item.facilities as string) || "",
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Public restaurants list GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
