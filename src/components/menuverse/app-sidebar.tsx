"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BlobImg } from "@/components/ui/blob-img";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Tags,
  Utensils,
  BarChart3,
  MessageSquareHeart,
  Palette,
  CreditCard,
  Settings,
  LogOut,
  Store,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Wand2,
  Calculator,
  MonitorSmartphone,
  CalendarDays,
  Users,
  ConciergeBell,
  LayoutGrid,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOutAction, getCurrentUser, getRestaurantProfile } from "@/lib/db-queries.server";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  type NavItem,
  isRouteAllowedForRole,
  mainNavItems,
  menuGroupNavItems,
  operationsNavItems,
  insightsNavItems,
  accountNavItems,
} from "@/lib/navigation";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [userRole, setUserRole] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("MenuVerse");

  useEffect(() => {
    async function loadSidebarData() {
      try {
        const u = await getCurrentUser();
        if (u?.role) {
          setUserRole(u.role);
        }
        const prof = await getRestaurantProfile();
        if (prof?.logo) {
          setLogoUrl(prof.logo);
        }
        if (prof?.name) {
          setRestaurantName(prof.name);
        }
      } catch {
        /* ignore */
      }
    }
    loadSidebarData();
  }, []);

  const filterNavGroup = (items: NavItem[]) => {
    if (!userRole) return items;
    return items.filter((item) => isRouteAllowedForRole(item.url, userRole));
  };

  const signOut = async () => {
    await signOutAction();
    toast.success("Signed out");
    window.location.href = "/auth";
  };

  const renderCollapsedItem = (item: NavItem) => {
    const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
    const isMenuAi = item.url === "/menu-ai" || item.title === "Menu AI";

    return (
      <Tooltip key={item.title} delayDuration={0}>
        <TooltipTrigger asChild>
          {isMenuAi ? (
            <button
              onClick={() => toast.info("Menu AI is coming soon! 🚀")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href={item.url}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
            </Link>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const allowed = filterNavGroup(items);
    if (allowed.length === 0) return null;

    return (
      <SidebarGroup key={label}>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {allowed.map((item) => {
              const isActive =
                pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
              const isMenuAi = item.url === "/menu-ai" || item.title === "Menu AI";

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!isMenuAi}
                    tooltip={item.title}
                    isActive={isActive}
                    onClick={
                      isMenuAi
                        ? (e) => {
                            e.preventDefault();
                            toast.info("Menu AI is coming soon! 🚀");
                          }
                        : undefined
                    }
                    className={cn(
                      "transition-all duration-200 cursor-pointer font-medium",
                      isActive
                        ? "bg-primary/12 text-primary dark:bg-primary/25 font-bold shadow-2xs border-l-3 border-primary pl-2.5"
                        : "hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300",
                    )}
                  >
                    {isMenuAi ? (
                      <div className="flex items-center gap-2 w-full">
                        <item.icon className="h-4 w-4 transition-colors shrink-0" />
                        <span>{item.title}</span>
                      </div>
                    ) : (
                      <Link href={item.url}>
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isActive ? "text-primary font-bold" : "",
                          )}
                        />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent **:data-[sidebar=sidebar]:bg-sidebar-accent **:data-[sidebar=sidebar]:group-data-[collapsible=icon]:bg-transparent"
    >
      {collapsed ? (
        <TooltipProvider delayDuration={0}>
          <div className="flex h-full w-full flex-col items-center py-2 px-2 mx-auto bg-transparent gap-1.5 overflow-y-auto overflow-x-hidden no-scrollbar select-none">
            {/* Level 1 Capsule Card: Overview */}
            {filterNavGroup(mainNavItems).length > 0 && (
              <div className="flex flex-col items-center gap-1 rounded-[24px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm p-1 w-10.5 shrink-0">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleSidebar}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary hover:opacity-90 text-primary-foreground shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer mb-0.5 overflow-hidden border border-primary/20 p-0.5"
                    >
                      {logoUrl ? (
                        <BlobImg
                          src={logoUrl}
                          alt={restaurantName}
                          className="h-full w-full rounded-full object-cover bg-white"
                        />
                      ) : (
                        <span className="inline-flex h-full w-full items-center justify-center rounded-full gradient-warm text-primary-foreground">
                          <Utensils className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {restaurantName} (Expand)
                  </TooltipContent>
                </Tooltip>
                {filterNavGroup(mainNavItems).map((item) => renderCollapsedItem(item))}
              </div>
            )}

            {/* Level 2 Capsule Card: Menu */}
            {filterNavGroup(menuGroupNavItems).length > 0 && (
              <div className="flex flex-col items-center gap-1 rounded-[24px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm p-1 w-10.5 shrink-0">
                {filterNavGroup(menuGroupNavItems).map((item) => renderCollapsedItem(item))}
              </div>
            )}

            {/* Level 3 Capsule Card: Operations */}
            {filterNavGroup(operationsNavItems).length > 0 && (
              <div className="flex flex-col items-center gap-1 rounded-[24px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm p-1 w-10.5 shrink-0">
                {filterNavGroup(operationsNavItems).map((item) => renderCollapsedItem(item))}
              </div>
            )}

            {/* Level 4 Capsule Card: Insights */}
            {filterNavGroup(insightsNavItems).length > 0 && (
              <div className="flex flex-col items-center gap-1 rounded-[24px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm p-1 w-10.5 shrink-0">
                {filterNavGroup(insightsNavItems).map((item) => renderCollapsedItem(item))}
              </div>
            )}

            {/* Level 5 Capsule Card: Account & Signout */}
            <div className="flex flex-col items-center gap-1 rounded-[24px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-sm p-1 w-10.5 shrink-0 mt-auto">
              {filterNavGroup(accountNavItems).map((item) => renderCollapsedItem(item))}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 dark:text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all cursor-pointer shrink-0"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-semibold">
                  Sign out
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      ) : (
        <>
          <SidebarHeader>
            <div className="flex items-center justify-between px-2 py-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 font-display text-base font-bold min-w-0"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-warm text-primary-foreground overflow-hidden border border-border/40 shadow-xs">
                  {logoUrl ? (
                    <BlobImg
                      src={logoUrl}
                      alt={restaurantName}
                      className="h-full w-full object-cover bg-white"
                    />
                  ) : (
                    <Utensils className="h-4 w-4" />
                  )}
                </span>
                <span className="truncate text-sm font-black tracking-tight text-foreground">
                  {restaurantName}
                </span>
              </Link>
              <SidebarTrigger className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            {renderGroup("Overview", mainNavItems)}
            {renderGroup("Menu", menuGroupNavItems)}
            {renderGroup("Operations", operationsNavItems)}
            {renderGroup("Insights", insightsNavItems)}
            {renderGroup("Account", accountNavItems)}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </>
      )}
    </Sidebar>
  );
}
