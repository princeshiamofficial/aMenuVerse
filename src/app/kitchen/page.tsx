"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { RESTAURANTS, Branch } from "../data/restaurants";
import { Menu, Bell, Check, ChefHat, X } from "lucide-react";
import KitchenOrderCard, { KitchenOrder, getStationForItem } from "../../../ui/KitchenOrderCard";

interface StoredLiveOrder {
  id: string;
  table: string;
  items: Array<{ name: string; quantity: number }>;
  status: KitchenOrder["status"];
  branchId: string;
}

// Synth Audio sound alert utilities
const playChime = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.15); // C5
    playTone(659.25, now + 0.1, 0.25); // E5
  } catch (e) {
    console.error("Audio chime playback failed:", e);
  }
};

const playOverdueWarning = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    playTone(392.0, now, 0.2); // G4
    playTone(392.0, now + 0.25, 0.2); // G4 alert
  } catch (e) {
    console.error("Warning audio playback failed:", e);
  }
};

export default function KitchenPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("kitchen");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Pop-up modal details state
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [modalState, setModalState] = useState<"closed" | "open" | "closing">("closed");

  // Dynamic user roles and branch states
  const [userRole, setUserRole] = useState("admin");
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");
  const [selectedBranchId, setSelectedBranchId] = useState("dhanmondi");
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  // Sliding tabs layout and audio states
  const selectedStation = "All";
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [openDropdownOrderId, setOpenDropdownOrderId] = useState<string | null>(null);

  // Auto unlock audio on first page click
  useEffect(() => {
    const unlock = () => {
      setIsAudioUnlocked(true);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  // Click outside listener to close card dropdowns
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenDropdownOrderId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
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
  useEffect(() => {
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

  const openModal = (order: KitchenOrder) => {
    setSelectedOrder(order);
    setModalState("open");
  };

  const closeModal = () => {
    setModalState("closing");
    setTimeout(() => {
      setModalState("closed");
      setSelectedOrder(null);
    }, 150);
  };

  const toggleItemChecked = (orderId: string, itemIndex: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const newItems = [...o.items];
          newItems[itemIndex] = { ...newItems[itemIndex], checked: !newItems[itemIndex].checked };
          const updatedOrder = { ...o, items: newItems };
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(updatedOrder);
          }
          return updatedOrder;
        }
        return o;
      }),
    );
  };

  const handleLogout = () => {
    router.push("/login");
  };

  // Mock Kitchen Orders State with 5 stages (assigned to branchIds)
  const [orders, setOrders] = useState<KitchenOrder[]>([
    {
      id: "ORD-8821",
      table: "04",
      items: [
        { name: "Classic Cheese Burger", quantity: 2, notes: "Well done patties", checked: false },
        { name: "Truffle Parmesan Fries", quantity: 1, checked: false },
      ],
      elapsedMinutes: 4,
      priority: "medium",
      status: "new",
      branchId: "dhanmondi",
    },
    {
      id: "ORD-8820",
      table: "12",
      items: [
        { name: "Truffle Mushroom Pizza", quantity: 1, notes: "Extra truffle oil", checked: false },
        { name: "Fresh Mint Lemonade", quantity: 1, checked: false },
      ],
      elapsedMinutes: 7,
      priority: "high",
      status: "new",
      branchId: "gulshan",
    },
    {
      id: "ORD-8819",
      table: "08",
      items: [
        { name: "Dragon Sushi Roll Platter", quantity: 1, checked: true },
        { name: "Spicy Sichuan Chilli Wontons", quantity: 1, checked: true },
      ],
      elapsedMinutes: 14,
      priority: "medium",
      status: "preparing",
      branchId: "uttara",
    },
    {
      id: "ORD-8818",
      table: "10",
      items: [{ name: "Truffle Mushroom Pizza", quantity: 1, checked: true }],
      elapsedMinutes: 3,
      priority: "high",
      status: "qa",
      branchId: "gulshan",
    },
    {
      id: "ORD-8816",
      table: "15",
      items: [
        { name: "Classic Cheese Burger", quantity: 1, checked: true },
        { name: "Truffle Parmesan Fries", quantity: 1, checked: true },
      ],
      elapsedMinutes: 8,
      priority: "low",
      status: "ready",
      branchId: "dhanmondi",
    },
    {
      id: "ORD-8815",
      table: "03",
      items: [
        { name: "Truffle Mushroom Pizza", quantity: 1, checked: true },
        { name: "Fresh Mint Lemonade", quantity: 2, checked: true },
      ],
      elapsedMinutes: 12,
      priority: "medium",
      status: "delivered",
      branchId: "uttara",
    },
  ]);

  // Load custom live orders from localStorage
  useEffect(() => {
    try {
      const storedOrdersStr = localStorage.getItem("live_orders");
      if (storedOrdersStr) {
        const liveOrders = JSON.parse(storedOrdersStr) as StoredLiveOrder[];
        setOrders((prev) => {
          const filteredLive = liveOrders
            .filter((l: StoredLiveOrder) => !prev.some((p) => p.id === l.id))
            .map((l: StoredLiveOrder) => ({
              id: l.id,
              table: l.table,
              items: l.items.map((i: { name: string; quantity: number }) => ({
                name: i.name,
                quantity: i.quantity,
                checked: false,
              })),
              elapsedMinutes: 1,
              priority: "medium" as const,
              status: l.status,
              branchId: l.branchId,
            }));
          return [...filteredLive, ...prev];
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Audio notification when new orders arrive
  const prevOrderIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentIds = orders.map((o) => o.id);
    const hasNewOrder = currentIds.some((id) => !prevOrderIdsRef.current.includes(id));
    if (prevOrderIdsRef.current.length > 0 && hasNewOrder && isAudioUnlocked) {
      playChime();
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, isAudioUnlocked]);

  // Simulate timer incrementing every minute and checking for newly overdue stages
  useEffect(() => {
    const timer = setInterval(() => {
      setOrders((prev) => {
        const nextOrders = prev.map((o) => ({ ...o, elapsedMinutes: o.elapsedMinutes + 1 }));

        if (isAudioUnlocked) {
          const anyNewlyOverdue = nextOrders.some((o) => {
            let limit = 15;
            if (o.status === "preparing") limit = 25;
            else if (o.status === "qa") limit = 5;
            else if (o.status === "ready") limit = 10;
            else if (o.status === "delivered") limit = 15;

            return o.elapsedMinutes === limit;
          });
          if (anyNewlyOverdue) {
            playOverdueWarning();
          }
        }

        return nextOrders;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [isAudioUnlocked]);

  const moveOrder = (orderId: string, nextStatus: KitchenOrder["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
  };

  const completeOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // Drag and Drop Handlers are currently unused in grid layout

  // Filter orders by branch and prep station
  const filteredOrders = orders
    .filter((o) => o.branchId === selectedBranchId)
    .filter((o) => {
      if (selectedStation === "All") return true;
      return o.items.some((item) => getStationForItem(item.name) === selectedStation);
    });

  // Sort orders for Compact Grid view (High priority & Oldest first, excluding delivered/served orders)
  const gridSortedOrders = [...filteredOrders]
    .filter((o) => o.status !== "delivered")
    .sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const weightA = priorityWeight[a.priority] || 2;
      const weightB = priorityWeight[b.priority] || 2;
      if (weightA !== weightB) return weightB - weightA;
      return b.elapsedMinutes - a.elapsedMinutes;
    });

  return (
    <div className="min-h-screen bg-black flex text-slate-200 font-sans overflow-hidden">
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

      {/* Main KDS Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800 flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#ff7a00]" />
              <span>Kitchen Display System (KDS)</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Branch Switcher (Admin-only interactive) */}
            {userRole === "admin" && (
              <div className="relative">
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white cursor-pointer text-slate-800 hover:bg-slate-50 focus:outline-none"
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
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors relative">
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff7a00] ring-2 ring-white" />
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200" />
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

        {/* KDS Grid Area (Responsive Vertical Scroll) */}
        <main className="flex-1 p-6 overflow-y-auto bg-black h-full flex flex-col relative">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-85 z-0 pointer-events-none"
            style={{ backgroundImage: "url('/kitchen-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/75 z-0 pointer-events-none" />
          <div className="relative z-10 flex-1 flex flex-col">
            {gridSortedOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <ChefHat className="w-12 h-12 text-slate-400 mb-3" />
                <span className="text-slate-200 font-bold text-sm">No active orders</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,300px)] gap-4 justify-start items-start">
                {gridSortedOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    now={new Date()}
                    selectedStation={selectedStation}
                    openDropdownOrderId={openDropdownOrderId}
                    setOpenDropdownOrderId={setOpenDropdownOrderId}
                    moveOrder={moveOrder}
                    onCardClick={() => openModal(order)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Popup for Order Details */}
      {modalState !== "closed" && selectedOrder && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200 ${
            modalState === "open" ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`t-modal bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 text-left shadow-2xl ${
              modalState === "open" ? "is-open" : "is-closing"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">Order Details</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                    {selectedOrder.id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Table {selectedOrder.table} &bull; {selectedOrder.items.length} items
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items Checklist */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Ordered Items Checklist
                </label>
                <span className="text-[10px] text-slate-400 italic">
                  Tap items to toggle preparation check
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {selectedOrder.items.map((item, idx) => {
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleItemChecked(selectedOrder.id, idx)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                        item.checked
                          ? "bg-slate-50 border-slate-200 text-slate-400"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-sm"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                          item.checked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 hover:border-slate-400 bg-white"
                        }`}
                      >
                        {item.checked && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <p
                          className={`text-xs font-bold leading-tight ${item.checked ? "line-through text-slate-400" : ""}`}
                        >
                          {item.name}{" "}
                          <span className="text-[#ff7a00] font-black">x{item.quantity}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-slate-100 pt-4 mt-1">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back to Board
              </button>

              <button
                type="button"
                onClick={() => {
                  const statusTransitions: Record<
                    KitchenOrder["status"],
                    KitchenOrder["status"] | "archive"
                  > = {
                    new: "preparing",
                    preparing: "qa",
                    qa: "ready",
                    ready: "delivered",
                    delivered: "archive",
                  };
                  const next = statusTransitions[selectedOrder.status];
                  if (next === "archive") {
                    completeOrder(selectedOrder.id);
                  } else {
                    moveOrder(selectedOrder.id, next);
                  }
                  closeModal();
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-md hover:shadow-lg active:scale-95 ${
                  selectedOrder.status === "new"
                    ? "bg-[#0082c9] hover:bg-[#0082c9]/90"
                    : selectedOrder.status === "preparing"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : selectedOrder.status === "qa"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : selectedOrder.status === "ready"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {selectedOrder.status === "new" && "Start Preparing"}
                {selectedOrder.status === "preparing" && "Send to QA"}
                {selectedOrder.status === "qa" && "Ready for Delivery"}
                {selectedOrder.status === "ready" && "Complete & Deliver"}
                {selectedOrder.status === "delivered" && "Archive Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
