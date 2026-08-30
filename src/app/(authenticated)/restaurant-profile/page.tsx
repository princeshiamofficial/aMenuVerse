"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  Upload,
  Building2,
  BadgeCheck,
  MapPin,
  Star,
  Clock,
  ThumbsUp,
  Info,
  Phone,
  Calendar,
  Pencil,
  Share2,
  Palette,
  Sparkles,
  LayoutGrid,
  ListFilter,
  Check,
  Eye,
  Search,
  Bell,
  MoreVertical,
  ShoppingBag,
  Plus,
  Utensils,
  Type,
  ChevronDown,
  Globe,
} from "lucide-react";
import {
  getRestaurantProfile,
  updateRestaurantProfile,
  getCurrentUser,
} from "@/lib/db-queries.server";
import { uploadToImgBB } from "@/lib/imgbb";
import { BlobImg } from "@/components/ui/blob-img";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  fetchReviewsFromGoogleMapsUrl,
  GOOGLE_MAPS_URL,
  isValidGoogleMapsUrl,
} from "@/lib/google-reviews";

const THEME_HEX_MAP: Record<string, string> = {
  amber: "#f59e0b",
  emerald: "#10b981",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  dark: "#111827",
};

const DEFAULT_APPEARANCE = {
  themeColor: "amber",
  menuLayout: "cards",
  fontFamily: "sans",
  bannerStyle: "full",
};

type AppearanceSettings = typeof DEFAULT_APPEARANCE;

const FONT_OPTIONS = [
  {
    id: "sans",
    name: "Outfit",
    category: "Default Modern",
    family: "'Outfit', sans-serif",
    sizeClass: "text-sm font-bold",
  },
  {
    id: "inter",
    name: "Inter",
    category: "Minimalist Sans",
    family: "'Inter', sans-serif",
    sizeClass: "text-sm font-semibold",
  },
  {
    id: "serif",
    name: "Playfair Display",
    category: "Elegant Serif",
    family: "'Playfair Display', serif",
    sizeClass: "text-base font-bold italic",
  },
  {
    id: "poppins",
    name: "Poppins",
    category: "Geometric Sans",
    family: "'Poppins', sans-serif",
    sizeClass: "text-sm font-bold",
  },
  {
    id: "caveat",
    name: "Caveat",
    category: "Handwriting Cursive",
    family: "'Caveat', cursive",
    sizeClass: "text-xl font-bold text-amber-900",
  },
  {
    id: "bethellen",
    name: "Beth Ellen",
    category: "Script",
    family: "'Beth Ellen', cursive",
    sizeClass: "text-sm font-normal text-amber-950",
  },
  {
    id: "systemui",
    name: "Ui Sans-Serif",
    category: "Native Sans Serif",
    family:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sizeClass: "text-sm font-bold",
  },
  {
    id: "pacifico",
    name: "Pacifico",
    category: "Brush",
    family: "'Pacifico', cursive",
    sizeClass: "text-base font-normal text-amber-900",
  },
];

function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "Always Open") return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  if (period === "AM" && hours < 5) hours += 24;

  return hours * 60 + minutes;
}

const START_TIME_OPTIONS = [
  "Always Open",
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
];

const END_TIME_OPTIONS = [
  "06:30 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
  "11:30 PM",
  "12:00 AM",
  "01:00 AM",
  "02:00 AM",
  "03:00 AM",
];

export type ProfileBranding = {
  name: string;
  slug?: string;
  address: string;
  intro: string;
  description: string;
  openingHours: string;
  phone: string;
  facilities: string;
  rating: string;
  avgPrepTime: string;
  cuisineType: string;
  logo: string;
  cover: string;
  favicon?: string;
  socialPreview?: string;
  isVerified?: boolean;
  googleMapsUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
};

const DEFAULT_BRANDING: ProfileBranding = {
  name: "",
  slug: "",
  address: "Main Location",
  intro:
    "Welcome to our digital menu. Scan our unique QR codes directly at your table to place real-time kitchen orders instantly.",
  description:
    "Welcome to our restaurant, where we specialize in serving premium quality gourmet food options.",
  openingHours: "11:00 AM - 11:00 PM",
  phone: "+880 1700-000000",
  facilities: "Air Conditioned, Wifi, Table QR ordering, bKash payments accepted",
  rating: "4.2 Stars (23 reviews)",
  avgPrepTime: "15-25 min",
  cuisineType: "Gourmet Kitchen",
  logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
  cover:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=80",
  favicon: "",
  socialPreview: "",
  googleMapsUrl: GOOGLE_MAPS_URL,
  facebookUrl: "",
  instagramUrl: "",
  whatsappNumber: "",
};

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RestaurantProfilePage() {
  const [branding, setBranding] = useState<ProfileBranding>(DEFAULT_BRANDING);
  const [editForm, setEditForm] = useState<ProfileBranding>(DEFAULT_BRANDING);
  const [editIntroForm, setEditIntroForm] = useState<ProfileBranding>(DEFAULT_BRANDING);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isEditingIntro, setIsEditingIntro] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [googleMapsUrlInput, setGoogleMapsUrlInput] = useState(GOOGLE_MAPS_URL);
  const [isFetchingGMap, setIsFetchingGMap] = useState(false);
  const [isSavingIntro, setIsSavingIntro] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isSocialPreviewModalOpen, setIsSocialPreviewModalOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    async function loadData() {
      try {
        const dbData = await getRestaurantProfile();
        if (dbData) {
          setBranding((prev) => {
            const updated = { ...prev, ...dbData };
            setEditForm(updated);
            setEditIntroForm(updated);
            return updated;
          });
          const appData = dbData.appearance || {};
          setAppearance({
            themeColor: appData.themeColor || "amber",
            menuLayout: appData.menuLayout || "cards",
            fontFamily: appData.fontFamily || "sans",
            bannerStyle: "full",
          });
        }
      } catch (dbErr) {
        console.warn("[MySQL] getRestaurantProfile fetch warning:", dbErr);
      }
      setHydrated(true);
    }

    loadData();
  }, []);

  const getRealSlug = () => {
    const rawSlug = (branding.slug || "").trim();
    if (rawSlug && rawSlug !== "restaurant-profile" && rawSlug !== "profile") {
      return rawSlug;
    }
    if (branding.name) {
      const dbSlug = branding.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (dbSlug && dbSlug !== "restaurantprofile") return dbSlug;
    }
    return "burgercraftlab";
  };

  const handleShareProfile = () => {
    const slug = getRealSlug();
    const shareTitle = branding.name || "Digital Menu";
    const shareUrl = `${window.location.origin}/${slug}`;
    if (navigator.share) {
      navigator
        .share({
          title: shareTitle,
          text: `Check out ${shareTitle} digital menu on aMenuVerse!`,
          url: shareUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(shareUrl);
          toast.success("Share link copied to clipboard!");
        });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    }
  };

  const handleFetchGoogleReviews = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetUrl = googleMapsUrlInput.trim() || GOOGLE_MAPS_URL;
    setIsFetchingGMap(true);

    try {
      const res = fetchReviewsFromGoogleMapsUrl(targetUrl);
      if (res.success) {
        const updatedBranding = {
          ...branding,
          googleMapsUrl: res.googleMapsUrl,
          rating: `${res.ratingSummary.average} Stars (${res.ratingSummary.total} reviews)`,
        };
        setBranding(updatedBranding);
        setEditForm(updatedBranding);
        setEditIntroForm(updatedBranding);

        toast.success("Google Maps reviews fetched in-memory successfully!");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to fetch reviews from Google Maps URL.");
    } finally {
      setIsFetchingGMap(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updated = { ...branding, ...editForm };
    setBranding(updated);
    setIsEditingInfo(false);
    try {
      await updateRestaurantProfile({ data: editForm });
      if (typeof window !== "undefined" && updated.name) {
        window.dispatchEvent(
          new CustomEvent("menuverse:profile-updated", { detail: { name: updated.name } }),
        );
      }
      toast.success("Restaurant information updated silently!");
    } catch (err) {
      console.warn("[MySQL] Save info error:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntro = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingIntro(true);
    const updated = { ...branding, ...editIntroForm };
    setBranding(updated);
    setIsEditingIntro(false);
    try {
      await updateRestaurantProfile({ data: editIntroForm });
      toast.success("Intro details updated silently!");
    } catch (err) {
      console.warn("[MySQL] Save intro error:", err);
      toast.error("Failed to save intro changes");
    } finally {
      setIsSavingIntro(false);
    }
  };

  const onImage = async (
    e: ChangeEvent<HTMLInputElement>,
    key: "logo" | "cover" | "favicon" | "socialPreview",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB");
      return;
    }

    // Instant silent local preview (0ms latency, 0 page refreshes)
    const localPreviewUrl = URL.createObjectURL(file);
    setBranding((prev) => {
      const updated = { ...prev, [key]: localPreviewUrl };
      setEditForm(updated);
      setEditIntroForm(updated);
      return updated;
    });

    const labelMap: Record<string, string> = {
      cover: "cover photo",
      logo: "logo",
      favicon: "favicon icon",
      socialPreview: "social preview (OG) image",
    };

    const labelStr = labelMap[key] || "image";
    const toastId = toast.loading(`Uploading ${labelStr}...`);

    try {
      const cdnUrl = await uploadToImgBB(file);
      setBranding((prev) => {
        const updated = { ...prev, [key]: cdnUrl };
        setEditForm(updated);
        setEditIntroForm(updated);
        return updated;
      });

      await updateRestaurantProfile({ data: { [key]: cdnUrl } });

      toast.dismiss(toastId);
      toast.success(
        `${labelStr.charAt(0).toUpperCase() + labelStr.slice(1)} updated successfully!`,
      );
    } catch (err) {
      console.warn("[ImgBB Upload Warning]", err);
      toast.dismiss(toastId);
    }
  };

  const updateAppearanceAndSync = async (updated: AppearanceSettings) => {
    setAppearance(updated);
    try {
      await updateRestaurantProfile({ data: { appearance: updated } });
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.warn("[MySQL] updateAppearanceAndSync error:", err);
    }
  };

  const selectedFontOption =
    FONT_OPTIONS.find((fontOption) => fontOption.id === (appearance.fontFamily || "sans")) ||
    FONT_OPTIONS[0];
  if (!hydrated) return null;

  return (
    <div
      className="profile-root -m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        .profile-root, .profile-root * {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
        .profile-root [data-font-preview="sans"] {
          font-family: "Outfit", sans-serif !important;
        }
        .profile-root [data-font-preview="inter"] {
          font-family: "Inter", sans-serif !important;
        }
        .profile-root [data-font-preview="serif"] {
          font-family: "Playfair Display", serif !important;
        }
        .profile-root [data-font-preview="poppins"] {
          font-family: "Poppins", sans-serif !important;
        }
        .profile-root [data-font-preview="caveat"] {
          font-family: "Caveat", cursive !important;
        }
        .profile-root [data-font-preview="bethellen"] {
          font-family: "Beth Ellen", cursive !important;
        }
        .profile-root [data-font-preview="pacifico"] {
          font-family: "Pacifico", cursive !important;
        }
      `}</style>

      {/* Cover & Logo Banner Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Cover Area */}
        <div className="relative w-full h-32 sm:h-72 md:h-80 overflow-hidden bg-slate-900">
          <img
            src={
              branding.cover ||
              "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=80"
            }
            alt={branding.name || "Cover Photo"}
            className="w-full h-full object-cover object-center transition-all"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=80";
            }}
          />
          <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
            <span className="hidden sm:inline-flex items-center rounded-full bg-black/40 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
              Rec: 1600×450 px (3.5:1 ratio)
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white shadow-md backdrop-blur hover:bg-black/80 transition-all">
              <Upload className="h-3.5 w-3.5" /> {branding.cover ? "Change Cover" : "Upload Cover"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onImage(e, "cover")}
              />
            </label>
          </div>
        </div>

        {/* Logo & Name Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-6 -mt-12 sm:-mt-16 relative z-10">
          <div className="flex items-end gap-4 sm:gap-5 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <label className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-50 shadow-md relative group cursor-pointer flex items-center justify-center">
                <img
                  src={branding.logo || "/default-logo.png"}
                  alt={branding.name || "Logo"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/default-logo.png";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Upload className="h-6 w-6" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImage(e, "logo")}
                />
              </label>
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-xl sm:text-2xl text-gray-900 leading-tight">
                  {branding.name || DEFAULT_BRANDING.name}
                </h2>
                {branding.isVerified && (
                  <BadgeCheck className="h-6 w-6 fill-blue-500 text-white shrink-0" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 font-medium">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{branding.address || DEFAULT_BRANDING.address}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Edit Info & Share Restaurant Page URL */}
          <div className="shrink-0 pb-1 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditForm(branding);
                setIsEditingInfo(true);
                const el = document.getElementById("restaurant-info-card");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Pencil className="h-4 w-4 text-white shrink-0" />
              <span className="whitespace-nowrap">Edit Profile & Social Links</span>
            </button>

            <button
              type="button"
              onClick={handleShareProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-95 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
              title="Share Restaurant Page URL"
            >
              <Share2 className="h-4 w-4 text-white shrink-0" />
              <span className="whitespace-nowrap font-bold">Share Page</span>
            </button>
          </div>
        </div>
      </div>

      {/* LIVE PUBLIC PAGE DATA PREVIEW GRID */}
      <div>
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Intro & Appearance Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Intro Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Intro</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditingIntro) {
                      setEditIntroForm(branding);
                    }
                    setIsEditingIntro(!isEditingIntro);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-600" />
                  {isEditingIntro ? "Cancel" : "Edit Intro"}
                </button>
              </div>

              {isEditingIntro ? (
                <form onSubmit={handleSaveIntro} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Intro Description
                    </label>
                    <textarea
                      rows={3}
                      value={editIntroForm.intro}
                      onChange={(e) =>
                        setEditIntroForm({
                          ...editIntroForm,
                          intro: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Rating Text
                    </label>
                    <input
                      type="text"
                      value={editIntroForm.rating}
                      onChange={(e) =>
                        setEditIntroForm({
                          ...editIntroForm,
                          rating: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Average Prep Time
                    </label>
                    <input
                      type="text"
                      value={editIntroForm.avgPrepTime}
                      onChange={(e) =>
                        setEditIntroForm({
                          ...editIntroForm,
                          avgPrepTime: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Cuisine Type
                    </label>
                    <input
                      type="text"
                      value={editIntroForm.cuisineType}
                      onChange={(e) =>
                        setEditIntroForm({
                          ...editIntroForm,
                          cuisineType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingIntro(false)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingIntro}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isSavingIntro ? "Saving..." : "Save Intro"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed font-normal">
                    {branding.intro || DEFAULT_BRANDING.intro}
                  </p>

                  <div className="mt-5 pt-4 border-t border-gray-100/80 space-y-3">
                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0" />
                      <span>
                        Rated{" "}
                        <strong className="font-bold text-gray-900">
                          {branding.rating || DEFAULT_BRANDING.rating}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>Located at {branding.address || DEFAULT_BRANDING.address}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                      <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>
                        Average preparation: {branding.avgPrepTime || DEFAULT_BRANDING.avgPrepTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                      <ThumbsUp className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Cuisine type: {branding.cuisineType || DEFAULT_BRANDING.cuisineType}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Google Maps Review Sync Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-amber-500 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-900">Google Maps Reviews Sync</h3>
                </div>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                  Live URL Parser
                </Badge>
              </div>

              <form onSubmit={handleFetchGoogleReviews} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Google Maps Place URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://maps.app.goo.gl/..."
                      value={googleMapsUrlInput}
                      onChange={(e) => setGoogleMapsUrlInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isFetchingGMap}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
                    >
                      {isFetchingGMap ? "Fetching..." : "Fetch Reviews"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500 font-medium">
                    Paste any Google Maps link (e.g. https://maps.app.goo.gl/esG9Vkaf3MiRy1Ne9) to
                    parse & sync live verified customer reviews on your public menu.
                  </p>
                </div>
              </form>
            </div>

            {/* Restaurant Information Card */}
            <div
              id="restaurant-info-card"
              className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between gap-2 text-gray-900 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-gray-500 shrink-0" />
                  <h3 className="text-lg font-bold">Restaurant Information</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditingInfo) {
                      setEditForm(branding);
                    }
                    setIsEditingInfo(!isEditingInfo);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-600" />
                  {isEditingInfo ? "Cancel" : "Edit Info"}
                </button>
              </div>
              {isEditingInfo ? (
                <form onSubmit={handleSaveInfo} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">About</label>
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          description: e.target.value,
                          intro: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Address / Location
                      </label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Opening Hours
                      </label>
                      {(() => {
                        const isAlways = editForm.openingHours.trim() === "Always Open";
                        const curStart = isAlways
                          ? "Always Open"
                          : editForm.openingHours.split(" - ")[0] || "11:00 AM";
                        const curEnd = isAlways
                          ? ""
                          : editForm.openingHours.split(" - ")[1] || "11:00 PM";
                        const startM = timeToMinutes(curStart);
                        const validEnd = END_TIME_OPTIONS.filter((t) => timeToMinutes(t) > startM);

                        return (
                          <div className="flex items-center gap-2">
                            <select
                              value={curStart}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "Always Open") {
                                  setEditForm({ ...editForm, openingHours: "Always Open" });
                                } else {
                                  const newStartM = timeToMinutes(val);
                                  const filtered = END_TIME_OPTIONS.filter(
                                    (t) => timeToMinutes(t) > newStartM,
                                  );
                                  let nextEnd = curEnd;
                                  if (!filtered.includes(nextEnd)) {
                                    nextEnd =
                                      filtered.find((t) => t === "11:00 PM") ||
                                      filtered[0] ||
                                      "11:30 PM";
                                  }
                                  setEditForm({ ...editForm, openingHours: `${val} - ${nextEnd}` });
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
                            >
                              {START_TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>

                            {!isAlways && (
                              <>
                                <span className="text-xs text-gray-400 font-semibold">to</span>
                                <select
                                  value={curEnd}
                                  onChange={(e) => {
                                    setEditForm({
                                      ...editForm,
                                      openingHours: `${curStart} - ${e.target.value}`,
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
                                >
                                  {validEnd.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Cuisine Type
                      </label>
                      <input
                        type="text"
                        value={editForm.cuisineType}
                        onChange={(e) => setEditForm({ ...editForm, cuisineType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Additional Facilities
                    </label>
                    <input
                      type="text"
                      value={editForm.facilities}
                      onChange={(e) => setEditForm({ ...editForm, facilities: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>

                  {/* Social & Quick Contact Links Config */}
                  <div className="border-t border-gray-100 pt-3.5 mt-3 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                      <Globe className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Social & Quick Contact Links</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Facebook Link / Handle
                        </label>
                        <input
                          type="text"
                          placeholder="https://facebook.com/your-restaurant"
                          value={editForm.facebookUrl || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, facebookUrl: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Instagram Link / Handle
                        </label>
                        <input
                          type="text"
                          placeholder="https://instagram.com/your-restaurant"
                          value={editForm.instagramUrl || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, instagramUrl: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          WhatsApp Number
                        </label>
                        <input
                          type="text"
                          placeholder="+8801700000000"
                          value={editForm.whatsappNumber || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, whatsappNumber: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Direct Call Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+8801700000000"
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed font-normal">
                    {branding.description || DEFAULT_BRANDING.description}
                  </p>

                  <div className="mt-6 space-y-4 pt-4 border-t border-gray-100/80">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>Address / Location</span>
                      </div>
                      <p className="mt-1 ml-6 text-xs text-gray-600 font-medium">
                        {branding.address || DEFAULT_BRANDING.address}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>Opening Hours</span>
                      </div>
                      <p className="mt-1 ml-6 text-xs text-gray-600 font-medium">
                        {branding.openingHours || DEFAULT_BRANDING.openingHours}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>Phone Number</span>
                      </div>
                      <p className="mt-1 ml-6 text-xs font-bold text-teal-700">
                        {branding.phone || DEFAULT_BRANDING.phone}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>Additional Facilities</span>
                      </div>
                      <p className="mt-1 ml-6 text-xs text-gray-600 font-medium">
                        {branding.facilities || DEFAULT_BRANDING.facilities}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Appearance & Theme Card + Real-Time Mobile Preview Phone Mockup (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Appearance & Theme Section Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-amber-500 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-900">Appearance & Theme</h3>
                </div>
              </div>

              <div className="mt-4 space-y-5">
                {/* Brand Theme Accent Color */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Menu Accent Color Theme
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {[
                      {
                        id: "amber",
                        name: "Warm Amber",
                        bg: "bg-amber-500",
                        ring: "ring-amber-500",
                      },
                      {
                        id: "emerald",
                        name: "Emerald Green",
                        bg: "bg-emerald-500",
                        ring: "ring-emerald-500",
                      },
                      {
                        id: "rose",
                        name: "Sunset Rose",
                        bg: "bg-rose-500",
                        ring: "ring-rose-500",
                      },
                      {
                        id: "violet",
                        name: "Royal Violet",
                        bg: "bg-violet-500",
                        ring: "ring-violet-500",
                      },
                      {
                        id: "indigo",
                        name: "Deep Indigo",
                        bg: "bg-indigo-600",
                        ring: "ring-indigo-600",
                      },
                      {
                        id: "dark",
                        name: "Midnight Dark",
                        bg: "bg-gray-900",
                        ring: "ring-gray-900",
                      },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          updateAppearanceAndSync({
                            ...appearance,
                            themeColor: theme.id,
                          });
                          toast.success(`Theme set to ${theme.name}!`);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer",
                          appearance.themeColor === theme.id
                            ? `${theme.ring} ring-2 bg-gray-50 text-gray-900 font-bold border-transparent`
                            : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                        )}
                      >
                        <span className={cn("h-3 w-3 rounded-full shrink-0", theme.bg)} />
                        <span>{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Menu Layout Picker */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Menu Layout Style
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsLayoutDropdownOpen((prev) => !prev)}
                      className={cn(
                        "w-full px-3 py-2 bg-white border rounded-md flex items-center justify-between transition-all cursor-pointer shadow-2xs text-left text-xs font-semibold",
                        isLayoutDropdownOpen
                          ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
                          : "border-gray-200/90 hover:border-amber-400 hover:bg-gray-50/50",
                      )}
                    >
                      <span className="flex items-center gap-2 font-semibold text-gray-900">
                        {(() => {
                          const currentLayout = [
                            { id: "cards", label: "Cards View", icon: LayoutGrid },
                            { id: "list", label: "Compact List View", icon: ListFilter },
                          ].find((l) => l.id === appearance.menuLayout) || {
                            id: "cards",
                            label: "Cards View",
                            icon: LayoutGrid,
                          };
                          const IconComp = currentLayout.icon;
                          return (
                            <>
                              <IconComp className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>{currentLayout.label}</span>
                            </>
                          );
                        })()}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0",
                          isLayoutDropdownOpen && "rotate-180 text-amber-600",
                        )}
                      />
                    </button>

                    {isLayoutDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setIsLayoutDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-gray-200/90 rounded-md shadow-lg p-1 space-y-0.5">
                          {[
                            { id: "cards", label: "Cards View", icon: LayoutGrid },
                            { id: "list", label: "Compact List View", icon: ListFilter },
                          ].map((layout) => {
                            const IconComp = layout.icon;
                            const isSelected = appearance.menuLayout === layout.id;
                            return (
                              <button
                                key={layout.id}
                                type="button"
                                onClick={() => {
                                  updateAppearanceAndSync({
                                    ...appearance,
                                    menuLayout: layout.id,
                                  });
                                  setIsLayoutDropdownOpen(false);
                                  toast.success(`Layout set to ${layout.label}!`);
                                }}
                                className={cn(
                                  "w-full px-2.5 py-1.5 rounded-sm text-left transition-all cursor-pointer flex items-center justify-between group text-xs font-semibold",
                                  isSelected
                                    ? "bg-amber-100/80 text-amber-950 font-bold border border-amber-200/80"
                                    : "hover:bg-gray-50 text-gray-800 border border-transparent",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <IconComp
                                    className={cn(
                                      "w-3.5 h-3.5 shrink-0",
                                      isSelected
                                        ? "text-amber-700"
                                        : "text-gray-400 group-hover:text-gray-600",
                                    )}
                                  />
                                  <span>{layout.label}</span>
                                </div>

                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-amber-900 stroke-3 shrink-0 ml-1.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Canva-Style Visual Font Picker Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Menu Font Family
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFontDropdownOpen((prev) => !prev)}
                      className={cn(
                        "w-full px-3 py-2 bg-white border rounded-md flex items-center justify-between transition-all cursor-pointer shadow-2xs text-left",
                        isFontDropdownOpen
                          ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
                          : "border-gray-200/90 hover:border-amber-400 hover:bg-gray-50/50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        <span
                          data-font-preview={selectedFontOption.id}
                          className="text-xs font-bold text-gray-900 truncate"
                        >
                          {selectedFontOption.name}
                        </span>
                      </span>

                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0",
                          isFontDropdownOpen && "rotate-180 text-amber-600",
                        )}
                      />
                    </button>

                    {isFontDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setIsFontDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-64 overflow-y-auto bg-white border border-gray-200/90 rounded-md shadow-lg p-1 space-y-0.5">
                          {FONT_OPTIONS.map((fontOption) => {
                            const isSelected = appearance.fontFamily === fontOption.id;
                            return (
                              <button
                                key={fontOption.id}
                                type="button"
                                onClick={() => {
                                  updateAppearanceAndSync({
                                    ...appearance,
                                    fontFamily: fontOption.id,
                                  });
                                  setIsFontDropdownOpen(false);
                                  toast.success(`Font family set to ${fontOption.name}!`);
                                }}
                                className={cn(
                                  "w-full px-2.5 py-2 rounded-sm text-left transition-all cursor-pointer flex items-center justify-between group",
                                  isSelected
                                    ? "bg-amber-100/80 text-amber-950 font-bold border border-amber-200/80"
                                    : "hover:bg-gray-50 text-gray-800 border border-transparent",
                                )}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <span
                                    data-font-preview={fontOption.id}
                                    className={cn(
                                      "min-w-24 truncate leading-none",
                                      fontOption.sizeClass,
                                    )}
                                  >
                                    {fontOption.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className="text-[9px] font-semibold text-gray-400 group-hover:text-gray-600 transition-colors font-sans">
                                    {fontOption.category}
                                  </span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-amber-900 stroke-3 shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Save Appearance Button */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 font-medium">
                    Applied to public menu
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateRestaurantProfile({ data: { appearance } });
                        toast.success("Appearance settings saved & synced live to public menu!");
                      } catch {
                        toast.error("Failed to save appearance settings");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Save Theme</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Favicon & Social Preview Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-gray-900">
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                  <h3 className="text-lg font-bold">Favicon & Social Preview</h3>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-800"
                >
                  Public Branding
                </Badge>
              </div>

              <p className="text-xs text-gray-500 font-medium">
                Upload your custom favicon for browser tabs and social preview image (OG Image) for
                link shares on WhatsApp, Facebook, and Twitter.
              </p>

              {/* Favicon Section */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Browser Tab Favicon (Rec: 32×32 px or 64×64 px)
                </label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {branding.favicon ? (
                      <BlobImg
                        src={branding.favicon}
                        alt="Favicon"
                        className="h-8 w-8 object-contain"
                      />
                    ) : branding.logo ? (
                      <BlobImg
                        src={branding.logo}
                        alt="Favicon fallback"
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <Globe className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all">
                    <Upload className="h-3.5 w-3.5" />{" "}
                    {branding.favicon ? "Change Favicon" : "Upload Favicon"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onImage(e, "favicon")}
                    />
                  </label>
                  {branding.favicon && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBranding((prev) => ({ ...prev, favicon: "" }));
                        await updateRestaurantProfile({ data: { favicon: "" } });
                        toast.success("Favicon reset to default");
                      }}
                      className="text-xs font-medium text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Social Preview OG Image Section */}
              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Social Share Preview Image (OG Image — Rec: 1200×630 px)
                </label>
                <div className="space-y-2">
                  <div
                    className="w-full h-32 rounded-xl border border-gray-200 bg-gray-50 bg-cover bg-center overflow-hidden relative group transition-all"
                    style={{
                      backgroundImage: branding.socialPreview
                        ? `url(${branding.socialPreview})`
                        : branding.cover
                          ? `url(${branding.cover})`
                          : "linear-gradient(135deg, #1c2b4a, #f59e0b)",
                    }}
                  >
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-black/70 hover:bg-black/90 px-3.5 py-2 text-xs font-semibold text-white shadow-md backdrop-blur transition-all">
                        <Upload className="h-3.5 w-3.5" />{" "}
                        {branding.socialPreview ? "Change OG Image" : "Upload OG Image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onImage(e, "socialPreview")}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-gray-400 font-medium">
                      This preview image displays when customers share your public restaurant link
                      on social media.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSocialPreviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-amber-50 hover:text-amber-800 text-xs font-semibold text-gray-700 border border-gray-200 transition-all cursor-pointer shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>Preview Share Card</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Standalone Social & Quick Contact Links Card (Moved to Right Column) */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-teal-600 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-900">Social & Quick Contact Links</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(branding);
                    setIsEditingInfo(true);
                    const el = document.getElementById("restaurant-info-card");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 transition-all cursor-pointer border border-teal-200/60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Social Links
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900">Facebook Page</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {branding.facebookUrl || "Default fallback (auto-generated from slug)"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#E4405F]/10 text-[#E4405F] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900">Instagram Profile</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {branding.instagramUrl || "Default fallback (auto-generated from slug)"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.147 4.195 4.19-1.099z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900">WhatsApp Chat</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {branding.whatsappNumber || branding.phone || "Not configured"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900">Direct Call Number</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {branding.phone || "Not configured"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE SOCIAL SHARE CARD PREVIEW MODAL */}
      {isSocialPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-bold text-gray-900">Live Social Share Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSocialPreviewModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Here is how your restaurant link preview will look when shared on WhatsApp, Facebook,
              or Twitter:
            </p>

            {/* Simulated WhatsApp Share Card Mockup */}
            <div className="rounded-xl border border-gray-200 bg-[#F0F2F5] p-3 space-y-2">
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
                WhatsApp Link Share Mockup
              </span>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-xs">
                <div
                  className="w-full h-36 bg-cover bg-center"
                  style={{
                    backgroundImage: branding.socialPreview
                      ? `url(${branding.socialPreview})`
                      : branding.cover
                        ? `url(${branding.cover})`
                        : "linear-gradient(135deg, #1c2b4a, #f59e0b)",
                  }}
                />
                <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-1">
                  <h4 className="text-xs font-bold text-gray-900 line-clamp-1">
                    {branding.name || "Burger Craft Lab"} — Digital Menu
                  </h4>
                  <p className="text-[11px] text-gray-500 line-clamp-2">
                    {branding.description || "Order delicious food online from our digital menu."}
                  </p>
                  <span className="text-[10px] font-semibold text-gray-400 block pt-0.5">
                    menuverse.com/{branding.slug || "burgercraftlab"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSocialPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
