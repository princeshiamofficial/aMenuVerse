import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Crown,
  Building2,
  UtensilsCrossed,
  ConciergeBell,
  UserCheck,
  MoreHorizontal,
  Mail,
  Shield,
  Receipt,
  CalendarDays,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminContext } from "@/lib/admin-context";
import {
  saveAdminUserAccountServer,
  getAdminUsersServer,
  deleteAdminUserAccountServer,
} from "@/lib/db-queries.server";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/users")({
  component: UsersComponent,
});

export interface UserRoleAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: "Super Admin" | "Owner" | "Manager" | "Cashier" | "Chef" | "Waiter" | "Host";
  restaurantName?: string;
  restaurantLogo?: string;
  branchName?: string;
  status: "active" | "invited" | "suspended";
  lastActive: string;
  joinedDate?: string;
}

const INITIAL_USERS: UserRoleAccount[] = [
  {
    id: "u-101",
    name: "System Admin",
    email: "admin@menuverse.app",
    phone: "+880 1700-000000",
    role: "Super Admin",
    restaurantName: "All Restaurants (Global)",
    branchName: "All Branches",
    status: "active",
    lastActive: "Just now",
  },
  {
    id: "u-102",
    name: "Tariqul Islam",
    email: "tariqul@burgercraft.com",
    phone: "+880 1711-223344",
    role: "Owner",
    restaurantName: "Burger Craft Lab",
    branchName: "Dhanmondi Branch",
    status: "active",
    lastActive: "15m ago",
  },
  {
    id: "u-103",
    name: "Sabrina Rahman",
    email: "sabrina@burgercraft.com",
    phone: "+880 1812-345678",
    role: "Manager",
    restaurantName: "Burger Craft Lab",
    branchName: "Gulshan Branch",
    status: "active",
    lastActive: "1h ago",
  },
  {
    id: "u-104",
    name: "Tamanna Akter",
    email: "cashier@burgercraft.com",
    phone: "+880 1913-456789",
    role: "Cashier",
    restaurantName: "Burger Craft Lab",
    branchName: "Counter 1",
    status: "active",
    lastActive: "10m ago",
  },
  {
    id: "u-105",
    name: "Cheful Islam",
    email: "chef@burgercraft.com",
    phone: "+880 1714-567890",
    role: "Chef",
    restaurantName: "Burger Craft Lab",
    branchName: "Kitchen Line A",
    status: "active",
    lastActive: "40m ago",
  },
  {
    id: "u-106",
    name: "Rakib Hassan",
    email: "waiter.rakib@burgercraft.com",
    phone: "+880 1815-678901",
    role: "Waiter",
    restaurantName: "Burger Craft Lab",
    branchName: "Floor 1 Tables",
    status: "active",
    lastActive: "3m ago",
  },
  {
    id: "u-107",
    name: "Nadia Islam",
    email: "host.nadia@burgercraft.com",
    phone: "+880 1916-789012",
    role: "Host",
    restaurantName: "Burger Craft Lab",
    branchName: "Front Desk",
    status: "active",
    lastActive: "25m ago",
  },
  {
    id: "u-108",
    name: "Mehan Ahmed",
    email: "mehan@gmail.com",
    phone: "+880 1718-990011",
    role: "Owner",
    restaurantName: "Mehnur Food Gallery",
    branchName: "Main Branch",
    status: "active",
    lastActive: "Just now",
  },
];

function getRoleBadge(role: UserRoleAccount["role"]) {
  switch (role) {
    case "Super Admin":
      return (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
          <Crown className="h-3 w-3" /> Super Admin
        </Badge>
      );
    case "Owner":
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
          <Building2 className="h-3 w-3" /> Owner
        </Badge>
      );
    case "Manager":
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          <Shield className="h-3 w-3" /> Manager
        </Badge>
      );
    case "Cashier":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
          <Receipt className="h-3 w-3" /> Cashier
        </Badge>
      );
    case "Chef":
      return (
        <Badge className="bg-orange-600 hover:bg-orange-700 text-white gap-1">
          <UtensilsCrossed className="h-3 w-3" /> Chef
        </Badge>
      );
    case "Waiter":
      return (
        <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1">
          <ConciergeBell className="h-3 w-3" /> Waiter
        </Badge>
      );
    case "Host":
      return (
        <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1">
          <CalendarDays className="h-3 w-3" /> Host
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <UserCheck className="h-3 w-3" /> Customer
        </Badge>
      );
  }
}

function UsersComponent() {
  const { restaurantsList } = useAdminContext();
  const [users, setUsers] = useState<UserRoleAccount[]>(INITIAL_USERS);
  const [activeTab, setActiveTab] = useState<string>("system-users");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [wsQuery, setWsQuery] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserRoleAccount> | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const rows = await getAdminUsersServer();
        if (rows && rows.length > 0) {
          setUsers(rows);
        }
      } catch (err) {
        console.warn("Failed to load real DB admin users:", err);
      }
    }
    loadUsers();
  }, []);

  const systemUsers = useMemo(() => {
    const search = q.toLowerCase().trim();
    return users.filter((u) => {
      const matchQuery =
        !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
      const matchRole = roleFilter === "all" ? true : u.role === roleFilter;
      return matchQuery && matchRole;
    });
  }, [users, q, roleFilter]);

  const workspaceUsers = useMemo(() => {
    const search = wsQuery.toLowerCase().trim();
    return users.filter((u) => {
      const isOwner = u.role === "Owner";
      const matchQuery =
        !search ||
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        (u.restaurantName && u.restaurantName.toLowerCase().includes(search));
      return isOwner && matchQuery;
    });
  }, [users, wsQuery]);

  const handleSaveUser = async () => {
    if (!editingUser?.name || !editingUser.email) {
      toast.error("Name and email are required.");
      return;
    }

    if (editingUser.password || confirmPassword) {
      if (editingUser.password !== confirmPassword) {
        toast.error("Passwords do not match. Please re-enter passwords to confirm.");
        return;
      }
    }

    try {
      await saveAdminUserAccountServer({
        data: {
          id: editingUser.id,
          name: editingUser.name,
          email: editingUser.email,
          password: editingUser.password,
          role: editingUser.role || "Owner",
          restaurantName: editingUser.restaurantName,
          branchName: editingUser.branchName || "Main Branch",
        },
      });

      // Reload clean MySQL users
      const fresh = await getAdminUsersServer();
      if (fresh && fresh.length > 0) {
        setUsers(fresh);
      } else if (editingUser.id) {
        setUsers((prev) =>
          prev.map((item) => (item.id === editingUser.id ? (editingUser as UserRoleAccount) : item)),
        );
      }
      toast.success(`Saved account & assigned role for ${editingUser.name}`);
    } catch (err) {
      console.warn("Failed to persist user account in DB:", err);
      toast.error("Failed to save user in database");
    }

    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddUserOpen(false);
  };

  const handleRevokeUser = async (u: UserRoleAccount) => {
    try {
      await deleteAdminUserAccountServer({ data: { id: u.id } });
      setUsers((list) => list.filter((item) => item.id !== u.id));
      toast.success(`Revoked access for ${u.name}`);
    } catch (err) {
      setUsers((list) => list.filter((item) => item.id !== u.id));
      toast.success(`Revoked access for ${u.name}`);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="system-users">System Users</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        {/* ── TAB: System Users ── */}
        <TabsContent value="system-users">
          <section className="glass rounded-2xl p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative min-w-55 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search system users by name or email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">System Users (All)</SelectItem>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Cashier">Cashier</SelectItem>
                  <SelectItem value="Chef">Chef</SelectItem>
                  <SelectItem value="Waiter">Waiter</SelectItem>
                  <SelectItem value="Host">Host</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  setEditingUser({
                    role: "Super Admin",
                    restaurantName: "All Restaurants (Global)",
                    branchName: "All Branches",
                  });
                  setIsAddUserOpen(true);
                }}
                className="gradient-warm text-primary-foreground gap-1.5 shadow-elegant shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add System User
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned Restaurant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{u.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {u.restaurantName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === "active" ? "outline" : "secondary"}>
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastActive}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser({ ...u });
                                setIsAddUserOpen(true);
                              }}
                            >
                              Edit Role & Workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                toast.success(`Resent invitation link to ${u.email}`);
                              }}
                            >
                              <Mail className="mr-2 h-4 w-4 text-blue-500" /> Resend Invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRevokeUser(u)}
                              className="text-rose-600 dark:text-rose-400"
                            >
                              Revoke Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {systemUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No matching system users or platform admins found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        {/* ── TAB: Workspace ── */}
        <TabsContent value="workspace">
          <section className="glass rounded-2xl p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative min-w-55 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search restaurant owners by name, email, or restaurant…"
                  value={wsQuery}
                  onChange={(e) => setWsQuery(e.target.value)}
                />
              </div>

              <Button
                onClick={() => {
                  setEditingUser({
                    role: "Owner",
                    restaurantName:
                      (restaurantsList as Array<{ name: string }>)[0]?.name || "Burger Craft Lab",
                    branchName: "Main Branch",
                  });
                  setIsAddUserOpen(true);
                }}
                className="gradient-warm text-primary-foreground gap-1.5 shadow-elegant shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Restaurant Owner
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Owner Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaceUsers.map((u) => {
                    const restMatch = restaurantsList.find(
                      (r) =>
                        r.name.toLowerCase() === (u.restaurantName || "").toLowerCase() ||
                        r.username.toLowerCase() === (u.restaurantName || "").toLowerCase(),
                    );
                    const restLogo = restMatch as Record<string, unknown> | undefined;
                    const logoUrl =
                      u.restaurantLogo ||
                      restMatch?.logoImage ||
                      (typeof restLogo?.logo === "string" && restLogo.logo.startsWith("http")
                        ? restLogo.logo
                        : null) ||
                      (u.restaurantName?.toLowerCase().includes("burger")
                        ? "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&auto=format&fit=crop&q=80"
                        : u.restaurantName?.toLowerCase().includes("sultan")
                          ? "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&auto=format&fit=crop&q=80"
                          : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120&auto=format&fit=crop&q=80");
                    const logoLetter = (u.restaurantName || "R").charAt(0).toUpperCase();

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={u.restaurantName || "Restaurant"}
                                className="h-8 w-8 rounded-full object-cover border border-border/60 shadow-xs shrink-0"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-xs font-bold text-white shadow-xs shrink-0">
                                {logoLetter}
                              </div>
                            )}
                            <span className="font-semibold text-sm text-foreground truncate">
                              {u.restaurantName || "Unassigned"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.phone || "+880 1711-223344"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.lastActive}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "outline" : "secondary"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser({ ...u });
                                  setIsAddUserOpen(true);
                                }}
                              >
                                Edit Role & Workspace
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  toast.success(`Resent invitation link to ${u.email}`);
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4 text-blue-500" /> Resend Invite
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRevokeUser(u)}
                                className="text-rose-600 dark:text-rose-400"
                              >
                                Revoke Access
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {workspaceUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No matching restaurant owners found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Role Modal */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser?.id ? "Edit User Role" : "Assign New User Role"}</DialogTitle>
            <DialogDescription>
              Grant access permissions to staff, managers, chefs, or platform owners.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="uname">Full Name</Label>
                <Input
                  id="uname"
                  autoComplete="off"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="e.g. Mehan Ahmed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uemail">Email Address</Label>
                  <Input
                    id="uemail"
                    type="email"
                    autoComplete="off"
                    value={editingUser.email || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="e.g. mehan@restaurant.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uphone">Phone Number</Label>
                  <Input
                    id="uphone"
                    type="tel"
                    autoComplete="off"
                    value={editingUser.phone || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    placeholder="e.g. +880 1711-223344"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="upassword">Enter Password</Label>
                  <div className="relative">
                    <Input
                      id="upassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={editingUser.password || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      placeholder={editingUser.id ? "Keep existing" : "Set login password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uconfirmpassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="uconfirmpassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assigned Role</Label>
                  <Select
                    value={editingUser.role || "Owner"}
                    onValueChange={(v: UserRoleAccount["role"]) =>
                      setEditingUser({ ...editingUser, role: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Super Admin">Super Admin (Global)</SelectItem>
                      <SelectItem value="Owner">Owner (Tenant Admin)</SelectItem>
                      <SelectItem value="Manager">Manager (Branch Ops)</SelectItem>
                      <SelectItem value="Cashier">Cashier (POS Billing)</SelectItem>
                      <SelectItem value="Chef">Chef (KDS Kitchen)</SelectItem>
                      <SelectItem value="Waiter">Waiter (Table Service)</SelectItem>
                      <SelectItem value="Host">Host (Reservations)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editingUser.role !== "Super Admin" && (
                  <div className="space-y-2">
                    <Label>Assigned Restaurant</Label>
                    <Select
                      value={
                        editingUser.restaurantName || restaurantsList[0]?.name || "Burger Craft Lab"
                      }
                      onValueChange={(v) => setEditingUser({ ...editingUser, restaurantName: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select restaurant" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          restaurantsList as Array<{ id: string; name: string; cuisine?: string }>
                        ).map((r) => (
                          <SelectItem key={r.id} value={r.name}>
                            {r.name} {r.cuisine ? `(${r.cuisine})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="gradient-warm text-primary-foreground">
              Save Role Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
