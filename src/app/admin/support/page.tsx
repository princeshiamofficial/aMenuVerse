"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useAdminContext } from "@/lib/admin-context";
import { PriorityDot } from "@/app/admin/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function SupportComponent() {
  const { tickets, setTickets } = useAdminContext();

  const setTicketStatus = (id: string, status: "open" | "pending" | "resolved") => {
    setTickets((t) => t.map((x) => (x.id === id ? { ...x, status, updated: "just now" } : x)));
    toast.success(`Ticket ${id} status updated to ${status}`);
  };

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-base font-semibold mb-4">Support Tickets</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-medium">{t.id}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{t.from}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 capitalize text-xs">
                      <PriorityDot p={t.priority} />
                      {t.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={t.status}
                      onValueChange={(v: "open" | "pending" | "resolved") =>
                        setTicketStatus(t.id, v)
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
