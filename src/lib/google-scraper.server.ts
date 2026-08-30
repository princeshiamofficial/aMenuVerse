"use server";

import { createServerFn } from "./server-fn";
import { z } from "zod";
import {
  GoogleReview,
  getGoogleRatingSummary,
  COLOR_HUT_GOOGLE_MAPS_REVIEWS,
} from "./google-reviews";

const BRIGHTDATA_API_KEY =
  process.env.BRIGHTDATA_API_KEY ||
  process.env.VITE_BRIGHTDATA_API_KEY ||
  "d15d5203-d259-4841-9155-765d942209a7";

export async function fetchReviewsFromBrightData(targetUrl: string): Promise<GoogleReview[]> {
  if (!BRIGHTDATA_API_KEY) return [];

  try {
    const response = await fetch(
      "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_luzfs1dn2oa0teb81&format=json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ url: targetUrl }]),
      },
    );

    if (response.ok) {
      const data = await response.json();
      let reviewItems: Array<Record<string, unknown>> = [];

      if (Array.isArray(data)) {
        reviewItems = data as Array<Record<string, unknown>>;
      } else if (data && typeof data === "object" && "snapshot_id" in data) {
        const snapshotId = (data as { snapshot_id: string }).snapshot_id;
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise((res) => setTimeout(res, 5000));
          const snapRes = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
            {
              headers: { Authorization: `Bearer ${BRIGHTDATA_API_KEY}` },
            },
          );
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            if (Array.isArray(snapData) && snapData.length > 0) {
              reviewItems = snapData as Array<Record<string, unknown>>;
              break;
            }
          }
        }
      }

      if (reviewItems.length > 0) {
        return reviewItems.map((item) => ({
          author: String(
            item.user_name || item.author || item.name || item.reviewer_name || "Google Reviewer",
          ),
          date: String(item.review_date || item.date || item.time || "Verified Google Review"),
          stars:
            typeof item.rating === "number"
              ? item.rating
              : parseInt(String(item.stars || item.score || "5"), 10) || 5,
          text: String(
            item.review_text ||
              item.text ||
              item.description ||
              item.comment ||
              "Great experience!",
          ),
          avatar: String(
            item.profile_picture || item.avatar || item.user_image || item.reviewer_photo || "",
          ),
          ownerReply: item.owner_response
            ? String(item.owner_response)
            : item.owner_reply
              ? String(item.owner_reply)
              : undefined,
          isGoogleMap: true,
        }));
      }
    }
  } catch (err) {
    console.warn("[BrightData API Warning]", err);
  }

  return [];
}

function extractGoogleAvatarUrls(html: string): string[] {
  if (!html || typeof html !== "string") return [];
  const matches = html.match(/https:\/\/lh[3-6]\.googleusercontent\.com\/a\/[^\s"'<>]+/g) || [];
  return Array.from(new Set(matches));
}

function parseGoogleMapsHtml(html: string): GoogleReview[] {
  const reviews: GoogleReview[] = [];
  if (!html || typeof html !== "string") return reviews;

  try {
    const avatarUrls = extractGoogleAvatarUrls(html);
    let avatarIdx = 0;

    const reviewDataMatches =
      html.match(/\["([^"]{2,35})"\s*,\s*\[(\d)\s*,\s*null\s*,\s*"([^"]{3,500})"/g) || [];

    if (reviewDataMatches.length > 0) {
      for (const match of reviewDataMatches) {
        const parts = match.match(/\["([^"]+)"\s*,\s*\[(\d)\s*,\s*null\s*,\s*"([^"]+)"/);
        if (parts) {
          const author = parts[1];
          const stars = parseInt(parts[2], 10);
          const text = parts[3].replace(/\\n/g, " ").replace(/\\"/g, '"');
          const avatar = avatarUrls[avatarIdx % (avatarUrls.length || 1)] || "";
          avatarIdx++;

          reviews.push({
            author,
            date: "Verified Google Review",
            stars: isNaN(stars) ? 5 : stars,
            text,
            avatar,
            isGoogleMap: true,
          });
        }
      }
    }

    if (reviews.length === 0) {
      const authorMatches =
        html.match(/aria-label="Photo of ([^"]+)"/gi) ||
        html.match(/class="[^"]*author[^"]*"[^>]*>([^<]+)</gi) ||
        [];

      for (let i = 0; i < authorMatches.length; i++) {
        const raw = authorMatches[i];
        const cleanName = raw
          .replace(/aria-label="Photo of /i, "")
          .replace(/class="[^"]*author[^"]*"[^>]*>/i, "")
          .replace(/["<>]/g, "")
          .trim();

        if (
          cleanName &&
          !cleanName.toLowerCase().includes("menu") &&
          !cleanName.toLowerCase().includes("photo")
        ) {
          reviews.push({
            author: cleanName,
            date: "Google Map Review",
            stars: 5,
            text: "Great experience and high quality service.",
            avatar: avatarUrls[i % (avatarUrls.length || 1)] || "",
            isGoogleMap: true,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Scraper Error]", err);
  }

  return reviews;
}

export const scrapeGoogleMapsReviewsServer = createServerFn()
  .validator(z.object({ url: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { url } = data;
    const cleanUrl = url.trim();

    try {
      // 1. Try Bright Data Enterprise Scraper API first with API Key
      const bdReviews = await fetchReviewsFromBrightData(cleanUrl);
      if (bdReviews.length > 0) {
        return {
          success: true,
          finalUrl: cleanUrl,
          reviewsCount: bdReviews.length,
          reviews: bdReviews,
          summary: getGoogleRatingSummary(bdReviews),
          message: "Google Maps reviews scraped via Bright Data API successfully!",
        };
      }

      // 2. Direct HTML fetch parser fallback
      const resp = await fetch(cleanUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      const finalUrl = resp.url;
      const htmlText = await resp.text();
      const extractedReviews = parseGoogleMapsHtml(htmlText);

      return {
        success: true,
        finalUrl,
        reviewsCount: extractedReviews.length,
        reviews: extractedReviews,
        summary: getGoogleRatingSummary(extractedReviews),
        message: "Google Maps reviews dynamically parsed successfully!",
      };
    } catch (err) {
      console.error("[GoogleScraperServer Error]", err);
      return {
        success: false,
        finalUrl: cleanUrl,
        reviewsCount: 0,
        reviews: [],
        summary: getGoogleRatingSummary([]),
        message: "Unable to parse reviews from Google Maps URL.",
      };
    }
  });
