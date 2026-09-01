"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  getCurrentUser,
  getBranchesServer,
  getStaffServer,
  saveStaffServer,
  deleteStaffServer,
  updateStaffAvatarServer,
} from "@/lib/db-queries.server";
import { SkeletonStaff } from "@/components/menuverse/skeletons";
import { BlobImg } from "@/components/ui/blob-img";
import { uploadToImgBB } from "@/lib/imgbb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateDropdownPicker } from "@/components/menuverse/date-dropdown-picker";
import { SetAvatarDialog } from "@/components/menuverse/set-avatar-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  ChefHat,
  ConciergeBell,
  Building2,
  Clock,
  UserX,
  ShieldCheck,
  Eye,
  EyeOff,
  Receipt,
  Camera,
  KeyRound,
  UserCog,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, generateId } from "@/lib/utils";

type StaffRole = "Owner" | "Manager" | "Cashier" | "Chef" | "Waiter" | "Host";
type StaffStatus = "active" | "on-leave" | "suspended";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: StaffRole;
  branch: string;
  status: StaffStatus;
  shift: string;
  joinDate: string;
  avatarUrl?: string;
}

const SHIFTS = ["Morning (6AM–2PM)", "Afternoon (2PM–10PM)", "Night (10PM–6AM)", "Full Day"];

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
];

const INITIAL_STAFF: StaffMember[] = [
  {
    id: generateId(),
    name: "Tariqul Islam",
    email: "tariqul@burgercraft.com",
    phone: "+880 1700-112233",
    password: "staff1234",
    role: "Owner",
    branch: "All Branches",
    status: "active",
    shift: "Full Day",
    joinDate: "Jan 2024",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: generateId(),
    name: "Sabrina Rahman",
    email: "sabrina@burgercraft.com",
    phone: "+880 1712-001122",
    password: "staff1234",
    role: "Manager",
    branch: "Gulshan Branch",
    status: "active",
    shift: "Full Day",
    joinDate: "Jan 2024",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: generateId(),
    name: "Arif Chowdhury",
    email: "arif.chef@burgercraft.com",
    phone: "+880 1812-334455",
    password: "staff1234",
    role: "Chef",
    branch: "Dhanmondi Branch",
    status: "active",
    shift: "Morning (6AM–2PM)",
    joinDate: "Mar 2024",
  },
  {
    id: generateId(),
    name: "Tamanna Akter",
    email: "tamanna.cashier@burgercraft.com",
    phone: "+880 1912-556677",
    password: "staff1234",
    role: "Cashier",
    branch: "Dhanmondi Branch",
    status: "active",
    shift: "Afternoon (2PM–10PM)",
    joinDate: "May 2024",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: generateId(),
    name: "Rakib Hassan",
    email: "rakib.waiter@burgercraft.com",
    phone: "+880 1612-778899",
    password: "staff1234",
    role: "Waiter",
    branch: "Dhanmondi Branch",
    status: "active",
    shift: "Afternoon (2PM–10PM)",
    joinDate: "Jun 2024",
  },
  {
    id: generateId(),
    name: "Nadia Islam",
    email: "nadia.host@burgercraft.com",
    phone: "+880 1512-990011",
    password: "staff1234",
    role: "Host",
    branch: "Gulshan Branch",
    status: "active",
    shift: "Morning (6AM–2PM)",
    joinDate: "Apr 2024",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
];

const ROLE_CONFIG: Record<StaffRole, { color: string; bg: string; icon: React.ElementType }> = {
  Owner: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: Building2,
  },
  Manager: {
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: ShieldCheck,
  },
  Cashier: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: Receipt,
  },
  Chef: {
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: ChefHat,
  },
  Waiter: {
    color: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/30",
    icon: ConciergeBell,
  },
  Host: {
    color: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    icon: Users,
  },
};

const STATUS_CONFIG: Record<StaffStatus, { badge: string; dot: string; label: string }> = {
  active: {
    badge: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Active",
  },
  "on-leave": {
    badge: "text-amber-700 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    label: "On Leave",
  },
  suspended: {
    badge: "text-red-700 bg-red-50 border-red-200",
    dot: "bg-red-500",
    label: "Suspended",
  },
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-orange-500 to-red-500",
  "from-teal-500 to-emerald-600",
  "from-sky-500 to-blue-600",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
];

function getInitials(name?: string | null) {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

const EMPTY_FORM: Omit<StaffMember, "id"> = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "Waiter",
  branch: "",
  status: "active",
  shift: SHIFTS[0],
  joinDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
};

interface StaffFormProps {
  form: Omit<StaffMember, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<StaffMember, "id">>>;
  editTarget: StaffMember | null;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  branches: Array<{ id: string; name: string }>;
  isManager: boolean;
  managerBranchName: string | null;
}

function StaffForm({
  form,
  setForm,
  editTarget,
  showPassword,
  setShowPassword,
  branches,
  isManager,
  managerBranchName,
}: StaffFormProps) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Full Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Rafiq Ahmed"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+880 1X00-000000"
            className="text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Email Address *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="staff@burgercraft.com"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">
            Password {editTarget ? "(leave blank to keep)" : "*"}
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editTarget ? "••••••••" : "Min. 6 characters"}
              autoComplete="new-password"
              className="text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Role</Label>
          <Select
            value={form.role}
            onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}
          >
            <SelectTrigger className="text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!isManager && <SelectItem value="Owner">Owner</SelectItem>}
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Cashier">Cashier</SelectItem>
              <SelectItem value="Chef">Chef</SelectItem>
              <SelectItem value="Waiter">Waiter</SelectItem>
              <SelectItem value="Host">Host</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Branch *</Label>
          {isManager && managerBranchName ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-neutral-200/80 bg-muted/40 px-3 text-xs font-semibold text-foreground">
              <Building2 className="h-3.5 w-3.5 text-amber-600" />
              <span>{managerBranchName}</span>
            </div>
          ) : (
            <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
              <SelectTrigger className="text-sm cursor-pointer">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id || b.name} value={b.id || b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Shift</Label>
          <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
            <SelectTrigger className="text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFTS.map((sh) => (
                <SelectItem key={sh} value={sh}>
                  {sh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-700">Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as StaffStatus })}
          >
            <SelectTrigger className="text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on-leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-3">
          <Label className="text-xs font-bold text-gray-700">
            Joined Date (Day / Month / Year)
          </Label>
          <DateDropdownPicker
            value={form.joinDate || ""}
            onChange={(val) => setForm({ ...form, joinDate: val })}
          />
        </div>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [currentUser, setCurrentUser] = useState<{
    role: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [branchesList, setBranchesList] = useState<
    Array<{ id: string; name: string; manager?: string; isDefault?: boolean }>
  >([]);
  const [search, setSearch] = useState("");

  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [avatarTarget, setAvatarTarget] = useState<StaffMember | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [changePasswordTarget, setChangePasswordTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [changeRoleTarget, setChangeRoleTarget] = useState<StaffMember | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("Waiter");

  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<Omit<StaffMember, "id">>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const userRole = (currentUser?.role || "owner").toLowerCase().trim().replace(/ /g, "_");
  const isGlobalOwner =
    userRole === "super_admin" || userRole === "superadmin" || userRole === "owner";
  const isManager = !isGlobalOwner;

  const managerBranchName = useMemo(() => {
    if (!isManager) return null;
    if (currentUser?.branch) {
      const bClean = currentUser.branch
        .replace(/\s*\((Manager|Owner|Cashier|Chef|Waiter|Host)\)/gi, "")
        .trim();
      if (bClean) return bClean;
    }
    const uName = (currentUser?.full_name || "").toLowerCase().trim();
    if (uName && branchesList.length > 0) {
      const matched = branchesList.find((b) => {
        const mClean = (b.manager || "")
          .replace(/\s*\([^)]*\)/g, "")
          .toLowerCase()
          .trim();
        return mClean && (mClean === uName || mClean.includes(uName) || uName.includes(mClean));
      });
      if (matched) return matched.name;
    }
    return branchesList[0]?.name || "Main Branch";
  }, [isManager, currentUser, branchesList]);

  const dynamicBranches = useMemo(() => {
    if (branchesList.length > 0) {
      return branchesList.map((b) => b.name);
    }
    return ["Main Branch"];
  }, [branchesList]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const map = new Map<string, StaffMember>();
    staff.forEach((s) => {
      const sRoleLower = (s.role || "").toLowerCase().trim();
      const sEmailLower = (s.email || "").toLowerCase().trim();
      if (
        sRoleLower === "super_admin" ||
        sRoleLower === "superadmin" ||
        sEmailLower === "admin@menuverse.app"
      ) {
        return;
      }
      if (isManager && (s.role === "Owner" || sRoleLower === "owner")) {
        return;
      }
      const matchSearch =
        !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchRole = filterRole === "all" || s.role === filterRole;

      let matchBranch = true;
      if (isManager && managerBranchName) {
        const mbLower = managerBranchName.toLowerCase().trim();
        const sBranchLower = (s.branch || "").toLowerCase().trim();
        const isDef =
          branchesList[0]?.name.toLowerCase().trim() === mbLower ||
          branchesList.find((b) => b.name.toLowerCase().trim() === mbLower)?.isDefault;
        if (isDef) {
          matchBranch =
            sBranchLower === mbLower ||
            sBranchLower.includes(mbLower) ||
            mbLower.includes(sBranchLower) ||
            sBranchLower === "main branch" ||
            sBranchLower === "" ||
            !s.branch;
        } else {
          matchBranch =
            sBranchLower === mbLower ||
            sBranchLower.includes(mbLower) ||
            mbLower.includes(sBranchLower);
        }
      } else if (filterBranch !== "all") {
        const fbLower = filterBranch.toLowerCase().trim();
        const sBranchLower = (s.branch || "").toLowerCase().trim();
        matchBranch =
          sBranchLower === fbLower ||
          s.branch === filterBranch ||
          branchesList.some(
            (b) =>
              (b.id.toLowerCase() === fbLower || b.name.toLowerCase() === fbLower) &&
              (b.id.toLowerCase() === sBranchLower || b.name.toLowerCase() === sBranchLower),
          );
      }

      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      if (matchSearch && matchRole && matchBranch && matchStatus) {
        const key = (s.email || s.id).toLowerCase().trim();
        if (!map.has(key)) map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [
    staff,
    search,
    filterRole,
    filterBranch,
    filterStatus,
    isManager,
    managerBranchName,
    branchesList,
  ]);

  const isOwnerAccount = (member: StaffMember | null) => {
    if (!member) return false;
    return member.role === "Owner";
  };

  const openAdd = () => {
    const defaultBranch =
      isManager && managerBranchName
        ? branchesList.find(
            (b) => b.name.toLowerCase().trim() === managerBranchName.toLowerCase().trim(),
          )?.id || managerBranchName
        : filterBranch !== "all"
          ? filterBranch
          : branchesList[0]?.id || "Main Branch";
    setForm({ ...EMPTY_FORM, branch: defaultBranch });
    setIsAddOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    if (isOwnerAccount(member)) {
      toast.error("Owner info cannot be edited.");
      return;
    }
    setEditTarget(member);
    const { id: _id, ...rest } = member;
    setForm(rest);
  };

  const openSetAvatar = (member: StaffMember) => {
    setAvatarTarget(member);
    setAvatarUrlInput(member.avatarUrl || "");
  };

  const openChangePassword = (member: StaffMember) => {
    if (isOwnerAccount(member)) {
      toast.error("Owner password cannot be changed.");
      return;
    }
    setChangePasswordTarget(member);
    setNewPassword("");
    setShowNewPassword(false);
  };

  const openChangeRole = (member: StaffMember) => {
    setChangeRoleTarget(member);
    setNewRole(member.role);
  };

  useEffect(() => {
    async function loadStaffAndBranches() {
      let loggedUser: {
        role: string | null;
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
        const brs = await getBranchesServer({ data: {} });
        if (brs && Array.isArray(brs)) {
          setBranchesList(
            brs as Array<{ id: string; name: string; manager?: string; isDefault?: boolean }>,
          );

          if (loggedUser) {
            const rClean = (loggedUser.role || "").toLowerCase().trim();
            const isOwnerRole =
              rClean === "super_admin" || rClean === "superadmin" || rClean === "owner";
            if (!isOwnerRole) {
              const uName = (loggedUser.full_name || "").toLowerCase().trim();
              const managedBranch = (
                brs as Array<{ id: string; name: string; manager?: string }>
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
                setCurrentUser({ ...loggedUser, branch: managedBranch.name });
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbStaff = (await getStaffServer({ data: {} })) as StaffMember[];
        if (dbStaff && Array.isArray(dbStaff) && dbStaff.length > 0) {
          const map = new Map<string, StaffMember>();
          dbStaff.forEach((s) => {
            const key = (s.email || s.id).toLowerCase().trim();
            if (!map.has(key)) map.set(key, s);
          });
          setStaff(Array.from(map.values()));
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadStaffAndBranches();
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(async () => {
      try {
        const effectiveBranch =
          isManager && managerBranchName
            ? managerBranchName
            : filterBranch !== "all"
              ? filterBranch
              : undefined;

        const dbStaff = (await getStaffServer({
          data: {
            branch: effectiveBranch,
            role: filterRole !== "all" ? filterRole : undefined,
            status: filterStatus !== "all" ? filterStatus : undefined,
            search: search.trim() || undefined,
          },
        })) as StaffMember[];

        if (dbStaff && Array.isArray(dbStaff)) {
          const map = new Map<string, StaffMember>();
          dbStaff.forEach((s) => {
            const key = (s.email || s.id).toLowerCase().trim();
            if (!map.has(key)) map.set(key, s);
          });
          setStaff(Array.from(map.values()));
        }
      } catch (err) {
        console.warn("[Staff] Server fetch error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [loading, filterBranch, filterRole, filterStatus, search, isManager, managerBranchName]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    const currentPass = (form.password || "").trim();
    if (!editTarget && !currentPass) {
      toast.error("Password is required for new staff.");
      return;
    }
    if (currentPass && currentPass.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    const memberToSave: StaffMember = editTarget
      ? { ...editTarget, ...form }
      : { id: generateId(), ...form };

    if (editTarget && !currentPass) {
      memberToSave.password = editTarget.password || "";
    }

    try {
      await saveStaffServer({
        data: memberToSave as unknown as Parameters<typeof saveStaffServer>[0]["data"],
      });

      if (editTarget) {
        setStaff((prev) => prev.map((s) => (s.id === editTarget.id ? memberToSave : s)));
        toast.success(`${form.name}'s profile updated!`);
        setEditTarget(null);
      } else {
        setStaff((prev) => [memberToSave, ...prev]);
        toast.success(`${form.name} added to staff!`);
        setIsAddOpen(false);
      }
      setForm(EMPTY_FORM);
      setShowPassword(false);
    } catch (err: unknown) {
      console.error("saveStaffServer error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to save staff info in database. Please check your input and try again.";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (isOwnerAccount(deleteTarget)) {
      toast.error("Owner accounts cannot be edited or deleted.");
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteStaffServer({ data: deleteTarget.id });
    } catch {
      /* ignore */
    }
    setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    toast.success(`Removed ${deleteTarget.name} from staff directory.`);
    setDeleteTarget(null);
  };

  if (loading) {
    return <SkeletonStaff />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs font-normal h-9 bg-white dark:bg-card border-neutral-200/80 dark:border-border/60 hover:border-neutral-300 text-gray-900 dark:text-foreground placeholder:text-gray-400 shadow-2xs rounded-md focus-visible:ring-2 focus-visible:ring-neutral-400/20"
          />
        </div>

        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-9 text-xs font-normal w-40 bg-white dark:bg-card border-neutral-200/80 dark:border-border/60 hover:border-neutral-300 shadow-2xs rounded-md text-gray-900 dark:text-foreground cursor-pointer">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="rounded-md">
            <SelectItem value="all">All Roles</SelectItem>
            {!isManager && <SelectItem value="Owner">Owner</SelectItem>}
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Cashier">Cashier</SelectItem>
            <SelectItem value="Chef">Chef</SelectItem>
            <SelectItem value="Waiter">Waiter</SelectItem>
            <SelectItem value="Host">Host</SelectItem>
          </SelectContent>
        </Select>

        {isManager && managerBranchName ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-neutral-200/80 bg-white dark:bg-card px-3 text-xs font-semibold text-foreground shadow-2xs">
            <Building2 className="h-3.5 w-3.5 text-amber-600" />
            <span>{managerBranchName}</span>
          </div>
        ) : (
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="h-9 text-xs font-normal w-44 bg-white dark:bg-card border-neutral-200/80 dark:border-border/60 hover:border-neutral-300 shadow-2xs rounded-md text-gray-900 dark:text-foreground cursor-pointer">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all">All Branches</SelectItem>
              {branchesList.map((b) => (
                <SelectItem key={b.id || b.name} value={b.id || b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 text-xs font-normal w-36 bg-white dark:bg-card border-neutral-200/80 dark:border-border/60 hover:border-neutral-300 shadow-2xs rounded-md text-gray-900 dark:text-foreground cursor-pointer">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="rounded-md">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-leave">On Leave</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        {(search || filterRole !== "all" || filterBranch !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-gray-500 rounded-md px-3 cursor-pointer"
            onClick={() => {
              setSearch("");
              setFilterRole("all");
              setFilterBranch("all");
              setFilterStatus("all");
            }}
          >
            Reset Filters
          </Button>
        )}

        <Button
          onClick={openAdd}
          size="sm"
          className="bg-linear-to-r from-[#D77649] via-[#CB6C3F] to-[#B85C31] hover:from-[#C9693D] hover:to-[#A74E26] text-white shadow-md shadow-amber-900/10 h-9 rounded-md px-5 text-xs font-medium tracking-wide flex items-center gap-1.5 shrink-0 ml-auto transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-white" /> Add Staff Member
        </Button>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/70 border-b border-gray-100 hover:bg-gray-50/70">
              <TableHead className="pl-5 text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Staff Member
              </TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Role
              </TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Branch
              </TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Shift
              </TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Status
              </TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Joined
              </TableHead>
              <TableHead className="pr-5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider py-3.5">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex flex-col items-center gap-3 py-14 text-center">
                    <div className="p-4 rounded-full bg-gray-100">
                      <UserX className="h-7 w-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-bold text-gray-500">No staff members found</p>
                    <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => {
                const roleConf = ROLE_CONFIG[member.role] || ROLE_CONFIG["Waiter"];
                const statusConf = STATUS_CONFIG[member.status] || STATUS_CONFIG["active"];
                const RoleIcon = roleConf.icon;

                return (
                  <TableRow key={member.id} className="hover:bg-gray-50/60 group transition-colors">
                    {/* Staff Member */}
                    <TableCell className="pl-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          <BlobImg
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-9 w-9 rounded-full object-cover shrink-0 ring-2 ring-gray-100 shadow-xs"
                          />
                        ) : (
                          <div
                            className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 bg-linear-to-br shadow-xs ring-2 ring-gray-100",
                              getGradient(member.name),
                            )}
                          >
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-gray-900 leading-tight">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                            {member.email}
                          </p>
                          {member.phone && (
                            <p className="text-[11px] text-gray-400 font-medium">{member.phone}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                          roleConf.bg,
                          roleConf.color,
                        )}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {member.role}
                      </span>
                    </TableCell>

                    {/* Branch */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {(() => {
                          const match = branchesList.find(
                            (b) => b.id === member.branch || b.name === member.branch,
                          );
                          return match ? match.name : member.branch || "Main Branch";
                        })()}
                      </div>
                    </TableCell>

                    {/* Shift */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {member.shift}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                          statusConf.badge,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusConf.dot)} />
                        {statusConf.label}
                      </span>
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="py-3.5">
                      <span className="text-xs text-gray-500 font-semibold">{member.joinDate}</span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 pr-5 text-right">
                      {(() => {
                        const isOwner = isOwnerAccount(member);
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 p-1.5 shadow-xl rounded-xl border border-gray-100 bg-white"
                            >
                              <DropdownMenuLabel className="text-[11px] font-bold tracking-wider text-gray-400 uppercase px-2 py-1">
                                {isOwner ? "Protected Owner" : "Actions"}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="my-1 bg-gray-100" />

                              <DropdownMenuItem
                                disabled={isOwner}
                                className={cn(
                                  "text-xs font-semibold gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                                  isOwner
                                    ? "opacity-40 cursor-not-allowed text-gray-400"
                                    : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                                )}
                                onClick={() => openEdit(member)}
                              >
                                <Pencil className="h-4 w-4 text-gray-500" />
                                Edit Info
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="text-xs font-semibold cursor-pointer gap-2.5 px-2.5 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                onClick={() => openSetAvatar(member)}
                              >
                                <Camera className="h-4 w-4 text-gray-500" />
                                Set Avatar
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                disabled={isOwner}
                                className={cn(
                                  "text-xs font-semibold gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                                  isOwner
                                    ? "opacity-40 cursor-not-allowed text-gray-400"
                                    : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                                )}
                                onClick={() => openChangePassword(member)}
                              >
                                <KeyRound className="h-4 w-4 text-gray-500" />
                                Change Password
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="text-xs font-semibold cursor-pointer gap-2.5 px-2.5 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                onClick={() => openChangeRole(member)}
                              >
                                <UserCog className="h-4 w-4 text-gray-500" />
                                Change Role
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1 bg-gray-100" />

                              <DropdownMenuItem
                                disabled={isOwner}
                                className={cn(
                                  "text-xs font-semibold gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                                  isOwner
                                    ? "opacity-40 cursor-not-allowed text-gray-400"
                                    : "cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 focus:text-red-600",
                                )}
                                onClick={() => {
                                  if (isOwner) {
                                    toast.error("Owner accounts cannot be edited or deleted.");
                                    return;
                                  }
                                  setDeleteTarget(member);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                                Delete Staff
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-teal-600" />
              Add New Staff Member
            </DialogTitle>
          </DialogHeader>
          <StaffForm
            form={form}
            setForm={setForm}
            editTarget={null}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            branches={branchesList}
            isManager={isManager}
            managerBranchName={managerBranchName}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="cursor-pointer gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4 text-amber-600" />
              Edit Info — {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <StaffForm
            form={form}
            setForm={setForm}
            editTarget={editTarget}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            branches={branchesList}
            isManager={isManager}
            managerBranchName={managerBranchName}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditTarget(null)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="cursor-pointer">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared Set Avatar Dialog */}
      <SetAvatarDialog
        open={!!avatarTarget}
        onOpenChange={(o) => !o && setAvatarTarget(null)}
        name={avatarTarget?.name || ""}
        email={avatarTarget?.email}
        currentAvatarUrl={avatarTarget?.avatarUrl}
        onSave={async (newAvatarUrl) => {
          if (!avatarTarget) return;
          await updateStaffAvatarServer({
            data: { id: avatarTarget.id, avatarUrl: newAvatarUrl || "" },
          });
          setStaff((prev) =>
            prev.map((s) =>
              s.id === avatarTarget.id ? { ...s, avatarUrl: newAvatarUrl || undefined } : s,
            ),
          );
          toast.success(`Avatar updated for ${avatarTarget.name}`);
        }}
      />

      {/* Change Password Dialog */}
      <Dialog
        open={!!changePasswordTarget}
        onOpenChange={(o) => !o && setChangePasswordTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-blue-600" />
              Change Password — {changePasswordTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-bold text-gray-700">New Password *</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 chars)"
                className="text-sm pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Password must be at least 6 characters long.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangePasswordTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isUpdatingPassword}
              onClick={async () => {
                if (!changePasswordTarget) return;
                const trimmed = newPassword.trim();
                if (!trimmed || trimmed.length < 6) {
                  toast.error("Password must be at least 6 characters.");
                  return;
                }
                setIsUpdatingPassword(true);
                const updatedMember: StaffMember = {
                  ...changePasswordTarget,
                  password: trimmed,
                };
                try {
                  await saveStaffServer({
                    data: updatedMember as unknown as Parameters<typeof saveStaffServer>[0]["data"],
                  });
                  setStaff((prev) =>
                    prev.map((s) =>
                      s.id === changePasswordTarget.id ? { ...s, password: trimmed } : s,
                    ),
                  );
                  toast.success(`Password updated for ${changePasswordTarget.name}!`);
                  setChangePasswordTarget(null);
                  setNewPassword("");
                } catch (err: unknown) {
                  console.error("Failed to update staff password:", err);
                  const msg =
                    err instanceof Error
                      ? err.message
                      : "Failed to update password in database. Please try again.";
                  toast.error(msg);
                } finally {
                  setIsUpdatingPassword(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!changeRoleTarget} onOpenChange={(o) => !o && setChangeRoleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-emerald-600" />
              Change Role — {changeRoleTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-700">Assigned Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
                <SelectTrigger className="text-sm cursor-pointer h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!isManager && <SelectItem value="Owner">Owner</SelectItem>}
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Cashier">Cashier</SelectItem>
                  <SelectItem value="Chef">Chef</SelectItem>
                  <SelectItem value="Waiter">Waiter</SelectItem>
                  <SelectItem value="Host">Host</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs space-y-1">
              <p className="font-bold text-emerald-900">Role Authority Preview:</p>
              <p className="text-emerald-700">
                Assigning <span className="font-bold">{newRole}</span> grants permissions specific
                to their operational scope within the restaurant.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangeRoleTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!changeRoleTarget) return;
                const updatedMember: StaffMember = { ...changeRoleTarget, role: newRole };
                try {
                  await saveStaffServer({
                    data: updatedMember as unknown as Parameters<typeof saveStaffServer>[0]["data"],
                  });
                  setStaff((prev) =>
                    prev.map((s) => (s.id === changeRoleTarget.id ? updatedMember : s)),
                  );
                  toast.success(`Role updated to ${newRole} for ${changeRoleTarget.name}!`);
                } catch (err) {
                  console.error("Failed to update staff role:", err);
                  toast.error("Failed to update role in database. Please try again.");
                }
                setChangeRoleTarget(null);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Staff Member?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong className="text-gray-900">{deleteTarget?.name}</strong> from your staff
              directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Delete Staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
