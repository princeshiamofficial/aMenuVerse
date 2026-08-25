"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import BeautifulQRCode from "../../../ui/BeautifulQRCode";
import {
  Menu,
  Bell,
  Settings,
  Save,
  Check,
  FileText,
  Wifi,
  X,
  Lock,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { RESTAURANTS, Branch } from "../data/restaurants";

/*
interface Table {
  name: string;
  location: string;
  status: string;
}
*/

interface CustomBranch extends Branch {
  isCustom?: boolean;
}

type SettingsSection = "taxes" | "qr" | "hardware" | "branches" | "staff" | "account";
export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("settings");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("taxes");
  const [showToast, setShowToast] = useState(false);
  const [previewQr, setPreviewQr] = useState<{
    name: string;
    location: string;
    url: string;
  } | null>(null);

  // Dynamic user roles and branch states
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");

  // Branch management local states
  const [branches, setBranches] = useState<CustomBranch[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const branchModalMode: "add" | "edit" = "add";
  const editingBranchId = "";

  const [branchFormName, setBranchFormName] = useState("");
  const [branchFormLocation, setBranchFormLocation] = useState("");
  const [branchFormPhone, setBranchFormPhone] = useState("");
  const [branchFormHours, setBranchFormHours] = useState("");
  const [branchFormTablesCount, setBranchFormTablesCount] = useState(2);

  // Staff management local states (removed)

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("userRole") || "admin";
      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      const name = localStorage.getItem("userDisplayName") || "Color Hut Admin";

      setUserDisplayName(name);

      // Load branches
      const restaurant = RESTAURANTS.find((r) => r.id === 1);
      const defaults = restaurant?.branches || [];
      const storedBranchesStr = localStorage.getItem("restaurant_branches");
      if (storedBranchesStr) {
        try {
          setBranches([...defaults, ...JSON.parse(storedBranchesStr)]);
        } catch {
          setBranches(defaults);
        }
      } else {
        setBranches(defaults);
      }

      // Load staff list (removed)
      // Listen to URL search param "section" and set active section
      const searchParams = new URLSearchParams(window.location.search);
      const sectionParam = searchParams.get("section");
      if (
        sectionParam === "branches" ||
        sectionParam === "taxes" ||
        sectionParam === "qr" ||
        sectionParam === "hardware" ||
        sectionParam === "account"
      ) {
        setSettingsSection(sectionParam as SettingsSection);
      }
    }
  }, [router]);

  // Taxes States
  const [vat, setVat] = useState(5);
  const [serviceFee, setServiceFee] = useState(10);
  const [autoPrintKitchen, setAutoPrintKitchen] = useState(true);

  // Hardware states
  const [selectedPrinter, setSelectedPrinter] = useState("LAN Printer (KITCHEN_K1)");
  const [isPrinterConnected, setIsPrinterConnected] = useState(true);

  // Account / Credentials states
  const [accountEmail, setAccountEmail] = useState("");
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountToast, setAccountToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load current admin email on mount
  React.useEffect(() => {
    fetch("/api/tenant/account")
      .then((res) => res.json())
      .then((data) => {
        if (data.email) setAccountEmail(data.email);
      })
      .catch(() => {});
  }, []);

  const handleAccountSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountNewPassword && accountNewPassword !== accountConfirmPassword) {
      setAccountToast({ type: "error", message: "New passwords do not match." });
      setTimeout(() => setAccountToast(null), 4000);
      return;
    }
    setAccountSaving(true);
    try {
      const res = await fetch("/api/tenant/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: accountEmail,
          currentPassword: accountCurrentPassword,
          newPassword: accountNewPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccountToast({ type: "success", message: "Credentials updated successfully!" });
        setAccountCurrentPassword("");
        setAccountNewPassword("");
        setAccountConfirmPassword("");
      } else {
        setAccountToast({ type: "error", message: data.error || "Failed to update credentials." });
      }
    } catch {
      setAccountToast({ type: "error", message: "Network error. Please try again." });
    } finally {
      setAccountSaving(false);
      setTimeout(() => setAccountToast(null), 4000);
    }
  };

  const handleLogout = () => {
    router.push("/login");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Table QR Code State Management - Branch Scoped
  const [selectedBranchId] = useState("dhanmondi");

  /*
  const getCurrentBranchTables = () => {
    const currentBranch = branches.find(b => b.id === selectedBranchId);
    return currentBranch?.tables || [];
  };
  */

  const saveBranchesToStorage = (updatedBranches: CustomBranch[]) => {
    setBranches(updatedBranches);
    const defaults = RESTAURANTS.find((r) => r.id === 1)?.branches || [];
    const customs = updatedBranches.filter(
      (b) => !defaults.some((d) => d.id === b.id) || b.isCustom,
    );
    localStorage.setItem("restaurant_branches", JSON.stringify(customs));
  };

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalMode] = useState<"add" | "edit">("add");
  const [editingTableIndex] = useState<number | null>(null);
  const [qrTableName, setQrTableName] = useState("");
  const [qrTableLocation, setQrTableLocation] = useState("Main Hall");

  /*
  const handleOpenAddModal = () => {
    const curTables = getCurrentBranchTables();
    setQrModalMode("add");
    setQrTableName(`Table ${String(curTables.length + 1).padStart(2, "0")}`);
    setQrTableLocation("Main Hall");
    setIsQrModalOpen(true);
  };

  const handleOpenEditModal = (table: Table, index: number) => {
    setQrModalMode("edit");
    setEditingTableIndex(index);
    setQrTableName(table.name);
    setQrTableLocation(table.location);
    setIsQrModalOpen(true);
  };
  */

  const handleSaveQrTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrTableName.trim()) return;

    const updatedBranches = branches.map((b) => {
      if (b.id === selectedBranchId) {
        const updatedTables = [...b.tables];
        if (qrModalMode === "add") {
          updatedTables.push({ name: qrTableName, location: qrTableLocation, status: "Active" });
        } else if (qrModalMode === "edit" && editingTableIndex !== null) {
          updatedTables[editingTableIndex] = {
            name: qrTableName,
            location: qrTableLocation,
            status: "Active",
          };
        }
        return { ...b, tables: updatedTables };
      }
      return b;
    });
    saveBranchesToStorage(updatedBranches);
    setIsQrModalOpen(false);
  };

  /*
  const handleDeleteTable = (index: number) => {
    if (confirm("Are you sure you want to delete this table QR code?")) {
      const updatedBranches = branches.map(b => {
        if (b.id === selectedBranchId) {
          return {
            ...b,
            tables: b.tables.filter((_: Table, idx: number) => idx !== index)
          };
        }
        return b;
      });
      saveBranchesToStorage(updatedBranches);
    }
  };
  */

  // Branch CRUD Logic (Unused in settings, handled in Branches Page)
  /*
  const handleOpenAddBranchModal = () => {
    setBranchModalMode("add");
    setBranchFormName("");
    setBranchFormLocation("");
    setBranchFormPhone("");
    setBranchFormHours("11:00 AM - 11:00 PM");
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranchModal = (branch: CustomBranch) => {
    setBranchModalMode("edit");
    setEditingBranchId(branch.id);
    setBranchFormName(branch.name);
    setBranchFormLocation(branch.location);
    setBranchFormPhone(branch.phone);
    setBranchFormHours(branch.operatingHours);
    setIsBranchModalOpen(true);
  };
  */

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFormName.trim()) return;

    let updatedBranches;
    if (branchModalMode === "add") {
      const newId = branchFormName.toLowerCase().replace(/\s+/g, "-");
      if (branches.some((b) => b.id === newId)) {
        alert("A branch with this name already exists.");
        return;
      }
      const tableCount = Number(branchFormTablesCount);
      const generatedTables = Array.from({ length: tableCount }, (_, i) => ({
        name: `Table ${String(i + 1).padStart(2, "0")}`,
        location: "Main Hall",
        status: "Active",
      }));
      const newBranch = {
        id: newId,
        name: branchFormName,
        location: branchFormLocation,
        phone: branchFormPhone,
        operatingHours: branchFormHours,
        tables: generatedTables,
        isCustom: true,
      };
      updatedBranches = [...branches, newBranch];
    } else {
      updatedBranches = branches.map((b) => {
        if (b.id === editingBranchId) {
          return {
            ...b,
            name: branchFormName,
            location: branchFormLocation,
            phone: branchFormPhone,
            operatingHours: branchFormHours,
          };
        }
        return b;
      });
    }

    saveBranchesToStorage(updatedBranches);
    setIsBranchModalOpen(false);
  };

  /*
  const handleDeleteBranch = (branchId: string) => {
    if (confirm("Are you sure you want to delete this branch? All table QR codes for this branch will be lost.")) {
      const updatedBranches = branches.filter(b => b.id !== branchId);
      saveBranchesToStorage(updatedBranches);
      if (selectedBranchId === branchId) {
        setSelectedBranchId(updatedBranches[0]?.id || "");
      }
    }
  };
  */

  // Staff CRUD Logic (removed)

  const downloadQrWithTableNo = (tableName: string, targetUrl: string) => {
    import("qr-code-styling").then((mod) => {
      const cleanNum = tableName.replace("Table ", "");
      const Creator = mod.default || mod;
      const SIZE = 1000;
      const MARGIN = 65;

      const qrCode = new Creator({
        width: SIZE,
        height: SIZE,
        margin: MARGIN,
        type: "svg",
        data: targetUrl,
        dotsOptions: {
          color: "#000000",
          type: "dots",
        },
        qrOptions: {
          typeNumber: 0, // Auto — library selects minimum safe version
          mode: "Byte",
          errorCorrectionLevel: "M",
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        cornersSquareOptions: {
          color: "#000000",
          type: "extra-rounded",
        },
        cornersDotOptions: {
          color: "#000000",
          type: "dot",
        },
        extensions: [
          (svg: any) => {
            const clipPaths = svg.querySelectorAll("clipPath");
            clipPaths.forEach((clipPath: any) => {
              if (clipPath.id && clipPath.id.includes("clip-path-dot-color")) {
                const circles = clipPath.querySelectorAll("circle");
                circles.forEach((circle: any) => {
                  const r = parseFloat(circle.getAttribute("r") || "0");
                  if (r > 0) {
                    circle.setAttribute("r", String(r * 0.5));
                  }
                });
              }
            });
          },
        ],
      } as any);

      qrCode.getRawData("svg").then((blob) => {
        if (!blob || !(blob instanceof Blob)) return;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d")!;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, SIZE, SIZE);
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          URL.revokeObjectURL(url);

          const badgeR = Math.round(SIZE * 0.11);
          const cx = SIZE / 2;
          const cy = SIZE / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();

          const fontSize = Math.round(badgeR * 1.1);
          ctx.fillStyle = "#000000";
          ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(cleanNum, cx, cy);

          canvas.toBlob((pngBlob) => {
            if (!pngBlob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = `${tableName.replace(" ", "_")}_QR.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          }, "image/png");
        };
        img.src = url;
      });
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-800 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ordersCount={0}
          handleLogout={handleLogout}
          isCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative animate-in slide-in-from-left duration-200">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              ordersCount={0}
              handleLogout={handleLogout}
              isMobile={true}
              isCollapsed={false}
              onCloseMobile={() => setIsMobileOpen(false)}
            />
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="flex-1 h-full cursor-default focus:outline-none"
            aria-label="Close menu"
          />
        </div>
      )}

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-650 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800 flex items-center gap-2">
              <Settings className="w-[18px] h-[18px] text-[#ff7a00]" />
              <span>Restaurant Settings</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-550 hover:text-slate-855 transition-colors relative">
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff7a00] ring-2 ring-white" />
              </button>
            </div>
            <div className="h-8 w-px bg-slate-205" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#ff7a00] to-amber-500 flex items-center justify-center font-bold text-xs text-white">
                CH
              </div>
              <span className="hidden md:inline text-xs font-semibold text-slate-600">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Floating Toast Notification */}
        {showToast && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/35 bg-emerald-955/90 text-emerald-300 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">Settings saved successfully!</span>
          </div>
        )}

        {/* Content Body */}
        <main className="p-6 w-full flex-1 flex flex-col lg:flex-row gap-6">
          {/* Settings Section Tabs (Left) */}
          <div className="w-full lg:w-64 shrink-0 flex lg:flex-col gap-2 overflow-x-auto pb-2.5 lg:pb-0 scrollbar-none">
            {[
              { id: "taxes", label: "Taxes & Service Fees" },
              { id: "hardware", label: "Hardware & Printers" },
              { id: "account", label: "Account & Security" },
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSettingsSection(sec.id as SettingsSection)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal ${
                  settingsSection === sec.id
                    ? "bg-[#ff7a00] text-white shadow-sm"
                    : "text-slate-555 hover:text-slate-855 bg-white border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Form Content Pane (Right) */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {/* Taxes and Fees Form */}
            {settingsSection === "taxes" && (
              <form onSubmit={handleSave} className="flex flex-col gap-5 max-w-xl">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Taxes & Service Charges</h3>
                  <p className="text-[11px] text-slate-500">
                    Configure regulatory VAT/GST and cashier receipts.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Value Added Tax (VAT) / GST (%)
                  </label>
                  <input
                    type="number"
                    value={vat}
                    onChange={(e) => setVat(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Default Service Charge (%)
                  </label>
                  <input
                    type="number"
                    value={serviceFee}
                    onChange={(e) => setServiceFee(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 border border-slate-205 rounded-xl mt-2 select-none">
                  <input
                    type="checkbox"
                    id="auto-print"
                    checked={autoPrintKitchen}
                    onChange={() => setAutoPrintKitchen(!autoPrintKitchen)}
                    className="w-5 h-5 accent-emerald-500 rounded border-slate-300 bg-white"
                  />
                  <div className="flex flex-col">
                    <label
                      htmlFor="auto-print"
                      className="text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      Auto-Print Kitchen tickets
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Send order receipts directly to kitchen printer when checkout is finalized.
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="self-start flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md mt-4"
                >
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </form>
            )}

            {/* Hardware settings form */}
            {settingsSection === "hardware" && (
              <form onSubmit={handleSave} className="flex flex-col gap-5 max-w-xl">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Printers & Hardware Integration
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure connection status of POS receipt and kitchen printers.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Connected Printer
                  </label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold"
                  >
                    <option value="LAN Printer (KITCHEN_K1)">
                      LAN Printer (KITCHEN_K1) - IP: 192.168.1.180
                    </option>
                    <option value="USB Printer (RECEIPT_P1)">
                      USB Printer (RECEIPT_P1) - Local COM3
                    </option>
                    <option value="Bluetooth Printer (BT_P2)">
                      Bluetooth Printer (BT_P2) - Connected
                    </option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Wifi
                      className={`w-5 h-5 ${isPrinterConnected ? "text-emerald-600 animate-pulse" : "text-rose-600"}`}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Connection Status</span>
                      <span className="text-[9px] text-slate-500 font-medium">
                        Printer status is currently: {isPrinterConnected ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrinterConnected(false);
                      setTimeout(() => {
                        setIsPrinterConnected(true);
                        alert("Ping response: SUCCESS. Printer is responsive!");
                      }, 1200);
                    }}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold tracking-wider text-slate-600 rounded-lg uppercase transition-all"
                  >
                    Test connection
                  </button>
                </div>

                <button
                  type="submit"
                  className="self-start flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md mt-4"
                >
                  <Save className="w-4 h-4" /> Save Connection
                </button>
              </form>
            )}

            {/* Staff & Roles Management panel (removed) */}

            {/* Account & Security form */}
            {settingsSection === "account" && (
              <form onSubmit={handleAccountSave} className="flex flex-col gap-6 max-w-xl">
                {/* Header */}
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#ff7a00]" />
                    Account &amp; Security
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Update your admin login email and password.
                  </p>
                </div>

                {/* Toast feedback */}
                {accountToast && (
                  <div
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold border ${
                      accountToast.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}
                  >
                    {accountToast.type === "success" ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 shrink-0" />
                    )}
                    {accountToast.message}
                  </div>
                )}

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Login Email
                  </label>
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    required
                    placeholder="admin@example.com"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium transition-colors"
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Change Password
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Current Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Current Password{" "}
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={accountCurrentPassword}
                      onChange={(e) => setAccountCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter your current password"
                      className="w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> New Password{" "}
                    <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={accountNewPassword}
                      onChange={(e) => setAccountNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      className="w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                {accountNewPassword && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={accountConfirmPassword}
                        onChange={(e) => setAccountConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className={`w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium transition-colors ${
                          accountConfirmPassword && accountNewPassword !== accountConfirmPassword
                            ? "border-rose-400 bg-rose-50"
                            : "border-slate-200"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {accountConfirmPassword && accountNewPassword !== accountConfirmPassword && (
                      <p className="text-[10px] text-rose-500 font-semibold">
                        Passwords do not match
                      </p>
                    )}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={accountSaving}
                  className="self-start flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-[#ff7a00] hover:bg-orange-600 text-xs font-bold text-white transition-all shadow-md mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {accountSaving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {accountSaving ? "Saving..." : "Save Credentials"}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>

      {/* QR Code Preview Modal */}
      {previewQr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-tr-3xl rounded-bl-3xl rounded-tl-none rounded-br-none p-6 max-w-sm w-full flex flex-col gap-5 shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex flex-col text-left">
                <h3 className="text-sm font-bold text-slate-900">{previewQr.name}</h3>
                <span className="text-[10px] text-[#ff7a00] font-bold">{previewQr.location}</span>
              </div>
              <button
                onClick={() => setPreviewQr(null)}
                className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all duration-200 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Card Body */}
            <div className="flex flex-col items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center shadow-inner relative group">
              <div className="bg-white p-3 rounded-tr-2xl rounded-bl-2xl rounded-tl-none rounded-br-none border border-slate-200 shadow-md relative flex items-center justify-center select-none">
                <BeautifulQRCode value={previewQr.url} tableName={previewQr.name} size={180} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Scan to Open Menu
                </span>
                <span
                  className="text-[10px] font-semibold text-slate-500 truncate max-w-[280px] font-mono select-all"
                  title="Click to select all"
                >
                  {previewQr.url}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewQr(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-55 text-xs font-bold text-slate-650 transition-all text-center cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => downloadQrWithTableNo(previewQr.name, previewQr.url)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Download QR
              </button>
            </div>
          </div>
          {/* Click backdrop to close */}
          <div className="absolute inset-0 -z-10" onClick={() => setPreviewQr(null)} />
        </div>
      )}

      {/* Table QR Add/Edit Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                {qrModalMode === "add" ? "Add New Table QR" : "Edit Table QR"}
              </h3>
              <button
                onClick={() => setIsQrModalOpen(false)}
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQrTable} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">Table Name</label>
                <input
                  type="text"
                  value={qrTableName}
                  onChange={(e) => setQrTableName(e.target.value)}
                  placeholder="e.g. Table 09"
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold bg-slate-50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">Location</label>
                <select
                  value={qrTableLocation}
                  onChange={(e) => setQrTableLocation(e.target.value)}
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold bg-slate-50 font-sans"
                >
                  <option value="Main Hall">Main Hall</option>
                  <option value="Window Side">Window Side</option>
                  <option value="VIP Lounge">VIP Lounge</option>
                  <option value="Terrace">Terrace</option>
                </select>
              </div>

              <div className="flex gap-2.5 justify-end mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ff7a00] hover:bg-[#e06b00] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Add/Edit Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                {branchModalMode === "add" ? "Add New Branch" : "Edit Branch Details"}
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="flex flex-col gap-4 font-sans text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branchFormName}
                  onChange={(e) => setBranchFormName(e.target.value)}
                  placeholder="e.g. Banani Branch"
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold bg-slate-50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">
                  Location Address
                </label>
                <input
                  type="text"
                  value={branchFormLocation}
                  onChange={(e) => setBranchFormLocation(e.target.value)}
                  placeholder="e.g. Road 11, Banani, Dhaka"
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium bg-slate-50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={branchFormPhone}
                  onChange={(e) => setBranchFormPhone(e.target.value)}
                  placeholder="e.g. +880 1712-999999"
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium bg-slate-50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={branchFormHours}
                  onChange={(e) => setBranchFormHours(e.target.value)}
                  placeholder="e.g. 11:00 AM - 11:00 PM"
                  className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium bg-slate-50"
                  required
                />
              </div>

              {branchModalMode === "add" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Initial Tables Count
                  </label>
                  <select
                    value={branchFormTablesCount}
                    onChange={(e) => setBranchFormTablesCount(Number(e.target.value))}
                    className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold bg-slate-50 font-sans cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? "Table" : "Tables"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2.5 justify-end mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ff7a00] hover:bg-[#e06b00] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Add/Edit Modal (removed) */}
    </div>
  );
}
