import { useState, useEffect, type ComponentPropsWithoutRef, type SyntheticEvent } from "react";
import { sanitizeImageUrl, DEFAULT_FOOD_FALLBACK_IMAGE } from "@/lib/imgbb";

export type BlobImgProps = ComponentPropsWithoutRef<"img"> & {
  src?: string | null;
  fallbackSrc?: string;
  priority?: boolean;
};

/**
 * Resilient, high-performance image component:
 * - Immediate priority / eager loading for above-the-fold elements (hero banner, avatar, top food items)
 * - fetchPriority="high" and decoding="sync" for priority images
 * - Automatic onError fallback switching
 * - Safe crossOrigin & referrerPolicy headers
 */
export function BlobImg({
  src,
  alt = "",
  fallbackSrc = DEFAULT_FOOD_FALLBACK_IMAGE,
  priority = false,
  onError,
  className,
  ...props
}: BlobImgProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(() => sanitizeImageUrl(src, fallbackSrc));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(sanitizeImageUrl(src, fallbackSrc));
    setHasError(false);
  }, [src, fallbackSrc]);

  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && currentSrc !== fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
    if (onError) {
      onError(e);
    }
  };

  if (!currentSrc) return null;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      referrerPolicy="no-referrer"
      onError={handleError}
      {...props}
    />
  );
}
