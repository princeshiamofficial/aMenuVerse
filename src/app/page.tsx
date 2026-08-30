"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSubdomain } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Hero10 from "@/components/lightswind/hero10";
import {
  QrCode,
  BarChart3,
  Building2,
  Sparkles,
  Utensils,
  MessageSquareHeart,
  Palette,
  ArrowRight,
  Check,
  Leaf,
  Star,
  Quote,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Instagram,
  Linkedin,
  Facebook,
  Github,
} from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "QR Digital Menus",
    desc: "Contactless menus that guests scan and order from in seconds.",
  },
  {
    icon: Utensils,
    title: "Menu Management",
    desc: "Categories, items, modifiers and pricing — synced across every branch.",
  },
  {
    icon: Building2,
    title: "Multi-Branch Control",
    desc: "Run one location or fifty. Compare performance side by side.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    desc: "AI-surfaced insights on what sells, when, and to whom.",
  },
  {
    icon: MessageSquareHeart,
    title: "Customer Feedback",
    desc: "Capture reviews at the table and act before they hit the internet.",
  },
  {
    icon: Palette,
    title: "Color Hut Integration",
    desc: "Match your brand palette across every menu, screen and receipt.",
  },
];

const audience = [
  { name: "Restaurants", desc: "Fine dining to fast casual." },
  { name: "Cafes", desc: "From espresso bars to bakeries." },
  { name: "Cloud Kitchens", desc: "Delivery-first, multi-brand ready." },
  { name: "Hotels & Resorts", desc: "In-room dining, pool, spa menus." },
  { name: "Food Courts", desc: "Multi-vendor ordering under one roof." },
  { name: "Bars & Lounges", desc: "Fast reorders, upsells, tabs." },
];

const steps = [
  {
    n: "01",
    title: "Create your menu",
    desc: "Import from PDF or start from a premium template. Drag, drop, done.",
  },
  {
    n: "02",
    title: "Print your QR",
    desc: "Generate table QR codes with your brand colors, ready to print.",
  },
  {
    n: "03",
    title: "Delight & learn",
    desc: "Guests scan, order, and rate. You get real-time insights on autopilot.",
  },
];

const testimonials = [
  {
    quote:
      "We replaced three tools with MenuVerse in a weekend. Our servers move faster and the guests notice.",
    who: "Nadia R.",
    role: "Owner, Olive & Ember",
  },
  {
    quote: "Multi-branch analytics finally in one place. I know by 11am which location needs help.",
    who: "Ahmed K.",
    role: "Ops Director, Saffron Group",
  },
  {
    quote:
      "The QR menu is beautiful and matches our brand exactly. Guests keep asking who built it.",
    who: "Priya S.",
    role: "GM, The Green Table",
  },
];

import { PublicRestaurantView } from "@/app/[restaurantUsername]/page";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { decodeTableToken } from "@/lib/utils";
import type { Restaurant } from "@/lib/restaurants-data";

function SubdomainMenuRenderer({ subdomain }: { subdomain: string }) {
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() =>
    fetchPublicMenuSync(subdomain),
  );

  useEffect(() => {
    async function loadAsync() {
      try {
        const fresh = await fetchPublicMenu(subdomain);
        if (fresh) setRestaurantData(fresh);
      } catch {
        /* ignore */
      }
    }
    loadAsync();
  }, [subdomain]);

  useEffect(() => {
    if (typeof document !== "undefined" && restaurantData?.name) {
      document.title = `${restaurantData.name} — Digital Menu`;
    }
  }, [restaurantData]);

  // Decode table parameter or path token if present
  let tableNo = "";
  let branchSlug = "";
  if (typeof window !== "undefined") {
    const search = new URLSearchParams(window.location.search);
    const tableParam =
      search.get("table") ||
      search.get("tableNo") ||
      search.get("tableno") ||
      search.get("tn") ||
      search.get("t_no");
    const tokenParam = search.get("t") || search.get("token");
    const pathParts = window.location.pathname.split("/").filter(Boolean);

    if (pathParts[0] === "e" && pathParts[1]) {
      const decoded = decodeTableToken(pathParts[1]);
      if (decoded) {
        tableNo = decoded.tableNo;
        branchSlug = decoded.branchSlug || "";
      }
    } else if (tokenParam) {
      const decoded = decodeTableToken(tokenParam);
      if (decoded) {
        tableNo = decoded.tableNo;
        branchSlug = decoded.branchSlug || "";
      }
    } else if (tableParam) {
      tableNo = tableParam;
      if (pathParts[0]) branchSlug = pathParts[0];
    }
  }

  if (!restaurantData) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Restaurant not found</h1>
        <p className="mt-2 text-muted-foreground">
          No active restaurant matches this subdomain or username.
        </p>
        <Link href="/" className="mt-4 inline-block underline">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <PublicRestaurantView
      initialRestaurant={restaurantData}
      restaurantUsername={subdomain}
      tableNumber={tableNo}
      branchId={branchSlug}
    />
  );
}

function isSubdomainHost(): boolean {
  if (typeof window === "undefined") return false;
  return getSubdomain(window.location.hostname) !== null;
}

export default function LandingPage() {
  const [isClient, setIsClient] = useState(false);
  const subdomain = getSubdomain();
  const onSubdomain = isSubdomainHost();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Lock this page to light mode regardless of the saved theme preference.
  // On unmount, restore whatever theme was stored so the rest of the app is unaffected.
  useEffect(() => {
    if (subdomain || onSubdomain || !isClient) return;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (wasDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      }
    };
  }, [subdomain, onSubdomain, isClient]);

  if (subdomain) {
    return <SubdomainMenuRenderer subdomain={subdomain} />;
  }

  if (onSubdomain || !isClient) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <main>
        {/* HERO — full-width band */}
        <Hero10 />

        {/* HOW IT WORKS — pixel-perfect reference */}
        <section id="how" className="bg-[#f3f4f6] border-b border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-20">
            {/* Header */}
            <div className="grid gap-8 md:grid-cols-2 md:items-end">
              <div>
                <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#ea6a3a]">
                  How it works
                </span>
                <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0b0d10] md:text-[52px]">
                  Live in 5 minutes.
                  <br />
                  No developers required.
                </h2>
              </div>
              <p className="text-[15px] leading-relaxed text-slate-500 md:text-right md:max-w-md md:ml-auto">
                A simple three-step flow gets your restaurant online with a menu, QR codes, and
                analytics — all on day one.
              </p>
            </div>

            {/* Steps */}
            <ol className="mt-10 grid gap-6 md:grid-cols-3 relative">
              {steps.map((s, i) => (
                <li
                  key={s.n}
                  className="relative rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-3xl font-extrabold tracking-tight text-[#ea6a3a]"
                      style={{
                        WebkitTextStroke: "1.5px #ea6a3a",
                        color: "transparent",
                      }}
                    >
                      {s.n}
                    </span>
                    <span className="h-px flex-1 bg-[#ea6a3a]/60" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold tracking-tight text-[#0b0d10]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{s.desc}</p>
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute -right-4.5 top-1/2 hidden -translate-y-1/2 items-center justify-center text-[#ea6a3a] md:flex"
                    >
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  )}
                </li>
              ))}
            </ol>

            {/* Feature card */}
            <div className="mt-8 grid gap-0 overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-15px_rgba(15,23,42,0.12)] md:grid-cols-2">
              <div className="relative min-h-80 md:min-h-95">
                <img
                  src="https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80"
                  alt="Guest scanning QR menu at restaurant table"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col justify-center px-8 py-10 md:px-12">
                <span className="inline-flex w-fit items-center rounded-full bg-[#fde8dc] px-3 py-1 text-[12px] font-semibold text-[#ea6a3a]">
                  Contactless
                </span>
                <h3 className="mt-5 text-3xl font-extrabold tracking-tight text-[#0b0d10] md:text-[34px]">
                  Scan. Explore. Enjoy.
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
                  Guests point their camera and land on your beautiful menu — instantly. No apps, no
                  logins, no waiting.
                </p>
                <ul className="mt-6 space-y-3 text-[14px] text-[#0b0d10]">
                  {[
                    "Loads in under 1 second on 4G",
                    "Works offline after first scan",
                    "Multilingual out of the box",
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#ea6a3a] text-[#ea6a3a]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES — full-width band, dark sage */}
        <section
          id="features"
          className="relative border-b border-border/60 text-primary-foreground"
          style={{ background: "var(--gradient-sage)" }}
        >
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                  Platform
                </span>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                  Everything a modern kitchen needs.
                </h2>
                <p className="mt-3 text-primary-foreground/80">
                  One dashboard for menus, teams, insights and guests. No plugin marketplace, no
                  duct tape.
                </p>
              </div>
              <Link href="/auth">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  Try the platform <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group relative bg-[color-mix(in_oklab,var(--secondary)_88%,black_12%)] p-8 transition hover:bg-[color-mix(in_oklab,var(--secondary)_80%,black_20%)]"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/90 text-primary shadow-elegant">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/80">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AUDIENCE — full-width band */}
        <section id="audience" className="border-b border-border/60 bg-accent/40">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/80">
                Who it's for
              </span>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Built for every kind of kitchen.
              </h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {audience.map((a) => (
                <div
                  key={a.name}
                  className="rounded-2xl border border-border/70 bg-card p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/25 text-secondary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                    <div className="font-semibold tracking-tight">{a.name}</div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS — full-width band */}
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/80">
                  Loved by operators
                </span>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                  Words from the pass.
                </h2>
              </div>
              <div className="flex items-center gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-2 text-sm text-muted-foreground">4.9 average rating</span>
              </div>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure
                  key={t.who}
                  className="rounded-3xl border border-border/70 bg-card p-8 shadow-card"
                >
                  <Quote className="h-6 w-6 text-primary/70" />
                  <blockquote className="mt-4 text-base leading-relaxed">"{t.quote}"</blockquote>
                  <figcaption className="mt-6 border-t border-border/60 pt-4">
                    <div className="font-semibold tracking-tight">{t.who}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — full-width band */}
        <section
          id="pricing"
          className="relative overflow-hidden text-primary-foreground"
          style={{ background: "var(--gradient-earth)" }}
        >
          <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
            <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.18em]">
                  <Sparkles className="h-3.5 w-3.5" /> Free to start
                </div>
                <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                  Ready to serve smarter?
                </h2>
                <p className="mt-4 max-w-xl text-primary-foreground/85">
                  Create your workspace in under two minutes. Upgrade only when you grow. No credit
                  card required.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/auth">
                    <Button
                      size="lg"
                      className="bg-background text-foreground hover:bg-background/90"
                    >
                      Create your workspace <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#features">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    >
                      See features
                    </Button>
                  </a>
                </div>
              </div>
              <ul className="grid gap-3 text-sm">
                {[
                  "Unlimited QR menus",
                  "Multi-branch dashboard",
                  "Live orders & analytics",
                  "Guest feedback capture",
                  "Brand-matched Color Hut theming",
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3"
                  >
                    <Check className="h-4 w-4" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#f5f5f7] text-[#1a1a1a]">
        {/* Animated wave top */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 right-0 overflow-hidden leading-none"
        >
          <svg
            className="animate-wave block h-40 w-[200%]"
            viewBox="0 0 2880 160"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,80 C240,160 480,0 720,80 C960,160 1200,0 1440,80 C1680,160 1920,0 2160,80 C2400,160 2640,0 2880,80 L2880,0 L0,0 Z"
              fill="rgba(15,23,42,0.06)"
            />
            <path
              d="M0,100 C240,20 480,180 720,100 C960,20 1200,180 1440,100 C1680,20 1920,180 2160,100 C2400,20 2640,180 2880,100 L2880,0 L0,0 Z"
              fill="rgba(15,23,42,0.1)"
            />
          </svg>
        </div>
        {/* Subtle vignette overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(1200px 300px at 50% 0%, rgba(255,255,255,0.06), transparent 60%), radial-gradient(800px 400px at 100% 100%, rgba(255,255,255,0.04), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-8">
          <div className="grid gap-12 md:grid-cols-4">
            {/* Stay Connected */}
            <div>
              <h4 className="text-xl font-semibold tracking-tight">Stay Connected</h4>
              <form className="mt-6" onSubmit={(e) => e.preventDefault()}>
                <label htmlFor="footer-email" className="block text-sm text-slate-600">
                  Email
                </label>
                <input
                  id="footer-email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="mt-2 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-900"
                />
                <button
                  type="submit"
                  className="mt-4 h-11 w-full rounded-full bg-[#1a1a1a] text-white text-sm font-medium transition hover:bg-[#1a1a1a]/90 active:scale-[0.99]"
                >
                  Subscribe
                </button>
              </form>
            </div>

            {/* Quick Links */}
            <div className="hidden md:block">
              <h4 className="text-xl font-semibold tracking-tight">Quick Links</h4>
              <ul className="mt-6 space-y-4 text-[15px] text-slate-600">
                <li>
                  <Link href="/" className="hover:text-slate-900 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <a href="#audience" className="hover:text-slate-900 transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-slate-900 transition-colors">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-slate-900 transition-colors">
                    Products
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-900 transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Us */}
            <div>
              <h4 className="text-xl font-semibold tracking-tight">Contact Us</h4>
              <ul className="mt-6 space-y-4 text-[15px] text-slate-600">
                <li>House No. 14, Road No. A, Block A</li>
                <li>South Kajla, Jatrabari, Dhaka – 1236</li>
                <li>Phone: +8801919-760626</li>
                <li>
                  Email:{" "}
                  <a
                    href="mailto:hello@menuverse.app"
                    className="hover:text-slate-900 transition-colors"
                  >
                    hello@menuverse.app
                  </a>
                </li>
              </ul>
            </div>

            {/* Follow Us */}
            <div>
              <h4 className="text-xl font-semibold tracking-tight">Follow Us</h4>
              <div className="mt-6 flex items-center gap-3">
                {[
                  { Icon: Facebook, label: "Facebook" },
                  { Icon: Twitter, label: "Twitter" },
                  { Icon: Instagram, label: "Instagram" },
                  { Icon: Linkedin, label: "LinkedIn" },
                ].map(({ Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:border-slate-900 hover:text-slate-900 hover:-translate-y-0.5"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Divider + bottom bar */}
          <div className="mt-16 border-t border-slate-200 pt-6">
            <p className="text-center text-sm text-slate-500">
              Copyright {new Date().getFullYear()} MenuVerse. All rights reserved.
            </p>
          </div>
        </div>
        <style>{`
          @keyframes wave { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .animate-wave { animation: wave 15s linear infinite; }
        `}</style>
      </footer>
    </div>
  );
}
