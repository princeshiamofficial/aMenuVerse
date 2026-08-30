"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getPublicMenu } from "@/lib/db-queries.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlobImg } from "@/components/ui/blob-img";

type PublicMenu = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    cover_url: string | null;
    cuisine: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      currency: string | null;
      is_featured: boolean;
      image_url: string | null;
    }>;
  }>;
};

export default function SlugMenuPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        setLoading(true);
        const data = await getPublicMenu({ data: slug });
        if (!data) {
          setError(true);
        } else {
          setMenu({
            ...data,
            restaurant: {
              ...data.restaurant,
              id: String(data.restaurant.id),
            },
          });
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">Loading menu...</p>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Menu not found</h1>
        <p className="mt-2 text-muted-foreground">No active restaurant matches "{slug}".</p>
        <Link href="/" className="mt-4 inline-block underline text-primary">
          Go home
        </Link>
      </div>
    );
  }

  const { restaurant, categories } = menu;

  return (
    <div className="min-h-screen bg-background">
      {restaurant.cover_url ? (
        <div className="relative h-34 w-full overflow-hidden md:h-80">
          <BlobImg
            src={restaurant.cover_url}
            alt={`${restaurant.name} cover`}
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background/90 to-transparent" />
        </div>
      ) : (
        <div className="h-24 w-full gradient-warm" />
      )}

      <main className="mx-auto max-w-4xl px-4 pb-16 -mt-12 md:-mt-16">
        <header className="flex flex-col items-center text-center">
          {restaurant.logo_url && (
            <BlobImg
              src={restaurant.logo_url}
              alt={`${restaurant.name} logo`}
              className="h-24 w-24 rounded-2xl border-4 border-background object-cover shadow-lg"
            />
          )}
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">{restaurant.name}</h1>
          {restaurant.cuisine && (
            <Badge variant="secondary" className="mt-2">
              {restaurant.cuisine}
            </Badge>
          )}
          {restaurant.description && (
            <p className="mt-3 max-w-xl text-muted-foreground">{restaurant.description}</p>
          )}
        </header>

        <section className="mt-10 space-y-10">
          {categories.length === 0 && (
            <p className="text-center text-muted-foreground">No menu items available yet.</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="mb-4 border-b pb-2">
                <h2 className="font-display text-2xl font-semibold">{cat.name}</h2>
                {cat.description && (
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                )}
              </div>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items in this category.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {cat.items.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      {item.image_url && (
                        <BlobImg
                          src={item.image_url}
                          alt={item.name}
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <div className="whitespace-nowrap text-sm font-semibold">
                            {item.currency ?? "USD"} {item.price.toFixed(2)}
                          </div>
                        </div>
                        {item.is_featured && (
                          <Badge variant="default" className="w-fit">
                            Featured
                          </Badge>
                        )}
                      </CardHeader>
                      {item.description && (
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                          {item.description}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
