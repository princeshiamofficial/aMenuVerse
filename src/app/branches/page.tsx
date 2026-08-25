"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { RESTAURANTS, Branch } from "../data/restaurants";
import BeautifulQRCode from "../../../ui/BeautifulQRCode";

interface Table {
  name: string;
  location: string;
  status: string;
}

interface CustomBranch extends Branch {
  isCustom?: boolean;
}
import {
  Menu,
  Bell,
  Plus,
  Edit2,
  Trash2,
  X,
  Store,
  Check,
  ExternalLink,
  FileText,
  MapPin,
  Clock,
  Phone,
} from "lucide-react";

export default function BranchesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("branches");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Saved successfully!");
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [previewQr, setPreviewQr] = useState<{
    name: string;
    location: string;
    url: string;
  } | null>(null);

  // Dynamic user roles and branch states
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");

  // Branch management states
  const [branches, setBranches] = useState<CustomBranch[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchModalMode, setBranchModalMode] = useState<"add" | "edit">("add");
  const [editingBranchId, setEditingBranchId] = useState("");
  const [branchFormName, setBranchFormName] = useState("");
  const [branchFormLocation, setBranchFormLocation] = useState("");
  const [branchFormPhone, setBranchFormPhone] = useState("");
  const [branchFormHours, setBranchFormHours] = useState("");
  const [branchFormTablesCount, setBranchFormTablesCount] = useState(2);

  // Table QR Code states (scoped to selected branch card)
  const [restaurantUsername, setRestaurantUsername] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("dhanmondi");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<"add" | "edit">("add");
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [qrTableName, setQrTableName] = useState("");
  const [qrTableLocation, setQrTableLocation] = useState("Main Hall");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("userRole") || "admin";
      const name = localStorage.getItem("userDisplayName") || "Color Hut Admin";

      setUserDisplayName(name);

      // Branch managers cannot access branch settings
      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      // Fetch restaurant details to get correct username
      fetch("/api/tenant/restaurant-details")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.username) {
            setRestaurantUsername(data.username);
          }
        })
        .catch((err) => console.error("Error loading restaurant details:", err));

      // Load branches from database API
      fetch("/api/tenant/branches")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setBranches(data);
          }
        })
        .catch((err) => console.error("Error loading branches:", err));

      const currentOrigin = window.location.origin;
      requestAnimationFrame(() => {
        setOrigin(currentOrigin);
      });
    }
  }, [router]);

  const handleLogout = () => {
    router.push("/login");
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const saveBranchesToStorage = async (updatedBranches: CustomBranch[]) => {
    // Save locally for immediate UI response
    setBranches(updatedBranches);

    try {
      // Find deleted branches (in old branches, not in updatedBranches)
      const deleted = branches.filter((b) => !updatedBranches.some((u) => u.id === b.id));
      for (const d of deleted) {
        await fetch(`/api/tenant/branches?id=${d.id}`, { method: "DELETE" });
      }

      // Find added or modified branches
      for (const u of updatedBranches) {
        const original = branches.find((b) => b.id === u.id);
        const hasChanged =
          !original ||
          original.name !== u.name ||
          original.location !== u.location ||
          original.phone !== u.phone ||
          original.operatingHours !== u.operatingHours ||
          JSON.stringify(original.tables) !== JSON.stringify(u.tables);

        if (hasChanged) {
          await fetch("/api/tenant/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: u.id,
              name: u.name,
              location: u.location,
              phone: u.phone,
              operatingHours: u.operatingHours,
              tables: u.tables,
            }),
          });
        }
      }
    } catch (err) {
      console.error("Failed to sync branches with MySQL database:", err);
    }
  };

  // Branch CRUD handlers
  const handleOpenAddBranchModal = () => {
    setBranchModalMode("add");
    setBranchFormName("");
    setBranchFormLocation("");
    setBranchFormPhone("");
    setBranchFormHours("11:00 AM - 11:00 PM");
    setBranchFormTablesCount(2);
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
      triggerToast("Branch added successfully!");
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
      triggerToast("Branch updated successfully!");
    }

    saveBranchesToStorage(updatedBranches);
    setIsBranchModalOpen(false);
  };

  const handleDeleteBranch = (branchId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this branch? All table QR codes for this branch will be lost.",
      )
    ) {
      const updatedBranches = branches.filter((b) => b.id !== branchId);
      saveBranchesToStorage(updatedBranches);
      triggerToast("Branch removed successfully.");
    }
  };

  // Table QR CRUD handlers
  const handleOpenAddTableModal = (branchId: string) => {
    setSelectedBranchId(branchId);
    const targetBranch = branches.find((b) => b.id === branchId);
    const curTables = targetBranch?.tables || [];
    setQrModalMode("add");
    setQrTableName(`Table ${String(curTables.length + 1).padStart(2, "0")}`);
    setQrTableLocation("Main Hall");
    setIsQrModalOpen(true);
  };

  const handleOpenEditTableModal = (branchId: string, table: Table, index: number) => {
    setSelectedBranchId(branchId);
    setQrModalMode("edit");
    setEditingTableIndex(index);
    setQrTableName(table.name);
    setQrTableLocation(table.location);
    setIsQrModalOpen(true);
  };

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
    triggerToast("Table layout saved!");
  };

  const handleDeleteTable = (branchId: string, index: number) => {
    if (confirm("Are you sure you want to delete this table QR code?")) {
      const updatedBranches = branches.map((b) => {
        if (b.id === branchId) {
          return {
            ...b,
            tables: b.tables.filter((_: Table, idx: number) => idx !== index),
          };
        }
        return b;
      });
      saveBranchesToStorage(updatedBranches);
      triggerToast("Table removed.");
    }
  };

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
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-655 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800 flex items-center gap-2">
              <Store className="w-[18px] h-[18px] text-[#ff7a00]" />
              <span>Manage Branch Outlets</span>
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

        {/* Toast Alert */}
        {showToast && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/35 bg-emerald-950/90 text-emerald-300 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <main className="p-6 w-full flex-1 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Restaurant Branches</h2>
              <p className="text-xs text-slate-500">
                Add branches, allocate customer dining tables, and export instant table QR codes.
              </p>
            </div>
            <button
              onClick={handleOpenAddBranchModal}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#ff7a00] hover:bg-[#e06b00] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Branch
            </button>
          </div>

          {/* Branches Grid */}
          <div className="flex flex-col gap-8">
            {branches.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5"
              >
                {/* Branch Card Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[#ff7a00]">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {b.name}
                        {b.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded">
                            Custom
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> {b.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {b.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> {b.operatingHours}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenAddTableModal(b.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#ff7a00]/30 hover:bg-[#ff7a00]/5 text-[#ff7a00] text-xs font-bold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Table
                    </button>
                    <button
                      onClick={() => handleOpenEditBranchModal(b)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-[#ff7a00] transition-colors"
                      title="Edit Branch"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(b.id)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-550 hover:text-rose-600 transition-colors"
                      title="Delete Branch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dining Tables QR codes Grid */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-700 text-left uppercase tracking-wider">
                    Dining Tables ({b.tables?.length || 0})
                  </h4>

                  {!b.tables || b.tables.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                      No dining tables configured for this branch. Click &quot;Add Table&quot; above
                      to allocate.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                      {b.tables.map((table: Table, idx: number) => {
                        const tableUrl = `${origin}/${restaurantUsername}?branch=${b.id}&table=${table.name.replace("Table ", "")}`;
                        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(tableUrl)}`;

                        return (
                          <div
                            key={idx}
                            onClick={() =>
                              setPreviewQr({
                                name: table.name,
                                location: table.location,
                                url: tableUrl,
                              })
                            }
                            className="bg-slate-50/50 border border-slate-200 hover:border-slate-350 hover:shadow-md rounded-2xl p-3 flex flex-col items-center gap-2.5 transition-all duration-300 group cursor-pointer relative"
                          >
                            {/* Action Buttons overlay */}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditTableModal(b.id, table, idx);
                                }}
                                className="p-1 rounded bg-white text-slate-500 hover:text-[#ff7a00] border border-slate-200 shadow-sm transition-colors"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTable(b.id, idx);
                                }}
                                className="p-1 rounded bg-white text-slate-500 hover:text-rose-600 border border-slate-200 shadow-sm transition-colors"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <div className="p-1.5 rounded-xl bg-white border border-slate-200 shadow-inner relative flex items-center justify-center select-none w-24 h-24 sm:w-28 sm:h-28 overflow-hidden group-hover:border-[#ff7a00] transition-colors duration-300">
                              <BeautifulQRCode value={tableUrl} tableName={table.name} size={96} />
                            </div>

                            <div className="flex flex-col items-center min-w-0 w-full text-center">
                              <div className="flex items-center gap-1 justify-center max-w-full">
                                <span className="text-[11px] font-extrabold text-slate-800 truncate">
                                  {table.name}
                                </span>
                                <span className="text-slate-400 hidden group-hover:inline-block">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </div>
                              <span className="text-[9px] font-bold text-[#ff7a00] uppercase tracking-wider mt-0.5">
                                {table.location}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
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

            <div className="flex flex-col items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center shadow-inner relative group">
              <div className="bg-white p-3 rounded-tr-2xl rounded-bl-2xl rounded-tl-none rounded-br-none border border-slate-200 shadow-md relative flex items-center justify-center select-none">
                <BeautifulQRCode value={previewQr.url} tableName={previewQr.name} size={180} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Scan to Open Menu
                </span>
                <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[280px] font-mono select-all">
                  {previewQr.url}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPreviewQr(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all text-center cursor-pointer"
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
          <div className="absolute inset-0 -z-10" onClick={() => setPreviewQr(null)} />
        </div>
      )}

      {/* Table QR Add/Edit Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                {qrModalMode === "add" ? "Add New Table Layout" : "Edit Table Settings"}
              </h3>
              <button
                onClick={() => setIsQrModalOpen(false)}
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQrTable} className="flex flex-col gap-4 text-left font-sans">
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
    </div>
  );
}
