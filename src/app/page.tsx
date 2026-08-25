"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { RESTAURANTS, Restaurant } from "./data/restaurants";
import {
  ClipboardList,
  QrCode,
  ChefHat,
  Monitor,
  BookOpen,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Users,
} from "lucide-react";

// Explore recommendations section mock data showing popular dishes
// Recommendation products mock data (unused)

// Curated FAQ Questions & Answers
const FAQ_ITEMS = [
  {
    question: "What is this website about?",
    answer:
      "This website is a digital food menu platform that allows you to browse local restaurants, explore their curated food recommendations, view menus, and seamlessly scan QR codes to access table-side services.",
  },
  {
    question: "Is the information always accurate?",
    answer:
      "Yes, we work directly with restaurant owners to keep prices, descriptions, locations, and menus updated in real-time.",
  },
  {
    question: "How can I suggest a new restaurant to be added?",
    answer:
      "You can reach out to our team via the contact details provided in the footer or tap 'Contact Us' to submit a restaurant recommendation.",
  },
  {
    question: "Do I need to sign up to use the website?",
    answer:
      "No, you can browse restaurants and view menus completely anonymously without creating an account. Sign-up is optional.",
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [customRestaurant, setCustomRestaurant] = useState<{
    name?: string;
    cuisine?: string;
    location?: string;
    image?: string;
    logoImage?: string;
    rating?: string;
    reviews?: string;
    time?: string;
    price?: string;
  } | null>(null);

  const [dbRestaurants, setDbRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    fetch("/api/restaurants", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDbRestaurants(data);
        }
      })
      .catch((err) => {
        console.error("Error loading restaurants from db:", err);
      });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("custom_restaurant_details");
      if (stored) {
        try {
          setCustomRestaurant(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const restaurantScrollRef = useRef<HTMLDivElement>(null);
  const testimonialScrollRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResultToast, setScanResultToast] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);
    } catch (e) {
      console.warn("Audio Context not allowed:", e);
    }
  };

  useEffect(() => {
    if (isScanning) {
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: "environment" } })
          .then((s) => {
            stream = s;
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch((err) => {
            console.error("Camera access error:", err);
          });
      }

      // Simulate successful scan after 2.5s
      const timer = setTimeout(() => {
        playBeep();

        // Pick a random restaurant name to search
        const randomRestaurants = [
          "Burger Craft Lab",
          "La Dolce Vita",
          "Sakura Sushi Bar",
          "The Spicy Wok",
        ];
        const chosen = randomRestaurants[Math.floor(Math.random() * randomRestaurants.length)];

        setSearchQuery(chosen);
        setActiveSearch(chosen);
        setIsScanning(false);
        setScanResultToast(`QR Code Scanned: "${chosen}"`);

        setTimeout(() => {
          setScanResultToast(null);
        }, 3000);
      }, 2500);

      return () => {
        clearTimeout(timer);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [isScanning]);

  // Scroll helpers (unused)

  const scrollTestimonials = (direction: "left" | "right") => {
    if (testimonialScrollRef.current) {
      const container = testimonialScrollRef.current;
      const firstChild = container.firstElementChild as HTMLElement;
      if (firstChild) {
        const itemWidth = firstChild.offsetWidth;
        const gap = parseInt(window.getComputedStyle(container).gap) || 24;
        const scrollAmount = direction === "left" ? -(itemWidth + gap) : itemWidth + gap;
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  // Merge custom restaurant details into the RESTAURANTS list
  const mergedRestaurants = useMemo(() => {
    const sourceList = dbRestaurants.length > 0 ? dbRestaurants : RESTAURANTS;
    return sourceList.map((restaurant) => {
      if (restaurant.id === 1 && customRestaurant) {
        return {
          ...restaurant,
          name: customRestaurant.name || restaurant.name,
          cuisine: customRestaurant.cuisine || restaurant.cuisine,
          location: customRestaurant.location || restaurant.location,
          image: customRestaurant.image || restaurant.image,
          logoImage: customRestaurant.logoImage || restaurant.logoImage,
          rating: customRestaurant.rating || restaurant.rating,
          reviews: customRestaurant.reviews || restaurant.reviews,
          time: customRestaurant.time || restaurant.time,
          price: customRestaurant.price || restaurant.price,
        };
      }
      return restaurant;
    });
  }, [dbRestaurants, customRestaurant]);

  // Handles real-time search filtering
  const filteredRestaurants = useMemo(() => {
    return mergedRestaurants.filter((restaurant) => {
      return (
        restaurant.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        restaurant.cuisine.toLowerCase().includes(activeSearch.toLowerCase())
      );
    });
  }, [mergedRestaurants, activeSearch]);

  // Infinite slide support: snap scroll position back to middle copy when out of bounds
  const handleRestaurantScroll = () => {
    if (!restaurantScrollRef.current || filteredRestaurants.length === 0) return;
    const container = restaurantScrollRef.current;
    const firstChild = container.firstElementChild as HTMLElement;
    if (!firstChild) return;

    const itemWidth = firstChild.offsetWidth;
    if (itemWidth === 0) return;

    const gap = parseInt(window.getComputedStyle(container).gap) || 12;
    const singleSetWidth = (itemWidth + gap) * filteredRestaurants.length;

    // Use a robust tolerance zone of 100px to prevent subpixel layout loops
    const tolerance = 100;

    if (container.scrollLeft >= singleSetWidth * 2 + tolerance) {
      container.scrollLeft = container.scrollLeft - singleSetWidth;
    } else if (container.scrollLeft <= singleSetWidth - tolerance) {
      container.scrollLeft = container.scrollLeft + singleSetWidth;
    }
  };

  // Set initial scroll offset to the middle set on mount / data change
  useEffect(() => {
    if (filteredRestaurants.length > 0) {
      const timer = setTimeout(() => {
        if (restaurantScrollRef.current) {
          const container = restaurantScrollRef.current;
          const firstChild = container.firstElementChild as HTMLElement;
          if (firstChild) {
            const itemWidth = firstChild.offsetWidth;
            const gap = parseInt(window.getComputedStyle(container).gap) || 12;
            const startOffset = (itemWidth + gap) * filteredRestaurants.length;
            container.scrollLeft = startOffset;
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [filteredRestaurants]);

  // Auto slide every 5 seconds with animation
  useEffect(() => {
    if (filteredRestaurants.length <= 1) return;

    const interval = setInterval(() => {
      if (restaurantScrollRef.current) {
        const container = restaurantScrollRef.current;
        const firstChild = container.firstElementChild as HTMLElement;
        if (firstChild) {
          const itemWidth = firstChild.offsetWidth;
          const gap = parseInt(window.getComputedStyle(container).gap) || 12;
          const colWidth = itemWidth + gap;

          // Scroll by the number of fully visible columns to show the next set of items
          const numVisible = Math.max(1, Math.floor(container.clientWidth / colWidth));
          const scrollStep = numVisible * colWidth;

          container.scrollBy({ left: scrollStep, behavior: "smooth" });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [filteredRestaurants]);

  // Auto scroll testimonials every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (testimonialScrollRef.current) {
        const container = testimonialScrollRef.current;
        const firstChild = container.firstElementChild as HTMLElement;
        if (firstChild) {
          const itemWidth = firstChild.offsetWidth;
          const gap = parseInt(window.getComputedStyle(container).gap) || 24;
          const colWidth = itemWidth + gap;

          if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
            container.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            container.scrollBy({ left: colWidth, behavior: "smooth" });
          }
        }
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans antialiased text-neutral-900 transition-colors duration-300">
      {/* Floating Premium Header sitting above the hero section (Sticky & Overlay) */}
      <div className="sticky top-0 w-full h-0 z-50">
        <Header />
      </div>

      {/* Main Container */}
      <main className="flex-1 w-full pb-0 relative z-10">
        {/* Luxury Hero Card - Full Width (40% Shorter Height on Mobile) */}
        <div className="relative w-full h-[280px] md:h-[600px] overflow-hidden bg-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          {/* Hero Background Image - premium_living_room.png */}
          <Image
            src="/premium_living_room.png"
            alt="Premium Living Room Showcase"
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        {/* Breathtaking Curated Storefront Grid - Overlapping the Hero Section */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-24 md:-mt-28 pb-12 relative z-20 bg-white rounded-[32px] p-3 md:p-5 border border-neutral-100 shadow-[0_25px_60px_rgba(0,0,0,0.03)] flex flex-col gap-3 md:gap-5">
          {/* Store Sub-header with Search Bar */}
          <div className="flex flex-col items-center md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
            <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto order-2 md:order-1">
              <h2 className="text-2xl md:text-[32px] font-medium tracking-tight text-neutral-950 font-sans truncate">
                Popular Restaurants
              </h2>
            </div>

            {/* Elegant Search Container */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center justify-center md:justify-start gap-3 w-full md:w-auto order-1 md:order-2"
            >
              <div className="relative flex items-center bg-neutral-50 border border-neutral-200/80 rounded-xl px-5 py-2.5 w-full md:w-[320px] transition-all duration-300 focus-within:border-neutral-400 focus-within:bg-white shadow-sm h-[42px]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-neutral-400 mr-2.5 shrink-0"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search on MenuVerse"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-neutral-800 placeholder-neutral-400 font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="bg-deep-emerald-950 hover:bg-deep-emerald-850 text-white rounded-xl w-[42px] h-[42px] flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm shrink-0"
                title="Scan QR Code"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-white"
                >
                  {/* Outer brackets */}
                  <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />

                  {/* Finder Patterns Outer Borders */}
                  {/* Top Left */}
                  <rect x="5.5" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                  {/* Top Right */}
                  <rect x="13" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                  {/* Bottom Left */}
                  <rect x="5.5" y="13" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />

                  {/* Inner Solid Components & Data Grid */}
                  <g fill="currentColor" stroke="none">
                    {/* Finder Top Left Inner */}
                    <rect x="7.25" y="7.25" width="2" height="2" rx="0.5" />
                    {/* Finder Top Right Inner */}
                    <rect x="14.75" y="7.25" width="2" height="2" rx="0.5" />
                    {/* Finder Bottom Left Inner */}
                    <rect x="7.25" y="14.75" width="2" height="2" rx="0.5" />

                    {/* Bottom Right Pixel Matrix */}
                    <rect x="13" y="13" width="1.2" height="1.2" rx="0.3" />
                    <rect x="13" y="15" width="1.2" height="1.2" rx="0.3" />
                    <rect x="13" y="17.5" width="1.2" height="1.2" rx="0.3" />
                    <rect x="14.5" y="14.25" width="1.2" height="1.2" rx="0.3" />
                    <rect x="14.5" y="16.25" width="1.2" height="1.2" rx="0.3" />
                    <rect x="16" y="13" width="1.2" height="1.2" rx="0.3" />
                    <rect x="16" y="15.25" width="1.2" height="1.2" rx="0.3" />
                    <rect x="17.5" y="14" width="1.2" height="1.2" rx="0.3" />
                    <rect x="17.5" y="16" width="1.2" height="1.2" rx="0.3" />
                    <rect x="16" y="17.5" width="1.2" height="1.2" rx="0.3" />
                    <rect x="17.5" y="17.5" width="1.2" height="1.2" rx="0.3" />
                  </g>
                </svg>
              </button>
            </form>
          </div>

          {/* Popular Restaurants Grid */}
          <div className="w-full">
            {filteredRestaurants.length === 0 ? (
              <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col items-center justify-center gap-4">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-12 h-12 text-neutral-300"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-neutral-400 text-sm font-semibold">
                  No restaurants found matching your search.
                </span>
              </div>
            ) : (
              <div
                ref={restaurantScrollRef}
                onScroll={handleRestaurantScroll}
                className="flex gap-1.5 md:gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2 w-full"
              >
                {[...filteredRestaurants, ...filteredRestaurants, ...filteredRestaurants].map(
                  (restaurant, idx) => (
                    <Link
                      key={`${restaurant.id}-${idx}`}
                      href={`/${restaurant.username}`}
                      className="shrink-0 w-[calc((100%-6px)/1.5)] sm:w-[calc((100%-12px)/2.2)] md:w-[calc((100%-24px)/2.7)] snap-start flex flex-col bg-white rounded-xl border border-neutral-100/80 shadow-[0_12px_36px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-300 hover:shadow-[0_24px_60px_rgba(0,0,0,0.07)] hover:-translate-y-1 group cursor-pointer"
                    >
                      {/* Restaurant Image Box with overlay badges */}
                      <div className="relative w-full aspect-[2.8/1] bg-neutral-100">
                        <div className="absolute inset-0 rounded-t-xl overflow-hidden">
                          <div className="relative w-full h-full transition-transform duration-700 group-hover:scale-105">
                            <Image
                              src={restaurant.image}
                              alt={restaurant.name}
                              fill
                              className="object-cover object-center"
                              sizes="(max-width: 640px) 67vw, (max-width: 768px) 45vw, 37vw"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-60" />
                          </div>
                        </div>
                      </div>

                      {/* Restaurant Info Section (Aligned exactly to screenshot) */}
                      <div className="flex items-center gap-3 p-3 bg-white border-t border-neutral-50/50">
                        {/* Left: Circular Logo Avatar */}
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-neutral-150 relative bg-neutral-100 shrink-0">
                          <Image
                            src={restaurant.logoImage}
                            alt={`${restaurant.name} logo`}
                            fill
                            className="object-cover"
                            sizes="44px"
                          />
                        </div>

                        {/* Right: Details Column */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* Top Line: Location & Rating */}
                          <div className="flex items-center justify-between gap-2 w-full text-neutral-400 font-semibold text-[10px] sm:text-[11px] leading-none">
                            {/* Location */}
                            <div className="flex items-center gap-0.5 min-w-0">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5 text-neutral-400/90 shrink-0"
                              >
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span className="truncate text-neutral-450">
                                {restaurant.location}
                              </span>
                            </div>

                            {/* Rating stars & number */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, starIdx) => {
                                  const ratingValue = parseFloat(restaurant.rating);
                                  const starValue = starIdx + 1;
                                  const isFull = ratingValue >= starValue;
                                  const isHalf = !isFull && ratingValue >= starValue - 0.5;

                                  if (isFull) {
                                    return (
                                      <svg
                                        key={starIdx}
                                        viewBox="0 0 24 24"
                                        className="w-3 h-3 text-amber-500 fill-amber-500"
                                        stroke="currentColor"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                      </svg>
                                    );
                                  }

                                  if (isHalf) {
                                    return (
                                      <svg
                                        key={starIdx}
                                        viewBox="0 0 24 24"
                                        className="w-3 h-3 text-amber-500"
                                        stroke="currentColor"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <defs>
                                          <linearGradient
                                            id={`half-star-pop-${restaurant.id}-${starIdx}`}
                                          >
                                            <stop offset="50%" stopColor="#f59e0b" />
                                            <stop offset="50%" stopColor="transparent" />
                                          </linearGradient>
                                        </defs>
                                        <polygon
                                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                          fill={`url(#half-star-pop-${restaurant.id}-${starIdx})`}
                                        />
                                      </svg>
                                    );
                                  }

                                  return (
                                    <svg
                                      key={starIdx}
                                      viewBox="0 0 24 24"
                                      className="w-3 h-3 text-neutral-300 fill-none"
                                      stroke="currentColor"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                  );
                                })}
                              </div>
                              <span className="text-amber-500 font-bold text-[10px] sm:text-[11.5px] leading-none">
                                ({restaurant.rating})
                              </span>
                            </div>
                          </div>

                          {/* Middle Line: Restaurant Name */}
                          <h4 className="text-[13.5px] sm:text-[14px] font-black text-neutral-900 tracking-tight leading-tight mt-1 truncate group-hover:text-neutral-700 transition-colors duration-200">
                            {restaurant.name}
                          </h4>

                          {/* Bottom Line: Cuisine (Category) */}
                          <span className="text-[10px] sm:text-[11px] font-bold text-neutral-400/95 leading-tight mt-0.5 truncate">
                            {restaurant.cuisine}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>

          {/* All Restaurants section */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full">
            {/* Restaurants Header Row */}
            <div className="flex items-center gap-3 sm:gap-4">
              <h3 className="text-xl sm:text-[24px] md:text-[28px] font-medium tracking-tight text-neutral-950 font-sans truncate whitespace-nowrap">
                Restaurants
              </h3>
              <div className="flex-1 h-[2px] bg-neutral-200/80"></div>
              <Link
                href="/restaurants"
                className="text-sm sm:text-base font-semibold text-neutral-500 hover:text-neutral-950 transition-colors duration-200 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>See more</span>
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Restaurants Grid Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 w-full">
              {filteredRestaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href={`/${restaurant.username}`}
                  className="flex flex-col bg-white rounded-xl border border-neutral-100/80 shadow-[0_12px_36px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-300 hover:shadow-[0_24px_60px_rgba(0,0,0,0.07)] hover:-translate-y-1 group cursor-pointer"
                >
                  {/* Restaurant Image Box with overlay badges */}
                  <div className="relative w-full aspect-[2.8/1] bg-neutral-100">
                    <div className="absolute inset-0 rounded-t-xl overflow-hidden">
                      <div className="relative w-full h-full transition-transform duration-500 group-hover:scale-105">
                        <Image
                          src={restaurant.image}
                          alt={restaurant.name}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-60" />
                      </div>
                    </div>
                  </div>

                  {/* Restaurant Info Section (Aligned exactly to screenshot) */}
                  <div className="flex items-center gap-3 p-3 bg-white border-t border-neutral-50/50">
                    {/* Left: Circular Logo Avatar */}
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-neutral-150 relative bg-neutral-100 shrink-0">
                      <Image
                        src={restaurant.logoImage}
                        alt={`${restaurant.name} logo`}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    </div>

                    {/* Right: Details Column */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      {/* Top Line: Location & Rating */}
                      <div className="flex items-center justify-between gap-2 w-full text-neutral-400 font-semibold text-[10px] sm:text-[11px] leading-none">
                        {/* Location */}
                        <div className="flex items-center gap-0.5 min-w-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5 text-neutral-400/90 shrink-0"
                          >
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="truncate text-neutral-450">{restaurant.location}</span>
                        </div>

                        {/* Rating stars & number */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, starIdx) => {
                              const ratingValue = parseFloat(restaurant.rating);
                              const starValue = starIdx + 1;
                              const isFull = ratingValue >= starValue;
                              const isHalf = !isFull && ratingValue >= starValue - 0.5;

                              if (isFull) {
                                return (
                                  <svg
                                    key={starIdx}
                                    viewBox="0 0 24 24"
                                    className="w-3 h-3 text-amber-500 fill-amber-500"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                );
                              }

                              if (isHalf) {
                                return (
                                  <svg
                                    key={starIdx}
                                    viewBox="0 0 24 24"
                                    className="w-3 h-3 text-amber-500"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <defs>
                                      <linearGradient
                                        id={`half-star-all-${restaurant.id}-${starIdx}`}
                                      >
                                        <stop offset="50%" stopColor="#f59e0b" />
                                        <stop offset="50%" stopColor="transparent" />
                                      </linearGradient>
                                    </defs>
                                    <polygon
                                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                      fill={`url(#half-star-all-${restaurant.id}-${starIdx})`}
                                    />
                                  </svg>
                                );
                              }

                              return (
                                <svg
                                  key={starIdx}
                                  viewBox="0 0 24 24"
                                  className="w-3 h-3 text-neutral-300 fill-none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              );
                            })}
                          </div>
                          <span className="text-amber-500 font-bold text-[10px] sm:text-[11.5px] leading-none">
                            ({restaurant.rating})
                          </span>
                        </div>
                      </div>

                      {/* Middle Line: Restaurant Name */}
                      <h4 className="text-[13.5px] sm:text-[14px] font-black text-neutral-900 tracking-tight leading-tight mt-1 truncate group-hover:text-neutral-700 transition-colors duration-200">
                        {restaurant.name}
                      </h4>

                      {/* Bottom Line: Cuisine (Category) */}
                      <span className="text-[10px] sm:text-[11px] font-bold text-neutral-400/95 leading-tight mt-0.5 truncate">
                        {restaurant.cuisine}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* How It Works Section */}
          <div className="flex flex-col gap-8 sm:gap-12 px-4 py-8 sm:p-10 mt-4 sm:mt-8 bg-neutral-50/65 rounded-none sm:rounded-[32px] border-x-0 border-y sm:border border-neutral-100/60 w-[calc(100%+24px)] -mx-3 sm:w-full sm:mx-0 relative">
            {/* Section Header */}
            <div className="flex flex-col items-center text-center gap-2.5 max-w-3xl mx-auto">
              <h3 className="text-2xl sm:text-3xl md:text-[32px] font-medium tracking-tight text-neutral-950 font-sans">
                How It Works
              </h3>
              <p className="text-sm sm:text-base text-neutral-500 font-medium max-w-2xl">
                Streamline operations and elevate the dining experience.
              </p>
            </div>

            {/* Cards Grid */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full px-2 sm:px-6 md:px-0">
              {/* Curved bezier connecting lines (visible on desktop) */}
              <div className="hidden lg:block absolute top-[20%] left-[28%] w-[10%] z-10 pointer-events-none">
                <svg className="w-full text-emerald-500/20" viewBox="0 0 100 20" fill="none">
                  <path
                    d="M 5,10 C 35,2 65,18 95,10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 88,4 L 96,10 L 88,16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>

              <div className="hidden lg:block absolute top-[20%] left-[62%] w-[10%] z-10 pointer-events-none">
                <svg className="w-full text-emerald-500/20" viewBox="0 0 100 20" fill="none">
                  <path
                    d="M 5,10 C 35,2 65,18 95,10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 88,4 L 96,10 L 88,16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>

              {/* Card 1 */}
              <div className="flex flex-col items-start text-left bg-white border border-neutral-200/50 rounded-[32px] p-3 sm:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 transition-all duration-300 relative group overflow-hidden min-h-[190px]">
                {/* Large Background Step Number */}
                <span className="text-[90px] font-black text-neutral-100/50 absolute top-2 right-6 select-none pointer-events-none group-hover:text-emerald-500/10 transition-colors duration-300 font-mono leading-none">
                  01
                </span>

                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center mb-6 relative z-10 group-hover:border-emerald-500 group-hover:shadow-[0_8px_20px_rgba(16,185,129,0.15)] transition-all duration-300">
                  <ClipboardList className="w-7 h-7 text-emerald-600" />
                </div>

                <h4 className="text-xl font-bold text-neutral-900 tracking-tight mb-2 group-hover:text-emerald-700 transition-colors duration-300">
                  Owner Adds Menu
                </h4>
                <p className="text-xs sm:text-sm text-neutral-500 font-semibold leading-relaxed mb-6">
                  Set up your digital menus with details, categories, descriptions, and premium
                  images in minutes.
                </p>

                {/* Bottom checklist box */}
                <div className="w-full mt-auto bg-neutral-50/80 rounded-2xl p-4 flex flex-col gap-3 border border-neutral-100/50 group-hover:bg-emerald-50/30 group-hover:border-emerald-100/20 transition-all duration-300">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Quick setup dashboard
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Real-time price editing
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="flex flex-col items-start text-left bg-white border border-neutral-200/50 rounded-[32px] p-3 sm:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 transition-all duration-300 relative group overflow-hidden min-h-[190px]">
                {/* Large Background Step Number */}
                <span className="text-[90px] font-black text-neutral-100/50 absolute top-2 right-6 select-none pointer-events-none group-hover:text-emerald-500/10 transition-colors duration-300 font-mono leading-none">
                  02
                </span>

                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center mb-6 relative z-10 group-hover:border-emerald-500 group-hover:shadow-[0_8px_20px_rgba(16,185,129,0.15)] transition-all duration-300">
                  <QrCode className="w-7 h-7 text-emerald-600" />
                </div>

                <h4 className="text-xl font-bold text-neutral-900 tracking-tight mb-2 group-hover:text-emerald-700 transition-colors duration-300">
                  Customers Scan & Order
                </h4>
                <p className="text-xs sm:text-sm text-neutral-500 font-semibold leading-relaxed mb-6">
                  Diners scan the unique QR code on their table to browse menus, select items, and
                  place orders directly.
                </p>

                {/* Bottom checklist box */}
                <div className="w-full mt-auto bg-neutral-50/80 rounded-2xl p-4 flex flex-col gap-3 border border-neutral-100/50 group-hover:bg-emerald-50/30 group-hover:border-emerald-100/20 transition-all duration-300">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Instant load, no app install
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Seamless table attribution
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="flex flex-col items-start text-left bg-white border border-neutral-200/50 rounded-[32px] p-3 sm:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 transition-all duration-300 relative group overflow-hidden min-h-[190px]">
                {/* Large Background Step Number */}
                <span className="text-[90px] font-black text-neutral-100/50 absolute top-2 right-6 select-none pointer-events-none group-hover:text-emerald-500/10 transition-colors duration-300 font-mono leading-none">
                  03
                </span>

                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center mb-6 relative z-10 group-hover:border-emerald-500 group-hover:shadow-[0_8px_20px_rgba(16,185,129,0.15)] transition-all duration-300">
                  <ChefHat className="w-7 h-7 text-emerald-600" />
                </div>

                <h4 className="text-xl font-bold text-neutral-900 tracking-tight mb-2 group-hover:text-emerald-700 transition-colors duration-300">
                  Kitchen Prepares in Real-time
                </h4>
                <p className="text-xs sm:text-sm text-neutral-500 font-semibold leading-relaxed mb-6">
                  Orders are instantly dispatched to the kitchen dashboard for real-time preparation
                  tracking.
                </p>

                {/* Bottom checklist box */}
                <div className="w-full mt-auto bg-neutral-50/80 rounded-2xl p-4 flex flex-col gap-3 border border-neutral-100/50 group-hover:bg-emerald-50/30 group-hover:border-emerald-100/20 transition-all duration-300">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Real-time status tracking
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-700 font-bold">
                      Reduced human order errors
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="flex flex-col gap-8 sm:gap-12 px-4 py-8 sm:p-10 mt-4 sm:mt-8 bg-neutral-50/65 rounded-none sm:rounded-[32px] border-x-0 border-y sm:border border-neutral-100/60 w-[calc(100%+24px)] -mx-3 sm:w-full sm:mx-0">
            {/* Section Header */}
            <div className="flex flex-col items-center text-center gap-2.5 max-w-3xl mx-auto">
              <h3 className="text-2xl sm:text-3xl md:text-[32px] font-bold tracking-tight text-neutral-950 font-sans">
                Why Trust Us
              </h3>
              <p className="text-sm sm:text-base text-neutral-500 font-medium max-w-2xl">
                Elevate dining experiences and streamline kitchen operations.
              </p>
            </div>

            {/* Features Flex Layout */}
            <div className="flex flex-col md:flex-row md:flex-wrap w-full px-2 sm:px-6 md:px-0">
              {/* Feature 1: Real-time Kitchen Display */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r lg:border-r border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-50/70 text-rose-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <Monitor className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-rose-700 transition-colors duration-300">
                    Real-time Kitchen Display
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Instantly route table orders to kitchen display systems. Track preparation
                    status, reduce latency, and ensure kitchen-front alignment without paper
                    tickets.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>

              {/* Mobile Divider */}
              <div className="block md:hidden w-full border-t border-black/15"></div>

              {/* Feature 2: Digital Menu Management */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r-0 lg:border-r border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-orange-50/70 text-orange-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <BookOpen className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-orange-700 transition-colors duration-300">
                    Digital Menu Management
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Update pricing, categories, and item availability in real-time. Create
                    beautiful, item-level tags and highlight chef specials or seasonal options
                    easily.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>

              {/* Mobile & Tablet Divider */}
              <div className="block lg:hidden w-full border-t border-black/15"></div>

              {/* Feature 3: Online Ordering System */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r lg:border-r-0 border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-50/70 text-emerald-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <ShoppingCart className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-emerald-700 transition-colors duration-300">
                    Online Ordering System
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Provide a clean, fast table-side ordering screen directly through
                    customers&apos; web browsers. Supports modifiers, order summaries, and custom
                    requests.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>

              {/* Mobile & Desktop Divider (Visible on desktop between Row 1 and Row 2, hidden on tablet since rows divide differently) */}
              <div className="block md:hidden lg:block w-full border-t border-black/15"></div>

              {/* Feature 4: Secure Payments (bKash) */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r-0 lg:border-r border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-pink-50/70 text-pink-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <CreditCard className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-pink-700 transition-colors duration-300">
                    Secure Payments (bKash)
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Enable fast and secure table-side checkout. Seamless integration with local
                    channels like bKash, card networks, and other digital wallets.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-pink-600 hover:text-pink-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>

              {/* Mobile & Tablet Divider */}
              <div className="block lg:hidden w-full border-t border-black/15"></div>

              {/* Feature 5: Sales Analytics */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r lg:border-r border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-blue-50/70 text-blue-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <TrendingUp className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-blue-700 transition-colors duration-300">
                    Sales Analytics
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Access live dashboard analytics. Monitor revenue trends, identify
                    high-performing dishes, and analyze customer behaviors to maximize peak hour
                    sales.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>

              {/* Mobile Divider */}
              <div className="block md:hidden w-full border-t border-black/15"></div>

              {/* Feature 6: Staff Management */}
              <div className="flex gap-4 items-start w-full md:w-1/2 lg:w-1/3 text-left group px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 md:border-r-0 lg:border-r-0 border-black/15">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-purple-50/70 text-purple-500 shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <Users className="w-[22px] h-[22px]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-[19px] sm:text-xl font-bold text-neutral-900 tracking-tight group-hover:text-purple-700 transition-colors duration-300">
                    Staff Management
                  </h4>
                  <p className="text-[14px] sm:text-[14.5px] text-neutral-500 font-medium leading-[1.65] mt-2">
                    Manage roles, permissions, shifts, and table assignments for chefs, waiters, and
                    cashiers. Ensure seamless daily operations.
                  </p>
                  <a
                    href="#"
                    className="mt-3 flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer group/link w-fit"
                  >
                    <span>See more</span>
                    <span className="transform group-hover:translate-x-1 transition-transform duration-300 select-none">
                      →
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section */}
          <div className="flex flex-col gap-8 sm:gap-12 pt-8 sm:pt-12 mt-4 sm:mt-8 border-t border-neutral-100/80 w-full relative">
            {/* Section Header with Arrows */}
            <div className="flex items-end justify-between w-full max-w-7xl mx-auto px-2 sm:px-6 md:px-0">
              <div className="flex flex-col items-start text-left gap-2">
                <h3 className="text-2xl sm:text-3xl md:text-[32px] font-medium tracking-tight text-neutral-950 font-sans">
                  What They Say
                </h3>
                <p className="text-sm sm:text-base text-neutral-500 font-medium max-w-xl">
                  Real experiences from restaurant owners who scaled their operations.
                </p>
              </div>

              {/* Navigation Arrows */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scrollTestimonials("left")}
                  className="w-10 h-10 rounded-full border border-neutral-200/80 hover:border-neutral-400 hover:bg-neutral-50 flex items-center justify-center text-neutral-600 active:scale-95 transition-all duration-250 shadow-sm"
                  aria-label="Previous Testimonial"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <button
                  onClick={() => scrollTestimonials("right")}
                  className="w-10 h-10 rounded-full border border-neutral-200/80 hover:border-neutral-400 hover:bg-neutral-50 flex items-center justify-center text-neutral-600 active:scale-95 transition-all duration-250 shadow-sm"
                  aria-label="Next Testimonial"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Testimonials Carousel Container */}
            <div
              ref={testimonialScrollRef}
              className="flex gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-4 w-full px-2 sm:px-6 md:px-0"
            >
              {/* Testimonial Card 1 */}
              <div className="shrink-0 w-full md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)] snap-start flex flex-col justify-between bg-white border border-neutral-200/60 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 h-[210px]">
                <div>
                  {/* Gold Stars */}
                  <div className="flex items-center gap-0.5 mb-2 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-xs sm:text-[13px] text-neutral-600 font-semibold italic leading-relaxed line-clamp-3">
                    &quot;Since transitioning to digital QR menus, our table turnover rate increased
                    by 25%. On busy Friday afternoons, customers scan and order instantly, reducing
                    order delays to zero.&quot;
                  </p>
                </div>
                {/* Author Info */}
                <div className="flex items-center gap-2.5 mt-3 border-t border-neutral-100/80 pt-2.5">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                    <Image
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                      alt="Tasnim Rahman"
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-neutral-950 truncate">
                      Tasnim Rahman
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 truncate">
                      General Manager, Sultan&apos;s Dine
                    </span>
                  </div>
                </div>
              </div>

              {/* Testimonial Card 2 */}
              <div className="shrink-0 w-full md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)] snap-start flex flex-col justify-between bg-white border border-neutral-200/60 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 h-[210px]">
                <div>
                  {/* Gold Stars */}
                  <div className="flex items-center gap-0.5 mb-2 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-xs sm:text-[13px] text-neutral-600 font-semibold italic leading-relaxed line-clamp-3">
                    &quot;Our younger demographic loves the table-side checkout. The bKash
                    integration makes payments frictionless, and the kitchen display prepares orders
                    in real-time.&quot;
                  </p>
                </div>
                {/* Author Info */}
                <div className="flex items-center gap-2.5 mt-3 border-t border-neutral-100/80 pt-2.5">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                    <Image
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                      alt="Zubair Siddique"
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-neutral-950 truncate">
                      Zubair Siddique
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 truncate">
                      Co-founder, Takeout Banani
                    </span>
                  </div>
                </div>
              </div>

              {/* Testimonial Card 3 */}
              <div className="shrink-0 w-full md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)] snap-start flex flex-col justify-between bg-white border border-neutral-200/60 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 h-[210px]">
                <div>
                  {/* Gold Stars */}
                  <div className="flex items-center gap-0.5 mb-2 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-xs sm:text-[13px] text-neutral-600 font-semibold italic leading-relaxed line-clamp-3">
                    &quot;Updating prices and sold-out items across multiple branches used to take
                    hours. Now, we manage everything from one unified web dashboard instantly.&quot;
                  </p>
                </div>
                {/* Author Info */}
                <div className="flex items-center gap-2.5 mt-3 border-t border-neutral-100/80 pt-2.5">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                    <Image
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt="Salman Faruq"
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-neutral-950 truncate">
                      Salman Faruq
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 truncate">
                      Director, Chillox Gulshan
                    </span>
                  </div>
                </div>
              </div>

              {/* Testimonial Card 4 */}
              <div className="shrink-0 w-full md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)] snap-start flex flex-col justify-between bg-white border border-neutral-200/60 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 h-[210px]">
                <div>
                  {/* Gold Stars */}
                  <div className="flex items-center gap-0.5 mb-2 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-xs sm:text-[13px] text-neutral-600 font-semibold italic leading-relaxed line-clamp-3">
                    &quot;With massive crowds during weekend evening hours, the automated order
                    dispatch directly to the kitchen display has minimized preparation errors
                    completely.&quot;
                  </p>
                </div>
                {/* Author Info */}
                <div className="flex items-center gap-2.5 mt-3 border-t border-neutral-100/80 pt-2.5">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                    <Image
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80"
                      alt="Sohail Ahmed"
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-neutral-950 truncate">
                      Sohail Ahmed
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 truncate">
                      Operations Head, Kacchi Bhai
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="flex flex-col gap-6 sm:gap-8 pt-6 sm:pt-10 mt-3 sm:mt-6 border-t border-neutral-100/80 w-full">
            {/* Header Area */}
            <div className="flex flex-col items-center text-center gap-2 max-w-2xl mx-auto">
              <h3 className="text-2xl sm:text-3xl md:text-[32px] font-medium tracking-tight text-neutral-950 font-sans">
                Frequently Asked Questions
              </h3>
              <p className="text-sm sm:text-base text-neutral-500 font-medium">
                Find answers to the most common questions about our restaurant menu service.
              </p>
            </div>

            {/* Accordion Container */}
            <div className="bg-white border border-neutral-200/60 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.02)] p-4 sm:p-8 max-w-4xl w-full mx-auto flex flex-col divide-y divide-neutral-100">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="w-full">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between text-left py-4 sm:py-5 font-semibold text-neutral-900 hover:text-neutral-700 transition-colors focus:outline-none gap-4"
                    >
                      <span className="text-sm sm:text-base font-medium tracking-tight text-neutral-950">
                        {item.question}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-4 h-4 text-neutral-450 transition-transform duration-300 shrink-0 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100 pb-5 sm:pb-6"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-xs sm:text-sm text-neutral-500 font-medium leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Premium Minimalist Footer Section */}
        <div className="w-full max-w-7xl mx-auto px-0 md:px-6 mt-16 md:mt-24">
          <Footer className="w-full bg-deep-emerald-950 text-white px-6 py-10 md:px-12 md:py-12 flex flex-col gap-6 md:gap-10 border-x-0 border-b-0 md:border md:border-b-0 border-deep-emerald-900 rounded-none md:rounded-t-[32px] rounded-b-none" />
        </div>

        {/* simulated QR code scanner modal */}
        {isScanning && (
          <div className="fixed inset-0 bg-deep-emerald-950/70 backdrop-blur-md z-100 flex items-center justify-center p-4">
            <style
              dangerouslySetInnerHTML={{
                __html: `
            @keyframes qrcodescan {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `,
              }}
            />
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full flex flex-col gap-6 shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-neutral-100 text-center animate-in fade-in zoom-in duration-300">
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <h3 className="text-lg font-black text-neutral-950 tracking-tight font-sans flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    className="w-6 h-6 text-neutral-800"
                  >
                    {/* Outer brackets */}
                    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />

                    {/* Finder Patterns Outer Borders */}
                    {/* Top Left */}
                    <rect x="5.5" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                    {/* Top Right */}
                    <rect x="13" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                    {/* Bottom Left */}
                    <rect x="5.5" y="13" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />

                    {/* Inner Solid Components & Data Grid */}
                    <g fill="currentColor" stroke="none">
                      {/* Finder Top Left Inner */}
                      <rect x="7.25" y="7.25" width="2" height="2" rx="0.5" />
                      {/* Finder Top Right Inner */}
                      <rect x="14.75" y="7.25" width="2" height="2" rx="0.5" />
                      {/* Finder Bottom Left Inner */}
                      <rect x="7.25" y="14.75" width="2" height="2" rx="0.5" />

                      {/* Bottom Right Pixel Matrix */}
                      <rect x="13" y="13" width="1.2" height="1.2" rx="0.3" />
                      <rect x="13" y="15" width="1.2" height="1.2" rx="0.3" />
                      <rect x="13" y="17.5" width="1.2" height="1.2" rx="0.3" />
                      <rect x="14.5" y="14.25" width="1.2" height="1.2" rx="0.3" />
                      <rect x="14.5" y="16.25" width="1.2" height="1.2" rx="0.3" />
                      <rect x="16" y="13" width="1.2" height="1.2" rx="0.3" />
                      <rect x="16" y="15.25" width="1.2" height="1.2" rx="0.3" />
                      <rect x="17.5" y="14" width="1.2" height="1.2" rx="0.3" />
                      <rect x="17.5" y="16" width="1.2" height="1.2" rx="0.3" />
                      <rect x="16" y="17.5" width="1.2" height="1.2" rx="0.3" />
                      <rect x="17.5" y="17.5" width="1.2" height="1.2" rx="0.3" />
                    </g>
                  </svg>
                  <span>Scan Menu QR Code</span>
                </h3>
                <button
                  onClick={() => setIsScanning(false)}
                  className="w-8 h-8 rounded-full border border-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-900 active:scale-95 transition-all duration-200"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-4 h-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Viewfinder Box */}
              <div className="relative aspect-square w-full bg-deep-emerald-950 rounded-2xl overflow-hidden flex items-center justify-center border border-deep-emerald-800 shadow-inner">
                {/* Scanline laser */}
                <div
                  className="absolute left-0 w-full h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] z-25"
                  style={{ animation: "qrcodescan 2s infinite linear" }}
                />

                {/* Viewfinder corner brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-md" />

                {/* Real Video element if supported or simulated scanning feedback */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />

                {/* simulated scan graphic overlay in case camera not yet accepted */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/40 z-10 select-none pointer-events-none">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="w-16 h-16 text-white/20 animate-pulse"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-[11px] font-bold text-neutral-400/80 uppercase tracking-widest leading-relaxed">
                    Connecting camera...
                    <br />
                    Hold QR Code steady
                  </span>
                </div>
              </div>

              {/* Hint caption */}
              <p className="text-[12.5px] font-bold text-neutral-500 leading-normal px-2">
                Scan the QR Code on your table or menu stand to view item details instantly.
              </p>
            </div>
          </div>
        )}

        {/* Premium Toast Notification for QR Code Scan Result */}
        {scanResultToast && (
          <div className="fixed bottom-6 right-6 bg-deep-emerald-950 text-white border border-deep-emerald-800 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-[13.5px] font-bold font-sans">{scanResultToast}</span>
          </div>
        )}
      </main>
    </div>
  );
}
