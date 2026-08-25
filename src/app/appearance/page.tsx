"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import ImageUploader from "../../../ui/ImageUploader";
import Dropdown from "../../../ui/Dropdown";
import {
  Palette,
  Save,
  Check,
  RotateCcw,
  Menu,
  Bell,
  Eye,
  Type,
  Layout,
  Star,
  Clock,
  Utensils,
} from "lucide-react";

const COLOR_PRESETS = [
  { name: "Orange", hex: "#ff7a00", bgClass: "bg-[#ff7a00]" },
  { name: "Rose", hex: "#e11d48", bgClass: "bg-[#e11d48]" },
  { name: "Emerald", hex: "#10b981", bgClass: "bg-[#10b981]" },
  { name: "Sky Blue", hex: "#0ea5e9", bgClass: "bg-[#0ea5e9]" },
  { name: "Indigo", hex: "#6366f1", bgClass: "bg-[#6366f1]" },
  { name: "Amber", hex: "#f59e0b", bgClass: "bg-[#f59e0b]" },
];

const FONT_PRESETS = [
  { name: "Outfit (Default)", value: "Outfit", style: "font-sans" },
  { name: "Inter (Clean)", value: "Inter", style: "font-sans" },
  { name: "Playfair Display (Elegant)", value: "Playfair Display", style: "font-serif" },
  { name: "Poppins (Modern)", value: "Poppins", style: "font-sans" },
];

const LAYOUT_PRESETS = [
  {
    name: "Grid Layout (Visual)",
    value: "grid",
    description: "Multi-column grids with large item photos.",
  },
  {
    name: "List Layout (Descriptive)",
    value: "list",
    description: "Single-column full width list descriptions.",
  },
  {
    name: "Compact Layout (Minimalist)",
    value: "compact",
    description: "Ultra-fast text lines, perfect for dense lists.",
  },
  {
    name: "Masonry Layout (Dynamic)",
    value: "masonry",
    description: "Staggered multi-column grid, perfect for varying description lengths.",
  },
];

export default function AppearancePage() {
  const router = useRouter();
  const [activeTab] = useState("appearance");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Authenticated details
  const [userRole, setUserRole] = useState("admin");
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");

  // Customizer settings states
  const [restaurantName, setRestaurantName] = useState("Burger Craft Lab");
  const [cuisine, setCuisine] = useState("Gourmet Burgers");
  const [rating, setRating] = useState("4.9");
  const [price, setPrice] = useState("$$");
  const [time, setTime] = useState("15-25 min");
  const [logoBg, setLogoBg] = useState("from-amber-500 to-orange-600");
  const [coverImage, setCoverImage] = useState(
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
  );
  const [logoImage, setLogoImage] = useState(
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
  );

  const [primaryColor, setPrimaryColor] = useState("#ff7a00");
  const [fontFamily, setFontFamily] = useState("Outfit");
  const [layoutType, setLayoutType] = useState("grid");

  // Fetch current details
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("userRole") || "admin";
      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setUserRole(role);
      setUserDisplayName(localStorage.getItem("userDisplayName") || "Color Hut Admin");

      fetch("/api/tenant/restaurant-details")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setRestaurantName(data.name || "Burger Craft Lab");
            setCuisine(data.cuisine || "Gourmet Burgers");
            setRating(data.rating || "4.9");
            setPrice(data.price || "$$");
            setTime(data.time || "15-25 min");
            setLogoBg(data.logo_bg || "from-amber-500 to-orange-600");
            setCoverImage(
              data.image ||
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
            );
            setLogoImage(
              data.logo_image ||
                "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
            );
            setPrimaryColor(data.primary_color || "#ff7a00");
            setFontFamily(data.font_family || "Outfit");
            setLayoutType(data.layout_type || "grid");
          }
        });
    }
  }, [router]);

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleSaveAppearance = async () => {
    try {
      // First get existing details
      const getRes = await fetch("/api/tenant/restaurant-details");
      const currentDetails = await getRes.json();

      const response = await fetch("/api/tenant/restaurant-details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentDetails,
          image: coverImage,
          logo_image: logoImage,
          primaryColor,
          fontFamily,
          layoutType,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        triggerToast("Appearance settings saved successfully!");
      } else {
        triggerToast(data.error || "Failed to save appearance settings.");
      }
    } catch {
      triggerToast("Error updating settings.");
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Are you sure you want to reset themes to factory defaults?")) {
      setPrimaryColor("#ff7a00");
      setFontFamily("Outfit");
      setLayoutType("grid");
      triggerToast("Reset to default styling values.");
    }
  };

  const handleLogout = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-800 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          activeTab="appearance"
          setActiveTab={() => {}}
          ordersCount={0}
          handleLogout={handleLogout}
          isCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative animate-in slide-in-from-left duration-200">
            <Sidebar
              activeTab="appearance"
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

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Sticky Header */}
        <header className="bg-white border-b border-[#e1e7ef] h-16 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border-none bg-transparent"
              type="button"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#ff7a00]" />
              <span>Menu Appearance Customizer</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="relative p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer border-none bg-transparent"
              type="button"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff7a00] rounded-full" />
            </button>

            <div className="h-8 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#ff7a00] flex items-center justify-center font-bold text-xs">
                CH
              </div>
              <span className="hidden md:inline text-xs font-semibold text-slate-600">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Floating Success Toast */}
        {showToast && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/35 bg-emerald-955/90 text-emerald-300 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{showToast}</span>
          </div>
        )}

        {/* Customizer Workspace Layout */}
        <main className="p-4 sm:p-6 lg:p-8 w-full flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Controls Panel */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            {/* Design Presets Box */}
            <div className="bg-white border border-[#e1e7ef] rounded-[16px] p-6 shadow-sm flex flex-col gap-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#ff7a00]" />
                <span>Branding Themes & Colors</span>
              </h2>

              {/* Theme Colors selector */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Primary Theme Color
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = primaryColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        onClick={() => setPrimaryColor(preset.hex)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-slate-50 ${
                          isSelected
                            ? "border-[#ff7a00] bg-orange-50/10 shadow-xs"
                            : "border-slate-200 bg-white"
                        }`}
                        type="button"
                      >
                        <span
                          className={`w-6 h-6 rounded-full ${preset.bgClass} flex items-center justify-center shrink-0`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                        <span className="text-[10px] font-bold text-slate-650">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography Font Selection */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span>Typography Font Style</span>
                </label>
                <div className="w-full sm:max-w-xs">
                  <Dropdown
                    value={fontFamily}
                    onChange={setFontFamily}
                    options={FONT_PRESETS.map((font) => ({ value: font.value, label: font.name }))}
                    className="w-full"
                    buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                    menuClassName="w-full left-0 right-0"
                  />
                </div>
              </div>

              {/* Menu Item Layout grid selection */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-slate-400" />
                  <span>Product Card Layout Style</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {LAYOUT_PRESETS.map((preset) => {
                    const isSelected = layoutType === preset.value;
                    return (
                      <button
                        key={preset.value}
                        onClick={() => setLayoutType(preset.value)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all hover:bg-slate-50 flex flex-col gap-1.5 ${
                          isSelected
                            ? "border-[#ff7a00] bg-orange-50/10 shadow-xs"
                            : "border-slate-200 bg-white"
                        }`}
                        type="button"
                      >
                        <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                        <span className="text-[10px] text-slate-450 leading-normal font-medium">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="bg-white border border-[#e1e7ef] rounded-[16px] p-5 shadow-sm flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAppearance}
                className="px-5 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Theme Settings</span>
              </button>
            </div>
          </div>

          {/* Real-time Preview Mobile View Mockup Frame */}
          <div className="xl:col-span-5 flex flex-col items-center gap-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 self-start">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Real-Time Public Menu Preview</span>
            </span>

            {/* Smart Phone Shell Frame Mockup container */}
            <div className="relative w-[310px] h-[610px] rounded-[36px] bg-black p-3.5 shadow-2xl border-4 border-slate-800 ring-10 ring-slate-900/5 transition-all select-none">
              {/* Notch speaker */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-2xl z-20 flex items-center justify-center gap-1.5">
                <span className="w-8 h-1 bg-slate-900 rounded-full" />
                <span className="w-1.5 h-1.5 bg-slate-950 rounded-full" />
              </div>

              {/* Screen viewport */}
              <div className="w-full h-full bg-[#f0f2f5] rounded-[24px] overflow-hidden flex flex-col relative text-slate-855 select-none">
                {/* Scrollable View Area */}
                <div className="flex-1 overflow-y-auto pb-4" style={{ fontFamily: fontFamily }}>
                  {/* Banner Image Cover preview */}
                  <div className="relative w-full h-[110px] bg-neutral-200 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImage} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/15" />
                  </div>

                  {/* Header Profile layout preview overlay */}
                  <div className="px-3.5 -mt-8 relative mb-3 flex items-end gap-2.5">
                    {/* Logo circle */}
                    <div className="w-[68px] h-[68px] rounded-full p-1 bg-white shadow-md shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoImage}
                        alt="Logo"
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>

                    {/* Restaurant meta */}
                    <div className="flex-1 pb-1">
                      <h4 className="text-[11px] font-bold text-slate-900 leading-tight tracking-tight line-clamp-1">
                        {restaurantName}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-0.5 line-clamp-1">
                        {cuisine}
                      </p>
                    </div>
                  </div>

                  {/* Quick summary badges */}
                  <div className="px-3.5 flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200/50 text-amber-600 text-[8px] font-bold">
                      <Star className="w-2 h-2 fill-amber-500 text-amber-500" />
                      <span>{rating}</span>
                    </div>
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-550 text-[8px] font-bold">
                      <Clock className="w-2 h-2" />
                      <span>{time}</span>
                    </div>
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-550 text-[8px] font-bold">
                      <span>Price: {price}</span>
                    </div>
                  </div>

                  {/* Facebook Style Custom Tabs preview bar */}
                  <div className="border-y border-slate-200/70 bg-white flex items-center justify-around py-2 px-1 mb-4 select-none">
                    <span
                      className="text-[9px] font-bold pb-1 cursor-pointer transition-colors"
                      style={{
                        color: primaryColor,
                        borderBottom: `2.5px solid ${primaryColor}`,
                      }}
                    >
                      Menu
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 pb-1 cursor-pointer">
                      About
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 pb-1 cursor-pointer">
                      Reviews
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 pb-1 cursor-pointer">
                      Orders
                    </span>
                  </div>

                  {/* Food category list row */}
                  <div className="px-3.5 mb-3 flex gap-1.5 overflow-x-hidden">
                    <span
                      className="px-2.5 py-1 text-[8px] font-bold rounded-full text-white shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      All Items
                    </span>
                    <span className="px-2.5 py-1 text-[8px] font-bold rounded-full bg-slate-200/50 text-slate-650 shrink-0">
                      Popular
                    </span>
                    <span className="px-2.5 py-1 text-[8px] font-bold rounded-full bg-slate-200/50 text-slate-650 shrink-0">
                      Main Course
                    </span>
                  </div>

                  {/* Dynamic Product Cards Layout render */}
                  <div className="px-3.5">
                    {layoutType === "grid" && (
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          {
                            name: "Smash Burger Duo",
                            price: "$12.99",
                            desc: "Double patty premium blend with cheddar cheese",
                            img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80",
                          },
                          {
                            name: "Fries Basket",
                            price: "$4.50",
                            desc: "Crispy seasoned golden potatoes served with sauce",
                            img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&auto=format&fit=crop&q=80",
                          },
                        ].map((item) => (
                          <div
                            key={item.name}
                            className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs flex flex-col"
                          >
                            <div className="w-full h-16 bg-neutral-200 overflow-hidden relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.img}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 flex-1 flex flex-col justify-between gap-1.5">
                              <div>
                                <h5 className="text-[9px] font-bold text-slate-900 line-clamp-1">
                                  {item.name}
                                </h5>
                                <p className="text-[7px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                                  {item.desc}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-0.5 pt-1.5 border-t border-slate-55 border-dashed">
                                <span className="text-[9px] font-bold text-slate-800">
                                  {item.price}
                                </span>
                                <span
                                  className="w-4 h-4 rounded-full text-white flex items-center justify-center font-bold text-[10px] cursor-pointer"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  +
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {layoutType === "list" && (
                      <div className="flex flex-col gap-2">
                        {[
                          {
                            name: "Premium Smash Burger Duo",
                            price: "$12.99",
                            desc: "Double patty premium blend with cheddar cheese, pickles, and our signature sauce in brioche bun.",
                            img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80",
                          },
                        ].map((item) => (
                          <div
                            key={item.name}
                            className="bg-white border border-slate-100 rounded-xl p-2.5 shadow-xs flex items-center gap-2.5"
                          >
                            <div className="w-14 h-14 bg-neutral-200 overflow-hidden rounded-lg shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.img}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-14">
                              <div>
                                <h5 className="text-[9px] font-bold text-slate-900 line-clamp-1">
                                  {item.name}
                                </h5>
                                <p className="text-[7px] text-slate-450 line-clamp-2 mt-0.5 leading-snug font-semibold">
                                  {item.desc}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[9px] font-bold text-slate-800">
                                  {item.price}
                                </span>
                                <span
                                  className="px-2.5 py-0.5 rounded-md text-white text-[8px] font-bold cursor-pointer"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  Add
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {layoutType === "compact" && (
                      <div className="flex flex-col gap-1.5 bg-white border border-slate-100 rounded-xl p-2.5 shadow-xs">
                        {[
                          { name: "Classic Beef Smash Burger Duo", price: "$12.99" },
                          { name: "Seasoned Potato Fries Basket", price: "$4.50" },
                          { name: "Chilled Vanilla Craft Shake", price: "$5.25" },
                        ].map((item) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <h5 className="text-[9px] font-bold text-slate-800 line-clamp-1">
                                {item.name}
                              </h5>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[9px] font-bold text-slate-800">
                                {item.price}
                              </span>
                              <span
                                className="w-3.5 h-3.5 rounded text-white flex items-center justify-center font-bold text-[9px] cursor-pointer"
                                style={{ backgroundColor: primaryColor }}
                              >
                                +
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {layoutType === "masonry" && (
                      <div className="columns-2 gap-2.5 [column-fill:_balance]">
                        {[
                          {
                            name: "Smash Burger Duo",
                            price: "$12.99",
                            desc: "Double patty premium blend with cheddar cheese and onions.",
                            img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80",
                          },
                          {
                            name: "Fries Basket",
                            price: "$4.50",
                            desc: "Crispy seasoned golden potatoes.",
                            img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&auto=format&fit=crop&q=80",
                          },
                          {
                            name: "Vanilla Milkshake",
                            price: "$5.99",
                            desc: "Creamy vanilla ice cream blended with fresh milk, topped with whipped cream.",
                            img: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=200&auto=format&fit=crop&q=80",
                          },
                        ].map((item) => (
                          <div
                            key={item.name}
                            className="break-inside-avoid inline-block w-full mb-2.5 bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs flex flex-col"
                          >
                            <div className="w-full h-12 bg-neutral-200 overflow-hidden relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.img}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 flex-1 flex flex-col justify-between gap-1.5">
                              <div>
                                <h5 className="text-[9px] font-bold text-slate-900 line-clamp-1">
                                  {item.name}
                                </h5>
                                <p className="text-[7px] text-slate-400 line-clamp-4 mt-0.5 leading-snug">
                                  {item.desc}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-0.5 pt-1.5 border-t border-slate-55 border-dashed">
                                <span className="text-[9px] font-bold text-slate-800">
                                  {item.price}
                                </span>
                                <span
                                  className="w-4 h-4 rounded-full text-white flex items-center justify-center font-bold text-[10px] cursor-pointer"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  +
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer mock nav */}
                <div className="h-10 border-t border-slate-200/80 bg-white flex items-center justify-between px-6 z-10 shrink-0">
                  <span className="w-4 h-4 bg-slate-200 rounded-full shrink-0" />
                  <span className="w-10 h-3 bg-slate-200 rounded-full shrink-0" />
                  <span className="w-4 h-4 bg-slate-200 rounded-full shrink-0" />
                </div>
              </div>
            </div>

            <span className="text-[10px] text-slate-400 font-bold text-center mt-1">
              Mock Phone (iPhone 14 Frame)
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
