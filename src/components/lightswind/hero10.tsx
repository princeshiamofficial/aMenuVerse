import { motion } from "framer-motion";
import Link from "next/link";
import { Asterisk } from "lucide-react";

const GoogleIcon = () => (
  <svg
    className="w-5 h-5 text-zinc-800 dark:text-zinc-200"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="currentColor"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="currentColor"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
      fill="currentColor"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="currentColor"
    />
  </svg>
);

const SlackIcon = () => (
  <svg
    className="w-5 h-5 text-zinc-800 dark:text-zinc-200"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zM6.302 15.165a2.528 2.528 0 0 1 2.52-2.52h5.044a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.822a2.528 2.528 0 0 1-2.52-2.52v-5.043z"
      fill="currentColor"
    />
    <path
      d="M8.822 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.822 0a2.528 2.528 0 0 1 2.52 2.522v2.52h-2.52zM8.822 6.302a2.528 2.528 0 0 1 2.52 2.52v5.044a2.528 2.528 0 0 1-2.52 2.522H3.778a2.528 2.528 0 0 1-2.522-2.522V8.822a2.528 2.528 0 0 1 2.522-2.52h5.044z"
      fill="currentColor"
    />
    <path
      d="M18.958 8.822a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zM17.698 8.822a2.528 2.528 0 0 1-2.52 2.52h-5.044a2.528 2.528 0 0 1-2.522-2.52V3.778a2.528 2.528 0 0 1 2.522-2.522h5.044a2.528 2.528 0 0 1 2.52 2.522v5.044z"
      fill="currentColor"
    />
    <path
      d="M15.178 18.958a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zM15.178 17.698a2.528 2.528 0 0 1-2.522-2.52v-5.044a2.528 2.528 0 0 1 2.522-2.52h5.044a2.528 2.528 0 0 1 2.52 2.52v5.044a2.528 2.528 0 0 1-2.52 2.52h-5.044z"
      fill="currentColor"
    />
  </svg>
);

const FigmaIcon = () => (
  <svg
    className="w-5 h-5 text-zinc-800 dark:text-zinc-200"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C9.24 2 7 4.24 7 7c0 1.83 1 3.44 2.5 4.28C8 12.12 7 13.72 7 15.5c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.78-1-3.38-2.5-4.22C16 10.44 17 8.83 17 7c0-2.76-2.24-5-5-5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <circle cx="12" cy="15.5" r="2" fill="currentColor" />
  </svg>
);

const GithubIcon = () => (
  <svg
    className="w-5 h-5 text-zinc-800 dark:text-zinc-200"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const DiscordIcon = () => (
  <svg
    className="w-5 h-5 text-zinc-800 dark:text-zinc-200"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
  </svg>
);

export default function Hero10() {
  const marqueeLogos = [
    { name: "Google", icon: <GoogleIcon /> },
    { name: "Slack", icon: <SlackIcon /> },
    { name: "Figma", icon: <FigmaIcon /> },
    { name: "Github", icon: <GithubIcon /> },
    { name: "Discord", icon: <DiscordIcon /> },
  ];

  return (
    <section className="relative w-full min-h-[640px] md:min-h-[760px] flex flex-col justify-between overflow-hidden bg-background text-foreground transition-colors duration-300 border-b border-border/60">
      <style>{`
        @keyframes marquee-hero10 {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-hero10 {
          display: flex;
          gap: 4rem;
          animation: marquee-hero10 24s linear infinite;
          width: max-content;
        }
        .animate-marquee-hero10:hover { animation-play-state: paused; }
      `}</style>

      {/* Decorative Navbar */}
      <header className="relative w-full max-w-6xl mx-auto px-6 py-5 grid grid-cols-[auto_1fr_auto] items-center gap-4 z-20">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white transition-transform group-hover:rotate-12 duration-300">
            <Asterisk className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-semibold text-lg tracking-tight text-zinc-900">MenuVerse</span>
        </Link>

        <nav className="hidden md:flex items-center justify-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Features
          </a>
          <a
            href="#how"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            How it works
          </a>
          <a
            href="#audience"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Who it's for
          </a>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Pricing
          </Link>
        </nav>
        <div className="md:hidden" />

        <Link
          href="/auth"
          className="justify-self-end px-5 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm"
        >
          Start free
        </Link>
      </header>

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-6 pt-12 md:pt-16 pb-24 z-10">
        {/* Announcement Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/60 shadow-sm mb-8"
        >
          <span className="text-[11px] md:text-xs font-medium text-zinc-700">
            An honest, all-in-one platform for hospitality
          </span>
          <span className="text-xs">🚀</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-serif tracking-tight max-w-3xl leading-[1.1] mb-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          <span className="block text-zinc-800 font-normal">Warm hospitality,</span>
          <span className="block italic text-zinc-950 font-medium mt-1">running on rails.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-sm sm:text-base text-zinc-500 max-w-xl leading-relaxed mb-10"
        >
          MenuVerse is the modern operating system for restaurants, cafes, cloud kitchens and hotels
          — QR menus, multi-branch control, live analytics and guest feedback in one workspace.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center gap-4 mb-16 z-10"
        >
          <Link
            href="/auth"
            className="px-6 py-3.5 rounded-full bg-zinc-900 text-white font-medium text-sm hover:bg-zinc-800 transition-colors shadow-lg active:scale-[0.98]"
          >
            Get started free
          </Link>
          <a
            href="#features"
            className="w-12 h-12 rounded-full bg-white border border-zinc-200/80 shadow-md hover:shadow-lg flex items-center justify-center transition-all active:scale-[0.95]"
            aria-label="Explore features"
          >
            <svg className="w-4 h-4 text-zinc-800 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </a>
        </motion.div>

        {/* Glassmorphic Brand Partner Marquee */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="w-full max-w-3xl mx-auto px-4 z-10"
        >
          <div className="w-full overflow-hidden py-3.5 px-6 rounded-2xl bg-white/30 backdrop-blur-md border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.04)]">
            <div className="animate-marquee-hero10">
              {[...marqueeLogos, ...marqueeLogos, ...marqueeLogos].map((logo, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 cursor-pointer transition-colors hover:text-blue-500"
                >
                  {logo.icon}
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                    {logo.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Landscape Footer Backdrop */}
      <div className="absolute bottom-0 left-0 right-0 h-[220px] md:h-[320px] z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-zinc-50/60 to-transparent z-10" />
        <img
          src="https://storage.googleapis.com/codewithmuhilandb.appspot.com/admin-content/hero-landscape-bg.png?v=2"
          alt=""
          className="w-full h-full object-cover object-bottom transition-all duration-500 scale-102"
        />
      </div>
    </section>
  );
}
