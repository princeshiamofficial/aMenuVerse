"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { EmojiProvider, Emoji } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import { Menu, Bell, Search, Plus, Edit, Trash2, X, Tags, Check } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  emoji?: string;
}

const AVAILABLE_MENU_EMOJIS = [
  // Fast Food & Mains
  { name: "hamburger", label: "🍔" },
  { name: "french-fries", label: "🍟" },
  { name: "pizza", label: "🍕" },
  { name: "spaghetti", label: "🍝" },
  { name: "steaming-bowl", label: "🍜" },
  { name: "sushi", label: "🍣" },
  { name: "dumpling", label: "🥟" },
  { name: "pot-of-food", label: "🍲" },
  { name: "curry-rice", label: "🍛" },
  { name: "taco", label: "🌮" },
  { name: "burrito", label: "🌯" },
  { name: "hot-dog", label: "🌭" },
  { name: "sandwich", label: "🥪" },
  { name: "poultry-leg", label: "🍗" },
  { name: "meat-on-bone", label: "🍖" },
  { name: "bacon", label: "🥓" },
  { name: "fried-shrimp", label: "🍤" },

  // Drinks & Beverages
  { name: "cup-with-straw", label: "🥤" },
  { name: "bubble-tea", label: "🧋" },
  { name: "hot-beverage", label: "☕" },
  { name: "teapot", label: "🫖" },
  { name: "beer-mug", label: "🍺" },
  { name: "clinking-beer-mugs", label: "🍻" },
  { name: "wine-glass", label: "🍷" },
  { name: "cocktail-glass", label: "🍸" },
  { name: "tropical-drink", label: "🍹" },
  { name: "sake", label: "🍶" },
  { name: "bottle-with-popping-cork", label: "🍾" },
  { name: "glass-of-milk", label: "🥛" },

  // Desserts & Breads
  { name: "shortcake", label: "🍰" },
  { name: "birthday-cake", label: "🎂" },
  { name: "cupcake", label: "🧁" },
  { name: "doughnut", label: "🍩" },
  { name: "cookie", label: "🍪" },
  { name: "ice-cream", label: "🍨" },
  { name: "soft-ice-cream", label: "🍦" },
  { name: "chocolate-bar", label: "🍫" },
  { name: "candy", label: "🍬" },
  { name: "lollipop", label: "🍭" },
  { name: "honey-pot", label: "🍯" },
  { name: "bread", label: "🍞" },
  { name: "croissant", label: "🥐" },
  { name: "baguette-bread", label: "🥖" },
  { name: "bagel", label: "🥯" },
  { name: "waffle", label: "🧇" },
  { name: "pancakes", label: "🥞" },

  // Fruits, Vegetables & Ingredients
  { name: "green-salad", label: "🥗" },
  { name: "cooking", label: "🍳" },
  { name: "cheese-wedge", label: "🧀" },
  { name: "tomato", label: "🍅" },
  { name: "hot-pepper", label: "🌶️" },
  { name: "avocado", label: "🥑" },
  { name: "lemon", label: "🍋" },
  { name: "watermelon", label: "🍉" },
  { name: "strawberry", label: "🍓" },
  { name: "grapes", label: "🍇" },
  { name: "melon", label: "🍈" },
  { name: "banana", label: "🍌" },
  { name: "pineapple", label: "🍍" },
  { name: "mango", label: "🥭" },
  { name: "red-apple", label: "🍎" },
  { name: "pear", label: "🍐" },
  { name: "cherries", label: "🍒" },
  { name: "broccoli", label: "🥦" },
  { name: "garlic", label: "🧄" },
  { name: "onion", label: "🧅" },
];

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

export default function CategoriesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("categories");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catEmoji, setCatEmoji] = useState("hamburger");

  const handleLogout = () => {
    router.push("/login");
  };

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Categories Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/tenant/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching categories:", err);
        setIsLoading(false);
      });
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;

    try {
      const response = await fetch("/api/tenant/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName,
          description: catDescription,
          emoji: catEmoji,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const newCat: Category = {
          id: data.id,
          name: catName,
          description: catDescription,
          itemCount: 0,
          emoji: catEmoji,
        };

        setCategories((prev) => [newCat, ...prev]);
        triggerToast(`Added category "${catName}" successfully.`);

        // Reset Form
        setCatName("");
        setCatDescription("");
        setCatEmoji("hamburger");
        setShowAddModal(false);
      } else {
        triggerToast(data.error || "Failed to add category.");
      }
    } catch {
      triggerToast("Connection failed.");
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDescription(cat.description);
    setCatEmoji(cat.emoji || getCategoryAppleEmojiName(cat.name));
    setShowEditModal(true);
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !catName) return;

    try {
      const response = await fetch("/api/tenant/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCategory.id,
          name: catName,
          description: catDescription,
          emoji: catEmoji,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCategories((prev) =>
          prev.map((x) => {
            if (x.id === editingCategory.id) {
              return {
                ...x,
                name: catName,
                description: catDescription,
                emoji: catEmoji,
              };
            }
            return x;
          }),
        );

        triggerToast(`Updated category "${catName}".`);
        setShowEditModal(false);
        setEditingCategory(null);
        setCatEmoji("hamburger");
      } else {
        triggerToast(data.error || "Failed to update category.");
      }
    } catch {
      triggerToast("Connection failed.");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const catToDelete = categories.find((x) => x.id === catId);
    if (!catToDelete) return;
    if (
      confirm(
        `Are you sure you want to delete "${catToDelete.name}" category? This will also delete all menu items in this category!`,
      )
    ) {
      try {
        const response = await fetch(`/api/tenant/categories?id=${catId}`, {
          method: "DELETE",
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setCategories((prev) => prev.filter((x) => x.id !== catId));
          triggerToast(`Deleted category "${catToDelete.name}".`);
        } else {
          triggerToast(data.error || "Failed to delete category.");
        }
      } catch {
        triggerToast("Connection failed.");
      }
    }
  };

  const filteredCategories = categories.filter((cat) => {
    const matchSearch =
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
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
                <Tags className="w-5 h-5 text-[#ff7a00]" />
                <span>Menu Categories</span>
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
                <span className="hidden md:inline text-xs font-semibold text-slate-655">
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
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Manage Categories</h2>
                <p className="text-[11px] text-slate-500">
                  Add, edit, or remove menu categories for online catalog mapping
                </p>
              </div>

              {/* Search and Add controls */}
              <div className="flex gap-2 items-center shrink-0">
                <button
                  onClick={() => {
                    setCatName("");
                    setCatDescription("");
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>

                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-505 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00]/70 text-slate-900 placeholder-slate-400 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Grid of Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {isLoading ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#ff7a00] animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">Loading Categories...</span>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 font-medium text-xs">
                  No categories found.
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white border border-slate-200 hover:border-slate-350 rounded-2xl p-5 flex gap-4 transition-all duration-200 shadow-sm group"
                  >
                    {/* Category Icon Box */}
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#ff7a00] flex items-center justify-center shrink-0 border border-orange-100 p-2.5">
                      <Emoji
                        name={cat.emoji || getCategoryAppleEmojiName(cat.name)}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0 flex-1">
                          <h3
                            className="text-xs font-bold truncate text-slate-800"
                            title={cat.name}
                          >
                            {cat.name}
                          </h3>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            {cat.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                        {cat.description || "No description provided."}
                      </p>

                      <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-wide">Menu Items</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                          {cat.itemCount} Items
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>

        {/* Add Category Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <form
              onSubmit={handleAddCategory}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Add New Category</h3>
                  <p className="text-xs text-slate-500">
                    Create a new category for food menu mapping
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
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Burgers, Pizza, Drinks"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Category Emoji Icon
                  </label>
                  <div className="flex gap-1.5 flex-wrap p-2.5 rounded-xl bg-slate-555 border border-slate-200 max-h-[105px] overflow-y-auto scrollbar-none">
                    {AVAILABLE_MENU_EMOJIS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCatEmoji(item.name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          catEmoji === item.name
                            ? "border-[#ff7a00] bg-orange-50/50 shadow-sm scale-110"
                            : "border-slate-200/60 bg-white hover:border-slate-350 hover:bg-slate-55"
                        }`}
                      >
                        <span className="w-5 h-5 flex items-center justify-center">
                          <Emoji name={item.name} className="w-full h-full object-contain" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Description
                  </label>
                  <textarea
                    placeholder="Enter a brief category description"
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                    rows={3}
                    className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-555 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs text-slate-650 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md shadow-emerald-500/10"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Category Modal */}
        {showEditModal && editingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <form
              onSubmit={handleEditCategory}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Category</h3>
                  <p className="text-xs text-slate-500">
                    Modify details of category {editingCategory.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                  }}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3 py-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Category Name"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Category Emoji Icon
                  </label>
                  <div className="flex gap-1.5 flex-wrap p-2.5 rounded-xl bg-slate-555 border border-slate-200 max-h-[105px] overflow-y-auto scrollbar-none">
                    {AVAILABLE_MENU_EMOJIS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCatEmoji(item.name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          catEmoji === item.name
                            ? "border-[#ff7a00] bg-orange-50/50 shadow-sm scale-110"
                            : "border-slate-200/60 bg-white hover:border-slate-350 hover:bg-slate-55"
                        }`}
                      >
                        <span className="w-5 h-5 flex items-center justify-center">
                          <Emoji name={item.name} className="w-full h-full object-contain" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Description
                  </label>
                  <textarea
                    placeholder="Category Description"
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                    rows={3}
                    className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-550 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs text-slate-650 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md shadow-emerald-500/10"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </EmojiProvider>
  );
}
