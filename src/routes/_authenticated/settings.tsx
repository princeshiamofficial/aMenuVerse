import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Languages,
  DollarSign,
  Receipt,
  Truck,
  Bell,
  Mail,
  Shield,
  KeyRound,
  Save,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/lib/api-client";
import { getSettingsServer, saveSettingsServer } from "@/lib/db-queries.server";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

type NotifChannel = { email: boolean; push: boolean; sms: boolean };
type Settings = {
  theme?: { mode: "light" | "dark" | "system"; accent: string; density: "comfortable" | "compact" };
  language: string;
  currency: string;
  taxRate: number;
  taxInclusive: boolean;
  serviceCharge: number;
  serviceEnabled: boolean;
  deliveryFee: number;
  freeDeliveryOver: number;
  notifications: Record<string, NotifChannel>;
  email: { fromName: string; fromAddress: string; replyTo: string; signature: string };
  security: { twoFA: boolean; sessionTimeout: number };
};
const LANGS = [
  { v: "en", l: "English" },
  { v: "bn", l: "Bangla (বাংলা)" },
  { v: "es", l: "Español" },
  { v: "fr", l: "Français" },
  { v: "de", l: "Deutsch" },
  { v: "it", l: "Italiano" },
  { v: "pt", l: "Português" },
  { v: "ar", l: "العربية" },
  { v: "hi", l: "हिन्दी" },
  { v: "zh", l: "中文" },
  { v: "ja", l: "日本語" },
];
const CURRENCIES = [
  { v: "USD", l: "US Dollar ($)" },
  { v: "BDT", l: "Bangladeshi Taka (৳)" },
  { v: "EUR", l: "Euro (€)" },
  { v: "GBP", l: "British Pound (£)" },
  { v: "INR", l: "Indian Rupee (₹)" },
  { v: "AED", l: "UAE Dirham (د.إ)" },
  { v: "JPY", l: "Japanese Yen (¥)" },
  { v: "CNY", l: "Chinese Yuan (¥)" },
  { v: "BRL", l: "Brazilian Real (R$)" },
  { v: "CAD", l: "Canadian Dollar (C$)" },
];

const NOTIF_EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "orders", label: "New orders", desc: "Ping me when an order lands." },
  { key: "stock", label: "Low stock", desc: "Warn me before I run out." },
  { key: "reviews", label: "New reviews", desc: "Alert me to new customer feedback." },
  { key: "waiter", label: "Waiter calls", desc: "Guest requested help at a table." },
  { key: "billing", label: "Billing & invoices", desc: "Payments, receipts, plan changes." },
  { key: "weekly", label: "Weekly report", desc: "Email me a Monday summary." },
];

const DEFAULTS: Settings = {
  theme: { mode: "system", accent: "#E53935", density: "comfortable" },
  language: "en",
  currency: "BDT",
  taxRate: 8.5,
  taxInclusive: false,
  serviceCharge: 10,
  serviceEnabled: true,
  deliveryFee: 3.99,
  freeDeliveryOver: 40,
  notifications: Object.fromEntries(
    NOTIF_EVENTS.map((e) => [e.key, { email: true, push: true, sms: false }]),
  ) as Record<string, NotifChannel>,
  email: {
    fromName: "MenuVerse Kitchen",
    fromAddress: "hello@menuverse.app",
    replyTo: "support@menuverse.app",
    signature: "— The MenuVerse Team",
  },
  security: { twoFA: false, sessionTimeout: 30 },
};

type ApiKey = { id: string; name: string; token: string; createdAt: string; lastUsed?: string };

function maskToken(t: string) {
  return t.slice(0, 8) + "•".repeat(Math.max(0, t.length - 12)) + t.slice(-4);
}

function genToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return (
    "mv_live_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [justCreated, setJustCreated] = useState<ApiKey | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiGet<Record<string, unknown>>("/api/settings");
        const dbSettings = (res?.data || res) as Record<string, unknown>;
        if (dbSettings && typeof dbSettings === "object") {
          let appObj: Record<string, unknown> | null = null;
          if (dbSettings.app_settings) {
            appObj =
              typeof dbSettings.app_settings === "string"
                ? JSON.parse(dbSettings.app_settings)
                : (dbSettings.app_settings as Record<string, unknown>);
          } else if (dbSettings.taxRate != null || dbSettings.currency != null) {
            appObj = dbSettings;
          }

          if (appObj) {
            setS((prev) => ({ ...prev, ...appObj }));
          }

          if (dbSettings.api_keys) {
            const parsedKeys =
              typeof dbSettings.api_keys === "string"
                ? JSON.parse(dbSettings.api_keys)
                : dbSettings.api_keys;
            if (Array.isArray(parsedKeys)) setKeys(parsedKeys);
          }
        }
      } catch {
        /* ignore */
      }
      setHydrated(true);
    }
    loadSettings();
  }, []);

  const persist = async (next: Settings) => {
    setS(next);
    try {
      await apiPost("/api/settings", {
        ...next,
        currency: next.currency,
        taxRate: next.taxRate,
        serviceFee: next.serviceCharge,
      });
    } catch {
      /* ignore */
    }
  };
  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => persist({ ...s, [k]: v });
  const save = async () => {
    try {
      await apiPost("/api/settings", {
        ...s,
        currency: s.currency,
        taxRate: s.taxRate,
        serviceFee: s.serviceCharge,
      });
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const persistKeys = async (next: ApiKey[]) => {
    setKeys(next);
    try {
      await saveSettingsServer({ data: { app_settings: s, api_keys: next } });
    } catch {
      /* ignore */
    }
  };
  const createKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Name your API key");
      return;
    }
    const k: ApiKey = {
      id: generateId(),
      name: newKeyName.trim(),
      token: genToken(),
      createdAt: new Date().toISOString(),
    };
    persistKeys([k, ...keys]);
    setJustCreated(k);
    setNewKeyName("");
    setNewKeyOpen(false);
    toast.success("API key created");
  };
  const deleteKey = (id: string) => {
    persistKeys(keys.filter((k) => k.id !== id));
    toast.success("API key revoked");
  };
  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  if (!hydrated) return null;

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {/* REGIONAL */}
      <section className="glass rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" /> Language & currency
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Display, formatting and menu defaults.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" /> Language
            </Label>
            <Select
              value={s.language || "en"}
              onValueChange={(v) => {
                if (v !== "en") {
                  toast.info("Multi-language support coming soon!");
                }
                update("language", "en");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.l} {o.v !== "en" ? "- Coming Soon" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Currency
            </Label>
            <Select value={s.currency} onValueChange={(v) => update("currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Separator className="mt-6 mb-4" />
        <div className="flex justify-end">
          <Button
            onClick={save}
            size="sm"
            className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </section>

      {/* CHARGES */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Taxes</h3>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax">Tax rate (%)</Label>
              <Input
                id="tax"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={s.taxRate}
                onChange={(e) => update("taxRate", Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-background/60 p-3">
              <div>
                <div className="text-sm font-medium">Tax-inclusive prices</div>
                <div className="text-xs text-muted-foreground">
                  Menu prices already include tax.
                </div>
              </div>
              <Switch checked={s.taxInclusive} onCheckedChange={(v) => update("taxInclusive", v)} />
            </div>
          </div>
          <Separator className="mt-6 mb-4" />
          <div className="flex justify-end">
            <Button
              onClick={save}
              size="sm"
              className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Service charge</h3>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-background/60 p-3">
              <div className="text-sm font-medium">Enabled</div>
              <Switch
                checked={s.serviceEnabled}
                onCheckedChange={(v) => update("serviceEnabled", v)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Rate (%)</Label>
              <Input
                id="service"
                type="number"
                step="0.5"
                min="0"
                max="100"
                disabled={!s.serviceEnabled}
                value={s.serviceCharge}
                onChange={(e) => update("serviceCharge", Number(e.target.value))}
              />
            </div>
          </div>
          <Separator className="mt-6 mb-4" />
          <div className="flex justify-end">
            <Button
              onClick={save}
              size="sm"
              className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Delivery charge</h3>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="del">Base fee</Label>
              <Input
                id="del"
                type="number"
                step="0.5"
                min="0"
                value={s.deliveryFee}
                onChange={(e) => update("deliveryFee", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeOver">Free delivery over</Label>
              <Input
                id="freeOver"
                type="number"
                step="1"
                min="0"
                value={s.freeDeliveryOver}
                onChange={(e) => update("freeDeliveryOver", Number(e.target.value))}
              />
            </div>
          </div>
          <Separator className="mt-6 mb-4" />
          <div className="flex justify-end">
            <Button
              onClick={save}
              size="sm"
              className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </section>
      </div>

      {/* NOTIFICATIONS */}
      <section className="glass rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Notifications
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">Choose channels for each event.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-140 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3">Event</th>
                <th className="pb-3 text-center">Email</th>
                <th className="pb-3 text-center">Push</th>
                <th className="pb-3 text-center">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {NOTIF_EVENTS.map((e) => {
                const row = s.notifications[e.key] ?? { email: false, push: false, sms: false };
                const setRow = (patch: Partial<NotifChannel>) =>
                  update("notifications", {
                    ...s.notifications,
                    [e.key]: { ...row, ...patch },
                  });
                return (
                  <tr key={e.key}>
                    <td className="py-3">
                      <div className="font-medium">{e.label}</div>
                      <div className="text-xs text-muted-foreground">{e.desc}</div>
                    </td>
                    <td className="py-3 text-center">
                      <Switch checked={row.email} onCheckedChange={(v) => setRow({ email: v })} />
                    </td>
                    <td className="py-3 text-center">
                      <Switch checked={row.push} onCheckedChange={(v) => setRow({ push: v })} />
                    </td>
                    <td className="py-3 text-center">
                      <Switch checked={row.sms} onCheckedChange={(v) => setRow({ sms: v })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Separator className="mt-6 mb-4" />
        <div className="flex justify-end">
          <Button
            onClick={save}
            size="sm"
            className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </section>

      {/* EMAIL */}
      <section className="glass rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Email settings
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          How transactional emails appear to guests.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fname">From name</Label>
            <Input
              id="fname"
              value={s.email.fromName}
              onChange={(e) => update("email", { ...s.email, fromName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faddr">From address</Label>
            <Input
              id="faddr"
              type="email"
              value={s.email.fromAddress}
              onChange={(e) => update("email", { ...s.email, fromAddress: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="rto">Reply-to</Label>
            <Input
              id="rto"
              type="email"
              value={s.email.replyTo}
              onChange={(e) => update("email", { ...s.email, replyTo: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sig">Signature</Label>
            <textarea
              id="sig"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={s.email.signature}
              onChange={(e) => update("email", { ...s.email, signature: e.target.value })}
            />
          </div>
        </div>
        <Separator className="mt-6 mb-4" />
        <div className="flex justify-end">
          <Button
            onClick={save}
            size="sm"
            className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </section>

      {/* SECURITY */}
      <section className="glass rounded-2xl p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold">Account security</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-background/60 p-4">
            <div>
              <div className="font-medium">Two-factor authentication</div>
              <div className="text-xs text-muted-foreground">
                Require a code from your authenticator app.
              </div>
            </div>
            <Switch
              checked={s.security.twoFA}
              onCheckedChange={(v) => update("security", { ...s.security, twoFA: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeout">Session timeout (minutes)</Label>
            <Input
              id="timeout"
              type="number"
              min="5"
              max="240"
              value={s.security.sessionTimeout}
              onChange={(e) =>
                update("security", { ...s.security, sessionTimeout: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <Separator className="mt-6 mb-4" />
        <div className="flex justify-end">
          <Button
            onClick={save}
            size="sm"
            className="gradient-warm text-primary-foreground shadow-elegant gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </section>

      {/* API KEYS */}
      <section className="glass rounded-2xl p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">API keys</h3>
              <Badge variant="outline" className="text-[10px]">
                Placeholder
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Programmatic access to your data. Keep tokens private.
            </p>
          </div>
          <Button onClick={() => setNewKeyOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New key
          </Button>
        </div>

        {justCreated && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-sm font-medium">Copy your key now — you won't see it again.</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-background px-3 py-2 font-mono text-xs">
                {justCreated.token}
              </code>
              <Button size="sm" variant="outline" onClick={() => copy(justCreated.token)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {keys.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No API keys yet. Create one to get started.
            </div>
          )}
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                </div>
              </div>
              <code className="rounded-md border bg-background px-2 py-1 font-mono text-xs">
                {reveal[k.id] ? k.token : maskToken(k.token)}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setReveal({ ...reveal, [k.id]: !reveal[k.id] })}
                aria-label="Toggle reveal"
              >
                {reveal[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copy(k.token)} aria-label="Copy">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteKey(k.id)}
                aria-label="Revoke"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          This is a UI placeholder — keys are stored locally in your browser and are not backed by a
          real API yet.
        </p>
      </section>

      <Dialog open={newKeyOpen} onOpenChange={setNewKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>Name your key so you remember what it's for.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kname">Key name</Label>
            <Input
              id="kname"
              placeholder="e.g. POS integration"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKeyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createKey} className="gradient-warm text-primary-foreground">
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
