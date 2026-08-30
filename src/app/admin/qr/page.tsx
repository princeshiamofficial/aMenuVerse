"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { QR_TREND, tooltipStyle } from "@/lib/admin-data";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { QrCode } from "lucide-react";

export default function QrUsageComponent() {
  const totalScans = QR_TREND.reduce((s, r) => s + r.scans, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-2xl p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Scans (Last 14 Days)
            </span>
            <h3 className="mt-2 font-display text-4xl font-bold">{totalScans.toLocaleString()}</h3>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-muted-foreground text-xs">
            <QrCode className="h-4 w-4 text-primary" /> Active scan streams
          </div>
        </section>

        <section className="glass rounded-2xl p-6 shadow-card lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Live Scans Activity</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={QR_TREND}>
                <defs>
                  <linearGradient id="qrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="hsl(var(--primary))"
                  fill="url(#qrFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
