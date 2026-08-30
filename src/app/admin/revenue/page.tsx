"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useAdminContext } from "@/lib/admin-context";
import { REVENUE_TREND, tooltipStyle } from "@/lib/admin-data";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign } from "lucide-react";

export default function RevenueComponent() {
  const { restaurantsList } = useAdminContext();
  const mrr = restaurantsList.reduce((s, r) => s + (r.mrr || 0), 0);

  const transactions = [
    {
      id: "TX-1002",
      restaurant: "MenuVerse Kitchen",
      amount: 89,
      status: "Succeeded",
      date: "Today",
    },
    {
      id: "TX-1001",
      restaurant: "Sultan's Dine",
      amount: 89,
      status: "Succeeded",
      date: "Yesterday",
    },
    {
      id: "TX-1000",
      restaurant: "Kacchi Bhai",
      amount: 29,
      status: "Succeeded",
      date: "3 days ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-2xl p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Monthly Recurring Revenue
            </span>
            <h3 className="mt-2 font-display text-4xl font-bold">${mrr.toLocaleString()}</h3>
          </div>
          <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-semibold">
            <DollarSign className="h-4 w-4" /> Direct MySQL calculations
          </div>
        </section>

        <section className="glass rounded-2xl p-6 shadow-card lg:col-span-2">
          <h3 className="font-display text-base font-semibold">MRR Trend</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_TREND}>
                <defs>
                  <linearGradient id="mrrFillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  fill="url(#mrrFillRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="glass rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-base font-semibold mb-4">Recent Transactions</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-mono font-medium">{tx.id}</TableCell>
                <TableCell>{tx.restaurant}</TableCell>
                <TableCell className="font-mono">${tx.amount}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-500/30">
                    {tx.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{tx.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
