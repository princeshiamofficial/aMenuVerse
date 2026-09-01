"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ModernDatePicker } from "@/components/menuverse/modern-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  Utensils,
  XCircle,
  Armchair,
  MoreVertical,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  getBranchesServer,
  getCurrentUser,
  getReservationsServer,
  saveReservationsServer,
} from "@/lib/db-queries.server";
import { SkeletonReservations } from "@/components/menuverse/skeletons";
import { useRealtime } from "@/lib/use-realtime";

type ReservationStatus = "pending" | "confirmed" | "seated" | "completed" | "cancelled";

type Reservation = {
  id: string;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  seatingArea: string; // "Main Dining", "Patio", "VIP Lounge", "Rooftop"
  tableNumber?: string;
  status: ReservationStatus;
  specialNotes?: string;
  occasion?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
};

const SEATING_AREAS = [
  "Main Dining Room",
  "Outdoor Patio",
  "VIP Private Lounge",
  "Rooftop Terrace",
  "Chef's Counter",
];

const statusBadges: Record<
  ReservationStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: CheckCircle2,
  },
  seated: {
    label: "Seated",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: Armchair,
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground border-border",
    icon: Utensils,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

const DINING_TIME_SLOTS = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

function formatTime12h(time24: string): string {
  if (!time24) return "07:00 PM";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr || "19", 10);
  const m = mStr || "00";
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const displayH = h < 10 ? `0${h}` : `${h}`;
  return `${displayH}:${m} ${period}`;
}

function get12hComponents(time24: string): {
  h12: string;
  m: string;
  period: "AM" | "PM";
} {
  if (!time24) return { h12: "07", m: "00", period: "PM" };
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr || "19", 10);
  const m = mStr || "00";
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const displayH = h < 10 ? `0${h}` : `${h}`;
  return { h12: displayH, m: ["00", "15", "30", "45"].includes(m) ? m : "00", period };
}

function parseTime24h(h12: string, mStr: string, period: "AM" | "PM"): string {
  let h = parseInt(h12, 10);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const hh = h < 10 ? `0${h}` : `${h}`;
  return `${hh}:${mStr}`;
}

function ModernTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const { h12, m, period } = get12hComponents(value);

  const handleCustomChange = (newH12: string, newM: string, newPeriod: "AM" | "PM") => {
    const time24 = parseTime24h(newH12, newM, newPeriod);
    onChange(time24);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-medium bg-white dark:bg-card border-amber-200/90 hover:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-sm rounded-lg text-neutral-800 dark:text-neutral-200 h-10 px-3 cursor-pointer"
        >
          <Clock className="mr-2 h-4 w-4 text-amber-500 shrink-0" />
          <span>{formatTime12h(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3.5 space-y-3.5 bg-white dark:bg-card border border-border/70 shadow-xl rounded-xl"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>Select Time Slot</span>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
          >
            {formatTime12h(value)}
          </Badge>
        </div>

        <div className="flex items-center justify-center gap-1.5 bg-neutral-50 dark:bg-muted/30 p-2 rounded-lg border border-border/40">
          <Select value={h12} onValueChange={(val) => handleCustomChange(val, m, period)}>
            <SelectTrigger className="w-16 h-8 text-xs font-bold bg-white dark:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="font-bold text-muted-foreground text-sm">:</span>

          <Select value={m} onValueChange={(val) => handleCustomChange(h12, val, period)}>
            <SelectTrigger className="w-16 h-8 text-xs font-bold bg-white dark:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {["00", "15", "30", "45"].map((minVal) => (
                <SelectItem key={minVal} value={minVal}>
                  {minVal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center bg-white dark:bg-card border border-border/70 rounded-md p-0.5 ml-1">
            <button
              type="button"
              onClick={() => handleCustomChange(h12, m, "AM")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer",
                period === "AM"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => handleCustomChange(h12, m, "PM")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer",
                period === "PM"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              PM
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Popular Dining Slots
          </span>
          <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {DINING_TIME_SLOTS.map((slot) => {
              const isSelected = value === slot;
              return (
                <Button
                  key={slot}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 text-[11px] font-medium border-amber-200/70 hover:border-amber-400 cursor-pointer",
                    isSelected
                      ? "gradient-warm text-white font-bold border-transparent"
                      : "bg-white dark:bg-card text-foreground hover:bg-amber-50/50",
                  )}
                  onClick={() => {
                    onChange(slot);
                    setOpen(false);
                  }}
                >
                  {formatTime12h(slot)}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [branches, setBranches] = useState<
    Array<{
      id: string;
      name: string;
      address?: string;
      phone?: string;
      manager?: string;
      isDefault?: boolean;
    }>
  >([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    role?: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);

  const isGlobalOwner = useMemo(() => {
    const rClean = (currentUser?.role || "").toLowerCase().trim();
    return rClean === "super_admin" || rClean === "superadmin" || rClean === "owner";
  }, [currentUser]);

  const staffBranchName = useMemo(() => {
    if (isGlobalOwner) return null;
    if (currentUser?.branch) {
      const bClean = currentUser.branch
        .replace(/\s*\((Manager|Owner|Cashier|Chef|Waiter|Host)\)/gi, "")
        .trim();
      if (bClean) return bClean;
    }
    const uName = (currentUser?.full_name || "").toLowerCase().trim();
    if (uName && branches.length > 0) {
      const matched = branches.find((b) => {
        const mClean = (b.manager || "")
          .replace(/\s*\([^)]*\)/g, "")
          .toLowerCase()
          .trim();
        return mClean && (mClean === uName || mClean.includes(uName) || uName.includes(mClean));
      });
      if (matched) return matched.name;
    }
    return branches[0]?.name || "Main Branch";
  }, [isGlobalOwner, currentUser, branches]);

  useEffect(() => {
    async function loadData() {
      let loggedUser: {
        role?: string | null;
        branch?: string | null;
        full_name?: string | null;
      } | null = null;

      try {
        const u = await getCurrentUser();
        if (u) {
          loggedUser = u;
          setCurrentUser(u);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbBranches = await getBranchesServer({ data: {} });
        if (dbBranches && Array.isArray(dbBranches) && dbBranches.length > 0) {
          setBranches(
            dbBranches as Array<{
              id: string;
              name: string;
              address?: string;
              phone?: string;
              manager?: string;
              isDefault?: boolean;
            }>,
          );

          if (loggedUser) {
            const rClean = (loggedUser.role || "").toLowerCase().trim();
            const isOwner =
              rClean === "super_admin" || rClean === "superadmin" || rClean === "owner";
            if (!isOwner) {
              const uName = (loggedUser.full_name || "").toLowerCase().trim();
              const managedBranch = (
                dbBranches as Array<{ id: string; name: string; manager?: string }>
              ).find((b) => {
                const mClean = (b.manager || "")
                  .replace(/\s*\([^)]*\)/g, "")
                  .toLowerCase()
                  .trim();
                return (
                  mClean &&
                  uName &&
                  (mClean === uName || mClean.includes(uName) || uName.includes(mClean))
                );
              });
              if (managedBranch) {
                setBranchFilter(managedBranch.name);
                setCurrentUser({ ...loggedUser, branch: managedBranch.name });
              } else if (loggedUser.branch) {
                const bClean = loggedUser.branch.replace(/\s*\([^)]*\)/g, "").trim();
                const matched = dbBranches.find(
                  (b) =>
                    b.name.toLowerCase().trim() === bClean.toLowerCase().trim() ||
                    b.name.toLowerCase().includes(bClean.toLowerCase()),
                );
                setBranchFilter(matched ? matched.name : bClean);
              } else {
                setBranchFilter(dbBranches[0].name);
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbRes = (await getReservationsServer({ data: {} })) as unknown as Reservation[];
        if (dbRes && Array.isArray(dbRes)) {
          setReservations(dbRes as unknown as Reservation[]);
        } else {
          setReservations([]);
        }
      } catch {
        setReservations([]);
      }
      setHydrated(true);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(async () => {
      try {
        const effectiveBranch =
          !isGlobalOwner && staffBranchName
            ? staffBranchName
            : branchFilter !== "all"
              ? branchFilter
              : undefined;

        const dbRes = (await getReservationsServer({
          data: {
            branchId: effectiveBranch,
            status: statusFilter !== "all" ? statusFilter : undefined,
            seatingArea: areaFilter !== "all" ? areaFilter : undefined,
            search: search.trim() || undefined,
          },
        })) as unknown as Reservation[];

        if (dbRes && Array.isArray(dbRes)) {
          setReservations(dbRes as unknown as Reservation[]);
        }
      } catch (err) {
        console.warn("[Reservations] Server fetch error:", err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, branchFilter, statusFilter, areaFilter, search, isGlobalOwner, staffBranchName]);

  useRealtime({
    branchId: branchFilter !== "all" ? branchFilter : undefined,
    eventTypes: ["reservation:created", "reservation:updated", "reservation:deleted"],
    onEvent: (event) => {
      if (event.type === "reservation:created") {
        const payload = event.payload as Reservation;
        if (payload?.id) {
          setReservations((prev) => {
            if (prev.some((r) => r.id === payload.id)) return prev;
            return [payload, ...prev];
          });
          toast.info(`📅 New Reservation for ${payload.guestName || "Guest"}!`, {
            description: `${payload.date} at ${payload.time} • ${payload.partySize} Guests`,
          });
        }
      } else if (event.type === "reservation:updated") {
        const payload = event.payload as Partial<Reservation> & { id: string };
        if (payload?.id) {
          setReservations((prev) =>
            prev.map((r) => (r.id === payload.id ? { ...r, ...payload } : r)),
          );
        }
      } else if (event.type === "reservation:deleted") {
        const payload = event.payload as { id: string };
        if (payload?.id) {
          setReservations((prev) => prev.filter((r) => r.id !== payload.id));
        }
      }
    },
  });

  const saveReservationsList = async (updated: Reservation[]) => {
    setReservations(updated);
    try {
      await saveReservationsServer({
        data: updated as unknown as Parameters<typeof saveReservationsServer>[0]["data"],
      });
    } catch {
      toast.error("Failed to sync reservations to MySQL");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const effectiveBranchFilter =
      !isGlobalOwner && staffBranchName ? staffBranchName : branchFilter;

    return reservations.filter((r) => {
      const matchQuery =
        !q ||
        r.guestName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.tableNumber && r.tableNumber.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchArea = areaFilter === "all" || r.seatingArea === areaFilter;

      let matchBranch = true;
      if (effectiveBranchFilter !== "all") {
        const fbLower = effectiveBranchFilter.toLowerCase().trim();
        const rBranchLower = (r.branchName || r.branchId || "").toLowerCase().trim();
        matchBranch =
          rBranchLower === fbLower ||
          rBranchLower.includes(fbLower) ||
          fbLower.includes(rBranchLower);
      }

      let matchDate = true;
      if (dateFilter) {
        matchDate = r.date === dateFilter;
      }

      return matchQuery && matchStatus && matchArea && matchBranch && matchDate;
    });
  }, [
    reservations,
    search,
    statusFilter,
    areaFilter,
    branchFilter,
    dateFilter,
    isGlobalOwner,
    staffBranchName,
  ]);

  const handleOpenAdd = () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const defaultBranch =
      !isGlobalOwner && staffBranchName
        ? staffBranchName
        : branchFilter !== "all"
          ? branchFilter
          : branches[0]?.name || "Main Branch";

    const defaultBranchId =
      branches.find((b) => b.name.toLowerCase().trim() === defaultBranch.toLowerCase().trim())
        ?.id || defaultBranch;

    setEditing({
      id: `RES-${Math.floor(100 + Math.random() * 900)}`,
      guestName: "",
      phone: "",
      email: "",
      partySize: 2,
      date: todayStr,
      time: "19:00",
      seatingArea: "Main Dining Room",
      status: "confirmed",
      specialNotes: "",
      occasion: "",
      branchId: defaultBranchId,
      branchName: defaultBranch,
      createdAt: new Date().toISOString(),
    });
    setSheetOpen(true);
  };

  const handleOpenEdit = (res: Reservation) => {
    setEditing({ ...res });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    if (!editing.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    const matchedB = branches.find(
      (b) => b.name === editing.branchName || b.id === editing.branchId,
    );
    const toSave: Reservation = {
      ...editing,
      branchId: editing.branchId || matchedB?.id,
      branchName: editing.branchName || matchedB?.name || "Main Branch",
    };

    const isNew = !reservations.some((r) => r.id === toSave.id);
    const updated = isNew
      ? [toSave, ...reservations]
      : reservations.map((r) => (r.id === toSave.id ? toSave : r));

    setReservations(updated);
    setSheetOpen(false);
    await saveReservationsList(updated);
    toast.success(isNew ? "Reservation created" : "Reservation updated");
  };

  const updateStatus = async (id: string, status: ReservationStatus) => {
    const updated = reservations.map((r) => (r.id === id ? { ...r, status } : r));
    setReservations(updated);
    await saveReservationsList(updated);
    toast.success(`Booking status updated to ${status}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    const updated = reservations.filter((r) => r.id !== targetId);
    setReservations(updated);
    setDeleteId(null);
    await saveReservationsList(updated);
    toast.success("Reservation deleted");
  };

  if (!hydrated) {
    return <SkeletonReservations />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {/* Top Quick Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs transition-all">
          <div className="h-10 w-10 rounded-xl bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/80 shadow-2xs">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-950 dark:text-amber-100 leading-none">
              {reservations.length}
            </p>
            <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-300/90 mt-1">
              Total Bookings
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs transition-all">
          <div className="h-10 w-10 rounded-xl bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/80 shadow-2xs">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-950 dark:text-amber-100 leading-none">
              {reservations.filter((r) => r.status === "pending").length}
            </p>
            <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-300/90 mt-1">
              Pending Confirmation
            </p>
          </div>
        </div>

        <div className="bg-blue-500/10 hover:bg-blue-500/15 border border-blue-300/60 dark:border-blue-500/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs transition-all">
          <div className="h-10 w-10 rounded-xl bg-blue-100/90 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-300/80 shadow-2xs">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-blue-950 dark:text-blue-100 leading-none">
              {reservations.filter((r) => r.status === "confirmed" || r.status === "seated").length}
            </p>
            <p className="text-xs font-semibold text-blue-800/90 dark:text-blue-300/90 mt-1">
              Confirmed / Seated
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-300/60 dark:border-emerald-300/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-300/80 shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-950 dark:text-emerald-100 leading-none">
              {reservations.reduce((s, r) => s + (r.partySize || 0), 0)}
            </p>
            <p className="text-xs font-semibold text-emerald-800/90 dark:text-emerald-300/90 mt-1">
              Expected Guests
            </p>
          </div>
        </div>
      </div>

      {/* Standalone Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-70">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search guest, phone, table..."
              className="pl-9 pr-4 bg-white dark:bg-card border-neutral-200/80 dark:border-border/80 hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-neutral-400/20 shadow-2xs rounded-md text-foreground placeholder:text-neutral-400 font-normal text-xs h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!isGlobalOwner && staffBranchName ? (
            <div className="flex h-9 items-center gap-1.5 rounded-md border border-neutral-200/80 bg-muted/40 px-3 text-xs font-semibold text-foreground shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-amber-600" />
              <span>{staffBranchName}</span>
            </div>
          ) : (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-38 h-9 text-xs font-normal bg-white dark:bg-card border-neutral-200/80 dark:border-border/80 hover:border-neutral-300 rounded-md cursor-pointer shadow-2xs">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">All Branches</SelectItem>
                {(branches.length > 0 ? branches : [{ id: "main", name: "Main Branch" }]).map(
                  (b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-34 h-9 text-xs font-normal bg-white dark:bg-card border-neutral-200/80 dark:border-border/80 hover:border-neutral-300 rounded-md cursor-pointer shadow-2xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="seated">Seated</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-40 h-9 text-xs font-normal bg-white dark:bg-card border-neutral-200/80 dark:border-border/80 hover:border-neutral-300 rounded-md cursor-pointer shadow-2xs">
              <SelectValue placeholder="All Seating Areas" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all">All Seating Areas</SelectItem>
              {SEATING_AREAS.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || statusFilter !== "all" || areaFilter !== "all" || branchFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground hover:text-foreground rounded-md px-3 cursor-pointer"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setAreaFilter("all");
                setBranchFilter("all");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        <Button
          onClick={handleOpenAdd}
          size="sm"
          className="bg-linear-to-r from-[#D77649] via-[#CB6C3F] to-[#B85C31] hover:from-[#C9693D] hover:to-[#A74E26] text-white shadow-md shadow-amber-900/10 shrink-0 h-9 rounded-md px-5 text-xs font-medium tracking-wide flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-white" /> New Reservation
        </Button>
      </div>

      {/* Main Table Card Container */}
      <div className="bg-white dark:bg-card shadow-sm rounded-xl border border-neutral-200/80 dark:border-border/70 overflow-hidden">
        {/* Table Content */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 font-display text-base font-semibold">No reservations found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search filters or create a new booking.
            </p>
            <Button
              onClick={handleOpenAdd}
              size="sm"
              className="mt-4 gradient-warm text-primary-foreground shadow-elegant rounded-xl"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New Reservation
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/50">
              <TableRow>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Name
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Phone
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Branch
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Occasion
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Date & Time
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Party & Table
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Seating Area
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs px-5 py-3.5">
                  Special Notes
                </TableHead>
                <TableHead className="text-right font-semibold text-foreground text-xs px-5 py-3.5">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const badge = statusBadges[r.status];
                const BadgeIcon = badge.icon;
                return (
                  <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-foreground text-sm">{r.guestName}</span>
                        {r.email && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" /> {r.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-4">
                      <span className="text-xs text-foreground flex items-center gap-1 font-medium">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        {r.phone}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-foreground font-medium px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-amber-500" />
                        <span>{r.branchName || "Main Branch"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-4">
                      {r.occasion ? (
                        <Badge
                          variant="outline"
                          className="text-[11px] px-2 py-0.5 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium rounded-full"
                        >
                          {r.occasion}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        <span>{r.date}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{r.time}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>{r.partySize} Guests</span>
                        {r.tableNumber && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-semibold rounded-md"
                          >
                            {r.tableNumber}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-foreground px-5 py-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.seatingArea}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-4">
                      <Select
                        value={r.status}
                        onValueChange={(val: ReservationStatus) => updateStatus(r.id, val)}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-7 text-[11px] px-2.5 font-semibold inline-flex items-center gap-1.5 border rounded-full transition-all cursor-pointer shadow-2xs focus:ring-1 focus:ring-primary/40",
                            badge.className,
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            <SelectValue>{badge.label}</SelectValue>
                          </div>
                        </SelectTrigger>
                        <SelectContent
                          align="start"
                          className="rounded-xl border border-border/80 p-1 shadow-lg"
                        >
                          {(Object.keys(statusBadges) as ReservationStatus[]).map((st) => {
                            const itemBadge = statusBadges[st];
                            const ItemIcon = itemBadge.icon;
                            return (
                              <SelectItem
                                key={st}
                                value={st}
                                className="rounded-lg text-xs font-semibold cursor-pointer py-1.5 px-2.5 my-0.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{itemBadge.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground px-5 py-4">
                      {r.specialNotes || "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase">
                            Actions
                          </DropdownMenuLabel>
                          {r.status === "pending" && (
                            <DropdownMenuItem
                              className="text-blue-600 focus:text-blue-700 cursor-pointer font-medium"
                              onClick={() => updateStatus(r.id, "confirmed")}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Reservation
                            </DropdownMenuItem>
                          )}
                          {r.status === "confirmed" && (
                            <DropdownMenuItem
                              className="text-amber-600 focus:text-amber-700 cursor-pointer font-medium"
                              onClick={() => updateStatus(r.id, "seated")}
                            >
                              <Armchair className="mr-2 h-4 w-4" /> Seat Guest
                            </DropdownMenuItem>
                          )}
                          {r.status === "seated" && (
                            <DropdownMenuItem
                              className="text-emerald-600 focus:text-emerald-700 cursor-pointer font-medium"
                              onClick={() => updateStatus(r.id, "completed")}
                            >
                              <Utensils className="mr-2 h-4 w-4" /> Mark Completed
                            </DropdownMenuItem>
                          )}
                          {r.status !== "cancelled" && r.status !== "completed" && (
                            <DropdownMenuItem
                              className="text-amber-700 dark:text-amber-400 focus:text-amber-800 cursor-pointer"
                              onClick={() => updateStatus(r.id, "cancelled")}
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Cancel Booking
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleOpenEdit(r)}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit Booking
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer font-medium"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Table Footer */}
        <div className="p-4 px-6 border-t border-border/50 bg-white dark:bg-card flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div>
            Showing {filtered.length} of {reservations.length} bookings
          </div>
        </div>
      </div>

      {/* Edit / Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing?.id ? `Edit ${editing.id}` : "New Reservation"}</SheetTitle>
          </SheetHeader>

          {editing && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="res-name">Guest Name *</Label>
                <Input
                  id="res-name"
                  value={editing.guestName}
                  onChange={(e) => setEditing({ ...editing, guestName: e.target.value })}
                  placeholder="e.g. Sophia Martinez"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="res-phone">Phone Number *</Label>
                  <Input
                    id="res-phone"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-party">Party Size</Label>
                  <Input
                    id="res-party"
                    type="number"
                    min={1}
                    max={30}
                    value={editing.partySize}
                    onChange={(e) =>
                      setEditing({ ...editing, partySize: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="res-email">Guest Email</Label>
                <Input
                  id="res-email"
                  type="email"
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="guest@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <ModernDatePicker
                    value={editing.date}
                    onChange={(val) => setEditing({ ...editing, date: val })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Time Slot</Label>
                  <ModernTimePicker
                    value={editing.time}
                    onChange={(val) => setEditing({ ...editing, time: val })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Branch</Label>
                {!isGlobalOwner && staffBranchName ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-neutral-200/80 bg-muted/40 px-3 text-xs font-semibold text-foreground">
                    <Building2 className="h-3.5 w-3.5 text-amber-600" />
                    <span>{staffBranchName}</span>
                  </div>
                ) : (
                  <Select
                    value={editing.branchName || (branches[0]?.name ?? "Main Branch")}
                    onValueChange={(val) => {
                      const bObj = branches.find((b) => b.name === val || b.id === val);
                      setEditing({
                        ...editing,
                        branchName: bObj?.name || val,
                        branchId: bObj?.id || editing.branchId,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches.length > 0 ? branches : [{ id: "main", name: "Main Branch" }]).map(
                        (b) => (
                          <SelectItem key={b.id} value={b.name}>
                            {b.name}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Seating Area</Label>
                  <Select
                    value={editing.seatingArea}
                    onValueChange={(val) => setEditing({ ...editing, seatingArea: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEATING_AREAS.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-table">Table Number</Label>
                  <Input
                    id="res-table"
                    value={editing.tableNumber ?? ""}
                    onChange={(e) => setEditing({ ...editing, tableNumber: e.target.value })}
                    placeholder="e.g. T-04"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Booking Status</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(val) =>
                      setEditing({ ...editing, status: val as ReservationStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="seated">Seated</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="res-occasion">Occasion</Label>
                  <Input
                    id="res-occasion"
                    value={editing.occasion ?? ""}
                    onChange={(e) => setEditing({ ...editing, occasion: e.target.value })}
                    placeholder="e.g. Birthday, Anniversary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="res-notes">Special Notes</Label>
                <Textarea
                  id="res-notes"
                  rows={3}
                  value={editing.specialNotes ?? ""}
                  onChange={(e) => setEditing({ ...editing, specialNotes: e.target.value })}
                  placeholder="Dietary requests, seating preferences, high chairs..."
                />
              </div>
            </div>
          )}

          <SheetFooter className="mt-6 border-t border-border/60 pt-4">
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button className="gradient-warm text-primary-foreground" onClick={handleSave}>
              Save Booking
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the booking record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
