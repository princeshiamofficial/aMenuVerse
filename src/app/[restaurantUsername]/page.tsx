"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  getRestaurantData,
  getRestaurantStatusBySlug,
  placeOrderAction,
  getBranchesServer,
  getCategoriesServer,
  getFoodItemsServer,
  getRestaurantProfile,
  recordAnalyticsEventServer,
  getPublicActivePromotionsServer,
  getPublicOrderStatusesServer,
} from "@/lib/db-queries.server";
import { RESTAURANTS, Restaurant, MenuItem, Branch } from "@/lib/restaurants-data";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import {
  decodeTableToken,
  toISODateString,
  isTimeInWindow,
  getCurrencySymbol,
  generateId,
  updateDynamicFavicon,
  updateDynamicTitle,
} from "@/lib/utils";
import { useRealtime, playChime } from "@/lib/use-realtime";
import { BlobImg } from "@/components/ui/blob-img";
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
  User,
  Info,
  ThumbsUp,
  Share2,
  Calendar,
  Utensils,
  ClipboardList,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Sparkles,
  ChefHat,
  Flame,
  Timer,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  Bell,
} from "lucide-react";
import { FoodCard } from "@/components/menuverse/food-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppleEmoji } from "@/components/menuverse/apple-emoji";
import { GoogleAvatar } from "@/components/menuverse/google-avatar";
import { scrapeGoogleMapsReviewsServer } from "@/lib/google-scraper.server";
import {
  GOOGLE_MAPS_REVIEWS,
  COLOR_HUT_GOOGLE_MAPS_REVIEWS,
  GOOGLE_MAPS_URL,
  getGoogleRatingSummary,
  GoogleReview,
} from "@/lib/google-reviews";

// =========================================================
// INLINE UTILS & COMPONENTS
// =========================================================

function useHorizontalScroll() {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return elRef;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function OrderInlineTimer({
  status,
  prepStartedAt,
  estimatedPrepMinutes,
  orderTime,
}: {
  status: string;
  prepStartedAt?: string;
  estimatedPrepMinutes?: number;
  orderTime: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const st = (status || "pending").toLowerCase();
  const estMins = estimatedPrepMinutes && estimatedPrepMinutes > 0 ? estimatedPrepMinutes : 15;
  const startMs = prepStartedAt ? new Date(prepStartedAt).getTime() : now;
  const totalDurationMs = estMins * 60 * 1000;
  const elapsedMs = Math.max(0, now - startMs);
  const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
  const remainingSecs = Math.floor(remainingMs / 1000);
  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const isFinished = remainingSecs <= 0;

  if (st === "preparing") {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-amber-700">
          <Timer className="w-4 h-4 text-amber-600 animate-pulse" />
          <span className="text-sm font-black font-mono tracking-tight text-neutral-900">
            {isFinished ? (
              <span className="text-orange-600 animate-pulse text-xs font-black">
                Almost Ready!
              </span>
            ) : (
              `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
            )}
          </span>
        </div>
        <span className="text-[10px] font-bold text-neutral-400 mt-0.5">{orderTime}</span>
      </div>
    );
  }

  if (st === "ready") {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
          <span className="text-xs font-black tracking-tight">Ready to Serve! 🍽️</span>
        </div>
        <span className="text-[10px] font-bold text-neutral-400 mt-0.5">{orderTime}</span>
      </div>
    );
  }

  if (st === "completed") {
    return (
      <div className="flex flex-col">
        <span className="text-xs font-black text-neutral-800">Order Completed</span>
        <span className="text-[10px] font-bold text-neutral-400 mt-0.5">{orderTime}</span>
      </div>
    );
  }

  // Pending / default
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-neutral-800">
        <Clock className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-xs font-black">Order Placed</span>
      </div>
      <span className="text-[10px] font-bold text-neutral-400 mt-0.5">{orderTime}</span>
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

function Button({ children, className = "", onClick, ...props }: ButtonProps) {
  const [animate, setAnimate] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.classList.remove("animate");
    void el.offsetWidth; // trigger reflow
    el.classList.add("animate");

    setAnimate(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setAnimate(false);
    }, 600);

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "btn-bubble px-6 py-3 rounded-lg border-none text-white cursor-pointer bg-[#ff7a00] hover:bg-[#e56d00] transition-all duration-200 active:scale-95 text-xs font-bold leading-none select-none font-sans shadow-sm hover:shadow-md",
        animate && "animate",
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-[inherit] pointer-events-none">
        {children}
      </span>
    </button>
  );
}

interface ToastProps {
  text: string;
  subText?: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}

function Toast({ text, type = "success", onClose }: ToastProps) {
  const isError = type === "error";

  return (
    <div className="w-82.5 h-20 rounded-lg p-2.5 px-3.5 bg-white shadow-[rgba(149,157,165,0.2)_0px_8px_24px] relative overflow-hidden flex items-center justify-between gap-3.5 border border-neutral-100/85 text-left">
      <svg
        className="absolute rotate-90 -left-7.75 top-8 w-20 pointer-events-none"
        viewBox="0 0 1440 320"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          fill: isError ? "rgba(252, 12, 12, 0.22)" : "rgba(16, 185, 129, 0.22)",
        }}
      >
        <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z" />
      </svg>

      <div
        className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 ml-1"
        style={{
          backgroundColor: isError ? "rgba(252, 12, 12, 0.2)" : "rgba(16, 185, 129, 0.2)",
        }}
      >
        {isError ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            fill="currentColor"
            className="w-4.25 h-4.25"
            style={{ color: "#d10d0d" }}
          >
            <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3.5"
            stroke="currentColor"
            className="w-4 h-4"
            style={{ color: "#047857" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        )}
      </div>

      <div className="flex flex-col justify-center items-start grow min-w-0 text-left pl-1.5">
        <p
          className="text-[13.5px] font-extrabold m-0 leading-tight truncate w-full"
          style={{
            color: isError ? "#d10d0d" : "#047857",
          }}
        >
          {isError ? "Error message" : "Success"}
        </p>
        <p
          className="text-[11.5px] font-semibold text-neutral-500 m-0 mt-0.5 leading-snug line-clamp-2"
          title={text}
        >
          {text}
        </p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 transition-colors p-1.5 rounded-md shrink-0 cursor-pointer hover:bg-neutral-50"
          aria-label="Dismiss notification"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            className="w-3.75 h-3.75"
          >
            <path
              fill="currentColor"
              d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

const getCategoryEmojiUnicode = (category: string): string => {
  const map: Record<string, string> = {
    all: "🍽️",
    popular: "🔥",
    burgers: "🍔",
    sides: "🍟",
    beverages: "🥤",
    pizza: "🍕",
    pasta: "🍝",
    desserts: "🍰",
    sushi: "🍣",
    ramen: "🍜",
    appetizers: "🥟",
    mains: "🍲",
    "rice & noodles": "🍛",
  };
  return map[category.trim().toLowerCase()] || "✨";
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

// =========================================================
// DATA FETCHING & ROUTING
// =========================================================

interface SearchParams {
  table?: string;
  branch?: string;
}

export function PublicRestaurantSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50/60 pb-24 animate-pulse">
      {/* 1. Cover Photo Banner Skeleton */}
      <div className="w-full h-52 sm:h-72 md:h-80 bg-neutral-200/80 relative" />

      {/* 2. Restaurant Profile Header Skeleton */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-12 sm:-mt-16 mb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            {/* Logo Avatar Skeleton */}
            <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white shadow-md bg-neutral-300 shrink-0" />
            <div className="flex flex-col gap-2 pb-1">
              <Skeleton className="h-7 w-48 sm:w-64 rounded-lg bg-neutral-300" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
                <Skeleton className="h-4 w-28 rounded-full bg-neutral-200" />
                <Skeleton className="h-4 w-20 rounded-full bg-neutral-200" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Skeleton className="h-10 w-28 rounded-xl bg-neutral-200 shrink-0" />
            <Skeleton className="h-10 w-28 rounded-xl bg-neutral-200 shrink-0" />
          </div>
        </div>

        {/* 3. Navigation Tabs Bar Skeleton */}
        <div className="border-b border-neutral-200/80 mb-6 flex gap-6">
          <Skeleton className="h-9 w-20 rounded-lg bg-neutral-300" />
          <Skeleton className="h-9 w-20 rounded-lg bg-neutral-200" />
          <Skeleton className="h-9 w-20 rounded-lg bg-neutral-200" />
        </div>

        {/* 4. Sticky Category Pills Skeleton */}
        <div className="flex gap-2.5 overflow-x-auto py-2 mb-6 scrollbar-none">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-9 rounded-full bg-neutral-200 shrink-0 ${
                i === 0 ? "w-20 bg-neutral-300" : i % 2 === 0 ? "w-28" : "w-24"
              }`}
            />
          ))}
        </div>

        {/* 5. Search Bar & Food Grid Skeleton */}
        <div className="mb-6 flex justify-between items-center gap-4">
          <Skeleton className="h-10 w-full max-w-sm rounded-xl bg-neutral-200" />
          <Skeleton className="h-8 w-24 rounded-lg bg-neutral-200 hidden sm:block" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-neutral-200/70 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col gap-3"
            >
              <Skeleton className="w-full aspect-4/3 rounded-xl bg-neutral-200" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4.5 w-4/5 rounded-md bg-neutral-300" />
                <Skeleton className="h-3.5 w-full rounded-md bg-neutral-200" />
                <Skeleton className="h-3.5 w-2/3 rounded-md bg-neutral-200" />
              </div>
              <div className="flex justify-between items-center pt-1 mt-auto">
                <Skeleton className="h-5 w-16 rounded-md bg-neutral-300" />
                <Skeleton className="h-8 w-8 rounded-full bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// MAIN PAGE COMPONENT
// =========================================================

export default function PublicRestaurantPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const pathSlug = (pathname || "").split("/").filter(Boolean)[0] || "";
  const paramSlug = (params?.restaurantUsername as string) || "";
  const restaurantUsername = (paramSlug || pathSlug || "bellapizza").toLowerCase().trim();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [suspendedName, setSuspendedName] = useState("");

  const tableNumber =
    searchParams.get("table") ||
    searchParams.get("t") ||
    searchParams.get("tableNo") ||
    searchParams.get("tn") ||
    "";
  const branchId = searchParams.get("branch") || "";

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3500);

    async function load() {
      if (!restaurantUsername) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const fresh = await fetchPublicMenu(restaurantUsername);
        if (fresh && isMounted) {
          setRestaurant(fresh);
          if (fresh.name) updateDynamicTitle(`${fresh.name} — Digital Menu`);
          const fav =
            (fresh as unknown as { favicon?: string }).favicon || fresh.logoImage || fresh.image;
          if (fav) updateDynamicFavicon(fav);
        }
      } catch (err) {
        console.warn("[PublicMenu] load error:", err);
      } finally {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }
    load();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [restaurantUsername]);

  if (loading && !restaurant) {
    return <PublicRestaurantSkeleton />;
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Restaurant not found</h1>
        <p className="mt-2 text-muted-foreground">
          No active restaurant matches "{restaurantUsername}".
        </p>
        <Link href="/" className="mt-4 inline-block underline text-primary">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={suspended ? "pointer-events-none select-none blur-sm brightness-50" : ""}>
        <PublicRestaurantView
          initialRestaurant={restaurant}
          restaurantUsername={restaurantUsername}
          tableNumber={tableNumber}
          branchId={branchId}
        />
      </div>
      {suspended && <SuspendedOverlay name={suspendedName || restaurant.name} />}
    </div>
  );
}

// =========================================================
// SUSPENDED OVERLAY — non-closeable, covers entire page
// =========================================================

function SuspendedOverlay({ name }: { name: string }) {
  // Prevent scroll and keyboard escape
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleKey, true);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
          Restaurant Suspended
        </h2>
        <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">{name}</p>

        {/* Divider */}
        <div className="mb-4 border-t border-gray-200 dark:border-gray-700" />

        {/* Reason */}
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          This restaurant has been <strong>temporarily suspended</strong> by the platform
          administrator. All menu and ordering services are currently unavailable.
        </p>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          If you are the restaurant owner, please contact{" "}
          <a href="mailto:support@amenuverse.com" className="text-amber-600 underline">
            support@amenuverse.com
          </a>{" "}
          to resolve this issue.
        </p>
      </div>
    </div>
  );
}

export function PublicRestaurantView({
  initialRestaurant,
  restaurantUsername,
  tableNumber = "",
  branchId = "",
}: {
  initialRestaurant: Restaurant;
  restaurantUsername: string;
  tableNumber?: string;
  branchId?: string;
}) {
  const [liveRestaurant, setLiveRestaurant] = useState<Restaurant>(() => initialRestaurant);

  useEffect(() => {
    if (initialRestaurant) {
      setLiveRestaurant((prev) => ({
        ...prev,
        ...initialRestaurant,
        image: initialRestaurant.image || prev.image,
        logoImage: initialRestaurant.logoImage || prev.logoImage,
      }));
    }
  }, [initialRestaurant]);

  const restaurant = liveRestaurant;
  const [serverCurrency, setServerCurrency] = useState<string | null>(
    (restaurant as unknown as { currency?: string })?.currency || null,
  );

  const activeCurrency = useMemo(() => {
    return serverCurrency || (restaurant as unknown as { currency?: string })?.currency || "BDT";
  }, [serverCurrency, restaurant]);

  const cs = useMemo(() => getCurrencySymbol(String(activeCurrency)), [activeCurrency]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");

  const [prevRestaurantId, setPrevRestaurantId] = useState(restaurant?.id);
  if (restaurant?.id !== prevRestaurantId) {
    setPrevRestaurantId(restaurant?.id);
    setCurrentSlide(0);
    setPrevSlide(null);
    setSlideDirection("next");
  }

  useEffect(() => {
    if (!restaurant || typeof document === "undefined") return;

    // 1. Dynamic document title
    if (restaurant.name) {
      updateDynamicTitle(`${restaurant.name} — Digital Menu`);
    }

    // 2. Dynamic Favicon injection
    const faviconUrl =
      (restaurant as unknown as { favicon?: string }).favicon ||
      restaurant.logoImage ||
      (restaurant as unknown as Record<string, string>).logo_url ||
      (typeof restaurant.logo === "string" && restaurant.logo.startsWith("http")
        ? restaurant.logo
        : "") ||
      restaurant.image ||
      "";

    if (faviconUrl) {
      updateDynamicFavicon(faviconUrl);
    }

    // 3. Dynamic OG & Twitter Image meta tag injection
    const ogImageUrl =
      (restaurant as unknown as { socialPreview?: string }).socialPreview ||
      restaurant.image ||
      restaurant.logoImage ||
      faviconUrl;

    if (ogImageUrl) {
      let ogMeta = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
      if (!ogMeta) {
        ogMeta = document.createElement("meta");
        ogMeta.setAttribute("property", "og:image");
        document.head.appendChild(ogMeta);
      }
      ogMeta.content = ogImageUrl;

      let twitterMeta = document.querySelector<HTMLMetaElement>("meta[name='twitter:image']");
      if (!twitterMeta) {
        twitterMeta = document.createElement("meta");
        twitterMeta.setAttribute("name", "twitter:image");
        document.head.appendChild(twitterMeta);
      }
      twitterMeta.content = ogImageUrl;
    }
  }, [restaurant]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        restaurant?.isPushEnabled !== false
      ) {
        import("@/lib/push-notifications").then((m) => {
          m.subscribeToPushNotifications({
            restaurantId: restaurant.id || restaurantUsername,
            role: "customer",
          }).catch(() => {});
        });
      }
    }

    let unsubListener: (() => void) | undefined;
    import("@/lib/push-notifications").then((m) => {
      unsubListener = m.setupPushNotificationListener();
    });

    return () => {
      if (unsubListener) unsubListener();
    };
  }, [restaurant.id, restaurantUsername]);

  const initialItems = useMemo(() => {
    if (restaurant?.menuItems && restaurant.menuItems.length > 0) {
      return restaurant.menuItems;
    }
    return [];
  }, [restaurant]);

  const initialCats = useMemo(() => {
    if (restaurant?.categories && restaurant.categories.length > 0) {
      return restaurant.categories.map((c) => {
        const catObj = c as { id?: string; name: string; emoji?: string; icon?: string };
        return {
          id: catObj.id || catObj.name.toLowerCase(),
          name: catObj.name,
          icon: catObj.emoji || catObj.icon || "🍽️",
        };
      });
    }
    return [];
  }, [restaurant]);

  const [localBranches, setLocalBranches] = useState<Branch[]>(() => restaurant?.branches || []);
  const [adminCategories, setAdminCategories] = useState<
    Array<{ id: string; name: string; icon?: string }>
  >(() => initialCats);
  const [adminFoodItems, setAdminFoodItems] = useState<MenuItem[]>(() => initialItems);

  useEffect(() => {
    if (restaurant?.menuItems && restaurant.menuItems.length > 0) {
      setAdminFoodItems(restaurant.menuItems);
    }
    if (restaurant?.categories && restaurant.categories.length > 0) {
      setAdminCategories(
        restaurant.categories.map((c) => {
          const catObj = c as { id?: string; name: string; emoji?: string; icon?: string };
          return {
            id: catObj.id || catObj.name.toLowerCase(),
            name: catObj.name,
            icon: catObj.emoji || catObj.icon || "🍽️",
          };
        }),
      );
    }
  }, [restaurant]);
  const [serverPromotions, setServerPromotions] = useState<
    Array<{
      id: string;
      name: string;
      kind?: string;
      discountPercent: number;
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      image?: string;
      description?: string;
      showPopup?: boolean;
      branchName?: string;
      branchId?: string;
      createdByRole?: string;
      createdByUserId?: string;
      targetScope?: "all" | "items" | "categories";
      categoryNames?: string[];
      itemIds?: string[];
      active?: boolean;
      enabled?: boolean;
      status?: string;
    }>
  >([]);
  const [promoPopupOpen, setPromoPopupOpen] = useState(false);

  const [isMenuLoading, setIsMenuLoading] = useState(
    () => initialItems.length === 0 && initialCats.length === 0,
  );
  const [isCategorySwitching, setIsCategorySwitching] = useState(false);

  useEffect(() => {
    async function loadAdminMenuData() {
      // Fetch directly from MySQL Database Server Functions (including promotional discount prices)
      try {
        const [dbData, dbCategories, dbItems, dbProfile, dbPromos] = await Promise.all([
          getRestaurantData({ data: restaurantUsername }),
          getCategoriesServer({ data: restaurantUsername }),
          getFoodItemsServer({ data: restaurantUsername }),
          getRestaurantProfile({ data: restaurantUsername }).catch(() => null),
          getPublicActivePromotionsServer({
            data: { restaurantSlug: restaurantUsername },
          }).catch(() => []),
        ]);

        const resData = dbData as Record<string, unknown> | null;
        const fetchedCurrency =
          (dbProfile as Record<string, unknown>)?.currency ||
          (resData as Record<string, unknown>)?.currency;
        if (fetchedCurrency && typeof fetchedCurrency === "string") {
          setServerCurrency(fetchedCurrency);
        }
        // Load live MySQL promotions — this is the authoritative source
        if (dbPromos && Array.isArray(dbPromos) && dbPromos.length > 0) {
          setServerPromotions(dbPromos as unknown as typeof serverPromotions);
        } else if (resData && resData.promotions && Array.isArray(resData.promotions)) {
          setServerPromotions(resData.promotions as unknown as typeof serverPromotions);
        }

        const dynamicFavicon =
          (dbProfile as Record<string, unknown>)?.favicon ||
          (dbProfile as Record<string, unknown>)?.logo ||
          (dbData as Record<string, unknown>)?.favicon ||
          (dbData as Record<string, unknown>)?.logoImage ||
          (dbData as Record<string, unknown>)?.logo_url;

        if (dynamicFavicon) {
          updateDynamicFavicon(String(dynamicFavicon));
        }

        const realCover =
          (dbProfile as Record<string, unknown>)?.cover ||
          (dbData as Record<string, unknown>)?.image ||
          (dbData as Record<string, unknown>)?.cover;
        const realLogo =
          (dbProfile as Record<string, unknown>)?.logo ||
          (dbData as Record<string, unknown>)?.logoImage ||
          (dbData as Record<string, unknown>)?.logo_url;
        const realName =
          (dbProfile as Record<string, unknown>)?.name ||
          (dbData as Record<string, unknown>)?.name;

        if (realCover || realLogo || realName) {
          setLiveRestaurant((prev) => ({
            ...prev,
            ...(realName ? { name: String(realName) } : {}),
            ...(realCover ? { image: String(realCover) } : {}),
            ...(realLogo ? { logoImage: String(realLogo) } : {}),
          }));
        }

        if (
          resData &&
          resData.menuItems &&
          Array.isArray(resData.menuItems)
        ) {
          setAdminFoodItems(resData.menuItems as MenuItem[]);
        } else if (dbItems && Array.isArray(dbItems)) {
          const mapped: MenuItem[] = dbItems.map((item) => ({
            id: String(item.id || generateId()),
            name: String(item.name || "Food Item"),
            description: String(item.shortDescription || item.longDescription || ""),
            price: Number(item.price) || 0,
            discountPrice: item.discountPrice != null ? Number(item.discountPrice) : null,
            image: String(
              item.image ||
                (item as unknown as { imageUrl?: string; image_url?: string }).imageUrl ||
                (item as unknown as { image_url?: string }).image_url ||
                "",
            ),
            category: String(item.category || "General"),
            popular: Boolean(item.popular || item.bestSeller),
            trending: Boolean(item.popular || item.bestSeller),
          }));
          setAdminFoodItems(mapped);
        } else {
          setAdminFoodItems([]);
        }

        if (dbCategories && Array.isArray(dbCategories)) {
          setAdminCategories(dbCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })));
        } else {
          setAdminCategories([]);
        }
      } catch {
        /* ignore */
      } finally {
        setIsMenuLoading(false);
      }
    }

    const timer = setTimeout(() => {
      setIsMenuLoading(false);
    }, 2500);

    loadAdminMenuData().finally(() => clearTimeout(timer));

    return () => clearTimeout(timer);
  }, [restaurantUsername]);

  useEffect(() => {
    async function loadServerBranches() {
      try {
        const serverBranches = await getBranchesServer({ data: restaurantUsername });
        if (serverBranches && Array.isArray(serverBranches) && serverBranches.length > 0) {
          setLocalBranches(serverBranches as Branch[]);
        }
      } catch {
        /* ignore */
      }
    }
    loadServerBranches();
  }, [restaurantUsername]);

  useEffect(() => {
    // Record page view / QR scan analytics event in MySQL DB
    recordAnalyticsEventServer({
      data: {
        eventType: tableNumber ? "qr_scan" : "menu_view",
        restaurantId: String(restaurant?.id || restaurantUsername),
        branchId: branchId ? String(branchId) : undefined,
        tableNo: tableNumber ? String(tableNumber) : undefined,
      },
    }).catch(() => null);
  }, [restaurantUsername, restaurant?.id, branchId, tableNumber]);

  const allBranches = useMemo(() => {
    const list: Branch[] = [...localBranches];
    const seedBranches = restaurant?.branches || [];

    for (const seed of seedBranches) {
      const seedName = (seed.name || "").toLowerCase().trim();
      const seedCode = seedName
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toLowerCase();

      const exists = list.some((b) => {
        const bName = (b.name || "").toLowerCase().trim();
        const bCode = bName
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .toLowerCase();
        return (
          (b.id && seed.id && String(b.id).toLowerCase() === String(seed.id).toLowerCase()) ||
          bName === seedName ||
          (Boolean(bCode) && Boolean(seedCode) && bCode === seedCode)
        );
      });

      if (!exists) {
        list.push(seed);
      }
    }

    return list;
  }, [localBranches, restaurant]);

  const effectiveBranchId = useMemo(() => {
    if (branchId) return branchId;
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      // Format 1: /e/:token
      if (pathParts[0] === "e" && pathParts[1]) return pathParts[1];
      // Format 2: /:restaurantUsername/e/:token
      if (pathParts[1] === "e" && pathParts[2]) return pathParts[2];
      // Format 3: /:branchId/:tableId (Subdomain URL)
      if (
        pathParts.length >= 2 &&
        pathParts[0] !== "auth" &&
        pathParts[0] !== "dashboard" &&
        pathParts[0] !== "admin"
      ) {
        return pathParts[0];
      }
      // Format 4: /:restaurantUsername/:branchId/:tableId (Path-based URL)
      if (pathParts.length >= 3) {
        return pathParts[1];
      }
      const search = new URLSearchParams(window.location.search);
      return search.get("branch") || search.get("b") || "";
    }
    return "";
  }, [branchId]);

  const activeBranch = useMemo(() => {
    if (!effectiveBranchId) return null;
    const target = effectiveBranchId.toLowerCase().trim();
    const targetClean = target.replace(/^menu-/, "");

    return (
      allBranches.find((x: Branch) => {
        const id = (x.id || "").toLowerCase().trim();
        const name = (x.name || "").toLowerCase().trim();
        const slug = name.replace(/[^a-z0-9]+/g, "-");
        const menuId = (x.menuId || "")
          .toLowerCase()
          .replace(/^menu-/, "")
          .trim();

        return (
          id === target ||
          name === target ||
          slug === target ||
          id.startsWith(target) ||
          target.startsWith(id) ||
          (menuId &&
            (menuId === target ||
              menuId === targetClean ||
              target.includes(menuId) ||
              menuId.includes(target)))
        );
      }) || null
    );
  }, [effectiveBranchId, allBranches]);

  const currentBranch = useMemo(() => {
    if (activeBranch) return activeBranch;
    if (allBranches && allBranches.length === 1) {
      return allBranches[0];
    }
    return null;
  }, [activeBranch, allBranches]);

  const activeBranchPromotions = useMemo(() => {
    if (!serverPromotions || serverPromotions.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return serverPromotions.filter((p) => {
      if (p.active === false || p.enabled === false) return false;

      const sDate = toISODateString(p.startDate);
      const eDate = toISODateString(p.endDate);
      if (sDate && sDate > today) return false;
      if (eDate && eDate < today) return false;

      if (p.kind === "happy-hour" && p.startTime && p.endTime) {
        if (!isTimeInWindow(p.startTime, p.endTime)) return false;
      }

      const promoBranchName = (p.branchName || "").toLowerCase().trim();
      const promoBranchId = (p.branchId || "").toLowerCase().trim();
      const isAllBranches =
        (!promoBranchName && !promoBranchId) ||
        promoBranchName === "all" ||
        promoBranchId === "all" ||
        promoBranchName === "all branches" ||
        promoBranchId === "all branches";

      if (isAllBranches) return true;

      // If specific branch offer and no branch is selected on multi-branch restaurant, don't show
      const targetBranch = activeBranch || currentBranch;
      if (!targetBranch) return false;

      const targetBranchName = (targetBranch.name || "").toLowerCase().trim();
      const targetBranchId = (targetBranch.id || "").toLowerCase().trim();

      const promoBranchNames = promoBranchName
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const promoBranchIds = promoBranchId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const nameMatch = promoBranchNames.some(
        (bn) =>
          Boolean(bn) &&
          Boolean(targetBranchName) &&
          (bn === targetBranchName ||
            bn.includes(targetBranchName) ||
            targetBranchName.includes(bn)),
      );

      const idMatch = promoBranchIds.some(
        (bi) =>
          Boolean(bi) &&
          Boolean(targetBranchId) &&
          (bi === targetBranchId || bi.includes(targetBranchId) || targetBranchId.includes(bi)),
      );

      return nameMatch || idMatch;
    });
  }, [serverPromotions, activeBranch, currentBranch]);

  const popupPromo = useMemo(() => {
    if (!activeBranchPromotions || activeBranchPromotions.length === 0) return null;
    return activeBranchPromotions.find((p) => p.showPopup !== false) || activeBranchPromotions[0];
  }, [activeBranchPromotions]);

  useEffect(() => {
    if (popupPromo && popupPromo.showPopup !== false) {
      const timer = setTimeout(() => {
        setPromoPopupOpen(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [popupPromo]);

  const handleClosePromoPopup = () => {
    setPromoPopupOpen(false);
  };

  const branchAddress = useMemo(() => {
    if (activeBranch) {
      return (
        activeBranch.address ||
        (activeBranch as { location?: string }).location ||
        restaurant?.location ||
        ""
      );
    }
    return restaurant?.location || "";
  }, [activeBranch, restaurant]);

  const branchHours = useMemo(() => {
    if (activeBranch) {
      return (
        (activeBranch as { operatingHours?: string }).operatingHours ||
        restaurant?.operatingHours ||
        ""
      );
    }
    return restaurant?.operatingHours || "";
  }, [activeBranch, restaurant]);

  const branchPhone = useMemo(() => {
    if (activeBranch) {
      return activeBranch.phone || restaurant?.phone || "";
    }
    return restaurant?.phone || "";
  }, [activeBranch, restaurant]);

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

    if (restaurant.image) {
      if (Array.isArray(slides) && slides.length > 0) {
        return [restaurant.image, ...slides.filter((s) => s !== restaurant.image)];
      }
      return [restaurant.image];
    }

    if (Array.isArray(slides) && slides.length > 0) {
      return slides as string[];
    }

    return [];
  }, [restaurant]);

  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    const interval = setInterval(() => {
      setSlideDirection("next");
      setPrevSlide(currentSlide);
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slideshowImages, currentSlide]);

  const [activeTab, setActiveTab] = useState<"menu" | "about" | "reviews" | "orders">("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categoriesScrollRef = useHorizontalScroll();

  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`menuverse:cart:${restaurantUsername}`);
        if (stored) return JSON.parse(stored);
      } catch {
        /* ignore */
      }
    }
    return {};
  });

  // Keep cart synced with local storage across page refreshes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (Object.keys(cart).length === 0) {
          localStorage.removeItem(`menuverse:cart:${restaurantUsername}`);
        } else {
          localStorage.setItem(`menuverse:cart:${restaurantUsername}`, JSON.stringify(cart));
        }
      } catch {
        /* ignore */
      }
    }
  }, [cart, restaurantUsername]);

  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [cartStep, setCartStep] = useState<1 | 2>(1);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("menuverse:customer-name") || "";
    }
    return "";
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("menuverse:customer-phone") || "";
    }
    return "";
  });
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [orders, setOrders] = useState<
    Array<{
      id: string;
      items: Array<{ item: MenuItem; quantity: number }>;
      time: string;
      status: string;
      total: number;
      estimatedPrepMinutes?: number;
      prepStartedAt?: string;
    }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`menuverse:placed-orders:${restaurantUsername}`);
        if (stored) return JSON.parse(stored);
      } catch {
        /* ignore */
      }
    }
    return [];
  });

  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  useEffect(() => {
    if (restaurant?.isPushEnabled === false) {
      setShowNotificationPrompt(false);
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      setHasNotificationPermission(Notification.permission === "granted");
      const dismissed = sessionStorage.getItem(`menuverse:notif-dismissed:${restaurantUsername}`);
      if (Notification.permission === "default" && !dismissed) {
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [restaurantUsername, restaurant?.isPushEnabled]);

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Push notifications are not supported on this browser.");
      return;
    }
    setIsSubscribingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setHasNotificationPermission(true);
        setShowNotificationPrompt(false);
        const m = await import("@/lib/push-notifications");
        const res = await m.subscribeToPushNotifications({
          restaurantId: restaurant.id || restaurantUsername,
          role: "customer",
        });
        if (res.success) {
          m.playNotificationSound("chime");
          toast.success("🔔 Order status alerts enabled for this device!");
        } else {
          toast.error(res.error || "Could not register push token.");
        }
      } else {
        setShowNotificationPrompt(false);
        toast.info("Notification permission was not enabled.");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "An error occurred.");
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleDismissNotificationPrompt = () => {
    setShowNotificationPrompt(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`menuverse:notif-dismissed:${restaurantUsername}`, "true");
    }
  };

  // Sync initial placed order statuses from database on mount
  useEffect(() => {
    if (orders.length === 0) return;
    const orderIds = orders.map((o) => o.id).filter(Boolean);
    if (orderIds.length === 0) return;

    getPublicOrderStatusesServer({ data: { orderIds } })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const map = new Map<
            string,
            {
              status: string;
              prepStartedAt?: string;
            }
          >();
          data.forEach((d) => {
            map.set(d.id, d);
          });
          setOrders((prev) => {
            const updated = prev.map((o) => {
              const matched = map.get(o.id);
              if (matched) {
                return {
                  ...o,
                  status: matched.status || o.status,
                  prepStartedAt: matched.prepStartedAt || o.prepStartedAt,
                };
              }
              return o;
            });
            return updated;
          });
        }
      })
      .catch(() => {});
  }, [restaurantUsername]);

  // Real-time live synchronization for Kitchen Preparation Time and Order Status Updates via WebSocket/SSE
  useRealtime({
    restaurantId: restaurantUsername || (restaurant?.id ? String(restaurant?.id) : undefined),
    branchId: branchId || undefined,
    eventTypes: ["order:updated", "order:created", "announcement:created"],
    onEvent: (event) => {
      if (event.type === "announcement:created") {
        const payload = event.payload as Record<string, unknown>;
        const sound = (payload?.sound as string) || "chime";
        import("@/lib/push-notifications").then((m) => {
          m.playNotificationSound(sound as any);
        });

        toast.info(`📢 ${(payload?.title as string) || "Announcement"}`, {
          description: (payload?.body as string) || "New announcement published",
          duration: 9000,
        });

        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            navigator.serviceWorker.ready
              .then((reg) => {
                reg.showNotification(`📢 ${(payload?.title as string) || "Announcement"}`, {
                  body: (payload?.body as string) || "New announcement",
                  icon: "/placeholder.svg",
                  badge: "/placeholder.svg",
                  tag: `announcement-${payload?.id || Date.now()}`,
                  data: { url: (payload?.url as string) || window.location.pathname },
                });
              })
              .catch(() => {
                new Notification(`📢 ${(payload?.title as string) || "Announcement"}`, {
                  body: (payload?.body as string) || "New announcement",
                  icon: "/placeholder.svg",
                });
              });
          } catch {
            /* ignore */
          }
        }
      } else if (event.type === "order:updated") {
        const payload = event.payload as {
          id: string;
          status: string;
          estimatedPrepMinutes?: number;
          prepStartedAt?: string;
          number?: string | number;
        };
        if (payload?.id) {
          const targetId = String(payload.id).toLowerCase().trim();
          setOrders((prev) => {
            const hasOrder = prev.some((o) => {
              const oId = String(o.id).toLowerCase().trim();
              return (
                oId === targetId ||
                oId.includes(targetId) ||
                targetId.includes(oId) ||
                (payload.number && oId.includes(String(payload.number)))
              );
            });
            if (!hasOrder) return prev;

            const updated = prev.map((o) => {
              const oId = String(o.id).toLowerCase().trim();
              if (
                oId === targetId ||
                oId.includes(targetId) ||
                targetId.includes(oId) ||
                (payload.number && oId.includes(String(payload.number)))
              ) {
                return {
                  ...o,
                  status: payload.status,
                  estimatedPrepMinutes:
                    payload.estimatedPrepMinutes !== undefined
                      ? payload.estimatedPrepMinutes
                      : o.estimatedPrepMinutes,
                  prepStartedAt:
                    payload.prepStartedAt || o.prepStartedAt || new Date().toISOString(),
                };
              }
              return o;
            });

            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `menuverse:placed-orders:${restaurantUsername}`,
                  JSON.stringify(updated),
                );
              } catch {
                /* ignore */
              }
            }
            return updated;
          });

          const nextStatus = (payload.status || "").toLowerCase();
          if (nextStatus === "ready") {
            try {
              playChime("order");
            } catch {
              /* ignore */
            }
          } else if (nextStatus === "preparing") {
            try {
              playChime("order");
            } catch {
              /* ignore */
            }
          }
        }
      }
    },
  });
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const triggerToast = (_msg?: string, _sub?: string, _type?: string) => {};

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

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    if (adminCategories.length > 0) {
      adminCategories.forEach((c) => {
        const lower = (c.name || "").toLowerCase().trim();
        if (lower !== "all" && lower !== "popular") {
          catSet.add(c.name);
        }
      });
    } else if (restaurant?.categories && Array.isArray(restaurant.categories)) {
      restaurant.categories.forEach((c: { name: string }) => {
        const lower = (c.name || "").toLowerCase().trim();
        if (lower !== "all" && lower !== "popular") {
          catSet.add(c.name);
        }
      });
    }
    return ["All", "Popular", ...Array.from(catSet)];
  }, [adminCategories, restaurant]);

  const getCategoryEmoji = (catName: string): string => {
    if (adminCategories.length > 0) {
      const match = adminCategories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (match && match.icon) {
        return match.icon;
      }
    }
    if (restaurant && restaurant.categories && Array.isArray(restaurant.categories)) {
      const match = restaurant.categories.find(
        (c: { name: string; emoji?: string }) => c.name.toLowerCase() === catName.toLowerCase(),
      );
      if (match && match.emoji) {
        return match.emoji;
      }
    }
    const name = catName.toLowerCase();
    if (name === "all") return "🍽️";
    if (name === "popular" || name === "featured") return "🔥";
    if (name.includes("burger")) return "🍔";
    if (name.includes("pizza")) return "🍕";
    if (name.includes("drink") || name.includes("beverage")) return "🥤";
    if (name.includes("dessert") || name.includes("sweet")) return "🍰";
    if (name.includes("side") || name.includes("fries")) return "🍟";
    if (name.includes("sushi") || name.includes("japanese")) return "🍣";
    if (name.includes("pasta") || name.includes("italian")) return "🍝";
    if (name.includes("salad")) return "🥗";
    return "🍽️";
  };

  const [dynamicReviews, setDynamicReviews] = useState<GoogleReview[]>([]);
  const [isLoadingDynamicReviews, setIsLoadingDynamicReviews] = useState(false);

  useEffect(() => {
    async function loadReviewsFromMapUrl() {
      const mapUrl =
        ((restaurant as unknown as Record<string, string>)?.googleMapsUrl as string) ||
        GOOGLE_MAPS_URL;
      setIsLoadingDynamicReviews(true);
      try {
        const res = await scrapeGoogleMapsReviewsServer({ data: { url: mapUrl } });
        if (res && res.reviews) {
          setDynamicReviews(res.reviews);
        }
      } catch (err) {
        console.warn("[Dynamic Reviews Load Warning]", err);
      } finally {
        setIsLoadingDynamicReviews(false);
      }
    }

    loadReviewsFromMapUrl();
  }, [restaurant]);

  const reviewsList: GoogleReview[] = useMemo(() => {
    return dynamicReviews;
  }, [dynamicReviews]);

  const ratingSummary = useMemo(() => {
    return getGoogleRatingSummary(reviewsList);
  }, [reviewsList]);

  const effectiveMenuItems = useMemo(() => {
    let list: MenuItem[] = [];
    if (adminFoodItems.length > 0) {
      list = [...adminFoodItems];
    } else {
      list = restaurant?.menuItems || [];
    }

    const validCatKeys = new Set<string>();
    if (adminCategories.length > 0) {
      adminCategories.forEach((c) => {
        if (c.id) validCatKeys.add(String(c.id).toLowerCase().trim());
        if (c.name) validCatKeys.add(String(c.name).toLowerCase().trim());
      });
    } else if (restaurant?.categories && Array.isArray(restaurant.categories)) {
      restaurant.categories.forEach((c: { id?: string; name: string }) => {
        if (c.id) validCatKeys.add(String(c.id).toLowerCase().trim());
        if (c.name) validCatKeys.add(String(c.name).toLowerCase().trim());
      });
    }

    let items = list;
    if (validCatKeys.size > 0) {
      items = list.filter((item: MenuItem) => {
        const itemCatKey = String(item.category || "")
          .toLowerCase()
          .trim();
        if (!itemCatKey) return false;
        return validCatKeys.has(itemCatKey);
      });
    }

    if (!serverPromotions || serverPromotions.length === 0) return items;

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Filter active promotions applicable to current active branch
    const branchPromos = serverPromotions.filter((p) => {
      if (p.active === false || p.enabled === false) return false;

      const sDate = toISODateString(p.startDate);
      const eDate = toISODateString(p.endDate);
      if (sDate && sDate > today) return false;
      if (eDate && eDate < today) return false;

      if (p.kind === "happy-hour" && p.startTime && p.endTime) {
        if (!isTimeInWindow(p.startTime, p.endTime)) return false;
      }

      const promoBranchName = (p.branchName || "").toLowerCase().trim();
      const promoBranchId = (p.branchId || "").toLowerCase().trim();
      const isAllBranches =
        (!promoBranchName && !promoBranchId) ||
        promoBranchName === "all" ||
        promoBranchId === "all" ||
        promoBranchName === "all branches" ||
        promoBranchId === "all branches";

      if (isAllBranches) return true;

      // If specific branch offer and no branch is selected on multi-branch restaurant, don't apply
      const targetBranch = activeBranch || currentBranch;
      if (!targetBranch) return false;

      const targetBranchName = (targetBranch.name || "").toLowerCase().trim();
      const targetBranchId = (targetBranch.id || "").toLowerCase().trim();

      const promoBranchNames = promoBranchName
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const promoBranchIds = promoBranchId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const nameMatch = promoBranchNames.some(
        (bn) =>
          Boolean(bn) &&
          Boolean(targetBranchName) &&
          (bn === targetBranchName ||
            bn.includes(targetBranchName) ||
            targetBranchName.includes(bn)),
      );

      const idMatch = promoBranchIds.some(
        (bi) =>
          Boolean(bi) &&
          Boolean(targetBranchId) &&
          (bi === targetBranchId || bi.includes(targetBranchId) || targetBranchId.includes(bi)),
      );

      return nameMatch || idMatch;
    });

    return items.map((item, itemIdx) => {
      const itemPrice = Number(item.price || 0);
      let maxDiscountPct = 0;

      for (const p of branchPromos) {
        const itemIds = p.itemIds || [];
        const categoryNames = p.categoryNames || [];
        const targetScope = p.targetScope || "all";
        let applies = false;

        if (targetScope === "all" || (itemIds.length === 0 && categoryNames.length === 0)) {
          applies = true;
        } else if (targetScope === "categories" && categoryNames.length > 0) {
          const itemCat = String(item.category || "")
            .toLowerCase()
            .trim();
          applies = categoryNames.some((c: string) => c.toLowerCase().trim() === itemCat);
        } else if (itemIds.length > 0) {
          const itemIdStr = String(item.id || "")
            .toLowerCase()
            .trim();
          const itemIndexStr = `item-${itemIdx + 1}`;
          const itemNameStr = String(item.name || "")
            .toLowerCase()
            .trim();
          applies = itemIds.some((id: string) => {
            const targetId = String(id || "")
              .toLowerCase()
              .trim();
            return (
              targetId === itemIdStr ||
              targetId === itemIndexStr ||
              (targetId.startsWith("item-") && targetId === itemIndexStr) ||
              (itemNameStr.length > 2 && targetId.includes(itemNameStr)) ||
              (itemNameStr.length > 2 && itemNameStr.includes(targetId))
            );
          });
        } else {
          applies = true;
        }

        if (applies) {
          const pct = Number(p.discountPercent || 0);
          if (pct > maxDiscountPct) {
            maxDiscountPct = pct;
          }
        }
      }

      let discountPrice: number | null = null;
      if (maxDiscountPct > 0) {
        discountPrice = Math.round(itemPrice * (1 - maxDiscountPct / 100) * 100) / 100;
      }

      return {
        ...item,
        price: itemPrice,
        discountPrice: discountPrice && discountPrice < itemPrice ? discountPrice : null,
      };
    });
  }, [adminFoodItems, adminCategories, restaurant, serverPromotions, activeBranch, currentBranch]);

  const filteredItems = useMemo(() => {
    if (!effectiveMenuItems.length) return [];
    return effectiveMenuItems.filter((item: MenuItem) => {
      const matchesSearch =
        (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        (selectedCategory === "Popular" && Boolean(item.popular)) ||
        (() => {
          const cat = (item.category || "").trim().toLowerCase();
          const sel = selectedCategory.trim().toLowerCase();
          if (!cat || !sel) return false;
          const normCat = cat.replace(/s$/, "");
          const normSel = sel.replace(/s$/, "");
          return (
            cat === sel ||
            normCat === normSel ||
            cat.includes(sel) ||
            sel.includes(cat) ||
            normCat.includes(normSel) ||
            normSel.includes(normCat)
          );
        })();

      return matchesSearch && matchesCategory;
    });
  }, [effectiveMenuItems, searchQuery, selectedCategory]);

  const addToCart = (itemId: string | number) => {
    const idKey = String(itemId);
    setCart((prev) => ({
      ...prev,
      [idKey]: (prev[idKey] || 0) + 1,
    }));
  };

  const removeFromCart = (itemId: string | number) => {
    const idKey = String(itemId);
    setCart((prev) => {
      const updated = { ...prev };
      if (updated[idKey] <= 1) {
        delete updated[idKey];
      } else {
        updated[idKey] -= 1;
      }
      return updated;
    });
  };

  const cartItemsList = useMemo(() => {
    if (effectiveMenuItems.length === 0) return [];
    return Object.keys(cart)
      .map((id) => {
        const item = effectiveMenuItems.find((m: MenuItem) => String(m.id) === String(id))!;
        return {
          item,
          quantity: cart[id],
        };
      })
      .filter((entry) => entry.item !== undefined);
  }, [cart, effectiveMenuItems]);

  const totalItems = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return cartItemsList.reduce((sum, entry) => sum + entry.quantity * entry.item.price, 0);
  }, [cartItemsList]);

  const handlePlaceOrder = async () => {
    if (!restaurant) return;

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    let hasError = false;
    if (!trimmedName) {
      setNameError(true);
      hasError = true;
    }
    if (!trimmedPhone) {
      setPhoneError(true);
      hasError = true;
    }

    if (hasError) {
      triggerToast(
        "Please enter your Name and Phone Number to submit your order.",
        "Required Information Missing",
        "error",
      );
      return;
    }

    if (cartItemsList.length === 0) {
      triggerToast(
        "Your cart is empty or items are no longer available. Please add items again.",
        "Empty Cart",
        "error",
      );
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const targetSlug = restaurantUsername || restaurant.username || String(restaurant.id);
      const targetBranchId =
        currentBranch?.id ||
        currentBranch?.name ||
        activeBranch?.id ||
        branchId ||
        (restaurant.branches && restaurant.branches[0]?.id) ||
        null;

      const orderItems = cartItemsList.map((c) => ({
        itemId: typeof c.item.id === "string" ? c.item.id : String(c.item.id),
        name: c.item.name,
        quantity: c.quantity,
        price: c.item.price,
      }));

      const result = await placeOrderAction({
        data: {
          restaurantId: targetSlug,
          branchId: targetBranchId,
          tableNumber: tableNumber || "",
          totalPrice,
          customerName: trimmedName,
          phone: trimmedPhone,
          items: orderItems,
        },
      });

      const newOrder = {
        id: result.id,
        items: [...cartItemsList],
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Pending",
        total: result.total || totalPrice,
      };

      setOrders((prev) => {
        const updated = [newOrder, ...prev];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              `menuverse:placed-orders:${restaurantUsername}`,
              JSON.stringify(updated),
            );
          } catch {
            /* ignore */
          }
        }
        return updated;
      });
      setOrderPlaced(true);
      setCart({});
      setIsCartExpanded(false);
      setActiveTab("orders");
      const tableLabel = tableNumber
        ? tableNumber.toLowerCase().startsWith("table")
          ? tableNumber
          : `Table ${tableNumber}`
        : "Dine-in";
      triggerToast(`Order placed successfully for ${tableLabel}!`);
    } catch (e: unknown) {
      const err = e as Error;
      triggerToast(err.message || "Connection failed. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
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
  const typedRestaurant = restaurant as Restaurant & {
    appearance?: { menuLayout?: string; fontFamily?: string; themeColor?: string };
  };

  const [liveAppearance, setLiveAppearance] = useState<{
    menuLayout?: string;
    fontFamily?: string;
    themeColor?: string;
  }>(() => {
    return (
      typedRestaurant.appearance || {
        menuLayout: "cards",
        fontFamily: "sans",
        themeColor: "amber",
      }
    );
  });

  useEffect(() => {
    const resApp = typedRestaurant.appearance;
    if (resApp && (resApp.themeColor || resApp.menuLayout || resApp.fontFamily)) {
      setLiveAppearance((prev) => ({
        themeColor: resApp.themeColor || prev.themeColor || "amber",
        menuLayout: resApp.menuLayout || prev.menuLayout || "cards",
        fontFamily: resApp.fontFamily || prev.fontFamily || "sans",
      }));
    }

    async function loadLiveAppearance() {
      try {
        const dbProfile = await getRestaurantProfile({ data: restaurantUsername });
        if (dbProfile?.appearance) {
          setLiveAppearance((prev) => ({
            themeColor: dbProfile.appearance?.themeColor || prev.themeColor || "amber",
            menuLayout: dbProfile.appearance?.menuLayout || prev.menuLayout || "cards",
            fontFamily: dbProfile.appearance?.fontFamily || prev.fontFamily || "sans",
          }));
        }
      } catch {
        /* ignore */
      }
    }
    loadLiveAppearance();
    window.addEventListener("storage", loadLiveAppearance);
    return () => window.removeEventListener("storage", loadLiveAppearance);
  }, [typedRestaurant.appearance, restaurantUsername]);

  const layoutType = useMemo(() => {
    const layout = liveAppearance.menuLayout;
    if (layout === "list") return "list";
    if (layout === "compact") return "compact";
    if (layout === "grid") return "grid";
    return "card";
  }, [liveAppearance.menuLayout]);

  const fontFamily = useMemo(() => {
    const font = liveAppearance.fontFamily;
    if (font === "systemui" || font === "system-ui" || font === "uisans")
      return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (font === "serif") return "'Playfair Display', serif";
    if (font === "poppins") return "'Poppins', sans-serif";
    if (font === "inter") return "'Inter', sans-serif";
    if (font === "caveat") return "'Caveat', cursive";
    if (font === "pacifico") return "'Pacifico', cursive";
    if (font === "bethellen") return "'Beth Ellen', cursive";
    return "'Outfit', sans-serif";
  }, [liveAppearance.fontFamily]);

  const primaryColor = useMemo(() => {
    const colorTheme = liveAppearance.themeColor;
    if (colorTheme === "emerald") return "#10b981";
    if (colorTheme === "rose") return "#f43f5e";
    if (colorTheme === "violet") return "#8b5cf6";
    if (colorTheme === "indigo") return "#4f46e5";
    if (colorTheme === "dark") return "#111827";
    if (colorTheme?.startsWith("#")) return colorTheme;
    return "#f59e0b";
  }, [liveAppearance.themeColor]);

  return (
    <div
      className="public-menu-root min-h-screen bg-[#f0f2f5] flex flex-col antialiased pb-0 select-none text-neutral-800 overflow-x-hidden w-full"
      style={{ fontFamily }}
    >
      <style>{`
        .public-menu-root, .public-menu-root * {
          font-family: ${fontFamily} !important;
        }
      `}</style>
      <main className="flex-1 w-full flex flex-col">
        {/* Cover Photo Slideshow Container */}
        <div className="w-full bg-[#f0f2f5] shadow-sm">
          <div className="max-w-6xl mx-auto relative">
            <div className="relative w-full h-32 sm:h-64 md:h-76 overflow-hidden bg-neutral-900 md:rounded-b-xl group/cover">
              {isMenuLoading ? (
                <Skeleton className="absolute inset-0 w-full h-full bg-neutral-800 animate-pulse" />
              ) : slideshowImages.length > 0 ? (
                slideshowImages.map((imgSrc: string, index: number) => {
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
                      <BlobImg
                        src={imgSrc}
                        alt={`${restaurant.name} slide ${index + 1}`}
                        priority={index === 0}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    </div>
                  );
                })
              ) : (
                <div className="absolute inset-0 bg-linear-to-r from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                  <div className="text-white/15 text-3xl sm:text-5xl font-black uppercase tracking-widest select-none">
                    {restaurant.name || ""}
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/20 to-transparent z-10 pointer-events-none" />

              {/* Navigation Arrows */}
              {!isMenuLoading && slideshowImages.length > 1 && (
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
                        className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${index === currentSlide ? "bg-white w-4" : "bg-white/50 hover:bg-white/80"}`}
                        aria-label={`Go to slide ${index + 1}`}
                        type="button"
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 2-in-1 Vector SVG Profile Header & Avatar Badge Container */}
            <div className="bg-white rounded-t-2xl sm:rounded-t-3xl -mt-10 sm:-mt-16 md:-mt-20 pt-3 relative z-30 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
              {/* Profile Details Row */}
              <div className="px-3 sm:px-8 pb-3 flex items-center justify-between gap-4">
                <div className="flex flex-row items-center gap-3 sm:gap-5 text-left min-w-0">
                  {/* Profile Avatar Badge Container */}
                  <div className="w-28 h-28 sm:w-36 sm:h-36 relative shrink-0 -mt-12 sm:-mt-18 md:-mt-22">
                    <div className="w-full h-full rounded-full bg-white p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)] relative overflow-hidden flex items-center justify-center">
                      {isMenuLoading ? (
                        <Skeleton className="w-full h-full rounded-full bg-neutral-200/90 animate-pulse" />
                      ) : restaurant.logoImage ? (
                        <BlobImg
                          src={restaurant.logoImage}
                          alt={restaurant.name}
                          priority={true}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded-full flex items-center justify-center font-bold text-3xl sm:text-4xl text-white shadow-inner"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {restaurant.name?.charAt(0)?.toUpperCase() || "M"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brand details */}
                  <div className="flex flex-col justify-center min-w-0 gap-0.5 text-left py-1">
                    {isMenuLoading ? (
                      <div className="flex flex-col gap-2 py-0.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 sm:h-8 w-44 sm:w-60 rounded-lg bg-neutral-200/90" />
                          <Skeleton className="h-4 w-4 rounded-full bg-neutral-200/90 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300 shrink-0" />
                          <Skeleton className="h-4 w-36 sm:w-52 rounded-md bg-neutral-200/80" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <h1 className="text-base sm:text-2xl font-black text-neutral-900 tracking-tight leading-snug flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{restaurant.name}</span>
                          {Boolean(restaurant.isVerified) && (
                            <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
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
                          )}
                        </h1>
                        <span className="text-xs sm:text-sm text-neutral-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 shrink-0" />
                          <span className="truncate">{branchAddress || restaurant.location}</span>
                        </span>
                      </>
                    )}

                    {/* Social Icons Row below address */}
                    {(() => {
                      const resObj = restaurant as unknown as Record<string, unknown>;
                      const rawFb = String(resObj.facebookUrl || "").trim();
                      const rawIg = String(resObj.instagramUrl || "").trim();
                      const rawWa = String(resObj.whatsappNumber || restaurant.phone || "").trim();
                      const rawPhone = String(
                        restaurant.phone || resObj.whatsappNumber || "",
                      ).trim();

                      const fbHref = rawFb
                        ? rawFb.startsWith("http")
                          ? rawFb
                          : `https://facebook.com/${rawFb.replace(/^@/, "")}`
                        : `https://facebook.com/${restaurantUsername}`;

                      const igHref = rawIg
                        ? rawIg.startsWith("http")
                          ? rawIg
                          : `https://instagram.com/${rawIg.replace(/^@/, "")}`
                        : `https://instagram.com/${restaurantUsername}`;

                      const waCleanDigits = rawWa.replace(/[^0-9]/g, "");
                      const waHref = waCleanDigits ? `https://wa.me/${waCleanDigits}` : null;
                      const phoneHref = rawPhone ? `tel:${rawPhone}` : null;

                      return (
                        <div className="flex items-center gap-2 mt-1.5 pt-0.5">
                          <a
                            href={fbHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 rounded-full bg-neutral-100 hover:bg-[#1877F2]/15 hover:text-[#1877F2] text-neutral-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                            title="Facebook"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110"
                            >
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                          </a>

                          <a
                            href={igHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 rounded-full bg-neutral-100 hover:bg-[#E4405F]/15 hover:text-[#E4405F] text-neutral-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                            title="Instagram"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110"
                            >
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                          </a>

                          {waHref && (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 rounded-full bg-neutral-100 hover:bg-[#25D366]/15 hover:text-[#25D366] text-neutral-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                              title="WhatsApp"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110"
                              >
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.147 4.195 4.19-1.099z" />
                              </svg>
                            </a>
                          )}

                          {phoneHref && (
                            <a
                              href={phoneHref}
                              className="h-7 w-7 rounded-full bg-neutral-100 hover:bg-amber-500/15 hover:text-amber-600 text-neutral-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                              title="Call Restaurant"
                            >
                              <Phone className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Notification Bell Button */}
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className={`p-2 rounded-full transition-all active:scale-95 cursor-pointer relative ${
                      hasNotificationPermission
                        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100"
                        : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                    title={
                      hasNotificationPermission
                        ? "Push alerts active"
                        : "Enable live order notifications"
                    }
                  >
                    <Bell className="w-5 h-5" />
                    {hasNotificationPermission && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                  </button>

                  {/* Mobile Dropdown Button */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
                      className="md:hidden p-2 text-neutral-500 hover:text-neutral-700 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-neutral-50 -mr-2"
                      title="More options"
                    >
                      <MoreVertical className="w-5.5 h-5.5" />
                    </button>

                  {/* Dropdown Menu */}
                  {isMenuDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsMenuDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-neutral-200/80 rounded-2xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        <button
                          onClick={() => {
                            setIsMenuDropdownOpen(false);
                            handleShareProfile();
                          }}
                          className="w-full px-4 py-2.5 text-xs font-bold text-neutral-755 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer text-left"
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
                          onClick={async () => {
                            setIsMenuDropdownOpen(false);
                            if (typeof window !== "undefined" && "Notification" in window) {
                              const perm = await Notification.requestPermission();
                              if (perm === "granted") {
                                const m = await import("@/lib/push-notifications");
                                const res = await m.subscribeToPushNotifications({
                                  restaurantId: restaurant.id || restaurantUsername,
                                  role: "customer",
                                });
                                if (res.success) {
                                  m.playNotificationSound("chime");
                                  toast.success("🔔 Push alerts enabled for this device!");
                                } else {
                                  toast.error(res.error || "Failed to subscribe");
                                }
                              } else {
                                toast.error("Notification permission was not granted.");
                              }
                            }
                          }}
                          className="w-full px-4 py-2.5 text-xs font-bold text-neutral-755 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer text-left border-t border-neutral-100/80"
                        >
                          <Bell className="w-3.5 h-3.5 text-amber-500" />
                          <span>Push Alerts</span>
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
            </div>

              {/* Desktop Tabs */}
              <div className="hidden md:flex justify-between items-center border-t border-neutral-100/80 pl-8 pr-6">
                <div className="flex gap-2 -mb-px">
                  {(["menu", "about", "reviews", "orders"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setIsCartExpanded(false);
                      }}
                      className={`py-4 px-4 text-sm font-bold relative transition-colors cursor-pointer capitalize ${activeTab === tab ? "font-extrabold" : "text-neutral-500 hover:text-neutral-800"}`}
                      style={activeTab === tab ? { color: primaryColor } : {}}
                    >
                      {tab}
                      {activeTab === tab && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Desktop Search Bar */}
                <div className="py-2.5 flex items-center">
                  <div className="relative w-64 md:w-72">
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
                      className="block w-full pl-9 pr-8 py-2 text-xs font-semibold bg-neutral-50/70 border border-neutral-200/80 rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all placeholder-neutral-400"
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

        {/* Tab contents grid layout */}
        <div
          className={`w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 ${activeTab === "menu" ? "mt-0" : "mt-3"} md:mt-6 flex flex-col md:flex-row gap-6 items-start ${totalItems > 0 ? "pb-48 md:pb-48" : "pb-36 md:pb-32"}`}
        >
          {/* Left sidebar: about details block */}
          {activeTab === "about" && (
            <div className="w-full md:w-87.5 shrink-0 flex flex-col gap-4 text-left">
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-lg font-black text-neutral-900 tracking-tight leading-none">
                  Intro
                </h3>
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
                    <Star className="w-4.5 h-4.5 text-amber-500 fill-amber-500 shrink-0" />
                    <span>
                      Rated{" "}
                      <strong className="text-neutral-800 font-bold">
                        {restaurant.rating} Stars
                      </strong>{" "}
                      ({restaurant.reviews} reviews)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4.5 h-4.5 text-neutral-400 shrink-0" />
                    <span className="truncate">
                      Located at {branchAddress || restaurant.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4.5 h-4.5 text-neutral-400 shrink-0" />
                    <span>Average preparation: {restaurant.time}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThumbsUp className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                    <span>Cuisine type: {restaurant.cuisine}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right container: dynamic views based on activeTab */}
          <div className="grow w-full flex flex-col gap-4 text-left">
            {/* Menu items block */}
            {activeTab === "menu" && (
              <div className="flex flex-col gap-4 w-full">
                <div
                  className={`sticky top-0 md:relative md:top-auto z-20 bg-[#f0f2f5] transition-all duration-155 flex flex-col gap-3 ${isCategoriesSticky ? "pt-4 pb-2 -mx-4 px-0 border-b border-neutral-200/50 shadow-sm mt-0" : "pt-0 pb-2 -mx-4 px-0"}`}
                >
                  {/* Mobile Quick Service Header */}
                  <div className="flex md:hidden items-center justify-between gap-2.5 mt-0 w-full relative z-20 px-4">
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

                    <div className="w-[50%] max-w-50 -mr-4 relative">
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
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400"
                        >
                          <span className="text-sm font-bold">×</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isCategoriesSticky && (
                      <div className="flex items-center justify-between px-4 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="text-xs font-black text-neutral-900 tracking-tight leading-none uppercase">
                          {restaurant.name}
                        </span>
                        {tableNumber && (
                          <span className="text-[10px] font-black text-emerald-700 leading-none">
                            Table #{tableNumber}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Categories list pills */}
                    <div
                      ref={categoriesScrollRef}
                      className="flex gap-2 overflow-x-auto scrollbar-none w-full scroll-smooth px-4 md:px-0"
                    >
                      {isMenuLoading
                        ? Array.from({ length: 6 }).map((_, idx) => (
                            <Skeleton
                              key={idx}
                              className="h-8.5 w-24 sm:w-28 rounded-full bg-neutral-200/80 shrink-0"
                            />
                          ))
                        : categories.map((cat) => {
                            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                            return (
                              <button
                                key={cat}
                                onClick={() => {
                                  if (selectedCategory.toLowerCase() === cat.toLowerCase()) return;
                                  setIsCategorySwitching(true);
                                  setSelectedCategory(cat);
                                  setTimeout(() => {
                                    setIsCategorySwitching(false);
                                  }, 150);
                                }}
                                className={`px-4 py-2 text-xs font-bold rounded-full border whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5 ${isActive ? "text-white border-transparent shadow-sm" : "bg-white text-neutral-650 hover:text-neutral-900 border-neutral-200/80 hover:bg-neutral-50"}`}
                                style={
                                  isActive
                                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                                    : {}
                                }
                              >
                                <AppleEmoji emoji={getCategoryEmoji(cat)} size={18} />
                                <span>{cat}</span>
                              </button>
                            );
                          })}
                    </div>
                  </div>
                </div>

                {/* Food items lists */}
                {isMenuLoading || isCategorySwitching ? (
                  <div
                    className={`w-full ${
                      layoutType === "list"
                        ? "flex flex-col gap-3"
                        : layoutType === "compact"
                          ? "grid grid-cols-1 gap-2"
                          : (layoutType as string) === "single-grid"
                            ? "grid grid-cols-1 gap-4 max-w-lg mx-auto"
                            : layoutType === "card"
                              ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center justify-center max-w-7xl mx-auto"
                              : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
                    }`}
                  >
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-neutral-200/70 rounded-2xl p-3.5 shadow-xs flex flex-col gap-3 animate-pulse w-full"
                      >
                        <Skeleton className="w-full aspect-4/3 rounded-xl bg-neutral-200/80" />
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-3/4 rounded-md bg-neutral-200/80" />
                          <Skeleton className="h-3 w-full rounded-md bg-neutral-200/60" />
                          <Skeleton className="h-3 w-1/2 rounded-md bg-neutral-200/60" />
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <Skeleton className="h-4 w-16 rounded-md bg-neutral-200/80" />
                          <Skeleton className="h-8 w-8 rounded-full bg-neutral-200/80" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center justify-center gap-4">
                    <Search className="w-12 h-12 text-neutral-300" />
                    <h3 className="text-lg font-bold text-neutral-800 leading-none">
                      No menu items found
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-sm px-6 leading-relaxed">
                      We couldn't find any dishes matching "{searchQuery}" under "{selectedCategory}
                      ".
                    </p>
                  </div>
                ) : (
                  <div
                    className={`w-full ${
                      layoutType === "list"
                        ? "flex flex-col gap-3"
                        : layoutType === "compact"
                          ? "grid grid-cols-1 gap-2"
                          : (layoutType as string) === "single-grid"
                            ? "grid grid-cols-1 gap-4 max-w-lg mx-auto"
                            : layoutType === "card"
                              ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center justify-center max-w-7xl mx-auto"
                              : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
                    }`}
                  >
                    {filteredItems.map((item: MenuItem, idx: number) => {
                      const qtyInCart = cart[String(item.id)] || 0;

                      // 1. LIST LAYOUT
                      if (layoutType === "list") {
                        return (
                          <div
                            key={item.id}
                            className="bg-white border border-neutral-200/80 rounded-2xl p-3 shadow-xs flex gap-4 items-center hover:shadow-[0_6px_20px_rgba(0,0,0,0.025)] transition-all duration-300"
                          >
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-neutral-100 relative">
                              <BlobImg
                                src={item.image}
                                alt={item.name}
                                priority={idx < 8}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              {item.popular && (
                                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full z-10 shadow-sm">
                                  Popular
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between min-h-24 sm:min-h-28 py-0.5">
                              <div>
                                <h4 className="text-sm sm:text-base font-bold text-neutral-900 line-clamp-1">
                                  {item.name}
                                </h4>
                                <p className="text-[11px] sm:text-xs text-neutral-500 font-semibold leading-relaxed mt-0.5 line-clamp-2">
                                  {item.description}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                {item.discountPrice != null && item.discountPrice < item.price ? (
                                  <div className="flex items-baseline gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-red-500 line-through decoration-red-500 font-mono">
                                      {cs}
                                      {item.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                      {cs}
                                      {item.discountPrice.toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm font-black text-deep-emerald-950">
                                    {cs}
                                    {item.price.toFixed(2)}
                                  </span>
                                )}
                                <div className="flex items-center justify-center bg-white border border-neutral-200/80 rounded-xl h-10 px-1.5 shadow-sm btn-bubble">
                                  {qtyInCart > 0 ? (
                                    <div className="flex items-center gap-2 px-1">
                                      <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors text-white shrink-0"
                                        style={{
                                          backgroundColor: `${primaryColor}22`,
                                          color: primaryColor,
                                        }}
                                      >
                                        <Minus className="w-3 h-3" strokeWidth={3} />
                                      </button>
                                      <span
                                        className="text-base sm:text-lg font-black min-w-5 sm:min-w-6 text-center leading-none px-0.5"
                                        style={{ color: primaryColor }}
                                      >
                                        {qtyInCart}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          triggerBubbleEffect(e);
                                          addToCart(item.id);
                                        }}
                                        className="w-6 h-6 rounded-full text-white flex items-center justify-center cursor-pointer shrink-0"
                                        style={{ backgroundColor: primaryColor }}
                                      >
                                        <Plus className="w-3 h-3 relative z-10" strokeWidth={3} />
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

                      // 2. COMPACT LAYOUT
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
                              {item.discountPrice != null && item.discountPrice < item.price ? (
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-red-500 line-through decoration-red-500 font-mono">
                                    {cs}
                                    {item.price.toFixed(2)}
                                  </span>
                                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {cs}
                                    {item.discountPrice.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm font-black text-neutral-800">
                                  {cs}
                                  {item.price.toFixed(2)}
                                </span>
                              )}
                              <div className="flex items-center justify-center bg-white border border-neutral-200/80 rounded-lg h-9 px-1.5 shadow-sm btn-bubble">
                                {qtyInCart > 0 ? (
                                  <div className="flex items-center gap-2 px-1">
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="w-5.5 h-5.5 rounded-full flex items-center justify-center cursor-pointer text-white shrink-0"
                                      style={{
                                        backgroundColor: `${primaryColor}22`,
                                        color: primaryColor,
                                      }}
                                    >
                                      <Minus className="w-2.5 h-2.5" strokeWidth={3} />
                                    </button>
                                    <span
                                      className="text-base sm:text-lg font-black min-w-5 sm:min-w-6 text-center leading-none px-0.5"
                                      style={{ color: primaryColor }}
                                    >
                                      {qtyInCart}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        triggerBubbleEffect(e);
                                        addToCart(item.id);
                                      }}
                                      className="w-5.5 h-5.5 rounded-full text-white flex items-center justify-center cursor-pointer shrink-0"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      <Plus className="w-2.5 h-2.5 relative z-10" strokeWidth={3} />
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

                      // 3. CARD LAYOUT (FoodCard component)
                      if (layoutType === "card") {
                        return (
                          <FoodCard
                            key={item.id}
                            name={item.name}
                            description={item.description}
                            price={item.price}
                            discountPrice={item.discountPrice ?? null}
                            currency={cs}
                            image={item.image}
                            favorite={false}
                            onToggleFavorite={() => {}}
                            onAdd={(e) => {
                              triggerBubbleEffect(e);
                              addToCart(item.id);
                            }}
                            onRemove={() => {
                              removeFromCart(item.id);
                            }}
                            qtyInCart={qtyInCart}
                            primaryColor={primaryColor}
                            tags={item.popular ? ["Trending"] : []}
                            priority={idx < 8}
                          />
                        );
                      }

                      // 4. GRID LAYOUT (DEFAULT & SINGLE-GRID)
                      return (
                        <div key={item.id} className="flex flex-col h-full group food-card">
                          <div className="grow flex flex-col bg-white rounded-t-2xl rounded-br-2xl border border-neutral-200/80 border-b-0 shadow-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.025)] transition-all duration-300">
                            <div className="relative w-full aspect-4/3 shrink-0 bg-neutral-100 overflow-hidden rounded-t-2xl">
                              <BlobImg
                                src={item.image}
                                alt={item.name}
                                priority={idx < 8}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              {item.popular && (
                                <div className="absolute top-2.5 left-2.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full z-10 shadow-sm">
                                  Popular
                                </div>
                              )}
                            </div>

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

                          <div className="flex gap-1">
                            <div className="flex-1 bg-white rounded-b-2xl border border-t-0 border-neutral-200/80 shadow-sm flex items-center justify-center h-10 px-3 group-hover:border-neutral-300 transition-colors duration-300">
                              {item.discountPrice != null && item.discountPrice < item.price ? (
                                <div className="flex items-baseline gap-1 flex-wrap">
                                  <span className="text-[11px] font-semibold text-red-500 line-through decoration-red-500 font-mono">
                                    {cs}
                                    {item.price.toFixed(2)}
                                  </span>
                                  <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {cs}
                                    {item.discountPrice.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs sm:text-sm font-black text-deep-emerald-950">
                                  {cs}
                                  {item.price.toFixed(2)}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 bg-white rounded-xl rounded-tl-none border border-neutral-200/80 shadow-sm flex items-center justify-center h-10 group-hover:border-neutral-300 transition-colors duration-300 btn-bubble">
                              {qtyInCart > 0 ? (
                                <div className="flex items-center gap-1.5 px-2.5">
                                  <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-white"
                                    style={{
                                      backgroundColor: `${primaryColor}22`,
                                      color: primaryColor,
                                    }}
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span
                                    className="text-xs font-black min-w-3.5 text-center"
                                    style={{ color: primaryColor }}
                                  >
                                    {qtyInCart}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      triggerBubbleEffect(e);
                                      addToCart(item.id);
                                    }}
                                    className="w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer"
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

            {/* About details block */}
            {activeTab === "about" && (
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm flex flex-col gap-6 w-full">
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
                        {restaurant.operatingHours ||
                          branchHours ||
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

            {/* Reviews block */}
            {activeTab === "reviews" && (
              <div className="flex flex-col gap-4 w-full">
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
                  <div className="flex flex-col items-center justify-center text-center px-4 shrink-0">
                    <span className="text-4xl sm:text-5xl font-black text-neutral-900 tracking-tight leading-none">
                      {ratingSummary.average}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-500 mt-2.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-4.5 h-4.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-neutral-400 mt-1.5 uppercase tracking-wider">
                      {ratingSummary.total} RATINGS
                    </span>
                    <a
                      href={GOOGLE_MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70 rounded-full text-[11px] font-bold transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-amber-600" />
                      <span>Google Maps Reviews</span>
                    </a>
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-2 border-t sm:border-t-0 sm:border-l border-neutral-100 pt-4 sm:pt-0 sm:pl-6 text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-black text-neutral-900 tracking-tight">
                        Rating Breakdown
                      </h3>
                      <span className="text-[11px] font-semibold text-neutral-400">
                        Verified Google Reviews ({ratingSummary.total})
                      </span>
                    </div>
                    {ratingSummary.breakdown.map((row) => (
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

                <div className="flex flex-col gap-4 w-full">
                  {reviewsList.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 shadow-sm text-center flex flex-col items-center justify-center gap-3">
                      <MapPin className="w-10 h-10 text-neutral-300 animate-bounce" />
                      <h4 className="text-base font-bold text-neutral-800">
                        No Google Maps Reviews Synced Yet
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-sm leading-relaxed font-semibold">
                        Enter your Google Maps Place URL in Restaurant Profile settings to
                        automatically parse & sync live verified customer reviews on your digital
                        menu.
                      </p>
                    </div>
                  ) : (
                    reviewsList.map((rev, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm flex flex-col gap-3.5 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <GoogleAvatar
                              author={rev.author}
                              src={rev.avatar}
                              sizeClassName="w-10 h-10 text-xs"
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-black text-neutral-900 leading-tight">
                                  {rev.author}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  Google Map
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-neutral-400 mt-0.5">
                                {rev.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < rev.stars ? "fill-amber-500" : "text-neutral-200 fill-none"}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-semibold leading-relaxed">
                          "{rev.text}"
                        </p>
                        {rev.ownerReply && (
                          <div className="mt-1 bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/60 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Response from the owner
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed font-medium pl-3.5 border-l-2 border-amber-400">
                              "{rev.ownerReply}"
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Placed orders list block */}
            {activeTab === "orders" && (
              <div className="flex flex-col gap-4 w-full text-left">
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm flex flex-col gap-5">
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <ClipboardList className="w-5 h-5" style={{ color: primaryColor }} />
                    <span>Your Orders</span>
                  </h3>

                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                      <ClipboardList className="w-12 h-12 text-neutral-300 animate-pulse" />
                      <h4 className="text-base font-bold text-neutral-800">No active orders yet</h4>
                      <p className="text-xs sm:text-sm text-neutral-500 max-w-xs font-semibold leading-relaxed">
                        Add delicious items from our menu to your bag and place your order!
                      </p>
                      <button
                        onClick={() => setActiveTab("menu")}
                        className="px-5 py-2.5 text-xs font-bold text-white rounded-full cursor-pointer transition-all shadow-sm active:scale-95 duration-150 hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Browse Menu
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {orders.map((order) => {
                        const st = (order.status || "pending").toLowerCase();
                        return (
                          <div
                            key={order.id}
                            className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                              <OrderInlineTimer
                                status={order.status}
                                prepStartedAt={order.prepStartedAt}
                                estimatedPrepMinutes={order.estimatedPrepMinutes}
                                orderTime={order.time}
                              />
                              <div className="flex items-center gap-2">
                                {st === "preparing" && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                )}
                                {st === "ready" && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                )}
                                {st === "pending" && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                )}
                                <span
                                  className={cn(
                                    "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                                    st === "ready"
                                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200/70"
                                      : st === "preparing"
                                        ? "text-amber-800 bg-amber-50 border border-amber-200/80"
                                        : st === "completed"
                                          ? "text-neutral-600 bg-neutral-100"
                                          : st === "cancelled"
                                            ? "text-rose-600 bg-rose-50 border border-rose-200/60"
                                            : "text-amber-600 bg-amber-50 border border-amber-200/60",
                                  )}
                                >
                                  {order.status}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
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
                                    {cs}
                                    {(itemEntry.item.price * itemEntry.quantity).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="border-t border-neutral-100 pt-2.5 flex justify-between items-center font-bold text-sm text-neutral-800">
                              <span>Total Amount</span>
                              <span className="font-black" style={{ color: primaryColor }}>
                                {cs}
                                {order.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating bottom cart drawer (Multi-step) */}
      {totalItems > 0 && isCartExpanded && (
        <div className="fixed bottom-0 md:bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-3xl h-[72vh] md:h-auto z-45 bg-white border border-neutral-200/85 rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col pb-safe">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3.5 border-b border-neutral-100 shrink-0">
            <div className="flex items-center gap-2">
              {cartStep === 2 && (
                <button
                  onClick={() => setCartStep(1)}
                  className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer transition-all active:scale-90 mr-0.5"
                  aria-label="Back to items"
                >
                  <ChevronLeft className="w-4 h-4 text-neutral-700" />
                </button>
              )}
              <h3 className="text-[15px] font-black text-neutral-900 flex items-center gap-2">
                {cartStep === 1 ? (
                  <>
                    <ShoppingBag className="w-4.5 h-4.5 text-neutral-850" />
                    <span>Your Cart</span>
                  </>
                ) : (
                  <>
                    <User className="w-4.5 h-4.5 text-neutral-850" />
                    <span>Checkout</span>
                  </>
                )}
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                Step {cartStep}/2
              </span>
            </div>
            <button
              onClick={() => {
                setIsCartExpanded(false);
                setCartStep(1);
              }}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer transition-all active:scale-90"
              aria-label="Close cart"
            >
              <X className="w-4.5 h-4.5 text-neutral-500" />
            </button>
          </div>

          {/* Step 1: Items List */}
          {cartStep === 1 && (
            <>
              {/* Scrollable list of items */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 divide-y divide-neutral-100 animate-in fade-in duration-200">
                <div className="flex flex-col gap-4">
                  {cartItemsList.map((entry) => (
                    <div
                      key={entry.item.id}
                      className="flex items-center justify-between pt-3.5 first:pt-0"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-100 border border-neutral-200">
                          <BlobImg
                            src={entry.item.image}
                            alt={entry.item.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="text-sm font-bold text-neutral-900 truncate">
                            {entry.item.name}
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: primaryColor }}>
                            {cs}
                            {(entry.item.price * entry.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-neutral-100 rounded-full p-1.5 border border-neutral-200/40">
                        <button
                          onClick={() => removeFromCart(entry.item.id)}
                          className="w-7 h-7 rounded-full bg-white hover:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700 cursor-pointer transition-colors shadow-xs shrink-0"
                        >
                          <Minus className="w-3 h-3" strokeWidth={2.5} />
                        </button>
                        <span className="text-base sm:text-lg font-black min-w-6 text-center text-neutral-900 leading-none">
                          {entry.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(entry.item.id)}
                          className="w-7 h-7 rounded-full bg-white hover:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700 cursor-pointer transition-colors shadow-xs shrink-0"
                        >
                          <Plus className="w-3 h-3" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 1 Footer */}
              <div className="mt-auto shrink-0 px-6 pt-4 pb-10 sm:pb-6 border-t border-neutral-100 flex flex-col gap-3.5 bg-white">
                <div className="flex justify-between items-center px-1 text-sm font-bold text-neutral-800">
                  <span>Total Amount:</span>
                  <span className="text-base font-extrabold" style={{ color: primaryColor }}>
                    {cs}
                    {totalPrice.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setCartStep(2)}
                  className="w-full text-white text-sm font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 shadow-md cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Step 2: Customer Information */}
          {cartStep === 2 && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-4 animate-in slide-in-from-right duration-250">
                {/* Order quick summary chip */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
                  <span className="font-bold text-neutral-600 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
                    <span>
                      {totalItems} item{totalItems > 1 ? "s" : ""} in cart
                    </span>
                  </span>
                  <button
                    onClick={() => setCartStep(1)}
                    className="text-[11px] font-bold underline cursor-pointer hover:opacity-80"
                    style={{ color: primaryColor }}
                  >
                    Edit items
                  </button>
                </div>

                {/* Customer information input fields */}
                <div className="bg-neutral-50/80 rounded-2xl p-4 border border-neutral-200/70 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Enter Your Details</span>
                    </span>
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                      * Required
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="customer-name-input"
                        className="text-[11px] font-bold text-neutral-600 flex items-center gap-1"
                      >
                        <span>Full Name</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="customer-name-input"
                          type="text"
                          autoFocus
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (nameError) setNameError(false);
                            if (typeof window !== "undefined") {
                              localStorage.setItem("menuverse:customer-name", e.target.value);
                            }
                          }}
                          placeholder="e.g. Tanvir Ahmed"
                          className={cn(
                            "w-full h-10 pl-8.5 pr-3 text-xs font-semibold rounded-xl bg-white border outline-none transition-all",
                            nameError
                              ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/40"
                              : "border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200",
                          )}
                        />
                      </div>
                      {nameError && (
                        <span className="text-[10px] font-semibold text-rose-600">
                          Please enter your name
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="customer-phone-input"
                        className="text-[11px] font-bold text-neutral-600 flex items-center gap-1"
                      >
                        <span>Phone Number</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="customer-phone-input"
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value);
                            if (phoneError) setPhoneError(false);
                            if (typeof window !== "undefined") {
                              localStorage.setItem("menuverse:customer-phone", e.target.value);
                            }
                          }}
                          placeholder="e.g. 01712345678"
                          className={cn(
                            "w-full h-10 pl-8.5 pr-3 text-xs font-semibold rounded-xl bg-white border outline-none transition-all",
                            phoneError
                              ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/40"
                              : "border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200",
                          )}
                        />
                      </div>
                      {phoneError && (
                        <span className="text-[10px] font-semibold text-rose-600">
                          Please enter your phone number
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 Footer */}
              <div className="mt-auto shrink-0 px-6 pt-4 pb-10 sm:pb-6 border-t border-neutral-100 flex flex-col gap-3.5 bg-white">
                <div className="flex justify-between items-center px-1 text-sm font-bold text-neutral-800">
                  <span>Total Amount:</span>
                  <span className="text-base font-extrabold" style={{ color: primaryColor }}>
                    {cs}
                    {totalPrice.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder}
                  className="w-full text-white text-sm font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-98 shadow-md cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmittingOrder ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span>Processing Order…</span>
                    </>
                  ) : (
                    <span>Confirm & Place Order</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Checkout Modal */}
      {orderPlaced && (
        <div className="fixed inset-0 bg-deep-emerald-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full flex flex-col items-center text-center gap-6 shadow-2xl border border-neutral-100 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce shadow-inner border border-emerald-100">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl md:text-2xl font-black text-neutral-955 tracking-tight leading-tight">
                Order Received!
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-emerald-600 bg-emerald-50/70 px-3 py-1 rounded-full border border-emerald-100/50">
                  {tableNumber
                    ? tableNumber.toLowerCase().startsWith("table")
                      ? tableNumber
                      : `Table ${tableNumber}`
                    : "Dine-in"}
                </span>
                {customerName && (
                  <span className="text-xs sm:text-sm font-bold text-neutral-700 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200/60">
                    {customerName}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-semibold text-neutral-500 leading-relaxed mt-4">
                Thank you <strong className="text-neutral-800">{customerName || "Guest"}</strong>!
                Your order is confirmed and has been routed to the kitchen display at{" "}
                <strong className="text-neutral-800">{restaurant.name}</strong>. Sit back and relax
                while your food is prepared!
              </p>
            </div>

            <button
              onClick={() => setOrderPlaced(false)}
              className="w-full bg-deep-emerald-950 hover:bg-deep-emerald-850 text-white text-sm font-bold py-3 rounded-2xl transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
            >
              Order Something Else
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden select-none filter drop-shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <div className="relative w-full h-18 flex">
          <div className="flex-1 bg-white rounded-tl-[24px] -mr-0.5" />
          <svg
            className="w-22.5 h-18 shrink-0"
            viewBox="0 0 90 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 0 0 C 17 0, 17 44, 45 44 C 73 44, 73 0, 90 0 L 90 72 L 0 72 Z"
              fill="white"
            />
          </svg>
          <div className="flex-1 bg-white rounded-tr-[24px] -ml-0.5" />
        </div>

        {/* Navigation links inside curved bar */}
        <div className="absolute top-0 left-0 right-0 h-18 flex items-center">
          <div className="flex-1 flex justify-around pr-4">
            {leftNavItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-200 cursor-pointer active:scale-95 ${tab.isActive ? "font-extrabold" : "text-[#b3b3b3] font-medium"}`}
                  style={tab.isActive ? { color: primaryColor } : {}}
                >
                  <Icon className="w-5.5 h-4.5" />
                  <span className="text-[11px] tracking-tight leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Shopping cart FAB */}
          <div className="relative w-18 h-full flex justify-center items-start">
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
                  className="absolute -top-1 -right-1 text-white text-[9.5px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1a1a1a] shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex justify-around pl-4">
            {rightNavItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-200 cursor-pointer active:scale-95 ${tab.isActive ? "font-extrabold" : "text-[#b3b3b3] font-medium"}`}
                  style={tab.isActive ? { color: primaryColor } : {}}
                >
                  <Icon className="w-5.5 h-4.5" />
                  <span className="text-[11px] tracking-tight leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= PROMOTION POPUP MODAL ================= */}
      {promoPopupOpen && popupPromo && (
        <div
          onClick={handleClosePromoPopup}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-300"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-xl bg-transparent shadow-2xl transition-all animate-in zoom-in-95 duration-300 flex flex-col items-center justify-center"
            style={{ fontFamily: fontFamily }}
          >
            {/* Close button */}
            <button
              onClick={handleClosePromoPopup}
              className="absolute top-0 right-0 z-30 flex h-8 w-8 items-center justify-center rounded-bl-xl rounded-tr-xl bg-black/80 text-white backdrop-blur-md hover:bg-black/95 transition-transform active:scale-95 cursor-pointer border-b border-l border-white/20 shadow-lg"
              title="Close offer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Banner Image (ONLY IMAGE) */}
            {popupPromo.image ? (
              <div
                className="relative w-full overflow-hidden rounded-xl cursor-pointer shadow-2xl"
                onClick={() => {
                  handleClosePromoPopup();
                  setActiveTab("menu");
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 300, behavior: "smooth" });
                  }
                }}
              >
                <BlobImg
                  src={popupPromo.image}
                  alt={popupPromo.name}
                  className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
                />
              </div>
            ) : (
              /* Fallback for text-only promotion if no image uploaded */
              <div className="w-full overflow-hidden rounded-xl bg-card border border-border/80 shadow-2xl">
                <div
                  className="relative h-44 w-full flex flex-col justify-center items-center p-6 text-center text-white overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%)`,
                  }}
                >
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/30">
                    <Sparkles className="h-3.5 w-3.5" /> SPECIAL PROMOTION
                  </span>
                  <h2 className="text-3xl font-black tracking-tight">
                    {popupPromo.discountPercent}% OFF
                  </h2>
                  <p className="text-xs text-white/80 mt-1 max-w-xs">{popupPromo.name}</p>
                </div>
                <div className="p-6 space-y-4 bg-card text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    {popupPromo.name}
                  </h3>
                  <button
                    onClick={() => {
                      handleClosePromoPopup();
                      setActiveTab("menu");
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }
                    }}
                    className="w-full h-12 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-110 active:scale-98 cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Utensils className="h-4 w-4" /> Claim Offer & View Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Notification Permission Request Card */}
      {showNotificationPrompt && !hasNotificationPermission && restaurant?.isPushEnabled !== false && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="rounded-2xl p-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Bell className="h-5 w-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  Get Live Order & Kitchen Updates!
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
                  Turn on notifications for instant audio chimes when your food is preparing & served at your table.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleDismissNotificationPrompt}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                type="button"
                disabled={isSubscribingPush}
                onClick={handleEnableNotifications}
                className="btn-bubble px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5" />
                {isSubscribingPush ? "Enabling..." : "Enable Alerts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
