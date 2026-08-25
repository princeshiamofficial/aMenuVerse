"use client";

import React from "react";
import { ChevronRight, Check } from "lucide-react";

export interface KitchenOrder {
  id: string;
  table: string;
  items: Array<{ name: string; quantity: number; notes?: string; checked?: boolean }>;
  elapsedMinutes: number;
  priority: "high" | "medium" | "low";
  status: "new" | "preparing" | "qa" | "ready" | "delivered";
  branchId?: string;
}

// Inline SVG Stopwatch Icon Component
const StopwatchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="14" r="8" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="10" y1="2" x2="14" y2="2" />
    <path d="M12 14l2-2" />
  </svg>
);

export const getStationForItem = (name: string): "Grill" | "Beverage" | "Oven" | "Kitchen" => {
  const n = name.toLowerCase();
  if (n.includes("burger") || n.includes("patty") || n.includes("steak") || n.includes("grill")) {
    return "Grill";
  }
  if (
    n.includes("lemonade") ||
    n.includes("drink") ||
    n.includes("mint") ||
    n.includes("soda") ||
    n.includes("water") ||
    n.includes("juice") ||
    n.includes("tea") ||
    n.includes("coffee")
  ) {
    return "Beverage";
  }
  if (
    n.includes("pizza") ||
    n.includes("bakery") ||
    n.includes("bread") ||
    n.includes("waffle") ||
    n.includes("crepe")
  ) {
    return "Oven";
  }
  return "Kitchen";
};

function formatDurationPrecise(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Due";

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
  } else if (seconds > 0) {
    return "<1s";
  }

  return parts.length > 0 ? parts.join(" ") : "Due";
}

export interface ProgressInfo {
  showProgressBar: boolean;
  percentage: number;
  displayText: string;
  isOverdue: boolean;
  progressColorClass: string;
  stageTargetDate: string;
}

const formatSlaMinutes = (minutes: number): string => {
  return `${minutes} Min SLA`;
};

export const calculateProgressInfo = (order: KitchenOrder, now: Date): ProgressInfo => {
  const createdAt = new Date(now.getTime() - order.elapsedMinutes * 60 * 1000);
  let totalSlaMinutes = 15;
  let slaStageName = ` (${formatSlaMinutes(15)})`;
  const showProgressBar = order.status !== "delivered";

  if (order.status === "new") {
    totalSlaMinutes = 15;
    slaStageName = ` (${formatSlaMinutes(15)})`;
  } else if (order.status === "preparing") {
    totalSlaMinutes = 25;
    slaStageName = ` (${formatSlaMinutes(25)})`;
  } else if (order.status === "qa") {
    totalSlaMinutes = 5;
    slaStageName = ` (${formatSlaMinutes(5)})`;
  } else if (order.status === "ready") {
    totalSlaMinutes = 10;
    slaStageName = ` (${formatSlaMinutes(10)})`;
  } else if (order.status === "delivered") {
    totalSlaMinutes = 15;
    slaStageName = ` (${formatSlaMinutes(15)})`;
  }

  const effectiveTargetDate = new Date(createdAt.getTime() + totalSlaMinutes * 60 * 1000);
  const targetDateStr = effectiveTargetDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  let percentage: number;
  let displayText: string;
  let isOverdue = false;
  let progressColorClass = "progress-indicator-gradient";

  if (now.getTime() > effectiveTargetDate.getTime()) {
    isOverdue = true;
    const diffSeconds = Math.floor((now.getTime() - effectiveTargetDate.getTime()) / 1000);
    const diffMins = Math.floor(diffSeconds / 60);
    const diffSecs = diffSeconds % 60;
    displayText = diffMins > 0 ? `Overdue by ${diffMins}m ${diffSecs}s` : `Overdue by ${diffSecs}s`;
    progressColorClass = "bg-destructive";
    percentage = 100;
  } else {
    const secondsRemaining = Math.max(
      0,
      Math.floor((effectiveTargetDate.getTime() - now.getTime()) / 1000),
    );
    displayText = `${formatDurationPrecise(secondsRemaining)} remaining`;

    const totalDurationSeconds = totalSlaMinutes * 60;
    const elapsedDurationSeconds = order.elapsedMinutes * 60;
    percentage =
      totalDurationSeconds > 0
        ? Math.max(0, Math.min(100, (elapsedDurationSeconds / totalDurationSeconds) * 100))
        : 100;
  }

  if (slaStageName) {
    displayText += slaStageName;
  }

  return {
    showProgressBar,
    percentage: Math.round(percentage),
    displayText,
    isOverdue,
    progressColorClass,
    stageTargetDate: targetDateStr,
  };
};

interface KitchenOrderCardProps {
  order: KitchenOrder;
  now: Date;
  selectedStation: string;
  openDropdownOrderId: string | null;
  setOpenDropdownOrderId: (id: string | null) => void;
  moveOrder: (orderId: string, nextStatus: KitchenOrder["status"]) => void;
  onCardClick: () => void;
}

export default function KitchenOrderCard({
  order,
  now,
  selectedStation,
  openDropdownOrderId,
  setOpenDropdownOrderId,
  moveOrder,
  onCardClick,
}: KitchenOrderCardProps) {
  const progressInfo = calculateProgressInfo(order, now);

  const progressStyle =
    progressInfo.progressColorClass === "progress-indicator-gradient"
      ? {
          transform: `translateX(-${100 - progressInfo.percentage}%)`,
          backgroundImage:
            "linear-gradient(to right, rgb(239, 68, 68), rgb(245, 158, 11), rgb(234, 179, 8), rgb(132, 204, 22), rgb(16, 185, 129))",
        }
      : {
          width: `${progressInfo.percentage}%`,
          backgroundColor:
            progressInfo.progressColorClass === "bg-destructive" ? "#ef4444" : "#f5a623",
        };

  const statusColors: Record<KitchenOrder["status"], string> = {
    new: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    preparing: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    qa: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    delivered: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  };

  const statusLabels: Record<KitchenOrder["status"], string> = {
    new: "New",
    preparing: "Preparing",
    qa: "QA / Plating",
    ready: "Ready",
    delivered: "Served",
  };

  const isDropdownOpen = openDropdownOrderId === order.id;

  return (
    <div
      onClick={onCardClick}
      className="group relative flex w-full sm:w-[300px] sm:shrink-0 cursor-pointer flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/90 p-4 text-slate-100 shadow-lg shadow-black/40 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:border-slate-700/80 hover:shadow-xl hover:shadow-black/60 active:scale-[0.99] animate-in fade-in zoom-in-95"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-black tracking-tight text-white">{order.id}</span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColors[order.status]}`}
            >
              {statusLabels[order.status]}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">
            Table {order.table} &bull; {order.items.length} items
          </p>
        </div>

        {/* Priority Badge */}
        <span
          className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 transition-all ${
            order.priority === "high"
              ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse"
              : order.priority === "medium"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                : "bg-slate-800/50 border-slate-700/50 text-slate-400"
          }`}
        >
          {order.priority}
        </span>
      </div>

      {/* SLA Timer Area */}
      {progressInfo.showProgressBar && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          <div className="flex items-center gap-1.5 text-slate-350 text-[11px] font-bold">
            <StopwatchIcon
              className={`w-3.5 h-3.5 shrink-0 ${progressInfo.isOverdue ? "text-red-400" : "text-amber-500"}`}
            />
            <span
              className={`truncate ${progressInfo.isOverdue ? "text-red-400 font-extrabold" : ""}`}
              title={progressInfo.displayText}
            >
              {progressInfo.displayText}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="relative w-full h-1.5 rounded-full bg-slate-950/80 shadow-inner overflow-hidden border border-slate-800/40">
            <div
              className={`h-full w-full rounded-full transition-transform duration-500 ${
                progressInfo.isOverdue ? "animate-pulse" : ""
              }`}
              style={progressStyle}
            />
          </div>
        </div>
      )}

      {/* Items List Inside Card */}
      <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-3 mt-1">
        {order.items.map((item, idx) => {
          const itemStation = getStationForItem(item.name);
          const isStationMatch = selectedStation === "All" || itemStation === selectedStation;

          return (
            <div
              key={idx}
              className={`text-[11px] flex justify-between items-center transition-all duration-250 ${
                isStationMatch ? "font-bold text-slate-200" : "text-slate-600 opacity-40"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                    item.checked
                      ? "bg-slate-750"
                      : "bg-[#ff7a00] shadow-[0_0_6px_rgba(255,122,0,0.6)]"
                  }`}
                />
                <span
                  className={`truncate transition-all duration-200 ${item.checked ? "line-through text-slate-500 font-normal" : ""}`}
                >
                  {item.name}{" "}
                  <span className="text-[#ff7a00] font-black ml-0.5">x{item.quantity}</span>
                </span>
              </div>
              <span
                className={`text-[8px] font-bold py-0.5 rounded shrink-0 w-14 inline-flex justify-center items-center transition-colors ${
                  isStationMatch
                    ? "bg-slate-800 border border-slate-700 text-slate-350"
                    : "bg-slate-900/50 border border-slate-850 text-slate-600"
                }`}
              >
                {itemStation}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Transition Action Button */}
      <div className="relative pt-2 border-t border-slate-800/60 mt-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdownOrderId(isDropdownOpen ? null : order.id);
          }}
          className={`w-full py-1.5 rounded-xl text-[10px] font-extrabold text-white transition-all active:scale-95 flex items-center justify-between px-3 border shadow-md ${
            order.status === "new"
              ? "bg-sky-600 hover:bg-sky-500 border-sky-500/30 shadow-sky-600/10"
              : order.status === "preparing"
                ? "bg-purple-600 hover:bg-purple-500 border-purple-500/30 shadow-purple-600/10"
                : order.status === "qa"
                  ? "bg-amber-600 hover:bg-amber-500 border-amber-500/30 shadow-amber-600/10"
                  : order.status === "ready"
                    ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 shadow-emerald-600/10"
                    : "bg-teal-600 hover:bg-teal-500 border-teal-500/30 shadow-teal-600/10"
          }`}
        >
          <span>Status: {statusLabels[order.status]}</span>
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? "rotate-90" : ""}`}
          />
        </button>

        {isDropdownOpen && (
          <div
            className="absolute bottom-full left-0 right-0 mb-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-xl shadow-black/80 z-20 py-1 text-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {(["new", "preparing", "qa", "ready", "delivered"] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  moveOrder(order.id, status);
                  setOpenDropdownOrderId(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors flex items-center justify-between ${
                  order.status === status
                    ? "text-[#ff7a00] bg-orange-500/10"
                    : "text-slate-350 hover:bg-slate-900"
                }`}
              >
                <span>{statusLabels[status]}</span>
                {order.status === status && (
                  <Check className="w-3.5 h-3.5 text-[#ff7a00] stroke-3" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
