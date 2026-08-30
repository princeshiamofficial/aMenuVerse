"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { isSinglePageRole } from "@/lib/navigation";
import { BlobImg } from "@/components/ui/blob-img";
import {
  Bell,
  Camera,
  KeyRound,
  LogOut,
  Mail,
  Maximize,
  Minimize,
  Settings as SettingsIcon,
  ShieldAlert,
  AlertTriangle,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoolThemeToggle } from "./cool-theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  updateStaffAvatarServer,
  updateUserEmailServer,
  updateUserPasswordServer,
  verifyCurrentPasswordServer,
  signOutAction,
  getBranchesServer,
  getTenantSubscriptionServer,
  getRestaurantProfile,
  getCurrentUser,
  type DbBranchRecord,
} from "@/lib/db-queries.server";
import { toast } from "sonner";
import { SetAvatarDialog } from "./set-avatar-dialog";
import { ChangeEmailDialog } from "./change-email-dialog";
import { ChangePasswordDialog } from "./change-password-dialog";

function cleanManagerName(name: string): string {
  if (!name) return "";
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

type DashboardShellProps = {
  children: ReactNode;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string | null;
  userRole?: string;
  userBranch?: string | null;
};

export function DashboardShell({
  children,
  userId = "",
  userName = "Mehan Ahmed",
  userEmail = "admin@colorhut.dev",
  userAvatarUrl,
  userRole = "SYSTEM ADMIN",
  userBranch,
}: DashboardShellProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(userAvatarUrl ?? null);
  const [currentEmailState, setCurrentEmailState] = useState<string>(userEmail);

  // Dialog States
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [disabledBranchInfo, setDisabledBranchInfo] = useState<{
    branchName: string;
    reason: string;
    isSubscriptionExpired?: boolean;
  } | null>(null);

  useEffect(() => {
    async function verifyBranchStatus() {
      const normalized = (userRole || "").toLowerCase().trim().replace(/ /g, "_");
      const isStaffRole =
        normalized !== "owner" &&
        normalized !== "super_admin" &&
        normalized !== "superadmin" &&
        normalized !== "system_admin";

      if (!isStaffRole) return;

      try {
        const [branches, subData] = await Promise.all([
          getBranchesServer({ data: {} }),
          getTenantSubscriptionServer(),
        ]);

        if (Array.isArray(branches) && branches.length > 0) {
          const userCleanName = cleanManagerName(userName || "").toLowerCase();

          // Match branch by manager name or assigned branch
          let matchedBranch: DbBranchRecord | undefined = branches.find((b: DbBranchRecord) => {
            const bManager = cleanManagerName(b.manager || "").toLowerCase();
            return (
              userCleanName &&
              bManager &&
              (bManager === userCleanName ||
                bManager.includes(userCleanName) ||
                userCleanName.includes(bManager))
            );
          });

          if (!matchedBranch && normalized === "manager") {
            matchedBranch = branches[0];
          }

          if (matchedBranch) {
            const branchIdx = branches.findIndex((b: DbBranchRecord) => b.id === matchedBranch?.id);
            const maxBranches = subData?.limits?.maxBranches ?? 1;
            const isExceeded = maxBranches !== "unlimited" && branchIdx >= maxBranches;
            const isClosedOrDisabled =
              matchedBranch.status === "closed" ||
              matchedBranch.status === "temporarily-closed" ||
              matchedBranch.status === "disabled";
            const isSubExpired =
              subData?.status === "expired" || subData?.isExpiredDowngraded || isExceeded;

            if (isSubExpired) {
              setDisabledBranchInfo({
                branchName: matchedBranch.name,
                isSubscriptionExpired: true,
                reason:
                  "The subscription for this restaurant has expired. All page operations, orders, and table QR access are locked until the subscription is renewed. Please contact the restaurant owner to renew the package.",
              });
            } else if (isClosedOrDisabled) {
              setDisabledBranchInfo({
                branchName: matchedBranch.name,
                isSubscriptionExpired: false,
                reason: `Your assigned branch "${matchedBranch.name}" has been deactivated or marked as ${matchedBranch.status === "temporarily-closed" ? "temporarily closed" : "closed"}. Please contact your restaurant owner to re-enable it.`,
              });
            }
          }
        }
      } catch (err) {
        console.warn("verifyBranchStatus error:", err);
      }
    }

    verifyBranchStatus();
  }, [userRole, userName]);

  const [restaurantName, setRestaurantName] = useState<string>("MenuVerse");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string>(userBranch || "");

  useEffect(() => {
    async function loadRestaurantProfileAndBranch() {
      try {
        const prof = await getRestaurantProfile();
        if (prof?.name?.trim()) {
          setRestaurantName(prof.name.trim());
        }
        if (prof?.logo) {
          setLogoUrl(prof.logo);
        }
      } catch {
        /* ignore */
      }

      try {
        const branches = await getBranchesServer({ data: {} });
        if (Array.isArray(branches) && branches.length > 0) {
          const target = userBranch || (await getCurrentUser())?.branch;
          if (target) {
            const found = branches.find(
              (b) =>
                b.id === target ||
                b.name.toLowerCase().trim() === target.toLowerCase().trim() ||
                b.name.toLowerCase().includes(target.toLowerCase()) ||
                target.toLowerCase().includes(b.name.toLowerCase()),
            );
            setBranchName(found ? found.name : target);
          } else {
            const defBranch = branches.find((b) => b.isDefault) || branches[0];
            if (defBranch) setBranchName(defBranch.name);
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadRestaurantProfileAndBranch();

    const handleProfileUpdate = (e: Event) => {
      const customEv = e as CustomEvent<{ name?: string; logo?: string }>;
      if (customEv.detail?.name?.trim()) {
        setRestaurantName(customEv.detail.name.trim());
      }
      if (customEv.detail?.logo) {
        setLogoUrl(customEv.detail.logo);
      }
    };
    window.addEventListener("menuverse:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("menuverse:profile-updated", handleProfileUpdate);
    };
  }, [userBranch]);

  const initials =
    userName
      .split(" ")
      .map((s) => s[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MA";

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Ignored if browser blocks request
    }
  };

  const handleSaveAvatar = async (newAvatarUrl: string) => {
    if (!userId) {
      toast.error("User ID not available");
      return;
    }
    await updateStaffAvatarServer({
      data: { id: userId, avatarUrl: newAvatarUrl || "" },
    });
    setCurrentAvatar(newAvatarUrl || null);
    toast.success("Profile avatar updated successfully!");
  };

  const handleSaveEmail = async (newEmail: string) => {
    if (!userId) {
      toast.error("User ID not available");
      return;
    }
    await updateUserEmailServer({
      data: { id: userId, newEmail },
    });
    setCurrentEmailState(newEmail);
  };

  const handleVerifyCurrentPassword = async (password: string) => {
    if (!userId) {
      throw new Error("User session invalid.");
    }
    await verifyCurrentPasswordServer({
      data: { id: userId, password },
    });
  };

  const handleSavePassword = async (data: { currentPassword: string; newPassword: string }) => {
    if (!userId) {
      toast.error("User ID not available");
      return;
    }
    await updateUserPasswordServer({
      data: {
        id: userId,
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
    });
  };

  const handleSignOut = async () => {
    try {
      await signOutAction();
      toast.success("Signed out successfully");
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  };

  const formattedRole = (userRole || "SYSTEM ADMIN").toUpperCase().replace(/_/g, " ");

  const normalizedRole = (userRole || "").toLowerCase().trim().replace(/ /g, "_");
  const isOwnerRole =
    !userRole ||
    normalizedRole === "owner" ||
    normalizedRole === "super_admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "system_admin";

  const isSinglePageUser = isSinglePageRole(userRole);

  const roleEmoji =
    normalizedRole === "host"
      ? "📅"
      : normalizedRole === "waiter"
        ? "🛎️"
        : normalizedRole === "chef"
          ? "🍳"
          : normalizedRole === "cashier"
            ? "💳"
            : "🍽️";

  if (isSinglePageUser) {
    return (
      <div className="flex min-h-screen w-full flex-col" style={{ backgroundColor: "#EEEFF2" }}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 header-glass-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary hover:opacity-90 text-primary-foreground shadow-xs overflow-hidden border border-primary/20 p-0.5">
              {logoUrl ? (
                <BlobImg
                  src={logoUrl}
                  alt={restaurantName}
                  className="h-full w-full rounded-lg object-cover bg-white"
                />
              ) : (
                <span className="inline-flex h-full w-full items-center justify-center rounded-lg gradient-warm text-primary-foreground">
                  <Utensils className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm leading-tight text-foreground truncate">
                {restaurantName}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground truncate max-w-48 sm:max-w-xs">
                {branchName || `${formattedRole} Workspace`}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
              className="relative flex items-center justify-center rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full border border-stone-200 dark:border-stone-800 p-1 pr-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer outline-none">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarImage src={currentAvatar || undefined} />
                    <AvatarFallback className="gradient-warm text-primary-foreground font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start text-left text-xs leading-tight">
                    <span className="font-semibold text-foreground truncate max-w-28">
                      {userName}
                    </span>
                    <span className="text-muted-foreground text-[10px] capitalize">{userRole}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentEmailState}
                    </p>
                    <span className="inline-block mt-1 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">
                      {userRole}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-muted" />

                <div className="space-y-0.5">
                  <DropdownMenuItem
                    className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                    onClick={() => setIsAvatarModalOpen(true)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    <span>Change Avatar</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                    onClick={() => setIsEmailModalOpen(true)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    <span>Change Email</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                    onClick={() => setIsPasswordModalOpen(true)}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    <span>Change Password</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-muted" />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4 text-destructive" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className="flex-1 p-4 sm:p-6 md:p-8 min-h-[calc(100vh-4rem)] w-full"
          style={{ backgroundColor: "#EEEFF2" }}
        >
          {children}
        </main>

        <SetAvatarDialog
          open={isAvatarModalOpen}
          onOpenChange={setIsAvatarModalOpen}
          name={userName || "Owner"}
          email={currentEmailState}
          currentAvatarUrl={currentAvatar}
          onSave={handleSaveAvatar}
        />

        <ChangeEmailDialog
          open={isEmailModalOpen}
          onOpenChange={setIsEmailModalOpen}
          currentEmail={currentEmailState}
          onVerifyPassword={handleVerifyCurrentPassword}
          onSave={handleSaveEmail}
        />

        <ChangePasswordDialog
          open={isPasswordModalOpen}
          onOpenChange={setIsPasswordModalOpen}
          onVerifyCurrentPassword={handleVerifyCurrentPassword}
          onSave={handleSavePassword}
        />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={{ backgroundColor: "#EEEFF2" }}>
        <AppSidebar />
        <div className="flex flex-1 flex-col" style={{ backgroundColor: "#EEEFF2" }}>
          <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 header-glass-white px-4 sm:px-6">
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                className="relative flex items-center justify-center rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-full border border-stone-200 dark:border-stone-800 p-1 pr-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer outline-none">
                    <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                      <AvatarImage src={currentAvatar || undefined} />
                      <AvatarFallback className="gradient-warm text-primary-foreground font-semibold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start text-left text-xs leading-tight">
                      <span className="font-semibold text-foreground truncate max-w-28">
                        {userName}
                      </span>
                      <span className="text-muted-foreground text-[10px] capitalize">
                        {userRole}
                      </span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl">
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{userName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentEmailState}
                      </p>
                      <span className="inline-block mt-1 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">
                        {userRole}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-muted" />

                  <div className="space-y-0.5">
                    <DropdownMenuItem
                      className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                      onClick={() => setIsAvatarModalOpen(true)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      <span>Change Avatar</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                      onClick={() => setIsEmailModalOpen(true)}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      <span>Change Email</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                      onClick={() => setIsPasswordModalOpen(true)}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>Change Password</span>
                    </DropdownMenuItem>

                    {isOwnerRole && (
                      <DropdownMenuItem
                        asChild
                        className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground cursor-pointer"
                      >
                        <Link href="/settings">
                          <SettingsIcon className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </div>

                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-muted" />

                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-2 h-4 w-4 text-destructive" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            className="flex-1 p-6 md:p-8 min-h-[calc(100vh-4rem)]"
            style={{ backgroundColor: "#EEEFF2" }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Shared Set Avatar Modal */}
      <SetAvatarDialog
        open={isAvatarModalOpen}
        onOpenChange={setIsAvatarModalOpen}
        name={userName || "Owner"}
        email={currentEmailState}
        currentAvatarUrl={currentAvatar}
        onSave={handleSaveAvatar}
      />

      {/* Change Email Dialog */}
      <ChangeEmailDialog
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        currentEmail={currentEmailState}
        onVerifyPassword={handleVerifyCurrentPassword}
        onSave={handleSaveEmail}
      />

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
        onVerifyCurrentPassword={handleVerifyCurrentPassword}
        onSave={handleSavePassword}
      />

      {/* Full-screen Blocking Popup Modal for Disabled Branch Staff */}
      {disabledBranchInfo && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-8 shadow-2xl border border-red-200 text-center dark:bg-stone-900 dark:border-red-900/50 relative overflow-hidden">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 mb-3.5 shadow-inner border border-red-200/60">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold font-display text-gray-900 dark:text-white">
              Subscription Expired
            </h2>

            <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-normal text-balance">
              Your subscription has expired and access is locked.
              <br />
              Please contact the restaurant owner to renew.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="w-full font-bold shadow-sm h-10 rounded-xl cursor-pointer text-sm"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info(
                    "Please reach out directly to the restaurant owner or administrator to renew the package.",
                  )
                }
                className="w-full font-semibold border-gray-200 dark:border-stone-700 h-10 rounded-xl cursor-pointer text-sm"
              >
                Contact Owner
              </Button>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
