"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { tooltipStyle } from "@/lib/admin-data";

export default function AnalyticsComponent() {
  const chartData = [
    { name: "Device iOS", count: 4800 },
    { name: "Device Android", count: 3900 },
    { name: "Desktop", count: 1200 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="glass rounded-2xl p-6 shadow-card">
          <h3 className="font-display text-base font-semibold mb-4">Visitor Device Splits</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">General platform stats</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Performance metrics for all regions are operating within target bounds.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <span className="text-xs text-muted-foreground">API Latency</span>
                <p className="text-xl font-bold mt-1 font-mono">42ms</p>
              </div>
              <div className="rounded-xl border p-4">
                <span className="text-xs text-muted-foreground">Uptime</span>
                <p className="text-xl font-bold mt-1 font-mono">99.98%</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
