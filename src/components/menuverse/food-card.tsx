import { useState } from "react";
import { Heart, ShoppingBag, Plus, Minus } from "lucide-react";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { BlobImg } from "@/components/ui/blob-img";

export type FoodCardProps = {
  name: string;
  description?: string;
  price: number;
  discountPrice?: number | null;
  currency?: string;
  image?: string;
  rating?: number;
  tags?: string[];
  available?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onAdd?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
  className?: string;
  primaryColor?: string;
  qtyInCart?: number;
};

export function FoodCard({
  name,
  description,
  price,
  discountPrice,
  currency,
  image,
  rating,
  tags = [],
  available = true,
  favorite = false,
  onToggleFavorite,
  onAdd,
  onRemove,
  onClick,
  className,
  primaryColor = "#10b981",
  qtyInCart = 0,
}: FoodCardProps) {
  const activeSymbol = getCurrencySymbol(currency);
  const discountPct =
    discountPrice != null && discountPrice < price
      ? Math.round(((price - discountPrice) / price) * 100)
      : null;
  const [isFavorite, setIsFavorite] = useState(favorite);
  const isTrending = tags.includes("Trending") || tags.length > 0;

  // SVG Cutout paths: Standard (54px wide cutout) and Expanded (112px wide cutout)
  const standardPath =
    "M 16,0 H 224 A 16 16 0 0 1 240,16 V 226 A 20 20 0 0 1 220,246 H 210 A 24 24 0 0 0 186,270 V 278 A 22 22 0 0 1 164,300 H 16 A 16 16 0 0 1 0,284 V 16 A 16 16 0 0 1 16,0 Z";
  const expandedPath =
    "M 16,0 H 224 A 16 16 0 0 1 240,16 V 226 A 20 20 0 0 1 220,246 H 152 A 24 24 0 0 0 128,270 V 278 A 22 22 0 0 1 106,300 H 16 A 16 16 0 0 1 0,284 V 16 A 16 16 0 0 1 16,0 Z";
  const pathD = qtyInCart > 0 ? expandedPath : standardPath;

  return (
    <article
      onClick={onClick}
      className={cn(
        "group relative flex w-full sm:w-60 h-68 sm:h-75 flex-col justify-between bg-transparent p-0 filter drop-shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition duration-300 hover:drop-shadow-[0_12px_26px_rgba(15,23,42,0.1)]",
        onClick && "cursor-pointer",
        !available && "opacity-75",
        className,
      )}
    >
      {/* 100% True Transparent Dynamic SVG Background Path */}
      <svg
        viewBox="0 0 240 300"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full text-white fill-current pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={pathD} className="transition-all duration-300" />
      </svg>

      {/* Card Content Wrapper */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between">
        {/* Image Panel */}
        <div className="relative w-full h-36 sm:h-45 rounded-[14px] overflow-hidden bg-linear-to-b from-[#b8c2cc] via-[#7d8c9b] to-[#202938] flex items-center justify-center p-0">
          {image ? (
            <BlobImg
              src={image}
              alt={name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
              No image
            </div>
          )}

          {isTrending && (
            <div
              className="absolute top-2 right-2 text-white text-[8px] font-medium px-2 py-0.5 rounded-full shadow-sm z-10"
              style={{ backgroundColor: primaryColor }}
            >
              Trending
            </div>
          )}

          {!available && (
            <div className="absolute inset-x-2 bottom-2 z-10">
              <span className="w-full justify-center bg-slate-900/80 text-white text-[8px] font-bold py-0.5 rounded-md flex">
                Unavailable
              </span>
            </div>
          )}
        </div>

        {/* Body Area */}
        <div className="p-2.5 sm:p-3.5 flex flex-col overflow-hidden flex-1 justify-start text-left">
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight leading-snug truncate w-full">
            {name}
          </h3>

          {description && (
            <p className="mt-0.5 text-gray-500 leading-normal line-clamp-2 text-[9.5px] sm:text-[10.5px] pr-0">
              <span className="float-right w-0 h-4.25 pointer-events-none" />
              <span
                className={cn(
                  "float-right clear-right h-5 pointer-events-none transition-all duration-300",
                  qtyInCart > 0 ? "w-0 sm:w-24.5" : "w-0 sm:w-10.5",
                )}
              />
              {description}
            </p>
          )}

          <div
            className={cn(
              "mt-2 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5 transition-all duration-300 flex-wrap",
              qtyInCart > 0 ? "pr-16 sm:pr-25.5" : "pr-7 sm:pr-11",
            )}
          >
            {discountPrice != null && discountPrice < price ? (
              <>
                <span className="text-[10px] sm:text-xs font-semibold text-red-500 line-through decoration-red-500 font-mono">
                  {activeSymbol}
                  {price.toFixed(2)}
                </span>
                <span className="text-xs sm:text-[15px] font-bold text-gray-900 tracking-tight">
                  {activeSymbol}
                  {discountPrice.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-xs sm:text-[15px] font-bold text-gray-900 tracking-tight">
                {activeSymbol}
                {price.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Pocket Cutout & Action Button */}
        {onAdd && available && (
          <div
            className={cn(
              "absolute -bottom-px -right-px z-30 h-12 sm:h-13.5 flex items-center justify-end bg-transparent transition-all duration-300 transform translate-z-0",
              qtyInCart > 0 ? "w-21 sm:w-28" : "w-11 sm:w-13.5",
            )}
          >
            {qtyInCart > 0 && onRemove ? (
              /* Plus/Minus Horizontal Quantity Control Grid (same as standard grid layout) */
              <div className="relative w-18.5 sm:w-27.5 h-9.5 sm:h-11 bg-white rounded-[14px] sm:rounded-2xl flex items-center justify-between px-1.5 sm:px-2 mr-0.5 sm:mr-1 z-20 shadow-[0_2px_6px_rgba(0,0,0,0.05)] border border-neutral-100/30 btn-bubble">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(e);
                  }}
                  aria-label="Decrease quantity"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                  style={{
                    backgroundColor: `${primaryColor}22`,
                    color: primaryColor,
                  }}
                >
                  <Minus className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={3} />
                </button>
                <span
                  className="text-base sm:text-lg font-black min-w-5 sm:min-w-6 text-center leading-none px-0.5"
                  style={{ color: primaryColor }}
                >
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(e);
                  }}
                  aria-label="Increase quantity"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white cursor-pointer transition-transform active:scale-95 shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4 relative z-10" strokeWidth={3} />
                </button>
              </div>
            ) : (
              /* Standard Cart Plus Button */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(e);
                }}
                aria-label="Add to cart"
                className="relative w-8 sm:w-11.5 h-10.5 sm:h-11.5 bg-white rounded-[14px] sm:rounded-2xl flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-90 z-20 cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.05)] border border-neutral-100/30 btn-bubble mr-0.5 sm:mr-1 hover:bg-gray-50"
                style={{ color: primaryColor }}
              >
                <Plus
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  strokeWidth={3}
                  style={{ color: primaryColor }}
                />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
