"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Dropdown from "../../../ui/Dropdown";
import ImageUploader from "../../../ui/ImageUploader";
import {
  Menu,
  Bell,
  X,
  ChevronDown,
  Mail,
  Lock,
  Check,
  Edit2,
  Trash2,
  Filter,
  Plus,
  Eye,
  EyeOff,
  Key,
  Image as ImageIcon,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface StaffMember {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role: string;
  assignedBranchId: string;
  avatar: string;
  status: string;
}

export default function StaffPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("staff");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // States
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeActionMenuIdx, setActiveActionMenuIdx] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<
    "add" | "edit" | "change_password" | "change_avatar" | "change_role"
  >("add");
  const [editingStaffEmail, setEditingStaffEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("password123");
  const [formRole, setFormRole] = useState("CRM");
  const [formBranchId, setFormBranchId] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [formStatus, setFormStatus] = useState("Active");

  // Custom confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"ban" | "unban" | "delete">("ban");
  const [confirmStaff, setConfirmStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
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

      // Load Branches
      fetch("/api/tenant/branches")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setBranches(data);
          }
        })
        .catch((err) => console.error("Error loading branches:", err));

      // Load Staff list
      fetch("/api/tenant/staff")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setStaffList(
              data.map((s: StaffMember) => ({
                id: s.id,
                name: s.name,
                email: s.email,
                role: s.role,
                assignedBranchId: s.assignedBranchId || "",
                avatar: s.avatar || "",
                status: s.status || "Active",
              })),
            );
          }
        })
        .catch((err) => console.error("Error loading staff:", err));
    }
  }, [router]);

  const handleLogout = () => {
    router.push("/login");
  };

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "All" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  const getBranchName = (branchId: string) => {
    if (!branchId) return "All Branches";
    const branch = branches.find((b) => b.id === branchId);
    return branch ? branch.name : "All Branches";
  };

  const handleOpenAddModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("password123");
    setFormRole("manager");
    setFormBranchId("");
    setFormAvatar("");
    setFormStatus("Active");
    setModalMode("add");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaffEmail(staff.email);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPassword("");
    setFormRole(staff.role.toLowerCase());
    setFormBranchId(staff.assignedBranchId || "");
    setFormAvatar(staff.avatar || "");
    setFormStatus(staff.status || "Active");
    setModalMode("edit");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenChangePasswordModal = (staff: StaffMember) => {
    setEditingStaffEmail(staff.email);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPassword("");
    setFormRole(staff.role.toLowerCase());
    setFormBranchId(staff.assignedBranchId || "");
    setFormAvatar(staff.avatar || "");
    setFormStatus(staff.status || "Active");
    setModalMode("change_password");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenChangeAvatarModal = (staff: StaffMember) => {
    setEditingStaffEmail(staff.email);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPassword("");
    setFormRole(staff.role.toLowerCase());
    setFormBranchId(staff.assignedBranchId || "");
    setFormAvatar(staff.avatar || "");
    setFormStatus(staff.status || "Active");
    setModalMode("change_avatar");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenChangeRoleModal = (staff: StaffMember) => {
    setEditingStaffEmail(staff.email);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPassword("");
    setFormRole(staff.role.toLowerCase());
    setFormBranchId(staff.assignedBranchId || "");
    setFormAvatar(staff.avatar || "");
    setFormStatus(staff.status || "Active");
    setModalMode("change_role");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const refreshStaff = () => {
    fetch("/api/tenant/staff")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStaffList(
            data.map((s: StaffMember) => ({
              id: s.id,
              name: s.name,
              email: s.email,
              role: s.role,
              assignedBranchId: s.assignedBranchId || "",
              avatar: s.avatar || "",
              status: s.status || "Active",
            })),
          );
        }
      });
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      triggerToast("Name and Email are required.");
      return;
    }

    if (modalMode === "add") {
      fetch("/api/tenant/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole.toLowerCase(),
          assignedBranchId: formBranchId,
          avatar: formAvatar,
          status: formStatus,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            triggerToast(`Added staff ${formName}!`);
            refreshStaff();
          } else {
            triggerToast(data.error || "Failed to add staff.");
          }
        });
    } else {
      const staffToEdit = staffList.find(
        (s) => s.email.toLowerCase() === editingStaffEmail.toLowerCase(),
      );
      if (staffToEdit) {
        fetch("/api/tenant/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: staffToEdit.id,
            name: formName,
            email: formEmail,
            role: formRole.toLowerCase(),
            assignedBranchId: formBranchId,
            password: formPassword.trim() !== "" ? formPassword : "",
            avatar: formAvatar,
            status: formStatus,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              triggerToast(`Updated details for ${formName}!`);
              refreshStaff();
            } else {
              triggerToast(data.error || "Failed to update staff.");
            }
          });
      }
    }

    setIsModalOpen(false);
  };

  const handleToggleBanStaff = (staff: StaffMember) => {
    setConfirmStaff(staff);
    setConfirmMode(staff.status === "Banned" ? "unban" : "ban");
    setShowConfirmModal(true);
  };

  const handleToggleDeleteStaff = (staff: StaffMember) => {
    setConfirmStaff(staff);
    setConfirmMode("delete");
    setShowConfirmModal(true);
  };

  const handleExecuteConfirm = () => {
    if (!confirmStaff) return;

    if (confirmMode === "ban" || confirmMode === "unban") {
      const newStatus = confirmMode === "ban" ? "Banned" : "Active";
      fetch("/api/tenant/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: confirmStaff.id,
          name: confirmStaff.name,
          email: confirmStaff.email,
          role: confirmStaff.role.toLowerCase(),
          assignedBranchId: confirmStaff.assignedBranchId,
          password: "",
          avatar: confirmStaff.avatar,
          status: newStatus,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            triggerToast(
              `${confirmStaff.name} has been ${newStatus === "Banned" ? "banned" : "unbanned"}.`,
            );
            refreshStaff();
          } else {
            triggerToast(data.error || "Failed to update status.");
          }
        });
    } else if (confirmMode === "delete") {
      fetch(`/api/tenant/staff?id=${confirmStaff.id}`, {
        method: "DELETE",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            triggerToast(`Deleted staff ${confirmStaff.name}.`);
            refreshStaff();
          } else {
            triggerToast(data.error || "Failed to delete staff.");
          }
        })
        .catch(() => triggerToast("Network error."));
    }

    setShowConfirmModal(false);
    setConfirmStaff(null);
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
              <UsersIcon className="w-[18px] h-[18px] text-[#ff7a00]" />
              <span>Staff Management</span>
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
            <span className="text-xs font-semibold">{showToast}</span>
          </div>
        )}

        {/* Content Body matches reference container spacing */}
        <main className="p-4 sm:p-6 lg:p-8 w-full flex-1 flex flex-col gap-6">
          {/* Card Table matches shadow-xl border bg-card rounded-lg */}
          <div className="text-card-foreground shadow-xl border border-[#e1e7ef] bg-white rounded-[12px] flex flex-col lg:overflow-visible overflow-hidden">
            {/* Header controls matching references */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b border-[#e1e7ef] bg-white sticky top-0 z-20">
              <div className="font-semibold tracking-tight text-slate-900 text-xl">All Staff</div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* Search field */}
                <div className="relative grow w-full sm:w-auto sm:max-w-xs">
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex border border-[#e1e7ef] px-3 py-2 text-sm bg-[#eeeff2] h-10 rounded-[10px] shadow-sm w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff7a00] placeholder:text-slate-400 font-medium text-slate-800"
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    type="button"
                    className="flex items-center justify-between border border-[#e1e7ef] px-3 py-2 text-sm w-full sm:w-[150px] h-10 rounded-[10px] bg-[#eeeff2] hover:bg-[#e2e8f0] cursor-pointer text-slate-800 font-medium shadow-none transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <span>{statusFilter}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </button>

                  {showFilterDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowFilterDropdown(false)}
                      />
                      <div className="absolute right-0 mt-1 w-36 bg-white border border-[#e1e7ef] rounded-[10px] shadow-lg z-20 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {["All", "Active", "Banned"].map((status) => (
                          <button
                            key={status}
                            onClick={() => {
                              setStatusFilter(status);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full px-3.5 py-2 text-xs font-semibold text-left hover:bg-slate-50 transition-colors flex items-center justify-between ${
                              statusFilter === status
                                ? "text-[#ff7a00] bg-orange-50/20"
                                : "text-slate-700"
                            }`}
                          >
                            <span>{status}</span>
                            {statusFilter === status && (
                              <Check className="w-3.5 h-3.5 text-[#ff7a00]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Add New User */}
                <button
                  onClick={handleOpenAddModal}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-10 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white px-3 w-full sm:w-auto cursor-pointer shadow-sm transition-colors"
                  style={{ backgroundColor: "rgb(249, 115, 22)" }}
                >
                  <PlusCircleIcon className="h-4 w-4 text-white shrink-0" />
                  <span>Add New Staff</span>
                </button>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="overflow-x-auto lg:overflow-visible pb-28 lg:pb-0">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e1e7ef] bg-slate-50/20">
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 pl-6 w-[50px]">
                      SL
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 w-[80px]">
                      Avatar
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 min-w-[150px]">
                      Name
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 min-w-[200px]">
                      Email
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 min-w-[120px]">
                      Role
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 min-w-[100px]">
                      Status
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 min-w-[150px]">
                      Assigned Branch
                    </th>
                    <th className="h-12 px-4 align-middle font-medium text-slate-400 pr-6 text-right min-w-[80px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e1e7ef] text-xs font-medium text-slate-700">
                  {filteredStaff.length > 0 ? (
                    filteredStaff.map((staff, idx) => {
                      const openUpward =
                        idx >= filteredStaff.length - 2 && filteredStaff.length > 2;
                      const roleLower = staff.role.toLowerCase();
                      let roleBadgeStyle = {
                        backgroundColor: "rgb(20, 83, 45)", // Default CRM green
                        color: "#ffffff",
                      };
                      if (roleLower === "system admin" || roleLower === "owner") {
                        roleBadgeStyle = {
                          backgroundColor: "rgb(112, 48, 160)", // SYSTEM ADMIN/Owner purple
                          color: "#ffffff",
                        };
                      } else if (roleLower === "admin" || roleLower === "manager") {
                        roleBadgeStyle = {
                          backgroundColor: "rgb(30, 58, 138)", // ADMIN/Manager dark blue
                          color: "#ffffff",
                        };
                      } else if (roleLower === "kitchen") {
                        roleBadgeStyle = {
                          backgroundColor: "rgb(15, 118, 110)", // Kitchen teal
                          color: "#ffffff",
                        };
                      } else if (roleLower === "waiter") {
                        roleBadgeStyle = {
                          backgroundColor: "rgb(194, 65, 12)", // Waiter orange
                          color: "#ffffff",
                        };
                      }

                      const initials = staff.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          {/* SL */}
                          <td className="p-4 align-middle pl-6 font-mono text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Avatar */}
                          <td className="p-4 align-middle">
                            <span className="relative flex shrink-0 overflow-hidden rounded-full h-10 w-10 border border-[#e1e7ef]/70 shadow-2xs bg-white">
                              {staff.avatar ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={staff.avatar}
                                  alt={staff.name}
                                  className="aspect-square h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span
                                  className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 font-semibold"
                                  style={{
                                    color: "rgb(249, 116, 21)",
                                    backgroundColor: "rgba(249, 116, 21, 0.1)",
                                  }}
                                >
                                  {initials}
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="p-4 align-middle font-semibold text-slate-800">
                            {staff.name}
                          </td>

                          {/* Email */}
                          <td className="p-4 align-middle text-slate-400 font-normal">
                            {staff.email}
                          </td>

                          {/* Role Badge */}
                          <td className="p-4 align-middle">
                            <div
                              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border-none select-none tracking-wider text-[10px] uppercase"
                              style={roleBadgeStyle}
                            >
                              {staff.role}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-4 align-middle">
                            <div
                              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none text-[11px]"
                              style={{
                                color:
                                  staff.status === "Active"
                                    ? "rgb(21, 128, 61)"
                                    : "rgb(185, 28, 28)",
                                backgroundColor:
                                  staff.status === "Active"
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "rgba(239, 68, 68, 0.15)",
                                borderColor:
                                  staff.status === "Active"
                                    ? "rgba(34, 197, 94, 0.3)"
                                    : "rgba(239, 68, 68, 0.25)",
                              }}
                            >
                              {staff.status}
                            </div>
                          </td>

                          {/* Assigned Branch */}
                          <td className="p-4 align-middle text-slate-450 font-normal">
                            {getBranchName(staff.assignedBranchId)}
                          </td>

                          {/* Actions */}
                          <td className="p-4 align-middle pr-6 text-right relative">
                            <button
                              onClick={() =>
                                setActiveActionMenuIdx(activeActionMenuIdx === idx ? null : idx)
                              }
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-slate-100 h-9 w-9 text-slate-600 transition-colors cursor-pointer border-none bg-transparent"
                              title="Staff Actions"
                              type="button"
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </button>

                            {activeActionMenuIdx === idx && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setActiveActionMenuIdx(null)}
                                />
                                <div
                                  className={`absolute right-6 ${openUpward ? "bottom-full mb-1" : "mt-1"} w-40 bg-white border border-[#e1e7ef] rounded-[10px] shadow-lg z-20 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 text-left`}
                                >
                                  <button
                                    onClick={() => {
                                      handleOpenEditModal(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Edit Staff</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleOpenChangePasswordModal(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                                  >
                                    <Key className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Change Password</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleOpenChangeAvatarModal(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Change Avatar</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleOpenChangeRoleModal(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Change Role</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleToggleBanStaff(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className={`w-full px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent ${
                                      staff.status === "Banned"
                                        ? "text-emerald-600 hover:bg-emerald-50/50"
                                        : "text-amber-600 hover:bg-amber-50/50"
                                    }`}
                                  >
                                    {staff.status === "Banned" ? (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>Unban Staff</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Ban Staff</span>
                                      </>
                                    )}
                                  </button>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    onClick={() => {
                                      handleToggleDeleteStaff(staff);
                                      setActiveActionMenuIdx(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-red-50/50 transition-colors flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-450" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 px-6 text-center text-slate-400 font-semibold"
                      >
                        No staff found matching parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Add / Edit / Change Actions Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#f1f3f6] w-full max-w-md rounded-[20px] shadow-2xl p-7 flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-left font-sans relative border border-slate-200/50">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 hover:bg-slate-200/50 text-slate-400 hover:text-slate-650 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col gap-1 pr-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {modalMode === "add" && <Plus className="w-5 h-5 text-[#ff7a00]" />}
                {modalMode === "edit" && <Edit2 className="w-5 h-5 text-[#ff7a00]" />}
                {modalMode === "change_password" && <Key className="w-5 h-5 text-[#ff7a00]" />}
                {modalMode === "change_avatar" && <ImageIcon className="w-5 h-5 text-[#ff7a00]" />}
                {modalMode === "change_role" && <UserCheck className="w-5 h-5 text-[#ff7a00]" />}
                <span>
                  {modalMode === "add" && "Add New Staff"}
                  {modalMode === "edit" && `Edit Profile for ${formName}`}
                  {modalMode === "change_password" && `Change Password for ${formName}`}
                  {modalMode === "change_avatar" && `Set Avatar for ${formName}`}
                  {modalMode === "change_role" && `Change Role for ${formName}`}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {modalMode === "add" &&
                  "Create a new login profile and branch assignment for your staff."}
                {modalMode === "edit" &&
                  `Manage details, status, and permissions for ${formEmail}.`}
                {modalMode === "change_password" && `Set a new secure password for ${formEmail}.`}
                {modalMode === "change_avatar" && `Manage the profile picture for ${formEmail}.`}
                {modalMode === "change_role" &&
                  `Update permission levels and branch access for ${formEmail}.`}
              </p>
            </div>

            <form onSubmit={handleSaveStaff} className="flex flex-col gap-4">
              {(modalMode === "add" || modalMode === "edit") && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Abdul Awal"
                      className="h-10 px-3.5 rounded-[10px] border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-white"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="e.g. staff@example.com"
                        disabled={modalMode === "edit"}
                        className="w-full h-10 pl-10 pr-3.5 rounded-[10px] border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Secure Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={
                          modalMode === "add"
                            ? "Min 6 characters..."
                            : "Leave blank to keep existing..."
                        }
                        className="w-full h-10 pl-10 pr-10 rounded-[10px] border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-white"
                        required={modalMode === "add"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors p-0.5 rounded focus:outline-none cursor-pointer border-none bg-transparent"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Avatar Image
                    </label>
                    <div className="flex items-center gap-4">
                      {formAvatar ? (
                        <div className="relative w-12 h-12 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={formAvatar}
                            alt="Avatar Preview"
                            className="w-full h-full rounded-full object-cover border border-slate-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setFormAvatar("")}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-0.5 rounded-full hover:bg-rose-600 transition-colors shadow-sm cursor-pointer border-none flex items-center justify-center w-4.5 h-4.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-dashed border-slate-200 flex items-center justify-center text-slate-350 text-[10px] font-bold bg-white shrink-0 select-none">
                          No Photo
                        </div>
                      )}
                      <ImageUploader
                        onUploadSuccess={(url) => setFormAvatar(url)}
                        label="Upload Photo"
                        className="flex-1"
                        buttonClassName="h-12 w-full rounded-[10px] border-dashed bg-white border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Access Role
                      </label>
                      <Dropdown
                        value={formRole}
                        onChange={setFormRole}
                        options={[
                          { value: "admin", label: "Admin" },
                          { value: "owner", label: "Owner" },
                          { value: "manager", label: "Manager" },
                          { value: "kitchen", label: "Kitchen" },
                          { value: "waiter", label: "Waiter" },
                        ]}
                        className="w-full"
                        buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Staff Status
                      </label>
                      <Dropdown
                        value={formStatus}
                        onChange={setFormStatus}
                        options={[
                          { value: "Active", label: "Active" },
                          { value: "Banned", label: "Banned" },
                        ]}
                        className="w-full"
                        buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                        menuClassName="w-full left-0 right-0"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assigned Outlet Branch
                    </label>
                    <Dropdown
                      value={formBranchId}
                      onChange={setFormBranchId}
                      options={[
                        { value: "", label: "All Branches" },
                        ...branches.map((b) => ({ value: b.id, label: b.name })),
                      ]}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0 max-h-40 overflow-y-auto"
                    />
                  </div>
                </>
              )}

              {modalMode === "change_password" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    New Secure Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Min 6 characters..."
                      className="w-full h-10 pl-10 pr-10 rounded-[10px] border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#ff7a00] transition-colors bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors p-0.5 rounded focus:outline-none cursor-pointer border-none bg-transparent"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-1">
                    Passwords must be at least 6 characters long.
                  </div>
                </div>
              )}

              {modalMode === "change_avatar" && (
                <div className="flex flex-col gap-4">
                  <label className="text-xs font-bold text-slate-800">Profile Picture</label>
                  <div className="flex items-center gap-4">
                    {formAvatar ? (
                      <div className="relative w-20 h-20 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formAvatar}
                          alt="Avatar Preview"
                          className="w-full h-full rounded-full object-cover border-2 border-white shadow-md"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-bold bg-white shrink-0 select-none">
                        No Photo
                      </div>
                    )}

                    <ImageUploader
                      onUploadSuccess={(url) => setFormAvatar(url)}
                      label="Upload Image"
                      className="grow"
                      buttonClassName="h-11 rounded-xl bg-white border border-slate-200 text-slate-805 hover:bg-slate-50 border-solid select-none"
                    />
                  </div>

                  {formAvatar && (
                    <button
                      type="button"
                      onClick={() => setFormAvatar("")}
                      className="flex items-center gap-2 text-rose-500 hover:text-rose-600 text-xs font-bold bg-transparent border-none cursor-pointer p-0 w-fit"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <span>Remove Current Avatar</span>
                    </button>
                  )}

                  <div className="text-[11px] text-slate-400 font-medium">
                    Upload an image (JPG, PNG, GIF). Max 2MB.
                  </div>
                </div>
              )}

              {modalMode === "change_role" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      Access Role
                    </label>
                    <Dropdown
                      value={formRole}
                      onChange={setFormRole}
                      options={[
                        { value: "admin", label: "Admin" },
                        { value: "owner", label: "Owner" },
                        { value: "manager", label: "Manager" },
                        { value: "kitchen", label: "Kitchen" },
                        { value: "waiter", label: "Waiter" },
                      ]}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                      Assigned Outlet Branch
                    </label>
                    <Dropdown
                      value={formBranchId}
                      onChange={setFormBranchId}
                      options={[
                        { value: "", label: "All Branches" },
                        ...branches.map((b) => ({ value: b.id, label: b.name })),
                      ]}
                      className="w-full"
                      buttonClassName="w-full h-10 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] justify-between shadow-none font-semibold text-xs text-slate-800 text-left cursor-pointer"
                      menuClassName="w-full left-0 right-0 max-h-40 overflow-y-auto"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-200/50 hover:bg-slate-205 text-slate-700 text-xs font-bold transition-all cursor-pointer border-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-bold transition-all cursor-pointer border-none shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#f1f3f6] w-full max-w-md rounded-[20px] shadow-2xl p-7 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left font-sans border border-slate-200/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-bold text-slate-900">Are you sure?</h3>
                <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                  {confirmMode === "ban" && (
                    <>
                      You are about to ban the staff{" "}
                      <strong className="text-slate-850">&ldquo;{confirmStaff?.name}&rdquo;</strong>
                      . They will no longer be able to log in.
                    </>
                  )}
                  {confirmMode === "unban" && (
                    <>
                      You are about to unban the staff{" "}
                      <strong className="text-slate-850">&ldquo;{confirmStaff?.name}&rdquo;</strong>
                      . They will be able to log in again.
                    </>
                  )}
                  {confirmMode === "delete" && (
                    <>
                      You are about to delete the staff{" "}
                      <strong className="text-slate-850">&ldquo;{confirmStaff?.name}&rdquo;</strong>
                      . This action cannot be undone.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmStaff(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-200/50 hover:bg-slate-205 text-slate-700 text-xs font-bold transition-all cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer border-none shadow-xs ${
                  confirmMode === "unban"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirmMode === "ban" && "Yes, Ban Staff"}
                {confirmMode === "unban" && "Yes, Unban Staff"}
                {confirmMode === "delete" && "Yes, Delete Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline SVGs to avoid layout-specific next compiler issues
function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PlusCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function MoreVerticalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
