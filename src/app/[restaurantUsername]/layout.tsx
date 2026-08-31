import type { Metadata } from "next";
import { fetchPublicMenu } from "@/lib/public-menu";

interface Props {
  params: Promise<{ restaurantUsername: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantUsername: string }>;
}): Promise<Metadata> {
  const { restaurantUsername } = await params;
  const restaurant = await fetchPublicMenu(restaurantUsername);

  if (!restaurant) {
    return {
      title: "Restaurant Not Found — MenuVerse",
      description: "The requested restaurant menu could not be found on MenuVerse.",
    };
  }

  const title = `${restaurant.name} - Digital Menu & Table Ordering`;
  const description =
    restaurant.cuisine && restaurant.location
      ? `Explore the digital menu, signature food items, and order online from ${restaurant.name} (${restaurant.cuisine}) located in ${restaurant.location}.`
      : `Explore the live digital menu, deals, and order directly from ${restaurant.name} on MenuVerse.`;

  const ogImage =
    restaurant.image ||
    restaurant.logoImage ||
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&auto=format&fit=crop&q=80";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "MenuVerse",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${restaurant.name} Cover Image`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
