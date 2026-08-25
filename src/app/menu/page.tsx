"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";

import ImageUploader from "../../../ui/ImageUploader";
import { EmojiProvider, Emoji } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import { Menu, Bell, Search, Star, Check, Utensils, Plus, Edit, Trash2, X } from "lucide-react";

interface MenuItemWithState {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  popular: boolean;
  available: boolean;
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

export default function MenuPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("menu");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState<string | null>(null);

  // Add/Edit states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithState | null>(null);

  // Form states for Add/Edit
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState(0);
  const [menuCategory, setMenuCategory] = useState("Burgers");
  const [menuDescription, setMenuDescription] = useState("");
  const [menuImage, setMenuImage] = useState("");
  const [menuEmoji, setMenuEmoji] = useState("hamburger");

  const handleLogout = () => {
    router.push("/login");
  };

  const [items, setItems] = useState<MenuItemWithState[]>([]);
  const [categoriesList, setCategoriesList] = useState<
    { id: string; rawId: number; name: string; emoji?: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/tenant/menu")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(
            data.map((item: MenuItemWithState) => ({
              ...item,
              available: true,
            })),
          );
        }
      })
      .catch((err) => console.error("Error loading menu items:", err));

    fetch("/api/tenant/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategoriesList(data);
        }
      })
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  // Map categories from categories table
  const categories = React.useMemo(() => {
    return ["All", ...categoriesList.map((c) => c.name)];
  }, [categoriesList]);

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  const toggleAvailability = (itemId: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const nextState = !item.available;
          triggerToast(`"${item.name}" is now marked as ${nextState ? "Available" : "Sold Out"}`);
          return { ...item, available: nextState };
        }
        return item;
      }),
    );
  };

  const togglePopular = async (itemId: number) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const nextPopular = !target.popular;

    try {
      const response = await fetch("/api/tenant/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.id,
          name: target.name,
          description: target.description,
          price: target.price,
          image: target.image,
          category: target.category,
          popular: nextPopular,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id === itemId) {
              triggerToast(
                `"${item.name}" ${nextPopular ? "added to" : "removed from"} Popular Highlights`,
              );
              return { ...item, popular: nextPopular };
            }
            return item;
          }),
        );
      } else {
        triggerToast(data.error || "Failed to update highlights.");
      }
    } catch {
      triggerToast("Connection failed.");
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName || !menuCategory) return;

    const defaultImage =
      menuImage ||
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";

    try {
      const response = await fetch("/api/tenant/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: menuName,
          description: menuDescription,
          price: menuPrice,
          image: defaultImage,
          category: menuCategory,
          popular: false,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const newItem: MenuItemWithState = {
          id: data.id,
          name: menuName,
          description: menuDescription,
          price: menuPrice,
          image: defaultImage,
          category: menuCategory,
          popular: false,
          available: true,
          emoji: menuEmoji,
        };
        setItems((prev) => [newItem, ...prev]);
        triggerToast(`Added "${menuName}" to the menu.`);
      } else {
        triggerToast(data.error || "Failed to add menu item.");
      }
    } catch {
      triggerToast("Connection failed.");
    }

    // Reset Form
    setMenuName("");
    setMenuPrice(0);
    setMenuCategory("Burgers");
    setMenuDescription("");
    setMenuImage("");
    setMenuEmoji("hamburger");
    setShowAddModal(false);
  };

  const handleStartEdit = (item: MenuItemWithState) => {
    setEditingItem(item);
    setMenuName(item.name);
    setMenuPrice(item.price);
    setMenuCategory(item.category);
    setMenuDescription(item.description);
    setMenuImage(item.image);
    setMenuEmoji(item.emoji || "hamburger");
    setShowEditModal(true);
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !menuName || !menuCategory) return;

    try {
      const response = await fetch("/api/tenant/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          name: menuName,
          description: menuDescription,
          price: menuPrice,
          image: menuImage,
          category: menuCategory,
          popular: editingItem.popular,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItems((prev) =>
          prev.map((x) => {
            if (x.id === editingItem.id) {
              return {
                ...x,
                name: menuName,
                price: menuPrice,
                category: menuCategory,
                description: menuDescription,
                image: menuImage,
                emoji: menuEmoji,
              };
            }
            return x;
          }),
        );
        triggerToast(`Updated "${menuName}" details.`);
      } else {
        triggerToast(data.error || "Failed to update menu item.");
      }
    } catch {
      triggerToast("Connection failed.");
    }

    setShowEditModal(false);
    setEditingItem(null);
    setMenuEmoji("hamburger");
  };

  const handleDeleteItem = async (itemId: number) => {
    const itemToDelete = items.find((x) => x.id === itemId);
    if (!itemToDelete) return;
    if (confirm(`Are you sure you want to delete "${itemToDelete.name}" from the menu?`)) {
      try {
        const response = await fetch(`/api/tenant/menu?id=${itemId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setItems((prev) => prev.filter((x) => x.id !== itemId));
          triggerToast(`Removed "${itemToDelete.name}" from the menu.`);
        } else {
          triggerToast(data.error || "Failed to delete item.");
        }
      } catch {
        triggerToast("Connection failed.");
      }
    }
  };

  const filteredItems: MenuItemWithState[] = items.filter((item) => {
    const matchCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
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
              <h1 className="text-[17px] font-semibold tracking-wide text-slate-800">
                Menu Settings
              </h1>
            </div>

            <div className="flex items-center gap-4">
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
                  Color Hut Admin
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

          {/* Content Body */}
          <main className="p-6 w-full flex-1 flex flex-col gap-6">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              {/* Category tabs list */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none">
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

              {/* Search and Add controls */}
              <div className="flex gap-2 items-center shrink-0">
                <button
                  onClick={() => {
                    setMenuName("");
                    setMenuPrice(0);
                    setMenuCategory(categoriesList[0]?.name || "Burgers");
                    setMenuDescription("");
                    setMenuImage("");
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Menu Item
                </button>

                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-505 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search dishes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#ff7a00]/70 text-slate-900 placeholder-slate-400 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Grid of Dishes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 flex gap-4 transition-all duration-200 shadow-sm ${
                    item.available
                      ? "border-slate-200 hover:border-slate-300"
                      : "border-slate-200 bg-slate-50 opacity-70"
                  }`}
                >
                  {/* Product Image */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {item.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Utensils className="w-6 h-6 text-slate-400" />
                    )}

                    {/* Status overlay when Sold out */}
                    {!item.available && (
                      <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
                        <span className="text-[9px] font-black text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/25 tracking-wide uppercase">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <h3
                          className={`text-xs font-bold truncate ${item.available ? "text-slate-800" : "text-slate-500"}`}
                          title={item.name}
                        >
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-[#ff7a00]">
                          ${item.price.toFixed(2)}
                        </span>

                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-auto pt-2.5 flex items-center justify-between border-t border-slate-100">
                      {/* Toggle switch for Available / Sold out */}
                      <button
                        onClick={() => toggleAvailability(item.id)}
                        className="flex items-center gap-1.5 group select-none text-[10px] font-bold"
                      >
                        <div
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex ${
                            item.available
                              ? "bg-emerald-500 justify-end"
                              : "bg-slate-350 justify-start"
                          }`}
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-white shadow" />
                        </div>
                        <span className={item.available ? "text-emerald-600" : "text-slate-500"}>
                          {item.available ? "Available" : "Sold Out"}
                        </span>
                      </button>

                      {/* Star highlight tag */}
                      <button
                        onClick={() => item.available && togglePopular(item.id)}
                        disabled={!item.available}
                        className={`flex items-center gap-1 text-[10px] font-bold py-1 px-2 rounded-lg border transition-colors ${
                          item.popular
                            ? "bg-amber-50 border-amber-200 text-amber-600"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <Star className={`w-3 h-3 ${item.popular ? "fill-amber-400" : ""}`} />
                        <span>Popular</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Add Menu Item Modal */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <form
                  onSubmit={handleAddItem}
                  className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Add New Menu Item</h3>
                      <p className="text-xs text-slate-500">Add a new dish to your digital menu</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 animate-click"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Dish Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Classic Margherita Pizza"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Dish Emoji Icon
                      </label>
                      <div className="flex gap-1.5 flex-wrap p-2.5 rounded-xl bg-slate-50 border border-slate-200 max-h-[105px] overflow-y-auto scrollbar-none">
                        {AVAILABLE_MENU_EMOJIS.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setMenuEmoji(item.name)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                              menuEmoji === item.name
                                ? "border-[#ff7a00] bg-orange-50/50 shadow-sm scale-110"
                                : "border-slate-200/60 bg-white hover:border-slate-350 hover:bg-slate-50"
                            }`}
                          >
                            <span className="w-5 h-5 flex items-center justify-center">
                              <Emoji name={item.name} className="w-full h-full object-contain" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">
                          Category
                        </label>
                        <select
                          value={menuCategory}
                          onChange={(e) => setMenuCategory(e.target.value)}
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
                        <label className="text-[10px] uppercase font-bold text-slate-500">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={menuPrice || ""}
                          onChange={(e) =>
                            setMenuPrice(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          placeholder="0.00"
                          className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Image
                      </label>
                      <div className="flex h-9">
                        <input
                          type="text"
                          placeholder="Leave empty for default food image"
                          value={menuImage}
                          onChange={(e) => setMenuImage(e.target.value)}
                          className="flex-1 h-full text-xs px-3.5 rounded-l-xl rounded-r-none border border-slate-200 border-r-0 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium font-mono"
                        />
                        <ImageUploader
                          onUploadSuccess={setMenuImage}
                          label="Upload"
                          className="h-full shrink-0"
                          buttonClassName="rounded-l-none h-full text-[10px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Description
                      </label>
                      <textarea
                        placeholder="Describe the dish ingredients, taste, etc."
                        value={menuDescription}
                        onChange={(e) => setMenuDescription(e.target.value)}
                        rows={3}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-550 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium resize-none"
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
                      Add Dish
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Menu Item Modal */}
            {showEditModal && editingItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <form
                  onSubmit={handleEditItem}
                  className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl animate-in zoom-in-95 duration-200"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Edit Menu Item</h3>
                      <p className="text-xs text-slate-500">
                        Update dish details in the digital menu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingItem(null);
                      }}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Dish Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Classic Margherita Pizza"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Dish Emoji Icon
                      </label>
                      <div className="flex gap-1.5 flex-wrap p-2.5 rounded-xl bg-slate-50 border border-slate-200 max-h-[105px] overflow-y-auto scrollbar-none">
                        {AVAILABLE_MENU_EMOJIS.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setMenuEmoji(item.name)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                              menuEmoji === item.name
                                ? "border-[#ff7a00] bg-orange-50/50 shadow-sm scale-110"
                                : "border-slate-200/60 bg-white hover:border-slate-350 hover:bg-slate-50"
                            }`}
                          >
                            <span className="w-5 h-5 flex items-center justify-center">
                              <Emoji name={item.name} className="w-full h-full object-contain" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">
                          Category
                        </label>
                        <select
                          value={menuCategory}
                          onChange={(e) => setMenuCategory(e.target.value)}
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
                        <label className="text-[10px] uppercase font-bold text-slate-500">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={menuPrice || ""}
                          onChange={(e) =>
                            setMenuPrice(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          placeholder="0.00"
                          className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-[#ff7a00] font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Image
                      </label>
                      <div className="flex h-9">
                        <input
                          type="text"
                          placeholder="Image link URL"
                          value={menuImage}
                          onChange={(e) => setMenuImage(e.target.value)}
                          className="flex-1 h-full text-xs px-3.5 rounded-l-xl rounded-r-none border border-slate-200 border-r-0 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium font-mono"
                        />
                        <ImageUploader
                          onUploadSuccess={setMenuImage}
                          label="Upload"
                          className="h-full shrink-0"
                          buttonClassName="rounded-l-none h-full text-[10px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">
                        Description
                      </label>
                      <textarea
                        placeholder="Describe the dish ingredients, taste, etc."
                        value={menuDescription}
                        onChange={(e) => setMenuDescription(e.target.value)}
                        rows={3}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#ff7a00] text-slate-800 font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingItem(null);
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
          </main>
        </div>
      </div>
    </EmojiProvider>
  );
}
