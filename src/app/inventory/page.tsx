"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import StatsCard from "../../../ui/StatsCard";
import Dropdown from "../../../ui/Dropdown";
import { EmojiProvider, Emoji } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import {
  Menu,
  Bell,
  Search,
  Plus,
  Check,
  X,
  Package,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stockLevel: number;
  unit: string;
  status: "in-stock" | "low-stock" | "out-of-stock";
  unitCost: number;
}

interface LogEntry {
  time: string;
  action: string;
  item: string;
  quantity: string;
}

const getCategoryAppleEmojiName = (category: string): string => {
  const map: Record<string, string> = {
    all: "fork-and-knife-with-plate",
    popular: "fire",
    burgers: "hamburger",
    sides: "french-fries",
    beverages: "cup-with-straw",
    pizza: "pizza",
    pasta: "spaghetti",
    desserts: "shortcake",
    sushi: "sushi",
    ramen: "steaming-bowl",
    appetizers: "dumpling",
    mains: "pot-of-food",
    "rice & noodles": "curry-rice",
    japanese: "sushi",
    asian: "chopsticks",
    ingredients: "egg",
  };
  return map[category.trim().toLowerCase()] || "sparkles";
};

export default function InventoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inventory");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in-stock" | "low-stock" | "out-of-stock"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState<string | null>(null);

  // Adjustment Modal state
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);

  // Add Item Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Ingredients");
  const [newItemStockLevel, setNewItemStockLevel] = useState(0);
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemUnitCost, setNewItemUnitCost] = useState(0);

  const handleLogout = () => {
    router.push("/login");
  };

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Mock Stock Data
  const [items, setItems] = useState<InventoryItem[]>([
    {
      id: "INV-001",
      name: "Premium Burger Buns",
      category: "Burgers",
      stockLevel: 120,
      unit: "pcs",
      status: "in-stock",
      unitCost: 0.4,
    },
    {
      id: "INV-002",
      name: "Beef Patties (150g)",
      category: "Burgers",
      stockLevel: 85,
      unit: "pcs",
      status: "in-stock",
      unitCost: 2.1,
    },
    {
      id: "INV-003",
      name: "Cheddar Cheese Slices",
      category: "Ingredients",
      stockLevel: 15,
      unit: "pcs",
      status: "low-stock",
      unitCost: 0.15,
    },
    {
      id: "INV-004",
      name: "Veal Bacon Strips",
      category: "Ingredients",
      stockLevel: 8,
      unit: "kg",
      status: "low-stock",
      unitCost: 12.0,
    },
    {
      id: "INV-005",
      name: "Truffle Oil",
      category: "Ingredients",
      stockLevel: 2,
      unit: "L",
      status: "low-stock",
      unitCost: 45.0,
    },
    {
      id: "INV-006",
      name: "Fresh Salmon Fillet",
      category: "Japanese",
      stockLevel: 14,
      unit: "kg",
      status: "in-stock",
      unitCost: 28.0,
    },
    {
      id: "INV-007",
      name: "Sichuan Chilli Flakes",
      category: "Asian",
      stockLevel: 18,
      unit: "kg",
      status: "in-stock",
      unitCost: 6.5,
    },
    {
      id: "INV-008",
      name: "Fresh Mint Leaves",
      category: "Beverages",
      stockLevel: 4,
      unit: "kg",
      status: "in-stock",
      unitCost: 3.0,
    },
    {
      id: "INV-009",
      name: "Pickled Jalapenos",
      category: "Ingredients",
      stockLevel: 0,
      unit: "kg",
      status: "out-of-stock",
      unitCost: 5.5,
    },
  ]);

  // Mock Log Entries
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: "16:20", action: "Dispatched", item: "Beef Patties (150g)", quantity: "-4 pcs" },
    { time: "15:45", action: "Stock Added", item: "Premium Burger Buns", quantity: "+100 pcs" },
    { time: "14:10", action: "Dispatched", item: "Cheddar Cheese Slices", quantity: "-12 pcs" },
    { time: "11:30", action: "Stock Added", item: "Fresh Mint Leaves", quantity: "+5 kg" },
  ]);

  const categories = ["All", "Burgers", "Japanese", "Asian", "Beverages", "Ingredients"];

  const handleAdjustStock = () => {
    if (!adjustingItem || adjustAmount === 0) return;

    const newQty = Math.max(0, adjustingItem.stockLevel + adjustAmount);
    let nextStatus: InventoryItem["status"] = "in-stock";
    if (newQty === 0) nextStatus = "out-of-stock";
    else if (newQty < 20) nextStatus = "low-stock";

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === adjustingItem.id) {
          return {
            ...item,
            stockLevel: newQty,
            status: nextStatus,
          };
        }
        return item;
      }),
    );

    // Add entry to history log
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLogs((prev) => [
      {
        time: timeStr,
        action: adjustAmount > 0 ? "Stock Added" : "Dispatched",
        item: adjustingItem.name,
        quantity: `${adjustAmount > 0 ? "+" : ""}${adjustAmount} ${adjustingItem.unit}`,
      },
      ...prev,
    ]);

    triggerToast(
      `Stock level for "${adjustingItem.name}" updated to ${newQty} ${adjustingItem.unit}`,
    );
    setAdjustingItem(null);
    setAdjustAmount(0);
  };

  const calculateStockValue = () => {
    return items.reduce((acc, curr) => acc + curr.stockLevel * curr.unitCost, 0);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemCategory) return;

    const newId = `INV-${String(items.length + 1).padStart(3, "0")}`;
    let status: InventoryItem["status"] = "in-stock";
    if (newItemStockLevel === 0) status = "out-of-stock";
    else if (newItemStockLevel < 20) status = "low-stock";

    const item: InventoryItem = {
      id: newId,
      name: newItemName,
      category: newItemCategory,
      stockLevel: newItemStockLevel,
      unit: newItemUnit,
      status: status,
      unitCost: newItemUnitCost,
    };

    setItems((prev) => [...prev, item]);

    // Add log entry
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLogs((prev) => [
      {
        time: timeStr,
        action: "Item Added",
        item: newItemName,
        quantity: `+${newItemStockLevel} ${newItemUnit}`,
      },
      ...prev,
    ]);

    triggerToast(`New item "${newItemName}" added successfully.`);

    // Reset form and close
    setNewItemName("");
    setNewItemCategory("Ingredients");
    setNewItemStockLevel(0);
    setNewItemUnit("pcs");
    setNewItemUnitCost(0);
    setShowAddModal(false);
  };

  const filteredItems = items.filter((item) => {
    const matchCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchStatus && matchSearch;
  });

  // Count stats
  const totalStockItems = items.length;
  const lowStockCount = items.filter((x) => x.status === "low-stock").length;
  const outOfStockCount = items.filter((x) => x.status === "out-of-stock").length;

  const inventoryStats = [
    {
      label: "Cataloged Items",
      value: `${totalStockItems} Items`,
      icon: Package,
      iconColorClass: "text-[#1A73E8]",
      iconBgClass: "bg-[#E8F0FE]",
    },
    {
      label: "Low Stock Warning",
      value: `${lowStockCount} Items`,
      icon: AlertTriangle,
      iconColorClass: "text-[#EA580C]",
      iconBgClass: "bg-[#FFF3D2]",
    },
    {
      label: "Out of Stock",
      value: `${outOfStockCount} Items`,
      icon: X,
      iconColorClass: "text-[#D93025]",
      iconBgClass: "bg-[#FCE8E6]",
    },
    {
      label: "Stock Valuation",
      value: `$${calculateStockValue().toFixed(2)}`,
      icon: DollarSign,
      iconColorClass: "text-[#ff7a00]",
      iconBgClass: "bg-[#FFF5E6]",
    },
  ];

  return (
    <EmojiProvider data={emojiData}>
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
                <Package className="w-5 h-5 text-[#ff7a00]" />
                <span>Inventory Management</span>
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
                  Color Hut Admin
                </span>
              </div>
            </div>
          </header>

          {/* Floating Toast Notification */}
          {showToast && (
            <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/35 bg-emerald-955/90 text-emerald-305 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold">{showToast}</span>
            </div>
          )}

          {/* Content Body */}
          <main className="p-6 w-full flex-1 flex flex-col gap-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {inventoryStats.map((stat, i) => (
                <StatsCard
                  key={i}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  iconColorClass={stat.iconColorClass}
                  iconBgClass={stat.iconBgClass}
                />
              ))}
            </div>

            {/* Catalog & History Split */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* Left: Inventory List Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-2 flex flex-col gap-5">
                {/* Controls Header */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                  {/* Category tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none">
                    {categories.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          selectedCategory === cat
                            ? "bg-[#ff7a00] text-white shadow-sm"
                            : "text-slate-550 hover:text-slate-850 bg-slate-50 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          <Emoji
                            name={getCategoryAppleEmojiName(cat)}
                            className="w-full h-full object-contain"
                          />
                        </span>
                        <span>{cat}</span>
                      </button>
                    ))}
                  </div>

                  {/* Filters Row */}
                  <div className="flex gap-2 shrink-0">
                    {/* Add Item Button */}
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>

                    {/* Status Dropdown */}
                    <Dropdown
                      value={statusFilter}
                      onChange={(val) =>
                        setStatusFilter(val as "all" | "in-stock" | "low-stock" | "out-of-stock")
                      }
                      options={[
                        { value: "all", label: "All Status" },
                        { value: "in-stock", label: "In Stock" },
                        { value: "low-stock", label: "Low Stock" },
                        { value: "out-of-stock", label: "Out of Stock" },
                      ]}
                    />

                    {/* Search box */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search stock..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00]/70 text-slate-900 placeholder-slate-400 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Table list */}
                <div className="overflow-x-auto scrollbar-none">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                        <th className="pb-3 pl-2">Item ID</th>
                        <th className="pb-3">Name</th>
                        <th className="pb-3">Category</th>
                        <th className="pb-3 text-right">Units</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3 text-right">Unit Cost</th>
                        <th className="pb-3 text-right pr-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredItems.map((item) => {
                        let badge = "text-slate-500 bg-slate-100 border-slate-200/50";
                        if (item.status === "in-stock")
                          badge = "text-emerald-600 bg-emerald-50 border-emerald-200/50";
                        if (item.status === "low-stock")
                          badge = "text-amber-600 bg-amber-50 border-amber-200/50";
                        if (item.status === "out-of-stock")
                          badge = "text-rose-600 bg-rose-50 border-rose-200/50";

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="py-3.5 pl-2 font-semibold text-slate-500">{item.id}</td>
                            <td className="py-3.5 font-bold text-slate-800">{item.name}</td>
                            <td className="py-3.5 text-slate-500">{item.category}</td>
                            <td className="py-3.5 text-right font-bold text-slate-700">
                              {item.stockLevel}{" "}
                              <span className="text-[10px] text-slate-400 font-normal">
                                {item.unit}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge}`}
                              >
                                {item.status.replace("-", " ")}
                              </span>
                            </td>
                            <td className="py-3.5 text-right font-semibold text-slate-600">
                              ${item.unitCost.toFixed(2)}
                            </td>
                            <td className="py-3.5 text-right pr-2">
                              <button
                                onClick={() => setAdjustingItem(item)}
                                className="text-[10px] font-bold text-[#ff7a00] hover:text-slate-800 border border-[#ff7a00]/30 hover:border-slate-800/40 px-2 py-1 rounded-lg transition-colors bg-white hover:bg-slate-50"
                              >
                                Adjust Stock
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: History Log Feed */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                    Stock Activity Log
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Record of latest stock adjustments
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 shadow-sm text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800">{log.item}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {log.time} • {log.action}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-sm ${log.quantity.startsWith("+") ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {log.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Adjust Stock Level Modal popup */}
        {adjustingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900">Adjust Inventory Stock</span>
                  <span className="text-xs text-slate-500">
                    {adjustingItem.name} ({adjustingItem.id})
                  </span>
                </div>
                <button
                  onClick={() => setAdjustingItem(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quantity control */}
              <div className="flex flex-col gap-2 py-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Current Stock Level
                </span>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-200 font-semibold">
                  <span className="text-xs text-slate-700">Currently in Vault:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {adjustingItem.stockLevel} {adjustingItem.unit}
                  </span>
                </div>

                <span className="text-[10px] uppercase font-bold text-slate-450 mt-2">
                  Adjust Quantity
                </span>
                <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-2 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdjustAmount((prev) => prev - 10)}
                    className="p-2 bg-white rounded-lg border border-slate-200 font-bold hover:bg-slate-100 text-xs shrink-0"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAmount((prev) => prev - 1)}
                    className="p-2 bg-white rounded-lg border border-slate-200 font-bold hover:bg-slate-100 text-xs shrink-0"
                  >
                    -1
                  </button>

                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-black text-slate-800 text-sm focus:outline-none bg-transparent"
                  />

                  <button
                    type="button"
                    onClick={() => setAdjustAmount((prev) => prev + 1)}
                    className="p-2 bg-white rounded-lg border border-slate-200 font-bold hover:bg-slate-100 text-xs shrink-0"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAmount((prev) => prev + 10)}
                    className="p-2 bg-white rounded-lg border border-slate-200 font-bold hover:bg-slate-100 text-xs shrink-0"
                  >
                    +10
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setAdjustingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs text-slate-650 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustStock}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md shadow-emerald-500/10"
                >
                  Apply Change
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add New Item Modal popup */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <form
              onSubmit={handleAddItem}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Add New Inventory Item</h3>
                  <p className="text-xs text-slate-500">
                    Create a new item in the inventory catalog
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3 py-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fresh Tomatoes"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">
                      Category
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold"
                    >
                      {categories
                        .filter((c) => c !== "All")
                        .map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Unit</label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-bold"
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="bags">bags</option>
                      <option value="cans">cans</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newItemStockLevel || ""}
                      onChange={(e) =>
                        setNewItemStockLevel(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      placeholder="0"
                      className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">
                      Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newItemUnitCost || ""}
                      onChange={(e) =>
                        setNewItemUnitCost(Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      placeholder="0.00"
                      className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs text-slate-655 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md shadow-emerald-500/10"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </EmojiProvider>
  );
}
