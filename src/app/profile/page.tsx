"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import ImageUploader from "../../../ui/ImageUploader";
import Dropdown from "../../../ui/Dropdown";
import FormattedTextarea from "../../../ui/FormattedTextarea";
import { Menu, Bell, Store, Check } from "lucide-react";

interface CustomRestaurantDetails {
  name: string;
  cuisine: string;
  location: string;
  phone: string;
  operatingHours: string;
  image: string;
  logoImage: string;
  rating: string;
  reviews: string;
  time: string;
  price: string;
  facilities: string;
  introText: string;
  descriptionText: string;
  offerSlides?: string[];
}

const DEFAULT_DETAILS: CustomRestaurantDetails = {
  name: "Burger Craft Lab",
  cuisine: "Gourmet Burgers & Shakes",
  location: "Dhanmondi, Dhaka",
  phone: "+880 1712-345678",
  operatingHours: "11:00 AM - 11:00 PM",
  image:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&auto=format&fit=crop&q=80",
  logoImage:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&auto=format&fit=crop&q=80",
  rating: "4.9",
  reviews: "1,240+",
  time: "15-25 min",
  price: "$$",
  facilities: "Air Conditioned, Wifi, Table QR ordering, bKash payments accepted",
  introText:
    "Welcome to Burger Craft Lab digital menu. Scan our unique QR codes directly at your table to place real-time kitchen orders instantly.",
  descriptionText:
    "Welcome to Burger Craft Lab, where we specialize in serving premium quality gourmet burgers & shakes options in Dhanmondi, Dhaka. Our digital ordering platform enables customers to scan table QR codes to enjoy immediate kitchen preparation status tracking and side payment checkout simulations.",
};

const timeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

const priceOptions = [
  { value: "$", label: "$ (Budget Friendly)" },
  { value: "$$", label: "$$ (Moderate)" },
  { value: "$$$", label: "$$$ (Upscale)" },
  { value: "$$$$", label: "$$$$ (Ultra Luxury)" },
];

const prepTimeValueOptions = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "25", label: "25 min" },
  { value: "30", label: "30 min" },
  { value: "35", label: "35 min" },
  { value: "40", label: "40 min" },
  { value: "45", label: "45 min" },
  { value: "50", label: "50 min" },
  { value: "55", label: "55 min" },
  { value: "60", label: "60 min" },
];

export default function ManageRestaurantPage() {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state variables
  const [name, setName] = useState(DEFAULT_DETAILS.name);
  const [cuisine, setCuisine] = useState(DEFAULT_DETAILS.cuisine);
  const [location, setLocation] = useState(DEFAULT_DETAILS.location);
  const [phone, setPhone] = useState(DEFAULT_DETAILS.phone);
  const [image, setImage] = useState(DEFAULT_DETAILS.image);
  const [logoImage, setLogoImage] = useState(DEFAULT_DETAILS.logoImage);
  const [rating, setRating] = useState(DEFAULT_DETAILS.rating);
  const [reviews, setReviews] = useState(DEFAULT_DETAILS.reviews);
  const [price, setPrice] = useState(DEFAULT_DETAILS.price);
  const [facilities, setFacilities] = useState(DEFAULT_DETAILS.facilities);
  const [introText, setIntroText] = useState(DEFAULT_DETAILS.introText);
  const [descriptionText, setDescriptionText] = useState(DEFAULT_DETAILS.descriptionText);
  const [startTime, setStartTime] = useState("15");
  const [endTime, setEndTime] = useState("25");
  const [startHours, setStartHours] = useState("11:00 AM");
  const [endHours, setEndHours] = useState("11:00 PM");
  const [offerSlides, setOfferSlides] = useState<string[]>([]);

  const cuisineDropdownOptions = useMemo(() => {
    const presets = [
      { value: "Gourmet Burgers & Shakes", label: "Gourmet Burgers & Shakes" },
      { value: "Italian Pasta & Pizza", label: "Italian Pasta & Pizza" },
      { value: "Traditional Japanese & Sushi", label: "Traditional Japanese & Sushi" },
      { value: "Sichuan & Cantonese Chinese", label: "Sichuan & Cantonese Chinese" },
      { value: "Mexican Tacos & Grill", label: "Mexican Tacos & Grill" },
      { value: "Indian & South Asian Curry", label: "Indian & South Asian Curry" },
      { value: "Thai & Southeast Asian", label: "Thai & Southeast Asian" },
      { value: "Cafe & Bakery Desserts", label: "Cafe & Bakery Desserts" },
      { value: "Continental & Fusion", label: "Continental & Fusion" },
    ];
    if (cuisine && !presets.some((p) => p.value === cuisine)) {
      return [{ value: cuisine, label: cuisine }, ...presets];
    }
    return presets;
  }, [cuisine]);

  const startPrepTimeOptions = useMemo(() => {
    return prepTimeValueOptions.filter((opt) => parseInt(opt.value) < 60);
  }, []);

  const endPrepTimeOptions = useMemo(() => {
    const startVal = parseInt(startTime) || 5;
    return prepTimeValueOptions.filter((opt) => parseInt(opt.value) > startVal);
  }, [startTime]);

  const operatingHoursOptions = useMemo(() => {
    const options = [];
    const periods = ["AM", "PM"];
    for (let p = 0; p < 2; p++) {
      const period = periods[p];
      for (let h = 0; h < 12; h++) {
        const hourStr = h === 0 ? "12" : h.toString();
        options.push({ value: `${hourStr}:00 ${period}`, label: `${hourStr}:00 ${period}` });
        options.push({ value: `${hourStr}:30 ${period}`, label: `${hourStr}:30 ${period}` });
      }
    }
    return options;
  }, []);

  const startOperatingHoursOptions = useMemo(() => {
    return operatingHoursOptions.filter((opt) => opt.value !== "11:30 PM");
  }, [operatingHoursOptions]);

  const endOperatingHoursOptions = useMemo(() => {
    const startMins = timeToMinutes(startHours);
    return operatingHoursOptions.filter((opt) => timeToMinutes(opt.value) > startMins);
  }, [startHours, operatingHoursOptions]);

  const ratingDropdownOptions = useMemo(() => {
    const presets = [];
    for (let r = 50; r >= 10; r -= 1) {
      const val = (r / 10).toFixed(1);
      presets.push({ value: val, label: val });
    }
    if (rating && !presets.some((p) => p.value === rating)) {
      return [{ value: rating, label: rating }, ...presets];
    }
    return presets;
  }, [rating]);

  const [userDisplayName] = useState("Color Hut Admin");

  useEffect(() => {
    // Load restaurant details from API
    fetch("/api/tenant/restaurant-details")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setName(data.name || DEFAULT_DETAILS.name);
        setCuisine(data.cuisine || DEFAULT_DETAILS.cuisine);
        setLocation(data.location || DEFAULT_DETAILS.location);
        setPhone(data.phone || DEFAULT_DETAILS.phone);
        const hoursVal = data.operating_hours || DEFAULT_DETAILS.operatingHours;
        const hoursParts = hoursVal.split(/\s*-\s*/);
        if (hoursParts.length === 2) {
          setStartHours(hoursParts[0] || "11:00 AM");
          setEndHours(hoursParts[1] || "11:00 PM");
        }
        setImage(data.image || DEFAULT_DETAILS.image);
        setLogoImage(data.logo_image || DEFAULT_DETAILS.logoImage);
        setRating(data.rating || DEFAULT_DETAILS.rating);
        setReviews(data.reviews || DEFAULT_DETAILS.reviews);
        const timeVal = data.time || DEFAULT_DETAILS.time;
        const match = timeVal.match(/(\d+)(?:-(\d+))?/);
        if (match) {
          setStartTime(match[1] || "15");
          setEndTime(match[2] || match[1] || "25");
        }
        setPrice(data.price || DEFAULT_DETAILS.price);
        setFacilities(data.facilities || DEFAULT_DETAILS.facilities);
        setIntroText(data.intro_text || DEFAULT_DETAILS.introText);
        setDescriptionText(data.description_text || DEFAULT_DETAILS.descriptionText);
        // Cover slides: use offer_slides JSON if present, else the main image
        try {
          let slidesVal = data.offer_slides;
          while (slidesVal && typeof slidesVal === "string") {
            slidesVal = JSON.parse(slidesVal);
          }
          const slides = Array.isArray(slidesVal) ? slidesVal : null;
          setOfferSlides(
            slides && slides.length > 0
              ? slides
              : data.image
                ? [data.image]
                : [DEFAULT_DETAILS.image],
          );
        } catch {
          setOfferSlides(data.image ? [data.image] : [DEFAULT_DETAILS.image]);
        }
      })
      .catch(() => {
        /* silently fall back to defaults */
      });
  }, [router]);

  const handleLogout = () => {
    router.push("/login");
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    let newEnd = endTime;
    if (parseInt(newEnd) <= parseInt(newStart)) {
      const nextOption = prepTimeValueOptions.find(
        (opt) => parseInt(opt.value) > parseInt(newStart),
      );
      newEnd = nextOption ? nextOption.value : newStart;
      setEndTime(newEnd);
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    let newStart = startTime;
    if (parseInt(newEnd) <= parseInt(newStart)) {
      const prevOptions = prepTimeValueOptions.filter(
        (opt) => parseInt(opt.value) < parseInt(newEnd),
      );
      const prevOption = prevOptions[prevOptions.length - 1];
      newStart = prevOption ? prevOption.value : newEnd;
      setStartTime(newStart);
    }
    setEndTime(newEnd);
  };

  const handleStartHoursChange = (newStart: string) => {
    setStartHours(newStart);
    let newEnd = endHours;
    if (timeToMinutes(newEnd) <= timeToMinutes(newStart)) {
      const nextOption = operatingHoursOptions.find(
        (opt) => timeToMinutes(opt.value) > timeToMinutes(newStart),
      );
      newEnd = nextOption ? nextOption.value : newStart;
      setEndHours(newEnd);
    }
  };

  const handleEndHoursChange = (newEnd: string) => {
    let newStart = startHours;
    if (timeToMinutes(newEnd) <= timeToMinutes(newStart)) {
      const prevOptions = operatingHoursOptions.filter(
        (opt) => timeToMinutes(opt.value) < timeToMinutes(newEnd),
      );
      const prevOption = prevOptions[prevOptions.length - 1];
      newStart = prevOption ? prevOption.value : newEnd;
      setStartHours(newStart);
    }
    setEndHours(newEnd);
  };

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      triggerToast("Restaurant name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/tenant/restaurant-details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cuisine,
          location,
          phone,
          operatingHours: `${startHours} - ${endHours}`,
          image,
          logoImage,
          logo: name.charAt(0).toUpperCase(),
          logoBg: "from-amber-500 to-orange-600",
          rating,
          reviews,
          time: `${startTime}-${endTime} min`,
          price,
          facilities,
          introText,
          descriptionText,
          offerSlides,
        }),
      });

      if (res.ok) {
        triggerToast("Restaurant details updated successfully!");
      } else {
        const err = await res.json();
        triggerToast(err.error || "Failed to save. Please try again.");
      }
    } catch {
      triggerToast("Network error. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to restore default restaurant parameters?")) {
      localStorage.removeItem("custom_restaurant_details");
      setName(DEFAULT_DETAILS.name);
      setCuisine(DEFAULT_DETAILS.cuisine);
      setLocation(DEFAULT_DETAILS.location);
      setPhone(DEFAULT_DETAILS.phone);
      setStartHours("11:00 AM");
      setEndHours("11:00 PM");
      setImage(DEFAULT_DETAILS.image);
      setLogoImage(DEFAULT_DETAILS.logoImage);
      setRating(DEFAULT_DETAILS.rating);
      setReviews(DEFAULT_DETAILS.reviews);
      setStartTime("15");
      setEndTime("25");
      setPrice(DEFAULT_DETAILS.price);
      setFacilities(DEFAULT_DETAILS.facilities);
      setIntroText(DEFAULT_DETAILS.introText);
      setDescriptionText(DEFAULT_DETAILS.descriptionText);
      setOfferSlides([]);
      triggerToast("Restored factory default details.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-800 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          activeTab="profile"
          setActiveTab={() => {}}
          ordersCount={0}
          handleLogout={handleLogout}
          isCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative animate-in slide-in-from-left duration-200">
            <Sidebar
              activeTab="profile"
              setActiveTab={() => {}}
              ordersCount={0}
              handleLogout={handleLogout}
              isMobile={true}
              isCollapsed={false}
              onCloseMobile={() => setIsMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-105 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800 flex items-center gap-2">
              <Store className="w-5 h-5 text-[#ff7a00]" />
              <span>Manage Details</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors relative">
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff7a00] ring-2 ring-white" />
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#ff7a00] to-amber-500 flex items-center justify-center font-bold text-xs text-white">
                CH
              </div>
              <span className="hidden md:inline text-xs font-semibold text-slate-600">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Floating Toast Notification */}
        {showToast && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-950/90 text-emerald-300 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{showToast}</span>
          </div>
        )}

        {/* Page Body */}
        <main className="p-6 w-full flex-1 flex flex-col gap-6 pb-20">
          {/* Form Settings */}
          <form onSubmit={handleSave} className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: General Details */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-5 h-fit">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">General Details</h3>
                <p className="text-[11px] text-slate-500">
                  Core branding settings, locations, and images
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Burger Craft Lab"
                      className="h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-slate-50/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Cuisine Style
                    </label>
                    <Dropdown
                      value={cuisine}
                      onChange={setCuisine}
                      options={cuisineDropdownOptions}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Geographic Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Dhanmondi, Dhaka"
                      className="h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-slate-50/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +880 1712-345678"
                      className="h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Operating Hours
                    </label>
                    <div className="flex items-center gap-2">
                      <Dropdown
                        value={startHours}
                        onChange={handleStartHoursChange}
                        options={startOperatingHoursOptions}
                        className="flex-1"
                        buttonClassName="w-full h-10 px-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0 max-h-48 overflow-y-auto"
                      />
                      <span className="text-slate-400 text-xs font-semibold px-0.5">to</span>
                      <Dropdown
                        value={endHours}
                        onChange={handleEndHoursChange}
                        options={endOperatingHoursOptions}
                        className="flex-1"
                        buttonClassName="w-full h-10 px-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0 max-h-48 overflow-y-auto"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Price Tier
                    </label>
                    <Dropdown
                      value={price}
                      onChange={setPrice}
                      options={priceOptions}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Brand Logo Image
                  </label>
                  <div className="flex items-center gap-3">
                    {logoImage ? (
                      <div className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 shadow-xs animate-in zoom-in-95 duration-150">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoImage}
                          alt="Logo Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_DETAILS.logoImage;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setLogoImage("")}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <ImageUploader
                      onUploadSuccess={setLogoImage}
                      label={logoImage ? "Change Logo" : "Upload Logo"}
                      className="shrink-0"
                      buttonClassName="h-14"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Cover Banner Images (Slideshow)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {offerSlides.map((slide, idx) => (
                      <div
                        key={idx}
                        className="relative group w-28 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 shadow-xs animate-in zoom-in-95 duration-150"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide}
                          alt={`Banner ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_DETAILS.image;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = offerSlides.filter((_, i) => i !== idx);
                            setOfferSlides(updated);
                            setImage(updated[0] || DEFAULT_DETAILS.image);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {offerSlides.length < 5 && (
                      <ImageUploader
                        multiple
                        onUploadSuccess={(url) => {
                          if (url) {
                            setOfferSlides((prev) => {
                              if (prev.length >= 5) return prev;
                              const updated = [...prev, url];
                              setImage(updated[0]);
                              return updated;
                            });
                          }
                        }}
                        label="Add Banner"
                        className="shrink-0"
                        buttonClassName="h-14 w-28"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: About Details */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-5 h-fit">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">About & Ratings</h3>
                <p className="text-[11px] text-slate-500">
                  Extended profiles, customer intro, description, and score parameters
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Additional Facilities
                  </label>
                  <input
                    type="text"
                    value={facilities}
                    onChange={(e) => setFacilities(e.target.value)}
                    placeholder="e.g. Air Conditioned, Wifi, Table QR ordering..."
                    className="h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Intro Text
                  </label>
                  <FormattedTextarea
                    value={introText}
                    onChange={setIntroText}
                    placeholder="Provide a short intro text..."
                    rows={2}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Restaurant Information Description
                  </label>
                  <FormattedTextarea
                    value={descriptionText}
                    onChange={setDescriptionText}
                    placeholder="Provide detailed restaurant information..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Rating Score
                    </label>
                    <Dropdown
                      value={rating}
                      onChange={setRating}
                      options={ratingDropdownOptions}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0 max-h-48 overflow-y-auto"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Reviews Count text
                    </label>
                    <input
                      type="text"
                      value={reviews}
                      onChange={(e) => setReviews(e.target.value)}
                      placeholder="e.g. 1,240+"
                      className="h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-slate-50/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Average Prep Time
                    </label>
                    <div className="flex items-center gap-2">
                      <Dropdown
                        value={startTime}
                        onChange={handleStartTimeChange}
                        options={startPrepTimeOptions}
                        className="flex-1"
                        buttonClassName="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0 max-h-48 overflow-y-auto"
                      />
                      <span className="text-slate-400 text-xs font-semibold px-0.5">to</span>
                      <Dropdown
                        value={endTime}
                        onChange={handleEndTimeChange}
                        options={endPrepTimeOptions}
                        className="flex-1"
                        buttonClassName="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl justify-between shadow-none font-medium text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0 max-h-48 overflow-y-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 mt-2 lg:col-span-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 h-11 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-98 cursor-pointer"
              >
                Restore Defaults
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-8 h-11 flex items-center justify-center rounded-xl bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-bold transition-all active:scale-98 shadow-md hover:shadow-lg shadow-orange-500/10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Modifications"
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
