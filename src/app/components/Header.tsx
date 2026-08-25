"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import Link from "next/link";

export default function Header() {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isHomeActive = pathname === "/";
  const isRestaurantActive = pathname === "/restaurants";

  return (
    <header className="w-full px-0 md:px-6 bg-transparent sticky top-0 z-50">
      {/* Flawless Floating DeepEmerald Card Container sitting flush at the top */}
      <div className="mx-auto max-w-7xl bg-deep-emerald-950 rounded-none md:rounded-b-[28px] border-b border-deep-emerald-900 md:border md:border-t-0 shadow-sm md:shadow-[0_8px_30px_rgba(0,0,0,0.03)] px-6 py-4 md:px-8 md:py-4.5 flex items-center justify-between transition-all duration-300">
        {/* Brand Logo and Text */}
        <a href="#" className="flex items-center gap-3 group">
          {/* Custom precision organic loop logo from the mockup */}
          <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[25px] h-[25px] text-white"
            >
              <path d="M4 18c0-3 3-5 6-5s4.5-1 5.5-3S15.5 4 13.5 4s-4 2-4 5c0 4 3 6 6 8s3.5 3 4.5 3" />
            </svg>
          </div>
          <span className="text-[19px] font-bold tracking-[-0.02em] text-white font-sans">
            MenuVerse
          </span>
        </a>

        {/* Center Navigation Links (Identical to image: no dot active indicator, pure bold white text) */}
        <nav className="hidden md:flex items-center gap-10">
          <Link
            href="/"
            className={`text-[14px] transition-colors ${
              isHomeActive
                ? "font-bold text-white"
                : "font-medium text-neutral-400 hover:text-white duration-200"
            }`}
          >
            Home
          </Link>
          <Link
            href="/restaurants"
            className={`text-[14px] transition-colors ${
              isRestaurantActive
                ? "font-bold text-white"
                : "font-medium text-neutral-400 hover:text-white duration-200"
            }`}
          >
            Restaurant
          </Link>
          <a
            href="#"
            className="text-[14px] font-medium text-neutral-400 hover:text-white transition-colors duration-200"
          >
            Contact
          </a>
        </nav>

        {/* Right Action Circle Buttons */}
        <div className="flex items-center gap-3">
          {/* Search Circle Button */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="relative flex items-center justify-center w-11 h-11 rounded-full bg-deep-emerald-900 border border-deep-emerald-850 hover:bg-deep-emerald-800 hover:scale-[1.03] transition-all duration-200 group focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
            aria-label="Search"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[17px] h-[17px] text-white group-hover:scale-[1.03] transition-transform"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Login Link */}
          <Link
            href="/login"
            className="hidden md:flex items-center justify-center gap-2 py-2 px-5 rounded-full bg-white hover:bg-neutral-100 text-deep-emerald-950 font-bold text-[14px] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            aria-label="Login"
          >
            <LogIn className="w-[15px] h-[15px]" />
            <span>Login</span>
          </Link>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex md:hidden items-center justify-center w-11 h-11 rounded-full bg-deep-emerald-900 border border-deep-emerald-850 hover:bg-deep-emerald-800 hover:scale-[1.03] transition-all duration-200 focus:outline-none"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-white"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-white"
              >
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-all duration-300 flex flex-col justify-start pt-24 px-4">
          <div className="w-full max-w-md mx-auto bg-deep-emerald-950 rounded-[24px] border border-deep-emerald-900 shadow-2xl p-6 flex flex-col gap-5 animate-in slide-in-from-top-12 duration-300">
            <div className="flex items-center justify-between border-b border-deep-emerald-900 pb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Navigation
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-xs font-bold text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-[15px] transition-colors py-1 ${
                  isHomeActive
                    ? "font-bold text-white"
                    : "font-medium text-neutral-400 hover:text-white"
                }`}
              >
                Home
              </Link>
              <Link
                href="/restaurants"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-[15px] transition-colors py-1 ${
                  isRestaurantActive
                    ? "font-bold text-white"
                    : "font-medium text-neutral-400 hover:text-white"
                }`}
              >
                Restaurant
              </Link>
              <a
                href="#"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[15px] font-medium text-neutral-400 hover:text-white transition-colors py-1"
              >
                Contact
              </a>
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-5 rounded-full bg-white hover:bg-neutral-100 text-deep-emerald-950 font-bold text-[14px] active:scale-[0.98] transition-all duration-200 focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              >
                <LogIn className="w-[15px] h-[15px]" />
                <span>Login</span>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
