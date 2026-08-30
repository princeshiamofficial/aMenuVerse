"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BellRing,
  Smartphone,
  Users,
  ChefHat,
  Store,
  Send,
  Trash2,
  Volume2,
  Play,
  RotateCw,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  Sparkles,
  Search,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getFcmStatsServer,
  getFcmSubscribersServer,
  deleteFcmSubscriberServer,
  sendFcmCustomBroadcastServer,
  testSingleFcmSubscriberServer,
  getAdminRestaurantsServer,
  type FcmSubscriberRecord,
} from "@/lib/db-queries.server";
import { playNotificationSound, type SoundType } from "@/lib/push-notifications";

export default function AdminFcmPage() {
  const [stats, setStats] = useState<{
    totalDevices: number;
    customerDevices: number;
    staffDevices: number;
    ownerDevices: number;
    uniqueRestaurants: number;
    restaurants: Array<{ restaurant_id: number; name: string; slug: string; subscribers: number }>;
    vapidPublicKey: string;
    gatewayStatus: string;
  } | null>(null);

  const [subscribers, setSubscribers] = useState<FcmSubscriberRecord[]>([]);
  const [restaurantsList, setRestaurantsList] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Filter state for subscribers table
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState("all");

  // Broadcast Composer Form
  const [composerForm, setComposerForm] = useState({
    title: "🎉 Special Weekend Delight Live!",
    body: "Order your favorite pizzas and burgers now and enjoy instant 20% off your meal!",
    audience: "all",
    restaurantId: "all",
    sound: "chime" as SoundType,
    url: "/dashboard",
  });

  const [previewDevice, setPreviewDevice] = useState<"iphone" | "android">("iphone");

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, subsData, restsData] = await Promise.all([
        getFcmStatsServer(),
        getFcmSubscribersServer({
          data: {
            search: searchQuery,
            role: selectedRoleFilter,
            restaurantId: selectedRestaurantFilter,
          },
        }),
        getAdminRestaurantsServer().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (subsData) setSubscribers(subsData);
      if (restsData && Array.isArray(restsData)) {
        setRestaurantsList(
          restsData.map((r: { id: number | string; name: string; slug?: string }) => ({
            id: Number(r.id),
            name: r.name,
            slug: r.slug || "",
          })),
        );
      }
    } catch (err: unknown) {
      console.error("[AdminFCM] Load Error:", err);
      toast.error("Failed to fetch FCM statistics & subscribers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRoleFilter, selectedRestaurantFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSendBroadcast = async () => {
    if (!composerForm.title.trim()) {
      toast.error("Please enter a notification title.");
      return;
    }
    if (!composerForm.body.trim()) {
      toast.error("Please enter notification body text.");
      return;
    }

    setBroadcasting(true);
    try {
      const res = await sendFcmCustomBroadcastServer({
        data: {
          title: composerForm.title,
          body: composerForm.body,
          audience: composerForm.audience,
          restaurantId: composerForm.restaurantId,
          sound: composerForm.sound,
          url: composerForm.url,
        },
      });

      if (res.success) {
        playNotificationSound(composerForm.sound);
        toast.success(
          `🚀 Web Push Broadcast Delivered! Sent: ${res.sent} device(s), Failed: ${res.failed}`,
          { duration: 4000 },
        );
        loadData();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Broadcast dispatch failed.");
    } finally {
      setBroadcasting(false);
    }
  };

  const handleTestSingleSubscriber = async (subscriberId: string) => {
    setActionId(subscriberId);
    try {
      const res = await testSingleFcmSubscriberServer({
        data: { id: subscriberId, sound: composerForm.sound },
      });
      if (res.success) {
        playNotificationSound(composerForm.sound);
        toast.success("🔔 Direct test push sent to selected device endpoint!");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not deliver test push.");
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteSubscriber = async (subscriberId: string) => {
    if (!confirm("Are you sure you want to remove this device subscription?")) return;
    setActionId(subscriberId);
    try {
      await deleteFcmSubscriberServer({ data: { id: subscriberId } });
      toast.success("Subscriber endpoint removed from database.");
      setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
      if (stats) {
        setStats({ ...stats, totalDevices: Math.max(0, stats.totalDevices - 1) });
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to remove subscription.");
    } finally {
      setActionId(null);
    }
  };

  const copyVapidKey = () => {
    if (stats?.vapidPublicKey) {
      navigator.clipboard.writeText(stats.vapidPublicKey);
      setCopiedKey(true);
      toast.success("VAPID Public Key copied to clipboard!");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const parseUserAgentBadge = (ua?: string | null) => {
    if (!ua) return { label: "Web Client", icon: Laptop };
    const lower = ua.toLowerCase();
    if (lower.includes("android")) return { label: "Android Chrome", icon: Smartphone };
    if (lower.includes("iphone") || lower.includes("ipad"))
      return { label: "iOS Safari", icon: Smartphone };
    if (lower.includes("windows")) return { label: "Windows PC", icon: Laptop };
    if (lower.includes("macintosh") || lower.includes("mac os"))
      return { label: "Mac OS", icon: Laptop };
    if (lower.includes("linux")) return { label: "Linux", icon: Laptop };
    return { label: "Browser", icon: Laptop };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 p-6 border border-amber-500/20 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black font-display text-foreground tracking-tight">
                FCM & Web Push Manager
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative Google FCM gateway, real-time push broadcast, device endpoints & Web Audio sound triggers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 text-xs font-bold gap-1.5">
            <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
            FCM Gateway Live
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="rounded-xl border-border/80 gap-1.5 h-9"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Subscribers
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
              <Smartphone className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {stats?.totalDevices ?? "..."}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Registered device endpoints</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Customer Devices
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {stats?.customerDevices ?? "..."}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dine-in guests & online eaters</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Staff & Kitchen
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
              <ChefHat className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {stats?.staffDevices ?? "..."}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">POS, Chefs, Waiters & Managers</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Restaurants
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center">
              <Store className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {stats?.uniqueRestaurants ?? "..."}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Subscribed restaurant tenants</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Workspace */}
      <Tabs defaultValue="broadcast" className="space-y-6">
        <TabsList className="bg-muted/80 p-1 rounded-2xl grid grid-cols-3 max-w-lg">
          <TabsTrigger value="broadcast" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <Send className="h-3.5 w-3.5" />
            Push Broadcast
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <Smartphone className="h-3.5 w-3.5" />
            Device Endpoints
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            VAPID & Gateway
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Instant Push Broadcast Composer */}
        <TabsContent value="broadcast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-5">
              <Card className="rounded-3xl border-border/60 shadow-xs">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Compose Push Notification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deliver high-priority Web Push alerts across mobile lock-screens and desktop notification centers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Audience & Restaurant Targeting */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Target Audience</Label>
                      <Select
                        value={composerForm.audience}
                        onValueChange={(val) => setComposerForm({ ...composerForm, audience: val })}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="Select Audience" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="text-xs">🌐 All Devices (Customers & Staff)</SelectItem>
                          <SelectItem value="customers" className="text-xs">👥 Customers & Guests Only</SelectItem>
                          <SelectItem value="staff" className="text-xs">👨‍🍳 Staff (Chefs, Waiters, POS)</SelectItem>
                          <SelectItem value="owners" className="text-xs">👑 Restaurant Owners Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Target Restaurant</Label>
                      <Select
                        value={composerForm.restaurantId}
                        onValueChange={(val) => setComposerForm({ ...composerForm, restaurantId: val })}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="Select Restaurant" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="text-xs">🏢 All Restaurants</SelectItem>
                          {restaurantsList.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                              {r.name} ({r.slug})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Title & Emojis */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Notification Title</Label>
                      <div className="flex items-center gap-1">
                        {["🔔", "🎉", "🍕", "🍔", "⚡", "🚨", "🛎️"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() =>
                              setComposerForm({
                                ...composerForm,
                                title: `${emoji} ${composerForm.title}`,
                              })
                            }
                            className="text-xs p-1 rounded-md hover:bg-muted transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      value={composerForm.title}
                      onChange={(e) => setComposerForm({ ...composerForm, title: e.target.value })}
                      placeholder="e.g. 🎉 Special Weekend Deal!"
                      className="rounded-xl h-10 text-sm font-semibold"
                    />
                  </div>

                  {/* Message Body */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Message Content / Body</Label>
                    <Textarea
                      value={composerForm.body}
                      onChange={(e) => setComposerForm({ ...composerForm, body: e.target.value })}
                      placeholder="Enter the notification message that appears on devices..."
                      rows={3}
                      className="rounded-xl text-xs leading-relaxed"
                    />
                  </div>

                  {/* Action URL & Sound Engine Tone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Deep-Link Target URL</Label>
                      <Input
                        value={composerForm.url}
                        onChange={(e) => setComposerForm({ ...composerForm, url: e.target.value })}
                        placeholder="/bellapizza or /dashboard"
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold">Alert Audio Tone</Label>
                        <button
                          type="button"
                          onClick={() => playNotificationSound(composerForm.sound)}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Volume2 className="h-3 w-3" /> Test Tone
                        </button>
                      </div>
                      <Select
                        value={composerForm.sound}
                        onValueChange={(val) =>
                          setComposerForm({ ...composerForm, sound: val as SoundType })
                        }
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="Select Sound" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="chime" className="text-xs">🎵 Melodious Chime (Default)</SelectItem>
                          <SelectItem value="kitchen-bell" className="text-xs">🛎️ Dining & Kitchen Bell</SelectItem>
                          <SelectItem value="cash-register" className="text-xs">💵 POS Cash Register Ding</SelectItem>
                          <SelectItem value="urgent" className="text-xs">🚨 Dual-Tone Urgent Alert</SelectItem>
                          <SelectItem value="ping" className="text-xs">🔔 Classic Subtle Ping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleSendBroadcast}
                      disabled={broadcasting}
                      className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-lg shadow-amber-500/25 gap-2 cursor-pointer"
                    >
                      <Send className={`h-4 w-4 ${broadcasting ? "animate-spin" : ""}`} />
                      {broadcasting ? "Broadcasting to FCM Gateway..." : "Send Web Push Broadcast Now"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Device Preview Column */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="rounded-3xl border-border/60 shadow-xs bg-neutral-900 text-white overflow-hidden">
                <CardHeader className="p-4 border-b border-neutral-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-amber-400" />
                      Live Device Preview
                    </CardTitle>
                    <CardDescription className="text-[11px] text-neutral-400">
                      Real-time OS banner rendering
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("iphone")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        previewDevice === "iphone"
                          ? "bg-amber-500 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      iPhone
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("android")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        previewDevice === "android"
                          ? "bg-amber-500 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Android
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 flex flex-col items-center justify-center min-h-[320px] bg-gradient-to-b from-neutral-950 to-neutral-900">
                  {/* Phone Mockup Screen */}
                  <div className="w-full max-w-xs space-y-3">
                    <div className="text-center text-[11px] text-neutral-500 font-mono">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>

                    {/* iOS Style Banner */}
                    {previewDevice === "iphone" ? (
                      <div className="rounded-3xl p-3.5 bg-neutral-800/90 backdrop-blur-2xl border border-neutral-700/60 shadow-2xl space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded-md bg-amber-500 flex items-center justify-center text-white text-[9px] font-black">
                              MV
                            </div>
                            <span className="font-bold text-neutral-200">MenuVerse</span>
                          </div>
                          <span className="text-[10px]">now</span>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white leading-tight">
                            {composerForm.title || "Notification Title"}
                          </h5>
                          <p className="text-[11px] text-neutral-300 mt-1 leading-snug">
                            {composerForm.body || "Notification body text will render here on lock screen."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Android Style Banner */
                      <div className="rounded-2xl p-3.5 bg-neutral-800 border border-neutral-700 shadow-2xl space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400 font-bold">🔔 MenuVerse</span>
                            <span>•</span>
                            <span className="text-[10px]">Just now</span>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white">
                            {composerForm.title || "Notification Title"}
                          </h5>
                          <p className="text-[11px] text-neutral-300 mt-1 leading-snug">
                            {composerForm.body || "Notification body message preview for Android."}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-center pt-2">
                      <p className="text-[10px] text-neutral-500">
                        Audio: <span className="text-amber-400 font-mono">{composerForm.sound}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Registered Subscribers & Devices */}
        <TabsContent value="subscribers" className="space-y-4">
          <Card className="rounded-3xl border-border/60 shadow-xs">
            <CardHeader className="p-4 border-b border-border/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-500" />
                  Active Device Subscriptions ({subscribers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  All active push notification tokens stored authoritatively in MySQL database.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs rounded-xl">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs">All Roles</SelectItem>
                    <SelectItem value="customer" className="text-xs">Customers</SelectItem>
                    <SelectItem value="manager" className="text-xs">Managers</SelectItem>
                    <SelectItem value="cashier" className="text-xs">Cashiers</SelectItem>
                    <SelectItem value="chef" className="text-xs">Chefs</SelectItem>
                    <SelectItem value="waiter" className="text-xs">Waiters</SelectItem>
                    <SelectItem value="owner" className="text-xs">Owners</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedRestaurantFilter} onValueChange={setSelectedRestaurantFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs rounded-xl">
                    <SelectValue placeholder="Restaurant" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs">All Restaurants</SelectItem>
                    {restaurantsList.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {subscribers.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Smartphone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-bold text-sm">No subscriber devices found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Devices will appear here as soon as guests or staff click "Enable Alerts".
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
                      <tr>
                        <th className="py-3 px-4">Device / Platform</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Restaurant Tenant</th>
                        <th className="py-3 px-4">Endpoint Gateway</th>
                        <th className="py-3 px-4">Subscribed At</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {subscribers.map((sub) => {
                        const devInfo = parseUserAgentBadge(sub.userAgent);
                        const DevIcon = devInfo.icon;
                        const isActing = actionId === sub.id;

                        return (
                          <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                  <DevIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <span className="font-semibold text-foreground">
                                  {devInfo.label}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                  sub.role === "customer"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {sub.role || "customer"}
                              </Badge>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-semibold text-foreground">
                                {sub.restaurantName || `Restaurant #${sub.restaurantId}`}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground max-w-[200px] truncate">
                              {sub.endpoint.includes("fcm.googleapis.com")
                                ? "Google FCM Gateway"
                                : sub.endpoint.split("/")[2] || "WebPush"}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground text-[11px]">
                              {new Date(sub.createdAt).toLocaleDateString()}{" "}
                              {new Date(sub.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isActing}
                                  onClick={() => handleTestSingleSubscriber(sub.id)}
                                  className="h-7 px-2.5 text-[11px] rounded-lg gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                                  title="Send test push to this device"
                                >
                                  <Send className="h-3 w-3" />
                                  Ping
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isActing}
                                  onClick={() => handleDeleteSubscriber(sub.id)}
                                  className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  title="Delete subscription"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: VAPID & Diagnostic Suite */}
        <TabsContent value="diagnostics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VAPID Details Card */}
            <Card className="rounded-3xl border-border/60 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  VAPID Security Protocol (RFC 8292)
                </CardTitle>
                <CardDescription className="text-xs">
                  Standard Voluntary Application Server Identification for cross-browser Web Push.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">VAPID Public Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={stats?.vapidPublicKey || ""}
                      className="rounded-xl h-9 text-xs font-mono bg-muted/50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyVapidKey}
                      className="h-9 px-3 rounded-xl gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedKey ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Gateway Protocol:</span>
                    <span className="font-semibold text-foreground">WebPush RFC 8030 / 8292</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Encryption Cipher:</span>
                    <span className="font-semibold text-foreground">ECDH P-256 (aes128gcm)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Service Worker:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">/sw.js (Active)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Storage Engine:</span>
                    <span className="font-semibold text-foreground">MySQL (push_subscriptions)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sound Engine Test Studio */}
            <Card className="rounded-3xl border-border/60 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-amber-500" />
                  Web Audio Synthesizer Studio
                </CardTitle>
                <CardDescription className="text-xs">
                  Zero external MP3 audio latency — pure high-fidelity mathematical waveforms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { id: "chime", name: "Melodious Chime", desc: "D5 - A5 - D6 Harmonic Chord", emoji: "🎵" },
                  { id: "kitchen-bell", name: "Dining & Kitchen Bell", desc: "880Hz Dual Sine with Rich Overtones", emoji: "🛎️" },
                  { id: "cash-register", name: "POS Cash Ding", desc: "987Hz - 1318Hz Register Register", emoji: "💵" },
                  { id: "urgent", name: "Dual-Tone Urgent Alert", desc: "1046Hz Pulsed Waveforms", emoji: "🚨" },
                  { id: "ping", name: "Classic Subtle Ping", desc: "High-frequency quick ping", emoji: "🔔" },
                ].map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{s.emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playNotificationSound(s.id as SoundType);
                        toast.info(`Playing ${s.name}`, { duration: 1500 });
                      }}
                      className="h-7 px-2.5 text-xs rounded-xl gap-1 cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-current" /> Play
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
