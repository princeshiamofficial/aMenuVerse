"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Plus,
  Send,
  Trash2,
  Volume2,
  Play,
  RotateCw,
  Eye,
  EyeOff,
  Bell,
  CheckCircle2,
  Users,
  Radio,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import {
  getAnnouncementsServer,
  publishAnnouncementServer,
  deleteAnnouncementServer,
  toggleAnnouncementLiveServer,
  resendAnnouncementPushServer,
  type AnnouncementRecord,
} from "@/lib/db-queries.server";
import { playNotificationSound, type SoundType } from "@/lib/push-notifications";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "all",
    sound: "chime",
    url: "/dashboard",
    sendPush: true,
  });

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await getAnnouncementsServer({ data: {} });
      setAnnouncements(data || []);
    } catch (err) {
      console.error("[Announcements Load Error]", err);
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handlePreviewSound = (sound: string) => {
    playNotificationSound(sound as SoundType);
    toast.info(`Playing sound: ${sound}`, { duration: 1500 });
  };

  const handlePublish = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Please provide both title and body for the announcement.");
      return;
    }

    setPublishing(true);
    try {
      const result = await publishAnnouncementServer({
        data: {
          title: form.title.trim(),
          body: form.body.trim(),
          audience: form.audience,
          sound: form.sound,
          url: form.url.trim() || "/dashboard",
          sendPush: form.sendPush,
        },
      });

      if (result.success) {
        if (form.sendPush) {
          playNotificationSound(form.sound as SoundType);
          toast.success(
            `📢 Announcement published & Web Push sent to ${result.sentCount} active devices!`,
          );
        } else {
          toast.success("Announcement published successfully.");
        }
        setModalOpen(false);
        setForm({
          title: "",
          body: "",
          audience: "all",
          sound: "chime",
          url: "/dashboard",
          sendPush: true,
        });
        loadAnnouncements();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to publish announcement");
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLive = async (ann: AnnouncementRecord) => {
    setActionId(ann.id);
    try {
      const newLiveState = !ann.live;
      await toggleAnnouncementLiveServer({ data: { id: ann.id, live: newLiveState } });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? { ...a, live: newLiveState } : a)),
      );
      toast.success(newLiveState ? "Announcement marked as Live" : "Announcement moved to Draft");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update status");
    } finally {
      setActionId(null);
    }
  };

  const handleResendPush = async (ann: AnnouncementRecord) => {
    setActionId(ann.id);
    try {
      playNotificationSound(ann.sound as SoundType);
      const res = await resendAnnouncementPushServer({ data: { id: ann.id } });
      if (res.success) {
        toast.success(`📢 Push broadcast resent to ${res.sentCount} active devices!`);
        loadAnnouncements();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to resend push notification");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    setActionId(id);
    try {
      await deleteAnnouncementServer({ data: { id } });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement deleted successfully.");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete announcement");
    } finally {
      setActionId(null);
    }
  };

  const totalDelivered = announcements.reduce((acc, a) => acc + (a.sentCount || 0), 0);
  const liveCount = announcements.filter((a) => a.live).length;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 shadow-card border border-border flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total Announcements
            </p>
            <h3 className="text-2xl font-bold font-display">{announcements.length}</h3>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 shadow-card border border-border flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Active Broadcasts
            </p>
            <h3 className="text-2xl font-bold font-display">{liveCount} Live</h3>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 shadow-card border border-border flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Push Deliveries
            </p>
            <h3 className="text-2xl font-bold font-display">{totalDelivered} Sent</h3>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">System Broadcasts & Push Alerts</h2>
          <p className="text-xs text-muted-foreground">
            Broadcast platform updates, maintenance notices, and instant push messages to tenant devices.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="gradient-warm text-primary-foreground gap-2 shadow-elegant"
        >
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center shadow-card border border-dashed border-border">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
            <Megaphone className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold">No announcements published yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first system announcement to send instant push notifications and audio chimes to restaurant owners and staff.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="mt-5 gradient-warm text-primary-foreground gap-2"
          >
            <Plus className="h-4 w-4" /> Create First Broadcast
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <section
              key={a.id}
              className="glass rounded-2xl p-6 shadow-card border border-border transition-all hover:border-primary/30 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display font-semibold text-lg">{a.title}</h4>
                    <Badge variant={a.live ? "default" : "secondary"} className="text-xs">
                      {a.live ? "Live" : "Draft"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" /> Audience:
                    </span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {a.audience === "all"
                        ? "Everyone"
                        : a.audience === "owners"
                          ? "Owners Only"
                          : "Staff Only"}
                    </Badge>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground" /> Sound:{" "}
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {a.sound || "chime"}
                      </code>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Delivered: {a.sentCount || 0} devices
                    </span>
                    <span>•</span>
                    <span>{a.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handlePreviewSound(a.sound || "chime")}
                    title="Play Announcement Sound"
                  >
                    <Play className="h-3.5 w-3.5 text-amber-500" /> Play Sound
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={actionId === a.id}
                    onClick={() => handleResendPush(a)}
                    title="Re-broadcast Web Push to all devices"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-blue-500" /> Resend Push
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={actionId === a.id}
                    onClick={() => handleToggleLive(a)}
                  >
                    {a.live ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Move to Draft
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Set Live
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:bg-destructive/10 text-xs"
                    disabled={actionId === a.id}
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line bg-muted/20 p-4 rounded-xl border border-border/50">
                {a.body}
              </p>
            </section>
          ))}
        </div>
      )}

      {/* New Announcement Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-137.5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-500" /> New System Broadcast & Push Alert
            </DialogTitle>
            <DialogDescription>
              Broadcast a rich message with instant Web Push notifications and custom sound alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Broadcast Title</Label>
              <Input
                id="ann-title"
                placeholder="e.g. 🚀 Version 2.5 Live: New Kitchen Display System!"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-body">Message Body</Label>
              <Textarea
                id="ann-body"
                rows={4}
                placeholder="Write your announcement details here. This message will appear in banners and notification drawers."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(v) => setForm({ ...form, audience: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 Everyone (All Staff & Customers)</SelectItem>
                    <SelectItem value="owners">👑 Restaurant Owners Only</SelectItem>
                    <SelectItem value="staff">👨‍🍳 Staff (Chefs, Waiters, Cashiers)</SelectItem>
                    <SelectItem value="customers">👥 Customers & Guests Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Alert Sound</Label>
                  <button
                    type="button"
                    onClick={() => handlePreviewSound(form.sound)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" /> Test Sound
                  </button>
                </div>
                <Select value={form.sound} onValueChange={(v) => setForm({ ...form, sound: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chime">🎵 Melodic Chime</SelectItem>
                    <SelectItem value="kitchen-bell">🛎️ Kitchen Bell</SelectItem>
                    <SelectItem value="cash-register">💵 POS Cash Ding</SelectItem>
                    <SelectItem value="urgent">🚨 Urgent Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-url">Destination URL (On Click)</Label>
              <Input
                id="ann-url"
                placeholder="/dashboard"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="send-push" className="font-medium text-sm flex items-center gap-1.5 cursor-pointer">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Send Instant Web Push
                </Label>
                <p className="text-xs text-muted-foreground">
                  Deliver OS notification banner, sound chime, and icon badge count to device browsers.
                </p>
              </div>
              <Switch
                id="send-push"
                checked={form.sendPush}
                onCheckedChange={(checked) => setForm({ ...form, sendPush: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="gradient-warm text-primary-foreground gap-2 shadow-elegant"
            >
              <Send className="h-4 w-4" /> {publishing ? "Broadcasting..." : "Publish & Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
