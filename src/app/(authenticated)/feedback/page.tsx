"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { Star, MapPin, MessageSquare } from "lucide-react";
import { GoogleAvatar } from "@/components/menuverse/google-avatar";
import { GoogleReview, getGoogleRatingSummary } from "@/lib/google-reviews";
import { getRestaurantProfile } from "@/lib/db-queries.server";

export default function FeedbackPage() {
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const profile = (await getRestaurantProfile({})) as Record<string, unknown>;
        if (
          profile?.googleMapsReviews &&
          Array.isArray(profile.googleMapsReviews) &&
          profile.googleMapsReviews.length > 0
        ) {
          setReviews(profile.googleMapsReviews as GoogleReview[]);
        }
        if (profile?.googleMapsUrl && typeof profile.googleMapsUrl === "string") {
          setGoogleMapsUrl(profile.googleMapsUrl);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadReviews();
  }, []);

  const summary = getGoogleRatingSummary(reviews);

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Feedback & Reviews</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Live verified reviews synced directly from Google Maps
          </p>
        </div>
        {googleMapsUrl ? (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70 rounded-full text-xs font-bold transition-all shadow-sm"
          >
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>View on Google Maps</span>
          </a>
        ) : (
          <Link
            href="/restaurant-profile"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <MapPin className="w-4 h-4" />
            <span>Connect Google Maps</span>
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Overall Rating
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 font-black text-3xl text-gray-900">
            {summary.average} <Star className="h-6 w-6 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-1 text-[11px] text-gray-400 font-semibold">
            {summary.total} Google Ratings
          </div>
        </div>
        {summary.breakdown.slice(0, 3).map((x) => (
          <div key={x.stars} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-bold">{x.stars}-Star Rating Share</div>
            <div className="mt-2 font-black text-2xl text-gray-900">{x.pct}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100 font-semibold text-gray-400">
          Loading customer feedback...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No Reviews Synced Yet</h3>
          <p className="text-xs text-gray-500 max-w-md leading-relaxed font-medium">
            Connect your Google Maps Place URL in Restaurant Profile settings to automatically parse
            and showcase live customer reviews.
          </p>
          <Link
            href="/restaurant-profile"
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all"
          >
            Go to Profile Settings
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <GoogleAvatar
                    author={r.author}
                    src={r.avatar}
                    sizeClassName="w-10 h-10 text-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{r.author}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Google Map
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-medium">{r.date}</div>
                  </div>
                </div>
                <div className="flex text-amber-500 shrink-0">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className={`h-4 w-4 ${j < r.stars ? "fill-amber-500" : "text-gray-200 fill-none"}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600 font-semibold leading-relaxed">"{r.text}"</p>
              {r.ownerReply && (
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/60 flex flex-col gap-1">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Response from the owner
                  </div>
                  <p className="text-xs text-gray-600 font-medium pl-3.5 border-l-2 border-amber-400">
                    "{r.ownerReply}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
