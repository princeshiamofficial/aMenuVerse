import {
  LayoutGrid,
  Package,
  Utensils,
  LogOut,
  Menu,
  X,
  ChefHat,
  Monitor,
  Settings,
  ClipboardList,
  Tags,
  Store,
  QrCode,
  MapPin,
  Users,
  Palette,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  ordersCount: number;
  handleLogout: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
  onToggleSidebar?: () => void;
  isCollapsed?: boolean;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  handleLogout,
  isMobile = false,
  onCloseMobile,
  onToggleSidebar,
  isCollapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole") || "admin";
      setUserRole(role);
    }
  }, []);

  interface SidebarMenuItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href?: string;
  }

  // Sidebar navigation items for the Digital Food Menu application
  const menuItems: SidebarMenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "pos", label: "POS", icon: Monitor },
    { id: "orders", label: "Orders", icon: Package },
    { id: "kitchen", label: "Kitchen", icon: ChefHat },
    { id: "inventory", label: "Inventory", icon: ClipboardList },
    { id: "menu", label: "Menu", icon: Utensils },
    { id: "categories", label: "Categories", icon: Tags },
    ...(userRole === "admin"
      ? [{ id: "branches", label: "Manage Branch", icon: MapPin, href: "/branches" }]
      : []),
    ...(userRole === "admin"
      ? [{ id: "profile", label: "Profile", icon: Store, href: "/profile" }]
      : []),
    ...(userRole === "admin"
      ? [{ id: "appearance", label: "Appearance", icon: Palette, href: "/appearance" }]
      : []),
    ...(userRole === "admin"
      ? [{ id: "staff", label: "Manage Staff", icon: Users, href: "/staff" }]
      : []),
    ...(userRole !== "admin"
      ? [{ id: "qr-codes", label: "Table QR Codes", icon: QrCode, href: "/qr-codes" }]
      : []),
    ...(userRole === "admin" ? [{ id: "settings", label: "Settings", icon: Settings }] : []),
  ];

  // Map our dashboard page states to show the correct selected state
  const isSelected = (itemId: string) => {
    if (!pathname) {
      if (itemId === "orders") {
        return (
          activeTab === "all-orders" ||
          activeTab === "active" ||
          activeTab === "completed" ||
          activeTab === "orders"
        );
      }
      return activeTab === itemId;
    }

    if (itemId === "dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    if (itemId === "orders") {
      return pathname.includes("/orders");
    }

    return pathname === `/${itemId}` || pathname.startsWith(`/${itemId}/`);
  };

  const handleItemClick = (itemId: string) => {
    if (itemId === "orders") {
      setActiveTab("all-orders");
    } else {
      setActiveTab(itemId);
    }
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const asideClasses = isMobile
    ? "flex flex-col w-64 bg-[#111e35] h-screen shadow-xl select-none font-sans overflow-hidden shrink-0 border-r border-[#1a2b49]/40"
    : `hidden lg:flex flex-col ${isCollapsed ? "w-16" : "w-64"} bg-[#111e35] shrink-0 h-screen sticky top-0 z-20 shadow-xl overflow-hidden font-sans border-r border-[#1a2b49]/40 select-none transition-all duration-300`;

  return (
    <aside className={asideClasses}>
      {/* Header section (Black background, brand logo and hamburger menu) */}
      <div
        className={`bg-black py-4 ${isCollapsed ? "px-2 justify-center" : "px-6 justify-between"} flex items-center border-b border-[#1a2b49]/20 shrink-0 h-16`}
      >
        {!isCollapsed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="Color Hut Logo" className="h-[34px] w-auto object-contain" />
        )}

        {/* Toggle Icon */}
        {isMobile ? (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded hover:bg-neutral-900 transition-colors text-white focus:outline-none"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5 text-neutral-200" />
          </button>
        ) : (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded hover:bg-neutral-900 transition-colors text-white focus:outline-none"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5 text-neutral-200" />
          </button>
        )}
      </div>

      {/* Menu items container */}
      <nav
        className={`flex-1 overflow-y-auto scrollbar-none py-4 ${isCollapsed ? "px-2" : "px-3"} flex flex-col gap-[7px]`}
      >
        {menuItems.map((item) => {
          const active = isSelected(item.id);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={
                item.href ||
                (item.id === "dashboard"
                  ? "/dashboard"
                  : item.id === "orders"
                    ? "/orders"
                    : `/${item.id}`)
              }
              onClick={() => handleItemClick(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? "justify-center p-3" : "justify-between px-3.5 py-3"} rounded-[12px] text-[13.5px] font-semibold tracking-wide transition-all duration-150 group focus:outline-none ${
                active
                  ? "bg-[#ff7a00] text-white shadow-[0_4px_12px_rgba(255,122,0,0.2)]"
                  : "text-slate-300 hover:text-white hover:bg-[#1a2a47]/30"
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                <Icon
                  className={`w-[17px] h-[17px] transition-transform group-hover:scale-[1.05] ${
                    active ? "text-white" : "text-slate-350"
                  }`}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section (separating border and Logout button) */}
      <div
        className={`border-t border-[#1a2b49]/30 py-4 ${isCollapsed ? "px-2" : "px-3"} shrink-0`}
      >
        <button
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" })
              .then(() => {
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("userRole");
                localStorage.removeItem("userDisplayName");
                localStorage.removeItem("userAssignedBranchId");
                handleLogout();
              })
              .catch(() => {
                localStorage.removeItem("isLoggedIn");
                handleLogout();
              });
          }}
          title={isCollapsed ? "Logout" : undefined}
          className={`w-full flex items-center ${isCollapsed ? "justify-center p-3" : "gap-3 px-3.5 py-3"} rounded-[12px] text-[13.5px] font-semibold tracking-wide text-slate-300 hover:text-white hover:bg-red-950/15 transition-all duration-150 group focus:outline-none`}
        >
          <LogOut className="w-[17px] h-[17px] text-slate-400 group-hover:text-red-400" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
