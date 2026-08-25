"use client";

import React, { useEffect, useRef, useState } from "react";

interface BeautifulQRCodeProps {
  value: string;
  tableName?: string;
  logoUrl?: string;
  size?: number;
}

export default function BeautifulQRCode({
  value,
  tableName,
  logoUrl,
  size = 150,
}: BeautifulQRCodeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [QRCodeStyling, setQRCodeStyling] = useState<any>(null);

  useEffect(() => {
    import("qr-code-styling").then((mod) => {
      setQRCodeStyling(() => mod);
    });
  }, []);

  useEffect(() => {
    if (!QRCodeStyling || !ref.current) return;

    const Creator = QRCodeStyling.default || QRCodeStyling;
    const qrCode = new Creator({
      width: size,
      height: size,
      margin: Math.round(size * 0.065),
      type: "svg",
      data: value,
      // No image — avoids version bump from embedded center image
      dotsOptions: {
        color: "#000000",
        type: "dots",
      },
      qrOptions: {
        typeNumber: 0, // Auto — library selects minimum safe version
        mode: "Byte",
        errorCorrectionLevel: "M",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        color: "#000000",
        type: "extra-rounded",
      },
      cornersDotOptions: {
        color: "#000000",
        type: "dot",
      },
      extensions: [
        (svg: any) => {
          const clipPaths = svg.querySelectorAll("clipPath");
          clipPaths.forEach((clipPath: any) => {
            if (clipPath.id && clipPath.id.includes("clip-path-dot-color")) {
              const circles = clipPath.querySelectorAll("circle");
              circles.forEach((circle: any) => {
                const r = parseFloat(circle.getAttribute("r") || "0");
                if (r > 0) {
                  circle.setAttribute("r", String(r * 0.5));
                }
              });
            }
          });
        },
      ],
    });

    ref.current.innerHTML = "";
    qrCode.append(ref.current);
  }, [QRCodeStyling, value, tableName, logoUrl, size]);

  const centerLabel = tableName ? tableName.replace("Table ", "") : null;
  const badgeSize = Math.round(size * 0.22);
  const fontSize = badgeSize > 30 ? Math.round(badgeSize * 0.55) : Math.round(badgeSize * 0.6);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div ref={ref} className="flex items-center justify-center select-none" />
      {centerLabel && (
        <div
          style={{
            position: "absolute",
            width: badgeSize,
            height: badgeSize,
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: fontSize,
            color: "#000000",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {centerLabel}
        </div>
      )}
    </div>
  );
}
