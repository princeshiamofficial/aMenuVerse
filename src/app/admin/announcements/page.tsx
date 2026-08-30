"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useState } from "react";
import { generateId } from "@/lib/utils";
import { useAdminContext, type Announcement } from "@/lib/admin-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";

export default function AnnouncementsComponent() {
  const { announcements, setAnnouncements } = useAdminContext();
  const [newAnn, setNewAnn] = useState<{
    open: boolean;
    title: string;
    body: string;
    audience: Announcement["audience"];
  }>({
    open: false,
    title: "",
    body: "",
    audience: "all",
  });

  const publishAnnouncement = () => {
    if (!newAnn.title.trim() || !newAnn.body.trim()) {
      toast.error("Add a title and body");
      return;
    }
    const a: Announcement = {
      id: generateId(),
      title: newAnn.title.trim(),
      body: newAnn.body.trim(),
      audience: newAnn.audience,
      date: new Date().toISOString().slice(0, 10),
      live: true,
    };
    setAnnouncements((list) => [a, ...list]);
    setNewAnn({ open: false, title: "", body: "", audience: "all" });
    toast.success("Announcement published");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setNewAnn({ open: true, title: "", body: "", audience: "all" })}
          className="gradient-warm text-primary-foreground gap-1.5"
        >
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.map((a) => (
          <section key={a.id} className="glass rounded-2xl p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-display font-semibold text-lg">{a.title}</h4>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Audience: </span>
                  <Badge variant="outline" className="capitalize">
                    {a.audience}
                  </Badge>
                  <span>•</span>
                  <span>Published on {a.date}</span>
                </div>
              </div>
              <Badge variant={a.live ? "default" : "secondary"}>{a.live ? "Live" : "Draft"}</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{a.body}</p>
          </section>
        ))}
      </div>

      <Dialog open={newAnn.open} onOpenChange={(o) => setNewAnn({ ...newAnn, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Choose an audience and publish.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="atitle">Title</Label>
              <Input
                id="atitle"
                value={newAnn.title}
                onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abody">Body</Label>
              <Textarea
                id="abody"
                rows={4}
                value={newAnn.body}
                onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={newAnn.audience}
                onValueChange={(v: Announcement["audience"]) =>
                  setNewAnn({ ...newAnn, audience: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="owners">Owners only</SelectItem>
                  <SelectItem value="staff">Staff only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAnn({ ...newAnn, open: false })}>
              Cancel
            </Button>
            <Button onClick={publishAnnouncement} className="gradient-warm text-primary-foreground">
              <Send className="mr-1 h-4 w-4" /> Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
