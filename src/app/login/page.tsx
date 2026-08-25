"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LogIn, Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Validation and feedback states
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userRole", data.user.role);
          localStorage.setItem("userDisplayName", data.user.name);
          localStorage.setItem("userAssignedBranchId", data.user.assignedBranchId || "");
          const dest =
            data.user.restaurantId === null || data.user.role === "system_admin"
              ? "/admin"
              : "/dashboard";
          router.replace(dest);
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        setIsCheckingAuth(false);
      });
  }, [router]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (response.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userRole", data.user.role);
        localStorage.setItem("userDisplayName", data.user.name);
        localStorage.setItem("userAssignedBranchId", data.user.assignedBranchId || "");

        showToast("Logged in successfully! Redirecting...", "success");
        setTimeout(() => {
          const dest =
            data.user.restaurantId === null || data.user.role === "system_admin"
              ? "/admin"
              : "/dashboard";
          router.push(dest);
        }, 1500);
      } else {
        showToast(
          data.error || "Invalid credentials. Try admin@example.com with password123",
          "error",
        );
      }
    } catch (err) {
      setIsLoading(false);
      showToast("Connection to authentication server failed.", "error");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-deep-emerald-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium tracking-wide text-neutral-400">
            Loading your panel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep-emerald-950 flex flex-col relative overflow-hidden text-neutral-100 font-sans selection:bg-emerald-800 selection:text-white">
      {/* Decorative Organic Glow Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-700/10 blur-[120px] pointer-events-none animate-pulse duration-8000" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-teal-800/10 blur-[150px] pointer-events-none animate-pulse duration-10000" />

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 relative z-10">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-24 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-[18px] border backdrop-blur-md shadow-2xl animate-in slide-in-from-top-4 duration-300 ${
              toastMessage.type === "success"
                ? "bg-emerald-900/80 border-emerald-500/30 text-white"
                : "bg-red-950/80 border-red-500/30 text-white"
            }`}
          >
            {toastMessage.type === "success" ? (
              <svg
                className="w-5 h-5 text-emerald-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="text-[14px] font-medium tracking-wide">{toastMessage.text}</span>
          </div>
        )}

        {/* Back Link for Desktop */}
        <div className="absolute top-8 left-8 hidden lg:block">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="w-full max-w-[480px] bg-deep-emerald-900/35 border border-deep-emerald-800/40 rounded-[28px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] backdrop-blur-xl p-8 md:p-10 transition-all duration-300 hover:border-deep-emerald-700/50">
          {/* Card Header & Brand Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-deep-emerald-900 border border-deep-emerald-800 flex items-center justify-center mb-4 shadow-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-white"
              >
                <path d="M4 18c0-3 3-5 6-5s4.5-1 5.5-3S15.5 4 13.5 4s-4 2-4 5c0 4 3 6 6 8s3.5 3 4.5 3" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome Back</h1>
            <p className="text-[14px] text-neutral-400 leading-relaxed max-w-[320px]">
              Access your digital menu panel and manage restaurant services.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`w-full h-11 pl-10 pr-4 rounded-[14px] bg-deep-emerald-950/60 border ${
                    errors.email
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-deep-emerald-800/60 focus:border-emerald-500/70"
                  } text-white placeholder-neutral-500 text-[14px] focus:outline-none transition-all duration-200`}
                />
              </div>
              {errors.email && (
                <span className="text-xs font-medium text-red-400 mt-1 flex items-center gap-1">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`w-full h-11 pl-10 pr-10 rounded-[14px] bg-deep-emerald-950/60 border ${
                    errors.password
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-deep-emerald-800/60 focus:border-emerald-500/70"
                  } text-white placeholder-neutral-500 text-[14px] focus:outline-none transition-all duration-200`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs font-medium text-red-400 mt-1 flex items-center gap-1">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between mt-1 text-[13px]">
              <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300 hover:text-white transition-colors group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded bg-deep-emerald-950/70 border border-deep-emerald-850 group-hover:border-emerald-500/60 peer-checked:bg-emerald-600 peer-checked:border-emerald-500 flex items-center justify-center transition-all duration-200">
                    <svg
                      className={`w-2.5 h-2.5 text-white transition-opacity ${rememberMe ? "opacity-100" : "opacity-0"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span>Remember me</span>
              </label>

              <a
                href="#"
                className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-11 flex items-center justify-center gap-2 rounded-[14px] bg-linear-to-r from-emerald-500 to-teal-500 text-deep-emerald-950 font-bold text-[14px] hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 focus:outline-none shadow-[0_4px_16px_rgba(16,185,129,0.15)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.25)]"
            >
              {isLoading ? (
                <svg
                  className="animate-spin h-5 w-5 text-deep-emerald-950"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <>
                  <LogIn className="w-[16px] h-[16px]" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* Bottom Info */}
            <div className="text-center mt-2 text-[13px] text-neutral-400">
              Don&apos;t have an account?{" "}
              <a
                href="#"
                className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Sign Up
              </a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
