import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useAdminContext } from "@/lib/admin-context";
import {
  getAdminRestaurantsServer,
  updateRestaurantStatusServer,
  updateRestaurantVerificationServer,
  createRestaurantServer,
  updateRestaurantDetailsServer,
  deleteRestaurantServer,
} from "@/lib/db-queries.server";
import { StatusBadge } from "../admin";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, MoreHorizontal, ExternalLink, BadgeCheck, ShieldCheck } from "lucide-react";
import { RESTAURANTS, Restaurant, Branch, MenuItem } from "@/lib/restaurants-data";
import { toast } from "sonner";

interface AdminCategory {
  name: string;
  emoji?: string;
}

interface AdminRestaurant {
  id?: string | number;
  name?: string;
  username?: string;
  cuisine?: string;
  location?: string;
  plan?: string;
  status?: string;
  mrr?: number;
  branches?: Branch[] | number;
  joined?: string;
  logo?: string;
  logoBg?: string;
  image?: string;
  logoImage?: string;
  rating?: string;
  reviews?: string;
  time?: string;
  price?: string;
  categories?: unknown;
  menuItems?: unknown;
}

export const Route = createFileRoute("/admin/restaurants")({
  component: AdminRestaurantsComponent,
});

function AdminRestaurantsComponent() {
  const { restaurantsList, setRestaurantsList } = useAdminContext();
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [editingRestaurant, setEditingRestaurant] = useState<AdminRestaurant | null>(null);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAdminRestaurantsServer();
        if (data) {
          setRestaurantsList(data as unknown as typeof restaurantsList);
        }
      } catch (err) {
        console.warn("Failed to load real MySQL admin restaurants data:", err);
      }
    }
    loadData();
  }, [setRestaurantsList]);

  const filteredRestaurants = useMemo(() => {
    return (restaurantsList || []).filter(
      (r) =>
        (planFilter === "all" || (r.plan || "").toLowerCase() === planFilter.toLowerCase()) &&
        (q.trim() === "" ||
          (r.name || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.username || "").toLowerCase().includes(q.toLowerCase())),
    );
  }, [restaurantsList, q, planFilter]);

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-55 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search restaurants…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="Free">Free</SelectItem>
              <SelectItem value="Starter">Starter</SelectItem>
              <SelectItem value="Business">Business</SelectItem>
              <SelectItem value="Enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              setEditingRestaurant({
                id: "",
                name: "",
                username: "",
                cuisine: "Gourmet Kitchen",
                location: "New York",
                plan: "Starter",
                status: "active",
                mrr: 29,
                branches: 1,
                joined: new Date().toISOString().split("T")[0],
              });
              setIsAddEditOpen(true);
            }}
            className="gradient-warm text-primary-foreground gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Restaurant
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-4">Restaurant</TableHead>
                <TableHead className="py-3 px-4">Plan</TableHead>
                <TableHead className="py-3 px-4 text-center">Verified</TableHead>
                <TableHead className="py-3 px-4 text-center">Branches</TableHead>
                <TableHead className="py-3 px-4 text-center">Categories</TableHead>
                <TableHead className="py-3 px-4 text-center">Food Items</TableHead>
                <TableHead className="py-3 px-4 text-center">Joined</TableHead>
                <TableHead className="py-3 px-4 text-center">Status</TableHead>
                <TableHead className="py-3 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.map((r) => {
                const item = r as Record<string, unknown>;
                const isVerified = r.isVerified ?? true;
                const logoUrl =
                  typeof item.logoImage === "string" && item.logoImage
                    ? item.logoImage
                    : typeof item.logo === "string" && item.logo.startsWith("http")
                      ? item.logo
                      : null;
                const logoLetter = r.name ? r.name.charAt(0).toUpperCase() : "R";
                const branchesCount =
                  typeof item.branches === "number"
                    ? item.branches
                    : Array.isArray(item.branches)
                      ? item.branches.length
                      : 0;
                const categoriesCount =
                  typeof item.categories === "number"
                    ? item.categories
                    : Array.isArray(item.categories)
                      ? item.categories.length
                      : Number(item.categoriesCount || 0);
                const foodItemsCount =
                  typeof item.foodItems === "number"
                    ? item.foodItems
                    : typeof item.menuItems === "number"
                      ? item.menuItems
                      : Array.isArray(item.menuItems)
                        ? item.menuItems.length
                        : Number(item.foodItemsCount || 0);

                return (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={r.name}
                            className="h-9 w-9 rounded-full object-cover border border-border/60 shadow-xs shrink-0"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-xs font-bold text-white shadow-xs shrink-0">
                            {logoLetter}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {r.name}
                            </p>
                            {isVerified && (
                              <BadgeCheck className="h-4 w-4 fill-blue-500 text-white shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            @{r.username || "restaurant"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="secondary" className="font-medium text-xs">
                        {r.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextState = !isVerified;
                          setRestaurantsList((list) =>
                            list.map((item) =>
                              item.id === r.id ? { ...item, isVerified: nextState } : item,
                            ),
                          );
                          try {
                            await updateRestaurantVerificationServer({
                              data: { id: r.id!, isVerified: nextState },
                            });
                          } catch {
                            /* ignore */
                          }
                          toast.success(
                            nextState
                              ? `Restaurant "${r.name}" verified badge enabled!`
                              : `Restaurant "${r.name}" verified badge disabled!`,
                          );
                        }}
                        className="cursor-pointer transition-transform active:scale-95"
                        title="Click to toggle verified status"
                      >
                        {isVerified ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 inline-flex items-center text-xs font-medium hover:bg-blue-500/20"
                          >
                            <BadgeCheck className="h-3.5 w-3.5 fill-blue-500 text-white shrink-0" />{" "}
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border-border/50 text-xs hover:bg-muted"
                          >
                            Unverified
                          </Badge>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center font-mono text-sm font-semibold">
                      {branchesCount}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center font-mono text-sm font-semibold">
                      {categoriesCount}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center font-mono text-sm font-semibold">
                      {foodItemsCount}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {r.joined}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <StatusBadge s={r.status || "active"} />
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
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
                              window.open(`/${r.username}`, "_blank");
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4 text-primary" />
                            View Digital Menu
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setEditingRestaurant({ ...r });
                              setIsAddEditOpen(true);
                            }}
                          >
                            Edit details
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={async () => {
                              const nextState = !(r.isVerified ?? true);
                              setRestaurantsList((list) =>
                                list.map((item) =>
                                  item.id === r.id ? { ...item, isVerified: nextState } : item,
                                ),
                              );
                              const token =
                                typeof window !== "undefined"
                                  ? localStorage.getItem("menuverse_session") || undefined
                                  : undefined;
                              try {
                                await updateRestaurantVerificationServer({
                                  data: { id: r.id!, isVerified: nextState },
                                });
                                toast.success(
                                  nextState
                                    ? `Restaurant "${r.name}" verified badge enabled!`
                                    : `Restaurant "${r.name}" verified badge disabled!`,
                                );
                                setRestaurantsList((list) =>
                                  list.map((item) =>
                                    item.id === r.id ? { ...item, isVerified: nextState } : item,
                                  ),
                                );
                              } catch (err: unknown) {
                                toast.error(
                                  (err as Error)?.message || "Failed to update verification badge",
                                );
                              }
                            }}
                          >
                            <BadgeCheck className="mr-2 h-4 w-4 text-blue-500" />
                            {(r.isVerified ?? true)
                              ? "Disable Verified Badge"
                              : "Enable Verified Badge"}
                          </DropdownMenuItem>
                          {r.status === "suspended" ? (
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await updateRestaurantStatusServer({
                                    data: { id: r.id!, status: "active" },
                                  });
                                } catch {
                                  /* ignore */
                                }
                                setRestaurantsList((list) =>
                                  list.map((item) =>
                                    item.id === r.id ? { ...item, status: "active" } : item,
                                  ),
                                );
                                toast.success(`Restaurant "${r.name}" has been unbanned.`);
                              }}
                              className="text-emerald-600 dark:text-emerald-400"
                            >
                              Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await updateRestaurantStatusServer({
                                    data: { id: r.id!, status: "suspended" },
                                  });
                                } catch {
                                  /* ignore */
                                }
                                setRestaurantsList((list) =>
                                  list.map((item) =>
                                    item.id === r.id ? { ...item, status: "suspended" } : item,
                                  ),
                                );
                                toast.success(`Restaurant "${r.name}" has been banned/suspended.`);
                              }}
                              className="text-amber-600 dark:text-amber-400"
                            >
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await deleteRestaurantServer({ data: { id: r.id! } });
                              } catch (err) {
                                console.warn("Failed to delete restaurant from DB:", err);
                              }
                              setRestaurantsList((list) => list.filter((item) => item.id !== r.id));
                              toast.success(
                                `Restaurant "${r.name}" deleted from platform database.`,
                              );
                            }}
                            className="text-rose-600 dark:text-rose-455"
                          >
                            Delete Workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRestaurants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No restaurants match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Create / Edit Restaurant Dialog */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRestaurant?.id ? "Edit Restaurant" : "Create Restaurant"}
            </DialogTitle>
            <DialogDescription>
              {editingRestaurant?.id
                ? "Update restaurant information and active configuration."
                : "Register a new restaurant workspace on the platform."}
            </DialogDescription>
          </DialogHeader>

          {editingRestaurant && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="rname">Restaurant Name</Label>
                <Input
                  id="rname"
                  value={editingRestaurant.name}
                  onChange={(e) =>
                    setEditingRestaurant({ ...editingRestaurant, name: e.target.value })
                  }
                  placeholder="e.g. Bella Pizza"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rusername">Workspace Username / Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">@</span>
                  <Input
                    id="rusername"
                    value={editingRestaurant.username}
                    onChange={(e) =>
                      setEditingRestaurant({
                        ...editingRestaurant,
                        username: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      })
                    }
                    placeholder="e.g. bellapizza"
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Unique identifier used for the restaurant&apos;s public URL.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rcuisine">Cuisine Type</Label>
                  <Input
                    id="rcuisine"
                    value={editingRestaurant.cuisine}
                    onChange={(e) =>
                      setEditingRestaurant({ ...editingRestaurant, cuisine: e.target.value })
                    }
                    placeholder="e.g. Italian, Sushi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rlocation">Location</Label>
                  <Input
                    id="rlocation"
                    value={editingRestaurant.location}
                    onChange={(e) =>
                      setEditingRestaurant({ ...editingRestaurant, location: e.target.value })
                    }
                    placeholder="e.g. New York, London"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pricing Plan</Label>
                  <Select
                    value={editingRestaurant.plan}
                    onValueChange={(v) => {
                      const mrrMap: Record<string, number> = {
                        Free: 0,
                        Starter: 29,
                        Business: 89,
                        Enterprise: 299,
                      };
                      setEditingRestaurant({
                        ...editingRestaurant,
                        plan: v,
                        mrr: mrrMap[v] ?? 0,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Free">Free</SelectItem>
                      <SelectItem value="Starter">Starter</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingRestaurant.status}
                    onValueChange={(v) => setEditingRestaurant({ ...editingRestaurant, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editingRestaurant?.name || !editingRestaurant?.username) {
                  toast.error("Please fill in the name and workspace slug");
                  return;
                }

                const token =
                  typeof window !== "undefined"
                    ? localStorage.getItem("menuverse_session") || undefined
                    : undefined;

                if (editingRestaurant.id) {
                  try {
                    await updateRestaurantDetailsServer({
                      data: {
                        id: editingRestaurant.id,
                        name: editingRestaurant.name,
                        slug: editingRestaurant.username,
                        cuisine: editingRestaurant.cuisine,
                        location: editingRestaurant.location,
                        plan: editingRestaurant.plan,
                        status: editingRestaurant.status,
                      },
                    });

                    setRestaurantsList((list) =>
                      list.map((r) =>
                        r.id === editingRestaurant.id
                          ? ({ ...r, ...editingRestaurant } as typeof r)
                          : r,
                      ),
                    );
                    toast.success(`Updated details for "${editingRestaurant.name}"!`);
                    setIsAddEditOpen(false);
                  } catch (err: unknown) {
                    toast.error((err as Error)?.message || "Failed to update restaurant details");
                  }
                } else {
                  const name = editingRestaurant.name || "Unnamed Restaurant";
                  const username = editingRestaurant.username || "restaurant";

                  try {
                    const res = await createRestaurantServer({
                      data: {
                        name,
                        slug: username,
                        cuisine: editingRestaurant.cuisine || "Gourmet Kitchen",
                        location: editingRestaurant.location || "Downtown",
                        plan: editingRestaurant.plan || "Starter",
                        status: editingRestaurant.status || "active",
                      },
                    });

                    const createdId = res?.id || `rest-${Date.now()}`;
                    const newRestEntry = {
                      id: String(createdId),
                      name,
                      username: res?.slug || username,
                      cuisine: editingRestaurant.cuisine || "Gourmet Kitchen",
                      location: editingRestaurant.location || "Downtown",
                      plan: editingRestaurant.plan || "Starter",
                      status: editingRestaurant.status || "active",
                      logoImage: "/default-logo.png",
                      branches: 1,
                      categories: 0,
                      foodItems: 0,
                      isVerified: false,
                      mrr:
                        editingRestaurant.plan === "Business"
                          ? 89
                          : editingRestaurant.plan === "Enterprise"
                            ? 299
                            : editingRestaurant.plan === "Starter"
                              ? 29
                              : 0,
                      joined: editingRestaurant.joined || new Date().toISOString().split("T")[0],
                    };

                    setRestaurantsList((list) => [newRestEntry as (typeof list)[0], ...list]);
                    toast.success(
                      `Restaurant "${name}" created! Digital Menu active at /${res?.slug || username}`,
                    );
                    setIsAddEditOpen(false);

                    // Re-fetch clean authoritative MySQL data
                    const freshData = await getAdminRestaurantsServer();
                    if (freshData && freshData.length > 0) {
                      setRestaurantsList(freshData as unknown as typeof restaurantsList);
                    }
                  } catch (err: unknown) {
                    toast.error(
                      (err as Error)?.message || "Failed to create restaurant in database",
                    );
                  }
                }
              }}
              className="gradient-warm text-primary-foreground"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
