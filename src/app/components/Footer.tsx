import React from "react";

interface FooterProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function Footer({ className, style }: FooterProps) {
  const defaultClass =
    "w-full bg-deep-emerald-950 text-white px-6 py-10 md:px-12 md:py-12 flex flex-col gap-6 md:gap-10 border-t border-deep-emerald-900 mt-20";
  const finalClass = className || defaultClass;

  return (
    <footer className={finalClass} style={style}>
      {/* Footer Upper Group */}
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between gap-8">
        {/* Left/Middle Content Links Grid */}
        <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-20 w-full md:w-auto text-left">
          {/* About Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[15px] font-black text-white tracking-tight font-sans">About</h4>
            <div className="flex flex-col gap-3.5 text-[13px] font-semibold text-neutral-400 max-w-[220px] sm:max-w-[280px]">
              <a href="#" className="hover:text-white transition-colors duration-200">
                Blog
              </a>
              <a href="#" className="hover:text-white transition-colors duration-200">
                Meet The Team
              </a>
              {/* Desktop Address - Hidden on mobile, docked on desktop */}
              <p className="hidden sm:block text-neutral-500 font-medium leading-relaxed mt-1.5 border-t border-deep-emerald-900 pt-2.5 max-w-[240px] sm:max-w-none">
                House No. 14, Road No. A, Block A, Sontek,
                <br />
                South Kajla, Jatrabari, Dhaka - 1236
              </p>
            </div>
          </div>

          {/* Support Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[15px] font-black text-white tracking-tight font-sans">Support</h4>
            <div className="flex flex-col gap-3.5 text-[13px] font-semibold text-neutral-400">
              <a href="#" className="hover:text-white transition-colors duration-200">
                Contact Us
              </a>
              <a href="#" className="hover:text-white transition-colors duration-200">
                Shipping & Return
              </a>
              <a
                href="tel:+8801919-760626"
                className="hidden sm:flex text-neutral-450 hover:text-white transition-colors duration-200 font-medium mt-1.5 text-[12px] border-t border-deep-emerald-900 pt-2.5 items-center gap-1.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 shrink-0 text-neutral-500"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 .7 2.81A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>+8801919-760626</span>
              </a>
            </div>
          </div>

          {/* Mobile Address & Contact - Spans full width (col-span-2) at the bottom, visible on mobile only */}
          <div className="col-span-2 sm:hidden border-t border-deep-emerald-900 pt-3.5 -mt-2 flex flex-col gap-2.5">
            {/* Header Row */}
            <div className="flex justify-between items-center w-full">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider font-sans flex items-center gap-1">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 shrink-0 text-neutral-500"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Address</span>
              </span>
              <a
                href="tel:+8801919-760626"
                className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider hover:text-white transition-colors duration-200 font-sans flex items-center gap-1.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 shrink-0 text-neutral-500"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 .7 2.81A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>+8801919-760626</span>
              </a>
            </div>
            {/* Address Content - Spans full width for exactly 2 lines */}
            <p className="text-neutral-500 font-medium leading-relaxed text-[12px] w-full">
              House No. 14, Road No. A, Block A, Sontek,
              <br />
              South Kajla, Jatrabari, Dhaka - 1236
            </p>
          </div>
        </div>

        {/* Right/Social Column */}
        <div className="flex flex-col gap-4 items-center md:items-end">
          <span className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider font-sans">
            Social Media
          </span>
          <div className="flex items-center gap-3">
            {/* X Icon */}
            <a
              href="#"
              className="social-btn rounded-full bg-deep-emerald-900 border border-deep-emerald-800 text-white flex items-center justify-center hover:bg-deep-emerald-800 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="social-icon"
              >
                <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
                <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
              </svg>
            </a>

            {/* Facebook Icon */}
            <a
              href="#"
              className="social-btn rounded-full bg-deep-emerald-900 border border-deep-emerald-800 text-white flex items-center justify-center hover:bg-deep-emerald-800 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="social-icon"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>

            {/* LinkedIn Icon */}
            <a
              href="#"
              className="social-btn rounded-full bg-deep-emerald-900 border border-deep-emerald-800 text-white flex items-center justify-center hover:bg-deep-emerald-800 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
              </svg>
            </a>

            {/* Instagram Icon */}
            <a
              href="#"
              className="social-btn rounded-full bg-deep-emerald-900 border border-deep-emerald-800 text-white flex items-center justify-center hover:bg-deep-emerald-800 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="social-icon"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Footer Lower Group */}
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center border-t border-deep-emerald-900 pt-6 mt-0 gap-4 text-[12px] font-semibold text-neutral-500">
        <span>Copyright © 2026 MenuVerse. All Rights Reserved.</span>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors duration-200">
            Terms of Service
          </a>
          <a href="#" className="hover:text-white transition-colors duration-200">
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
