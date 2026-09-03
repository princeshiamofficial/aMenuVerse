import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "https://hazards-raw-cycle-menus.trycloudflare.com";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: "MenuVerse - Multi-Tenant Restaurant OS & POS",
  description:
    "MenuVerse is the all-in-one AI platform for digital QR menus, multi-branch operations, real-time KDS, waiter calling, and POS billing.",
  openGraph: {
    title: "MenuVerse - Multi-Tenant Restaurant OS & POS",
    description:
      "MenuVerse is the all-in-one AI platform for digital QR menus, multi-branch operations, real-time KDS, waiter calling, and POS billing.",
    siteName: "MenuVerse",
    type: "website",
    images: [
      {
        url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&auto=format&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "MenuVerse Restaurant Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MenuVerse - Multi-Tenant Restaurant OS & POS",
    description:
      "MenuVerse is the all-in-one AI platform for digital QR menus, multi-branch operations, real-time KDS, waiter calling, and POS billing.",
    images: ["https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&auto=format&fit=crop&q=80"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://i.ibb.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ibb.co" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
