"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { RESTAURANTS, Branch } from "../data/restaurants";
import { useHorizontalScroll } from "../../lib/hooks";
import { EmojiProvider, Emoji } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import {
  Menu,
  Bell,
  Search,
  Plus,
  Minus,
  Trash2,
  Calculator,
  Printer,
  CheckCircle,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
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
  };
  return map[category.trim().toLowerCase()] || "sparkles";
};

// Menu items filtered to active restaurant (Burger Craft Lab, ID: 1)
const menuItems = (() => {
  const restaurant = RESTAURANTS.find((r) => r.id === 1);
  if (!restaurant) return [];
  return restaurant.menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    image: item.image,
  }));
})();

const categories = (() => {
  const cats = new Set<string>();
  menuItems.forEach((item) => cats.add(item.category));
  return ["All", ...Array.from(cats)];
})();

export default function PosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pos");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [tableNumber, setTableNumber] = useState("01");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Mobile">("Card");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const categoriesScrollRef = useHorizontalScroll();

  // Dynamic user roles and branch states
  const [userRole, setUserRole] = useState("admin");
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");
  const [selectedBranchId, setSelectedBranchId] = useState("dhanmondi");
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("userRole") || "admin";
      const name = localStorage.getItem("userDisplayName") || "Color Hut Admin";
      const branchId = localStorage.getItem("userAssignedBranchId") || "";

      setUserRole(role);
      setUserDisplayName(name);

      if (role === "manager" && branchId) {
        setSelectedBranchId(branchId);
      } else {
        setSelectedBranchId("dhanmondi");
      }
    }
  }, [router]);

  // Load branches
  React.useEffect(() => {
    const restaurant = RESTAURANTS.find((r) => r.id === 1);
    const defaults = restaurant?.branches || [];
    try {
      const storedBranchesStr = localStorage.getItem("restaurant_branches");
      if (storedBranchesStr) {
        const customs = JSON.parse(storedBranchesStr);
        setAllBranches([...defaults, ...customs]);
      } else {
        setAllBranches(defaults);
      }
    } catch {
      setAllBranches(defaults);
    }
  }, []);

  const handleLogout = () => {
    router.push("/login");
  };

  // Note: menuItems and categories are defined statically outside the component body

  const addToCart = (item: (typeof menuItems)[0]) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        return prev.map((x) => (x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: number, amount: number) => {
    setCart((prev) =>
      prev
        .map((x) => {
          if (x.id === itemId) {
            const newQty = x.quantity + amount;
            return newQty > 0 ? { ...x, quantity: newQty } : x;
          }
          return x;
        })
        .filter((x) => x.quantity > 0),
    );
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) => prev.filter((x) => x.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
  };

  // Calculations
  const subtotal = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const tax = subtotal * 0.05; // 5% VAT
  const discount = subtotal * (discountPercent / 100);
  const serviceFee = subtotal > 0 ? 2.5 : 0; // Flat service charge
  const total = Math.max(0, subtotal + tax + serviceFee - discount);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowReceiptModal(true);
  };

  const handleFinishCheckout = () => {
    setShowReceiptModal(false);
    clearCart();
  };

  const filteredItems = menuItems.filter((item) => {
    const matchCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

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

        {/* Main Terminal Frame */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
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
                <Calculator className="w-[18px] h-[18px] text-[#ff7a00]" />
                <span>POS Terminal Checkout</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Branch Switcher (Admin-only interactive) */}
              {userRole === "admin" && (
                <div className="relative">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={userRole !== "admin"}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white cursor-pointer text-slate-800 hover:bg-slate-50"
                  >
                    {allBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

          {/* Catalog and Billing panel split */}
          <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Catalog Panel (Left/Center) */}
            <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-5">
              {/* Search and Category Filters */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                {/* Category tabs */}
                <div
                  ref={categoriesScrollRef}
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none"
                >
                  {categories.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? "bg-[#ff7a00] text-white shadow-sm"
                          : "text-slate-550 hover:text-slate-850 bg-white border border-slate-200 hover:bg-slate-100"
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

                {/* Search Bar */}
                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search item code/name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00]/70 text-slate-900 placeholder-slate-400 shadow-sm"
                  />
                </div>
              </div>

              {/* Menu Items Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-white border border-slate-200 hover:border-[#ff7a00]/50 rounded-2xl p-3 flex flex-col gap-2.5 cursor-pointer hover:translate-y-[-2px] transition-all duration-200 select-none group shadow-sm hover:shadow-md"
                  >
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-[#ff7a00]">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Cart Panel (Right sidebar) */}
            <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden shrink-0">
              {/* Header / Table Select */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Current Cart
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Table:</span>
                  <select
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#ff7a00] px-2.5 py-1 focus:outline-none focus:border-[#ff7a00]"
                  >
                    {Array.from({ length: 20 }, (_, idx) => {
                      const num = String(idx + 1).padStart(2, "0");
                      return (
                        <option key={num} value={num}>
                          T-{num}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto pb-4 scrollbar-none">
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs gap-1.5">
                    <CreditCard className="w-8 h-8 text-slate-300" />
                    <span>Cart is empty. Click items on the left to add to bill.</span>
                  </div>
                ) : (
                  <div className="bg-white border-b border-slate-200 divide-y divide-slate-100">
                    {cart.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            ${item.price.toFixed(2)} each
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-slate-700">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 rounded text-slate-550 hover:text-slate-850 hover:bg-slate-200"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calculations & Checkout */}
              <div className="border-t border-slate-200 bg-slate-100/50 p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Subtotal:</span>
                  <span className="text-slate-800 font-bold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">VAT (5%):</span>
                  <span className="text-slate-800 font-bold">${tax.toFixed(2)}</span>
                </div>

                {/* Discount selection */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Discount (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent || ""}
                    onChange={(e) =>
                      setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
                    }
                    placeholder="0"
                    className="w-14 text-center px-1.5 py-0.5 text-xs font-bold bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00] rounded text-[#ff7a00]"
                  />
                </div>

                {subtotal > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Service Fee:</span>
                    <span className="text-slate-800 font-bold">${serviceFee.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Total Pay:
                  </span>
                  <span className="text-base font-black text-[#ff7a00]">${total.toFixed(2)}</span>
                </div>

                {/* Payment Methods */}
                <div className="grid grid-cols-3 gap-1.5 mt-1 border-t border-slate-200 pt-3">
                  {(["Cash", "Card", "Mobile"] as const).map((method) => {
                    const Icon =
                      method === "Cash" ? Banknote : method === "Card" ? CreditCard : Smartphone;
                    return (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          paymentMethod === method
                            ? "bg-[#ff7a00] border-[#ff7a00] text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-550 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{method}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Checkout Trigger */}
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" /> Place Order & Receipt
                </button>
              </div>
            </div>
          </main>
        </div>

        {/* Success checkout popup modal */}
        {showReceiptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-center items-center shadow-2xl animate-in zoom-in-95 duration-200">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black text-slate-900">Order Placed Successfully!</h3>
                <p className="text-xs text-slate-500">
                  Order sent to Kitchen display screen and receipt sent to POS kitchen printer.
                </p>
              </div>

              {/* Receipt Summary */}
              <div className="w-full bg-slate-50 rounded-xl p-4 text-left text-xs border border-slate-200 flex flex-col gap-2 font-mono">
                <div className="border-b border-dashed border-slate-200 pb-2 flex flex-col gap-1 text-[10px] text-slate-500">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>
                      BRANCH:{" "}
                      {(
                        allBranches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId
                      ).toUpperCase()}
                    </span>
                    <span>TABLE: T-{tableNumber}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>METHOD: {paymentMethod.toUpperCase()}</span>
                    <span>
                      TIME:{" "}
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {cart.map((c, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-slate-600">
                        {c.quantity}x {c.name}
                      </span>
                      <span className="text-slate-800">${(c.price * c.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between font-bold text-xs text-[#ff7a00]">
                  <span>TOTAL PAID</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleFinishCheckout}
                className="w-full py-2 bg-[#ff7a00] hover:bg-[#e06c00] text-xs font-bold text-white rounded-xl transition-all shadow-md"
              >
                Start New Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </EmojiProvider>
  );
}
