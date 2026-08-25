"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { RESTAURANTS, Branch } from "../data/restaurants";
import { Menu, Bell, Search, X, Clock, Printer } from "lucide-react";

interface Order {
  id: string;
  table: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  time: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled" | "unpaid";
  paymentType: "Cash" | "Card" | "Unpaid";
  customerName?: string;
  branchId?: string;
  branchName?: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("orders");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<
    "all" | "active" | "completed" | "unpaid" | "cancelled"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Dynamic user roles and branch states
  const [userRole, setUserRole] = useState("admin");
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

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
        setSelectedBranchId("all");
      }
    }
  }, [router]);

  // Load branches
  useEffect(() => {
    fetch("/api/tenant/branches")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllBranches(data);
        }
      })
      .catch((err) => console.error("Error loading branches:", err));
  }, []);

  const handleLogout = () => {
    router.push("/login");
  };

  const [orders, setOrders] = useState<Order[]>([]);

  // Load live orders from database API
  const refreshOrders = () => {
    fetch("/api/tenant/orders")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(
            data.map((o: any) => ({
              id: o.id,
              table: o.table,
              items: o.items,
              time: new Date(o.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: o.status.toLowerCase(),
              paymentType: "Unpaid",
              branchId: o.branchId,
              branchName: o.branchName,
            })),
          );
        }
      })
      .catch((err) => console.error("Error loading orders:", err));
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      // Capitalize to match db values (e.g. Preparing, Ready, Completed, etc.)
      const dbStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      const response = await fetch("/api/tenant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: dbStatus }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      } else {
        alert(data.error || "Failed to update order status.");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const printReceipt = (order: Order) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const receiptHtml = `
      <html>
      <head>
        <title>Receipt ${order.id}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 15px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            color: #000;
            width: 76mm;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .header { margin-bottom: 12px; }
          .restaurant-name { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .item-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          .item-table th, .item-table td { padding: 3px 0; text-align: left; vertical-align: top; }
          .item-table th { font-weight: bold; }
          .totals-table { width: 100%; margin-top: 6px; }
          .totals-table td { padding: 2px 0; }
          .footer { margin-top: 18px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header text-center">
          <div class="restaurant-name">Red Chili Chinese</div>
          <div>Digital Menu POS System</div>
          <div class="divider"></div>
          <div><strong>Order Receipt</strong></div>
          <div>Order ID: ${order.id}</div>
          <div>Table: Table ${order.table}</div>
          <div>Time: ${order.time}</div>
          ${order.customerName ? `<div>Customer: ${order.customerName}</div>` : ""}
        </div>
        
        <div class="divider"></div>
        
        <table class="item-table">
          <thead>
            <tr>
              <th style="width: 55%;">Item</th>
              <th style="width: 15%; text-align: center;">Qty</th>
              <th style="width: 30%; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (item) => `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table class="totals-table">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Payment:</td>
            <td style="text-align: right;">${order.paymentType}</td>
          </tr>
          <tr class="bold">
            <td>Total:</td>
            <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <div class="footer text-center">
          <p>Thank you for dining with us!</p>
          <p>Powered by Digital Food Menu</p>
        </div>
        
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              window.frameElement.parentNode.removeChild(window.frameElement);
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(receiptHtml);
    doc.close();
  };

  const calculateSubtotal = (order: Order) => {
    return order.items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  };

  const filteredOrders = orders.filter((o) => {
    // Branch Filter
    if (selectedBranchId !== "all" && o.branchId !== selectedBranchId) return false;

    // Tab Filter
    if (filterTab === "active" && (o.status === "completed" || o.status === "cancelled"))
      return false;
    if (filterTab === "completed" && o.status !== "completed") return false;
    if (filterTab === "unpaid" && o.status !== "unpaid" && o.paymentType !== "Unpaid") return false;
    if (filterTab === "cancelled" && o.status !== "cancelled") return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = o.id.toLowerCase().includes(q);
      const matchTable = o.table.includes(q);
      const matchItem = o.items.some((item) => item.name.toLowerCase().includes(q));
      return matchId || matchTable || matchItem;
    }
    return true;
  });

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
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800">
              Order Management
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
                  <option value="all">All Branches</option>
                  {allBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-550 hover:text-slate-850 transition-colors relative">
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

        {/* Content Area */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* List panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
              {/* Tab Filters */}
              <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-slate-200 self-start shadow-sm">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "completed", label: "Completed" },
                  { id: "unpaid", label: "Unpaid" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setFilterTab(
                        tab.id as "all" | "active" | "completed" | "unpaid" | "cancelled",
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filterTab === tab.id
                        ? "bg-[#ff7a00] text-white shadow-sm"
                        : "text-slate-550 hover:text-slate-850 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by ID, Table, Dish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00]/70 text-slate-900 placeholder-slate-400 shadow-sm"
                />
              </div>
            </div>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm">
                  <span className="text-slate-500 text-sm">No orders found matching criteria.</span>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const subtotal = calculateSubtotal(order);
                  let statusBg = "border-amber-500/20 text-amber-600 bg-amber-500/5";
                  if (order.status === "completed")
                    statusBg = "border-emerald-500/20 text-emerald-600 bg-emerald-500/5";
                  if (order.status === "cancelled")
                    statusBg = "border-rose-500/20 text-rose-600 bg-rose-500/5";
                  if (order.status === "pending")
                    statusBg = "border-orange-500/20 text-[#ff7a00] bg-orange-500/5";
                  if (order.status === "ready")
                    statusBg = "border-blue-500/20 text-blue-600 bg-blue-500/5";

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col gap-3.5 hover:translate-y-[-2px] ${
                        selectedOrder?.id === order.id
                          ? "border-[#ff7a00] ring-1 ring-[#ff7a00]/30 shadow-[#ff7a00]/5"
                          : "border-slate-200 hover:border-slate-350"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-800">{order.id}</span>
                          <span className="text-[10px] text-slate-500">
                            {order.time} • {order.customerName || "Walk-in Guest"}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${statusBg}`}
                        >
                          {order.status}
                        </span>
                      </div>

                      {/* Items Preview */}
                      <div className="flex-1 flex flex-col gap-1.5 py-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-slate-650 font-semibold">
                              <span className="text-[#ff7a00] font-bold mr-1">
                                {item.quantity}x
                              </span>{" "}
                              {item.name}
                            </span>
                            <span className="text-slate-500 font-semibold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wide text-slate-400">
                            Table
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[#ff7a00] text-[11px]">
                            {order.table}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500">Total Bill</span>
                          <span className="font-bold text-slate-800 text-[13px]">
                            ${subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Details Sidebar panel */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden shrink-0">
            {selectedOrder ? (
              <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 gap-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-850">Order Details</span>
                    <span className="text-xs text-slate-500">
                      {selectedOrder.id} • Table {selectedOrder.table}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Details Section */}
                <div className="flex flex-col gap-4 text-xs">
                  {/* Status Badge Selector */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Change Status
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "pending", label: "Pending" },
                        { id: "preparing", label: "Preparing" },
                        { id: "ready", label: "Ready" },
                        { id: "completed", label: "Completed" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() =>
                            updateOrderStatus(selectedOrder.id, st.id as Order["status"])
                          }
                          className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                            selectedOrder.status === st.id
                              ? "bg-[#ff7a00] border-[#ff7a00] text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-650 hover:bg-slate-100"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unified Order Card */}
                  <div className="flex flex-col gap-2 mt-2 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 pb-1.5">
                      Items
                    </span>
                    <div className="flex flex-col gap-2">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-slate-650 font-semibold">
                            <span className="text-[#ff7a00] mr-1">{item.quantity}x</span>{" "}
                            {item.name}
                          </span>
                          <span className="text-slate-800 font-bold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-y border-slate-100 py-2.5 my-1 flex justify-between font-bold text-sm">
                      <span className="text-slate-700">Total</span>
                      <span className="text-[#ff7a00]">
                        ${calculateSubtotal(selectedOrder).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Customer:</span>
                        <span className="text-slate-700 font-bold">
                          {selectedOrder.customerName || "Walk-in"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Ordered At:</span>
                        <span className="text-slate-700 font-bold">{selectedOrder.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Payment:</span>
                        <span
                          className={`font-bold ${selectedOrder.paymentType === "Unpaid" ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {selectedOrder.paymentType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      onClick={() => selectedOrder && printReceipt(selectedOrder)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs text-slate-800 font-bold transition-all shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-slate-400" /> Print Bill Receipt
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                        className="flex-1 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs text-rose-600 font-bold transition-all"
                      >
                        Cancel Order
                      </button>
                      <button
                        onClick={() => updateOrderStatus(selectedOrder.id, "completed")}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs text-white font-bold transition-all shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
                      >
                        Fulfill Order
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs gap-2">
                <Clock className="w-8 h-8 text-slate-300" />
                <span>Select an order from the list to manage and review item checklists.</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
