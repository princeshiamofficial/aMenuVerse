"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { RESTAURANTS } from "../data/restaurants";

export default function RestaurantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
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

  // Camera QR scanner simulation states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResultToast, setScanResultToast] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync active search with input value
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Manage camera stream when scanning
  useEffect(() => {
    if (isScanning) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        })
        .catch((err) => {
          console.error("Camera access failed:", err);
        });

      // Simulate a successful scan after 4 seconds
      const scanTimer = setTimeout(() => {
        setIsScanning(false);
        setScanResultToast("Table QR Code scanned successfully!");
        setTimeout(() => setScanResultToast(null), 3500);
      }, 4000);

      return () => {
        clearTimeout(scanTimer);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [isScanning]);

  // Merge custom restaurant details into the RESTAURANTS list
  const mergedRestaurants = useMemo(() => {
    return RESTAURANTS.map((restaurant) => {
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
  }, [customRestaurant]);

  // Extract unique cuisines for category tabs
  const cuisines = useMemo(() => {
    const list = new Set(mergedRestaurants.map((r) => r.cuisine.split(" ")[0]));
    return ["All", ...Array.from(list)];
  }, [mergedRestaurants]);

  // Filter restaurants based on search query and selected category tab
  const filteredRestaurants = useMemo(() => {
    return mergedRestaurants.filter((restaurant) => {
      const matchesSearch =
        restaurant.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        restaurant.cuisine.toLowerCase().includes(activeSearch.toLowerCase()) ||
        restaurant.location.toLowerCase().includes(activeSearch.toLowerCase());

      const matchesCuisine =
        selectedCuisine === "All" ||
        restaurant.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase());

      return matchesSearch && matchesCuisine;
    });
  }, [mergedRestaurants, activeSearch, selectedCuisine]);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans antialiased pb-0 select-none">
      {/* Sticky Header Layer in DeepEmerald theme */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-8 md:gap-12">
        {/* Search & Categories Bar Container */}
        <div className="flex flex-col gap-4 w-full">
          {/* Search Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full border-b border-neutral-200/60 pb-5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 self-start sm:self-center">
              All Restaurants
            </h2>

            {/* Elegant Search Input & Standalone QR Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <div className="relative flex items-center bg-white border border-neutral-200/80 rounded-2xl px-5 py-2.5 w-full sm:w-[320px] transition-all duration-300 focus-within:border-neutral-400 shadow-sm h-[46px]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-[18px] h-[18px] text-neutral-450 mr-3 shrink-0"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search restaurant or cuisine..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-neutral-800 placeholder-neutral-400 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="w-5 h-5 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-450 hover:text-neutral-700 transition-colors cursor-pointer mr-0.5"
                  >
                    <span className="text-[10px] font-black">✕</span>
                  </button>
                )}
              </div>

              {/* QR Scanner Button exactly like Home page */}
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="bg-deep-emerald-950 hover:bg-deep-emerald-850 text-white rounded-2xl w-[46px] h-[46px] flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm shrink-0 cursor-pointer"
                title="Scan Menu QR Code"
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
                  <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />

                  {/* Finder Patterns Outer Borders */}
                  <rect x="5.5" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                  <rect x="13" y="5.5" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />
                  <rect x="5.5" y="13" width="5.5" height="5.5" rx="1.2" strokeWidth="1.8" />

                  {/* Inner Solid Components & Data Grid */}
                  <g fill="currentColor" stroke="none">
                    <rect x="7.25" y="7.25" width="2" height="2" rx="0.5" />
                    <rect x="14.75" y="7.25" width="2" height="2" rx="0.5" />
                    <rect x="7.25" y="14.75" width="2" height="2" rx="0.5" />

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
            </div>
          </div>

          {/* Categories/Cuisine Selector Pills */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none w-full -mx-4 px-4 sm:mx-0 sm:px-0">
            {cuisines.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => setSelectedCuisine(cuisine)}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap active:scale-95 border cursor-pointer ${
                  selectedCuisine === cuisine
                    ? "bg-deep-emerald-950 text-white border-deep-emerald-950 shadow-sm"
                    : "bg-white text-neutral-600 hover:text-neutral-900 border-neutral-200/70 hover:border-neutral-350"
                }`}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Grid */}
        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-neutral-150 flex flex-col items-center justify-center gap-4 shadow-sm w-full">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-16 h-16 text-neutral-300"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
            </svg>
            <h3 className="text-lg font-bold text-neutral-800">No restaurants found</h3>
            <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-sm px-6">
              We couldn&apos;t find any kitchen matching &quot;{searchQuery}&quot; under &quot;
              {selectedCuisine}&quot;. Try widening your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full">
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
                  <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
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
                                      id={`half-star-rest-${restaurant.id}-${starIdx}`}
                                    >
                                      <stop offset="50%" stopColor="#f59e0b" />
                                      <stop offset="50%" stopColor="transparent" />
                                    </linearGradient>
                                  </defs>
                                  <polygon
                                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                    fill={`url(#half-star-rest-${restaurant.id}-${starIdx})`}
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
        )}
      </main>
      {/* Premium Minimalist Footer Section */}
      <div className="w-full max-w-7xl mx-auto px-0 md:px-6 mt-16 md:mt-24">
        <Footer className="w-full bg-deep-emerald-950 text-white px-6 py-10 md:px-12 md:py-12 flex flex-col gap-6 md:gap-10 border-x-0 border-b-0 md:border md:border-b-0 border-deep-emerald-900 rounded-none md:rounded-t-[32px] rounded-b-none" />
      </div>

      {/* Simulated Scanner Viewfinder Overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-deep-emerald-950/70 backdrop-blur-md z-100 flex items-center justify-center p-4">
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @keyframes scanlaser {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `,
            }}
          />
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full flex flex-col gap-6 shadow-2xl border border-neutral-100 text-center animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h3 className="text-lg font-black text-neutral-950 tracking-tight flex items-center gap-2">
                Scan Menu QR Code
              </h3>
              <button
                onClick={() => setIsScanning(false)}
                className="w-8 h-8 rounded-full border border-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-900 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Camera Viewfinder screen box */}
            <div className="relative aspect-square w-full bg-deep-emerald-950 rounded-2xl overflow-hidden flex items-center justify-center border border-deep-emerald-800 shadow-inner">
              <div
                className="absolute left-0 w-full h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] z-25"
                style={{ animation: "scanlaser 2s infinite linear" }}
              />
              <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-md" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-md" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-md" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-md" />

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 bg-black/40 z-10">
                <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-widest leading-relaxed">
                  Connecting camera...
                  <br />
                  Hold QR steady
                </span>
              </div>
            </div>

            <p className="text-[12.5px] font-bold text-neutral-500">
              Scan the QR Code on your table to access instant table services.
            </p>
          </div>
        </div>
      )}

      {/* Scan result notification toast */}
      {scanResultToast && (
        <div className="fixed bottom-6 right-6 bg-deep-emerald-950 text-white border border-deep-emerald-800 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[13.5px] font-bold">{scanResultToast}</span>
        </div>
      )}
    </div>
  );
}
