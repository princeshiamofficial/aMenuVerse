import Link from "next/link";
import { Bell, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/db-queries.server";
import { toast } from "sonner";

export type NavbarProps = {
  onSearch?: (q: string) => void;
  userName?: string;
  userEmail?: string;
  className?: string;
};

export function Navbar({ onSearch, userName = "Guest", userEmail, className }: NavbarProps) {
  const { resolvedTheme, toggle } = useTheme();
  const initials = userName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOutAction();
      toast.success("Signed out");
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/70 px-3 backdrop-blur",
        className,
      )}
    >
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search…"
          className="pl-9"
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggle}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-1 hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="gradient-warm text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{userName}</div>
              {userEmail && <div className="text-xs text-muted-foreground">{userEmail}</div>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/subscription">Subscription</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
