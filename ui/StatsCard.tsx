import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "../src/lib/utils";

interface StatsCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  className?: string;
}

export default function StatsCard({
  label,
  value,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "border text-card-foreground group relative overflow-hidden transition-all duration-300 hover:shadow-lg active:scale-95 sm:active:scale-100 bg-white p-4 rounded-xl border-none sm:border border-slate-200/80 shadow-sm sm:shadow-md w-full h-[124px] sm:h-[84px] flex items-center justify-center",
        className,
      )}
    >
      {/* Mobile Touch Overlay */}
      <div
        className={cn(
          "absolute inset-0 opacity-[0.03] sm:hidden transition-opacity group-active:opacity-[0.06]",
          iconBgClass,
        )}
      />

      {/* Flex Container */}
      <div className="flex sm:flex-row flex-col items-center sm:items-center space-y-2.5 sm:space-y-0 sm:space-x-4 text-center sm:text-left relative z-10 w-full">
        {/* Icon Circle Container */}
        <div
          className={cn(
            "p-2.5 sm:p-3 rounded-xl sm:rounded-full transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm sm:shadow-none shrink-0 w-12 h-12 flex items-center justify-center",
            iconBgClass,
          )}
        >
          <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", iconColorClass)} />
        </div>

        {/* Text Container */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[10px] sm:text-sm font-bold sm:font-medium uppercase sm:capitalize tracking-widest sm:tracking-normal text-slate-400 sm:text-slate-500 truncate px-1">
            {label}
          </p>
          <p className="text-[13px] sm:text-[20px] font-bold text-slate-900 font-mono mt-0.5 sm:mt-0 px-1 leading-tight">
            {value}
          </p>
        </div>
      </div>

      {/* Background Decorative Large Icon (Only visible on mobile) */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.04] sm:hidden pointer-events-none transform rotate-12 scale-110">
        <Icon className={cn("h-20 w-20", iconColorClass)} />
      </div>

      {/* Bottom Line Gradient (Only visible on mobile) */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-orange-500/10 to-transparent sm:hidden" />
    </div>
  );
}
