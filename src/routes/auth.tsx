import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentUser, signInAction } from "@/lib/db-queries.server";
import { toast } from "sonner";
import { Loader2, LogIn, Mail, Lock, Eye, EyeOff, Utensils } from "lucide-react";
import authBg from "@/assets/auth-bg.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MenuVerse" },
      { name: "description", content: "Sign in or create your MenuVerse workspace." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [demoTab, setDemoTab] = useState<"saas" | "rest1" | "rest2">("rest1");

  useEffect(() => {
    let token: string | undefined;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("menuverse_session") || undefined;
    }
    getCurrentUser({ data: { token } }).then((user) => {
      if (user) {
        const isSuper = user.role === "super_admin";
        if (isSuper) {
          navigate({ to: "/admin" });
        } else {
          navigate({ to: "/dashboard" });
        }
      }
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signInAction({ data: { email, password } });
      if (res?.token && typeof window !== "undefined") {
        document.cookie = `menuverse_session=${res.token}; path=/; max-age=604800; SameSite=Lax`;
        localStorage.setItem("menuverse_session", res.token);
      }
      setLoading(false);
      toast.success("Welcome back!");
      const roles = res?.user?.roles || [];
      if (roles.includes("super_admin")) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setLoading(false);
      return toast.error(error.message || "Invalid credentials");
    }
  };

  const handleForgot = async () => {
    toast.info("Password resets are disabled for local/custom databases. Please contact support.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8">
      {/* Restaurant photo backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${authBg})` }}
      />
      {/* Warm tint + darken overlay for readability */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,10,5,0.55) 0%, rgba(30,15,8,0.45) 50%, rgba(20,10,5,0.65) 100%)",
        }}
      />

      {/* Brand mark */}
      <Link to="/" className="relative z-10 inline-flex items-center gap-2 px-1 py-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-[#0f172a]">
          <Utensils className="h-3.5 w-3.5" />
        </span>
        <span className="text-[15px] font-semibold text-white drop-shadow">MenuVerse</span>
      </Link>

      {/* Auth card */}
      <div className="relative z-10 mx-auto mt-16 w-full max-w-105">
        <div
          className="rounded-3xl border border-white/60 bg-white/55 p-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(226,240,253,0.55) 100%)",
          }}
        >
          {/* Icon badge — nested inside card */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <LogIn className="h-5 w-5 text-[#0f172a]" strokeWidth={2.2} />
          </div>

          <h1 className="text-center text-[22px] font-bold tracking-tight text-[#0f172a]">
            Sign in with email
          </h1>
          <p className="mx-auto mt-2 max-w-[320px] text-center text-[13px] leading-relaxed text-slate-500">
            Launch your digital QR menu and serve your restaurant smarter — free to start.
          </p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-3">
            {/* Email */}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="si-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white/70 pl-10 pr-3 text-[14px] text-[#0f172a] placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="si-pass"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white/70 pl-10 pr-10 text-[14px] text-[#0f172a] placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgot}
                className="text-[12px] font-medium text-[#0f172a] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-[#1f2937] text-[14px] font-medium text-white shadow-sm transition hover:bg-[#0f172a] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Started"}
            </button>

            {/* Quick Demo Credentials */}
            <div className="mt-5 pt-3 border-t border-slate-200/60 space-y-3">
              <p className="text-[11px] font-bold text-slate-600 text-center uppercase tracking-wider">
                Quick Demo Accounts
              </p>

              {/* Workspace / Tenant Tabs */}
              <div className="flex rounded-full bg-slate-200/80 p-1 text-[11px] font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setDemoTab("saas")}
                  className={cn(
                    "flex-1 py-1.5 rounded-full transition-all cursor-pointer text-center",
                    demoTab === "saas"
                      ? "bg-white text-purple-700 shadow-xs font-bold"
                      : "hover:text-slate-900",
                  )}
                >
                  ⚡ SaaS Admin
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("rest1")}
                  className={cn(
                    "flex-1 py-1.5 rounded-full transition-all cursor-pointer text-center",
                    demoTab === "rest1"
                      ? "bg-white text-amber-700 shadow-xs font-bold"
                      : "hover:text-slate-900",
                  )}
                >
                  🍔 Rest 1
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("rest2")}
                  className={cn(
                    "flex-1 py-1.5 rounded-full transition-all cursor-pointer text-center",
                    demoTab === "rest2"
                      ? "bg-white text-rose-700 shadow-xs font-bold"
                      : "hover:text-slate-900",
                  )}
                >
                  👑 Rest 2
                </button>
              </div>

              {/* Tab 1: SaaS Super Admin */}
              {demoTab === "saas" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-center text-purple-800 font-semibold">
                    Global SaaS Platform Administrator
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@menuverse.app");
                      setPassword("admin123");
                      toast.info("Prefilled Super Admin demo credentials!");
                    }}
                    className="w-full h-10 px-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-950 hover:bg-purple-500/20 text-center font-bold transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-[12px]"
                  >
                    <span>⚡</span> Super Admin Demo (SaaS Level)
                  </button>
                </div>
              )}

              {/* Tab 2: Restaurant 1 (Burger Craft) */}
              {demoTab === "rest1" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-center text-amber-900 font-semibold">
                    Burger Craft Lab (Tenant #1)
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("owner@burgercraft.com");
                        setPassword("owner123");
                        toast.info("Burger Craft — Owner prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>👑</span> Owner Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("manager@burgercraft.com");
                        setPassword("manager123");
                        toast.info("Burger Craft — Manager prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛡️</span> Manager Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("cashier@burgercraft.com");
                        setPassword("cashier123");
                        toast.info("Burger Craft — Cashier prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>💳</span> Cashier Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("chef@burgercraft.com");
                        setPassword("chef123");
                        toast.info("Burger Craft — Chef prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🍳</span> Chef Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("waiter@burgercraft.com");
                        setPassword("waiter123");
                        toast.info("Burger Craft — Waiter prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛎️</span> Waiter Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("host@burgercraft.com");
                        setPassword("host123");
                        toast.info("Burger Craft — Host prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📅</span> Host Demo
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Restaurant 2 (Sultan's Dine) */}
              {demoTab === "rest2" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-center text-rose-900 font-semibold">
                    Sultan's Dine (Tenant #2)
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("owner@sultansdine.com");
                        setPassword("owner123");
                        toast.info("Sultan's Dine — Owner prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>👑</span> Owner Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("manager@sultansdine.com");
                        setPassword("manager123");
                        toast.info("Sultan's Dine — Manager prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛡️</span> Manager Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("cashier@sultansdine.com");
                        setPassword("cashier123");
                        toast.info("Sultan's Dine — Cashier prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>💳</span> Cashier Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("chef@sultansdine.com");
                        setPassword("chef123");
                        toast.info("Sultan's Dine — Chef prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🍳</span> Chef Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("waiter@sultansdine.com");
                        setPassword("waiter123");
                        toast.info("Sultan's Dine — Waiter prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛎️</span> Waiter Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("host@sultansdine.com");
                        setPassword("host123");
                        toast.info("Sultan's Dine — Host prefilled!");
                      }}
                      className="h-9 px-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 hover:bg-white hover:shadow-xs text-left font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📅</span> Host Demo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/80">
          By continuing you agree to MenuVerse's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
