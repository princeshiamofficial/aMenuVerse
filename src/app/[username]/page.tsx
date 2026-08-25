"use client";

import React, { useState, useMemo, use, useEffect } from "react";
import Image from "next/image";
import { notFound, useSearchParams } from "next/navigation";
import { useHorizontalScroll } from "../../lib/hooks";

import { MenuItem, Restaurant, Branch, RESTAURANTS } from "../data/restaurants";
import Toast from "../../../ui/toast";
import Button from "../../../ui/button";
import { EmojiProvider, Emoji } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import {
  Star,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  CheckCircle,
  Clock,
  Phone,
  Info,
  ThumbsUp,
  Share2,
  Calendar,
  Utensils,
  ClipboardList,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface PageProps {
  params: Promise<{ username: string }>;
}

// Mock reviews data to simulate actual client ratings
const MOCK_REVIEWS_MAP: {
  [key: number]: Array<{
    author: string;
    date: string;
    stars: number;
    text: string;
    avatar: string;
  }>;
} = {
  1: [
    {
      author: "Ariful Islam",
      date: "2 days ago",
      stars: 5,
      text: "The Smoked BBQ Bacon Burger is absolutely massive! The preparation was super fast, and the sauce is stellar.",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Nusrat Jahan",
      date: "1 week ago",
      stars: 5,
      text: "Great digital ordering experience. Scan, click, and food arrives in minutes. The Truffle Fries are to die for!",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Tahmid Rahman",
      date: "3 weeks ago",
      stars: 4,
      text: "Solid burgers and fresh Mint Lemonade. Really liked the automated table routing system.",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80",
    },
  ],
  2: [
    {
      author: "Sabrina Chowdhury",
      date: "1 day ago",
      stars: 5,
      text: "Hands down the best Truffle Mushroom Pizza in town! Cozy vibes and fast table service.",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Rashedul Amin",
      date: "5 days ago",
      stars: 5,
      text: "Authentic Carbonara. Creamy, rich, and cured pancetta was perfectly crispy. 10/10 recommendation.",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Mariya Sultana",
      date: "2 weeks ago",
      stars: 4,
      text: "Beautiful Margerita and great Tiramisu. Perfect spot for family dinners.",
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80",
    },
  ],
  3: [
    {
      author: "Kazi Ashraful",
      date: "3 days ago",
      stars: 5,
      text: "The Dragon Sushi Roll is a work of art. Melt-in-your-mouth eel. Will definitely order again.",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Sonia Mirza",
      date: "1 week ago",
      stars: 5,
      text: "Phenomenal Tonkotsu Ramen broth. Super rich and deep flavor. Highly clean and premium sushi bar.",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Adnan Sami",
      date: "1 month ago",
      stars: 5,
      text: "Top notch Japanese food in Banani. Sake was warm and matcha ice cream was extremely premium.",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80",
    },
  ],
  4: [
    {
      author: "Fahim Shahriar",
      date: "4 days ago",
      stars: 5,
      text: "Outstanding Sichuan wontons! The chilli oil is spicy, numbing, and has a sweet tang. Incredible flavor.",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Anika Bushra",
      date: "1 week ago",
      stars: 4,
      text: "Very tasty Kung Pao chicken and silken mapo tofu. Fast turnaround for lunch hours.",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Imran Hasan",
      date: "3 weeks ago",
      stars: 5,
      text: "Best place for authentic Chinese food lovers. Steamed jasmine rice is extremely fragrant.",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80",
    },
  ],
  5: [
    {
      author: "Niaz Morshed",
      date: "1 day ago",
      stars: 5,
      text: "The Sichuan Chili Chicken is insanely spicy and delicious! Portion size was very good.",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80",
    },
    {
      author: "Farhana Yasmin",
      date: "3 days ago",
      stars: 5,
      text: "Extremely delicious dumplings and Yangzhou fried rice. Tastes just like traditional Cantonese style.",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80",
    },
  ],
};

// Custom SVG Icons (unused)

const getCategoryAppleEmojiName = (category: string): string => {
  const map: Record<string, string> = {
    all: "fork-and-knife-with-plate",
    popular: "fire",
    burgers: "hamburger",
    sides: "french-fries",
    beverages: "cup-with-straw",
    pizza: "pizza",
    pasta: "spaghetti",
    desserts: "shortcake",
    sushi: "sushi",
    ramen: "steaming-bowl",
    appetizers: "dumpling",
    mains: "pot-of-food",
    "rice & noodles": "curry-rice",
  };
  return map[category.trim().toLowerCase()] || "sparkles";
};

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="text-neutral-800 font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <strong key={index} className="text-neutral-800 font-bold">
          {part.slice(1, -1)}
        </strong>
      );
    }
    return part;
  });
};

export default function RestaurantMenuPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const username = resolvedParams.username;
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get("table") || "12";
  const branchId = searchParams.get("branch") || "";

  // Find local fallback restaurant first to avoid showing loading screen
  const localRestaurant = useMemo(() => {
    if (!username) return null;
    return RESTAURANTS.find((r) => r.username.toLowerCase() === username.toLowerCase()) || null;
  }, [username]);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(localRestaurant);
  const [isLoading, setIsLoading] = useState(!localRestaurant);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!username) return;
    if (!restaurant) {
      setIsLoading(true);
    }
    fetch(`/api/restaurants/${username}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Restaurant not found");
        }
        return res.json();
      })
      .then((data) => {
        setRestaurant(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Load custom branches if any, or default branches from restaurant data
  const allBranches = useMemo(() => {
    if (!restaurant) return [];
    return restaurant.branches || [];
  }, [restaurant]);

  // Find the selected branch address
  const branchAddress = useMemo(() => {
    const targetBranchId = branchId || (allBranches && allBranches[0]?.id) || "";
    if (!targetBranchId) return restaurant?.location || "";
    const target = targetBranchId.toLowerCase().trim();
    const b = allBranches.find(
      (x: Branch) => x.id.toLowerCase().trim() === target || x.name.toLowerCase().trim() === target,
    );
    return b ? b.location : restaurant?.location || "";
  }, [branchId, allBranches, restaurant]);

  // Find the selected branch operating hours
  const branchHours = useMemo(() => {
    const targetBranchId = branchId || (allBranches && allBranches[0]?.id) || "";
    if (!targetBranchId) return restaurant?.operatingHours || "";
    const target = targetBranchId.toLowerCase().trim();
    const b = allBranches.find(
      (x: Branch) => x.id.toLowerCase().trim() === target || x.name.toLowerCase().trim() === target,
    );
    return b ? b.operatingHours : restaurant?.operatingHours || "";
  }, [branchId, allBranches, restaurant]);

  // Find the selected branch phone number
  const branchPhone = useMemo(() => {
    const targetBranchId = branchId || (allBranches && allBranches[0]?.id) || "";
    if (!targetBranchId) return restaurant?.phone || "";
    const target = targetBranchId.toLowerCase().trim();
    const b = allBranches.find(
      (x: Branch) => x.id.toLowerCase().trim() === target || x.name.toLowerCase().trim() === target,
    );
    return b ? b.phone : restaurant?.phone || "";
  }, [branchId, allBranches, restaurant]);

  // Slideshow images for the cover — restaurant cover/offer slides only (no menu item images)
  const slideshowImages = useMemo(() => {
    if (!restaurant) return [];

    let slides: string[] | string | undefined = restaurant.offerSlides || restaurant.offer_slides;

    if (typeof slides === "string") {
      try {
        slides = JSON.parse(slides);
      } catch {
        slides = undefined;
      }
    }

    if (typeof slides === "string") {
      try {
        slides = JSON.parse(slides);
      } catch {
        slides = undefined;
      }
    }

    if (Array.isArray(slides) && slides.length > 0) {
      return slides as string[];
    }

    return restaurant.image ? [restaurant.image] : [];
  }, [restaurant]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");

  // Adjust state during render when restaurant changes to avoid useEffect setState
  const [prevRestaurantId, setPrevRestaurantId] = useState(restaurant?.id);
  if (restaurant?.id !== prevRestaurantId) {
    setPrevRestaurantId(restaurant?.id);
    setCurrentSlide(0);
    setPrevSlide(null);
    setSlideDirection("next");
  }

  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    const interval = setInterval(() => {
      setSlideDirection("next");
      setPrevSlide(currentSlide);
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slideshowImages, currentSlide]);

  // Active Tab state (Facebook profile style: Menu, About, Reviews)
  const [activeTab, setActiveTab] = useState<"menu" | "about" | "reviews" | "orders">("menu");

  // Follower interaction states
  // const [isFollowing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categoriesScrollRef = useHorizontalScroll();

  // Cart state: Record of item id to quantity
  const [cart, setCart] = useState<{ [key: number]: number }>({});
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [actionToast, setActionToast] = useState<{
    text: string;
    subText: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      items: Array<{ item: MenuItem; quantity: number }>;
      time: string;
      status: string;
      total: number;
    }>
  >([]);
  const [isCategoriesSticky, setIsCategoriesSticky] = useState(false);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 310) {
        setIsCategoriesSticky(true);
      } else {
        setIsCategoriesSticky(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to top when active tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Trigger Toast notifications
  const triggerToast = (msg: string, subText?: string, type?: "success" | "error" | "info") => {
    const isError =
      msg.toLowerCase().includes("fail") ||
      msg.toLowerCase().includes("error") ||
      msg.toLowerCase().includes("invalid");
    setActionToast({
      text: msg,
      subText: subText || (isError ? "Something went wrong" : "Success"),
      type: type || (isError ? "error" : "success"),
    });
  };

  // Trigger bubble explosion effect on the closest element with the 'btn-bubble' class
  const triggerBubbleEffect = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget.closest(".btn-bubble");
    if (target) {
      target.classList.remove("animate");
      void (target as HTMLElement).offsetWidth;
      target.classList.add("animate");
      setTimeout(() => {
        target.classList.remove("animate");
      }, 600);
    }
  };

  useEffect(() => {
    if (actionToast) {
      const timer = setTimeout(() => setActionToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionToast]);

  // Copy Profile Link Share
  const handleShareProfile = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        triggerToast("Link copied to clipboard! Share it with your friends.");
      })
      .catch(() => {
        triggerToast("Failed to copy link.");
      });
  };

  // Extract menu categories dynamically or use persisted categories if available
  const categories = useMemo(() => {
    if (!restaurant) return ["All", "Popular"];

    // If restaurant has categories from DB, use them (preserving "All" and "Popular")
    if (
      restaurant.categories &&
      Array.isArray(restaurant.categories) &&
      restaurant.categories.length > 0
    ) {
      return ["All", "Popular", ...restaurant.categories.map((c: { name: string }) => c.name)];
    }

    // Fallback to dynamic extraction from menuItems
    if (!restaurant.menuItems) return ["All", "Popular"];
    const cats = new Set<string>(
      restaurant.menuItems.map((item: MenuItem) => item.category as string),
    );
    return ["All", "Popular", ...Array.from(cats)];
  }, [restaurant]);

  // Resolve correct category emoji based on DB category config
  const getCategoryEmoji = (catName: string): string => {
    if (restaurant && restaurant.categories && Array.isArray(restaurant.categories)) {
      const match = restaurant.categories.find(
        (c: { name: string; emoji?: string }) => c.name.toLowerCase() === catName.toLowerCase(),
      );
      if (match && match.emoji) {
        return match.emoji;
      }
    }
    return getCategoryAppleEmojiName(catName);
  };

  // Dynamic review comments list
  const reviewsList = useMemo(() => {
    if (!restaurant) return [];
    return MOCK_REVIEWS_MAP[restaurant.id] || [];
  }, [restaurant]);

  // Filter menu items by active tab category and search term
  const filteredItems = useMemo(() => {
    if (!restaurant || !restaurant.menuItems) return [];
    return restaurant.menuItems.filter((item: MenuItem) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        (selectedCategory === "Popular" && item.popular) ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [restaurant, searchQuery, selectedCategory]);

  // Cart operations
  const addToCart = (itemId: number) => {
    setCart((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) => {
      const updated = { ...prev };
      if (updated[itemId] <= 1) {
        delete updated[itemId];
      } else {
        updated[itemId] -= 1;
      }
      return updated;
    });
  };

  // Cart Summary details
  const cartItemsList = useMemo(() => {
    if (!restaurant || !restaurant.menuItems) return [];
    return Object.keys(cart)
      .map((idStr) => {
        const id = parseInt(idStr);
        const item = restaurant.menuItems.find((m: MenuItem) => m.id === id)!;
        return {
          item,
          quantity: cart[id],
        };
      })
      .filter((entry) => entry.item !== undefined);
  }, [cart, restaurant]);

  const totalItems = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return cartItemsList.reduce((sum, entry) => sum + entry.quantity * entry.item.price, 0);
  }, [cartItemsList]);

  // Trigger order submission to database
  const handlePlaceOrder = async () => {
    if (!restaurant) return;
    try {
      const targetBranchId =
        branchId || (restaurant.branches && restaurant.branches[0]?.id) || "dhanmondi";
      const response = await fetch("/api/tenant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          branchId: targetBranchId,
          table: tableNumber,
          items: cartItemsList.map((c) => ({
            name: c.item.name,
            quantity: c.quantity,
            price: c.item.price,
          })),
          total: totalPrice,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const newOrder = {
          id: data.orderId,
          items: [...cartItemsList],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "Pending",
          total: totalPrice,
        };

        setOrders((prev) => [newOrder, ...prev]);
        setOrderPlaced(true);
        setCart({});
        setIsCartExpanded(false);
        setActiveTab("orders");
        triggerToast(`Order placed successfully for Table #${tableNumber}!`);
      } else {
        triggerToast(data.error || "Failed to place order.");
      }
    } catch {
      triggerToast("Connection failed. Please try again.");
    }
  };

  const leftNavItems = [
    {
      id: "orders",
      label: "Orders",
      icon: ClipboardList,
      onClick: () => {
        setActiveTab("orders");
        setIsCartExpanded(false);
      },
      isActive: activeTab === "orders" && !isCartExpanded,
    },
    {
      id: "menu",
      label: "Menu",
      icon: Utensils,
      onClick: () => {
        setActiveTab("menu");
        setIsCartExpanded(false);
      },
      isActive: activeTab === "menu" && !isCartExpanded,
    },
  ];

  const rightNavItems = [
    {
      id: "reviews",
      label: "Reviews",
      icon: Star,
      onClick: () => {
        setActiveTab("reviews");
        setIsCartExpanded(false);
      },
      isActive: activeTab === "reviews" && !isCartExpanded,
    },
    {
      id: "about",
      label: "About",
      icon: Info,
      onClick: () => {
        setActiveTab("about");
        setIsCartExpanded(false);
      },
      isActive: activeTab === "about" && !isCartExpanded,
    },
  ];

  if (!mounted || (isLoading && !restaurant)) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col antialiased pb-0 select-none overflow-x-hidden w-full font-sans">
        {/* Skeleton Sticky Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-neutral-100/80 px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-200 animate-pulse" />
            <div className="h-5 w-32 bg-neutral-200 rounded-sm animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-neutral-200 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-neutral-200 animate-pulse" />
          </div>
        </div>

        {/* Skeleton Main Container */}
        <div className="flex-1 w-full flex flex-col">
          {/* Cover Photo Placeholder */}
          <div className="w-full bg-[#f0f2f5]">
            <div className="max-w-6xl mx-auto relative">
              <div className="w-full h-[180px] sm:h-[220px] md:h-[260px] bg-neutral-200 md:rounded-b-xl animate-pulse" />

              {/* White info area overlapping cover */}
              <div className="bg-white rounded-t-2xl sm:rounded-t-3xl -mt-10 sm:-mt-16 md:-mt-20 pt-3 relative z-35 shadow-xs">
                {/* Profile Details Row */}
                <div className="px-3 sm:px-8 pb-3 flex items-center justify-between gap-5">
                  <div className="flex flex-row items-end sm:items-center gap-2 sm:gap-5 text-left">
                    {/* Circular Profile Avatar (Logo) */}
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white bg-neutral-200 overflow-hidden shadow-md shrink-0 -mt-12 sm:-mt-18 md:-mt-22 animate-pulse" />

                    {/* Brand details */}
                    <div className="flex flex-col pb-1 gap-2 text-left ml-1 sm:ml-0 -mt-6 sm:mt-0">
                      <div className="h-6 w-48 sm:w-64 bg-neutral-200 rounded-md animate-pulse" />
                      <div className="h-4 w-32 sm:w-40 bg-neutral-200 rounded-md animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Desktop Tabs Placeholder */}
                <div className="hidden md:flex gap-4 border-t border-neutral-100 pl-8 py-3">
                  <div className="h-5 w-16 bg-neutral-200 rounded-md animate-pulse" />
                  <div className="h-5 w-16 bg-neutral-200 rounded-md animate-pulse" />
                  <div className="h-5 w-16 bg-neutral-200 rounded-md animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Menu Grid / Category list */}
          <div className="max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
            {/* Search input placeholder */}
            <div className="w-full h-11 bg-white border border-neutral-200 rounded-xl animate-pulse" />

            {/* Horizontal Categories pills placeholder */}
            <div className="flex gap-2 overflow-hidden py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-20 sm:w-24 bg-white border border-neutral-200/60 rounded-full shrink-0 animate-pulse"
                />
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-neutral-250/20 rounded-2xl p-3 flex flex-col gap-3 shadow-xs"
                >
                  {/* Image Placeholder */}
                  <div className="w-full aspect-video bg-neutral-200 rounded-xl animate-pulse" />
                  {/* Text details */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-5 w-2/3 bg-neutral-200 rounded-md animate-pulse" />
                    <div className="h-3 w-full bg-neutral-200 rounded-md animate-pulse" />
                    <div className="h-3 w-4/5 bg-neutral-200 rounded-md animate-pulse" />
                  </div>
                  {/* Footer */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="h-5 w-16 bg-neutral-200 rounded-md animate-pulse" />
                    <div className="h-8 w-20 bg-neutral-200 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return notFound();
  }

  // ── Appearance settings from DB (with safe defaults) ───────────────────
  const primaryColor = restaurant?.primaryColor || "#059669";
  const fontFamily = "ui-sans-serif, system-ui, sans-serif";
  const layoutType = restaurant?.layoutType || "grid";

  return (
    <EmojiProvider data={emojiData}>
      <div
        className="min-h-screen bg-[#f0f2f5] flex flex-col antialiased pb-0 select-none text-neutral-800 overflow-x-hidden w-full"
        style={{ fontFamily }}
      >
        {/* Sticky Header */}

        {/* Main Content Layout Container */}
        <main className="flex-1 w-full flex flex-col">
          {/* Facebook Style Cover Photo Card Container */}
          <div className="w-full bg-[#f0f2f5] shadow-sm">
            <div className="max-w-6xl mx-auto relative">
              {/* Cover image wrap */}
              <div className="relative w-full h-[180px] sm:h-[220px] md:h-[260px] overflow-hidden bg-neutral-200 md:rounded-b-xl group/cover">
                {slideshowImages.map((imgSrc: string, index: number) => {
                  const isActive = index === currentSlide;
                  const isPrev = index === prevSlide;

                  let translateX = "100%";
                  if (isActive) {
                    translateX = "0%";
                  } else if (isPrev) {
                    translateX = slideDirection === "next" ? "-100%" : "100%";
                  } else {
                    translateX = slideDirection === "next" ? "100%" : "-100%";
                  }

                  const shouldAnimate = isActive || isPrev;

                  return (
                    <div
                      key={imgSrc}
                      className={`absolute inset-0 ${shouldAnimate ? "transition-transform duration-750 ease-in-out" : "transition-none"}`}
                      style={{ transform: `translateX(${translateX})` }}
                    >
                      <Image
                        src={imgSrc}
                        alt={`${restaurant.name} slide ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="100vw"
                        priority={index === 0}
                      />
                    </div>
                  );
                })}
                <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/20 to-transparent z-10 pointer-events-none" />

                {/* Navigation Arrows */}
                {slideshowImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlideDirection("prev");
                        setPrevSlide(currentSlide);
                        setCurrentSlide(
                          (prev) => (prev - 1 + slideshowImages.length) % slideshowImages.length,
                        );
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/65 text-white rounded-full p-2 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 z-20 focus:outline-none cursor-pointer"
                      aria-label="Previous Slide"
                      type="button"
                    >
                      <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlideDirection("next");
                        setPrevSlide(currentSlide);
                        setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/65 text-white rounded-full p-2 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 z-20 focus:outline-none cursor-pointer"
                      aria-label="Next Slide"
                      type="button"
                    >
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    {/* Dot Indicators */}
                    <div className="absolute bottom-4 right-6 flex gap-1.5 z-20">
                      {slideshowImages.map((_: string, index: number) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (index === currentSlide) return;
                            setSlideDirection(index > currentSlide ? "next" : "prev");
                            setPrevSlide(currentSlide);
                            setCurrentSlide(index);
                          }}
                          className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
                            index === currentSlide
                              ? "bg-white w-4"
                              : "bg-white/50 hover:bg-white/80"
                          }`}
                          aria-label={`Go to slide ${index + 1}`}
                          type="button"
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* White info area overlapping cover photo */}
              <div className="bg-white rounded-t-2xl sm:rounded-t-3xl -mt-10 sm:-mt-16 md:-mt-20 pt-3 relative z-35 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
                {/* Profile Details Row */}
                <div className="px-3 sm:px-8 pb-3 flex items-center justify-between gap-5">
                  {/* Left Side: Avatar Profile Image & Text Info */}
                  <div className="flex flex-row items-end sm:items-center gap-2 sm:gap-5 text-left">
                    {/* Circular Profile Avatar (Logo) */}
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.15)] relative shrink-0 -mt-12 sm:-mt-18 md:-mt-22">
                      <Image
                        src={restaurant.logoImage}
                        alt={`${restaurant.name} logo`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 112px, 144px"
                      />
                    </div>

                    {/* Brand details */}
                    <div className="flex flex-col pb-1 min-w-0 relative -top-6 sm:top-0 gap-1 text-left ml-1 sm:ml-0">
                      <h1 className="text-base sm:text-[20px] font-black text-neutral-900 tracking-tight leading-none flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{restaurant.name}</span>
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
                        >
                          <title>Verified Restaurant</title>
                          <path
                            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
                            fill="#1877F2"
                          />
                          <path
                            d="m9 12 2 2 4-4"
                            fill="none"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </h1>
                      <span className="text-[11px] sm:text-xs text-neutral-500 font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{branchAddress || restaurant.location}</span>
                      </span>
                    </div>
                  </div>

                  {/* Mobile More Options Button */}
                  <div className="relative">
                    <button
                      onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
                      className="md:hidden p-2 text-neutral-500 hover:text-neutral-700 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-neutral-50 -mt-8 -mr-3"
                      title="More options"
                    >
                      <MoreVertical className="w-5.5 h-5.5" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuDropdownOpen && (
                      <>
                        {/* Backdrop for closing */}
                        <div
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={() => setIsMenuDropdownOpen(false)}
                        />
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-neutral-200/80 rounded-2xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-155">
                          <button
                            onClick={() => {
                              setIsMenuDropdownOpen(false);
                              handleShareProfile(); // Copies link & triggers toast
                            }}
                            className="w-full px-4 py-2.5 text-xs font-bold text-neutral-750 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer text-left"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-neutral-400"
                            >
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            <span>Copy Link</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsMenuDropdownOpen(false);
                              if (navigator.share) {
                                navigator
                                  .share({
                                    title: restaurant.name,
                                    text: `Check out the digital food menu for ${restaurant.name}!`,
                                    url: window.location.href,
                                  })
                                  .catch(() => {});
                              } else {
                                handleShareProfile();
                              }
                            }}
                            className="w-full px-4 py-2.5 text-xs font-bold text-neutral-755 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer text-left border-t border-neutral-100/80"
                          >
                            <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Share Menu</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Desktop Tabs */}
                <div className="hidden md:flex justify-between items-center border-t border-neutral-100/80 pl-8 pr-0">
                  <div className="flex gap-2 -mb-px">
                    <button
                      onClick={() => {
                        setActiveTab("menu");
                        setIsCartExpanded(false);
                      }}
                      className={`py-4 px-4 text-sm font-bold relative transition-colors cursor-pointer ${
                        activeTab === "menu"
                          ? "font-extrabold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      style={activeTab === "menu" ? { color: primaryColor } : {}}
                    >
                      Menu
                      {activeTab === "menu" && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("about");
                        setIsCartExpanded(false);
                      }}
                      className={`py-4 px-4 text-sm font-bold relative transition-colors cursor-pointer ${
                        activeTab === "about"
                          ? "font-extrabold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      style={activeTab === "about" ? { color: primaryColor } : {}}
                    >
                      About
                      {activeTab === "about" && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("reviews");
                        setIsCartExpanded(false);
                      }}
                      className={`py-4 px-4 text-sm font-bold relative transition-colors cursor-pointer ${
                        activeTab === "reviews"
                          ? "font-extrabold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      style={activeTab === "reviews" ? { color: primaryColor } : {}}
                    >
                      Reviews
                      {activeTab === "reviews" && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("orders");
                        setIsCartExpanded(false);
                      }}
                      className={`py-4 px-4 text-sm font-bold relative transition-colors cursor-pointer ${
                        activeTab === "orders"
                          ? "font-extrabold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      style={activeTab === "orders" ? { color: primaryColor } : {}}
                    >
                      Orders
                      {activeTab === "orders" && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                    </button>
                  </div>

                  {/* Desktop Search Bar Option */}
                  <div className="py-2.5 flex items-center">
                    <div className="relative w-64">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-neutral-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search menu..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (activeTab !== "menu") {
                            setActiveTab("menu");
                          }
                        }}
                        className="block w-full pl-9 pr-8 py-1.5 text-xs font-semibold bg-neutral-50/60 border border-neutral-200/80 rounded-l-full rounded-r-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all placeholder-neutral-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          <span className="text-sm font-bold">×</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 ${activeTab === "menu" ? "mt-0" : "mt-3"} md:mt-6 flex flex-col md:flex-row gap-6 items-start ${
              totalItems > 0 ? "pb-48 md:pb-48" : "pb-36 md:pb-32"
            }`}
          >
            {/* LEFT SIDEBAR: Intro Card Box */}
            {activeTab === "about" && (
              <div className="w-full md:w-[350px] shrink-0 flex flex-col gap-4 text-left">
                {/* Intro Card */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-lg font-black text-neutral-900 tracking-tight leading-none">
                    Intro
                  </h3>

                  {/* Bio description info */}
                  <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                    {restaurant.introText ? (
                      renderFormattedText(restaurant.introText)
                    ) : (
                      <>
                        Welcome to{" "}
                        <strong className="text-neutral-800 font-bold">{restaurant.name}</strong>{" "}
                        digital menu. Scan our unique QR codes directly at your table to place
                        real-time kitchen orders instantly.
                      </>
                    )}
                  </p>

                  <div className="flex flex-col gap-3.5 border-t border-neutral-100 pt-4 text-xs sm:text-sm font-semibold text-neutral-600">
                    <div className="flex items-center gap-3">
                      <Star className="w-[18px] h-[18px] text-amber-500 fill-amber-500 shrink-0" />
                      <span>
                        Rated{" "}
                        <strong className="text-neutral-800 font-bold">
                          {restaurant.rating} Stars
                        </strong>{" "}
                        ({restaurant.reviews} reviews)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                      <span className="truncate">
                        Located at {branchAddress || restaurant.location}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                      <span>Average preparation time: {restaurant.time}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ThumbsUp className="w-[18px] h-[18px] text-emerald-600 shrink-0" />
                      <span>Cuisine type: {restaurant.cuisine}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RIGHT SIDE CONTENT: Active Tab details (Menu list, About description, reviews feed) */}
            <div className="grow w-full flex flex-col gap-4 text-left">
              {/* TAB CONTENT: Menu List */}
              {activeTab === "menu" && (
                <div className="flex flex-col gap-4 w-full">
                  {/* Mobile Service & Search Header Row */}
                  <div className="flex md:hidden items-center justify-between gap-2.5 mt-0 w-full relative z-20">
                    {/* Call Waiter Quick Action Button */}
                    <Button
                      onClick={() =>
                        triggerToast(
                          `Waiter requested! A staff member is on their way to Table #${tableNumber}.`,
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-none rounded-br-xl -ml-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-bell-ring"
                      >
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                        <path d="M4 2C2.8 3.7 2 5.7 2 8" />
                        <path d="M22 8c0-2.3-.8-4.3-2-6" />
                      </svg>
                      <span>Call Waiter</span>
                    </Button>

                    {/* Mobile Search Bar */}
                    <div className="w-[50%] max-w-[200px] -mr-4 relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-neutral-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search menu..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-9 pr-8 py-2.5 text-xs font-semibold bg-white border border-neutral-200/80 rounded-tl-none rounded-bl-[14px] rounded-r-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all placeholder-neutral-400 shadow-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          <span className="text-sm font-bold">×</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex flex-col gap-1.5 sticky top-0 md:relative md:top-auto z-30 bg-[#f0f2f5] transition-all duration-150 ${
                      isCategoriesSticky
                        ? "pt-4 pb-2 -mx-4 px-0 border-b border-neutral-200/50 shadow-sm mt-0 md:mx-0 md:px-0"
                        : "pt-1.5 pb-2 -mx-4 px-0 md:mx-0 md:px-0 -mt-3 md:mt-0"
                    }`}
                  >
                    {isCategoriesSticky && (
                      <div className="flex items-center justify-between px-4 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="text-xs font-black text-neutral-900 tracking-tight leading-none uppercase">
                          {restaurant.name}
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 leading-none">
                          Table #{tableNumber}
                        </span>
                      </div>
                    )}

                    <div
                      ref={categoriesScrollRef}
                      className="flex gap-2 overflow-x-auto scrollbar-none w-full scroll-smooth px-4 md:px-0"
                    >
                      {categories.map((cat) => {
                        const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 text-xs font-bold rounded-full border whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5 ${
                              isActive
                                ? "text-white border-transparent shadow-sm"
                                : "bg-white text-neutral-650 hover:text-neutral-900 border-neutral-200/80 hover:bg-neutral-50"
                            }`}
                            style={
                              isActive
                                ? { backgroundColor: primaryColor, borderColor: primaryColor }
                                : {}
                            }
                          >
                            <span className="w-4.5 h-4.5 flex items-center justify-center">
                              <Emoji
                                name={getCategoryEmoji(cat)}
                                className="w-full h-full object-contain"
                              />
                            </span>
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Food Items List */}
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-neutral-200/80 flex flex-col items-center justify-center gap-4 shadow-sm">
                      <Search className="w-12 h-12 text-neutral-300" />
                      <h3 className="text-lg font-bold text-neutral-800 leading-none">
                        No menu items found
                      </h3>
                      <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-sm px-6 leading-relaxed">
                        We couldn&apos;t find any dishes matching &quot;{searchQuery}&quot; under
                        &quot;{selectedCategory}&quot;.
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`w-full ${
                        layoutType === "list"
                          ? "flex flex-col gap-3"
                          : layoutType === "compact"
                            ? "grid grid-cols-1 gap-2"
                            : layoutType === "masonry"
                              ? "columns-2 sm:columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4 [column-fill:_balance]"
                              : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
                      }`}
                    >
                      {filteredItems.map((item: MenuItem) => {
                        const qtyInCart = cart[item.id] || 0;

                        // ──── 1. LIST LAYOUT ──────────────────────────────────────────
                        if (layoutType === "list") {
                          return (
                            <div
                              key={item.id}
                              className="bg-white border border-neutral-200/80 rounded-2xl p-3 shadow-xs flex gap-4 items-center hover:shadow-[0_6px_20px_rgba(0,0,0,0.025)] transition-all duration-300"
                            >
                              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-neutral-100 relative">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 96px, 112px"
                                />
                                {item.popular && (
                                  <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full z-10 shadow-sm">
                                    Popular
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[96px] sm:min-h-[112px] py-0.5">
                                <div>
                                  <h4 className="text-sm sm:text-base font-bold text-neutral-900 line-clamp-1">
                                    {item.name}
                                  </h4>
                                  <p className="text-[11px] sm:text-xs text-neutral-500 font-semibold leading-relaxed mt-0.5 line-clamp-2">
                                    {item.description}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-sm font-black text-deep-emerald-950">
                                    ${item.price.toFixed(2)}
                                  </span>
                                  <div className="flex items-center justify-center bg-white border border-neutral-200/80 rounded-xl h-9 px-1 shadow-sm btn-bubble">
                                    {qtyInCart > 0 ? (
                                      <div className="flex items-center gap-1.5 px-1.5">
                                        <button
                                          onClick={() => removeFromCart(item.id)}
                                          className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors text-white"
                                          style={{
                                            backgroundColor: `${primaryColor}22`,
                                            color: primaryColor,
                                          }}
                                        >
                                          <Minus className="w-2 h-2" />
                                        </button>
                                        <span
                                          className="text-xs font-black min-w-[14px] text-center"
                                          style={{ color: primaryColor }}
                                        >
                                          {qtyInCart}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            triggerBubbleEffect(e);
                                            addToCart(item.id);
                                          }}
                                          className="w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer transition-all duration-200"
                                          style={{ backgroundColor: primaryColor }}
                                        >
                                          <Plus className="w-2.5 h-2.5 relative z-10" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          triggerBubbleEffect(e);
                                          addToCart(item.id);
                                        }}
                                        className="w-8 h-full flex items-center justify-center bg-transparent hover:scale-110 transition-all duration-200 cursor-pointer active:scale-95"
                                        style={{ color: primaryColor }}
                                        title="Add to Cart"
                                      >
                                        <Plus className="w-3.5 h-3.5 relative z-10" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // ──── 2. COMPACT LAYOUT ──────────────────────────────────────
                        if (layoutType === "compact") {
                          return (
                            <div
                              key={item.id}
                              className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs flex items-center justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.015)] transition-all duration-300"
                            >
                              <div className="flex-1 pr-4 min-w-0">
                                <h4 className="text-sm font-bold text-neutral-800 line-clamp-1">
                                  {item.name}
                                </h4>
                                {item.description && (
                                  <p className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold truncate mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-black text-neutral-800">
                                  ${item.price.toFixed(2)}
                                </span>
                                <div className="flex items-center justify-center bg-white border border-neutral-200/80 rounded-lg h-8 px-1 shadow-sm btn-bubble">
                                  {qtyInCart > 0 ? (
                                    <div className="flex items-center gap-1.5 px-1">
                                      <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-colors text-white"
                                        style={{
                                          backgroundColor: `${primaryColor}22`,
                                          color: primaryColor,
                                        }}
                                      >
                                        <Minus className="w-1.5 h-1.5" />
                                      </button>
                                      <span
                                        className="text-xs font-black min-w-[12px] text-center"
                                        style={{ color: primaryColor }}
                                      >
                                        {qtyInCart}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          triggerBubbleEffect(e);
                                          addToCart(item.id);
                                        }}
                                        className="w-4 h-4 rounded-full text-white flex items-center justify-center cursor-pointer transition-all duration-200"
                                        style={{ backgroundColor: primaryColor }}
                                      >
                                        <Plus className="w-2 h-2 relative z-10" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        triggerBubbleEffect(e);
                                        addToCart(item.id);
                                      }}
                                      className="w-7 h-full flex items-center justify-center bg-transparent hover:scale-110 transition-all duration-200 cursor-pointer active:scale-95"
                                      style={{ color: primaryColor }}
                                      title="Add to Cart"
                                    >
                                      <Plus className="w-3 h-3 relative z-10" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // ──── 3. MASONRY LAYOUT ──────────────────────────────────────
                        if (layoutType === "masonry") {
                          return (
                            <div
                              key={item.id}
                              className="break-inside-avoid inline-block w-full mb-3 sm:mb-4"
                            >
                              <div className="flex flex-col h-full group food-card text-left">
                                {/* Card 1: Details Card (Image, Title, Description) */}
                                <div className="grow flex flex-col bg-white rounded-t-2xl rounded-br-2xl border border-neutral-200/80 border-b-0 shadow-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.025)] transition-all duration-300">
                                  {/* Food Photo Box */}
                                  <div className="relative w-full aspect-4/3 shrink-0 bg-neutral-100 overflow-hidden rounded-t-2xl">
                                    <Image
                                      src={item.image}
                                      alt={item.name}
                                      fill
                                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                                      sizes="(max-width: 640px) 180px, 240px"
                                    />
                                    {item.popular && (
                                      <div className="absolute top-2.5 left-2.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full z-10 shadow-sm">
                                        Popular
                                      </div>
                                    )}
                                  </div>

                                  {/* Food Info details */}
                                  <div className="grow p-3.5 flex flex-col justify-between">
                                    <div>
                                      <h4 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                                        {item.name}
                                      </h4>
                                      <p className="text-[11px] sm:text-xs text-neutral-500 font-semibold leading-relaxed mt-1">
                                        {item.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Card 2: Two horizontal cards — Price card & Button card */}
                                <div className="flex gap-1">
                                  {/* Price Card */}
                                  <div className="flex-1 bg-white rounded-b-2xl border border-t-0 border-neutral-200/80 shadow-sm flex items-center justify-center h-10 px-3 group-hover:border-neutral-300 transition-colors duration-300">
                                    <span className="text-xs sm:text-sm font-black text-deep-emerald-950">
                                      ${item.price.toFixed(2)}
                                    </span>
                                  </div>

                                  {/* Button Card */}
                                  <div className="mt-1 bg-white rounded-xl rounded-tl-none border border-neutral-200/80 shadow-sm flex items-center justify-center h-10 group-hover:border-neutral-300 transition-colors duration-300 btn-bubble">
                                    {qtyInCart > 0 ? (
                                      <div className="flex items-center gap-1.5 px-2.5">
                                        <button
                                          onClick={() => {
                                            removeFromCart(item.id);
                                          }}
                                          className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors text-white"
                                          style={{
                                            backgroundColor: `${primaryColor}22`,
                                            color: primaryColor,
                                          }}
                                        >
                                          <Minus className="w-2.5 h-2.5" />
                                        </button>
                                        <span
                                          className="text-xs font-black min-w-[14px] text-center"
                                          style={{ color: primaryColor }}
                                        >
                                          {qtyInCart}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            triggerBubbleEffect(e);
                                            addToCart(item.id);
                                          }}
                                          className="w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer transition-all duration-200"
                                          style={{ backgroundColor: primaryColor }}
                                        >
                                          <Plus className="w-2.5 h-2.5 relative z-10" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          triggerBubbleEffect(e);
                                          addToCart(item.id);
                                        }}
                                        className="w-10 h-full flex items-center justify-center bg-transparent hover:scale-110 transition-all duration-200 cursor-pointer active:scale-95"
                                        style={{ color: primaryColor }}
                                        title="Add to Cart"
                                      >
                                        <Plus className="w-3.5 h-3.5 relative z-10" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // ──── 4. GRID LAYOUT (DEFAULT) ───────────────────────────────
                        return (
                          <div key={item.id} className="flex flex-col h-full group food-card">
                            {/* Card 1: Details Card (Image, Title, Description) */}
                            <div className="grow flex flex-col bg-white rounded-t-2xl rounded-br-2xl border border-neutral-200/80 border-b-0 shadow-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.025)] transition-all duration-300">
                              {/* Food Photo Box */}
                              <div className="relative w-full aspect-4/3 shrink-0 bg-neutral-100 overflow-hidden rounded-t-2xl">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  sizes="(max-width: 640px) 180px, 240px"
                                />
                                {item.popular && (
                                  <div className="absolute top-2.5 left-2.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full z-10 shadow-sm">
                                    Popular
                                  </div>
                                )}
                              </div>

                              {/* Food Info details */}
                              <div className="grow p-3.5 flex flex-col justify-between">
                                <div>
                                  <h4 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                                    {item.name}
                                  </h4>
                                  <p className="text-[11px] sm:text-xs text-neutral-500 font-semibold leading-relaxed mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Card 2: Two horizontal cards — Price card & Button card */}
                            <div className="flex gap-1">
                              {/* Price Card — no top gap, flush with details card */}
                              <div className="flex-1 bg-white rounded-b-2xl border border-t-0 border-neutral-200/80 shadow-sm flex items-center justify-center h-10 px-3 group-hover:border-neutral-300 transition-colors duration-300">
                                <span className="text-xs sm:text-sm font-black text-deep-emerald-950">
                                  ${item.price.toFixed(2)}
                                </span>
                              </div>

                              {/* Button Card — keeps top gap */}
                              <div className="mt-1 bg-white rounded-xl rounded-tl-none border border-neutral-200/80 shadow-sm flex items-center justify-center h-10 group-hover:border-neutral-300 transition-colors duration-300 btn-bubble">
                                {qtyInCart > 0 ? (
                                  <div className="flex items-center gap-1.5 px-2.5">
                                    <button
                                      onClick={() => {
                                        removeFromCart(item.id);
                                      }}
                                      className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors text-white"
                                      style={{
                                        backgroundColor: `${primaryColor}22`,
                                        color: primaryColor,
                                      }}
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span
                                      className="text-xs font-black min-w-[14px] text-center"
                                      style={{ color: primaryColor }}
                                    >
                                      {qtyInCart}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        triggerBubbleEffect(e);
                                        addToCart(item.id);
                                      }}
                                      className="w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer transition-all duration-200"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      <Plus className="w-2.5 h-2.5 relative z-10" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      triggerBubbleEffect(e);
                                      addToCart(item.id);
                                    }}
                                    className="w-10 h-full flex items-center justify-center bg-transparent hover:scale-110 transition-all duration-200 cursor-pointer active:scale-95"
                                    style={{ color: primaryColor }}
                                    title="Add to Cart"
                                  >
                                    <Plus className="w-3.5 h-3.5 relative z-10" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: About Details */}
              {activeTab === "about" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm flex flex-col gap-6 w-full">
                  {/* Category block */}
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2 mb-3">
                      <Info className="w-5 h-5 text-neutral-500" />
                      <span>Restaurant Information</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                      {restaurant.descriptionText ? (
                        renderFormattedText(restaurant.descriptionText)
                      ) : (
                        <>
                          Welcome to{" "}
                          <strong className="text-neutral-800 font-bold">{restaurant.name}</strong>,
                          where we specialize in serving premium quality{" "}
                          {restaurant.cuisine.toLowerCase()} options in{" "}
                          {branchAddress || restaurant.location}. Our digital ordering platform
                          enables customers to scan table QR codes to enjoy immediate kitchen
                          preparation status tracking and side payment checkout simulations.
                        </>
                      )}
                    </p>
                  </div>

                  {/* List Details Group */}
                  <div className="border-t border-neutral-100 pt-5 flex flex-col gap-4 text-xs sm:text-sm font-semibold text-neutral-600">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col text-left">
                        <span className="text-neutral-900 font-bold">Address / Location</span>
                        <span className="text-neutral-500 mt-0.5">
                          {branchAddress || restaurant.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col text-left">
                        <span className="text-neutral-900 font-bold">Opening Hours</span>
                        <span className="text-neutral-500 mt-0.5">
                          {branchHours ||
                            restaurant.operatingHours ||
                            "Open Daily: 11:00 AM - 11:00 PM"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col text-left">
                        <span className="text-neutral-900 font-bold">Phone Number</span>
                        {branchPhone ? (
                          <a
                            href={`tel:${branchPhone}`}
                            className="text-emerald-700 font-bold hover:underline mt-0.5"
                          >
                            {branchPhone}
                          </a>
                        ) : (
                          <span className="text-neutral-500 mt-0.5">Not available</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col text-left">
                        <span className="text-neutral-900 font-bold">Additional Facilities</span>
                        <span className="text-neutral-500 mt-0.5">
                          {restaurant.facilities || "Wifi, Table QR ordering"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Customer Reviews */}
              {activeTab === "reviews" && (
                <div className="flex flex-col gap-4 w-full">
                  {/* Overall Rating card */}
                  <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col sm:flex-row items-center gap-6 w-full">
                    <div className="flex flex-col items-center justify-center text-center px-4">
                      <span className="text-4xl sm:text-5xl font-black text-neutral-900 tracking-tight leading-none">
                        {restaurant.rating}
                      </span>
                      <div className="flex items-center gap-0.5 text-amber-500 mt-2.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="w-4.5 h-4.5 fill-current" />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-neutral-400 mt-1.5 uppercase tracking-wider">
                        {restaurant.reviews} ratings
                      </span>
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-2 border-t sm:border-t-0 sm:border-l border-neutral-100 pt-4 sm:pt-0 sm:pl-6 text-left">
                      <h3 className="text-sm sm:text-base font-black text-neutral-950 tracking-tight">
                        Rating Breakdown
                      </h3>
                      {/* Stars bar breakdown */}
                      {[
                        { stars: 5, pct: "85%" },
                        { stars: 4, pct: "10%" },
                        { stars: 3, pct: "4%" },
                        { stars: 2, pct: "1%" },
                        { stars: 1, pct: "0%" },
                      ].map((row) => (
                        <div
                          key={row.stars}
                          className="flex items-center gap-3 w-full text-xs font-semibold text-neutral-500"
                        >
                          <span className="w-3 text-right">{row.stars}</span>
                          <div className="grow h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: row.pct }}
                            />
                          </div>
                          <span className="w-8 text-right">{row.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Review Feed list */}
                  <div className="flex flex-col gap-4 w-full">
                    {reviewsList.map((rev, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col gap-3.5 text-left"
                      >
                        {/* Reviewer Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-250 relative bg-neutral-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={rev.avatar}
                                className="object-cover w-full h-full"
                                alt={rev.author}
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs sm:text-sm font-black text-neutral-900 leading-tight">
                                {rev.author}
                              </span>
                              <span className="text-[10px] font-bold text-neutral-400 mt-0.5">
                                {rev.date}
                              </span>
                            </div>
                          </div>

                          {/* Stars indicator */}
                          <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < rev.stars ? "fill-amber-500" : "text-neutral-200 fill-none"}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Review Comment Text */}
                        <p className="text-xs sm:text-sm text-neutral-600 font-semibold leading-relaxed">
                          &quot;{rev.text}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Orders List */}
              {activeTab === "orders" && (
                <div className="flex flex-col gap-4 w-full text-left">
                  <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm flex flex-col gap-5">
                    <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2 border-b border-neutral-100 pb-3">
                      <ClipboardList className="w-5 h-5 text-emerald-600" />
                      <span>Your Orders</span>
                    </h3>

                    {orders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                        <ClipboardList className="w-12 h-12 text-neutral-300 animate-pulse" />
                        <h4 className="text-base font-bold text-neutral-800">
                          No active orders yet
                        </h4>
                        <p className="text-xs sm:text-sm text-neutral-500 max-w-xs font-semibold leading-relaxed">
                          Add delicious items from our menu to your bag and place your order!
                        </p>
                        <button
                          onClick={() => setActiveTab("menu")}
                          className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full cursor-pointer transition-colors shadow-sm active:scale-95 duration-150"
                        >
                          Browse Menu
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            className="bg-neutral-50 border border-neutral-200/70 rounded-2xl p-4 flex flex-col gap-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between border-b border-neutral-200/40 pb-2">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-neutral-800">
                                  {order.id}
                                </span>
                                <span className="text-[10px] font-bold text-neutral-400 mt-0.5">
                                  {order.time}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                  {order.status}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {order.items.map((itemEntry) => (
                                <div
                                  key={itemEntry.item.id}
                                  className="flex justify-between items-center text-xs text-neutral-600"
                                >
                                  <span className="font-semibold">
                                    {itemEntry.item.name}{" "}
                                    <span className="text-neutral-400 font-bold ml-1">
                                      x{itemEntry.quantity}
                                    </span>
                                  </span>
                                  <span className="font-bold text-neutral-800">
                                    ${(itemEntry.item.price * itemEntry.quantity).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="border-t border-neutral-200/40 pt-2.5 flex justify-between items-center font-bold text-sm text-neutral-800">
                              <span>Total Amount</span>
                              <span className="text-emerald-700 font-black">
                                ${order.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Floating Bottom Cart Drawer */}
        {totalItems > 0 && isCartExpanded && (
          <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-3xl z-40 bg-white border border-neutral-200/85 rounded-t-[28px] md:rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.06)] transition-all duration-300 pb-safe">
            {/* Inner constraint */}
            <div className="max-w-3xl mx-auto flex flex-col px-6 py-5">
              {/* Expandable Cart Items list container */}
              <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto divide-y divide-neutral-50 animate-in slide-in-from-bottom-8 duration-300">
                {cartItemsList.map((entry) => (
                  <div
                    key={entry.item.id}
                    className="flex items-center justify-between pt-3 first:pt-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                      {/* Food Item Image */}
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-100 border border-neutral-200">
                        <Image
                          src={entry.item.image}
                          alt={entry.item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-sm font-bold text-neutral-900 truncate">
                          {entry.item.name}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600">
                          ${(entry.item.price * entry.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector inside cart */}
                    <div className="flex items-center gap-2.5 bg-neutral-100 rounded-full p-1 border border-neutral-200/40">
                      <button
                        onClick={() => removeFromCart(entry.item.id)}
                        className="w-6 h-6 rounded-full bg-white hover:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700 cursor-pointer transition-colors"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center text-neutral-800">
                        {entry.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(entry.item.id)}
                        className="w-6 h-6 rounded-full bg-white hover:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700 cursor-pointer transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm Order Button Section */}
              <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col gap-3">
                <div className="flex justify-between items-center px-1 text-sm font-bold text-neutral-800">
                  <span>Total Amount:</span>
                  <span className="text-emerald-700 text-base font-extrabold">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="w-full bg-deep-emerald-950 hover:bg-deep-emerald-850 text-white text-sm font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-98 shadow-md cursor-pointer"
                >
                  <span>Confirm & Place Order</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Simulated Successful Checkout modal */}
        {orderPlaced && (
          <div className="fixed inset-0 bg-deep-emerald-950/70 backdrop-blur-md z-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full flex flex-col items-center text-center gap-6 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in duration-300">
              {/* Green Animated Checkmark */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce shadow-inner border border-emerald-100">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-black text-neutral-950 tracking-tight leading-tight">
                  Order Received!
                </h3>
                <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-1.5 bg-emerald-50/70 px-3 py-1 rounded-full w-fit mx-auto border border-emerald-100/50">
                  Table #{tableNumber}
                </p>
                <p className="text-[13px] font-semibold text-neutral-500 leading-relaxed mt-4">
                  Your order is confirmed and has been routed to the kitchen display at{" "}
                  <strong className="text-neutral-800">{restaurant.name}</strong>. Sit back and
                  relax while your food is prepared!
                </p>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => setOrderPlaced(false)}
                className="w-full bg-deep-emerald-950 hover:bg-deep-emerald-850 text-white text-sm font-bold py-3 rounded-2xl transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
              >
                Order Something Else
              </button>
            </div>
          </div>
        )}

        {/* Action Toast Notifications overlay */}
        {actionToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <Toast
              text={actionToast.text}
              subText={actionToast.subText}
              type={actionToast.type}
              onClose={() => setActionToast(null)}
            />
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden select-none filter drop-shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
          {/* Combined Background Shape */}
          <div className="relative w-full h-[72px] flex">
            {/* Left Part */}
            <div className="flex-1 bg-white rounded-tl-[24px] mr-[-2px]" />
            {/* Center Curved Part */}
            <svg
              className="w-[90px] h-[72px] shrink-0"
              viewBox="0 0 90 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 0 0 C 17 0, 17 44, 45 44 C 73 44, 73 0, 90 0 L 90 72 L 0 72 Z"
                fill="white"
              />
            </svg>
            {/* Right Part */}
            <div className="flex-1 bg-white rounded-tr-[24px] ml-[-2px]" />
          </div>

          {/* Safe Area Fillers */}
          <div className="w-full flex h-[env(safe-area-inset-bottom)] -mt-0.5">
            {/* Left Part */}
            <div className="flex-1 bg-white mr-[-2px]" />
            {/* Center Curved Part Spacer */}
            <div className="w-[90px] bg-transparent shrink-0" />
            {/* Right Part */}
            <div className="flex-1 bg-white ml-[-2px]" />
          </div>

          {/* Buttons Overlay */}
          <div className="absolute top-0 left-0 right-0 h-[72px] flex items-center">
            {/* Left Side Buttons */}
            <div className="flex-1 flex justify-around pr-4">
              {leftNavItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={tab.onClick}
                    className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-200 cursor-pointer active:scale-95 ${
                      tab.isActive ? "font-extrabold" : "text-[#b3b3b3] font-medium"
                    }`}
                    style={tab.isActive ? { color: primaryColor } : {}}
                  >
                    <Icon className="w-5.5 h-[18px]" />
                    <span className="text-[11px] tracking-tight leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Center FAB Button */}
            <div className="relative w-[72px] h-full flex justify-center items-start">
              <button
                onClick={() => {
                  if (totalItems > 0) {
                    setIsCartExpanded(!isCartExpanded);
                  }
                }}
                className="absolute -top-5 w-14 h-14 bg-[#1a1a1a] hover:bg-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all duration-255 cursor-pointer group"
                title="Cart"
              >
                <ShoppingBag className="w-5 h-5 text-white transition-transform group-hover:scale-105" />
                {totalItems > 0 && (
                  <span
                    className="absolute -top-1 -right-1 text-white text-[9.5px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1a1a1a] shadow-sm animate-in zoom-in duration-200"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {totalItems}
                  </span>
                )}
              </button>
            </div>

            {/* Right Side Buttons */}
            <div className="flex-1 flex justify-around pl-4">
              {rightNavItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={tab.onClick}
                    className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-200 cursor-pointer active:scale-95 ${
                      tab.isActive ? "font-extrabold" : "text-[#b3b3b3] font-medium"
                    }`}
                    style={tab.isActive ? { color: primaryColor } : {}}
                  >
                    <Icon className="w-5.5 h-[18px]" />
                    <span className="text-[11px] tracking-tight leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </EmojiProvider>
  );
}
