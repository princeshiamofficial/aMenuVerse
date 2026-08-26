import { useState, useEffect, type ComponentPropsWithoutRef, type SyntheticEvent } from "react";
import { sanitizeImageUrl, DEFAULT_FOOD_FALLBACK_IMAGE } from "@/lib/imgbb";

export type BlobImgProps = ComponentPropsWithoutRef<"img"> & {
  src?: string | null;
  fallbackSrc?: string;
};

/**
 * Resilient, self-healing image component that prevents broken image icons across
 * localhost, LAN, cPanel, CyberPanel, VPS, and mobile browsers.
 * - Sanitizes URLs and strips broken temporary blob: URLs
 * - Automatic onError fallback switching
 * - Safe crossOrigin & referrerPolicy headers to bypass CDN referrer blocks
 */
export function BlobImg({
  src,
  alt = "",
  fallbackSrc = DEFAULT_FOOD_FALLBACK_IMAGE,
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
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
      {...props}
    />
  );
}
