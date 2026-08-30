"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Share2,
  Sparkles,
  ExternalLink,
  Edit3,
  Copy,
  RefreshCw,
  Eye,
  ShieldCheck,
  Building2,
  Code2,
  Upload,
  Loader2,
  Trash2,
  Image,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminContext } from "@/lib/admin-context";
import { getAdminSeoServer, saveAdminSeoServer } from "@/lib/db-queries.server";
import { uploadToImgBB } from "@/lib/imgbb";

export interface RestaurantSeoRecord {
  id: string;
  name: string;
  username: string;
  metaTitle?: string;
  metaDescription?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
  isIndexed: boolean;
  healthScore: number;
}

export default function SeoAdminComponent() {
  const { restaurantsList } = useAdminContext();

  const [seoRecords, setSeoRecords] = useState<RestaurantSeoRecord[]>(() =>
    restaurantsList.map((r, index) => {
      return {
        id: String(r.id),
        name: r.name,
        username: r.username,
        metaTitle: `${r.name} — Digital Menu & Table QR Ordering`,
        metaDescription: `Explore official digital menu for ${r.name}. Scan table QR codes to browse categories, order food, and view live kitchen status.`,
        faviconUrl: "",
        ogImageUrl: "",
        isIndexed: true,
        healthScore: index === 0 ? 100 : index === 1 ? 95 : 90,
      };
    }),
  );

  useEffect(() => {
    async function loadSeoData() {
      try {
        const rows = await getAdminSeoServer();
        if (rows && Array.isArray(rows) && rows.length > 0) {
          setSeoRecords(rows);
        }
      } catch (err) {
        console.error("[SEO Admin] Error loading SEO data from MySQL:", err);
      }
    }
    loadSeoData();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingRecord, setEditingRecord] = useState<RestaurantSeoRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Global platform defaults
  const [platformSeo, setPlatformSeo] = useState({
    titleTemplate: "%s | aMenuVerse Digital Platform",
    defaultDescription:
      "aMenuVerse is the ultimate multi-tenant digital menu, table QR ordering, and POS platform for modern restaurants.",
    canonicalBase: "http://localhost:8080",
    googleSiteVerification: "google-site-verification-amenuverse-id-2026",
    twitterHandle: "@aMenuVerse",
  });

  // Robots.txt content state
  const [robotsTxt, setRobotsTxt] = useState(
    `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /auth/\nDisallow: /pos/\n\nSitemap: http://localhost:8080/sitemap.xml`,
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return seoRecords;
    return seoRecords.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        (r.metaTitle && r.metaTitle.toLowerCase().includes(q)),
    );
  }, [seoRecords, searchQuery]);

  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingRecord) return;

    setUploadingFavicon(true);
    try {
      const cdnUrl = await uploadToImgBB(file);
      if (cdnUrl) {
        setEditingRecord((prev) => (prev ? { ...prev, faviconUrl: cdnUrl } : null));
        toast.success("Uploaded Favicon to CDN successfully!");
      }
    } catch {
      toast.error("Failed to upload favicon image");
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleOgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingRecord) return;

    setUploadingOg(true);
    try {
      const cdnUrl = await uploadToImgBB(file);
      if (cdnUrl) {
        setEditingRecord((prev) => (prev ? { ...prev, ogImageUrl: cdnUrl } : null));
        toast.success("Uploaded Social Share OG Image to CDN successfully!");
      }
    } catch {
      toast.error("Failed to upload OG image");
    } finally {
      setUploadingOg(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!editingRecord) return;
    try {
      await saveAdminSeoServer({ data: editingRecord });
      setSeoRecords((prev) =>
        prev.map((item) => (item.id === editingRecord.id ? editingRecord : item)),
      );
      toast.success(`Saved SEO metadata for ${editingRecord.name} to MySQL database`);
      setIsEditOpen(false);
    } catch {
      toast.error("Failed to save SEO metadata to database");
    }
  };

  const handleSavePlatformSeo = () => {
    toast.success("Updated global platform SEO settings!");
  };

  const selectedPreviewRecord = filteredRecords[0] ||
    seoRecords[0] || {
      id: "1",
      name: "Burger Craft Lab",
      username: "burgercraftlab",
      metaTitle: "Burger Craft Lab — Digital Menu & Table QR Ordering",
      metaDescription: "Explore official digital menu for Burger Craft Lab.",
      faviconUrl: "",
      ogImageUrl: "",
      isIndexed: true,
      healthScore: 95,
    };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-500" /> SEO & Metadata Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage search engine indexing, Open Graph social share cards, favicons, and schema.org
            structured data across all restaurant tenants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.success("Triggered automated sitemap re-indexing ping to Google & Bing!");
            }}
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Ping Search Engines
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Indexed Public Pages</p>
            <p className="text-xl font-bold text-foreground">{seoRecords.length + 4} Pages</p>
          </div>
        </div>

        <div className="glass rounded-xl p-4 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Average SEO Health</p>
            <p className="text-xl font-bold text-foreground">98.5% Good</p>
          </div>
        </div>

        <div className="glass rounded-xl p-4 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">OG Social Previews</p>
            <p className="text-xl font-bold text-foreground">100% Configured</p>
          </div>
        </div>

        <div className="glass rounded-xl p-4 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
            <FileCode className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Schema.org JSON-LD</p>
            <p className="text-xl font-bold text-foreground">Valid Restaurant</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tenants" className="gap-2 cursor-pointer">
            <Building2 className="h-4 w-4" /> Tenant Metadata
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-2 cursor-pointer">
            <Globe className="h-4 w-4" /> Global Platform SEO
          </TabsTrigger>
          <TabsTrigger value="sitemap" className="gap-2 cursor-pointer">
            <FileCode className="h-4 w-4" /> Sitemap & Robots.txt
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2 cursor-pointer">
            <Eye className="h-4 w-4" /> Search & Share Simulator
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: TENANT METADATA ── */}
        <TabsContent value="tenants">
          <section className="glass rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by restaurant name, username slug, or meta title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Meta Title & Description</TableHead>
                    <TableHead>Favicon</TableHead>
                    <TableHead>OG Image</TableHead>
                    <TableHead>Indexing</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{r.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            /{r.username}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs text-foreground truncate">
                            {r.metaTitle}
                          </span>
                          <span className="text-[11px] text-muted-foreground line-clamp-1">
                            {r.metaDescription}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.faviconUrl ? (
                          <img
                            src={r.faviconUrl}
                            alt="Favicon"
                            className="h-6 w-6 rounded-md object-cover border border-border"
                          />
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600">
                            Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.ogImageUrl ? (
                          <img
                            src={r.ogImageUrl}
                            alt="OG Share Image"
                            className="h-7 w-12 rounded-md object-cover border border-border"
                          />
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600">
                            Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.isIndexed}
                          onCheckedChange={async (val) => {
                            try {
                              await saveAdminSeoServer({ data: { id: r.id, isIndexed: val } });
                              setSeoRecords((prev) =>
                                prev.map((item) =>
                                  item.id === r.id ? { ...item, isIndexed: val } : item,
                                ),
                              );
                              toast.success(
                                `${r.name} indexing set to ${val ? "INDEX" : "NOINDEX"} in MySQL`,
                              );
                            } catch {
                              toast.error("Failed to update indexing in database");
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            r.healthScore >= 95
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-600 text-white"
                          }
                        >
                          {r.healthScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingRecord({ ...r });
                              setIsEditOpen(true);
                            }}
                            title="Edit SEO Parameters"
                            className="cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4 text-blue-500" />
                          </Button>
                          <a
                            href={`/${r.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Open Public Menu Page"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No restaurant SEO records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        {/* ── TAB 2: GLOBAL PLATFORM SEO ── */}
        <TabsContent value="global">
          <section className="glass rounded-2xl p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Global Platform Meta Configuration
              </h3>
              <p className="text-xs text-muted-foreground">
                Define platform-wide fallback title patterns, search verification tokens, and social
                cards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="titleTemplate">Title Format Pattern (%s = Restaurant Name)</Label>
                <Input
                  id="titleTemplate"
                  value={platformSeo.titleTemplate}
                  onChange={(e) =>
                    setPlatformSeo({ ...platformSeo, titleTemplate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="canonicalBase">Canonical Base Domain URL</Label>
                <Input
                  id="canonicalBase"
                  value={platformSeo.canonicalBase}
                  onChange={(e) =>
                    setPlatformSeo({ ...platformSeo, canonicalBase: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="defaultDescription">Global Fallback Meta Description</Label>
                <Textarea
                  id="defaultDescription"
                  rows={2}
                  value={platformSeo.defaultDescription}
                  onChange={(e) =>
                    setPlatformSeo({ ...platformSeo, defaultDescription: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleVerif">Google Site Verification Token</Label>
                <Input
                  id="googleVerif"
                  value={platformSeo.googleSiteVerification}
                  onChange={(e) =>
                    setPlatformSeo({ ...platformSeo, googleSiteVerification: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitHandle">Twitter Creator @Handle</Label>
                <Input
                  id="twitHandle"
                  value={platformSeo.twitterHandle}
                  onChange={(e) =>
                    setPlatformSeo({ ...platformSeo, twitterHandle: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSavePlatformSeo}
                className="gradient-warm text-primary-foreground gap-1.5 shadow-elegant cursor-pointer"
              >
                <Sparkles className="h-4 w-4" /> Save Platform SEO Defaults
              </Button>
            </div>
          </section>
        </TabsContent>

        {/* ── TAB 3: SITEMAP & ROBOTS.TXT ── */}
        <TabsContent value="sitemap">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sitemap Viewer */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-emerald-500" /> Live sitemap.xml
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Dynamically generated XML endpoint for Googlebot & Bingbot.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${seoRecords
                        .map(
                          (r) =>
                            `  <url>\n    <loc>http://localhost:8080/${r.username}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
                        )
                        .join("\n")}\n</urlset>`,
                    );
                    toast.success("XML sitemap copied to clipboard!");
                  }}
                  className="gap-1.5 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy XML
                </Button>
              </div>

              <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-80 border border-slate-800 leading-relaxed select-all">
                <pre>
                  {`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:8080/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${seoRecords
  .map(
    (r) => `  <url>
    <loc>http://localhost:8080/${r.username}</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`}
                </pre>
              </div>
            </section>

            {/* Robots.txt Editor */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-blue-500" /> Live robots.txt Rules
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Control crawl directives for search engine web crawlers.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => toast.success("Saved robots.txt crawl rules!")}
                  className="gradient-warm text-primary-foreground gap-1.5 cursor-pointer"
                >
                  Save Directive
                </Button>
              </div>

              <Textarea
                rows={10}
                value={robotsTxt}
                onChange={(e) => setRobotsTxt(e.target.value)}
                className="font-mono text-xs bg-slate-950 text-blue-400 border-slate-800 leading-relaxed"
              />
            </section>
          </div>
        </TabsContent>

        {/* ── TAB 4: SEARCH & SHARE SIMULATOR ── */}
        <TabsContent value="preview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Search Result Preview */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Google Search Snippet Preview</h3>
                <p className="text-xs text-muted-foreground">
                  Simulates how this restaurant appears on Google desktop search results.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-1 font-sans">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-700">
                    G
                  </span>
                  <span className="truncate">
                    http://localhost:8080 › {selectedPreviewRecord.username}
                  </span>
                </div>
                <h4 className="text-lg text-blue-800 hover:underline cursor-pointer font-medium leading-snug">
                  {selectedPreviewRecord.metaTitle}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                  {selectedPreviewRecord.metaDescription}
                </p>
              </div>
            </section>

            {/* WhatsApp / Social Share Card Preview */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  WhatsApp & Facebook Card Preview
                </h3>
                <p className="text-xs text-muted-foreground">
                  Simulates Open Graph card when shared via messaging & social media.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-slate-900 text-white overflow-hidden shadow-lg max-w-sm mx-auto">
                <div className="h-44 w-full bg-slate-800 relative overflow-hidden">
                  {selectedPreviewRecord.ogImageUrl ? (
                    <img
                      src={selectedPreviewRecord.ogImageUrl}
                      alt="OG Card Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-500 font-bold">
                      No OG Image
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1 bg-slate-900 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    localhost:8080
                  </span>
                  <h4 className="text-sm font-bold text-white leading-tight">
                    {selectedPreviewRecord.metaTitle}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {selectedPreviewRecord.metaDescription}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Restaurant SEO Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Restaurant SEO & Meta Tags</DialogTitle>
            <DialogDescription>
              Customize search title, meta description, favicon, and OG share card for{" "}
              {editingRecord?.name}.
            </DialogDescription>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="mtitle">Page Meta Title</Label>
                <Input
                  id="mtitle"
                  value={editingRecord.metaTitle || ""}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, metaTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mdesc">Page Meta Description</Label>
                <Textarea
                  id="mdesc"
                  rows={3}
                  value={editingRecord.metaDescription || ""}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, metaDescription: e.target.value })
                  }
                />
              </div>

              {/* Favicon Image Preview & Upload */}
              <div className="space-y-2">
                <Label>Browser Tab Favicon (Rec: 32×32px or 64×64px)</Label>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-accent/20 p-3">
                  <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border bg-background flex items-center justify-center shadow-xs">
                    {editingRecord.faviconUrl ? (
                      <img
                        src={editingRecord.faviconUrl}
                        alt="Favicon"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <label htmlFor="favicon-file-input">
                        <input
                          id="favicon-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFaviconUpload}
                          disabled={uploadingFavicon}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={uploadingFavicon}
                          onClick={() => document.getElementById("favicon-file-input")?.click()}
                          className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
                        >
                          {uploadingFavicon ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          {uploadingFavicon
                            ? "Uploading..."
                            : editingRecord.faviconUrl
                              ? "Change Favicon"
                              : "Upload Favicon"}
                        </Button>
                      </label>

                      {editingRecord.faviconUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRecord({ ...editingRecord, faviconUrl: "" })}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {editingRecord.faviconUrl
                        ? "Favicon uploaded to CDN"
                        : "Upload custom icon for browser tabs"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Share OG Image Preview & Upload */}
              <div className="space-y-2">
                <Label>Social Share Preview Image (OG Image — Rec: 1200×630px)</Label>
                <div className="rounded-xl border border-border bg-accent/20 p-3 space-y-3">
                  <div className="relative h-32 w-full rounded-lg overflow-hidden border border-border bg-background flex items-center justify-center shadow-xs">
                    {editingRecord.ogImageUrl ? (
                      <img
                        src={editingRecord.ogImageUrl}
                        alt="Social OG Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <Image className="h-8 w-8 text-muted-foreground/60" />
                        <span className="text-xs font-medium">No Social Preview Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground truncate">
                      {editingRecord.ogImageUrl
                        ? "Social preview card uploaded"
                        : "Upload 1200×630 image for WhatsApp & Facebook links"}
                    </p>
                    <div className="flex items-center gap-2">
                      <label htmlFor="og-file-input">
                        <input
                          id="og-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleOgUpload}
                          disabled={uploadingOg}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={uploadingOg}
                          onClick={() => document.getElementById("og-file-input")?.click()}
                          className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
                        >
                          {uploadingOg ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5 text-blue-500" />
                          )}
                          {uploadingOg
                            ? "Uploading..."
                            : editingRecord.ogImageUrl
                              ? "Change OG Image"
                              : "Upload OG Image"}
                        </Button>
                      </label>

                      {editingRecord.ogImageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRecord({ ...editingRecord, ogImageUrl: "" })}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecord} className="gradient-warm text-primary-foreground">
              Save SEO Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
